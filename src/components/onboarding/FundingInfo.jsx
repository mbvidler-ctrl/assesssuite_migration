import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, ArrowLeft, CreditCard, Shield, Heart, HelpCircle, Briefcase, Users, Car, Home } from "lucide-react";

export default function FundingInfo({ data, onNext, onBack, canGoBack, onSaveAndFinishLater }) {
  const [formData, setFormData] = useState({
    funding_source: data.funding_source || "",
    // Other funding fields
    other_funding_source: data.other_funding_source || "",
    other_funding_contact_name: data.other_funding_contact_name || "",
    other_funding_contact_phone: data.other_funding_contact_phone || "",
    other_funding_contact_email: data.other_funding_contact_email || "",
    other_funding_contact_address: data.other_funding_contact_address || "",
    // DVA Fields
    dva_card_number: data.dva_card_number || "",
    dva_file_number: data.dva_file_number || "",
    dva_card_type: data.dva_card_type || "",
    dva_accepted_conditions: data.dva_accepted_conditions || "",
    dva_card_expiry: data.dva_card_expiry || "",
    dva_veteran_status: data.dva_veteran_status || "",
    // Private Health Fields
    private_health_fund_name: data.private_health_fund_name || "",
    private_health_fund_number: data.private_health_fund_number || "",
    private_health_irn: data.private_health_irn || "",
    // Medicare Fields
    medicare_number: data.medicare_number || "",
    medicare_irn: data.medicare_irn || "",
    medicare_expiry: data.medicare_expiry || "",
    medicare_referral_type: data.medicare_referral_type || "",
    medicare_item_number: data.medicare_item_number || "",
    // WorkCover QLD Fields
    workcover_claim_number: data.workcover_claim_number || "",
    workcover_date_of_injury: data.workcover_date_of_injury || "",
    workcover_injury_description: data.workcover_injury_description || "",
    workcover_work_capacity: data.workcover_work_capacity || "",
    workcover_workplace_tasks: data.workcover_workplace_tasks || "",
    workcover_rtw_planning: data.workcover_rtw_planning || "",
    // NDIS Fields
    ndis_number: data.ndis_number || "",
    ndis_goals: data.ndis_goals || "",
    ndis_functional_impact: data.ndis_functional_impact || "",
    ndis_support_recommendations: data.ndis_support_recommendations || "",
    ndis_assistive_tech: data.ndis_assistive_tech || "",
    ndis_risk_factors: data.ndis_risk_factors || "",
    ndis_daily_living_capacity: data.ndis_daily_living_capacity || "",
    // TAC/MAIC Fields
    tac_maic_claim_number: data.tac_maic_claim_number || "",
    tac_maic_injury_description: data.tac_maic_injury_description || "",
    tac_maic_functional_limitations: data.tac_maic_functional_limitations || "",
    // Aged Care Fields (existing)
    aged_care_package_level: data.aged_care_package_level || "",
    aged_care_coordinator_name: data.aged_care_coordinator_name || "",
    aged_care_functional_issues: data.aged_care_functional_issues || "",
    aged_care_home_safety: data.aged_care_home_safety || "",
    // My Aged Care Fields (new)
    my_aged_care_package_level: data.my_aged_care_package_level || "",
    my_aged_care_provider_name: data.my_aged_care_provider_name || "",
    my_aged_care_case_manager: data.my_aged_care_case_manager || "",
    my_aged_care_case_manager_phone: data.my_aged_care_case_manager_phone || "",
    my_aged_care_case_manager_email: data.my_aged_care_case_manager_email || "",
    my_aged_care_functional_goals: data.my_aged_care_functional_goals || "",
    my_aged_care_service_types: data.my_aged_care_service_types || "",
    // GP Fields
    use_referral_source_as_gp: data.use_referral_source_as_gp || false,
    gp_referrer_name: data.gp_referrer_name || "",
    gp_referrer_address: data.gp_referrer_address || "",
    gp_referrer_email: data.gp_referrer_email || "",
    gp_provider_number: data.gp_provider_number || ""
  });

  const [errors, setErrors] = useState({});

  // Auto-populate GP fields when checkbox is checked
  useEffect(() => {
    if (formData.use_referral_source_as_gp && data.referral_source_name) {
      setFormData(prev => ({
        ...prev,
        gp_referrer_name: data.referral_source_name || "",
        gp_provider_number: data.referral_provider_number || ""
      }));
    }
  }, [formData.use_referral_source_as_gp, data.referral_source_name, data.referral_provider_number]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const newErrors = {};
    if (!formData.funding_source) newErrors.funding_source = "Funding source is required";

    // Validate based on funding source
    if (formData.funding_source === "dva") {
      if (!formData.dva_card_number) newErrors.dva_card_number = "DVA card number is required";
      if (!formData.dva_card_type) newErrors.dva_card_type = "DVA card type is required";
    } else if (formData.funding_source === "private_health") {
      if (!formData.private_health_fund_name) newErrors.private_health_fund_name = "Fund name is required";
      if (!formData.private_health_fund_number) newErrors.private_health_fund_number = "Member number is required";
    } else if (formData.funding_source === "medicare") {
      if (!formData.medicare_number) newErrors.medicare_number = "Medicare number is required";
      if (!formData.medicare_referral_type) newErrors.medicare_referral_type = "Referral type is required";
      if (!formData.use_referral_source_as_gp && !formData.gp_referrer_name) {
        newErrors.gp_referrer_name = "GP referrer name is required";
      }
    } else if (formData.funding_source === "workcover_qld") {
      if (!formData.workcover_claim_number) newErrors.workcover_claim_number = "Claim number is required";
      if (!formData.workcover_date_of_injury) newErrors.workcover_date_of_injury = "Date of injury is required";
      if (!formData.workcover_injury_description) newErrors.workcover_injury_description = "Injury description is required";
    } else if (formData.funding_source === "ndis") {
      if (!formData.ndis_number) newErrors.ndis_number = "NDIS number is required";
      if (!formData.ndis_goals) newErrors.ndis_goals = "NDIS goals are required";
    } else if (formData.funding_source === "tac_maic") {
      if (!formData.tac_maic_claim_number) newErrors.tac_maic_claim_number = "Claim number is required";
      if (!formData.tac_maic_injury_description) newErrors.tac_maic_injury_description = "Injury description is required";
    } else if (formData.funding_source === "aged_care") {
      if (!formData.aged_care_functional_issues) newErrors.aged_care_functional_issues = "Functional issues are required";
    } else if (formData.funding_source === "other") {
      if (!formData.other_funding_source) newErrors.other_funding_source = "Please specify the funding source";
      if (!formData.other_funding_contact_name) newErrors.other_funding_contact_name = "Contact name is required";
    }
    // No specific required fields for my_aged_care in the outline, so no additional validation here for now.

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onNext(formData);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const renderFundingFields = () => {
    switch (formData.funding_source) {
      case "dva":
        return (
          <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-green-600" />
              <h4 className="font-medium text-green-800">DVA Information</h4>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dva_card_number" className="text-sm font-medium text-slate-700">
                  DVA Card Number *
                </Label>
                <Input
                  id="dva_card_number"
                  value={formData.dva_card_number}
                  onChange={(e) => handleChange("dva_card_number", e.target.value)}
                  placeholder="Enter DVA card number"
                  className={`mt-1 ${errors.dva_card_number ? "border-red-500" : ""}`}
                />
                {errors.dva_card_number && (
                  <p className="text-red-500 text-sm mt-1">{errors.dva_card_number}</p>
                )}
              </div>

              <div>
                <Label htmlFor="dva_file_number" className="text-sm font-medium text-slate-700">
                  DVA File Number
                </Label>
                <Input
                  id="dva_file_number"
                  value={formData.dva_file_number}
                  onChange={(e) => handleChange("dva_file_number", e.target.value)}
                  placeholder="Enter DVA file number"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">
                DVA Card Type *
              </Label>
              <Select value={formData.dva_card_type} onValueChange={(value) => handleChange("dva_card_type", value)}>
                <SelectTrigger className={`mt-1 ${errors.dva_card_type ? "border-red-500" : ""}`}>
                  <SelectValue placeholder="Select card type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="white">White Card</SelectItem>
                  <SelectItem value="gold">Gold Card</SelectItem>
                  <SelectItem value="gold_tpi">Gold Card (TPI)</SelectItem>
                </SelectContent>
              </Select>
              {errors.dva_card_type && (
                <p className="text-red-500 text-sm mt-1">{errors.dva_card_type}</p>
              )}
            </div>

            <div>
              <Label htmlFor="dva_accepted_conditions" className="text-sm font-medium text-slate-700">
                DVA Accepted Conditions
              </Label>
              <Textarea
                id="dva_accepted_conditions"
                value={formData.dva_accepted_conditions}
                onChange={(e) => handleChange("dva_accepted_conditions", e.target.value)}
                placeholder="List accepted conditions"
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dva_card_expiry" className="text-sm font-medium text-slate-700">
                  Card Expiry Date
                </Label>
                <Input
                  id="dva_card_expiry"
                  type="date"
                  value={formData.dva_card_expiry}
                  onChange={(e) => handleChange("dva_card_expiry", e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="dva_veteran_status" className="text-sm font-medium text-slate-700">
                  Veteran Status/Service Background
                </Label>
                <Input
                  id="dva_veteran_status"
                  value={formData.dva_veteran_status}
                  onChange={(e) => handleChange("dva_veteran_status", e.target.value)}
                  placeholder="e.g., Army, Navy, Air Force"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        );

      case "workcover_qld":
        return (
          <div className="space-y-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2 mb-3">
              <Briefcase className="w-5 h-5 text-orange-600" />
              <h4 className="font-medium text-orange-800">WorkCover QLD Information</h4>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="workcover_claim_number" className="text-sm font-medium text-slate-700">
                  Claim Number *
                </Label>
                <Input
                  id="workcover_claim_number"
                  value={formData.workcover_claim_number}
                  onChange={(e) => handleChange("workcover_claim_number", e.target.value)}
                  placeholder="WorkCover claim number"
                  className={`mt-1 ${errors.workcover_claim_number ? "border-red-500" : ""}`}
                />
                {errors.workcover_claim_number && (
                  <p className="text-red-500 text-sm mt-1">{errors.workcover_claim_number}</p>
                )}
              </div>

              <div>
                <Label htmlFor="workcover_date_of_injury" className="text-sm font-medium text-slate-700">
                  Date of Injury *
                </Label>
                <Input
                  id="workcover_date_of_injury"
                  type="date"
                  value={formData.workcover_date_of_injury}
                  onChange={(e) => handleChange("workcover_date_of_injury", e.target.value)}
                  className={`mt-1 ${errors.workcover_date_of_injury ? "border-red-500" : ""}`}
                />
                {errors.workcover_date_of_injury && (
                  <p className="text-red-500 text-sm mt-1">{errors.workcover_date_of_injury}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="workcover_injury_description" className="text-sm font-medium text-slate-700">
                Injury Description *
              </Label>
              <Textarea
                id="workcover_injury_description"
                value={formData.workcover_injury_description}
                onChange={(e) => handleChange("workcover_injury_description", e.target.value)}
                placeholder="Describe the workplace injury and body parts affected"
                className={`mt-1 ${errors.workcover_injury_description ? "border-red-500" : ""}`}
                rows={3}
              />
              {errors.workcover_injury_description && (
                <p className="text-red-500 text-sm mt-1">{errors.workcover_injury_description}</p>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">
                Work Capacity/Fitness Status
              </Label>
              <Select value={formData.workcover_work_capacity} onValueChange={(value) => handleChange("workcover_work_capacity", value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select work fitness status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fit">Fit for Work</SelectItem>
                  <SelectItem value="modified">Modified Duties</SelectItem>
                  <SelectItem value="not_fit">Not Fit for Work</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="workcover_workplace_tasks" className="text-sm font-medium text-slate-700">
                Workplace Tasks & Limitations
              </Label>
              <Textarea
                id="workcover_workplace_tasks"
                value={formData.workcover_workplace_tasks}
                onChange={(e) => handleChange("workcover_workplace_tasks", e.target.value)}
                placeholder="Include lifting capacity, walking, standing, specific job tasks..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="workcover_rtw_planning" className="text-sm font-medium text-slate-700">
                Return to Work Planning
              </Label>
              <Textarea
                id="workcover_rtw_planning"
                value={formData.workcover_rtw_planning}
                onChange={(e) => handleChange("workcover_rtw_planning", e.target.value)}
                placeholder="Return to work goals, timeline, and recommendations..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        );

      case "ndis":
        return (
          <div className="space-y-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-indigo-600" />
              <h4 className="font-medium text-indigo-800">NDIS Information</h4>
            </div>
            
            <div>
              <Label htmlFor="ndis_number" className="text-sm font-medium text-slate-700">
                NDIS Number *
              </Label>
              <Input
                id="ndis_number"
                value={formData.ndis_number}
                onChange={(e) => handleChange("ndis_number", e.target.value)}
                placeholder="NDIS participant number"
                className={`mt-1 ${errors.ndis_number ? "border-red-500" : ""}`}
              />
              {errors.ndis_number && (
                <p className="text-red-500 text-sm mt-1">{errors.ndis_number}</p>
              )}
            </div>

            <div>
              <Label htmlFor="ndis_goals" className="text-sm font-medium text-slate-700">
                NDIS Participant Goals *
              </Label>
              <Textarea
                id="ndis_goals"
                value={formData.ndis_goals}
                onChange={(e) => handleChange("ndis_goals", e.target.value)}
                placeholder="Goals from NDIS plan that align with this service"
                className={`mt-1 ${errors.ndis_goals ? "border-red-500" : ""}`}
                rows={3}
              />
              {errors.ndis_goals && (
                <p className="text-red-500 text-sm mt-1">{errors.ndis_goals}</p>
              )}
            </div>

            <div>
              <Label htmlFor="ndis_functional_impact" className="text-sm font-medium text-slate-700">
                Functional Impact of Disability
              </Label>
              <Textarea
                id="ndis_functional_impact"
                value={formData.ndis_functional_impact}
                onChange={(e) => handleChange("ndis_functional_impact", e.target.value)}
                placeholder="Describe functional limitations across different domains"
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="ndis_support_recommendations" className="text-sm font-medium text-slate-700">
                Support Recommendations
              </Label>
              <Textarea
                id="ndis_support_recommendations"
                value={formData.ndis_support_recommendations}
                onChange={(e) => handleChange("ndis_support_recommendations", e.target.value)}
                placeholder="Frequency, type, and duration of recommended supports"
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="ndis_assistive_tech" className="text-sm font-medium text-slate-700">
                Assistive Technology/Home Modifications
              </Label>
              <Textarea
                id="ndis_assistive_tech"
                value={formData.ndis_assistive_tech}
                onChange={(e) => handleChange("ndis_assistive_tech", e.target.value)}
                placeholder="Any AT or home modification recommendations"
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="ndis_risk_factors" className="text-sm font-medium text-slate-700">
                Risk Factors & Safety Concerns
              </Label>
              <Textarea
                id="ndis_risk_factors"
                value={formData.ndis_risk_factors}
                onChange={(e) => handleChange("ndis_risk_factors", e.target.value)}
                placeholder="Falls risk, behavioral concerns, safety issues..."
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="ndis_daily_living_capacity" className="text-sm font-medium text-slate-700">
                Daily Living Capacity Comments
              </Label>
              <Textarea
                id="ndis_daily_living_capacity"
                value={formData.ndis_daily_living_capacity}
                onChange={(e) => handleChange("ndis_daily_living_capacity", e.target.value)}
                placeholder="Comments on capacity for daily living activities"
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
        );

      case "tac_maic":
        return (
          <div className="space-y-4 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-3">
              <Car className="w-5 h-5 text-red-600" />
              <h4 className="font-medium text-red-800">TAC/MAIC Information</h4>
            </div>
            
            <div>
              <Label htmlFor="tac_maic_claim_number" className="text-sm font-medium text-slate-700">
                Claim Number *
              </Label>
              <Input
                id="tac_maic_claim_number"
                value={formData.tac_maic_claim_number}
                onChange={(e) => handleChange("tac_maic_claim_number", e.target.value)}
                placeholder="TAC/MAIC claim number"
                className={`mt-1 ${errors.tac_maic_claim_number ? "border-red-500" : ""}`}
              />
              {errors.tac_maic_claim_number && (
                <p className="text-red-500 text-sm mt-1">{errors.tac_maic_claim_number}</p>
              )}
            </div>

            <div>
              <Label htmlFor="tac_maic_injury_description" className="text-sm font-medium text-slate-700">
                Injury Description *
              </Label>
              <Textarea
                id="tac_maic_injury_description"
                value={formData.tac_maic_injury_description}
                onChange={(e) => handleChange("tac_maic_injury_description", e.target.value)}
                placeholder="Describe injuries sustained in motor vehicle accident"
                className={`mt-1 ${errors.tac_maic_injury_description ? "border-red-500" : ""}`}
                rows={3}
              />
              {errors.tac_maic_injury_description && (
                <p className="text-red-500 text-sm mt-1">{errors.tac_maic_injury_description}</p>
              )}
            </div>

            <div>
              <Label htmlFor="tac_maic_functional_limitations" className="text-sm font-medium text-slate-700">
                Functional Limitations
              </Label>
              <Textarea
                id="tac_maic_functional_limitations"
                value={formData.tac_maic_functional_limitations}
                onChange={(e) => handleChange("tac_maic_functional_limitations", e.target.value)}
                placeholder="Current functional limitations related to the injury"
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        );

      case "aged_care":
        return (
          <div className="space-y-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <Home className="w-5 h-5 text-amber-600" />
              <h4 className="font-medium text-amber-800">Aged Care Information</h4>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Home Care Package Level
                </Label>
                <Select value={formData.aged_care_package_level} onValueChange={(value) => handleChange("aged_care_package_level", value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select package level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1</SelectItem>
                    <SelectItem value="2">Level 2</SelectItem>
                    <SelectItem value="3">Level 3</SelectItem>
                    <SelectItem value="4">Level 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="aged_care_coordinator_name" className="text-sm font-medium text-slate-700">
                  Care Coordinator/Case Manager
                </Label>
                <Input
                  id="aged_care_coordinator_name"
                  value={formData.aged_care_coordinator_name}
                  onChange={(e) => handleChange("aged_care_coordinator_name", e.target.value)}
                  placeholder="Name of care coordinator"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="aged_care_functional_issues" className="text-sm font-medium text-slate-700">
                Functional Issues & Mobility Concerns *
              </Label>
              <Textarea
                id="aged_care_functional_issues"
                value={formData.aged_care_functional_issues}
                onChange={(e) => handleChange("aged_care_functional_issues", e.target.value)}
                placeholder="Mobility, balance, ADLs, falls risk..."
                className={`mt-1 ${errors.aged_care_functional_issues ? "border-red-500" : ""}`}
                rows={3}
              />
              {errors.aged_care_functional_issues && (
                <p className="text-red-500 text-sm mt-1">{errors.aged_care_functional_issues}</p>
              )}
            </div>

            <div>
              <Label htmlFor="aged_care_home_safety" className="text-sm font-medium text-slate-700">
                Home Safety Observations
              </Label>
              <Textarea
                id="aged_care_home_safety"
                value={formData.aged_care_home_safety}
                onChange={(e) => handleChange("aged_care_home_safety", e.target.value)}
                placeholder="Falls hazards, trip hazards, space considerations..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        );

      case "my_aged_care":
        return (
          <div className="space-y-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="flex items-center gap-2 mb-3">
              <Home className="w-5 h-5 text-indigo-600" />
              <h4 className="font-medium text-indigo-800">My Aged Care Information</h4>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Home Care Package Level
                </Label>
                <Select value={formData.my_aged_care_package_level} onValueChange={(value) => handleChange("my_aged_care_package_level", value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select package level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1</SelectItem>
                    <SelectItem value="2">Level 2</SelectItem>
                    <SelectItem value="3">Level 3</SelectItem>
                    <SelectItem value="4">Level 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="my_aged_care_provider_name" className="text-sm font-medium text-slate-700">
                  My Aged Care Provider Organization
                </Label>
                <Input
                  id="my_aged_care_provider_name"
                  value={formData.my_aged_care_provider_name}
                  onChange={(e) => handleChange("my_aged_care_provider_name", e.target.value)}
                  placeholder="Name of My Aged Care provider"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="my_aged_care_case_manager" className="text-sm font-medium text-slate-700">
                Case Manager/Coordinator Name
              </Label>
              <Input
                id="my_aged_care_case_manager"
                value={formData.my_aged_care_case_manager}
                onChange={(e) => handleChange("my_aged_care_case_manager", e.target.value)}
                placeholder="Name of case manager/coordinator"
                className="mt-1"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="my_aged_care_case_manager_phone" className="text-sm font-medium text-slate-700">
                  Case Manager Phone
                </Label>
                <Input
                  id="my_aged_care_case_manager_phone"
                  type="tel"
                  value={formData.my_aged_care_case_manager_phone}
                  onChange={(e) => handleChange("my_aged_care_case_manager_phone", e.target.value)}
                  placeholder="Case manager phone number"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="my_aged_care_case_manager_email" className="text-sm font-medium text-slate-700">
                  Case Manager Email
                </Label>
                <Input
                  id="my_aged_care_case_manager_email"
                  type="email"
                  value={formData.my_aged_care_case_manager_email}
                  onChange={(e) => handleChange("my_aged_care_case_manager_email", e.target.value)}
                  placeholder="Case manager email"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="my_aged_care_functional_goals" className="text-sm font-medium text-slate-700">
                Functional Goals from My Aged Care Plan
              </Label>
              <Textarea
                id="my_aged_care_functional_goals"
                value={formData.my_aged_care_functional_goals}
                onChange={(e) => handleChange("my_aged_care_functional_goals", e.target.value)}
                placeholder="Goals and outcomes from My Aged Care assessment"
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="my_aged_care_service_types" className="text-sm font-medium text-slate-700">
                Approved Service Types
              </Label>
              <Textarea
                id="my_aged_care_service_types"
                value={formData.my_aged_care_service_types}
                onChange={(e) => handleChange("my_aged_care_service_types", e.target.value)}
                placeholder="Types of services approved under My Aged Care package"
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
        );

      case "private_health":
        return (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-5 h-5 text-blue-600" />
              <h4 className="font-medium text-blue-800">Private Health Insurance</h4>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="private_health_fund_name" className="text-sm font-medium text-slate-700">
                  Health Fund Name *
                </Label>
                <Input
                  id="private_health_fund_name"
                  value={formData.private_health_fund_name}
                  onChange={(e) => handleChange("private_health_fund_name", e.target.value)}
                  placeholder="e.g., Medibank, BUPA, HCF"
                  className={`mt-1 ${errors.private_health_fund_name ? "border-red-500" : ""}`}
                />
                {errors.private_health_fund_name && (
                  <p className="text-red-500 text-sm mt-1">{errors.private_health_fund_name}</p>
                )}
              </div>

              <div>
                <Label htmlFor="private_health_fund_number" className="text-sm font-medium text-slate-700">
                  Member Number *
                </Label>
                <Input
                  id="private_health_fund_number"
                  value={formData.private_health_fund_number}
                  onChange={(e) => handleChange("private_health_fund_number", e.target.value)}
                  placeholder="Enter member number"
                  className={`mt-1 ${errors.private_health_fund_number ? "border-red-500" : ""}`}
                />
                {errors.private_health_fund_number && (
                  <p className="text-red-500 text-sm mt-1">{errors.private_health_fund_number}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="private_health_irn" className="text-sm font-medium text-slate-700">
                IRN (Individual Reference Number)
              </Label>
              <Input
                id="private_health_irn"
                value={formData.private_health_irn}
                onChange={(e) => handleChange("private_health_irn", e.target.value)}
                placeholder="IRN on health fund card"
                className="mt-1"
              />
            </div>
          </div>
        );

      case "medicare":
        return (
          <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-5 h-5 text-purple-600" />
              <h4 className="font-medium text-purple-800">Medicare Information</h4>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="medicare_number" className="text-sm font-medium text-slate-700">
                  Medicare Number *
                </Label>
                <Input
                  id="medicare_number"
                  value={formData.medicare_number}
                  onChange={(e) => handleChange("medicare_number", e.target.value)}
                  placeholder="Medicare card number"
                  className={`mt-1 ${errors.medicare_number ? "border-red-500" : ""}`}
                />
                {errors.medicare_number && (
                  <p className="text-red-500 text-sm mt-1">{errors.medicare_number}</p>
                )}
              </div>

              <div>
                <Label htmlFor="medicare_irn" className="text-sm font-medium text-slate-700">
                  IRN
                </Label>
                <Input
                  id="medicare_irn"
                  value={formData.medicare_irn}
                  onChange={(e) => handleChange("medicare_irn", e.target.value)}
                  placeholder="IRN on Medicare card"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="medicare_expiry" className="text-sm font-medium text-slate-700">
                  Expiry Date
                </Label>
                <Input
                  id="medicare_expiry"
                  type="date"
                  value={formData.medicare_expiry}
                  onChange={(e) => handleChange("medicare_expiry", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Referral Type *
                </Label>
                <Select value={formData.medicare_referral_type} onValueChange={(value) => handleChange("medicare_referral_type", value)}>
                  <SelectTrigger className={`mt-1 ${errors.medicare_referral_type ? "border-red-500" : ""}`}>
                    <SelectValue placeholder="Select referral type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tca">Team Care Arrangement (TCA)</SelectItem>
                    <SelectItem value="epc">Enhanced Primary Care (EPC)</SelectItem>
                    <SelectItem value="cdm">Chronic Disease Management (CDM)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.medicare_referral_type && (
                  <p className="text-red-500 text-sm mt-1">{errors.medicare_referral_type}</p>
                )}
              </div>

              <div>
                <Label htmlFor="medicare_item_number" className="text-sm font-medium text-slate-700">
                  Medicare Item Number
                </Label>
                <Input
                  id="medicare_item_number"
                  value={formData.medicare_item_number}
                  onChange={(e) => handleChange("medicare_item_number", e.target.value)}
                  placeholder="e.g., 10953"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-slate-900">GP Referrer Information</h5>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="use_referral_source_as_gp"
                    checked={formData.use_referral_source_as_gp}
                    onCheckedChange={(checked) => handleChange("use_referral_source_as_gp", checked)}
                  />
                  <Label 
                    htmlFor="use_referral_source_as_gp" 
                    className="text-sm font-medium cursor-pointer"
                  >
                    Same as referral source
                  </Label>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gp_referrer_name" className="text-sm font-medium text-slate-700">
                    GP Name *
                  </Label>
                  <Input
                    id="gp_referrer_name"
                    value={formData.gp_referrer_name}
                    onChange={(e) => handleChange("gp_referrer_name", e.target.value)}
                    placeholder="GP who made referral"
                    className={`mt-1 ${errors.gp_referrer_name ? "border-red-500" : ""}`}
                    disabled={formData.use_referral_source_as_gp}
                  />
                  {errors.gp_referrer_name && (
                    <p className="text-red-500 text-sm mt-1">{errors.gp_referrer_name}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="gp_provider_number" className="text-sm font-medium text-slate-700">
                    GP Provider Number
                  </Label>
                  <Input
                    id="gp_provider_number"
                    value={formData.gp_provider_number}
                    onChange={(e) => handleChange("gp_provider_number", e.target.value)}
                    placeholder="GP provider number"
                    className="mt-1"
                    disabled={formData.use_referral_source_as_gp}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="gp_referrer_address" className="text-sm font-medium text-slate-700">
                  GP/Clinic Address
                </Label>
                <Textarea
                  id="gp_referrer_address"
                  value={formData.gp_referrer_address}
                  onChange={(e) => handleChange("gp_referrer_address", e.target.value)}
                  placeholder="GP practice/clinic address"
                  className="mt-1"
                  rows={3}
                  disabled={formData.use_referral_source_as_gp}
                />
              </div>

              <div>
                <Label htmlFor="gp_referrer_email" className="text-sm font-medium text-slate-700">
                  GP/Clinic Email
                </Label>
                <Input
                  id="gp_referrer_email"
                  type="email"
                  value={formData.gp_referrer_email}
                  onChange={(e) => handleChange("gp_referrer_email", e.target.value)}
                  placeholder="GP practice email"
                  className="mt-1"
                  disabled={formData.use_referral_source_as_gp}
                />
              </div>
            </div>
          </div>
        );

      case "other":
        return (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="w-5 h-5 text-gray-600" />
              <h4 className="font-medium text-gray-800">Other Funding Source</h4>
            </div>
            
            <div>
              <Label htmlFor="other_funding_source" className="text-sm font-medium text-slate-700">
                Funding Source Description *
              </Label>
              <Input
                id="other_funding_source"
                value={formData.other_funding_source}
                onChange={(e) => handleChange("other_funding_source", e.target.value)}
                placeholder="e.g., Workers Compensation, Motor Vehicle Insurance, etc."
                className={`mt-1 ${errors.other_funding_source ? "border-red-500" : ""}`}
              />
              {errors.other_funding_source && (
                <p className="text-red-500 text-sm mt-1">{errors.other_funding_source}</p>
              )}
            </div>

            <div className="space-y-4 border-t pt-4">
              <h5 className="font-medium text-slate-900">Contact Information</h5>
              
              <div>
                <Label htmlFor="other_funding_contact_name" className="text-sm font-medium text-slate-700">
                  Contact Name *
                </Label>
                <Input
                  id="other_funding_contact_name"
                  value={formData.other_funding_contact_name}
                  onChange={(e) => handleChange("other_funding_contact_name", e.target.value)}
                  placeholder="Name of contact person"
                  className={`mt-1 ${errors.other_funding_contact_name ? "border-red-500" : ""}`}
                />
                {errors.other_funding_contact_name && (
                  <p className="text-red-500 text-sm mt-1">{errors.other_funding_contact_name}</p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="other_funding_contact_phone" className="text-sm font-medium text-slate-700">
                    Contact Phone
                  </Label>
                  <Input
                    id="other_funding_contact_phone"
                    type="tel"
                    value={formData.other_funding_contact_phone}
                    onChange={(e) => handleChange("other_funding_contact_phone", e.target.value)}
                    placeholder="Contact phone number"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="other_funding_contact_email" className="text-sm font-medium text-slate-700">
                    Contact Email
                  </Label>
                  <Input
                    id="other_funding_contact_email"
                    type="email"
                    value={formData.other_funding_contact_email}
                    onChange={(e) => handleChange("other_funding_contact_email", e.target.value)}
                    placeholder="Contact email address"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="other_funding_contact_address" className="text-sm font-medium text-slate-700">
                  Contact Address
                </Label>
                <Textarea
                  id="other_funding_contact_address"
                  value={formData.other_funding_contact_address}
                  onChange={(e) => handleChange("other_funding_contact_address", e.target.value)}
                  placeholder="Contact address"
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Session Funding</h3>
        
        <div>
          <Label className="text-sm font-medium text-slate-700">
            Who is funding these sessions? *
          </Label>
          <Select value={formData.funding_source} onValueChange={(value) => handleChange("funding_source", value)}>
            <SelectTrigger className={`mt-1 ${errors.funding_source ? "border-red-500" : ""}`}>
              <SelectValue placeholder="Select funding source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dva">Department of Veterans' Affairs (DVA)</SelectItem>
              <SelectItem value="private_health">Private Health Insurance</SelectItem>
              <SelectItem value="medicare">Medicare</SelectItem>
              <SelectItem value="workcover_qld">WorkCover QLD</SelectItem>
              <SelectItem value="ndis">NDIS</SelectItem>
              <SelectItem value="tac_maic">TAC/MAIC</SelectItem>
              <SelectItem value="aged_care">Aged Care (HCP/STRC)</SelectItem>
              <SelectItem value="my_aged_care">My Aged Care</SelectItem>
              <SelectItem value="self_funded">Self Funded</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {errors.funding_source && (
            <p className="text-red-500 text-sm mt-1">{errors.funding_source}</p>
          )}
        </div>

        {renderFundingFields()}
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