import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button as ButtonPrimitive } from '@/components/ui/button';
import {
  Card as CardPrimitive,
  CardContent as CardContentPrimitive,
  CardHeader as CardHeaderPrimitive,
  CardTitle as CardTitlePrimitive,
} from '@/components/ui/card';
import { Input as InputPrimitive } from '@/components/ui/input';
import { Label as LabelPrimitive } from '@/components/ui/label';
import { Textarea as TextareaPrimitive } from '@/components/ui/textarea';
import {
  Select as SelectPrimitive,
  SelectContent as SelectContentPrimitive,
  SelectItem as SelectItemPrimitive,
  SelectTrigger as SelectTriggerPrimitive,
  SelectValue as SelectValuePrimitive,
} from '@/components/ui/select';
import {
  cancelTenantUploads,
  DOCUMENT_EXTRACTION_MAX_FILES,
  extractTenantDocumentData,
  REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
  uploadTenantFile,
} from '@/lib/fileIntegrations';
import {
  Dialog as DialogPrimitive,
  DialogContent as DialogContentPrimitive,
  DialogHeader as DialogHeaderPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogFooter as DialogFooterPrimitive,
} from '@/components/ui/dialog';
import { Badge as BadgePrimitive } from '@/components/ui/badge';
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
import {
  REFERRAL_PROCESSING_ATTESTATION,
  REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  REFERRAL_SUBJECT_AGE_CONFIRMATION,
  resolveReferralOrganization,
} from '@/lib/referralWorkflow';
import { REFERRAL_EXTRACTION_SCHEMA } from '@/lib/referralExtractionSchema';
import {
  buildReferralClientData,
  buildReferralConditionData,
  findReferralClientMatches,
  prepareReferralReviewData,
} from '@/lib/referralReview';
import {
  buildReviewedReferralCommitPayload,
  commitReviewedReferral,
  createReferralCommitIdempotencyKey,
} from '@/lib/referralCommit';
import { useAuth } from '@/lib/AuthContext';
import { selectedOrganizationLegalAcceptanceStatus } from '@/lib/legal/acceptanceGate';
import { SUITE_VERSION } from '@/lib/legal/documentRegistry';
import { loadLegalContent } from '@/lib/legal/loadContent';
import { normalizeSdkError, sdkErrorLogMetadata } from '@/lib/sdkError';

// The shared JavaScript UI primitives intentionally live outside checkJs and
// therefore expose incomplete inferred prop types. Keep that typing boundary
// local while retaining full checking for this workflow's data and callbacks.
const Button = /** @type {React.ComponentType<any>} */ (ButtonPrimitive);
const Card = /** @type {React.ComponentType<any>} */ (CardPrimitive);
const CardContent = /** @type {React.ComponentType<any>} */ (CardContentPrimitive);
const CardHeader = /** @type {React.ComponentType<any>} */ (CardHeaderPrimitive);
const CardTitle = /** @type {React.ComponentType<any>} */ (CardTitlePrimitive);
const Input = /** @type {React.ComponentType<any>} */ (InputPrimitive);
const Label = /** @type {React.ComponentType<any>} */ (LabelPrimitive);
const Textarea = /** @type {React.ComponentType<any>} */ (TextareaPrimitive);
const Select = /** @type {React.ComponentType<any>} */ (SelectPrimitive);
const SelectContent = /** @type {React.ComponentType<any>} */ (SelectContentPrimitive);
const SelectItem = /** @type {React.ComponentType<any>} */ (SelectItemPrimitive);
const SelectTrigger = /** @type {React.ComponentType<any>} */ (SelectTriggerPrimitive);
const SelectValue = /** @type {React.ComponentType<any>} */ (SelectValuePrimitive);
const Dialog = /** @type {React.ComponentType<any>} */ (DialogPrimitive);
const DialogContent = /** @type {React.ComponentType<any>} */ (DialogContentPrimitive);
const DialogHeader = /** @type {React.ComponentType<any>} */ (DialogHeaderPrimitive);
const DialogTitle = /** @type {React.ComponentType<any>} */ (DialogTitlePrimitive);
const DialogFooter = /** @type {React.ComponentType<any>} */ (DialogFooterPrimitive);
const Badge = /** @type {React.ComponentType<any>} */ (BadgePrimitive);

/**
 * @param {{
 *   onClientCreated?: (client: Record<string, any>) => void,
 *   onClientUpdated?: (client: Record<string, any>) => void,
 *   existingClients?: Array<Record<string, any>>,
 *   allAssessments?: Array<Record<string, any>>,
 * }} props
 */
export default function ReferralUploader({
  onClientCreated,
  onClientUpdated,
  existingClients = [],
  allAssessments = [],
}) {
  // Accepted for compatibility with existing callers. Historical assessment
  // scanning remains deliberately disabled in this release.
  void allAssessments;
  // Parent lists may be paginated. Duplicate review is derived only from the
  // complete selected-practice query performed after extraction.
  void existingClients;
  const navigate = useNavigate();
  const { appPublicSettings } = useAuth();
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [processingError, setProcessingError] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [editedData, setEditedData] = useState(/** @type {Record<string, any>} */ ({}));
  const [tenantClients, setTenantClients] = useState([]);
  const [matchingClients, setMatchingClients] = useState([]);
  const [selectedExistingClient, setSelectedExistingClient] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [organizationOptions, setOrganizationOptions] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(true);
  const uploadedFilesRef = useRef([]);
  const selectedOrgIdRef = useRef('');
  const referralCommitKeyRef = useRef(null);
  const extractionStartLockRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    uploadedFilesRef.current = uploadedFiles;
  }, [uploadedFiles]);

  useEffect(() => {
    selectedOrgIdRef.current = selectedOrgId;
  }, [selectedOrgId]);

  useEffect(() => {
    const nextMatches = findReferralClientMatches(editedData, tenantClients, selectedOrgId);
    setMatchingClients(nextMatches);
    setSelectedExistingClient((current) => (
      current && nextMatches.some((client) => client.id === current.id) ? current : null
    ));
  }, [editedData.full_name, editedData.date_of_birth, selectedOrgId, tenantClients]);

  useEffect(() => () => {
    isMountedRef.current = false;
    const uploadIds = uploadedFilesRef.current.map((file) => file.uploadId).filter(Boolean);
    const orgId = selectedOrgIdRef.current;
    if (orgId && uploadIds.length > 0) {
      void cancelTenantUploads({ org_id: orgId, upload_ids: uploadIds }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadOrganizations = async () => {
      setIsLoadingOrganizations(true);
      try {
        const currentUser = await base44.auth.me();
        const memberships = await base44.entities.OrganizationMember.filter({ user_email: currentUser.email });
        const validMemberships = (memberships || []).filter((membership) => (
          typeof membership?.org_id === 'string' && membership.org_id.length > 0
        ));
        const hydratedOptions = await Promise.all(validMemberships.map(async (membership) => {
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
        const options = [...new Map(
          hydratedOptions.map((option) => [option.id, option]),
        ).values()];

        if (cancelled) return;
        setOrganizationOptions(options);
        setSelectedOrgId((current) => {
          return resolveReferralOrganization(options, current);
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

    if (files.length + validFiles.length > DOCUMENT_EXTRACTION_MAX_FILES) {
      toast.error(`Select no more than ${DOCUMENT_EXTRACTION_MAX_FILES} documents for one extraction.`);
      e.target.value = '';
      return;
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      referralCommitKeyRef.current = null;
      setProcessingError(null);
      setEditedData({});
      setTenantClients([]);
      setMatchingClients([]);
      setSelectedExistingClient(null);
    }
  };

  const removeFile = (index) => {
    referralCommitKeyRef.current = null;
    setFiles(prev => prev.filter((_, i) => i !== index));
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

  const handleReviewOpenChange = (open) => {
    if (open) setShowReviewModal(true);
    else if (isSubmitting || isUploading || isExtracting) return;
    else void handleCancelReview();
  };

  const handleUploadAndExtract = async () => {
    if (extractionStartLockRef.current) return;
    extractionStartLockRef.current = true;
    setIsUploading(true);
    const releaseExtractionStart = () => {
      extractionStartLockRef.current = false;
      if (isMountedRef.current) {
        setIsUploading(false);
        setIsExtracting(false);
      }
    };
    setProcessingError(null);
    if (files.length === 0) {
      toast.error('Please select at least one file');
      releaseExtractionStart();
      return;
    }
    if (files.length > DOCUMENT_EXTRACTION_MAX_FILES) {
      toast.error(`Select no more than ${DOCUMENT_EXTRACTION_MAX_FILES} documents for one extraction.`);
      releaseExtractionStart();
      return;
    }
    if (!selectedOrgId) {
      toast.error('Your current practice could not be resolved. Refresh the page or check your practice membership.');
      releaseExtractionStart();
      return;
    }

    // Re-check the exact selected practice immediately before any upload. The
    // layout gate may have run against an earlier membership or receipt set.
    try {
      const currentUser = await base44.auth.me();
      const [memberships, events] = await Promise.all([
        base44.entities.OrganizationMember.filter({ user_email: currentUser.email }),
        base44.entities.LegalAcceptanceEvent.filter({
          user_email: currentUser.email,
          suite_version: SUITE_VERSION,
        }),
      ]);
      const legalStatus = selectedOrganizationLegalAcceptanceStatus({
        events,
        memberships,
        orgId: selectedOrgId,
        legalSettings: appPublicSettings?.public_settings?.legal,
        readContent: loadLegalContent,
      });
      if (!legalStatus.accepted) {
        const details = 'Review and accept the current notices for this practice before extracting a referral.';
        setProcessingError({ details, diagnosticReference: null });
        toast.error(details);
        navigate(`/LegalNotices?org_id=${encodeURIComponent(selectedOrgId)}`);
        releaseExtractionStart();
        return;
      }
    } catch (error) {
      console.warn('Referral legal preflight failed', sdkErrorLogMetadata(error, { stage: 'legal_preflight' }));
      const details = 'The current practice notices could not be verified. No document was uploaded.';
      setProcessingError({ details, diagnosticReference: null });
      toast.error(details);
      releaseExtractionStart();
      return;
    }

    // The action itself is the explicit, authenticated authority and age
    // attestation. The server rejects missing/other age confirmations before
    // provider I/O and retains only the age category, never an entered DOB.
    const uploadedFilesData = [];
    let processingStage = 'upload';
    try {
      // Upload all files
      for (const file of files) {
        const { file_url, upload_id } = await uploadTenantFile({
          file,
          org_id: selectedOrgId,
          purpose: 'referral-extraction',
          processing_authority_confirmed: true,
          processing_authority_attestation_version:
            REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
          subject_age_confirmation: REFERRAL_SUBJECT_AGE_CONFIRMATION,
          subject_age_attestation_version: REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
        });
        if (!isMountedRef.current) {
          await cancelTenantUploads({
            org_id: selectedOrgId,
            upload_ids: [upload_id],
          }).catch(() => {});
          return;
        }
        uploadedFilesData.push({ url: file_url, uploadId: upload_id, name: file.name });
        // Publish each durable upload immediately. If a later upload is still
        // pending when this component unmounts, cleanup can already see and
        // cancel every file that reached storage.
        const uploadedSnapshot = [...uploadedFilesData];
        uploadedFilesRef.current = uploadedSnapshot;
        setUploadedFiles(uploadedSnapshot);
      }
      
      setIsUploading(false);
      setIsExtracting(true);
      processingStage = 'extraction';

      // The server authorises the complete ordered set before the first
      // provider call and performs the deterministic primary/fill-empty merge.
      const fileUrls = uploadedFilesData.map(f => f.url);
      const result = await extractTenantDocumentData({
        org_id: selectedOrgId,
        file_urls: fileUrls,
        json_schema: REFERRAL_EXTRACTION_SCHEMA,
        processing_authority_confirmed: true,
        processing_authority_attestation_version:
          REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
      });

      if (result?.status !== 'success' || !result.output || typeof result.output !== 'object') {
        const failure = normalizeSdkError({ data: result }, {
          stage: 'extraction',
          fallbackDetails: 'The referral could not be extracted. No client data was changed.',
        });
        await scheduleCancellation(uploadedFilesData).catch(() => {});
        setProcessingError({
          details: failure.details,
          diagnosticReference: failure.diagnosticReference,
        });
        toast.error(failure.details);
        return;
      }

      const mergedData = result.output;
      setTenantClients([]);
      setMatchingClients([]);
      setSelectedExistingClient(null);
      setEditedData(prepareReferralReviewData(mergedData));
      // One key identifies this exact reviewed extraction. A failed commit can
      // be retried safely with the same key; a later extraction receives a new
      // key and therefore cannot replay this review accidentally.
      referralCommitKeyRef.current = createReferralCommitIdempotencyKey();

      // Query the complete selected-practice client set rather than relying on
      // whichever subset the parent page happens to have loaded.
      let completeTenantClients = [];
      try {
        const queriedClients = await base44.entities.Client.filter({ org_id: selectedOrgId });
        completeTenantClients = Array.isArray(queriedClients)
          ? queriedClients.filter((client) => client?.org_id === selectedOrgId)
          : [];
      } catch (error) {
        console.warn('Referral duplicate check failed', sdkErrorLogMetadata(error, { stage: 'duplicate_check' }));
        toast.warning('The complete client list could not be checked. Review carefully before creating a new client.');
      }
      setTenantClients(completeTenantClients);

      setShowReviewModal(true);
      toast.success(`Data extracted from ${files.length} file(s)! Please review.`);

    } catch (error) {
      await scheduleCancellation(uploadedFilesData).catch(() => {});
      const failure = normalizeSdkError(error, {
        stage: processingStage,
        fallbackDetails: 'The referral could not be processed. No client data was changed.',
      });
      console.warn('Referral processing failed', sdkErrorLogMetadata(error, { stage: processingStage }));
      setProcessingError({
        details: failure.details,
        diagnosticReference: failure.diagnosticReference,
      });
      toast.error(failure.details);
    } finally {
      releaseExtractionStart();
    }
  };

  const handleFieldChange = (field, value) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const reviewedClientData = () => buildReferralClientData(editedData);

  const reviewedCommitPayload = (operation, clientId = null) => {
    const idempotencyKey = referralCommitKeyRef.current || createReferralCommitIdempotencyKey();
    referralCommitKeyRef.current = idempotencyKey;
    return buildReviewedReferralCommitPayload({
      idempotencyKey,
      orgId: selectedOrgId,
      operation,
      clientId,
      client: reviewedClientData(),
      conditions: buildReferralConditionData(editedData),
      uploadIds: uploadedFiles.map((file) => file.uploadId).filter(Boolean),
    });
  };

  const handleCreateNewClient = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setProcessingError(null);
    try {
      if (!selectedOrgId || !organizationOptions.some((option) => option.id === selectedOrgId)) {
        throw new Error('Practice membership is no longer available.');
      }

      const payload = reviewedCommitPayload('create');
      const result = await commitReviewedReferral(base44, payload);
      const clientWithOrg = /** @type {Record<string, any>} */ ({
        ...payload.client,
        id: result.client_id,
        org_id: selectedOrgId,
      });

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
      const failure = normalizeSdkError(error, {
        stage: 'referral_commit',
        fallbackDetails: 'The save result could not be confirmed. Retry this same review; AssessSuite will safely return the original result if it was already saved.',
      });
      console.warn('Referral commit failed', sdkErrorLogMetadata(error, { stage: 'referral_commit' }));
      setProcessingError({
        details: failure.details,
        diagnosticReference: failure.diagnosticReference,
      });
      toast.error(failure.details);
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
    setProcessingError(null);

    try {
      const payload = reviewedCommitPayload('update', selectedExistingClient.id);
      const result = await commitReviewedReferral(base44, payload);
      const updatedClient = {
        ...selectedExistingClient,
        ...payload.client,
        id: result.client_id,
        org_id: selectedOrgId,
      };

      setShowReviewModal(false);
      resetForm();
      toast.success(`Client "${updatedClient.full_name}" updated successfully!`);

      // Delay callback slightly to ensure state is cleared before navigation
      setTimeout(() => {
        if (onClientUpdated) {
          onClientUpdated(updatedClient);
        }
      }, 100);

    } catch (error) {
      const failure = normalizeSdkError(error, {
        stage: 'referral_commit',
        fallbackDetails: 'The save result could not be confirmed. Retry this same review; AssessSuite will safely return the original result if it was already saved.',
      });
      console.warn('Referral commit failed', sdkErrorLogMetadata(error, { stage: 'referral_commit' }));
      setProcessingError({
        details: failure.details,
        diagnosticReference: failure.diagnosticReference,
      });
      toast.error(failure.details);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    referralCommitKeyRef.current = null;
    setFiles([]);
    setEditedData({});
    setTenantClients([]);
    setMatchingClients([]);
    setSelectedExistingClient(null);
    setProcessingError(null);
    uploadedFilesRef.current = [];
    setUploadedFiles([]);
  };

  const handleOrganizationChange = (nextOrgId) => {
    const resolvedOrgId = resolveReferralOrganization(organizationOptions, nextOrgId);
    if (!resolvedOrgId) {
      setSelectedOrgId('');
      return;
    }

    const previousOrgId = selectedOrgId;
    const uploadIds = uploadedFiles.map((file) => file.uploadId).filter(Boolean);
    if (previousOrgId && previousOrgId !== resolvedOrgId && uploadIds.length > 0) {
      void cancelTenantUploads({ org_id: previousOrgId, upload_ids: uploadIds }).catch(() => {
        toast.warning('Temporary files from the previous practice remain scheduled for automatic expiry.');
      });
    }
    if (previousOrgId && previousOrgId !== resolvedOrgId) {
      resetForm();
      setShowReviewModal(false);
    }
    setSelectedOrgId(resolvedOrgId);
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

  const renderProcessingError = () => processingError && (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-md border border-red-200 bg-red-50 p-3 text-left text-sm text-red-900"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
        <div>
          <p className="font-semibold">Referral processing was not completed</p>
          <p className="mt-1">{processingError.details}</p>
          <p className="mt-1 text-xs text-red-800">
            Retry the action. If it fails again, contact support
            {processingError.diagnosticReference ? ' and include the reference below' : ''}.
          </p>
          {processingError.diagnosticReference && (
            <p className="mt-1 font-mono text-xs">Reference: {processingError.diagnosticReference}</p>
          )}
        </div>
      </div>
    </div>
  );

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
          {renderProcessingError()}
          {organizationOptions.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="referral-organization">Choose practice for this referral</Label>
              <Select
                value={selectedOrgId}
                onValueChange={handleOrganizationChange}
                disabled={isLoadingOrganizations || isUploading || isExtracting}
              >
                <SelectTrigger id="referral-organization">
                  <SelectValue placeholder="Select the practice that owns this referral" />
                </SelectTrigger>
                <SelectContent>
                  {organizationOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}{option.isPrimary ? ' (primary)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Choose the practice that owns this referral before extracting it.
              </p>
            </div>
          )}

          {!isLoadingOrganizations && organizationOptions.length === 0 && (
            <p className="text-sm text-red-600">A current practice membership is required before upload.</p>
          )}

          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.csv"
              onChange={handleFileChange}
              className="hidden"
              id="referral-upload"
              multiple
              disabled={isUploading || isExtracting}
            />
            <label htmlFor="referral-upload" className="cursor-pointer">
              <FileText className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <p className="text-sm text-slate-600 mb-1">
                Click to upload
              </p>
              <p className="text-xs text-slate-500">PDF, PNG, JPG or CSV (up to {DOCUMENT_EXTRACTION_MAX_FILES} files)</p>
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
                    aria-label={`Remove ${file.name}`}
                    disabled={isUploading || isExtracting}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                onClick={handleUploadAndExtract}
                disabled={isUploading || isExtracting || !selectedOrgId}
                aria-describedby="referral-extraction-attestation"
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
              <p id="referral-extraction-attestation" className="text-xs leading-5 text-slate-600">
                {REFERRAL_PROCESSING_ATTESTATION}
              </p>
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
            {renderProcessingError()}
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
                          <button
                            type="button"
                            key={client.id}
                            aria-pressed={selectedExistingClient?.id === client.id}
                            className={`w-full p-3 rounded-lg border cursor-pointer text-left transition-colors ${
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
                          </button>
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
                  <Label>Referrer Email</Label>
                  <Input
                    type="email"
                    value={editedData.referral_source_email || ''}
                    onChange={(e) => handleFieldChange('referral_source_email', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Referrer Address</Label>
                  <Textarea
                    value={editedData.referral_source_address || ''}
                    onChange={(e) => handleFieldChange('referral_source_address', e.target.value)}
                    rows={2}
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

                <div className="md:col-span-2 border-t pt-3 text-sm font-semibold text-slate-700">Medicare</div>
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

                <div className="md:col-span-2 border-t pt-3 text-sm font-semibold text-slate-700">DVA</div>
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

                <div className="md:col-span-2 border-t pt-3 text-sm font-semibold text-slate-700">NDIS</div>
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

                <div className="md:col-span-2 border-t pt-3 text-sm font-semibold text-slate-700">Private Health</div>
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

                <div className="md:col-span-2 border-t pt-3 text-sm font-semibold text-slate-700">WorkCover</div>
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
              </CardContent>
            </Card>

            {/* Medical Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-blue-600" />
                  Medical Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Primary Condition</Label>
                  <Input
                    value={editedData.primary_condition || ''}
                    onChange={(e) => handleFieldChange('primary_condition', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Other Conditions</Label>
                  <Textarea
                    value={editedData.comorbidities || ''}
                    onChange={(e) => handleFieldChange('comorbidities', e.target.value)}
                    placeholder="One condition per line"
                    rows={4}
                  />
                </div>
                <div>
                  <Label>Current Medications</Label>
                  <Textarea
                    value={editedData.medications || ''}
                    onChange={(e) => handleFieldChange('medications', e.target.value)}
                    placeholder="One medication per line"
                    rows={4}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Relevant Medical History</Label>
                  <Textarea
                    value={editedData.medical_history || ''}
                    onChange={(e) => handleFieldChange('medical_history', e.target.value)}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* GP Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-blue-600" />
                  Primary GP Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>GP Name</Label>
                  <Input
                    value={editedData.primary_gp_name || ''}
                    onChange={(e) => handleFieldChange('primary_gp_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Clinic Name</Label>
                  <Input
                    value={editedData.primary_gp_clinic_name || ''}
                    onChange={(e) => handleFieldChange('primary_gp_clinic_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label>GP Phone</Label>
                  <Input
                    value={editedData.primary_gp_phone || ''}
                    onChange={(e) => handleFieldChange('primary_gp_phone', e.target.value)}
                  />
                </div>
                <div>
                  <Label>GP Email</Label>
                  <Input
                    type="email"
                    value={editedData.primary_gp_email || ''}
                    onChange={(e) => handleFieldChange('primary_gp_email', e.target.value)}
                  />
                </div>
                <div>
                  <Label>GP Provider Number</Label>
                  <Input
                    value={editedData.primary_gp_provider_number || ''}
                    onChange={(e) => handleFieldChange('primary_gp_provider_number', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>GP Address</Label>
                  <Textarea
                    value={editedData.primary_gp_address || ''}
                    onChange={(e) => handleFieldChange('primary_gp_address', e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

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

          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelReview} disabled={isSubmitting}>
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
