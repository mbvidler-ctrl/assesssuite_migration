import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  User as UserIcon,
  Building,
  Phone,
  Mail,
  MapPin,
  FileText,
  Plus,
  X,
  Save,
  Loader2,
  Stethoscope
} from "lucide-react";
import { Toaster, toast } from 'sonner';
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { createCheckoutSession } from "@/functions/createCheckoutSession";
import PractitionerNoticesSection from "@/components/legal/PractitionerNoticesSection";
import PracticeAgreementSection from "@/components/legal/PracticeAgreementSection";
import { recordLegalEvents } from "@/lib/legal/recordAcceptance";
import { EVENT_TYPES } from "@/lib/legal/documentRegistry";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const [isNewOrg, setIsNewOrg] = useState(null); // null = not yet determined
  const [notices, setNotices] = useState({
    collectionNotice: false,
    clinicalUse: false,
    aiTransparency: false,
    marketing: false,
  });
  const [agreement, setAgreement] = useState({
    jurisdictions: [],
    adultOnlyConfirmed: false,
    contractAccepted: false,
  });
  const [formData, setFormData] = useState({
    country: "australia",
    clinician_name: "", // Renamed from full_name
    email: "",
    profession: "", // Added profession
    qualifications: "",
    provider_number: "",
    npi_number: "",
    abn: "",
    clinic_name: "",
    clinic_address: "",
    clinic_phone: "",
    clinic_email: "",
    professional_bio: "",
    registration_number: "",
    specializations: []
  });
  const [newSpecialization, setNewSpecialization] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // New state for loading user data
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        try {
          const existingMembers = await base44.entities.OrganizationMember.filter({ user_email: currentUser.email });
          setIsNewOrg(!existingMembers || existingMembers.length === 0);
        } catch (e) {
          console.error("Failed to determine organisation membership", e);
          setIsNewOrg(true); // safest default: show the fuller (agreement) step rather than silently skip it
        }
        setFormData(prev => {
          const updatedData = {
            ...prev,
            // Pre-fill all existing, non-null fields from currentUser
            ...Object.fromEntries(Object.entries(currentUser).filter(([_, v]) => v != null)),
          };

          // Specific handling for email (always set from currentUser)
          updatedData.email = currentUser.email;

          // Set clinician_name from currentUser.full_name, unless it's 'admin'
          if (currentUser.full_name && currentUser.full_name !== 'admin') {
            updatedData.clinician_name = currentUser.full_name;
          } else if (!prev.clinician_name) { // If it wasn't already set and currentUser.full_name is 'admin' or null
            updatedData.clinician_name = ''; // Ensure it's empty
          }

          // Specific handling for profession
          if (currentUser.profession) {
            updatedData.profession = currentUser.profession;
          }

          if (currentUser.country) updatedData.country = currentUser.country;

          // Ensure specializations is an array
          if (currentUser.specializations) {
            updatedData.specializations = Array.isArray(currentUser.specializations) ? currentUser.specializations : [currentUser.specializations];
          } else {
            updatedData.specializations = [];
          }

          return updatedData;
        });
      } catch (error) {
        console.error("Failed to fetch user data", error);
        toast.error("Could not load your user data. Please refresh.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleNoticeChange = (field, value) => {
    setNotices(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleAgreementChange = (field, value) => {
    setAgreement(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const addSpecialization = () => {
    if (newSpecialization.trim() && !formData.specializations.includes(newSpecialization.trim())) {
      setFormData(prev => ({
        ...prev,
        specializations: [...prev.specializations, newSpecialization.trim()]
      }));
      setNewSpecialization("");
      if (errors.specializations) { // Clear error if specialization is added
        setErrors(prev => ({ ...prev, specializations: "" }));
      }
    }
  };

  const removeSpecialization = (specialization) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.filter(s => s !== specialization)
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.clinician_name.trim()) newErrors.clinician_name = "Your full name is required"; // Updated field name and message
    if (!formData.profession) newErrors.profession = "Please select your profession"; // Added validation
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    // Only require professional fields for non-management roles
    const isManagementRole = formData.profession === "Gym Management" || formData.profession === "Clinic Management";

    if (!isManagementRole) {
    if (!formData.qualifications.trim()) newErrors.qualifications = "Professional qualifications are required";
    const country = formData.country || "australia";
    if (country === "australia") {
      // provider_number and registration_number are optional for Australia
    } else if (country === "usa") {
        if (!formData.npi_number.trim()) newErrors.npi_number = "NPI number is required";
        if (!formData.registration_number.trim()) newErrors.registration_number = "Certification number is required";
      } else if (country === "canada") {
        if (!formData.registration_number.trim()) newErrors.registration_number = "CSEP certification number is required";
      } else if (country === "nz") {
        if (!formData.registration_number.trim()) newErrors.registration_number = "CEPNZ membership number is required";
        if (!formData.npi_number.trim()) newErrors.npi_number = "HPI number is required";
      } else if (country === "uk") {
        if (!formData.registration_number.trim()) newErrors.registration_number = "RCCP/AHCS registration number is required";
      }
    }

    if (!formData.clinic_name.trim()) newErrors.clinic_name = "Clinic name is required";
    if (!formData.clinic_address.trim()) newErrors.clinic_address = "Clinic address is required";
    if (!formData.clinic_phone.trim()) newErrors.clinic_phone = "Clinic phone is required";
    if (!formData.clinic_email.trim()) newErrors.clinic_email = "Clinic email is required";
    if (formData.clinic_email && !/\S+@\S+\.\S+/.test(formData.clinic_email)) {
      newErrors.clinic_email = "Please enter a valid clinic email";
    }
    // Biography and specialisations are optional (WP-6 friction reduction).

    if (!notices.collectionNotice) newErrors.collectionNotice = "Required to continue";
    if (!notices.clinicalUse) newErrors.clinicalUse = "Required to continue";
    if (!notices.aiTransparency) newErrors.aiTransparency = "Required to continue";

    if (isNewOrg) {
      if (agreement.jurisdictions.length === 0) newErrors.jurisdictions = "Select at least one state or territory";
      if (!agreement.adultOnlyConfirmed) newErrors.adultOnlyConfirmed = "Required to continue";
      if (!agreement.contractAccepted) newErrors.contractAccepted = "Required to continue";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSaving(true);

    try {
      const currentUser = await base44.auth.me();
      
      // Create organization (only if user doesn't already have one)
      let org;
      const existingMembers = await base44.entities.OrganizationMember.filter({ user_email: currentUser.email });
      const foundingNewOrg = !existingMembers || existingMembers.length === 0;
      if (!foundingNewOrg) {
        org = { id: existingMembers[0].org_id };
      } else {
        org = await base44.entities.Organization.create({
          name: formData.clinic_name,
          served_jurisdictions: agreement.jurisdictions,
          adult_only_confirmed: agreement.adultOnlyConfirmed,
        });
        await base44.entities.OrganizationMember.create({
          org_id: org.id,
          user_email: currentUser.email,
          role: "owner",
          is_primary: true
        });
        // Set new user role to "user" not admin
        await base44.auth.updateMe({ role: "user" });
      }

      // Create user profile with the form data. Account activation is an
      // admin approval decision (AdminApprovals) — the server refuses
      // self-service account_status changes, so none is sent here.
      await base44.auth.updateMe({ ...formData });

      // Record the mandatory practitioner notices — every user, every time
      // they pass through this page (the events are additive; re-recording
      // the same current-version event is harmless and matches the
      // append-only model in policy-suite doc 27 clause 5).
      const actorCapacity = foundingNewOrg ? "practice owner" : "invited clinician";
      const events = [
        { eventType: EVENT_TYPES.COLLECTION_NOTICE_ACKNOWLEDGEMENT, documentId: "collection-notice" },
        { eventType: EVENT_TYPES.PROFESSIONAL_USE_ACKNOWLEDGEMENT, documentId: "clinical-use-notice" },
        { eventType: EVENT_TYPES.AI_TRANSPARENCY_CONSENT, documentId: "ai-notice" },
      ].map((e) => ({ ...e, userEmail: currentUser.email, orgId: org.id, actorCapacity }));
      if (notices.marketing) {
        events.push({ eventType: EVENT_TYPES.MARKETING_CONSENT, userEmail: currentUser.email, orgId: org.id, actorCapacity });
      }
      if (foundingNewOrg) {
        events.push({
          eventType: EVENT_TYPES.CONTRACT_ACCEPTANCE,
          documentId: "terms",
          userEmail: currentUser.email,
          orgId: org.id,
          actorCapacity,
        });
      }
      try {
        await recordLegalEvents(events);
      } catch (legalError) {
        console.error("Failed to record legal acceptance events", legalError);
        toast.error("Failed to record your notice acknowledgements. Please try again.");
        setIsSaving(false);
        return;
      }

      // Payment-before-profile (Design A): checkout already happened before this
      // first-run profile step, so this page no longer starts a checkout session
      // — it saves the profile and records consents, then enters the app.
      toast.success("Profile saved.");
      navigate(createPageUrl("Dashboard"));

    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile. Please try again.");
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-6">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <Stethoscope className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome to AssessSuite</h1>
              <p className="text-lg text-slate-600">
                Let's set up your professional profile to get started
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-blue-600" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  {/* clinician_name has no source elsewhere in this flow: Register.jsx
                      only collects email/password, and currentUser.full_name is never
                      set by any prior step, so validateForm's "Your full name is
                      required" check could never be satisfied without this field. */}
                  <Label htmlFor="clinician_name" className="text-sm font-medium text-slate-700">
                    Your Full Name *
                  </Label>
                  <Input
                    id="clinician_name"
                    value={formData.clinician_name}
                    onChange={(e) => handleInputChange("clinician_name", e.target.value)}
                    placeholder="Your full name"
                    className={`mt-1 ${errors.clinician_name ? "border-red-500" : ""}`}
                  />
                  {errors.clinician_name && (
                    <p className="text-red-500 text-sm mt-1">{errors.clinician_name}</p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="profession" className="text-sm font-medium text-slate-700">
                      Profession *
                    </Label>
                    <Select
                      value={formData.profession}
                      onValueChange={(value) => handleInputChange("profession", value)}
                    >
                      <SelectTrigger className={`mt-1 ${errors.profession ? "border-red-500" : ""}`}>
                        <SelectValue placeholder="Select your profession" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Personal Trainer">Personal Trainer</SelectItem>
                        <SelectItem value="Exercise Scientist">Exercise Scientist</SelectItem>
                        <SelectItem value="Exercise Physiologist">Exercise Physiologist</SelectItem>
                        <SelectItem value="Physiotherapist">Physiotherapist</SelectItem>
                        <SelectItem value="Strength + Conditioning Coach">Strength + Conditioning Coach</SelectItem>
                        <SelectItem value="Gym Management">Gym Management</SelectItem>
                        <SelectItem value="Clinic Management">Clinic Management</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.profession && (
                      <p className="text-red-500 text-sm mt-1">{errors.profession}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                    Login Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className={`mt-1 bg-slate-100`}
                  />
                  {/* Removed email error display as it's disabled and pre-filled */}
                </div>

                <div>
                  <Label htmlFor="country" className="text-sm font-medium text-slate-700">Country of Practice *</Label>
                  <Select value={formData.country} onValueChange={(v) => handleInputChange("country", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="australia">🇦🇺 Australia</SelectItem>
                      <SelectItem value="usa">🇺🇸 United States</SelectItem>
                      <SelectItem value="canada">🇨🇦 Canada</SelectItem>
                      <SelectItem value="nz">🇳🇿 New Zealand</SelectItem>
                      <SelectItem value="uk">🇬🇧 United Kingdom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Only show professional fields for non-management roles */}
                {formData.profession && formData.profession !== "Gym Management" && formData.profession !== "Clinic Management" && (
                  <>
                    <div>
                      <Label htmlFor="qualifications" className="text-sm font-medium text-slate-700">
                        Professional Qualifications *
                      </Label>
                      <Input
                        id="qualifications"
                        value={formData.qualifications}
                        onChange={(e) => handleInputChange("qualifications", e.target.value)}
                        placeholder="e.g., Exercise Physiologist, Physiotherapist"
                        className={`mt-1 ${errors.qualifications ? "border-red-500" : ""}`}
                      />
                      {errors.qualifications && (
                        <p className="text-red-500 text-sm mt-1">{errors.qualifications}</p>
                      )}
                    </div>

                    {/* Australia */}
                    {(!formData.country || formData.country === "australia") && (
                      <>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="provider_number" className="text-sm font-medium text-slate-700">Medicare Provider Number</Label>
                            <Input id="provider_number" value={formData.provider_number} onChange={(e) => handleInputChange("provider_number", e.target.value)} placeholder="e.g. 2345678A" className={`mt-1 ${errors.provider_number ? "border-red-500" : ""}`} />
                            {errors.provider_number && <p className="text-red-500 text-sm mt-1">{errors.provider_number}</p>}
                          </div>
                          <div>
                            <Label htmlFor="registration_number" className="text-sm font-medium text-slate-700">ESSA Registration Number</Label>
                            <Input id="registration_number" value={formData.registration_number} onChange={(e) => handleInputChange("registration_number", e.target.value)} placeholder="e.g. EPH0001234" className={`mt-1 ${errors.registration_number ? "border-red-500" : ""}`} />
                            {errors.registration_number && <p className="text-red-500 text-sm mt-1">{errors.registration_number}</p>}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="abn" className="text-sm font-medium text-slate-700">ABN</Label>
                          <Input id="abn" value={formData.abn} onChange={(e) => handleInputChange("abn", e.target.value)} placeholder="e.g. 12 345 678 901" className="mt-1" />
                        </div>
                      </>
                    )}
                    {/* USA */}
                    {formData.country === "usa" && (
                      <>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="npi_number" className="text-sm font-medium text-slate-700">NPI Number (Individual) *</Label>
                            <Input id="npi_number" value={formData.npi_number} onChange={(e) => handleInputChange("npi_number", e.target.value)} placeholder="10-digit NPI" className={`mt-1 ${errors.npi_number ? "border-red-500" : ""}`} />
                            {errors.npi_number && <p className="text-red-500 text-sm mt-1">{errors.npi_number}</p>}
                          </div>
                          <div>
                            <Label htmlFor="registration_number" className="text-sm font-medium text-slate-700">ACSM Certification Number *</Label>
                            <Input id="registration_number" value={formData.registration_number} onChange={(e) => handleInputChange("registration_number", e.target.value)} placeholder="ACSM-EP or ACSM-CEP number" className={`mt-1 ${errors.registration_number ? "border-red-500" : ""}`} />
                            {errors.registration_number && <p className="text-red-500 text-sm mt-1">{errors.registration_number}</p>}
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="provider_number" className="text-sm font-medium text-slate-700">State License Number</Label>
                            <Input id="provider_number" value={formData.provider_number} onChange={(e) => handleInputChange("provider_number", e.target.value)} placeholder="State-issued license (if applicable)" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="abn" className="text-sm font-medium text-slate-700">Tax ID / EIN</Label>
                            <Input id="abn" value={formData.abn} onChange={(e) => handleInputChange("abn", e.target.value)} placeholder="Federal Tax ID / EIN" className="mt-1" />
                          </div>
                        </div>
                      </>
                    )}
                    {/* Canada */}
                    {formData.country === "canada" && (
                      <>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="registration_number" className="text-sm font-medium text-slate-700">CSEP-CEP Certification Number *</Label>
                            <Input id="registration_number" value={formData.registration_number} onChange={(e) => handleInputChange("registration_number", e.target.value)} placeholder="CSEP certification number" className={`mt-1 ${errors.registration_number ? "border-red-500" : ""}`} />
                            {errors.registration_number && <p className="text-red-500 text-sm mt-1">{errors.registration_number}</p>}
                          </div>
                          <div>
                            <Label htmlFor="abn" className="text-sm font-medium text-slate-700">GST/HST Number</Label>
                            <Input id="abn" value={formData.abn} onChange={(e) => handleInputChange("abn", e.target.value)} placeholder="Business GST/HST number" className="mt-1" />
                          </div>
                        </div>
                      </>
                    )}
                    {/* New Zealand */}
                    {formData.country === "nz" && (
                      <>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="npi_number" className="text-sm font-medium text-slate-700">HPI Number (Health Provider Index) *</Label>
                            <Input id="npi_number" value={formData.npi_number} onChange={(e) => handleInputChange("npi_number", e.target.value)} placeholder="HPI number" className={`mt-1 ${errors.npi_number ? "border-red-500" : ""}`} />
                            {errors.npi_number && <p className="text-red-500 text-sm mt-1">{errors.npi_number}</p>}
                          </div>
                          <div>
                            <Label htmlFor="registration_number" className="text-sm font-medium text-slate-700">CEPNZ Membership Number *</Label>
                            <Input id="registration_number" value={formData.registration_number} onChange={(e) => handleInputChange("registration_number", e.target.value)} placeholder="CEPNZ membership number" className={`mt-1 ${errors.registration_number ? "border-red-500" : ""}`} />
                            {errors.registration_number && <p className="text-red-500 text-sm mt-1">{errors.registration_number}</p>}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="provider_number" className="text-sm font-medium text-slate-700">ACC Provider Registration Number</Label>
                          <Input id="provider_number" value={formData.provider_number} onChange={(e) => handleInputChange("provider_number", e.target.value)} placeholder="ACC treatment provider number" className="mt-1" />
                        </div>
                      </>
                    )}
                    {/* UK */}
                    {formData.country === "uk" && (
                      <>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="registration_number" className="text-sm font-medium text-slate-700">RCCP / AHCS Registration Number *</Label>
                            <Input id="registration_number" value={formData.registration_number} onChange={(e) => handleInputChange("registration_number", e.target.value)} placeholder="RCCP or AHCS number" className={`mt-1 ${errors.registration_number ? "border-red-500" : ""}`} />
                            {errors.registration_number && <p className="text-red-500 text-sm mt-1">{errors.registration_number}</p>}
                          </div>
                          <div>
                            <Label htmlFor="provider_number" className="text-sm font-medium text-slate-700">NHS PIN (if applicable)</Label>
                            <Input id="provider_number" value={formData.provider_number} onChange={(e) => handleInputChange("provider_number", e.target.value)} placeholder="NHS PIN" className="mt-1" />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                <div>
                  <Label htmlFor="professional_bio" className="text-sm font-medium text-slate-700">
                    Professional Biography
                  </Label>
                  <Textarea
                    id="professional_bio"
                    value={formData.professional_bio}
                    onChange={(e) => handleInputChange("professional_bio", e.target.value)}
                    placeholder="Brief description of your professional background and expertise..."
                    className={`mt-1 ${errors.professional_bio ? "border-red-500" : ""}`}
                    rows={4}
                  />
                  {errors.professional_bio && (
                    <p className="text-red-500 text-sm mt-1">{errors.professional_bio}</p>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    Specializations
                  </Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {formData.specializations.map((spec, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {spec}
                          <button
                            type="button"
                            onClick={() => removeSpecialization(spec)}
                            className="ml-1 hover:text-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newSpecialization}
                        onChange={(e) => setNewSpecialization(e.target.value)}
                        placeholder="Add specialization..."
                        className="flex-1"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialization())}
                      />
                      <Button type="button" onClick={addSpecialization} size="sm">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    {errors.specializations && (
                      <p className="text-red-500 text-sm mt-1">{errors.specializations}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Clinic Information */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-blue-600" />
                  Clinic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="clinic_name" className="text-sm font-medium text-slate-700">
                    Clinic Name *
                  </Label>
                  <Input
                    id="clinic_name"
                    value={formData.clinic_name}
                    onChange={(e) => handleInputChange("clinic_name", e.target.value)}
                    placeholder="Your clinic or practice name"
                    className={`mt-1 ${errors.clinic_name ? "border-red-500" : ""}`}
                  />
                  {errors.clinic_name && (
                    <p className="text-red-500 text-sm mt-1">{errors.clinic_name}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="clinic_address" className="text-sm font-medium text-slate-700">
                    Clinic Address *
                  </Label>
                  <Textarea
                    id="clinic_address"
                    value={formData.clinic_address}
                    onChange={(e) => handleInputChange("clinic_address", e.target.value)}
                    placeholder="Full clinic address"
                    className={`mt-1 ${errors.clinic_address ? "border-red-500" : ""}`}
                    rows={3}
                  />
                  {errors.clinic_address && (
                    <p className="text-red-500 text-sm mt-1">{errors.clinic_address}</p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="clinic_phone" className="text-sm font-medium text-slate-700">
                      Clinic Phone *
                    </Label>
                    <Input
                      id="clinic_phone"
                      value={formData.clinic_phone}
                      onChange={(e) => handleInputChange("clinic_phone", e.target.value)}
                      placeholder="Clinic phone number"
                      className={`mt-1 ${errors.clinic_phone ? "border-red-500" : ""}`}
                    />
                    {errors.clinic_phone && (
                      <p className="text-red-500 text-sm mt-1">{errors.clinic_phone}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="clinic_email" className="text-sm font-medium text-slate-700">
                      Clinic Email *
                    </Label>
                    <Input
                      id="clinic_email"
                      type="email"
                      value={formData.clinic_email}
                      onChange={(e) => handleInputChange("clinic_email", e.target.value)}
                      placeholder="Clinic email address"
                      className={`mt-1 ${errors.clinic_email ? "border-red-500" : ""}`}
                    />
                    {errors.clinic_email && (
                      <p className="text-red-500 text-sm mt-1">{errors.clinic_email}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {isNewOrg && (
              <PracticeAgreementSection values={agreement} onChange={handleAgreementChange} errors={errors} />
            )}

            <PractitionerNoticesSection values={notices} onChange={handleNoticeChange} errors={errors} />

            {/* Submit Button */}
            <div className="flex justify-center">
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 px-12 py-3 text-lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Setting up your profile...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Complete Setup
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}