
import React, { useState, useRef, useEffect, useMemo } from "react";
import { todayLocal } from "@/lib/localDate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { User } from "@/entities/all";
import { ClientReport } from "@/entities/ClientReport";
import { Printer, Loader2, ChevronLeft, ChevronRight, X, Save, Edit } from "lucide-react";
import { Toaster, toast } from "sonner";
import { format } from 'date-fns';
import { SecureFileImage } from "@/components/files/SecureFile";
import { Badge } from "@/components/ui/badge"; // Added Badge import for UI
import { renderSafeHtmlDocument, replaceWithSafeHtml } from "@/lib/safeHtml";

const PrintableReport = React.forwardRef(({ letterData, client, clinician }, ref) => {
  const getClientGenderPronoun = () => {
    if (client.gender === 'male') return 'his';
    if (client.gender === 'female') return 'her';
    return 'their';
  };

  return (
    <div ref={ref} className="printable-report">
      <style>{`
        @media print {
          @page { size: A4; margin: 2.5cm; }
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .printable-report { 
            width: 100%; 
            font-family: 'Times New Roman', Times, serif; 
            font-size: 11pt; 
            line-height: 1.6; 
            color: #000 !important; 
            background: white; 
          }
          .clinic-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            margin-bottom: 2em; 
            padding-bottom: 1em; 
            border-bottom: 2px solid #000; 
          }
          .clinic-header img { 
            max-width: 150px; 
            max-height: 75px; 
          }
          .clinic-details { 
            text-align: right; 
            font-size: 10pt; 
            color: #000 !important;
          }
          .letter-header { 
            margin-bottom: 2em;
          }
          .gp-address {
            margin-bottom: 2em;
            color: #000 !important;
          }
          .letter-date {
            margin-bottom: 2em;
            color: #000 !important;
          }
          .letter-salutation {
            margin-bottom: 1em;
            color: #000 !important;
          }
          .letter-subject {
            font-weight: bold;
            margin-bottom: 1.5em;
            color: #000 !important;
          }
          .letter-body p {
            margin: 1em 0;
            color: #000 !important;
          }
          .letter-closing {
            margin-top: 2em;
            color: #000 !important;
          }
          .clinician-signature {
            margin-top: 2em;
            color: #000 !important;
          }
        }
      `}</style>

      <div className="clinic-header">
        {clinician?.clinic_logo_url ? (
          <SecureFileImage src={clinician.clinic_logo_url} orgId={client.org_id} alt="Clinic Logo" />
        ) : (
          <h2 style={{ margin: 0, color: '#000' }}>{clinician?.clinic_name || ""}</h2>
        )}
        <div className="clinic-details">
          <strong>{clinician?.clinic_name || ""}</strong><br />
          {clinician?.clinic_address || ""}<br />
          Phone: {clinician?.clinic_phone || ""} | Email: {clinician?.clinic_email || ""}
        </div>
      </div>

      <div className="letter-header">
        <div className="gp-address">
          {letterData.gp_name}<br />
          {letterData.gp_clinic_name}<br />
          {letterData.gp_address}
        </div>

        <div className="letter-date">
          {format(new Date(letterData.letter_date), 'dd-MMM-yyyy')}
        </div>

        <div className="letter-salutation">
          Dear {letterData.gp_name},
        </div>

        <div className="letter-subject">
          RE: Referral Acceptance for {client.full_name} (DOB: {client.date_of_birth ? format(new Date(client.date_of_birth), 'dd/MM/yyyy') : 'Not specified'})
        </div>
      </div>

      <div className="letter-body">
        <p>
          Referral Type: {letterData.referral_type}<br />
          Referral Date: {format(new Date(letterData.referral_date), 'dd/MM/yyyy')}
        </p>

        <p>
          Thank you for your referral of {client.full_name}. I will advise as I progress with {getClientGenderPronoun()} treatment.
        </p>

        <p>
          {client.full_name} is booked in <strong>{letterData.next_appointment_text}</strong>. You will receive an Initial Assessment report within 24 hours of {getClientGenderPronoun()} first EP session.
        </p>

        {letterData.session_details && (
          <p>{letterData.session_details}</p>
        )}

        <p>
          Feel free to contact me on {clinician?.clinic_phone || '[phone]'} or {clinician?.clinic_email || '[email]'} if you have any questions
        </p>

        <div className="letter-closing">
          Healthy regards,
        </div>

        <div className="clinician-signature">
          <strong>{clinician?.clinician_name || clinician?.full_name}</strong><br />
          Accredited Exercise Physiologist (AEP), ESSAM<br />
          Provider Number: {clinician?.provider_number || '[Provider Number]'}
        </div>
      </div>
    </div>
  );
});

export default function MedicareReferralAcceptance({ client, onClose, editingReport }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [clinician, setClinician] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locations, setLocations] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  const [letterData, setLetterData] = useState(() => {
    if (editingReport && editingReport.report_data) {
      return editingReport.report_data;
    }
    return {
      gp_name: client.primary_gp_name || "",
      gp_clinic_name: client.primary_gp_clinic_name || "",
      gp_address: client.primary_gp_address || "",
      letter_date: todayLocal(),
      referral_type: client.medicare_referral_type || "Referral outside Medicare allocation",
      referral_date: client.referral_date || todayLocal(),
      next_appointment_text: "",
      session_details: ""
    };
  });

  const printRef = useRef(null);

  const stepTitles = [
    "Select Location",
    "GP & Referral Details",
    "Appointment Details",
    "Review Report"
  ];

  useEffect(() => {
    loadInitialData();
    if (editingReport && editingReport.report_data) {
      setCurrentStep(3); // Go directly to review step (new index 3)
    }
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const currentClinician = await User.me();
      setClinician(currentClinician);
      
      const locs = currentClinician.locations || [];
      setLocations(locs);
      
      const mainLoc = locs.find(l => l.is_main) || locs[0];
      if (mainLoc) {
        setSelectedLocation(mainLoc);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load clinician data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 0) { // New step: Select Location
      if (!selectedLocation) {
        toast.error("Please select a location");
        return;
      }
    }
    if (currentStep === 1) { // Old step 0: GP & Referral Details
      if (!letterData.gp_name || !letterData.gp_clinic_name || !letterData.referral_date || !letterData.gp_address) {
        toast.error("Please fill in all required GP and referral details");
        return;
      }
    }
    if (currentStep === 2) { // Old step 1: Appointment Details
      if (!letterData.next_appointment_text) {
        toast.error("Please provide next appointment details");
        return;
      }
    }
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setIsEditing(false); // Exit edit mode when going back
    }
  };

  const handleChange = (field, value) => {
    setLetterData(prev => ({ ...prev, [field]: value }));
  };

  const displayLetterData = useMemo(() => letterData, [letterData]);

  const handlePrint = () => {
    if (!printRef.current) {
      toast.error("Report content is not ready for printing.");
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      toast.warning("Popup blocked. Using current window print...");
      // For fallback print, we need to temporarily replace body content
      const originalBodyContent = document.body.innerHTML;
      replaceWithSafeHtml(document.body, printRef.current.outerHTML);
      window.print();
      replaceWithSafeHtml(document.body, originalBodyContent); // Restore original content
      window.location.reload(); // Reload to ensure scripts and event listeners are re-attached
      return;
    }

    try {
      renderSafeHtmlDocument(printWindow, `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Referral Acceptance Letter - ${client.full_name}</title>
          <meta charset="utf-8">
          <style>
            @media print {
              @page { size: A4; margin: 2.5cm; }
              body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .printable-report { 
                width: 100%; 
                font-family: 'Times New Roman', Times, serif; 
                font-size: 11pt; 
                line-height: 1.6; 
                color: #000 !important; 
                background: white; 
              }
              .clinic-header { 
                display: flex; 
                justify-content: space-between; 
                align-items: flex-start; 
                margin-bottom: 2em; 
                padding-bottom: 1em; 
                border-bottom: 2px solid #000; 
              }
              .clinic-header img { 
                max-width: 150px; 
                max-height: 75px; 
              }
              .clinic-details { 
                text-align: right; 
                font-size: 10pt; 
                color: #000 !important;
              }
              .letter-header { 
                margin-bottom: 2em;
              }
              .gp-address {
                margin-bottom: 2em;
                color: #000 !important;
              }
              .letter-date {
                margin-bottom: 2em;
                color: #000 !important;
              }
              .letter-salutation {
                margin-bottom: 1em;
                color: #000 !important;
              }
              .letter-subject {
                font-weight: bold;
                margin-bottom: 1.5em;
                color: #000 !important;
              }
              .letter-body p {
                margin: 1em 0;
                color: #000 !important;
              }
              .letter-closing {
                margin-top: 2em;
                color: #000 !important;
              }
              .clinician-signature {
                margin-top: 2em;
                color: #000 !important;
              }
            }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
        </html>
      `);
      
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);
      
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Failed to open print dialog. Please try again.");
      if (printWindow) printWindow.close();
    }
  };

  const handleSaveReport = async () => {
    setIsSaving(true);
    const dataToSave = letterData;

    try {
      // Ensure printRef.current has the latest data for HTML content
      // The hidden PrintableReport should already be rendered with `displayLetterData` which includes `dataToSave` if `isEditing`
      const htmlContent = printRef.current?.outerHTML || ""; 
      
      if (editingReport) {
        await ClientReport.update(editingReport.id, {
          report_data: dataToSave,
          html_content: htmlContent,
          location_id: selectedLocation?.id || null, // Save selected location ID
        });
        toast.success("Report updated successfully!");
      } else {
        await ClientReport.create({
          client_id: client.id,
          report_type: "medicare_referral_acceptance",
          report_name: `Medicare Referral Acceptance - ${format(new Date(), 'dd/MM/yyyy')}`,
          report_date: todayLocal(),
          report_data: dataToSave,
          html_content: htmlContent,
          location_id: selectedLocation?.id || null, // Save selected location ID
        });
        toast.success("Report saved to client file successfully!");
      }
      onClose(); // Close the modal after successful save/update
    } catch (error) {
      console.error("Error saving report:", error);
      toast.error("Failed to save report.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      {/* Hidden component for printing - only rendered when currentStep is 3 (Review Report) */}
      <div className="hidden">
        {currentStep === 3 && clinician && selectedLocation && (
          <PrintableReport 
            ref={printRef} 
            letterData={displayLetterData} // Use displayLetterData to reflect current state or edited JSON
            client={client}
            clinician={{ ...clinician, ...selectedLocation }} // Merge clinician with selected location data
          />
        )}
      </div>

      <div className="bg-white rounded-lg w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Medicare Referral Acceptance Letter</h3>
            <p className="text-sm text-slate-600">Step {currentStep + 1}: {stepTitles[currentStep]}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Progress indicator */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">
              Step {currentStep + 1} of {stepTitles.length}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / stepTitles.length) * 100}%` }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 min-h-[500px] flex flex-col justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-slate-600">Loading client data...</p>
          </div>
        ) : (
          <div className="p-6 min-h-[500px]">
            {/* Step 0: Select Location */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <h4 className="font-semibold text-slate-800">Select Report Location</h4>
                
                {locations.length === 0 ? (
                  <p className="text-slate-600">No locations configured. Please add locations in Settings.</p>
                ) : (
                  <div className="space-y-3">
                    {locations.map((location) => (
                      <div
                        key={location.id}
                        onClick={() => setSelectedLocation(location)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedLocation?.id === location.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h5 className="font-semibold text-slate-900">{location.clinic_name}</h5>
                              {location.is_main && (
                                <Badge variant="secondary" className="text-xs">Main</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{location.clinic_address}</p>
                            <p className="text-sm text-slate-600">Phone: {location.clinic_phone || 'N/A'} | Email: {location.clinic_email || 'N/A'}</p>
                            <p className="text-sm text-slate-600">Provider: {location.provider_number || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-6">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                    Continue
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 1: GP & Referral Details (shifted from 0) */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-800">GP Details</h4>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">GP Name *</Label>
                      <Input
                        value={letterData.gp_name}
                        onChange={(e) => handleChange('gp_name', e.target.value)}
                        placeholder="e.g., Dr. Ben Tay"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-slate-700">GP Clinic Name *</Label>
                      <Input
                        value={letterData.gp_clinic_name}
                        onChange={(e) => handleChange('gp_clinic_name', e.target.value)}
                        placeholder="e.g., Nambour Medical Centre"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700">GP Address *</Label>
                    <Textarea
                      value={letterData.gp_address}
                      onChange={(e) => handleChange('gp_address', e.target.value)}
                      placeholder="e.g., 14 Daniel St, Nambour QLD 4560"
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-800">Referral Information</h4>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Letter Date</Label>
                      <Input
                        type="date"
                        value={letterData.letter_date}
                        onChange={(e) => handleChange('letter_date', e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-slate-700">Referral Date *</Label>
                      <Input
                        type="date"
                        value={letterData.referral_date}
                        onChange={(e) => handleChange('referral_date', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700">Referral Type</Label>
                    <Input
                      value={letterData.referral_type}
                      onChange={(e) => handleChange('referral_type', e.target.value)}
                      placeholder="e.g., Referral outside Medicare allocation"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                    Continue
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Appointment Details (shifted from 1) */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Next Appointment Details *</Label>
                    <p className="text-xs text-slate-500 mb-2">
                      Describe when the client is booked in (e.g., "next Tuesday 23-September-2025" or "this Friday at 2pm")
                    </p>
                    <Input
                      value={letterData.next_appointment_text}
                      onChange={(e) => handleChange('next_appointment_text', e.target.value)}
                      placeholder="e.g., next Tuesday 23-September-2025"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700">Additional Notes (Optional)</Label>
                    <p className="text-xs text-slate-500 mb-2">
                      Add any information about pricing, session structure, or Medicare details
                    </p>
                    <Textarea
                      value={letterData.session_details}
                      onChange={(e) => handleChange('session_details', e.target.value)}
                      placeholder="e.g., As client is self-funded for sessions client was advised it is anticipated she will begin with 2 sessions (an assessment then delivery) and can opt in for further sessions if desired."
                      className="mt-1"
                      rows={4}
                    />
                  </div>
                </div>

                <div className="flex justify-between gap-3 pt-6">
                  <Button variant="outline" onClick={handleBack}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                    Continue to Review
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Review Report (shifted from 2) */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-900">Review Report</h3>
                  <Button
                    onClick={() => setIsEditing(!isEditing)}
                    variant="outline"
                    size="sm"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {isEditing ? 'View Mode' : 'Edit Mode'}
                  </Button>
                </div>

                {isEditing ? (
                  <div className="space-y-6 max-h-[65vh] overflow-y-auto px-1">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit_gp_name">GP Name</Label>
                        <Input
                          id="edit_gp_name"
                          value={letterData.gp_name || ""}
                          onChange={(e) => handleChange('gp_name', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit_gp_clinic_name">GP Clinic Name</Label>
                        <Input
                          id="edit_gp_clinic_name"
                          value={letterData.gp_clinic_name || ""}
                          onChange={(e) => handleChange('gp_clinic_name', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="edit_gp_address">GP Address</Label>
                      <Textarea
                        id="edit_gp_address"
                        value={letterData.gp_address || ""}
                        onChange={(e) => handleChange('gp_address', e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit_letter_date">Letter Date</Label>
                        <Input
                          id="edit_letter_date"
                          type="date"
                          value={letterData.letter_date || ""}
                          onChange={(e) => handleChange('letter_date', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit_referral_date">Referral Date</Label>
                        <Input
                          id="edit_referral_date"
                          type="date"
                          value={letterData.referral_date || ""}
                          onChange={(e) => handleChange('referral_date', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="edit_referral_type">Referral Type</Label>
                      <Input
                        id="edit_referral_type"
                        value={letterData.referral_type || ""}
                        onChange={(e) => handleChange('referral_type', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit_next_appointment">Next Appointment Details</Label>
                      <Input
                        id="edit_next_appointment"
                        value={letterData.next_appointment_text || ""}
                        onChange={(e) => handleChange('next_appointment_text', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit_session_details">Additional Notes</Label>
                      <Textarea
                        id="edit_session_details"
                        value={letterData.session_details || ""}
                        onChange={(e) => handleChange('session_details', e.target.value)}
                        rows={4}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border-2 border-slate-200 rounded-lg p-8 shadow-lg max-h-[70vh] overflow-y-auto">
                    {clinician && selectedLocation && (
                      <PrintableReport 
                        letterData={displayLetterData} // Use displayLetterData for preview
                        client={client}
                        clinician={{ ...clinician, ...selectedLocation }} // Merge clinician with selected location data for preview
                      />
                    )}
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={handleBack}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back to Edit
                  </Button>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleSaveReport}
                      disabled={isSaving}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {isSaving ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                      ) : (
                        <><Save className="w-4 h-4 mr-2" /> {editingReport ? 'Update Report' : 'Save to Client File'}</>
                      )}
                    </Button>
                    <Button onClick={handlePrint} className="bg-green-600 hover:bg-green-700">
                      <Printer className="w-4 h-4 mr-2" />
                      Print / Save as PDF
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
