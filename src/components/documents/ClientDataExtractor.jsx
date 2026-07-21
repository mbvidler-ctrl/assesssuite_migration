import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  FileSearch,
  CheckCircle,
  X,
  Plus,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DOCUMENT_EXTRACTION_MAX_FILES, extractTenantDocumentData } from '@/lib/fileIntegrations';
import { todayLocal } from "@/lib/localDate";
import { normalizeSdkError, sdkErrorLogMetadata } from '@/lib/sdkError';

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    personal_info: {
      type: "object",
      properties: {
        phone: { type: "string" },
        email: { type: "string" },
        address: { type: "string" },
        emergency_contact_name: { type: "string" },
        emergency_contact_phone: { type: "string" }
      }
    },
    conditions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          condition_name: { type: "string" },
          condition_type: { type: "string", enum: ["primary", "comorbidity"] },
          medication: { type: "string" },
          diagnosis_date: { type: "string" },
          notes: { type: "string" }
        }
      }
    },
    assessments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          test_name: { type: "string" },
          result_value: { type: "number" },
          result_value_secondary: { type: "number" },
          result_unit: { type: "string" },
          test_date: { type: "string" },
          notes: { type: "string" }
        }
      }
    },
    referral_info: {
      type: "object",
      properties: {
        referral_source_name: { type: "string" },
        referral_reason: { type: "string" },
        referral_date: { type: "string" }
      }
    },
    funding_info: {
      type: "object",
      properties: {
        funding_source: { type: "string" },
        dva_card_number: { type: "string" },
        medicare_number: { type: "string" },
        ndis_number: { type: "string" },
        workcover_claim_number: { type: "string" }
      }
    }
  }
};

export default function ClientDataExtractor({ 
  fileUrls, 
  client,
  allAssessments = [],
  onExtracted
}) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [processingAuthorityConfirmed, setProcessingAuthorityConfirmed] = useState(false);
  const [selectedItems, setSelectedItems] = useState({
    personal: {},
    conditions: [],
    assessments: [],
    referral: {},
    funding: {}
  });

  const handleExtract = async () => {
    if (!fileUrls || fileUrls.length === 0) return;
    if (fileUrls.length > DOCUMENT_EXTRACTION_MAX_FILES) {
      toast.error(`Select no more than ${DOCUMENT_EXTRACTION_MAX_FILES} documents for one extraction.`);
      return;
    }
    if (!client?.org_id) {
      toast.error('Client practice is required before document extraction.');
      return;
    }
    if (!processingAuthorityConfirmed) {
      toast.error('Confirm your authority to process these client documents before extraction.');
      return;
    }
    
    setIsExtracting(true);
    try {
      const result = await extractTenantDocumentData({
        org_id: client.org_id,
        file_urls: fileUrls,
        json_schema: EXTRACTION_SCHEMA,
        processing_authority_confirmed: true,
      });
      if (result?.status !== 'success' || !result.output) {
        toast.error(result?.status === 'error' && typeof result.details === 'string'
          ? result.details
          : 'The documents could not be extracted. No client data was changed.');
        return;
      }
      const allData = result.output;
      
      // Initialize selected items (all selected by default)
      setSelectedItems({
        personal: Object.keys(allData.personal_info || {}).reduce((acc, key) => ({ ...acc, [key]: true }), {}),
        conditions: (allData.conditions || []).map(() => true),
        assessments: (allData.assessments || []).map(() => true),
        referral: Object.keys(allData.referral_info || {}).reduce((acc, key) => ({ ...acc, [key]: true }), {}),
        funding: Object.keys(allData.funding_info || {}).reduce((acc, key) => ({ ...acc, [key]: true }), {})
      });
      
      setExtractedData(allData);
      setHasExtracted(true);
      
      const totalItems = 
        Object.keys(allData.personal_info || {}).length +
        (allData.conditions || []).length +
        (allData.assessments || []).length +
        Object.keys(allData.referral_info || {}).length +
        Object.keys(allData.funding_info || {}).length;
      
      if (totalItems > 0) {
        toast.success(`Found ${totalItems} data points in the document(s)`);
      } else {
        toast.info('No extractable data found in the uploaded documents');
      }
      
    } catch (error) {
      const failure = normalizeSdkError(error, {
        stage: 'extraction',
        fallbackDetails: 'Failed to extract data from documents',
      });
      console.warn('Client document extraction failed', sdkErrorLogMetadata(error, { stage: 'extraction' }));
      toast.error(failure.details);
    } finally {
      setIsExtracting(false);
    }
  };

  const togglePersonalField = (field) => {
    setSelectedItems(prev => ({
      ...prev,
      personal: { ...prev.personal, [field]: !prev.personal[field] }
    }));
  };

  const toggleCondition = (index) => {
    setSelectedItems(prev => ({
      ...prev,
      conditions: prev.conditions.map((val, i) => i === index ? !val : val)
    }));
  };

  const toggleAssessment = (index) => {
    setSelectedItems(prev => ({
      ...prev,
      assessments: prev.assessments.map((val, i) => i === index ? !val : val)
    }));
  };

  const handleSave = async () => {
    if (!extractedData) return;
    
    setIsSaving(true);
    try {
      const updates = {};
      
      // Personal info updates
      Object.entries(extractedData.personal_info || {}).forEach(([key, value]) => {
        if (selectedItems.personal[key] && value) {
          updates[key] = value;
        }
      });
      
      // Referral info updates
      Object.entries(extractedData.referral_info || {}).forEach(([key, value]) => {
        if (selectedItems.referral[key] && value) {
          updates[key] = value;
        }
      });
      
      // Funding info updates
      Object.entries(extractedData.funding_info || {}).forEach(([key, value]) => {
        if (selectedItems.funding[key] && value) {
          updates[key] = value;
        }
      });
      
      // Update client if there are any updates
      if (Object.keys(updates).length > 0) {
        await base44.entities.Client.update(client.id, updates);
      }
      
      // Add conditions
      const conditionsToAdd = (extractedData.conditions || [])
        .filter((_, i) => selectedItems.conditions[i])
        .filter(c => c.condition_name);
      
      for (const condition of conditionsToAdd) {
        await base44.entities.ClientCondition.create({
          org_id: client.org_id,
          client_id: client.id,
          condition_name: condition.condition_name,
          condition_type: condition.condition_type || 'comorbidity',
          medication: condition.medication || '',
          diagnosis_date: condition.diagnosis_date || null,
          notes: condition.notes || ''
        });
      }
      
      // Add assessments (those that match library)
      const assessmentsToAdd = (extractedData.assessments || [])
        .filter((_, i) => selectedItems.assessments[i])
        .filter(a => a.test_name);
      
      for (const assessment of assessmentsToAdd) {
        const matchedAssessment = allAssessments.find(a => 
          a.name.toLowerCase().includes(assessment.test_name.toLowerCase()) ||
          assessment.test_name.toLowerCase().includes(a.name.toLowerCase())
        );
        
        if (matchedAssessment) {
          await base44.entities.ClientAssessment.create({
            org_id: client.org_id,
            client_id: client.id,
            assessment_id: matchedAssessment.id,
            status: 'completed',
            result_value: assessment.result_value,
            assessment_date: assessment.test_date || todayLocal(),
            notes: `Extracted from document. ${assessment.notes || ''}`
          });
        }
      }
      
      const totalSaved = 
        Object.keys(updates).length +
        conditionsToAdd.length +
        assessmentsToAdd.filter(a => allAssessments.find(lib => 
          lib.name.toLowerCase().includes(a.test_name.toLowerCase())
        )).length;
      
      toast.success(`Added ${totalSaved} items to client profile`);
      if (onExtracted) onExtracted();
      
    } catch (error) {
      console.warn('Saving reviewed extracted data failed', sdkErrorLogMetadata(error, { stage: 'save_reviewed_data' }));
      toast.error('Failed to save extracted data');
    } finally {
      setIsSaving(false);
    }
  };

  if (!fileUrls || fileUrls.length === 0) return null;

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-blue-600" />
          Extract Client Data from Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasExtracted ? (
          <div className="text-center py-2">
            <p className="text-sm text-slate-600 mb-3">
              Scan documents for client information, assessments, conditions, and more.
            </p>
            <div className="flex items-start gap-2 text-left mb-3">
              <input
                id="client-document-processing-authority"
                type="checkbox"
                checked={processingAuthorityConfirmed}
                onChange={(event) => setProcessingAuthorityConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor="client-document-processing-authority" className="text-xs font-normal leading-snug">
                I confirm this practice has documented authority to send these client documents for the disclosed AI processing.
              </label>
            </div>
            <Button 
              onClick={handleExtract} 
              disabled={isExtracting || !processingAuthorityConfirmed}
              variant="outline"
              className="border-blue-300 hover:bg-blue-100"
            >
              {isExtracting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning documents...</>
              ) : (
                <><FileSearch className="w-4 h-4 mr-2" /> Scan for Client Data</>
              )}
            </Button>
          </div>
        ) : !extractedData || (
          Object.keys(extractedData.personal_info || {}).length === 0 &&
          (extractedData.conditions || []).length === 0 &&
          (extractedData.assessments || []).length === 0 &&
          Object.keys(extractedData.referral_info || {}).length === 0 &&
          Object.keys(extractedData.funding_info || {}).length === 0
        ) ? (
          <p className="text-sm text-slate-500 text-center py-2">
            No extractable client data found in the uploaded documents.
          </p>
        ) : (
          <div className="space-y-3">
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="conditions">Conditions</TabsTrigger>
                <TabsTrigger value="assessments">Tests</TabsTrigger>
                <TabsTrigger value="referral">Referral</TabsTrigger>
                <TabsTrigger value="funding">Funding</TabsTrigger>
              </TabsList>
              
              <TabsContent value="personal" className="space-y-2 mt-3">
                {Object.entries(extractedData.personal_info || {}).map(([key, value]) => (
                  <div key={key} className={`p-3 rounded-lg border transition-colors ${
                    selectedItems.personal[key] ? 'bg-white border-blue-300' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Label className="text-xs capitalize">{key.replace(/_/g, ' ')}</Label>
                        <p className="text-sm font-medium mt-1">{value}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePersonalField(key)}
                        className={selectedItems.personal[key] ? 'text-red-600' : 'text-green-600'}
                      >
                        {selectedItems.personal[key] ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
                {Object.keys(extractedData.personal_info || {}).length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No personal info found</p>
                )}
              </TabsContent>
              
              <TabsContent value="conditions" className="space-y-2 mt-3">
                {(extractedData.conditions || []).map((condition, index) => (
                  <div key={index} className={`p-3 rounded-lg border transition-colors ${
                    selectedItems.conditions[index] ? 'bg-white border-blue-300' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{condition.condition_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {condition.condition_type || 'comorbidity'}
                          </Badge>
                        </div>
                        {condition.medication && <p className="text-xs text-slate-600">Medication: {condition.medication}</p>}
                        {condition.diagnosis_date && <p className="text-xs text-slate-600">Diagnosed: {condition.diagnosis_date}</p>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCondition(index)}
                        className={selectedItems.conditions[index] ? 'text-red-600' : 'text-green-600'}
                      >
                        {selectedItems.conditions[index] ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
                {(extractedData.conditions || []).length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No conditions found</p>
                )}
              </TabsContent>
              
              <TabsContent value="assessments" className="space-y-2 mt-3">
                {(extractedData.assessments || []).map((assessment, index) => {
                  const matched = allAssessments.find(a => 
                    a.name.toLowerCase().includes(assessment.test_name.toLowerCase()) ||
                    assessment.test_name.toLowerCase().includes(a.name.toLowerCase())
                  );
                  return (
                    <div key={index} className={`p-3 rounded-lg border transition-colors ${
                      selectedItems.assessments[index] ? 'bg-white border-blue-300' : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{assessment.test_name}</span>
                            {matched ? (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Matched
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-yellow-700 border-yellow-300 text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                No match
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">
                            Result: {assessment.result_value} {assessment.result_unit || ''}
                          </p>
                          {assessment.test_date && (
                            <p className="text-xs text-slate-600">Date: {assessment.test_date}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAssessment(index)}
                          className={selectedItems.assessments[index] ? 'text-red-600' : 'text-green-600'}
                        >
                          {selectedItems.assessments[index] ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {(extractedData.assessments || []).length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No assessments found</p>
                )}
              </TabsContent>
              
              <TabsContent value="referral" className="space-y-2 mt-3">
                {Object.entries(extractedData.referral_info || {}).map(([key, value]) => (
                  <div key={key} className={`p-3 rounded-lg border transition-colors ${
                    selectedItems.referral[key] ? 'bg-white border-blue-300' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Label className="text-xs capitalize">{key.replace(/_/g, ' ')}</Label>
                        <p className="text-sm font-medium mt-1">{value}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedItems(prev => ({
                          ...prev,
                          referral: { ...prev.referral, [key]: !prev.referral[key] }
                        }))}
                        className={selectedItems.referral[key] ? 'text-red-600' : 'text-green-600'}
                      >
                        {selectedItems.referral[key] ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
                {Object.keys(extractedData.referral_info || {}).length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No referral info found</p>
                )}
              </TabsContent>
              
              <TabsContent value="funding" className="space-y-2 mt-3">
                {Object.entries(extractedData.funding_info || {}).map(([key, value]) => (
                  <div key={key} className={`p-3 rounded-lg border transition-colors ${
                    selectedItems.funding[key] ? 'bg-white border-blue-300' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Label className="text-xs capitalize">{key.replace(/_/g, ' ')}</Label>
                        <p className="text-sm font-medium mt-1">{value}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedItems(prev => ({
                          ...prev,
                          funding: { ...prev.funding, [key]: !prev.funding[key] }
                        }))}
                        className={selectedItems.funding[key] ? 'text-red-600' : 'text-green-600'}
                      >
                        {selectedItems.funding[key] ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
                {Object.keys(extractedData.funding_info || {}).length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No funding info found</p>
                )}
              </TabsContent>
            </Tabs>
            
            <Button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-blue-600 hover:bg-blue-700 mt-4"
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                'Add Selected Items to Client Profile'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
