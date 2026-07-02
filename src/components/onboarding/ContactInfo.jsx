import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, ArrowLeft } from "lucide-react";

export default function ContactInfo({ data, onNext, onBack, canGoBack, onSaveAndFinishLater }) {
  const [formData, setFormData] = useState({
    referral_source: data.referral_source || "",
    referral_source_name: data.referral_source_name || "",
    referral_source_address: data.referral_source_address || "",
    referral_source_email: data.referral_source_email || "",
    referral_provider_number: data.referral_provider_number || "",
    referral_reason: data.referral_reason || "",
    referral_date: data.referral_date || "",
    // Healthcare providers
    primary_gp_clinic_name: data.primary_gp_clinic_name || "",
    primary_gp_name: data.primary_gp_name || "",
    primary_gp_address: data.primary_gp_address || "",
    primary_gp_phone: data.primary_gp_phone || "",
    primary_gp_email: data.primary_gp_email || "",
    primary_gp_provider_number: data.primary_gp_provider_number || "",
    hospital_name: data.hospital_name || "",
    hospital_gp_name: data.hospital_gp_name || "",
    hospital_gp_address: data.hospital_gp_address || "",
    hospital_gp_phone: data.hospital_gp_phone || "",
    hospital_gp_email: data.hospital_gp_email || "",
    hospital_gp_provider_number: data.hospital_gp_provider_number || "",
    specialist_clinic_name: data.specialist_clinic_name || "",
    specialist_name: data.specialist_name || "",
    specialist_type: data.specialist_type || "",
    specialist_address: data.specialist_address || "",
    specialist_phone: data.specialist_phone || "",
    specialist_email: data.specialist_email || "",
    specialist_provider_number: data.specialist_provider_number || "",
    other_healthcare_providers: data.other_healthcare_providers || ""
  });

  const [errors, setErrors] = useState({});

  // Auto-populate primary GP fields when referral source is GP
  useEffect(() => {
    // Only auto-populate if the referral source is "gp"
    if (formData.referral_source === "gp") {
      setFormData(prev => ({
        ...prev,
        primary_gp_name: prev.referral_source_name || "",
        primary_gp_address: prev.referral_source_address || "",
        primary_gp_email: prev.referral_source_email || "",
        primary_gp_provider_number: prev.referral_provider_number || ""
      }));
    } else {
      // If referral source is not "gp", ensure these fields are not auto-populated and can be edited freely.
      // This implicitly clears them if they were previously auto-filled when referral_source was "gp" and then changed.
      // However, if the user explicitly typed something, we don't want to clear it.
      // A more robust approach might be to only auto-fill if the fields are currently empty.
      // For this change, we'll stick to the outline's implication: if not GP referral, allow free input.
    }
  }, [formData.referral_source, formData.referral_source_name, formData.referral_source_address, formData.referral_source_email, formData.referral_provider_number]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onNext(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
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

  const shouldDisablePrimaryGPFields = formData.referral_source === "gp";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Referral Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Referral Information</h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium text-slate-700">
              Referral Source
            </Label>
            <Select value={formData.referral_source} onValueChange={(value) => handleChange("referral_source", value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select referral source" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(referralSourceLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="referral_date" className="text-sm font-medium text-slate-700">
              Referral Date
            </Label>
            <Input
              id="referral_date"
              type="date"
              value={formData.referral_date}
              onChange={(e) => handleChange("referral_date", e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        {formData.referral_source && formData.referral_source !== "self_referral" && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="referral_source_name" className="text-sm font-medium text-slate-700">
                  Referrer Name
                </Label>
                <Input
                  id="referral_source_name"
                  value={formData.referral_source_name}
                  onChange={(e) => handleChange("referral_source_name", e.target.value)}
                  placeholder="Name of referring person/organization"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="referral_provider_number" className="text-sm font-medium text-slate-700">
                  Provider Number
                </Label>
                <Input
                  id="referral_provider_number"
                  value={formData.referral_provider_number}
                  onChange={(e) => handleChange("referral_provider_number", e.target.value)}
                  placeholder="Provider number (if applicable)"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="referral_source_address" className="text-sm font-medium text-slate-700">
                Referrer's Address
              </Label>
              <Textarea
                id="referral_source_address"
                value={formData.referral_source_address}
                onChange={(e) => handleChange("referral_source_address", e.target.value)}
                placeholder="Address of referring person/organization"
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="referral_source_email" className="text-sm font-medium text-slate-700">
                Referrer's Email
              </Label>
              <Input
                id="referral_source_email"
                type="email"
                value={formData.referral_source_email}
                onChange={(e) => handleChange("referral_source_email", e.target.value)}
                placeholder="Email of referring person/organization"
                className="mt-1"
              />
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="referral_reason" className="text-sm font-medium text-slate-700">
            Reason for Referral
          </Label>
          <Textarea
            id="referral_reason"
            value={formData.referral_reason}
            onChange={(e) => handleChange("referral_reason", e.target.value)}
            placeholder="Brief reason for seeking assessment/treatment"
            className="mt-1"
            rows={3}
          />
        </div>
      </div>

      {/* Healthcare Providers */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Healthcare Provider Details</h3>
        
        {/* Primary GP */}
        <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-800 mb-2">Primary/Community GP</h4>
          
          {formData.referral_source === "gp" && (
            <p className="text-sm text-blue-700 mb-2">
              Automatically filled from referral source (GP)
            </p>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="primary_gp_clinic_name" className="text-sm font-medium text-slate-700">
                Clinic Name
              </Label>
              <Input
                id="primary_gp_clinic_name"
                value={formData.primary_gp_clinic_name}
                onChange={(e) => handleChange("primary_gp_clinic_name", e.target.value)}
                placeholder="Primary GP clinic name"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="primary_gp_name" className="text-sm font-medium text-slate-700">
                GP Name
              </Label>
              <Input
                id="primary_gp_name"
                value={formData.primary_gp_name}
                onChange={(e) => handleChange("primary_gp_name", e.target.value)}
                placeholder="Primary GP name"
                className="mt-1"
                disabled={shouldDisablePrimaryGPFields}
              />
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="primary_gp_provider_number" className="text-sm font-medium text-slate-700">
                Provider Number
              </Label>
              <Input
                id="primary_gp_provider_number"
                value={formData.primary_gp_provider_number}
                onChange={(e) => handleChange("primary_gp_provider_number", e.target.value)}
                placeholder="GP provider number"
                className="mt-1"
                disabled={shouldDisablePrimaryGPFields}
              />
            </div>
            <div>
              <Label htmlFor="primary_gp_phone" className="text-sm font-medium text-slate-700">
                Clinic Phone
              </Label>
              <Input
                id="primary_gp_phone"
                type="tel"
                value={formData.primary_gp_phone}
                onChange={(e) => handleChange("primary_gp_phone", e.target.value)}
                placeholder="GP clinic phone"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="primary_gp_address" className="text-sm font-medium text-slate-700">
              Clinic Address
            </Label>
            <Textarea
              id="primary_gp_address"
              value={formData.primary_gp_address}
              onChange={(e) => handleChange("primary_gp_address", e.target.value)}
              placeholder="Primary GP clinic address"
              className="mt-1"
              rows={2}
              disabled={shouldDisablePrimaryGPFields}
            />
          </div>

          <div>
            <Label htmlFor="primary_gp_email" className="text-sm font-medium text-slate-700">
                Clinic Email
            </Label>
            <Input
              id="primary_gp_email"
              type="email"
              value={formData.primary_gp_email}
              onChange={(e) => handleChange("primary_gp_email", e.target.value)}
              placeholder="GP clinic email"
              className="mt-1"
              disabled={shouldDisablePrimaryGPFields}
            />
          </div>
        </div>

        {/* Hospital/Rehab GP */}
        <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <h4 className="font-medium text-green-800 mb-2">Hospital/Rehab Center GP (if applicable)</h4>
          
          <div>
              <Label htmlFor="hospital_name" className="text-sm font-medium text-slate-700">
                Hospital/Rehab Center Name
              </Label>
              <Input
                id="hospital_name"
                value={formData.hospital_name}
                onChange={(e) => handleChange("hospital_name", e.target.value)}
                placeholder="Name of hospital or rehab center"
                className="mt-1"
              />
            </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hospital_gp_name" className="text-sm font-medium text-slate-700">
                Hospital GP Name
              </Label>
              <Input
                id="hospital_gp_name"
                value={formData.hospital_gp_name}
                onChange={(e) => handleChange("hospital_gp_name", e.target.value)}
                placeholder="Hospital/rehab GP name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="hospital_gp_provider_number" className="text-sm font-medium text-slate-700">
                Provider Number
              </Label>
              <Input
                id="hospital_gp_provider_number"
                value={formData.hospital_gp_provider_number}
                onChange={(e) => handleChange("hospital_gp_provider_number", e.target.value)}
                placeholder="Hospital GP provider number"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="hospital_gp_address" className="text-sm font-medium text-slate-700">
              Hospital/Rehab Address
            </Label>
            <Textarea
              id="hospital_gp_address"
              value={formData.hospital_gp_address}
              onChange={(e) => handleChange("hospital_gp_address", e.target.value)}
              placeholder="Hospital/rehab center address"
              className="mt-1"
              rows={2}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hospital_gp_phone" className="text-sm font-medium text-slate-700">
                Hospital Phone
              </Label>
              <Input
                id="hospital_gp_phone"
                type="tel"
                value={formData.hospital_gp_phone}
                onChange={(e) => handleChange("hospital_gp_phone", e.target.value)}
                placeholder="Hospital phone"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="hospital_gp_email" className="text-sm font-medium text-slate-700">
                Hospital Email
              </Label>
              <Input
                id="hospital_gp_email"
                type="email"
                value={formData.hospital_gp_email}
                onChange={(e) => handleChange("hospital_gp_email", e.target.value)}
                placeholder="Hospital email"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Specialist */}
        <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <h4 className="font-medium text-purple-800 mb-2">Specialist (if applicable)</h4>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="specialist_clinic_name" className="text-sm font-medium text-slate-700">
                Clinic Name
              </Label>
              <Input
                id="specialist_clinic_name"
                value={formData.specialist_clinic_name}
                onChange={(e) => handleChange("specialist_clinic_name", e.target.value)}
                placeholder="Specialist clinic name"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="specialist_name" className="text-sm font-medium text-slate-700">
                Specialist Name
              </Label>
              <Input
                id="specialist_name"
                value={formData.specialist_name}
                onChange={(e) => handleChange("specialist_name", e.target.value)}
                placeholder="Specialist doctor name"
                className="mt-1"
              />
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="specialist_type" className="text-sm font-medium text-slate-700">
                Specialist Type
              </Label>
              <Input
                id="specialist_type"
                value={formData.specialist_type}
                onChange={(e) => handleChange("specialist_type", e.target.value)}
                placeholder="e.g., Psychiatrist, Cardiologist, Neurologist"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="specialist_provider_number" className="text-sm font-medium text-slate-700">
                Provider Number
              </Label>
              <Input
                id="specialist_provider_number"
                value={formData.specialist_provider_number}
                onChange={(e) => handleChange("specialist_provider_number", e.target.value)}
                placeholder="Specialist provider number"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="specialist_phone" className="text-sm font-medium text-slate-700">
                Clinic Phone
              </Label>
              <Input
                id="specialist_phone"
                type="tel"
                value={formData.specialist_phone}
                onChange={(e) => handleChange("specialist_phone", e.target.value)}
                placeholder="Specialist clinic phone"
                className="mt-1"
              />
            </div>
             <div>
              <Label htmlFor="specialist_email" className="text-sm font-medium text-slate-700">
                Clinic Email
              </Label>
              <Input
                id="specialist_email"
                type="email"
                value={formData.specialist_email}
                onChange={(e) => handleChange("specialist_email", e.target.value)}
                placeholder="Specialist clinic email"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="specialist_address" className="text-sm font-medium text-slate-700">
              Clinic Address
            </Label>
            <Textarea
              id="specialist_address"
              value={formData.specialist_address}
              onChange={(e) => handleChange("specialist_address", e.target.value)}
              placeholder="Specialist clinic address"
              className="mt-1"
              rows={2}
            />
          </div>
        </div>

        {/* Other Healthcare Providers */}
        <div>
          <Label htmlFor="other_healthcare_providers" className="text-sm font-medium text-slate-700">
            Other Healthcare Providers
          </Label>
          <Textarea
            id="other_healthcare_providers"
            value={formData.other_healthcare_providers}
            onChange={(e) => handleChange("other_healthcare_providers", e.target.value)}
            placeholder="List any other healthcare providers involved in care (physiotherapist, occupational therapist, dietitian, etc.)"
            className="mt-1"
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-between pt-6">
        <div className="flex gap-2">
          {canGoBack && (
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {onSaveAndFinishLater && (
            <Button type="button" variant="outline" onClick={() => onSaveAndFinishLater(formData)} className="text-slate-600">
              Save & Finish Later
            </Button>
          )}
        </div>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </form>
  );
}