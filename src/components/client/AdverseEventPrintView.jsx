import React from "react";

const FIELD_LABELS = {
  occurred_with_person: "Event occurred while with the person",
  reported_in_person: "Reported by participant in-person",
  reported_phone_email: "Reported via telephone or email",
  unrelated: "UNRELATED â€” No evidence of causal relationship",
  unlikely: "UNLIKELY â€” Little evidence of causal relationship",
  possible: "POSSIBLE â€” Some evidence of causal relationship",
  probably: "PROBABLY â€” Evidence suggests causal relationship",
  definitely: "DEFINITELY â€” Clear evidence of causal relationship",
  fall: "Fall (with/without injury)",
  musculoskeletal_pain: "Musculoskeletal pain/injury (â‰¥2 days)",
  weight_loss: "Unintentional weight loss",
  drug_withdrawal: "Adverse drug withdrawal events",
  mood_alteration: "Mood alteration requiring health professional",
  death: "Death",
  life_threatening: "Life threatening illness or injury",
  hospitalization: "In-patient or prolonged hospitalization",
  disability: "Significant disability or incapacity"
};

const SAE_CATEGORIES = {
  accident_trauma_fracture: "Accident/Trauma/Fracture",
  cancer_neoplasm: "Cancer/Neoplasm",
  cardiovascular: "Cardiovascular",
  dialysis_access: "Dialysis Access",
  endocrine: "Endocrine Disorder",
  gastrointestinal: "Gastrointestinal",
  haematology: "Haematology",
  infection: "Infection",
  neurological: "Neurological",
  renal: "Other Renal",
  psychological_social: "Psychological/Social",
  other: "Other"
};

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", marginBottom: 4 }}>
      <span style={{ fontWeight: 600, minWidth: 200, flexShrink: 0, fontSize: 10 }}>{label}:</span>
      <span style={{ fontSize: 10 }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 style={{ fontSize: 13, fontWeight: 700, borderBottom: "2px solid #334155", paddingBottom: 4, marginTop: 16, marginBottom: 8 }}>
      {children}
    </h3>
  );
}

export default function AdverseEventPrintView({ event, client }) {
  if (!event) return null;

  return (
    <div id="ae-print-content" style={{ fontFamily: "Arial, Helvetica, sans-serif", color: "#111", padding: 0 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#991b1b" }}>ADVERSE EVENT REPORT</h1>
        <p style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
          Report Date: {event.report_date ? new Date(event.report_date).toLocaleDateString("en-AU") : "â€”"} | Status: {event.status?.toUpperCase() || "SUBMITTED"}
        </p>
      </div>

      {/* Clinician */}
      <SectionTitle>Clinician Details</SectionTitle>
      <Row label="Name" value={event.clinician_name} />
      <Row label="Email" value={event.clinician_email} />
      <Row label="Provider Number" value={event.clinician_provider_number} />

      {/* Participant */}
      <SectionTitle>Participant Details</SectionTitle>
      <Row label="Name" value={client?.full_name} />
      <Row label="Date of Birth" value={client?.date_of_birth} />
      <Row label="Client ID" value={client?.id} />

      {/* Section 1 */}
      <SectionTitle>Section 1: Potential Adverse Event</SectionTitle>
      <Row label="Person Completing Form" value={event.person_completing_form} />
      <Row label="Date Became Aware" value={event.date_became_aware} />
      <Row label="How Learned" value={FIELD_LABELS[event.how_learned] || event.how_learned} />
      <Row label="Date of Onset" value={event.date_of_onset} />
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontWeight: 600, fontSize: 10, marginBottom: 2 }}>Event Description:</p>
        <p style={{ fontSize: 10, whiteSpace: "pre-wrap", background: "#f8fafc", padding: 8, borderRadius: 4, border: "1px solid #e2e8f0" }}>
          {event.event_description || "â€”"}
        </p>
      </div>
      <Row label="Is SAE?" value={event.is_sae?.toUpperCase()} />
      <Row label="Is AESI?" value={event.is_aesi?.toUpperCase()} />

      {/* Section 2: SAE */}
      {(event.is_sae === "yes" || event.is_sae === "unsure") && (
        <>
          <SectionTitle>Section 2: Serious Adverse Event (SAE)</SectionTitle>
          {event.sae_types?.length > 0 && (
            <Row label="SAE Types" value={event.sae_types.map(t => FIELD_LABELS[t] || t).join("; ")} />
          )}
          <Row label="Category" value={SAE_CATEGORIES[event.sae_category] || event.sae_category} />
          {event.sae_category === "other" && <Row label="Other Category" value={event.sae_category_other} />}
          <Row label="Relationship to Activity" value={FIELD_LABELS[event.sae_relationship_to_activity] || event.sae_relationship_to_activity} />
          <Row label="Action Taken" value={event.sae_action_taken} />
          <Row label="Reason for Action" value={event.sae_action_reason} />
          <Row label="Hospitalized" value={event.sae_hospitalized?.toUpperCase()} />
          {event.sae_hospitalized === "yes" && (
            <>
              <Row label="Admission Date" value={event.sae_admission_date} />
              <Row label="Discharge Date" value={event.sae_discharge_date} />
              <Row label="Primary Diagnosis" value={event.sae_primary_diagnosis} />
              <Row label="Other Diagnoses" value={event.sae_other_diagnoses} />
            </>
          )}
          <Row label="Outcome" value={event.sae_outcome} />
          <Row label="Resolution Date" value={event.sae_resolution_date} />
          <Row label="Outcome Notes" value={event.sae_outcome_notes} />
        </>
      )}

      {/* Section 3: AESI */}
      {(event.is_aesi === "yes" || event.is_aesi === "unsure") && (
        <>
          <SectionTitle>Section 3: Adverse Event of Special Interest (AESI)</SectionTitle>
          <Row label="AESI Type" value={FIELD_LABELS[event.aesi_type] || event.aesi_type} />
          <Row label="When Occurred" value={event.aesi_when_occurred} />
          <Row label="Relationship to Activity" value={FIELD_LABELS[event.aesi_relationship_to_activity] || event.aesi_relationship_to_activity} />
          <Row label="Action Taken" value={event.aesi_action_taken} />
          <Row label="Reason for Action" value={event.aesi_action_reason} />
          <Row label="Hospitalized" value={event.aesi_hospitalized?.toUpperCase()} />
          {event.aesi_hospitalized === "yes" && (
            <>
              <Row label="Admission Date" value={event.aesi_admission_date} />
              <Row label="Discharge Date" value={event.aesi_discharge_date} />
              <Row label="Primary Diagnosis" value={event.aesi_primary_diagnosis} />
              <Row label="Other Diagnoses" value={event.aesi_other_diagnoses} />
            </>
          )}
          <Row label="Outcome" value={event.aesi_outcome} />
          <Row label="Resolution Date" value={event.aesi_resolution_date} />
          <Row label="Outcome Notes" value={event.aesi_outcome_notes} />
        </>
      )}

      {/* Attachments */}
      {event.attachments?.length > 0 && (
        <>
          <SectionTitle>Attachments</SectionTitle>
          {event.attachments.map((att, i) => (
            <Row key={i} label={`Attachment ${i + 1}`} value={`${att.attachment_name} (${att.attached_date})`} />
          ))}
        </>
      )}

      {/* Signature */}
      <SectionTitle>Clinician Acknowledgment</SectionTitle>
      <Row label="Acknowledged" value={event.clinician_acknowledgment ? "Yes â€” Reviewed and verified" : "No"} />
      {event.digital_signature && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 600, marginBottom: 4 }}>Digital Signature:</p>
          <img src={event.digital_signature} alt="Signature" style={{ maxWidth: 300, height: 80, objectFit: "contain", border: "1px solid #e2e8f0", borderRadius: 4 }} />
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 24, paddingTop: 8, borderTop: "1px solid #cbd5e1", fontSize: 9, color: "#94a3b8", textAlign: "center" }}>
        <p>This document was generated from the Adverse Event Reporting System. Confidential clinical document.</p>
      </div>
    </div>
  );
}