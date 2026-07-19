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
import ConsentSection from "@/components/legal/ConsentSection";
import { recordLegalAcceptanceBundle } from "@/lib/legal/recordAcceptance";
import { resolveLegalConsentAudience } from "@/lib/legal/consentAudience";

const SELF_SERVICE_PROFESSIONS = new Set([
  "Exercise Physiologist",
  "Gym Management",
  "Clinic Management",
]);

export default function ProfileSetup() {
  const navigate = useNavigate();
  const [consentAudience, setConsentAudience] = useState(null);
  const [consent, setConsent] = useState({
    accepted: false,
    marketing: false,
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
          setConsentAudience(resolveLegalConsentAudience(existingMembers));
        } catch (e) {
          console.error("Failed to determine organisation membership", e);
          // Fail closed to the fuller owner bundle until membership can be
          // resolved authoritatively again during submission.
          setConsentAudience(resolveLegalConsentAudience([]));
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
          if (SELF_SERVICE_PROFESSIONS.has(currentUser.profession)) {
            updatedData.profession = currentUser.profession;
          } else {
            updatedData.profession = "";
          }

          // RC-2026.07.19 self-service is Australia-only. No jurisdiction
          // selector is presented; separately approved customers use a
          // negotiated order rather than this public profile path.
          updatedData.country = "australia";

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

  const handleConsentChange = (field, value) => {
    setConsent(prev => ({ ...prev, [field]: value }));
    if (field === "accepted" && errors.consentAccepted) {
      setErrors(prev => ({ ...prev, consentAccepted: "" }));
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
      if (formData.profession !== "Exercise Physiologist") {
        newErrors.profession = "Self-service clinical accounts are limited to Australian Accredited Exercise Physiologists";
      }
      if (!formData.qualifications.trim()) newErrors.qualifications = "Professional qualifications are required";
    }

    if (!formData.clinic_name.trim()) newErrors.clinic_name = "Clinic name is required";
    if (!formData.clinic_address.trim()) newErrors.clinic_address = "Clinic address is required";
    if (!formData.clinic_phone.trim()) newErrors.clinic_phone = "Clinic phone is required";
    if (!formData.clinic_email.trim()) newErrors.clinic_email = "Clinic email is required";
    if (formData.clinic_email && !/\S+@\S+\.\S+/.test(formData.clinic_email)) {
      newErrors.clinic_email = "Please enter a valid clinic email";
    }
    // Biography and specialisations are optional (WP-6 friction reduction).

    if (!consent.accepted) newErrors.consentAccepted = "Required to continue";

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
      const liveAudience = resolveLegalConsentAudience(existingMembers);

      // The instruments shown to the user must match the capacity recorded at
      // submission. This compares the actual selected membership and role, not
      // merely whether any membership exists. An owner created on a previous
      // failed attempt therefore continues to see the eight-document bundle.
      if (
        !consentAudience ||
        liveAudience.orgId !== consentAudience.orgId ||
        liveAudience.ownerBundle !== consentAudience.ownerBundle ||
        liveAudience.willCreateOrganization !== consentAudience.willCreateOrganization
      ) {
        setConsentAudience(liveAudience);
        setConsent(prev => ({ ...prev, accepted: false }));
        setErrors(prev => ({
          ...prev,
          consentAccepted: "Your practice membership changed. Review the instruments shown and confirm again.",
        }));
        toast.error("Your practice membership changed while this page was open. Please review the updated consent instruments.");
        setIsSaving(false);
        return;
      }

      if (!liveAudience.willCreateOrganization) {
        org = { id: liveAudience.orgId };
      } else {
        org = await base44.entities.Organization.create({
          name: formData.clinic_name,
        });
        await base44.entities.OrganizationMember.create({
          org_id: org.id,
          user_email: currentUser.email,
          role: "owner",
          is_primary: true
        });
        setConsentAudience({
          orgId: org.id,
          ownerBundle: true,
          willCreateOrganization: false,
        });
        // Set new user role to "user" not admin
        await base44.auth.updateMe({ role: "user" });
      }

      // Create user profile with the form data. Account activation is an
      // admin approval decision (AdminApprovals) — the server refuses
      // self-service account_status changes, so none is sent here.
      await base44.auth.updateMe({ ...formData });

      try {
        await recordLegalAcceptanceBundle({ orgId: org.id, marketingOptIn: consent.marketing });
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
                        <SelectItem value="Exercise Physiologist">Accredited Exercise Physiologist (AEP)</SelectItem>
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

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="provider_number" className="text-sm font-medium text-slate-700">Medicare Provider Number</Label>
                        <Input id="provider_number" value={formData.provider_number} onChange={(e) => handleInputChange("provider_number", e.target.value)} placeholder="e.g. 2345678A" className={`mt-1 ${errors.provider_number ? "border-red-500" : ""}`} />
                        {errors.provider_number && <p className="text-red-500 text-sm mt-1">{errors.provider_number}</p>}
                      </div>
                      <div>
                        <Label htmlFor="registration_number" className="text-sm font-medium text-slate-700">ESSA Accreditation Number</Label>
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

            <ConsentSection
              values={consent}
              onChange={handleConsentChange}
              error={errors.consentAccepted}
              isFoundingOwner={consentAudience?.ownerBundle !== false}
            />

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
