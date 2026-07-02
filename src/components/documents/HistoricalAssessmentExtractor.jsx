import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  CheckCircle, 
  ClipboardList,
  Calendar,
  TrendingUp,
  Plus,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const ASSESSMENT_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    assessments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          test_name: { type: "string", description: "Name of the test/assessment (e.g., Timed Up and Go, 6 Minute Walk Test, Berg Balance Scale, Blood Pressure)" },
          result_value: { type: "number", description: "Numerical result/score of the test. For blood pressure ONLY, this is the systolic value." },
          result_value_secondary: { type: "number", description: "ONLY for blood pressure measurements: the diastolic value. Leave null/empty for all other tests." },
          result_unit: { type: "string", description: "Unit of measurement (e.g., seconds, meters, score, repetitions, mmHg, bpm)" },
          test_date: { type: "string", description: "Date the test was performed in YYYY-MM-DD format" },
          performed_by: { type: "string", description: "Name or profession of who performed the test" },
          notes: { type: "string", description: "Any additional notes or observations about the test result" }
        }
      },
      description: "Array of assessment/test results found in the document"
    }
  }
};

// Map common test names to our assessment library
const TEST_NAME_MAPPINGS = {
  'timed up and go': 'Timed Up and Go (TUG)',
  'tug': 'Timed Up and Go (TUG)',
  '6 minute walk': '6-Minute Walk Test (6MWT)',
  '6mwt': '6-Minute Walk Test (6MWT)',
  'six minute walk': '6-Minute Walk Test (6MWT)',
  'berg balance': 'Berg Balance Scale',
  'berg': 'Berg Balance Scale',
  'single leg stance': 'Single Leg Stance (SLS)',
  'sls': 'Single Leg Stance (SLS)',
  'grip strength': 'Hand Grip Strength',
  'hand grip': 'Hand Grip Strength',
  '30 second sit to stand': '30-Second Sit-to-Stand',
  'sit to stand': '30-Second Sit-to-Stand',
  '10 meter walk': '10-Meter Walk Test (10MWT)',
  '10mwt': '10-Meter Walk Test (10MWT)',
  'gait speed': 'Gait Speed Test',
  '4 stage balance': '4-Stage Balance Test',
  'four stage balance': '4-Stage Balance Test',
  'y balance': 'Y-Balance Test'
};

// Helper function to determine if a test is blood pressure
const isBloodPressureTest = (testName) => {
  if (!testName) return false;
  const normalizedName = testName.toLowerCase().trim();
  return normalizedName.includes('blood pressure') || 
         normalizedName.includes('bp ') || 
         normalizedName === 'bp' ||
         normalizedName.startsWith('bp ') ||
         normalizedName.endsWith(' bp');
};

export default function HistoricalAssessmentExtractor({ 
  fileUrls, 
  clientId, 
  onExtracted,
  allAssessments = [],
  isNewClient = false
}) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedAssessments, setExtractedAssessments] = useState([]);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const findMatchingAssessment = (testName) => {
    if (!testName) return null;
    
    const normalizedName = testName.toLowerCase().trim();
    
    // Check direct mappings first
    for (const [key, value] of Object.entries(TEST_NAME_MAPPINGS)) {
      if (normalizedName.includes(key)) {
        return allAssessments.find(a => a.name === value);
      }
    }
    
    // Try fuzzy match with assessment library
    return allAssessments.find(a => 
      a.name.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(a.name.toLowerCase()) ||
      (a.search_tags && a.search_tags.some(tag => normalizedName.includes(tag.toLowerCase())))
    );
  };

  const handleExtract = async () => {
    if (!fileUrls || fileUrls.length === 0) return;
    
    setIsExtracting(true);
    try {
      const allExtracted = [];
      
      for (const fileUrl of fileUrls) {
        const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: fileUrl,
          json_schema: ASSESSMENT_EXTRACTION_SCHEMA
        });
        
        if (result.status === 'success' && result.output?.assessments) {
          for (const assessment of result.output.assessments) {
            const matchedAssessment = findMatchingAssessment(assessment.test_name);
            const isBP = isBloodPressureTest(assessment.test_name);
            
            allExtracted.push({
              ...assessment,
              matched_assessment: matchedAssessment,
              include: !!matchedAssessment,
              is_blood_pressure: isBP,
              // Clear secondary value if not BP
              result_value_secondary: isBP ? assessment.result_value_secondary : null,
              id: Math.random().toString(36).substr(2, 9)
            });
          }
        }
      }
      
      setExtractedAssessments(allExtracted);
      setHasExtracted(true);
      
      if (allExtracted.length > 0) {
        toast.success(`Found ${allExtracted.length} assessment(s) in the document(s)`);
      } else {
        toast.info('No assessments found in the uploaded documents');
      }
      
    } catch (error) {
      console.error('Error extracting assessments:', error);
      toast.error('Failed to extract assessments');
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleInclude = (id) => {
    setExtractedAssessments(prev => 
      prev.map(a => a.id === id ? { ...a, include: !a.include } : a)
    );
  };

  const updateAssessmentField = (id, field, value) => {
    setExtractedAssessments(prev =>
      prev.map(a => a.id === id ? { ...a, [field]: value } : a)
    );
  };

  const handleSaveAssessments = async () => {
    const toSave = extractedAssessments.filter(a => a.include && a.matched_assessment);
    
    if (toSave.length === 0) {
      toast.error('No assessments selected to save');
      return;
    }
    
    // For new clients, just pass the assessments to parent to save after client creation
    if (isNewClient) {
      toast.success(`${toSave.length} assessment(s) will be saved with the new client`);
      if (onExtracted) onExtracted(toSave);
      return;
    }
    
    // For existing clients, save immediately
    setIsSaving(true);
    try {
      for (const assessment of toSave) {
        const notes = `Historical result from external report. ${assessment.performed_by ? `Performed by: ${assessment.performed_by}. ` : ''}${assessment.notes || ''}${assessment.is_blood_pressure && assessment.result_value_secondary !== undefined && assessment.result_value_secondary !== null ? ` Diastolic: ${assessment.result_value_secondary}` : ''}`;
        
        await base44.entities.ClientAssessment.create({
          client_id: clientId,
          assessment_id: assessment.matched_assessment.id,
          appointment_id: null,
          status: 'completed',
          result_value: assessment.result_value,
          assessment_date: assessment.test_date || new Date().toISOString().split('T')[0],
          notes: notes.trim(),
          source: 'uploaded'
        });
      }
      
      toast.success(`Saved ${toSave.length} historical assessment(s)`);
      if (onExtracted) onExtracted(toSave);
      
    } catch (error) {
      console.error('Error saving assessments:', error);
      toast.error('Failed to save assessments');
    } finally {
      setIsSaving(false);
    }
  };

  if (!fileUrls || fileUrls.length === 0) return null;

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-purple-600" />
          Extract Historical Assessments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasExtracted ? (
          <div className="text-center py-2">
            <p className="text-sm text-slate-600 mb-3">
              Scan uploaded documents for any test results (TUG, 6MWT, Berg, etc.) to add to the client's history.
            </p>
            <Button 
              onClick={handleExtract} 
              disabled={isExtracting}
              variant="outline"
              className="border-purple-300 hover:bg-purple-100"
            >
              {isExtracting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning documents...</>
              ) : (
                <><TrendingUp className="w-4 h-4 mr-2" /> Scan for Test Results</>
              )}
            </Button>
          </div>
        ) : extractedAssessments.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-2">
            No assessment results found in the uploaded documents.
          </p>
        ) : (
          <div className="space-y-3">
            {extractedAssessments.map((assessment) => (
              <div 
                key={assessment.id}
                className={`p-3 rounded-lg border transition-colors ${
                  assessment.include 
                    ? 'bg-white border-purple-300' 
                    : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{assessment.test_name}</span>
                      {assessment.matched_assessment ? (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Matched
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-700 border-yellow-300 text-xs">
                          No match found
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Result</Label>
                        {assessment.is_blood_pressure ? (
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={assessment.result_value || ''}
                              onChange={(e) => updateAssessmentField(assessment.id, 'result_value', parseFloat(e.target.value))}
                              className="h-8 text-sm w-20"
                              placeholder="Sys"
                            />
                            <span className="text-xs text-slate-500 self-center">/</span>
                            <Input
                              type="number"
                              value={assessment.result_value_secondary || ''}
                              onChange={(e) => updateAssessmentField(assessment.id, 'result_value_secondary', parseFloat(e.target.value))}
                              className="h-8 text-sm w-20"
                              placeholder="Dia"
                            />
                            <span className="text-xs text-slate-500 self-center whitespace-nowrap">
                              {assessment.result_unit || 'mmHg'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={assessment.result_value || ''}
                              onChange={(e) => updateAssessmentField(assessment.id, 'result_value', parseFloat(e.target.value))}
                              className="h-8 text-sm"
                              placeholder="Value"
                            />
                            <span className="text-xs text-slate-500 self-center whitespace-nowrap">
                              {assessment.result_unit || assessment.matched_assessment?.unit_of_measure || ''}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input
                          type="date"
                          value={assessment.test_date || ''}
                          onChange={(e) => updateAssessmentField(assessment.id, 'test_date', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    
                    {assessment.performed_by && (
                      <p className="text-xs text-slate-500">
                        Performed by: {assessment.performed_by}
                      </p>
                    )}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleInclude(assessment.id)}
                    className={assessment.include ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                  >
                    {assessment.include ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            ))}
            
            <Button 
              onClick={handleSaveAssessments}
              disabled={isSaving || !extractedAssessments.some(a => a.include && a.matched_assessment)}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : isNewClient ? (
                <>Include {extractedAssessments.filter(a => a.include && a.matched_assessment).length} Assessment(s) with New Client</>
              ) : (
                <>Save {extractedAssessments.filter(a => a.include && a.matched_assessment).length} Assessment(s) to History</>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}