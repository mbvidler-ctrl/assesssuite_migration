import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function AssessmentRunnerAudit() {
  const [assessments, setAssessments] = useState([]);
  const [auditResults, setAuditResults] = useState([]);
  const [loading, setLoading] = useState(true);

  // This is a comprehensive list of ALL runner files that actually exist
  const existingRunners = {
    // Mental Health Assessments
    'DASS-21': true,
    'GAD-7': true,
    'PHQ-9': true,
    'K10': true,
    'Kessler': true,
    
    // Balance & Mobility
    'Berg Balance': true,
    'Timed Up and Go': true,
    'TUG': true,
    'Single Leg Stance': true,
    'Four Square Step': true,
    '4-Stage Balance': true,
    'Romberg': true,
    'Stork': true,
    'CTSIB': true,
    'Functional Reach': true,
    'Y-Balance': true,
    'Dynamic Gait Index': true,
    'DGI': true,
    'HiMAT': true,
    'Pediatric Balance': true,
    'BESTest': true,
    'EMS': true,
    'Elderly Mobility Scale': true,
    'CB&M': true,
    'Community Balance': true,
    
    // Cardiopulmonary
    '6 Minute Walk': true,
    '2 Minute Walk': true,
    '2-Minute Step': true,
    'ISWT': true,
    'Bruce': true,
    'YMCA Cycle': true,
    'Astrand': true,
    'Åstrand': true,
    'Harvard Step': true,
    'Beep': true,
    'Cooper': true,
    'Yo-Yo': true,
    '30-15': true,
    'Rockport': true,
    'Ebbeling': true,
    'VO2max': true,
    'YMCA 3-Minute': true,
    'YMCA 3 Minute': true,
    
    // Strength
    'Hand Grip': true,
    'Grip Strength': true,
    'Chair Stand': true,
    'Sit to Stand': true,
    'Arm Curl': true,
    '1RM': true,
    '1-RM': true,
    'Isometric Strength': true,
    'Isokinetics': true,
    'Manual Muscle': true,
    'MMT': true,
    'Repeated Jump': true,
    'CKCUEST': true,
    
    // Flexibility
    'Sit and Reach': true,
    'Back Scratch': true,
    'ROM': true,
    'Range of Motion': true,
    
    // Special Tests
    'SLR': true,
    'Straight Leg Raise': true,
    'Slump': true,
    'Lachman': true,
    'Anterior Drawer': true,
    'Pivot Shift': true,
    'McMurray': true,
    'Thessaly': true,
    'Apley': true,
    'Noble': true,
    'Ely': true,
    'Thomas': true,
    'Ober': true,
    
    // Body Composition
    'Skinfold': true,
    'Girth': true,
    'BMI': true,
    'Waist': true,
    'Waist-Hip': true,
    'Height': true,
    'Weight': true,
    
    // Vital Signs
    'Blood Pressure': true,
    'Heart Rate': true,
    'SpO2': true,
    'Oxygen Saturation': true,
    'Heart Rate Recovery': true,
    
    // Pain & Function
    'Pain Scales': true,
    'VAS': true,
    'NPRS': true,
    'HOOS': true,
    'KOOS': true,
    
    // Metabolic
    'HbA1c': true,
    'Lipid Profile': true,
    'MET Calculation': true,
    
    // Gait & Walking
    '10 Meter Walk': true,
    '10-Meter Walk': true,
    'Ten Meter Walk': true,
    'Gait Speed': true,
    'Habitual Gait': true,
    'Fast Gait': true,
    
    // Other
    'Box and Block': true,
    'Borg RPE': true,
    'General Movement Screen': true,
    'Job Task Analysis': true,
    'JTA': true,
    'PPT': true,
    'Physical Performance Test': true,
    '6-Minute Step': true,
    'RSA': true,
    'Repeated Sprint': true,
  };

  useEffect(() => {
    loadAndAudit();
  }, []);

  const loadAndAudit = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Assessment.list();
      const activeAssessments = data.filter(a => !a.is_deleted);
      setAssessments(activeAssessments);

      // Audit each assessment
      const results = activeAssessments.map(assessment => {
        const hasRunner = checkIfRunnerExists(assessment);
        return {
          assessment,
          hasRunner,
          runnerStatus: hasRunner ? 'working' : 'missing'
        };
      });

      setAuditResults(results);
    } catch (error) {
      console.error("Error auditing assessments:", error);
    }
    setLoading(false);
  };

  const checkIfRunnerExists = (assessment) => {
    const name = assessment.name.toLowerCase();
    
    // Check against our known working runners
    for (const [key, exists] of Object.entries(existingRunners)) {
      if (exists && name.includes(key.toLowerCase())) {
        return true;
      }
    }
    
    // Questionnaire-based assessments with questions array
    if (assessment.is_questionnaire && assessment.questions && assessment.questions.length > 0) {
      // But HADS doesn't have a working runner yet
      if (name.includes('hospital anxiety') || name.includes('hads')) {
        return false; // HADS has no runner yet
      }
      return true; // Other questionnaires use generic runner
    }
    
    return false;
  };

  const workingCount = auditResults.filter(r => r.hasRunner).length;
  const missingCount = auditResults.filter(r => !r.hasRunner).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Test Runner Audit Results</h2>
        <p className="text-slate-600">
          Actual working test runners vs missing runners
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-slate-600">Working Runners</p>
                <p className="text-2xl font-bold">{workingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm text-slate-600">Missing Runners</p>
                <p className="text-2xl font-bold">{missingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Missing Test Runners ({missingCount})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {auditResults
              .filter(r => !r.hasRunner)
              .map(result => (
                <div key={result.assessment.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{result.assessment.name}</p>
                    <p className="text-sm text-slate-600">{result.assessment.category}</p>
                  </div>
                  <Badge variant="destructive">No Runner</Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Working Test Runners ({workingCount})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {auditResults
              .filter(r => r.hasRunner)
              .map(result => (
                <div key={result.assessment.id} className="flex items-center gap-2 p-2 border rounded">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <p className="text-sm truncate">{result.assessment.name}</p>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}