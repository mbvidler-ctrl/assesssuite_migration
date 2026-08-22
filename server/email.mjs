// Transactional email — real Resend adapter behind the house mock-fallback
// pattern (same shape as server/stripeGateway.mjs and server/llm.mjs):
// OUTBOUND_EMAIL_ENABLED=1 plus RESEND_API_KEY, outside self-test/parity mode,
// enables real sends via https://api.resend.com; otherwise this is outbox-only.
// EVERY send — real or not — is also recorded to the
// SQLite outbox_email table as the audit log, so the existing selftest
// assertions and local inspection keep working unchanged.
//
// Zero new npm dependencies: built-in fetch, form-free JSON API.
//
// Delivery failures are logged and never thrown: an email provider outage
// must not 500 a registration or reset request. The OTP/reset flows remain
// recoverable via resend.

import { capabilityEnabled } from './capabilityFlags.mjs';
import { resolveActiveProfessionContract } from '../packages/profession-config/runtime.mjs';

const RESEND_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 15000;

// Use a stable, replyable sender by default. Operators can still override it
// after verifying the corresponding sending identity with the provider.
function productIdentity(environment = process.env) {
  const { profession } = resolveActiveProfessionContract(environment);
  return {
    productName: profession.productName,
    shortName: profession.shortName,
    applicationHost: profession.deployment.intendedAppHost,
  };
}

const EMAIL_FROM = () => process.env.EMAIL_FROM
  || `${productIdentity().productName} <verification@assesssuite.com>`;
const EMAIL_REPLY_TO = () => process.env.EMAIL_REPLY_TO || 'admin@assesssuite.com';

export function adminNotificationRecipient(environment = process.env) {
  const configured = environment.EMAIL_ADMIN_NOTIFY;
  return typeof configured === 'string' && configured.trim() !== ''
    ? configured.trim()
    : 'admin@assesssuite.com';
}

const ADMIN_NOTIFY_TO = () => adminNotificationRecipient();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

let outbox = null;

/** Called once from server/index.mjs boot with the outbox_email repository. */
export function initEmail(outboxRepo) {
  outbox = outboxRepo;
}

export function emailEnabled(environment = process.env) {
  if (!capabilityEnabled('OUTBOUND_EMAIL_ENABLED', environment)) return false;
  const key = environment.RESEND_API_KEY;
  return typeof key === 'string' && key.trim() !== '';
}

/**
 * Future real-SMS adapters must branch on this affirmative capability gate.
 * The current SendSMS implementation remains outbox-only regardless of this
 * value; exposing the gate now makes the no-egress release posture explicit.
 */
export function smsEnabled(environment = process.env) {
  return capabilityEnabled('OUTBOUND_SMS_ENABLED', environment);
}

/**
 * Records to the outbox (always) and dispatches via Resend (when enabled).
 * Returns a delivery outcome and never throws. Confirmed sends include the
 * provider message id; failures include only safe, structured diagnostics.
 */
export async function sendEmail({ to, subject, text, html, idempotencyKey = null }) {
  if (
    idempotencyKey !== null
    && (
      typeof idempotencyKey !== 'string'
      || idempotencyKey.length < 1
      || idempotencyKey.length > 256
      || /[\r\n]/.test(idempotencyKey)
    )
  ) {
    throw new TypeError('Email idempotency key is invalid');
  }
  let recorded = false;
  try {
    // Retain delivery metadata only. Transactional message bodies can contain
    // OTPs, password-reset links or future sensitive context and must not be
    // duplicated into an indefinitely retained plaintext audit table.
    if (outbox) {
      outbox.record({ to, subject, body: null });
      recorded = true;
    }
  } catch (err) {
    console.log('[email] outbox record failed:', err.message);
  }
  if (!emailEnabled()) return { recorded, sent: false };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const res = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: EMAIL_FROM(),
          to: [to],
          reply_to: EMAIL_REPLY_TO(),
          subject,
          text,
          ...(html ? { html } : {}),
        }),
        signal: controller.signal,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const providerCode = typeof payload?.name === 'string'
          ? payload.name.slice(0, 80)
          : undefined;
        const failure = {
          stage: 'provider',
          code: 'provider_rejected',
          status: res.status,
          ...(providerCode ? { providerCode } : {}),
        };
        console.log('[email] provider rejected send:', failure);
        return { recorded, sent: false, failure };
      }

      const providerId = typeof payload?.id === 'string' ? payload.id.trim() : '';
      if (!/^[A-Za-z0-9_-]{6,200}$/.test(providerId)) {
        const failure = {
          stage: 'provider',
          code: 'invalid_provider_response',
          status: res.status,
        };
        console.log('[email] provider response did not contain a valid message id:', failure);
        return { recorded, sent: false, failure };
      }
      return { recorded, sent: true, providerId };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const failure = {
      stage: 'transport',
      code: err?.name === 'AbortError' ? 'timeout' : 'network_error',
    };
    console.log('[email] real send failed (outbox record retained):', failure);
    return { recorded, sent: false, failure };
  }
}

// ---------------------------------------------------------------------------
// Templates — plain text first (deliverability), minimal HTML wrapper.
// British English; no contractions.
// ---------------------------------------------------------------------------

function htmlWrap(title, bodyHtml, preheader = title) {
  const identity = productIdentity();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(title)}</title></head><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:520px;margin:0 auto;padding:24px">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${escapeHtml(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<h2 style="color:#0f172a;font-size:18px">${escapeHtml(title)}</h2>
${bodyHtml}
<p style="color:#94a3b8;font-size:12px;margin-top:28px">${escapeHtml(identity.productName)} — a product of Assess Suite Pty Ltd (ABN 53 694 044 481). This is an automated message; replies reach ${escapeHtml(EMAIL_REPLY_TO())}.</p>
</body></html>`;
}

export function otpEmail(code) {
  const safeCode = escapeHtml(code);
  const supportAddress = EMAIL_REPLY_TO();
  const identity = productIdentity();
  const safetyText = `You requested this code from ${identity.shortName} at ${identity.applicationHost}. Do not share this code with anyone, including ${identity.shortName} support. ${identity.shortName} will never ask you for it. If you did not request this code, ignore this email and contact ${supportAddress}.`;
  return {
    subject: `Your ${identity.shortName} verification code`,
    text: `Your ${identity.shortName} verification code is: ${code}\n\nThe code expires in 10 minutes.\n\n${safetyText}`,
    html: htmlWrap(
      'Verify your email',
      `<p>Your ${escapeHtml(identity.shortName)} verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#0f172a">${safeCode}</p><p>The code expires in 10 minutes.</p><p>${escapeHtml(safetyText)}</p>`,
      `Your ${identity.shortName} verification code expires in 10 minutes.`,
    ),
  };
}

export function resetEmail(link) {
  const safeLink = escapeHtml(link);
  const identity = productIdentity();
  return {
    subject: `Reset your ${identity.shortName} password`,
    text: `A password reset was requested for your ${identity.shortName} account.\n\nReset your password here (link expires in 60 minutes):\n${link}\n\nIf you did not request this, you can ignore this email — your password is unchanged.`,
    html: htmlWrap(
      'Reset your password',
      `<p>A password reset was requested for your ${escapeHtml(identity.shortName)} account.</p><p><a href="${safeLink}" style="background:#2563eb;color:#ffffff;padding:10px 22px;border-radius:8px;text-decoration:none;display:inline-block">Reset password</a></p><p>The link expires in 60 minutes. If you did not request this, you can ignore this email — your password is unchanged.</p>`,
    ),
  };
}

export function welcomeEmail(name) {
  const who = name ? ` ${name}` : '';
  const htmlWho = name ? ` ${escapeHtml(name)}` : '';
  const identity = productIdentity();
  return {
    subject: `Your ${identity.shortName} account is active`,
    text: `Welcome${who},\n\nYour ${identity.shortName} account is now active. You can sign in and begin using the platform.\n\nSupport: ${EMAIL_REPLY_TO()} | 1800 317 553 (Mon–Thu, 10 am–2 pm AEST)`,
    html: htmlWrap(
      'Your account is active',
      `<p>Welcome${htmlWho},</p><p>Your ${escapeHtml(identity.shortName)} account is now active. You can sign in and begin using the platform.</p><p>Support: ${escapeHtml(EMAIL_REPLY_TO())} | 1800 317 553 (Mon–Thu, 10 am–2 pm AEST)</p>`,
    ),
  };
}

export function adminNotifyEmail(newUserEmail) {
  const safeEmail = escapeHtml(newUserEmail);
  const identity = productIdentity();
  return {
    to: ADMIN_NOTIFY_TO(),
    subject: `${identity.shortName}: new registration`,
    text: `A new account has registered on ${identity.shortName}: ${newUserEmail}\n\nThe account is pending; it activates automatically on successful subscription payment or verified trial start.`,
    html: htmlWrap(
      'New registration',
      `<p>A new account has registered on ${escapeHtml(identity.shortName)}: <strong>${safeEmail}</strong></p><p>The account is pending; it activates automatically on successful subscription payment or verified trial start.</p>`,
    ),
  };
}

export function inviteEmail(role) {
  const safeRole = escapeHtml(role);
  const identity = productIdentity();
  return {
    subject: `You have been invited to ${identity.shortName}`,
    text: `You have been invited to ${identity.shortName} (role: ${role}).\n\nCreate your login at the ${identity.shortName} site using this email address.`,
    html: htmlWrap(
      'You have been invited',
      `<p>You have been invited to ${escapeHtml(identity.shortName)} (role: <strong>${safeRole}</strong>).</p><p>Create your login at the ${escapeHtml(identity.shortName)} site using this email address.</p>`,
    ),
  };
}
