import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { base44 } from "@/api/base44Client";
import { UploadFile } from "@/integrations/Core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  User as UserIcon, 
  Building, 
  Phone, 
  Mail, 
  MapPin, 
  FileText,
  Upload,
  X,
  Plus,
  Save,
  Loader2,
  Star,
  Trash2,
  LogOut
} from "lucide-react";
import { Toaster, toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClinicPolicies from "../components/settings/ClinicPolicies";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function MyProfile() {
  const [user, setUser] = useState(null);
  const [userOrgId, setUserOrgId] = useState(null);
  const [formData, setFormData] = useState({
    clinician_name: "",
    profession: "",
    qualifications: "",
    professional_bio: "",
    registration_number: "",
    country: "australia",
    npi_number: "",
    abn: "",
    specializations: [],
    locations: []
  });
  const [newSpecialization, setNewSpecialization] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  const handleDeactivateAccount = () => setShowDeactivateDialog(true);

  const confirmDeactivate = async () => {
    setShowDeactivateDialog(false);
    setIsDeactivating(true);
    try {
      const result = await base44.functions.invoke("deactivateAccount", {});
      const payload = result?.data ?? result;
      if (payload?.status !== "deactivated") {
        throw new Error(payload?.error || "Deactivation failed");
      }
      base44.auth.logout(window.location.origin + "/");
    } catch (error) {
      console.error("Deactivation failed", error);
      toast.error("Failed to deactivate your account. Please try again or contact support.");
      setIsDeactivating(false);
    }
  };
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [uploadingLocationId, setUploadingLocationId] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      const userData = await User.me();
      setUser(userData);
      
      // Get user's organization ID
      const orgMemberships = await base44.entities.OrganizationMember.filter({ user_email: userData.email });
      if (orgMemberships.length > 0) {
        setUserOrgId(orgMemberships[0].org_id);
      }
      
      // Migrate old data structure to new if needed
      let locations = userData.locations || [];
      if (locations.length === 0 && userData.clinic_name) {
        // Migrate old single location to new structure
        locations = [{
          id: Date.now().toString(),
          clinic_name: userData.clinic_name || "",
          clinic_address: userData.clinic_address || "",
          clinic_phone: userData.clinic_phone || "",
          clinic_email: userData.clinic_email || "",
          provider_number: userData.provider_number || "",
          clinic_logo_url: userData.clinic_logo_url || "",
          is_main: true
        }];
      }
      
      setFormData({
        clinician_name: userData.clinician_name || userData.full_name || "",
        profession: userData.profession || "",
        qualifications: userData.qualifications || "",
        professional_bio: userData.professional_bio || "",
        registration_number: userData.registration_number || "",
        country: userData.country || "australia",
        npi_number: userData.npi_number || "",
        abn: userData.abn || "",
        specializations: userData.specializations || [],
        locations: locations
      });
    } catch (error) {
      console.error("Error loading user data:", error);
      toast.error("Failed to load profile data.");
    }
    setIsLoading(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLocationChange = (locationId, field, value) => {
    setFormData(prev => ({
      ...prev,
      locations: prev.locations.map(loc => 
        loc.id === locationId ? { ...loc, [field]: value } : loc
      )
    }));
  };

  const addLocation = () => {
    const newLocation = {
      id: Date.now().toString(),
      clinic_name: "",
      clinic_address: "",
      clinic_phone: "",
      clinic_email: "",
      provider_number: "",
      clinic_logo_url: "",
      is_main: formData.locations.length === 0
    };
    setFormData(prev => ({
      ...prev,
      locations: [...prev.locations, newLocation]
    }));
  };

  const removeLocation = (locationId) => {
    const locationToRemove = formData.locations.find(loc => loc.id === locationId);
    if (locationToRemove?.is_main && formData.locations.length > 1) {
      toast.error("Cannot remove main location. Please set another location as main first.");
      return;
    }
    setFormData(prev => ({
      ...prev,
      locations: prev.locations.filter(loc => loc.id !== locationId)
    }));
  };

  const setMainLocation = (locationId) => {
    setFormData(prev => ({
      ...prev,
      locations: prev.locations.map(loc => ({
        ...loc,
        is_main: loc.id === locationId
      }))
    }));
  };

  const handleLogoUpload = async (event, locationId) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploadingLogo(true);
    setUploadingLocationId(locationId);
    try {
      const { file_url } = await UploadFile({ file });
      handleLocationChange(locationId, 'clinic_logo_url', file_url);
      toast.success("Logo uploaded successfully!");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Failed to upload logo.");
    }
    setIsUploadingLogo(false);
    setUploadingLocationId(null);
  };

  const addSpecialization = () => {
    if (newSpecialization.trim() && !formData.specializations.includes(newSpecialization.trim())) {
      setFormData(prev => ({
        ...prev,
        specializations: [...prev.specializations, newSpecialization.trim()]
      }));
      setNewSpecialization("");
    }
  };

  const removeSpecialization = (specialization) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.filter(s => s !== specialization)
    }));
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/functions/createPortalSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripeCustomerId: user?.stripe_customer_id })
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Unable to open subscription portal. Please contact support.');
      }
    } catch (err) {
      alert('Something went wrong. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const mainLocation = formData.locations.find(loc => loc.is_main);
      const dataToSave = {
        ...formData,
        main_location_id: mainLocation?.id || formData.locations[0]?.id
      };
      
      await User.updateMyUserData(dataToSave);
      toast.success("Profile updated successfully!");
      await loadUserData();
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile changes.");
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6 flex justify-center items-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
              <UserIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
              <p className="text-slate-600">Manage your professional details and clinic information</p>
            </div>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="bg-white/80 backdrop-blur-sm">
              <TabsTrigger value="profile">Profile & Locations</TabsTrigger>
              <TabsTrigger value="policies">Policies & Consent Forms</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
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
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="clinician_name" className="text-sm font-medium text-slate-700">Clinician Name (for Reports)</Label>
                    <Input
                      id="clinician_name"
                      value={formData.clinician_name}
                      onChange={(e) => handleInputChange("clinician_name", e.target.value)}
                      className="mt-1"
                      placeholder="e.g., Dr. Jane Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="profession" className="text-sm font-medium text-slate-700">Profession</Label>
                     <Select
                      value={formData.profession}
                      onValueChange={(value) => handleInputChange("profession", value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select your profession" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Exercise Physiologist">Exercise Physiologist</SelectItem>
                        <SelectItem value="Exercise Scientist">Exercise Scientist</SelectItem>
                        <SelectItem value="Dual Exercise Scientist & Exercise Physiologist">Dual Exercise Scientist & Exercise Physiologist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Login Email</Label>
                    <Input
                      value={user?.email || ""}
                      disabled
                      className="mt-1 bg-slate-50"
                    />
                    <p className="text-xs text-slate-500 mt-1">This cannot be changed</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Organization ID</Label>
                    <Input
                      value={userOrgId || "Loading..."}
                      disabled
                      className="mt-1 bg-slate-50 font-mono text-xs"
                    />
                    <p className="text-xs text-slate-500 mt-1">For technical support reference</p>
                  </div>
                </div>

                {/* Show professional fields for all professions */}
                {formData.profession && (
                  <>
                    <div>
                      <Label htmlFor="qualifications" className="text-sm font-medium text-slate-700">
                        Professional Qualifications
                      </Label>
                      <Input
                        id="qualifications"
                        value={formData.qualifications}
                        onChange={(e) => handleInputChange("qualifications", e.target.value)}
                        placeholder="e.g., BSc Exercise Science, MSc Exercise Physiology"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="country" className="text-sm font-medium text-slate-700">Country of Practice</Label>
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

                    {/* Australia */}
                    {(!formData.country || formData.country === "australia") && (
                      <>
                        <div>
                          <Label htmlFor="registration_number" className="text-sm font-medium text-slate-700">AHPRA Registration Number</Label>
                          <Input id="registration_number" value={formData.registration_number} onChange={(e) => handleInputChange("registration_number", e.target.value)} placeholder="e.g. EPH0001234" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="abn" className="text-sm font-medium text-slate-700">ABN</Label>
                          <Input id="abn" value={formData.abn} onChange={(e) => handleInputChange("abn", e.target.value)} placeholder="e.g. 12 345 678 901" className="mt-1" />
                        </div>
                      </>
                    )}
                    {formData.country === "usa" && (
                      <>
                        <div>
                          <Label htmlFor="npi_number" className="text-sm font-medium text-slate-700">NPI Number (Individual)</Label>
                          <Input id="npi_number" value={formData.npi_number} onChange={(e) => handleInputChange("npi_number", e.target.value)} placeholder="10-digit NPI" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="registration_number" className="text-sm font-medium text-slate-700">ACSM Certification Number</Label>
                          <Input id="registration_number" value={formData.registration_number} onChange={(e) => handleInputChange("registration_number", e.target.value)} placeholder="ACSM-EP or ACSM-CEP number" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="abn" className="text-sm font-medium text-slate-700">Tax ID / EIN</Label>
                          <Input id="abn" value={formData.abn} onChange={(e) => handleInputChange("abn", e.target.value)} placeholder="Federal Tax ID / EIN" className="mt-1" />
                        </div>
                      </>
                    )}
                    {formData.country === "canada" && (
                      <>
                        <div>
                          <Label htmlFor="registration_number" className="text-sm font-medium text-slate-700">CSEP-CEP Certification Number</Label>
                          <Input id="registration_number" value={formData.registration_number} onChange={(e) => handleInputChange("registration_number", e.target.value)} placeholder="CSEP certification number" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="abn" className="text-sm font-medium text-slate-700">GST/HST Number</Label>
                          <Input id="abn" value={formData.abn} onChange={(e) => handleInputChange("abn", e.target.value)} placeholder="Business GST/HST number" className="mt-1" />
                        </div>
                      </>
                    )}
                    {formData.country === "nz" && (
                      <>
                        <div>
                          <Label htmlFor="npi_number" className="text-sm font-medium text-slate-700">HPI Number (Health Provider Index)</Label>
                          <Input id="npi_number" value={formData.npi_number} onChange={(e) => handleInputChange("npi_number", e.target.value)} placeholder="HPI number" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="registration_number" className="text-sm font-medium text-slate-700">CEPNZ Membership Number</Label>
                          <Input id="registration_number" value={formData.registration_number} onChange={(e) => handleInputChange("registration_number", e.target.value)} placeholder="CEPNZ membership number" className="mt-1" />
                        </div>
                      </>
                    )}
                    {formData.country === "uk" && (
                      <>
                        <div>
                          <Label htmlFor="registration_number" className="text-sm font-medium text-slate-700">RCCP / AHCS Registration Number</Label>
                          <Input id="registration_number" value={formData.registration_number} onChange={(e) => handleInputChange("registration_number", e.target.value)} placeholder="RCCP or AHCS number" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="provider_number" className="text-sm font-medium text-slate-700">NHS PIN (if applicable)</Label>
                          <Input id="provider_number" value={formData.provider_number || ""} onChange={(e) => handleInputChange("provider_number", e.target.value)} placeholder="NHS PIN" className="mt-1" />
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
                    className="mt-1"
                    rows={4}
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">Specializations</Label>
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
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Practice Locations */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-blue-600" />
                    Practice Locations
                  </CardTitle>
                  <Button type="button" onClick={addLocation} size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Location
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {formData.locations.length === 0 ? (
                  <div className="text-center py-8">
                    <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 mb-4">No locations added yet</p>
                    <Button type="button" onClick={addLocation} variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Location
                    </Button>
                  </div>
                ) : (
                  formData.locations.map((location, index) => (
                    <div key={location.id} className="p-4 border-2 rounded-lg space-y-4 relative">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">Location {index + 1}</h3>
                          {location.is_main && (
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                              <Star className="w-3 h-3 mr-1" />
                              Main Location
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!location.is_main && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setMainLocation(location.id)}
                            >
                              <Star className="w-3 h-3 mr-1" />
                              Set as Main
                            </Button>
                          )}
                          {formData.locations.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLocation(location.id)}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-slate-700">Clinic Name *</Label>
                        <Input
                          value={location.clinic_name}
                          onChange={(e) => handleLocationChange(location.id, 'clinic_name', e.target.value)}
                          placeholder="Your clinic or practice name"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-slate-700">Clinic Address *</Label>
                        <Textarea
                          value={location.clinic_address}
                          onChange={(e) => handleLocationChange(location.id, 'clinic_address', e.target.value)}
                          placeholder="Full clinic address"
                          className="mt-1"
                          rows={3}
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-slate-700">Clinic Phone</Label>
                          <Input
                            value={location.clinic_phone}
                            onChange={(e) => handleLocationChange(location.id, 'clinic_phone', e.target.value)}
                            placeholder="Clinic phone number"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-slate-700">Clinic Email</Label>
                          <Input
                            type="email"
                            value={location.clinic_email}
                            onChange={(e) => handleLocationChange(location.id, 'clinic_email', e.target.value)}
                            placeholder="Clinic email address"
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-slate-700">Provider Number (for this location)</Label>
                        <Input
                          value={location.provider_number}
                          onChange={(e) => handleLocationChange(location.id, 'provider_number', e.target.value)}
                          placeholder="Provider number for this location"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-slate-700">Clinic Logo</Label>
                        <div className="mt-2 space-y-4">
                          {location.clinic_logo_url && (
                            <div className="flex items-center gap-4">
                              <img
                                src={location.clinic_logo_url}
                                alt="Clinic logo"
                                className="w-16 h-16 object-contain border rounded"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleLocationChange(location.id, 'clinic_logo_url', '')}
                              >
                                <X className="w-4 h-4 mr-2" />
                                Remove Logo
                              </Button>
                            </div>
                          )}
                          <div>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleLogoUpload(e, location.id)}
                              className="hidden"
                              id={`logo-upload-${location.id}`}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById(`logo-upload-${location.id}`).click()}
                              disabled={isUploadingLogo && uploadingLocationId === location.id}
                              className="w-full"
                            >
                              {isUploadingLogo && uploadingLocationId === location.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4 mr-2" />
                              )}
                              {isUploadingLogo && uploadingLocationId === location.id ? "Uploading..." : "Upload Logo"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 px-8"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isSaving ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </form>
            </TabsContent>

            <TabsContent value="policies">
              <ClinicPolicies />
            </TabsContent>
          </Tabs>

          {/* Subscription */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Subscription</h3>
                  <p className="text-sm text-slate-600">Manage your billing and subscription plan</p>
                </div>
                <button onClick={handleManageSubscription} style={{padding:'10px 20px',background:'#f1f5f9',border:'1px solid #e2e8f0',borderRadius:'8px',fontSize:'14px',fontWeight:600,color:'#374151',cursor:'pointer'}}>
                  Manage Subscription
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Logout Button */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Sign Out</h3>
                  <p className="text-sm text-slate-600">Log out of your account</p>
                </div>
                <Button
                  onClick={() => base44.auth.logout(window.location.origin + "/")}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Deactivate account — self-service closure; records are retained
              (never deleted) per the Records Retention policy. */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="py-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900">Deactivate Account</h3>
                  <p className="text-sm text-slate-600">
                    Closes your access to AssessSuite. Your practice's clinical records are
                    retained securely — nothing is deleted — in line with professional
                    record-keeping obligations. Reactivation requires contacting support.
                  </p>
                </div>
                <Button
                  onClick={handleDeactivateAccount}
                  disabled={isDeactivating}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 shrink-0"
                >
                  {isDeactivating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Deactivate
                </Button>
              </div>
            </CardContent>
          </Card>

          <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deactivate your account?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span className="block">
                    You will be signed out and your access closed. Your subscription is not
                    cancelled automatically — cancel it via Manage Subscription first if that
                    is your intention.
                  </span>
                  <span className="block">
                    Your practice's records are retained securely and are not deleted.
                    Reactivation requires contacting admin@assesssuite.com.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeactivate} className="bg-red-600 hover:bg-red-700">
                  Deactivate account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </>
  );
}