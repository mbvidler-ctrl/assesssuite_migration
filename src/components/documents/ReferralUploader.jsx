import React, { useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cancelTenantUploads, extractTenantDocumentData, uploadTenantFile } from '@/lib/fileIntegrations';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileText, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  User,
  Phone,
  Mail,
  CreditCard,
  Stethoscope,
  Target,
  Edit,
  Plus,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import HistoricalAssessmentExtractor from './HistoricalAssessmentExtractor';
import { todayLocal } from "@/lib/localDate";

const REFERRAL_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    // Personal Details
    full_name: { type: "string", description: "Patient's full name" },
    date_of_birth: { type: "string", description: "Date of birth in YYYY-MM-DD format" },
    gender: { type: "string", enum: ["male", "female", "other"], description: "Patient's gender" },
    phone: { type: "string", description: "Contact phone number" },
    email: { type: "string", description: "Email address" },
    address: { type: "string", description: "Home address" },
    
    // Referral Source Details
    referral_source: { 
      type: "string", 
      enum: ["gp", "wc_case_manager", "aged_care_case_manager", "ndis_support_coordinator", "dva", "self_referral", "other"],
      description: "Type of referral source"
    },
    referral_source_name: { type: "string", description: "Name of referring person/organization" },
    referral_source_address: { type: "string", description: "Address of referrer" },
    referral_source_email: { type: "string", description: "Email of referrer" },
    referral_provider_number: { type: "string", description: "Provider number of referring professional" },
    referral_reason: { type: "string", description: "Reason for referral" },
    referral_date: { type: "string", description: "Date of referral in YYYY-MM-DD format" },
    
    // Funding Details
    funding_source: {
      type: "string",
      enum: ["dva", "private_health", "medicare", "self_funded", "workcover_qld", "ndis", "tac_maic", "aged_care", "my_aged_care", "other"],
      description: "Primary funding source"
    },
    medicare_number: { type: "string", description: "Medicare card number" },
    medicare_irn: { type: "string", description: "Medicare IRN" },
    dva_card_number: { type: "string", description: "DVA card number" },
    dva_card_type: { type: "string", enum: ["white", "gold", "gold_tpi"], description: "DVA card type" },
    dva_file_number: { type: "string", description: "DVA file number" },
    dva_accepted_conditions: { type: "string", description: "DVA accepted conditions" },
    ndis_number: { type: "string", description: "NDIS participant number" },
    ndis_goals: { type: "string", description: "NDIS goals from plan" },
    private_health_fund_name: { type: "string", description: "Private health fund name" },
    private_health_fund_number: { type: "string", description: "Private health fund member number" },
    workcover_claim_number: { type: "string", description: "WorkCover claim number" },
    workcover_date_of_injury: { type: "string", description: "Date of workplace injury" },
    workcover_injury_description: { type: "string", description: "Description of workplace injury" },
    
    // Medical Details
    primary_condition: { type: "string", description: "Primary diagnosis or condition" },
    comorbidities: { type: "array", items: { type: "string" }, description: "List of other medical conditions" },
    medications: { type: "array", items: { type: "string" }, description: "Current medications" },
    medical_history: { type: "string", description: "Relevant medical history" },
    
    // GP Details
    primary_gp_name: { type: "string", description: "Primary GP name" },
    primary_gp_clinic_name: { type: "string", description: "GP clinic name" },
    primary_gp_address: { type: "string", description: "GP clinic address" },
    primary_gp_phone: { type: "string", description: "GP clinic phone" },
    primary_gp_email: { type: "string", description: "GP clinic email" },
    primary_gp_provider_number: { type: "string", description: "GP provider number" },
    
    // Goals
    client_goals: { type: "string", description: "Client's goals or referrer's goals for treatment" },
    
    // Referral Type for Reports
    medicare_referral_type: { type: "string", enum: ["tca", "epc", "cdm"], description: "Medicare referral type" }
  }
};

export default function ReferralUploader({ onClientCreated, onClientUpdated, existingClients = [], allAssessments = [] }) {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [matchingClients, setMatchingClients] = useState([]);
  const [selectedExistingClient, setSelectedExistingClient] = useState(null);
  const [extractedConditions, setExtractedConditions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [pendingHistoricalAssessments, setPendingHistoricalAssessments] = useState([]);
  const [organizationOptions, setOrganizationOptions] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [subjectDateOfBirth, setSubjectDateOfBirth] = useState('');
  const [processingAuthorityConfirmed, setProcessingAuthorityConfirmed] = useState(false);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadOrganizations = async () => {
      setIsLoadingOrganizations(true);
      try {
        const currentUser = await base44.auth.me();
        const memberships = await base44.entities.OrganizationMember.filter({ user_email: currentUser.email });
        const options = await Promise.all((memberships || []).map(async (membership) => {
          try {
            const organization = await base44.entities.Organization.get(membership.org_id);
            return {
              id: membership.org_id,
              name: organization?.name || membership.org_id,
              isPrimary: membership.is_primary === true,
            };
          } catch {
            return {
              id: membership.org_id,
              name: membership.org_id,
              isPrimary: membership.is_primary === true,
            };
          }
        }));

        if (cancelled) return;
        setOrganizationOptions(options);
        setSelectedOrgId((current) => {
          if (options.some((option) => option.id === current)) return current;
          return options.length === 1 ? options[0].id : '';
        });
      } catch {
        if (!cancelled) {
          setOrganizationOptions([]);
          setSelectedOrgId('');
          toast.error('Unable to verify your practice membership.');
        }
      } finally {
        if (!cancelled) setIsLoadingOrganizations(false);
      }
    };

    loadOrganizations();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'text/csv'];
    
    const validFiles = selectedFiles.filter(file => {
      if (!validTypes.includes(file.type)) {
        toast.error(`${file.name} is not a valid file type`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      setExtractedData(null);
      setEditedData({});
      setMatchingClients([]);
      setSelectedExistingClient(null);
      setProcessingAuthorityConfirmed(false);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setProcessingAuthorityConfirmed(false);
  };

  const scheduleCancellation = async (filesToCancel = uploadedFiles) => {
    const uploadIds = filesToCancel.map((file) => file.uploadId).filter(Boolean);
    if (!selectedOrgId || uploadIds.length === 0) return;
    await cancelTenantUploads({ org_id: selectedOrgId, upload_ids: uploadIds });
  };

  const handleCancelReview = async () => {
    setShowReviewModal(false);
    try {
      await scheduleCancellation();
      resetForm();
    } catch {
      toast.warning('The review was closed. Temporary files remain scheduled for automatic expiry.');
    }
  };

  const handleOrganizationChange = (nextOrgId) => {
    const previousOrgId = selectedOrgId;
    const uploadIds = uploadedFiles.map((file) => file.uploadId).filter(Boolean);
    if (previousOrgId && uploadIds.length > 0) {
      void cancelTenantUploads({ org_id: previousOrgId, upload_ids: uploadIds }).catch(() => {
        toast.warning('Temporary files from the previous practice remain scheduled for automatic expiry.');
      });
    }
    resetForm();
    setShowReviewModal(false);
    setSelectedOrgId(nextOrgId);
  };

  const handleReviewOpenChange = (open) => {
    if (open) setShowReviewModal(true);
    else void handleCancelReview();
  };

  const handleUploadAndExtract = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one file');
      return;
    }
    if (!selectedOrgId) {
      toast.error('Please select the practice that owns this referral.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(subjectDateOfBirth)) {
      toast.error('Enter the patient date of birth so the server can enforce the provider age gate.');
      return;
    }
    if (!processingAuthorityConfirmed) {
      toast.error('Confirm the practice has documented authority for this referral processing.');
      return;
    }

    setIsUploading(true);
    const uploadedFilesData = [];
    try {
      // Upload all files
      for (const file of files) {
        const { file_url, upload_id } = await uploadTenantFile({
          file,
          org_id: selectedOrgId,
          purpose: 'referral-extraction',
          subject_date_of_birth: subjectDateOfBirth,
        });
        uploadedFilesData.push({ url: file_url, uploadId: upload_id, name: file.name });
      }
      
      // Store file URLs and names for later saving
      setUploadedFiles(uploadedFilesData);
      
      setIsUploading(false);
      setIsExtracting(true);

      // The server authorises the complete ordered set before the first
      // provider call and performs the deterministic primary/fill-empty merge.
      const fileUrls = uploadedFilesData.map(f => f.url);
      const result = await extractTenantDocumentData({
        org_id: selectedOrgId,
        file_urls: fileUrls,
        json_schema: REFERRAL_EXTRACTION_SCHEMA,
        processing_authority_confirmed: true,
      });

      if (result?.status !== 'success' || !result.output || typeof result.output !== 'object') {
        const details = typeof result?.details === 'string'
          ? result.details
          : 'The referral could not be extracted. No client data was changed.';
        await scheduleCancellation(uploadedFilesData).catch(() => {});
        toast.error(details);
        return;
      }

      const mergedData = result.output;

      setExtractedData(mergedData);
      setEditedData(mergedData);

      // Process conditions
      const conditions = [];
      if (mergedData.primary_condition) {
        conditions.push({ name: mergedData.primary_condition, type: 'primary' });
      }
      if (mergedData.comorbidities && Array.isArray(mergedData.comorbidities)) {
        mergedData.comorbidities.forEach(c => {
          conditions.push({ name: c, type: 'comorbidity' });
        });
      }
      setExtractedConditions(conditions);

      // Check for matching clients - stricter matching criteria
      if (mergedData.full_name && mergedData.date_of_birth) {
        const matches = existingClients.filter(client => {
          if (client.org_id !== selectedOrgId) return false;
          // Both name AND DOB must match for a valid match
          const normalizedExtractedName = mergedData.full_name?.toLowerCase().trim();
          const normalizedClientName = client.full_name?.toLowerCase().trim();
          const normalizedExtractedDob = mergedData.date_of_birth;
          const normalizedClientDob = client.date_of_birth;
          
          // Exact DOB match required
          const dobMatch = normalizedExtractedDob === normalizedClientDob;
          
          // Name must be very similar (at least 80% of shorter name matches)
          const nameMatch = normalizedExtractedName && normalizedClientName && (
            normalizedExtractedName === normalizedClientName ||
            normalizedClientName.includes(normalizedExtractedName) ||
            normalizedExtractedName.includes(normalizedClientName)
          );
          
          // BOTH must match
          return nameMatch && dobMatch;
        });
        setMatchingClients(matches);
      } else {
        // If we don't have both name and DOB, don't suggest matches
        setMatchingClients([]);
      }

      setShowReviewModal(true);
      toast.success(`Data extracted from ${files.length} file(s)! Please review.`);

    } catch (error) {
      await scheduleCancellation(uploadedFilesData).catch(() => {});
      const status = error?.response?.status;
      console.warn('Referral processing failed', status ? { status } : undefined);
      const details = error?.response?.data?.details;
      toast.error(typeof details === 'string'
        ? details
        : 'The referral could not be processed. No client data was changed.');
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateNewClient = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Prepare client data
      const clientData = {
        full_name: editedData.full_name,
        date_of_birth: editedData.date_of_birth,
        gender: editedData.gender,
        phone: editedData.phone,
        email: editedData.email,
        address: editedData.address,
        referral_source: editedData.referral_source,
        referral_source_name: editedData.referral_source_name,
        referral_source_address: editedData.referral_source_address,
        referral_source_email: editedData.referral_source_email,
        referral_provider_number: editedData.referral_provider_number,
        referral_reason: editedData.referral_reason,
        referral_date: editedData.referral_date,
        funding_source: editedData.funding_source,
        medicare_number: editedData.medicare_number,
        medicare_irn: editedData.medicare_irn,
        medicare_referral_type: editedData.medicare_referral_type,
        dva_card_number: editedData.dva_card_number,
        dva_card_type: editedData.dva_card_type,
        dva_file_number: editedData.dva_file_number,
        dva_accepted_conditions: editedData.dva_accepted_conditions,
        ndis_number: editedData.ndis_number,
        ndis_goals: editedData.ndis_goals,
        private_health_fund_name: editedData.private_health_fund_name,
        private_health_fund_number: editedData.private_health_fund_number,
        workcover_claim_number: editedData.workcover_claim_number,
        workcover_date_of_injury: editedData.workcover_date_of_injury,
        workcover_injury_description: editedData.workcover_injury_description,
        primary_gp_name: editedData.primary_gp_name,
        primary_gp_clinic_name: editedData.primary_gp_clinic_name,
        primary_gp_address: editedData.primary_gp_address,
        primary_gp_phone: editedData.primary_gp_phone,
        primary_gp_email: editedData.primary_gp_email,
        primary_gp_provider_number: editedData.primary_gp_provider_number,
        client_goals: editedData.client_goals,
        consent_confirmed: false
      };

      // Remove undefined/empty values
      Object.keys(clientData).forEach(key => {
        if (clientData[key] === undefined || clientData[key] === '') {
          delete clientData[key];
        }
      });

      if (!selectedOrgId || !organizationOptions.some((option) => option.id === selectedOrgId)) {
        throw new Error('Practice membership is no longer available.');
      }
      const currentUser = await base44.auth.me();

      const newClient = await base44.entities.Client.create({
        ...clientData,
        org_id: selectedOrgId,
        assigned_clinician_email: currentUser.email
      });
      
      const clientWithOrg = newClient;

      // Create conditions
      for (const condition of extractedConditions) {
        await base44.entities.ClientCondition.create({
          client_id: clientWithOrg.id,
          org_id: clientWithOrg.org_id,
          condition_name: condition.name,
          condition_type: condition.type,
          is_active: true
        });
      }

      // Add medications as conditions if present
      if (editedData.medications && Array.isArray(editedData.medications)) {
        for (const med of editedData.medications) {
          await base44.entities.ClientCondition.create({
            client_id: clientWithOrg.id,
            org_id: clientWithOrg.org_id,
            condition_name: 'Medication',
            condition_type: 'comorbidity',
            medication: med,
            is_active: true
          });
        }
      }

      // Save all uploaded documents to client's profile
      for (const uploadedFile of uploadedFiles) {
        await base44.entities.ClientDocument.create({
          client_id: clientWithOrg.id,
          org_id: clientWithOrg.org_id,
          document_type: 'referral',
          file_url: uploadedFile.url,
          file_name: uploadedFile.name,
          notes: 'Uploaded via referral uploader'
        });
      }

      // Save any pending historical assessments
      if (pendingHistoricalAssessments.length > 0) {
        for (const assessment of pendingHistoricalAssessments) {
          await base44.entities.ClientAssessment.create({
            client_id: clientWithOrg.id,
            org_id: clientWithOrg.org_id,
            assessment_id: assessment.matched_assessment.id,
            appointment_id: null,
            status: 'completed',
            result_value: assessment.result_value,
            assessment_date: assessment.test_date || todayLocal(),
            notes: `Historical result from external report. ${assessment.performed_by ? `Performed by: ${assessment.performed_by}. ` : ''}${assessment.notes || ''}`
          });
        }
        toast.success(`Saved ${pendingHistoricalAssessments.length} historical assessment(s)`);
      }

      setShowReviewModal(false);
      resetForm();
      toast.success(`Client "${clientWithOrg.full_name}" created successfully!`);
      
      // Delay callback slightly to ensure state is cleared before navigation
      setTimeout(() => {
        if (onClientCreated) {
          onClientCreated(clientWithOrg);
        }
      }, 100);

    } catch (error) {
      console.error('Error creating client:', error);
      toast.error('Failed to create client');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateExistingClient = async () => {
    if (!selectedExistingClient) {
      toast.error('Please select a client to update');
      return;
    }
    if (isSubmitting) return;
    if (selectedExistingClient.org_id !== selectedOrgId) {
      toast.error('The selected client does not belong to the referral practice.');
      return;
    }
    setIsSubmitting(true);

    try {
      // Prepare update data (only non-empty fields)
      const updateData = {};
      Object.keys(editedData).forEach(key => {
        if (editedData[key] && editedData[key] !== '' && 
            !['primary_condition', 'comorbidities', 'medications', 'medical_history'].includes(key)) {
          updateData[key] = editedData[key];
        }
      });

      await base44.entities.Client.update(selectedExistingClient.id, updateData);

      // Add new conditions
      for (const condition of extractedConditions) {
        await base44.entities.ClientCondition.create({
          client_id: selectedExistingClient.id,
          org_id: selectedExistingClient.org_id,
          condition_name: condition.name,
          condition_type: condition.type,
          is_active: true
        });
      }

      // Save all uploaded documents to client's profile
      for (const uploadedFile of uploadedFiles) {
        await base44.entities.ClientDocument.create({
          client_id: selectedExistingClient.id,
          org_id: selectedExistingClient.org_id,
          document_type: 'referral',
          file_url: uploadedFile.url,
          file_name: uploadedFile.name,
          notes: 'Uploaded via referral uploader'
        });
      }

      setShowReviewModal(false);
      resetForm();
      toast.success(`Client "${selectedExistingClient.full_name}" updated successfully!`);

      // Delay callback slightly to ensure state is cleared before navigation
      setTimeout(() => {
        if (onClientUpdated) {
          onClientUpdated(selectedExistingClient);
        }
      }, 100);

    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Failed to update client');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFiles([]);
    setExtractedData(null);
    setEditedData({});
    setMatchingClients([]);
    setSelectedExistingClient(null);
    setExtractedConditions([]);
    setUploadedFiles([]);
    setPendingHistoricalAssessments([]);
    setSubjectDateOfBirth('');
    setProcessingAuthorityConfirmed(false);
  };

  const fundingLabels = {
    dva: "DVA",
    private_health: "Private Health",
    medicare: "Medicare",
    self_funded: "Self Funded",
    workcover_qld: "WorkCover QLD",
    ndis: "NDIS",
    tac_maic: "TAC/MAIC",
    aged_care: "Aged Care",
    my_aged_care: "My Aged Care",
    other: "Other"
  };

  const referralSourceLabels = {
    gp: "General Practitioner",
    wc_case_manager: "WorkCover Case Manager",
    aged_care_case_manager: "Aged Care Case Manager",
    ndis_support_coordinator: "NDIS Support Coordinator",
    dva: "DVA",
    self_referral: "Self Referral",
    other: "Other"
  };

  return (
    <>
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            Upload Referral Document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="referral-organization">Owning practice</Label>
              <Select
                value={selectedOrgId}
                onValueChange={handleOrganizationChange}
                disabled={isLoadingOrganizations || organizationOptions.length === 0 || isUploading || isExtracting}
              >
                <SelectTrigger id="referral-organization">
                  <SelectValue placeholder={isLoadingOrganizations ? 'Loading practices...' : 'Select a practice'} />
                </SelectTrigger>
                <SelectContent>
                  {organizationOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}{option.isPrimary ? ' (primary)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isLoadingOrganizations && organizationOptions.length === 0 && (
                <p className="text-xs text-red-600">A current practice membership is required before upload.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="referral-date-of-birth">Patient date of birth</Label>
              <Input
                id="referral-date-of-birth"
                type="date"
                value={subjectDateOfBirth}
                max={todayLocal()}
                onChange={(event) => {
                  setSubjectDateOfBirth(event.target.value);
                  setProcessingAuthorityConfirmed(false);
                }}
                disabled={isUploading || isExtracting}
              />
              <p className="text-xs text-slate-500">
                The server calculates the age category. Paediatric care remains supported; provider processing under 13 stays disabled unless its separate retention gate is verified.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <Checkbox
              id="referral-processing-authority"
              checked={processingAuthorityConfirmed}
              onCheckedChange={(checked) => setProcessingAuthorityConfirmed(checked === true)}
              disabled={isUploading || isExtracting}
            />
            <Label htmlFor="referral-processing-authority" className="text-sm font-normal leading-5">
              I confirm the practice has documented the patient or representative notice and consent, or another valid authority, for AssessSuite and OpenAI to process this referral for extraction.
            </Label>
          </div>

          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.csv"
              onChange={handleFileChange}
              className="hidden"
              id="referral-upload"
              multiple
            />
            <label htmlFor="referral-upload" className="cursor-pointer">
              <FileText className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <p className="text-sm text-slate-600 mb-1">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-slate-500">PDF, PNG, JPG or CSV (multiple files supported)</p>
            </label>
            </div>

            {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">{file.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                onClick={handleUploadAndExtract}
                disabled={isUploading || isExtracting || !selectedOrgId || !subjectDateOfBirth || !processingAuthorityConfirmed}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading {files.length} file(s)...</>
                ) : isExtracting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Extracting data...</>
                ) : (
                  <><Search className="w-4 h-4 mr-2" /> Extract Data from {files.length} file(s)</>
                )}
              </Button>
            </div>
            )}
        </CardContent>
      </Card>

      {/* Review Modal */}
      <Dialog open={showReviewModal} onOpenChange={handleReviewOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Review Extracted Data
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Matching Clients Warning */}
            {matchingClients.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-yellow-900 mb-2">Possible Matching Clients Found</h4>
                      <p className="text-sm text-yellow-700 mb-3">
                        The following existing clients may match this referral:
                      </p>
                      <div className="space-y-2">
                        {matchingClients.map(client => (
                          <div 
                            key={client.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedExistingClient?.id === client.id 
                                ? 'bg-yellow-100 border-yellow-400' 
                                : 'bg-white border-yellow-200 hover:bg-yellow-50'
                            }`}
                            onClick={() => setSelectedExistingClient(
                              selectedExistingClient?.id === client.id ? null : client
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-slate-900">{client.full_name}</p>
                                <p className="text-sm text-slate-600">DOB: {client.date_of_birth || 'N/A'}</p>
                              </div>
                              {selectedExistingClient?.id === client.id && (
                                <Badge className="bg-yellow-600">Selected</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Personal Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  Personal Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={editedData.full_name || ''}
                    onChange={(e) => handleFieldChange('full_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={editedData.date_of_birth || ''}
                    onChange={(e) => handleFieldChange('date_of_birth', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select value={editedData.gender || ''} onValueChange={(v) => handleFieldChange('gender', v)}>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={editedData.phone || ''}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editedData.email || ''}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <Textarea
                    value={editedData.address || ''}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Referral Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-blue-600" />
                  Referral Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Referral Source</Label>
                  <Select value={editedData.referral_source || ''} onValueChange={(v) => handleFieldChange('referral_source', v)}>
                    <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(referralSourceLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Referrer Name</Label>
                  <Input
                    value={editedData.referral_source_name || ''}
                    onChange={(e) => handleFieldChange('referral_source_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Referral Date</Label>
                  <Input
                    type="date"
                    value={editedData.referral_date || ''}
                    onChange={(e) => handleFieldChange('referral_date', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Provider Number</Label>
                  <Input
                    value={editedData.referral_provider_number || ''}
                    onChange={(e) => handleFieldChange('referral_provider_number', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Referral Reason</Label>
                  <Textarea
                    value={editedData.referral_reason || ''}
                    onChange={(e) => handleFieldChange('referral_reason', e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Funding Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  Funding Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Funding Source</Label>
                  <Select value={editedData.funding_source || ''} onValueChange={(v) => handleFieldChange('funding_source', v)}>
                    <SelectTrigger><SelectValue placeholder="Select funding" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(fundingLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Medicare Fields */}
                {editedData.funding_source === 'medicare' && (
                  <>
                    <div>
                      <Label>Medicare Number</Label>
                      <Input
                        value={editedData.medicare_number || ''}
                        onChange={(e) => handleFieldChange('medicare_number', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Medicare IRN</Label>
                      <Input
                        value={editedData.medicare_irn || ''}
                        onChange={(e) => handleFieldChange('medicare_irn', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Medicare Referral Type</Label>
                      <Select value={editedData.medicare_referral_type || ''} onValueChange={(v) => handleFieldChange('medicare_referral_type', v)}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tca">Team Care Arrangement (TCA)</SelectItem>
                          <SelectItem value="epc">Enhanced Primary Care (EPC)</SelectItem>
                          <SelectItem value="cdm">Chronic Disease Management (CDM)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* DVA Fields */}
                {editedData.funding_source === 'dva' && (
                  <>
                    <div>
                      <Label>DVA Card Number</Label>
                      <Input
                        value={editedData.dva_card_number || ''}
                        onChange={(e) => handleFieldChange('dva_card_number', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>DVA Card Type</Label>
                      <Select value={editedData.dva_card_type || ''} onValueChange={(v) => handleFieldChange('dva_card_type', v)}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="white">White</SelectItem>
                          <SelectItem value="gold">Gold</SelectItem>
                          <SelectItem value="gold_tpi">Gold TPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>DVA File Number</Label>
                      <Input
                        value={editedData.dva_file_number || ''}
                        onChange={(e) => handleFieldChange('dva_file_number', e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>DVA Accepted Conditions</Label>
                      <Textarea
                        value={editedData.dva_accepted_conditions || ''}
                        onChange={(e) => handleFieldChange('dva_accepted_conditions', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </>
                )}

                {/* NDIS Fields */}
                {editedData.funding_source === 'ndis' && (
                  <>
                    <div>
                      <Label>NDIS Number</Label>
                      <Input
                        value={editedData.ndis_number || ''}
                        onChange={(e) => handleFieldChange('ndis_number', e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>NDIS Goals</Label>
                      <Textarea
                        value={editedData.ndis_goals || ''}
                        onChange={(e) => handleFieldChange('ndis_goals', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </>
                )}

                {/* WorkCover Fields */}
                {editedData.funding_source === 'workcover_qld' && (
                  <>
                    <div>
                      <Label>WorkCover Claim Number</Label>
                      <Input
                        value={editedData.workcover_claim_number || ''}
                        onChange={(e) => handleFieldChange('workcover_claim_number', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Date of Injury</Label>
                      <Input
                        type="date"
                        value={editedData.workcover_date_of_injury || ''}
                        onChange={(e) => handleFieldChange('workcover_date_of_injury', e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Injury Description</Label>
                      <Textarea
                        value={editedData.workcover_injury_description || ''}
                        onChange={(e) => handleFieldChange('workcover_injury_description', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </>
                )}

                {/* Private Health Fields */}
                {editedData.funding_source === 'private_health' && (
                  <>
                    <div>
                      <Label>Health Fund Name</Label>
                      <Input
                        value={editedData.private_health_fund_name || ''}
                        onChange={(e) => handleFieldChange('private_health_fund_name', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Member Number</Label>
                      <Input
                        value={editedData.private_health_fund_number || ''}
                        onChange={(e) => handleFieldChange('private_health_fund_number', e.target.value)}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Medical Conditions */}
            {extractedConditions.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-blue-600" />
                    Medical Conditions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {extractedConditions.map((condition, index) => (
                      <Badge 
                        key={index} 
                        variant={condition.type === 'primary' ? 'default' : 'secondary'}
                        className={condition.type === 'primary' ? 'bg-red-100 text-red-800' : ''}
                      >
                        {condition.name}
                        {condition.type === 'primary' && ' (Primary)'}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Goals */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-600" />
                  Goals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={editedData.client_goals || ''}
                  onChange={(e) => handleFieldChange('client_goals', e.target.value)}
                  placeholder="Treatment goals from the referral..."
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* Historical Assessment Extraction */}
            {uploadedFiles.length > 0 && (
              <HistoricalAssessmentExtractor
                fileUrls={uploadedFiles.map(f => f.url)}
                clientId={selectedExistingClient?.id || null}
                orgId={selectedOrgId}
                processingAuthorityConfirmed={processingAuthorityConfirmed}
                allAssessments={allAssessments}
                onExtracted={(assessments) => {
                  // For new clients, store assessments to save after client creation
                  if (!selectedExistingClient) {
                    setPendingHistoricalAssessments(assessments);
                  }
                }}
                isNewClient={!selectedExistingClient}
              />
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelReview}>
              Cancel
            </Button>
            {selectedExistingClient ? (
              <Button onClick={handleUpdateExistingClient} className="bg-yellow-600 hover:bg-yellow-700" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Edit className="w-4 h-4 mr-2" />}
                Update {selectedExistingClient.full_name}
              </Button>
            ) : (
              <Button onClick={handleCreateNewClient} className="bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Create New Client
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
