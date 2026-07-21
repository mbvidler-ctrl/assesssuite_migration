import React, { useRef, forwardRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X, Download } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useSecureFileUrl } from "@/components/files/SecureFile";
import { renderSafeHtmlDocument } from "@/lib/safeHtml";


const PrintableOnboardingReport = forwardRef(({ client, onClose }, ref) => {
  const localRef = useRef(null);
  const printRef = ref || localRef;
  const [medicalConditions, setMedicalConditions] = useState([]);
  const [clinicLogo, setClinicLogo] = useState("");
  const secureClinicLogo = useSecureFileUrl(clinicLogo, client?.org_id);

  useEffect(() => {
    const loadData = async () => {
      if (client && client.id) {
        try {
          const conditions = await base44.entities.ClientCondition.filter({ client_id: client.id });
          setMedicalConditions(conditions);
          
          // Load clinic logo
          const user = await base44.auth.me();
          if (user.clinic_logo_url) {
            setClinicLogo(user.clinic_logo_url);
          }
        } catch (error) {
          console.error("Error loading data:", error);
        }
      }
    };
    loadData();
  }, [client]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const content = document.querySelector('.print-content');
    if (!content || !printWindow) return;
    
    renderSafeHtmlDocument(printWindow, `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Client Onboarding Report</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; margin: 15mm; }
            h1 { font-size: 16pt; font-weight: bold; }
            h2 { font-size: 12pt; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 12px; }
            h3 { font-size: 11pt; font-weight: bold; }
            h4 { font-size: 10pt; font-weight: bold; }
            p { margin: 2px 0; }
            .grid { display: grid; }
            .grid-cols-2 { grid-template-columns: 1fr 1fr; gap: 8px; }
            .grid-cols-3 { grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
            .col-span-2 { grid-column: span 2; }
            .bg-slate-50 { background: #f8fafc; padding: 6px; border-radius: 4px; }
            .bg-blue-50 { background: #eff6ff; padding: 6px; border-radius: 4px; }
            .bg-blue-100 { background: #dbeafe; padding: 6px; border-radius: 4px; }
            .bg-white { background: white; }
            .bg-yellow-50 { background: #fefce8; }
            .border { border: 1px solid #e2e8f0; }
            .border-slate-200 { border: 1px solid #e2e8f0; }
            .border-blue-200 { border: 1px solid #bfdbfe; }
            .rounded { border-radius: 4px; }
            .p-2 { padding: 8px; }
            .p-3 { padding: 12px; }
            .p-4 { padding: 16px; }
            .mb-4 { margin-bottom: 12px; }
            .text-center { text-align: center; }
            .text-xs { font-size: 8pt; }
            .text-sm { font-size: 9pt; }
            .text-base { font-size: 10pt; }
            .text-lg { font-size: 12pt; }
            .font-semibold { font-weight: 600; }
            .font-bold { font-weight: bold; }
            .text-slate-500 { color: #64748b; }
            .text-slate-600 { color: #475569; }
            .text-slate-700 { color: #334155; }
            .text-slate-800 { color: #1e293b; }
            .text-slate-900 { color: #0f172a; }
            .text-blue-600 { color: #2563eb; }
            .text-blue-700 { color: #1d4ed8; }
            .text-green-600 { color: #16a34a; }
            .text-yellow-600 { color: #ca8a04; }
            .text-red-600 { color: #dc2626; }
            .bg-red-100 { background: #fee2e2; }
            .bg-green-100 { background: #dcfce7; }
            .bg-yellow-100 { background: #fef9c3; }
            .bg-blue-100 { background: #dbeafe; }
            .bg-gray-100 { background: #f3f4f6; }
            .text-red-800 { color: #991b1b; }
            .text-green-800 { color: #166534; }
            .text-yellow-800 { color: #854d0e; }
            .text-blue-800 { color: #1e40af; }
            .text-gray-800 { color: #1f2937; }
            .px-2 { padding-left: 8px; padding-right: 8px; }
            .px-3 { padding-left: 12px; padding-right: 12px; }
            .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
            .py-1 { padding-top: 4px; padding-bottom: 4px; }
            .ml-2 { margin-left: 8px; }
            .ml-4 { margin-left: 16px; }
            .mt-1 { margin-top: 4px; }
            .mt-2 { margin-top: 8px; }
            .mt-3 { margin-top: 12px; }
            .space-y-1 > * + * { margin-top: 4px; }
            .space-y-2 > * + * { margin-top: 8px; }
            .space-y-3 > * + * { margin-top: 12px; }
            .flex { display: flex; }
            .flex-1 { flex: 1; }
            .items-start { align-items: flex-start; }
            .items-center { align-items: center; }
            .justify-between { justify-content: space-between; }
            .whitespace-pre-wrap { white-space: pre-wrap; }
            .border-b { border-bottom: 1px solid #e2e8f0; }
            .pb-1 { padding-bottom: 4px; }
            .pb-2 { padding-bottom: 8px; }
            .gap-2 { gap: 8px; }
            .gap-3 { gap: 12px; }
            .gap-4 { gap: 16px; }
            img { max-width: 100%; height: auto; }
            .max-w-xs { max-width: 200px; }
            .mx-auto { margin-left: auto; margin-right: auto; }
            .max-h-10 { max-height: 40px; }
            .max-h-20 { max-height: 80px; }
            section { margin-bottom: 12px; page-break-inside: avoid; }
            .apss-section { page-break-inside: auto; }
            .apss-question-row { page-break-inside: avoid; }
            .signature-block { page-break-inside: avoid; }
            @page { size: A4; margin: 15mm; }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const handleSavePDF = () => {
    handlePrint();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatYesNo = (value) => {
    if (value === true) return "Yes";
    if (value === false) return "No";
    return "Not specified";
  };

  const safeFormatDate = (dateValue, formatString = 'dd/MM/yyyy') => {
    if (!dateValue) return "—";
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return "—";
      return format(date, formatString);
    } catch (error) {
      console.error("Error formatting date:", dateValue, error);
      return "—";
    }
  };

  const referralSourceLabels = {
    "gp": "General Practitioner",
    "wc_case_manager": "Workers' Compensation Case Manager",
    "aged_care_case_manager": "Aged Care Case Manager",
    "ndis_support_coordinator": "NDIS Support Coordinator",
    "dva": "Department of Veterans' Affairs (DVA)",
    "self_referral": "Self Referral",
    "other": "Other"
  };

  const fundingSourceLabels = {
    "dva": "DVA (Department of Veterans' Affairs)",
    "private_health": "Private Health Insurance",
    "medicare": "Medicare",
    "self_funded": "Self Funded",
    "workcover_qld": "WorkCover QLD",
    "ndis": "NDIS",
    "tac_maic": "TAC/MAIC",
    "aged_care": "Aged Care",
    "my_aged_care": "My Aged Care",
    "other": "Other"
  };

  return (
    <div 
    className="onboarding-print-overlay fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
    onClick={handleBackdropClick}
    style={{ zIndex: 9999 }}
    >
    <div 
      className="onboarding-print-modal bg-white rounded-lg w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl" 
      onClick={(e) => e.stopPropagation()}
    >
        {/* HEADER WITH BUTTONS - Always visible except when printing */}
        <div className="no-print flex-shrink-0 flex justify-between items-center p-6 border-b-2 border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50 rounded-t-lg">
          <h2 className="text-2xl font-bold text-slate-900">Client Onboarding Report</h2>
          <div className="flex gap-3">
            <Button 
              onClick={handleSavePDF} 
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg font-semibold"
            >
              <Download className="w-5 h-5 mr-2" />
              Save PDF
            </Button>
            <Button 
              onClick={handlePrint} 
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white shadow-lg font-semibold"
            >
              <Printer className="w-5 h-5 mr-2" />
              Print
            </Button>
            <Button 
              onClick={onClose} 
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white shadow-lg font-semibold"
            >
              <X className="w-5 h-5 mr-2" />
              Close
            </Button>
          </div>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto p-8 print-content">
          {/* Header */}
          <div className="text-center border-b border-slate-900 pb-2 mb-3">
            {secureClinicLogo && (
              <img 
                src={secureClinicLogo}
                alt="Clinic Logo" 
                className="mx-auto mb-1 max-h-10 print-logo"
              />
            )}
            <h1 className="text-2xl font-bold text-slate-900">CLIENT ONBOARDING REPORT</h1>
            <p className="text-xs text-slate-600 mt-1">
              Generated on {safeFormatDate(new Date(), 'dd MMMM yyyy')}
            </p>
          </div>

          {/* Personal Information */}
          <section className="mb-4">
            <h2 className="text-base font-bold text-slate-900 mb-2 border-b border-slate-300 pb-1">
              Personal Information
            </h2>
            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
              <div>
                <p className="text-sm font-semibold text-slate-700">Full Name:</p>
                <p className="text-slate-900">{client.full_name || "—"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Date of Birth:</p>
                <p className="text-slate-900">{safeFormatDate(client.date_of_birth)}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Gender:</p>
                <p className="text-slate-900">
                  {client.gender === "other" ? client.gender_other : client.gender || "—"}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Pronouns:</p>
                <p className="text-slate-900">{client.pronouns || "—"}</p>
              </div>
            </div>
          </section>

          {/* Contact Information - only show if any contact data exists */}
          {(client.phone || client.email || client.address || client.emergency_contact_name || client.emergency_contact_phone) && (
            <section className="mb-4">
              <h2 className="text-base font-bold text-slate-900 mb-2 border-b border-slate-300 pb-1">
                Contact Information
              </h2>
              <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                {client.phone && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Phone:</p>
                    <p className="text-slate-900">{client.phone}</p>
                  </div>
                )}
                {client.email && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Email:</p>
                    <p className="text-slate-900">{client.email}</p>
                  </div>
                )}
                {client.address && (
                  <div className="col-span-2">
                    <p className="text-sm font-semibold text-slate-700">Address:</p>
                    <p className="text-slate-900">{client.address}</p>
                  </div>
                )}
                {client.emergency_contact_name && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Emergency Contact:</p>
                    <p className="text-slate-900">{client.emergency_contact_name}</p>
                  </div>
                )}
                {client.emergency_contact_phone && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Emergency Phone:</p>
                    <p className="text-slate-900">{client.emergency_contact_phone}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Cultural Considerations */}
          {client.cultural_considerations && (
            <section className="mb-4">
              <h2 className="text-base font-bold text-slate-900 mb-2 border-b border-slate-300 pb-1">
                Cultural Considerations
              </h2>
              <p className="text-sm text-slate-900 whitespace-pre-wrap">{client.cultural_considerations}</p>
            </section>
          )}

          {/* Referral Information - only show if any referral data exists */}
          {(client.referral_source || client.referral_source_name || (client.additional_referrals && client.additional_referrals.length > 0)) && (
            <section className="mb-4">
            <h2 className="text-base font-bold text-slate-900 mb-2 border-b border-slate-300 pb-1">
              Referral Information
            </h2>
            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
              {client.referral_source && (
              <div>
                <p className="text-sm font-semibold text-slate-700">Referral Source:</p>
                <p className="text-slate-900">{referralSourceLabels[client.referral_source] || client.referral_source}</p>
              </div>
              )}
              {client.referral_date && (
              <div>
                <p className="text-sm font-semibold text-slate-700">Referral Date:</p>
                <p className="text-slate-900">{safeFormatDate(client.referral_date)}</p>
              </div>
              )}
              {client.referral_source_name && (
                <div className="col-span-2">
                  <p className="text-sm font-semibold text-slate-700">Referrer Name:</p>
                  <p className="text-slate-900">{client.referral_source_name}</p>
                </div>
              )}
              {client.referral_source_address && (
                <div className="col-span-2">
                  <p className="text-sm font-semibold text-slate-700">Referrer Address:</p>
                  <p className="text-slate-900">{client.referral_source_address}</p>
                </div>
              )}
              {client.referral_source_email && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Referrer Email:</p>
                  <p className="text-slate-900">{client.referral_source_email}</p>
                </div>
              )}
              {client.referral_provider_number && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Provider Number:</p>
                  <p className="text-slate-900">{client.referral_provider_number}</p>
                </div>
              )}
              {client.referral_reason && (
                <div className="col-span-2">
                  <p className="text-sm font-semibold text-slate-700">Reason for Referral:</p>
                  <p className="text-slate-900 whitespace-pre-wrap">{client.referral_reason}</p>
                </div>
              )}
            </div>

            {/* Additional Referrals */}
            {client.additional_referrals && client.additional_referrals.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-sm font-semibold text-slate-700 mb-2">Additional Referral Sources:</p>
                {client.additional_referrals.map((ref, idx) => (
                  <div key={idx} className="bg-slate-50 p-2 rounded mb-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="font-semibold">Source:</span> {referralSourceLabels[ref.referral_source] || ref.referral_source}
                      </div>
                      {ref.referral_date && (
                        <div>
                          <span className="font-semibold">Date:</span> {safeFormatDate(ref.referral_date)}
                        </div>
                      )}
                      {ref.referral_source_name && (
                        <div className="col-span-2">
                          <span className="font-semibold">Name:</span> {ref.referral_source_name}
                        </div>
                      )}
                      {ref.referral_reason && (
                        <div className="col-span-2">
                          <span className="font-semibold">Reason:</span> {ref.referral_reason}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </section>
          )}

          {/* Medical Professionals */}
          {(client.primary_gp_name || client.hospital_name || client.specialist_name || client.other_healthcare_providers) && (
            <section className="mb-4">
              <h2 className="text-base font-bold text-slate-900 mb-2 border-b border-slate-300 pb-1">
                Medical Professionals
              </h2>

              {/* Primary GP */}
              {client.primary_gp_name && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-800 mb-1">Primary/Community GP</p>
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2 rounded">
                    <div>
                      <span className="font-semibold">Name:</span> {client.primary_gp_name}
                    </div>
                    {client.primary_gp_clinic_name && (
                      <div>
                        <span className="font-semibold">Clinic:</span> {client.primary_gp_clinic_name}
                      </div>
                    )}
                    {client.primary_gp_phone && (
                      <div>
                        <span className="font-semibold">Phone:</span> {client.primary_gp_phone}
                      </div>
                    )}
                    {client.primary_gp_email && (
                      <div>
                        <span className="font-semibold">Email:</span> {client.primary_gp_email}
                      </div>
                    )}
                    {client.primary_gp_provider_number && (
                      <div>
                        <span className="font-semibold">Provider Number:</span> {client.primary_gp_provider_number}
                      </div>
                    )}
                    {client.primary_gp_address && (
                      <div className="col-span-2">
                        <span className="font-semibold">Address:</span> {client.primary_gp_address}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hospital/Rehab Center GP */}
              {client.hospital_name && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-800 mb-1">Hospital/Rehab Center</p>
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2 rounded">
                    <div>
                      <span className="font-semibold">Facility:</span> {client.hospital_name}
                    </div>
                    {client.hospital_gp_name && (
                      <div>
                        <span className="font-semibold">Doctor:</span> {client.hospital_gp_name}
                      </div>
                    )}
                    {client.hospital_gp_phone && (
                      <div>
                        <span className="font-semibold">Phone:</span> {client.hospital_gp_phone}
                      </div>
                    )}
                    {client.hospital_gp_email && (
                      <div>
                        <span className="font-semibold">Email:</span> {client.hospital_gp_email}
                      </div>
                    )}
                    {client.hospital_gp_provider_number && (
                      <div>
                        <span className="font-semibold">Provider Number:</span> {client.hospital_gp_provider_number}
                      </div>
                    )}
                    {client.hospital_gp_address && (
                      <div className="col-span-2">
                        <span className="font-semibold">Address:</span> {client.hospital_gp_address}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Specialist */}
              {client.specialist_name && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-800 mb-1">Specialist</p>
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2 rounded">
                    <div>
                      <span className="font-semibold">Name:</span> {client.specialist_name}
                    </div>
                    {client.specialist_type && (
                      <div>
                        <span className="font-semibold">Type:</span> {client.specialist_type}
                      </div>
                    )}
                    {client.specialist_clinic_name && (
                      <div>
                        <span className="font-semibold">Clinic:</span> {client.specialist_clinic_name}
                      </div>
                    )}
                    {client.specialist_phone && (
                      <div>
                        <span className="font-semibold">Phone:</span> {client.specialist_phone}
                      </div>
                    )}
                    {client.specialist_email && (
                      <div>
                        <span className="font-semibold">Email:</span> {client.specialist_email}
                      </div>
                    )}
                    {client.specialist_provider_number && (
                      <div>
                        <span className="font-semibold">Provider Number:</span> {client.specialist_provider_number}
                      </div>
                    )}
                    {client.specialist_address && (
                      <div className="col-span-2">
                        <span className="font-semibold">Address:</span> {client.specialist_address}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Other Healthcare Providers */}
              {client.other_healthcare_providers && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Other Healthcare Providers:</p>
                  <p className="text-xs text-slate-900 whitespace-pre-wrap mt-1">{client.other_healthcare_providers}</p>
                </div>
              )}
            </section>
          )}

          {/* Funding Information */}
          {client.funding_source && (
            <section className="mb-4">
              <h2 className="text-base font-bold text-slate-900 mb-2 border-b border-slate-300 pb-1">
                Funding Information
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Primary Funding Source:</p>
                  <p className="text-slate-900">{fundingSourceLabels[client.funding_source] || client.funding_source}</p>
                </div>

                {/* DVA Specific */}
                {client.funding_source === "dva" && (
                  <div className="bg-slate-50 p-3 rounded">
                    <p className="text-sm font-semibold text-slate-800 mb-2">DVA Details</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {client.dva_card_number && <div><span className="font-semibold">Card Number:</span> {client.dva_card_number}</div>}
                      {client.dva_card_type && <div><span className="font-semibold">Card Type:</span> {client.dva_card_type.toUpperCase()}</div>}
                      {client.dva_file_number && <div><span className="font-semibold">File Number:</span> {client.dva_file_number}</div>}
                      {client.dva_card_expiry && <div><span className="font-semibold">Card Expiry:</span> {safeFormatDate(client.dva_card_expiry)}</div>}
                      {client.dva_accepted_conditions && <div className="col-span-2"><span className="font-semibold">Accepted Conditions:</span> {client.dva_accepted_conditions}</div>}
                      {client.dva_veteran_status && <div className="col-span-2"><span className="font-semibold">Veteran Status:</span> {client.dva_veteran_status}</div>}
                    </div>
                  </div>
                )}

                {/* WorkCover Specific */}
                {client.funding_source === "workcover_qld" && (
                  <div className="bg-slate-50 p-3 rounded">
                    <p className="text-sm font-semibold text-slate-800 mb-2">WorkCover QLD Details</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {client.workcover_claim_number && <div><span className="font-semibold">Claim Number:</span> {client.workcover_claim_number}</div>}
                      {client.workcover_date_of_injury && <div><span className="font-semibold">Date of Injury:</span> {safeFormatDate(client.workcover_date_of_injury)}</div>}
                      {client.workcover_work_capacity && <div><span className="font-semibold">Work Capacity:</span> {client.workcover_work_capacity}</div>}
                      {client.workcover_injury_description && <div className="col-span-2"><span className="font-semibold">Injury Description:</span> {client.workcover_injury_description}</div>}
                      {client.workcover_workplace_tasks && <div className="col-span-2"><span className="font-semibold">Workplace Tasks/Limitations:</span> {client.workcover_workplace_tasks}</div>}
                      {client.workcover_rtw_planning && <div className="col-span-2"><span className="font-semibold">Return to Work Planning:</span> {client.workcover_rtw_planning}</div>}
                    </div>
                  </div>
                )}

                {/* NDIS Specific */}
                {client.funding_source === "ndis" && (
                  <div className="bg-slate-50 p-3 rounded">
                    <p className="text-sm font-semibold text-slate-800 mb-2">NDIS Details</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {client.ndis_number && <div><span className="font-semibold">NDIS Number:</span> {client.ndis_number}</div>}
                      {client.ndis_goals && <div className="col-span-2"><span className="font-semibold">Goals:</span> {client.ndis_goals}</div>}
                      {client.ndis_functional_impact && <div className="col-span-2"><span className="font-semibold">Functional Impact:</span> {client.ndis_functional_impact}</div>}
                      {client.ndis_support_recommendations && <div className="col-span-2"><span className="font-semibold">Support Recommendations:</span> {client.ndis_support_recommendations}</div>}
                      {client.ndis_assistive_tech && <div className="col-span-2"><span className="font-semibold">Assistive Technology:</span> {client.ndis_assistive_tech}</div>}
                      {client.ndis_risk_factors && <div className="col-span-2"><span className="font-semibold">Risk Factors:</span> {client.ndis_risk_factors}</div>}
                      {client.ndis_daily_living_capacity && <div className="col-span-2"><span className="font-semibold">Daily Living Capacity:</span> {client.ndis_daily_living_capacity}</div>}
                    </div>
                  </div>
                )}

                {/* Medicare Specific */}
                {client.funding_source === "medicare" && (
                  <div className="bg-slate-50 p-3 rounded">
                    <p className="text-sm font-semibold text-slate-800 mb-2">Medicare Details</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {client.medicare_number && <div><span className="font-semibold">Medicare Number:</span> {client.medicare_number}</div>}
                      {client.medicare_irn && <div><span className="font-semibold">IRN:</span> {client.medicare_irn}</div>}
                      {client.medicare_expiry && <div><span className="font-semibold">Expiry:</span> {safeFormatDate(client.medicare_expiry)}</div>}
                      {client.medicare_referral_type && <div><span className="font-semibold">Referral Type:</span> {client.medicare_referral_type.toUpperCase()}</div>}
                      {client.medicare_item_number && <div><span className="font-semibold">Item Number:</span> {client.medicare_item_number}</div>}
                    </div>
                  </div>
                )}

                {/* Private Health Specific */}
                {client.funding_source === "private_health" && (
                  <div className="bg-slate-50 p-3 rounded">
                    <p className="text-sm font-semibold text-slate-800 mb-2">Private Health Details</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {client.private_health_fund_name && <div><span className="font-semibold">Fund Name:</span> {client.private_health_fund_name}</div>}
                      {client.private_health_fund_number && <div><span className="font-semibold">Member Number:</span> {client.private_health_fund_number}</div>}
                      {client.private_health_irn && <div><span className="font-semibold">IRN:</span> {client.private_health_irn}</div>}
                    </div>
                  </div>
                )}

                {/* TAC/MAIC Specific */}
                {client.funding_source === "tac_maic" && (
                  <div className="bg-slate-50 p-3 rounded">
                    <p className="text-sm font-semibold text-slate-800 mb-2">TAC/MAIC Details</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {client.tac_maic_claim_number && <div><span className="font-semibold">Claim Number:</span> {client.tac_maic_claim_number}</div>}
                      {client.tac_maic_injury_description && <div className="col-span-2"><span className="font-semibold">Injury Description:</span> {client.tac_maic_injury_description}</div>}
                      {client.tac_maic_functional_limitations && <div className="col-span-2"><span className="font-semibold">Functional Limitations:</span> {client.tac_maic_functional_limitations}</div>}
                    </div>
                  </div>
                )}

                {/* Aged Care Specific */}
                {client.funding_source === "aged_care" && (
                  <div className="bg-slate-50 p-3 rounded">
                    <p className="text-sm font-semibold text-slate-800 mb-2">Aged Care Details</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {client.aged_care_package_level && <div><span className="font-semibold">Package Level:</span> Level {client.aged_care_package_level}</div>}
                      {client.aged_care_coordinator_name && <div><span className="font-semibold">Coordinator:</span> {client.aged_care_coordinator_name}</div>}
                      {client.aged_care_functional_issues && <div className="col-span-2"><span className="font-semibold">Functional Issues:</span> {client.aged_care_functional_issues}</div>}
                      {client.aged_care_home_safety && <div className="col-span-2"><span className="font-semibold">Home Safety:</span> {client.aged_care_home_safety}</div>}
                    </div>
                  </div>
                )}

                {/* My Aged Care Specific */}
                {client.funding_source === "my_aged_care" && (
                  <div className="bg-slate-50 p-3 rounded">
                    <p className="text-sm font-semibold text-slate-800 mb-2">My Aged Care Details</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {client.my_aged_care_package_level && <div><span className="font-semibold">Package Level:</span> Level {client.my_aged_care_package_level}</div>}
                      {client.my_aged_care_provider_name && <div><span className="font-semibold">Provider:</span> {client.my_aged_care_provider_name}</div>}
                      {client.my_aged_care_case_manager && <div><span className="font-semibold">Case Manager:</span> {client.my_aged_care_case_manager}</div>}
                      {client.my_aged_care_case_manager_phone && <div><span className="font-semibold">Manager Phone:</span> {client.my_aged_care_case_manager_phone}</div>}
                      {client.my_aged_care_case_manager_email && <div><span className="font-semibold">Manager Email:</span> {client.my_aged_care_case_manager_email}</div>}
                      {client.my_aged_care_functional_goals && <div className="col-span-2"><span className="font-semibold">Functional Goals:</span> {client.my_aged_care_functional_goals}</div>}
                      {client.my_aged_care_service_types && <div className="col-span-2"><span className="font-semibold">Service Types:</span> {client.my_aged_care_service_types}</div>}
                    </div>
                  </div>
                )}

                {/* Other Funding Source */}
                {client.funding_source === "other" && client.other_funding_source && (
                  <div className="bg-slate-50 p-3 rounded">
                    <p className="text-sm font-semibold text-slate-800 mb-2">Other Funding Details</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="col-span-2"><span className="font-semibold">Source:</span> {client.other_funding_source}</div>
                      {client.other_funding_contact_name && <div><span className="font-semibold">Contact:</span> {client.other_funding_contact_name}</div>}
                      {client.other_funding_contact_phone && <div><span className="font-semibold">Phone:</span> {client.other_funding_contact_phone}</div>}
                      {client.other_funding_contact_email && <div><span className="font-semibold">Email:</span> {client.other_funding_contact_email}</div>}
                      {client.other_funding_contact_address && <div className="col-span-2"><span className="font-semibold">Address:</span> {client.other_funding_contact_address}</div>}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Medical History / Conditions */}
          {medicalConditions.length > 0 && (
            <section className="medical-history-section mb-4">
              <h2 className="text-base font-bold text-slate-900 mb-2 border-b border-slate-300 pb-1">
                Medical History
              </h2>
              <div className="space-y-2 medical-history-list">
                {medicalConditions.map((condition, index) => (
                  <div key={index} className="medical-history-item condition-block bg-slate-50 p-2 rounded text-sm">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Condition:</p>
                        <p className="text-slate-900">{condition.condition_name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Type:</p>
                        <p className="text-slate-900 capitalize">{condition.condition_type}</p>
                      </div>
                      {condition.diagnosis_date && (
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Diagnosed:</p>
                          <p className="text-slate-900">{safeFormatDate(condition.diagnosis_date)}</p>
                        </div>
                      )}
                      {condition.medication && (
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Medication:</p>
                          <p className="text-slate-900">{condition.medication}</p>
                        </div>
                      )}
                      {condition.pain_level !== null && condition.pain_level !== undefined && (
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Pain Level:</p>
                          <p className="text-slate-900">{condition.pain_level}/10</p>
                        </div>
                      )}
                      {condition.notes && (
                        <div className="col-span-2">
                          <p className="text-sm font-semibold text-slate-700">Notes:</p>
                          <p className="text-slate-900 text-sm">{condition.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* APSS Stage 1 - EXPANDED */}
          {client.apss_completed && (
            <section className="apss-section apss-stage-1-block mb-4">
              <h2 className="text-base font-bold text-slate-900 mb-2 border-b border-slate-300 pb-1">
                Safety Screen - Pre-Exercise Screening
              </h2>
              <div className="space-y-2">
                <p className="text-xs text-slate-600">
                  Completed: {client.apss_completion_date ? safeFormatDate(client.apss_completion_date) : "Yes"}
                </p>
                
                <div className="bg-slate-50 p-2 rounded space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">Health History Questions</h3>
                  
                  <div className="space-y-1">
                    <div className="apss-question-row flex justify-between items-start">
                      <p className="text-xs font-medium text-slate-700 flex-1">
                        Q1. Has your doctor ever told you that you have a heart condition or have you ever suffered a stroke?
                      </p>
                      <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                        client.apss_q1_heart_stroke === true ? 'bg-red-100 text-red-800' : 
                        client.apss_q1_heart_stroke === false ? 'bg-green-100 text-green-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {formatYesNo(client.apss_q1_heart_stroke)}
                      </span>
                    </div>

                    <div className="apss-question-row flex justify-between items-start">
                      <p className="text-sm font-medium text-slate-700 flex-1">
                        Q2. Do you ever experience unexplained pains or discomfort in your chest at rest or during physical activity/exercise?
                      </p>
                      <span className={`ml-4 px-3 py-1 rounded text-sm font-semibold ${
                        client.apss_q2_chest_pain === true ? 'bg-red-100 text-red-800' : 
                        client.apss_q2_chest_pain === false ? 'bg-green-100 text-green-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {formatYesNo(client.apss_q2_chest_pain)}
                      </span>
                    </div>

                    <div className="apss-question-row flex justify-between items-start">
                      <p className="text-sm font-medium text-slate-700 flex-1">
                        Q3. Do you ever feel faint, lose balance or have spells of dizziness during physical activity/exercise that causes you to lose balance?
                      </p>
                      <span className={`ml-4 px-3 py-1 rounded text-sm font-semibold ${
                        client.apss_q3_faint_dizzy === true ? 'bg-red-100 text-red-800' : 
                        client.apss_q3_faint_dizzy === false ? 'bg-green-100 text-green-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {formatYesNo(client.apss_q3_faint_dizzy)}
                      </span>
                    </div>

                    <div className="apss-question-row flex justify-between items-start">
                      <p className="text-sm font-medium text-slate-700 flex-1">
                        Q4. Have you had an asthma attack requiring immediate medical attention at any time over the last 12 months?
                      </p>
                      <span className={`ml-4 px-3 py-1 rounded text-sm font-semibold ${
                        client.apss_q4_asthma === true ? 'bg-red-100 text-red-800' : 
                        client.apss_q4_asthma === false ? 'bg-green-100 text-green-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {formatYesNo(client.apss_q4_asthma)}
                      </span>
                    </div>

                    <div className="apss-question-row flex justify-between items-start">
                      <p className="text-sm font-medium text-slate-700 flex-1">
                        Q5. If you have diabetes, have you had trouble controlling your blood glucose in the last 3 months?
                      </p>
                      <span className={`ml-4 px-3 py-1 rounded text-sm font-semibold ${
                        client.apss_q5_diabetes_control === true ? 'bg-red-100 text-red-800' : 
                        client.apss_q5_diabetes_control === false ? 'bg-green-100 text-green-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {formatYesNo(client.apss_q5_diabetes_control)}
                      </span>
                    </div>

                    <div className="apss-question-row flex justify-between items-start">
                      <p className="text-sm font-medium text-slate-700 flex-1">
                        Q6. Do you have any other conditions that may require special consideration for you to exercise?
                      </p>
                      <span className={`ml-4 px-3 py-1 rounded text-sm font-semibold ${
                        client.apss_q6_other_conditions === true ? 'bg-yellow-100 text-yellow-800' : 
                        client.apss_q6_other_conditions === false ? 'bg-green-100 text-green-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {formatYesNo(client.apss_q6_other_conditions)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-2 rounded space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">Q7. Physical Activity Assessment</h3>
                  <p className="text-xs text-slate-600">
                    In a typical week, on how many days and for how long do you do each of the following types of physical activity?
                  </p>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {/* Light Activity */}
                    <div className="bg-white p-2 rounded border border-blue-200">
                      <p className="text-xs font-semibold text-slate-700 mb-1">Light Activity</p>
                      <p className="text-xs text-slate-600 mb-1">(e.g., casual walking)</p>
                      <div className="space-y-1">
                        <p className="text-sm">
                          <span className="font-medium">Frequency:</span> {client.apss_q7_activity_light_freq || 0} days/week
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Duration:</span> {client.apss_q7_activity_light_duration || 0} min/day
                        </p>
                        <p className="text-xs text-blue-600 font-semibold mt-2">
                          Weighted: {((client.apss_q7_activity_light_freq || 0) * (client.apss_q7_activity_light_duration || 0) * 1).toFixed(0)} min/week
                        </p>
                      </div>
                    </div>

                    {/* Moderate Activity */}
                    <div className="bg-white p-3 rounded border border-blue-200">
                      <p className="text-xs font-semibold text-slate-700 mb-2">Moderate Activity</p>
                      <p className="text-xs text-slate-600 mb-2">(e.g., brisk walking, recreational swimming)</p>
                      <div className="space-y-1">
                        <p className="text-sm">
                          <span className="font-medium">Frequency:</span> {client.apss_q7_activity_moderate_freq || 0} days/week
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Duration:</span> {client.apss_q7_activity_moderate_duration || 0} min/day
                        </p>
                        <p className="text-xs text-blue-600 font-semibold mt-2">
                          Weighted: {((client.apss_q7_activity_moderate_freq || 0) * (client.apss_q7_activity_moderate_duration || 0) * 2).toFixed(0)} min/week
                        </p>
                      </div>
                    </div>

                    {/* Vigorous Activity */}
                    <div className="bg-white p-3 rounded border border-blue-200">
                      <p className="text-xs font-semibold text-slate-700 mb-2">Vigorous Activity</p>
                      <p className="text-xs text-slate-600 mb-2">(e.g., jogging, competitive sports)</p>
                      <div className="space-y-1">
                        <p className="text-sm">
                          <span className="font-medium">Frequency:</span> {client.apss_q7_activity_vigorous_freq || 0} days/week
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Duration:</span> {client.apss_q7_activity_vigorous_duration || 0} min/day
                        </p>
                        <p className="text-xs text-blue-600 font-semibold mt-2">
                          Weighted: {((client.apss_q7_activity_vigorous_freq || 0) * (client.apss_q7_activity_vigorous_duration || 0) * 4).toFixed(0)} min/week
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-100 p-3 rounded mt-3">
                    <p className="text-sm font-semibold text-slate-900">
                      Total Weighted Physical Activity: <span className="text-blue-700 text-lg">{client.apss_q7_total_minutes || 0}</span> minutes per week
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      {(client.apss_q7_total_minutes || 0) >= 150 ? 
                        "✓ Meets minimum physical activity guidelines (≥150 weighted minutes/week)" :
                        "⚠ Below minimum physical activity guidelines (<150 weighted minutes/week)"
                      }
                    </p>
                  </div>
                </div>

                {client.apss_additional_info && (
                  <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Additional Information:</p>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap">{client.apss_additional_info}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* APSS Stage 2 - EXPANDED */}
          {client.apss_stage2_completed && (
            <section className="apss-section apss-stage-2-block mb-4">
              <h2 className="text-base font-bold text-slate-900 mb-2 border-b border-slate-300 pb-1">
                Clinical Risk Review - Risk Factor Assessment
              </h2>
              <div className="space-y-2">
                <p className="text-xs text-slate-600">
                  Completed: {client.apss_stage2_completion_date ? safeFormatDate(client.apss_stage2_completion_date) : "Yes"}
                </p>

                {/* Anthropometric Measurements */}
                {(client.apss_s2_weight_kg || client.apss_s2_height_cm || client.apss_s2_bmi || client.apss_s2_waist_circumference || client.apss_s2_hip_circumference || client.apss_s2_whr) && (
                  <div className="bg-slate-50 p-4 rounded space-y-3">
                    <h3 className="font-semibold text-slate-900">Q11. Body Composition</h3>
                    <p className="text-xs text-slate-600">Any of the below increases the risk of chronic diseases.</p>
                    <div className="grid grid-cols-3 gap-4">
                      {client.apss_s2_weight_kg && (
                        <div>
                          <p className="text-xs text-slate-600">Weight</p>
                          <p className="text-lg font-semibold text-slate-900">{client.apss_s2_weight_kg} kg</p>
                        </div>
                      )}
                      {client.apss_s2_height_cm && (
                        <div>
                          <p className="text-xs text-slate-600">Height</p>
                          <p className="text-lg font-semibold text-slate-900">{client.apss_s2_height_cm} cm</p>
                        </div>
                      )}
                      {client.apss_s2_bmi && (
                        <div>
                          <p className="text-xs text-slate-600">BMI</p>
                          <p className={`text-lg font-semibold ${
                            client.apss_s2_bmi < 18.5 ? 'text-blue-600' :
                            client.apss_s2_bmi < 25 ? 'text-green-600' :
                            client.apss_s2_bmi < 30 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {client.apss_s2_bmi} kg/m²
                          </p>
                          <p className="text-xs text-slate-500">
                            {client.apss_s2_bmi < 18.5 ? 'Underweight' :
                             client.apss_s2_bmi < 25 ? 'Normal' :
                             client.apss_s2_bmi < 30 ? 'Overweight' :
                             'Obese'}
                          </p>
                        </div>
                      )}
                      {client.apss_s2_waist_circumference && (
                        <div>
                          <p className="text-xs text-slate-600">Waist Circumference</p>
                          <p className="text-lg font-semibold text-slate-900">{client.apss_s2_waist_circumference} cm</p>
                        </div>
                      )}
                      {client.apss_s2_hip_circumference && (
                        <div>
                          <p className="text-xs text-slate-600">Hip Circumference</p>
                          <p className="text-lg font-semibold text-slate-900">{client.apss_s2_hip_circumference} cm</p>
                        </div>
                      )}
                      {client.apss_s2_whr && (
                        <div>
                          <p className="text-xs text-slate-600">Waist-to-Hip Ratio</p>
                          <p className="text-lg font-semibold text-slate-900">{client.apss_s2_whr}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Family History */}
                {client.apss_s2_family_history !== null && client.apss_s2_family_history !== undefined && (
                  <div className="bg-white p-4 rounded border border-slate-200">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-semibold text-slate-700">
                        Q9. Family history of heart disease - A family history of heart disease refers to an event that occurs in relatives including parents, grandparents, uncles and/or aunts before the age of 55 years.
                      </p>
                      <span className={`ml-4 px-3 py-1 rounded text-sm font-semibold ${
                        client.apss_s2_family_history === true ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {formatYesNo(client.apss_s2_family_history)}
                      </span>
                    </div>
                    {client.apss_s2_family_history_records && client.apss_s2_family_history_records.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-semibold text-slate-600">Details:</p>
                        {client.apss_s2_family_history_records.map((record, idx) => (
                          <p key={idx} className="text-sm text-slate-600">
                            • {record.relationship} - at age {record.age_at_event}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Smoking */}
                {client.apss_s2_smoking !== null && client.apss_s2_smoking !== undefined && (
                  <div className="bg-white p-4 rounded border border-slate-200">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-semibold text-slate-700">
                        Q10. Do you smoke cigarettes on a daily or weekly basis or have you quit smoking in the last 6 months?
                      </p>
                      <span className={`ml-4 px-3 py-1 rounded text-sm font-semibold ${
                        client.apss_s2_smoking === true ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {formatYesNo(client.apss_s2_smoking)}
                      </span>
                    </div>
                    {client.apss_s2_smoking && (
                      <div className="mt-2 space-y-1">
                        {client.apss_s2_smoking_details && (
                          <p className="text-sm text-slate-700">
                            <span className="font-semibold">Frequency:</span> {client.apss_s2_smoking_details}
                          </p>
                        )}
                        {client.apss_s2_smoking_years && (
                          <p className="text-sm text-slate-700">
                            <span className="font-semibold">Years smoking:</span> {client.apss_s2_smoking_years} years
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Vaping */}
                {client.apss_s2_vaping !== null && client.apss_s2_vaping !== undefined && (
                  <div className="bg-white p-4 rounded border border-slate-200">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-semibold text-slate-700">
                        Are you vaping?
                      </p>
                      <span className={`ml-4 px-3 py-1 rounded text-sm font-semibold ${
                        client.apss_s2_vaping === true ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {formatYesNo(client.apss_s2_vaping)}
                      </span>
                    </div>
                    {client.apss_s2_vaping && (
                      <div className="mt-2 space-y-1">
                        {client.apss_s2_vaping_details && (
                          <p className="text-sm text-slate-700">
                            <span className="font-semibold">Frequency:</span> {client.apss_s2_vaping_details}
                          </p>
                        )}
                        {client.apss_s2_vaping_years && (
                          <p className="text-sm text-slate-700">
                            <span className="font-semibold">Years vaping:</span> {client.apss_s2_vaping_years} years
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Blood Pressure */}
                {(client.apss_s2_high_blood_pressure !== null || client.apss_s2_systolic_bp || client.apss_s2_diastolic_bp || client.apss_s2_bp_medication !== null) && (
                  <div className="bg-white p-4 rounded border border-slate-200 space-y-2">
                    <h4 className="font-semibold text-slate-900">Q12. Have you been told that you have high blood pressure?</h4>
                    <p className="text-xs text-slate-600 mb-2">Either of the below increases the risk of heart disease: Systolic BP ≥ 140 mmHg, Diastolic BP ≥ 90 mmHg</p>
                    {client.apss_s2_high_blood_pressure !== null && (
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-slate-700">Response:</p>
                        <span className={`px-3 py-1 rounded text-sm font-semibold ${
                          client.apss_s2_high_blood_pressure === true ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {formatYesNo(client.apss_s2_high_blood_pressure)}
                        </span>
                      </div>
                    )}
                    {(client.apss_s2_systolic_bp || client.apss_s2_diastolic_bp || client.apss_s2_heart_rate || client.apss_s2_spo2) && (
                     <div className="space-y-1">
                       {(client.apss_s2_systolic_bp || client.apss_s2_diastolic_bp) && (
                         <p className="text-sm">
                           <span className="font-medium">Measured BP:</span> {client.apss_s2_systolic_bp || '—'}/{client.apss_s2_diastolic_bp || '—'} mmHg
                         </p>
                       )}
                       {client.apss_s2_heart_rate && (
                         <p className="text-sm">
                           <span className="font-medium">Heart Rate:</span> {client.apss_s2_heart_rate} bpm
                         </p>
                       )}
                       {client.apss_s2_spo2 && (
                         <p className="text-sm">
                           <span className="font-medium">SpO2:</span> {client.apss_s2_spo2}%
                         </p>
                       )}
                     </div>
                    )}
                    {client.apss_s2_bp_medication !== null && (
                      <p className="text-sm">
                        <span className="font-medium">Taking medication for BP:</span> {formatYesNo(client.apss_s2_bp_medication)}
                      </p>
                    )}
                    {client.apss_s2_bp_medication_details && (
                      <>
                        <p className="text-xs font-semibold text-slate-600">Medication Details:</p>
                        <p className="text-sm text-slate-600">{client.apss_s2_bp_medication_details}</p>
                      </>
                    )}
                  </div>
                )}

                {/* Cholesterol */}
                {(client.apss_s2_high_cholesterol !== null || client.apss_s2_total_cholesterol || client.apss_s2_hdl || client.apss_s2_ldl || client.apss_s2_triglycerides || client.apss_s2_cholesterol_medication !== null) && (
                  <div className="bg-white p-4 rounded border border-slate-200 space-y-2">
                    <h4 className="font-semibold text-slate-900">Q13. Have you been told that you have high cholesterol/blood lipids?</h4>
                    <p className="text-xs text-slate-600 mb-2">Any of the below increases risk: Total cholesterol ≥ 5.2 mmol/L, HDL &lt; 1.0 mmol/L, LDL ≥ 3.4 mmol/L, Triglycerides ≥ 1.7 mmol/L</p>
                    {client.apss_s2_high_cholesterol !== null && (
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-slate-700">Response:</p>
                        <span className={`px-3 py-1 rounded text-sm font-semibold ${
                          client.apss_s2_high_cholesterol === true ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {formatYesNo(client.apss_s2_high_cholesterol)}
                        </span>
                      </div>
                    )}
                    {(client.apss_s2_total_cholesterol || client.apss_s2_hdl || client.apss_s2_ldl || client.apss_s2_triglycerides) && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {client.apss_s2_total_cholesterol && (
                          <p><span className="font-medium">Total Cholesterol:</span> {client.apss_s2_total_cholesterol} mmol/L</p>
                        )}
                        {client.apss_s2_hdl && (
                          <p><span className="font-medium">HDL:</span> {client.apss_s2_hdl} mmol/L</p>
                        )}
                        {client.apss_s2_ldl && (
                          <p><span className="font-medium">LDL:</span> {client.apss_s2_ldl} mmol/L</p>
                        )}
                        {client.apss_s2_triglycerides && (
                          <p><span className="font-medium">Triglycerides:</span> {client.apss_s2_triglycerides} mmol/L</p>
                        )}
                      </div>
                    )}
                    {client.apss_s2_cholesterol_medication !== null && (
                      <p className="text-sm">
                        <span className="font-medium">Taking medication for cholesterol:</span> {formatYesNo(client.apss_s2_cholesterol_medication)}
                      </p>
                    )}
                    {client.apss_s2_cholesterol_medication_details && (
                      <>
                        <p className="text-xs font-semibold text-slate-600">Medication Details:</p>
                        <p className="text-sm text-slate-600">{client.apss_s2_cholesterol_medication_details}</p>
                      </>
                    )}
                  </div>
                )}

                {/* Blood Glucose */}
                {(client.apss_s2_high_blood_sugar !== null || client.apss_s2_fasting_glucose || client.apss_s2_glucose_medication !== null) && (
                  <div className="bg-white p-4 rounded border border-slate-200 space-y-2">
                    <h4 className="font-semibold text-slate-900">Q14. Have you been told that you have high blood sugar (glucose)?</h4>
                    <p className="text-xs text-slate-600 mb-2">Fasting blood sugar (glucose) ≥ 5.5 mmol/L increases the risk of diabetes.</p>
                    {client.apss_s2_high_blood_sugar !== null && (
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-slate-700">Response:</p>
                        <span className={`px-3 py-1 rounded text-sm font-semibold ${
                          client.apss_s2_high_blood_sugar === true ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {formatYesNo(client.apss_s2_high_blood_sugar)}
                        </span>
                      </div>
                    )}
                    {client.apss_s2_fasting_glucose && (
                      <p className="text-sm">
                        <span className="font-medium">Fasting Blood Glucose:</span> {client.apss_s2_fasting_glucose} mmol/L
                      </p>
                    )}
                    {client.apss_s2_glucose_medication !== null && (
                      <p className="text-sm">
                        <span className="font-medium">Taking medication for blood sugar:</span> {formatYesNo(client.apss_s2_glucose_medication)}
                      </p>
                    )}
                    {client.apss_s2_glucose_medication_details && (
                      <>
                        <p className="text-xs font-semibold text-slate-600">Medication Details:</p>
                        <p className="text-sm text-slate-600">{client.apss_s2_glucose_medication_details}</p>
                      </>
                    )}
                  </div>
                )}

                {/* Medications */}
                {client.apss_s2_prescribed_medications !== null && (
                  <div className="bg-white p-4 rounded border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold text-slate-700">Q15. Are you currently taking prescribed medication(s) for any condition(s)? These are additional to any already prescribed for diabetes.</p>
                      <span className={`px-3 py-1 rounded text-sm font-semibold ${
                        client.apss_s2_prescribed_medications === true ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {formatYesNo(client.apss_s2_prescribed_medications)}
                      </span>
                    </div>
                    {client.apss_s2_medications_list && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-slate-600 mb-1">List of Medications:</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{client.apss_s2_medications_list}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Hospital Admissions */}
                {client.apss_s2_hospital_admissions !== null && (
                  <div className="bg-white p-4 rounded border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold text-slate-700">Q16. Have you spent time in hospital (including day admission) for any condition/illness/injury during the last 12 months?</p>
                      <span className={`px-3 py-1 rounded text-sm font-semibold ${
                        client.apss_s2_hospital_admissions === true ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {formatYesNo(client.apss_s2_hospital_admissions)}
                      </span>
                    </div>
                    {client.apss_s2_hospital_admissions_details && (
                      <>
                        <p className="text-xs font-semibold text-slate-600 mt-1">Details:</p>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{client.apss_s2_hospital_admissions_details}</p>
                      </>
                    )}
                  </div>
                )}

                {/* Pregnancy */}
                {client.apss_s2_pregnancy !== null && (
                  <div className="bg-white p-4 rounded border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold text-slate-700">Q17. Are you pregnant or have you given birth within the last 12 months?</p>
                      <span className={`px-3 py-1 rounded text-sm font-semibold ${
                        client.apss_s2_pregnancy === true ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {formatYesNo(client.apss_s2_pregnancy)}
                      </span>
                    </div>
                    {client.apss_s2_pregnancy_details && (
                      <>
                        <p className="text-xs font-semibold text-slate-600 mt-1">Details:</p>
                        <p className="text-sm text-slate-600">{client.apss_s2_pregnancy_details}</p>
                      </>
                    )}
                  </div>
                )}

                {/* Musculoskeletal Issues */}
                {client.apss_s2_musculoskeletal_issues !== null && (
                  <div className="bg-white p-4 rounded border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold text-slate-700">Q18. Do you have any diagnosed muscle, bone, tendon, ligament or joint problems that you have been told could be made worse by participating in exercise?</p>
                      <span className={`px-3 py-1 rounded text-sm font-semibold ${
                        client.apss_s2_musculoskeletal_issues === true ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {formatYesNo(client.apss_s2_musculoskeletal_issues)}
                      </span>
                    </div>
                    {client.apss_s2_musculoskeletal_details && (
                      <>
                        <p className="text-xs font-semibold text-slate-600 mt-1">Details:</p>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{client.apss_s2_musculoskeletal_details}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Client Goals */}
          {client.client_goals && (
            <section className="mb-4">
              <h2 className="text-base font-bold text-slate-900 mb-2 border-b border-slate-300 pb-1">
                Client Goals
              </h2>
              <p className="text-sm text-slate-900 whitespace-pre-wrap">{client.client_goals}</p>
            </section>
          )}

          {/* Consent & Signature - only show if consent was given */}
          {(client.consent_confirmed || client.privacy_consent || client.assessment_consent || client.pricing_explained || client.digital_signature) && (
            <section className="signature-block consent-signature">
            <h2 className="text-base font-bold text-slate-900 mb-2 border-b border-slate-300 pb-1">
              Consent & Signature
            </h2>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {client.consent_confirmed !== undefined && client.consent_confirmed !== null && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Primary Consent:</p>
                  <p className="text-slate-900">{formatYesNo(client.consent_confirmed)}</p>
                </div>
                )}
                {client.privacy_consent !== undefined && client.privacy_consent !== null && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Privacy Consent:</p>
                  <p className="text-slate-900">{formatYesNo(client.privacy_consent)}</p>
                </div>
                )}
                {client.assessment_consent !== undefined && client.assessment_consent !== null && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Assessment Consent:</p>
                  <p className="text-slate-900">{formatYesNo(client.assessment_consent)}</p>
                </div>
                )}
                {client.pricing_explained !== undefined && client.pricing_explained !== null && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Pricing Explained:</p>
                  <p className="text-slate-900">{formatYesNo(client.pricing_explained)}</p>
                </div>
                )}
              </div>

              {client.consent_date && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Consent Date:</p>
                  <p className="text-slate-900">
                    {safeFormatDate(client.consent_date, 'dd MMMM yyyy')}
                  </p>
                </div>
              )}

              {client.digital_signature && (
                <div className="mt-3 border border-slate-300 rounded p-2">
                  <p className="text-xs font-semibold text-slate-700 mb-1">Digital Signature:</p>
                  <div className="bg-white border border-slate-300 rounded p-1">
                    <img 
                      src={client.digital_signature} 
                      alt="Client Signature" 
                      className="max-w-xs mx-auto max-h-20"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1 text-center">
                    Signed by {client.full_name} on {safeFormatDate(client.consent_date, 'dd MMMM yyyy')}
                  </p>
                </div>
              )}
            </div>
            </section>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-slate-500 mt-4 pt-2 border-t border-slate-300">
            <p>This is a confidential medical document. Please handle accordingly.</p>
            <p className="mt-0.5">Generated on {safeFormatDate(new Date(), 'dd MMMM yyyy \'at\' HH:mm')}</p>
          </div>
        </div>


      </div>


    </div>
  );
});

PrintableOnboardingReport.displayName = "PrintableOnboardingReport";

export default PrintableOnboardingReport;
