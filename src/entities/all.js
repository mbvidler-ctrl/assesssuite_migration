import { base44 } from '@/api/base44Client';
import { User } from './User';

// Legacy '@/entities/all' shim: one handle per custom entity, delegating to
// the base44 SDK entity client, plus the merged User surface re-exported.
export const AdverseEvent = base44.entities.AdverseEvent;
export const Appointment = base44.entities.Appointment;
export const Assessment = base44.entities.Assessment;
export const AssessmentRequest = base44.entities.AssessmentRequest;
export const Client = base44.entities.Client;
export const ClientAssessment = base44.entities.ClientAssessment;
export const ClientCondition = base44.entities.ClientCondition;
export const ClientDocument = base44.entities.ClientDocument;
export const ClientNutritionPlan = base44.entities.ClientNutritionPlan;
export const ClientOnboardingEpisode = base44.entities.ClientOnboardingEpisode;
export const ClientReport = base44.entities.ClientReport;
export const ClinicPolicy = base44.entities.ClinicPolicy;
export const Exercise = base44.entities.Exercise;
export const LegalAcceptance = base44.entities.LegalAcceptance;
// LegalAcceptanceEvent (added 2026-07-13, launch/legal-and-consent-integration):
// the distinct-event replacement for the monolithic LegalAcceptance stub —
// see src/lib/legal/documentRegistry.js.
export const LegalAcceptanceEvent = base44.entities.LegalAcceptanceEvent;
export const Organization = base44.entities.Organization;
export const OrganizationMember = base44.entities.OrganizationMember;
// Not present in docs/source-capture/20260702-live-entity-schemas.json (19
// custom entities) but actually imported by src/pages/Finances.jsx; included
// per the brief's "export at least every name actually imported" rule.
export const Payment = base44.entities.Payment;
export const SOAPNote = base44.entities.SOAPNote;
export const SavedReport = base44.entities.SavedReport;
export const TreatmentProtocol = base44.entities.TreatmentProtocol;

export { User };
