import {
  createEntityRepository,
  createIntegrationConnectionRepository,
} from '../db.mjs';
import {
  integrationCredentialKeyConfigured,
  openIntegrationCredentials,
  sealIntegrationCredentials,
} from '../integrations/credentialVault.mjs';
import { createHalaxyClient, HalaxyApiError, resolveHalaxyRegion } from '../integrations/halaxy.mjs';
import { syncHalaxy } from '../integrations/halaxySync.mjs';

const HALAXY_PROVIDER_ID = 'halaxy';

function normalizeAccessEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function fail(ctx, status, code, message, extras = {}) {
  return ctx.respond(status, { status: 'error', error: code, message, ...extras });
}

function membershipContext(ctx) {
  const memberships = createEntityRepository(ctx.db, 'OrganizationMember').listAll().filter((row) => (
    normalizeAccessEmail(row.user_email) === normalizeAccessEmail(ctx.user?.email)
  ));
  const requestedOrgId = typeof ctx.body?.org_id === 'string' ? ctx.body.org_id.trim() : '';
  const membership = requestedOrgId
    ? memberships.find((row) => row.org_id === requestedOrgId)
    : memberships.find((row) => row.is_primary === true) || memberships[0];
  if (!membership) return null;
  const organization = createEntityRepository(ctx.db, 'Organization').getById(membership.org_id);
  return organization ? { membership, organization } : null;
}

function settingsFromBody(value, fallback = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  const retained = fallback && typeof fallback === 'object' ? fallback : {};
  const cleanId = (candidate, fallbackValue = '') => {
    if (candidate === undefined) return String(fallbackValue || '').trim().slice(0, 200);
    return String(candidate || '').trim().slice(0, 200);
  };
  const locationType = cleanId(source.location_type, retained.location_type || 'clinic').toLowerCase();
  return {
    import_patients: source.import_patients !== false,
    import_appointments: source.import_appointments !== false,
    export_patients: source.export_patients === true,
    export_appointments: source.export_appointments === true,
    practitioner_role_id: cleanId(source.practitioner_role_id, retained.practitioner_role_id),
    healthcare_service_id: cleanId(source.healthcare_service_id, retained.healthcare_service_id),
    location_type: ['clinic', 'telehealth', 'online', 'phone', 'organization'].includes(locationType)
      ? locationType
      : 'clinic',
  };
}

function connectionPresentation(connection) {
  if (!connection) {
    return {
      provider_id: HALAXY_PROVIDER_ID,
      status: 'disconnected',
      region: 'au',
      credential_hint: null,
      settings: settingsFromBody({}),
      capabilities: {},
      last_tested_at: null,
      last_success_at: null,
      last_error_code: null,
      updated_at: null,
    };
  }
  return {
    provider_id: connection.providerId,
    status: connection.status,
    region: connection.region || 'au',
    credential_hint: connection.credentialHint,
    settings: settingsFromBody(connection.settings),
    capabilities: connection.capabilities,
    last_tested_at: connection.lastTestedAt,
    last_success_at: connection.lastSuccessAt,
    last_error_code: connection.lastErrorCode,
    updated_at: connection.updatedAt,
  };
}

function eventPresentation(event) {
  return {
    id: event.id,
    provider_id: event.providerId,
    event_type: event.eventType,
    actor_email: event.actorEmail,
    detail: event.detail,
    created_at: event.createdAt,
  };
}

function credentialHint(clientId) {
  const clean = String(clientId || '').trim();
  return clean.length <= 4 ? `••••${clean}` : `••••${clean.slice(-4)}`;
}

function providerErrorResponse(ctx, error) {
  if (error instanceof HalaxyApiError) {
    return fail(ctx, error.httpStatus || 502, error.code, error.message, {
      ...(error.retryAfter ? { retry_after: error.retryAfter } : {}),
    });
  }
  if (error?.code === 'integration_credential_key_unavailable') {
    return fail(
      ctx,
      503,
      error.code,
      'Encrypted connector storage is not configured on this deployment.',
    );
  }
  if (error?.code === 'integration_credentials_unreadable') {
    return fail(ctx, 503, error.code, 'The saved connector credentials could not be opened. Reconnect Halaxy.');
  }
  throw error;
}

export default async function manageIntegrations(ctx) {
  if (!ctx.db || !ctx.user) {
    return fail(ctx, 503, 'integration_management_unavailable', 'Integration management is unavailable.');
  }
  if (ctx.user.account_status !== 'active') {
    return fail(ctx, 403, 'active_membership_required', 'An active practice account is required.');
  }
  const scope = membershipContext(ctx);
  if (!scope) {
    return fail(ctx, 403, 'organization_membership_required', 'Practice membership is required.');
  }
  const canManage = scope.membership.role === 'owner';
  const canSync = scope.membership.role === 'owner' || scope.membership.role === 'admin';
  const action = typeof ctx.body?.action === 'string' ? ctx.body.action : 'list';
  const connections = createIntegrationConnectionRepository(ctx.db);
  const existing = connections.get(scope.organization.id, HALAXY_PROVIDER_ID);

  if (action === 'list') {
    return ctx.respond(200, {
      status: 'success',
      organization: { id: scope.organization.id, name: scope.organization.name },
      organization_role: scope.membership.role,
      can_manage: canManage,
      can_sync: canSync,
      encrypted_storage_ready: integrationCredentialKeyConfigured(),
      connectors: [connectionPresentation(existing)],
      events: connections.listEvents(scope.organization.id, 50).map(eventPresentation),
    });
  }

  if (action === 'sync' && !canSync) {
    return fail(ctx, 403, 'integration_sync_access_required', 'Practice owner or administrator access is required to run a sync.');
  }
  if (action !== 'sync' && !canManage) {
    return fail(ctx, 403, 'owner_access_required', 'Practice owner access is required to change connectors.');
  }
  if (String(ctx.body?.provider_id || HALAXY_PROVIDER_ID) !== HALAXY_PROVIDER_ID) {
    return fail(ctx, 400, 'integration_provider_invalid', 'The selected connector is not supported.');
  }

  if (action === 'save') {
    try {
      const region = resolveHalaxyRegion(ctx.body?.configuration?.region || existing?.region || 'au');
      const suppliedClientId = String(ctx.body?.configuration?.client_id || '').trim();
      const suppliedClientSecret = String(ctx.body?.configuration?.client_secret || '').trim();
      let credentials;
      if (suppliedClientId || suppliedClientSecret) {
        // Constructing the client is an offline validation of field shape.
        createHalaxyClient({
          clientId: suppliedClientId,
          clientSecret: suppliedClientSecret,
          region,
          fetchImpl: async () => { throw new Error('offline validation only'); },
        });
        credentials = { client_id: suppliedClientId, client_secret: suppliedClientSecret };
      } else if (existing?.credentialsEncrypted) {
        credentials = openIntegrationCredentials(existing.credentialsEncrypted, {
          orgId: scope.organization.id,
          providerId: HALAXY_PROVIDER_ID,
        });
      } else {
        return fail(ctx, 400, 'halaxy_credentials_required', 'Enter the Halaxy Client ID and Client Secret.');
      }
      const sealed = sealIntegrationCredentials(credentials, {
        orgId: scope.organization.id,
        providerId: HALAXY_PROVIDER_ID,
      });
      const stored = connections.put({
        orgId: scope.organization.id,
        providerId: HALAXY_PROVIDER_ID,
        status: 'configured',
        region,
        credentialsEncrypted: sealed,
        credentialHint: credentialHint(credentials.client_id),
        settings: settingsFromBody(ctx.body?.configuration?.settings, existing?.settings),
        capabilities: existing?.capabilities || {},
        lastTestedAt: existing?.lastTestedAt || null,
        lastSuccessAt: existing?.lastSuccessAt || null,
        lastErrorCode: null,
        updatedByUserId: ctx.user.id,
        updatedByEmail: normalizeAccessEmail(ctx.user.email),
      });
      connections.recordEvent({
        orgId: scope.organization.id,
        providerId: HALAXY_PROVIDER_ID,
        eventType: 'configured',
        actorUserId: ctx.user.id,
        actorEmail: normalizeAccessEmail(ctx.user.email),
        detail: { region, credentials_replaced: Boolean(suppliedClientId || suppliedClientSecret) },
      });
      return ctx.respond(200, { status: 'success', connector: connectionPresentation(stored) });
    } catch (error) {
      return providerErrorResponse(ctx, error);
    }
  }

  if (action === 'test') {
    if (!existing?.credentialsEncrypted) {
      return fail(ctx, 409, 'halaxy_not_configured', 'Save Halaxy credentials before testing the connection.');
    }
    const observedAt = new Date().toISOString();
    try {
      const credentials = openIntegrationCredentials(existing.credentialsEncrypted, {
        orgId: scope.organization.id,
        providerId: HALAXY_PROVIDER_ID,
      });
      const result = await createHalaxyClient({
        clientId: credentials.client_id,
        clientSecret: credentials.client_secret,
        region: existing.region,
      }).testConnection();
      const stored = connections.put({
        ...existing,
        orgId: existing.orgId,
        providerId: existing.providerId,
        status: 'connected',
        capabilities: {
          ...(existing.capabilities || {}),
          fhir_version: result.fhirVersion,
          patient_read: result.patientReadAvailable,
          visible_patient_count: result.visiblePatientCount,
          rate_limit: result.rateLimit,
        },
        lastTestedAt: observedAt,
        lastSuccessAt: observedAt,
        lastErrorCode: null,
        updatedByUserId: ctx.user.id,
        updatedByEmail: normalizeAccessEmail(ctx.user.email),
      });
      connections.recordEvent({
        orgId: scope.organization.id,
        providerId: HALAXY_PROVIDER_ID,
        eventType: 'connection_test_succeeded',
        actorUserId: ctx.user.id,
        actorEmail: normalizeAccessEmail(ctx.user.email),
        detail: { region: existing.region, patient_read: true },
      });
      return ctx.respond(200, { status: 'success', connector: connectionPresentation(stored) });
    } catch (error) {
      const code = error?.code || 'halaxy_connection_test_failed';
      connections.put({
        ...existing,
        orgId: existing.orgId,
        providerId: existing.providerId,
        status: 'error',
        lastTestedAt: observedAt,
        lastErrorCode: code,
        updatedByUserId: ctx.user.id,
        updatedByEmail: normalizeAccessEmail(ctx.user.email),
      });
      connections.recordEvent({
        orgId: scope.organization.id,
        providerId: HALAXY_PROVIDER_ID,
        eventType: 'connection_test_failed',
        actorUserId: ctx.user.id,
        actorEmail: normalizeAccessEmail(ctx.user.email),
        detail: { region: existing.region, error_code: code },
      });
      return providerErrorResponse(ctx, error);
    }
  }

  if (action === 'sync') {
    if (!existing?.credentialsEncrypted || existing.status === 'disconnected') {
      return fail(ctx, 409, 'halaxy_not_configured', 'Save and test the Halaxy connection before syncing.');
    }
    const actorEmail = normalizeAccessEmail(ctx.user.email);
    connections.recordEvent({
      orgId: scope.organization.id,
      providerId: HALAXY_PROVIDER_ID,
      eventType: 'sync_started',
      actorUserId: ctx.user.id,
      actorEmail,
      detail: { mode: 'manual' },
    });
    try {
      const credentials = openIntegrationCredentials(existing.credentialsEncrypted, {
        orgId: scope.organization.id,
        providerId: HALAXY_PROVIDER_ID,
      });
      const halaxyClient = createHalaxyClient({
        clientId: credentials.client_id,
        clientSecret: credentials.client_secret,
        region: existing.region,
      });
      const result = await syncHalaxy({
        db: ctx.db,
        connectionRepository: connections,
        halaxyClient,
        connection: existing,
        orgId: scope.organization.id,
        actorUserId: ctx.user.id,
        actorEmail,
      });
      const compactSummary = {
        patients: {
          imported: result.summary.patients.imported,
          updated: result.summary.patients.updated,
          exported: result.summary.patients.exported,
          skipped: result.summary.patients.skipped,
        },
        appointments: {
          imported: result.summary.appointments.imported,
          updated: result.summary.appointments.updated,
          exported: result.summary.appointments.exported,
          skipped: result.summary.appointments.skipped,
        },
      };
      const stored = connections.put({
        ...existing,
        orgId: existing.orgId,
        providerId: existing.providerId,
        status: 'connected',
        capabilities: {
          ...(existing.capabilities || {}),
          last_sync_started_at: result.sync_started_at,
          last_sync_completed_at: result.sync_completed_at,
          last_sync_summary: compactSummary,
        },
        lastSuccessAt: result.sync_completed_at,
        lastErrorCode: null,
        updatedByUserId: ctx.user.id,
        updatedByEmail: actorEmail,
      });
      connections.recordEvent({
        orgId: scope.organization.id,
        providerId: HALAXY_PROVIDER_ID,
        eventType: 'sync_succeeded',
        actorUserId: ctx.user.id,
        actorEmail,
        detail: compactSummary,
      });
      return ctx.respond(200, {
        status: 'success',
        connector: connectionPresentation(stored),
        sync: result,
      });
    } catch (error) {
      const code = error?.code || 'halaxy_sync_failed';
      connections.put({
        ...existing,
        orgId: existing.orgId,
        providerId: existing.providerId,
        status: 'error',
        lastErrorCode: code,
        updatedByUserId: ctx.user.id,
        updatedByEmail: actorEmail,
      });
      connections.recordEvent({
        orgId: scope.organization.id,
        providerId: HALAXY_PROVIDER_ID,
        eventType: 'sync_failed',
        actorUserId: ctx.user.id,
        actorEmail,
        detail: { error_code: code },
      });
      return providerErrorResponse(ctx, error);
    }
  }

  if (action === 'disconnect') {
    const stored = connections.put({
      orgId: scope.organization.id,
      providerId: HALAXY_PROVIDER_ID,
      status: 'disconnected',
      region: existing?.region || 'au',
      credentialsEncrypted: null,
      credentialHint: null,
      settings: settingsFromBody(existing?.settings),
      capabilities: {},
      lastTestedAt: existing?.lastTestedAt || null,
      lastSuccessAt: existing?.lastSuccessAt || null,
      lastErrorCode: null,
      updatedByUserId: ctx.user.id,
      updatedByEmail: normalizeAccessEmail(ctx.user.email),
    });
    connections.recordEvent({
      orgId: scope.organization.id,
      providerId: HALAXY_PROVIDER_ID,
      eventType: 'disconnected',
      actorUserId: ctx.user.id,
      actorEmail: normalizeAccessEmail(ctx.user.email),
      detail: {},
    });
    return ctx.respond(200, { status: 'success', connector: connectionPresentation(stored) });
  }

  return fail(ctx, 400, 'integration_action_invalid', 'The requested integration action is not supported.');
}
