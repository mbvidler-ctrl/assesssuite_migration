import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Mail } from "lucide-react";

export default function PersonalInfo({ data, onNext, onSaveAndSend, onSaveAndFinishLater, isClientView }) {
  const [formData, setFormData] = useState({
    full_name: data.full_name || "",
    date_of_birth: data.date_of_birth || "",
    gender: data.gender || "",
    gender_other: data.gender_other || "",
    pronouns: data.pronouns || "",
    phone: data.phone || "",
    email: data.email || "",
    address: data.address || "",
    emergency_contact_name: data.emergency_contact_name || "",
    emergency_contact_phone: data.emergency_contact_phone || "",
    cultural_considerations: data.cultural_considerations || ""
  });

  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const newErrors = {};
    if (!formData.full_name.trim()) newErrors.full_name = "Full name is required";
    if (!formData.date_of_birth) newErrors.date_of_birth = "Date of birth is required";

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onNext(formData);
    }
  };

  const handleSaveAndSendToClient = (e) => {
    e.preventDefault();
    
    const newErrors = {};
    if (!formData.full_name.trim()) newErrors.full_name = "Full name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onSaveAndSend(formData);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const canSaveAndSend = formData.full_name.trim() && formData.email.trim() && !isClientView;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* Personal Details Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Personal Details</h3>
          
          <div>
            <Label htmlFor="full_name" className="text-sm font-medium text-slate-700">
              Full Name *
            </Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleChange("full_name", e.target.value)}
              placeholder="Enter full name"
              className={`mt-1 ${errors.full_name ? "border-red-500" : ""}`}
            />
            {errors.full_name && (
              <p className="text-red-500 text-sm mt-1">{errors.full_name}</p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date_of_birth" className="text-sm font-medium text-slate-700">
                Date of Birth *
              </Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => handleChange("date_of_birth", e.target.value)}
                className={`mt-1 ${errors.date_of_birth ? "border-red-500" : ""}`}
              />
              {errors.date_of_birth && (
                <p className="text-red-500 text-sm mt-1">{errors.date_of_birth}</p>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">
                Gender
              </Label>
              <Select value={formData.gender} onValueChange={(value) => handleChange("gender", value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.gender === "other" && (
            <div>
              <Label htmlFor="gender_other" className="text-sm font-medium text-slate-700">
                Please specify
              </Label>
              <Input
                id="gender_other"
                value={formData.gender_other}
                onChange={(e) => handleChange("gender_other", e.target.value)}
                placeholder="Please specify your gender"
                className="mt-1"
              />
            </div>
          )}

          <div>
            <Label htmlFor="pronouns" className="text-sm font-medium text-slate-700">
              Preferred Pronouns
            </Label>
            <Input
              id="pronouns"
              value={formData.pronouns}
              onChange={(e) => handleChange("pronouns", e.target.value)}
              placeholder="e.g., they/them, she/her, he/him"
              className="mt-1"
            />
          </div>
        </div>

        {/* Contact Information Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Contact Information</h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="Enter phone number"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="Enter email address"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address" className="text-sm font-medium text-slate-700">
              Home Address
            </Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="Enter full home address"
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        {/* Emergency Contact Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Emergency Contact</h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emergency_contact_name" className="text-sm font-medium text-slate-700">
                Emergency Contact Name
              </Label>
              <Input
                id="emergency_contact_name"
                value={formData.emergency_contact_name}
                onChange={(e) => handleChange("emergency_contact_name", e.target.value)}
                placeholder="Full name of emergency contact"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="emergency_contact_phone" className="text-sm font-medium text-slate-700">
                Emergency Contact Phone
              </Label>
              <Input
                id="emergency_contact_phone"
                type="tel"
                value={formData.emergency_contact_phone}
                onChange={(e) => handleChange("emergency_contact_phone", e.target.value)}
                placeholder="Emergency contact phone number"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Cultural Considerations Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Cultural Considerations</h3>
          
          <div>
            <Label htmlFor="cultural_considerations" className="text-sm font-medium text-slate-700">
              Cultural or Language Considerations
            </Label>
            <Textarea
              id="cultural_considerations"
              value={formData.cultural_considerations}
              onChange={(e) => handleChange("cultural_considerations", e.target.value)}
              placeholder="Any cultural preferences, language needs, or other considerations..."
              className="mt-1"
              rows={2}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-6">
        <div className="flex gap-2">
          {onSaveAndFinishLater && (
            <Button type="button" variant="outline" onClick={() => onSaveAndFinishLater(formData)} className="text-slate-600">
              Save & Finish Later
            </Button>
          )}
        </div>
        
        <div className="flex gap-3">
          {/* Save and Send to Client Button */}
          {canSaveAndSend && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleSaveAndSendToClient}
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <Mail className="w-4 h-4 mr-2" />
              Save & Send to Client
            </Button>
          )}
          
          {/* Continue Button */}
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </form>
  );
}