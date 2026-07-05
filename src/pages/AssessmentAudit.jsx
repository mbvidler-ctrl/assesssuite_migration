import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasInteractiveRunner } from "@/components/assessments/assessmentRunnerUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Activity,
  Loader2,
  Download,
  Wrench,
  ThumbsUp,
  ThumbsDown,
  Code,
  ShieldCheck
} from "lucide-react";
import { Toaster, toast } from "sonner";

export default function AssessmentAudit() {
  const [currentUser, setCurrentUser] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [auditResults, setAuditResults] = useState(() => {
    const savedResults = localStorage.getItem('assessmentAuditResults');
    return savedResults ? JSON.parse(savedResults) : [];
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [fixingAssessmentId, setFixingAssessmentId] = useState(null);
  const [generatingFixes, setGeneratingFixes] = useState(false);
  const [creatingTestClient, setCreatingTestClient] = useState(false);
  const [testClientId, setTestClientId] = useState(null);

  useEffect(() => {
    (async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);

      if (user.role !== 'admin') {
        setIsLoading(false);
        return;
      }

      loadAssessments();
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem('assessmentAuditResults', JSON.stringify(auditResults));
  }, [auditResults]);

  const createTestClient = async () => {
    setCreatingTestClient(true);
    try {
      // Get org_id from existing assessments or use known value
      const orgId = '6953a08980390d0dd6646237';
      const today = new Date().toISOString().split('T')[0];

      // Check if Superagent One already exists
      const existingClients = await base44.entities.Client.filter({ email: 'superagent@test.com' });
      let client;
      if (existingClients.length > 0) {
        client = existingClients[0];
        toast.info('Test client already exists — adding any missing assessments...');
      } else {
        client = await base44.entities.Client.create({
          full_name: 'Superagent One',
          date_of_birth: '1990-01-01',
          gender: 'male',
          email: 'superagent@test.com',
          phone: '0400000000',
          org_id: orgId,
          assessment_consent: true,
          privacy_consent: true,
          cancellation_policy_agreed: true,
          consent_confirmed: true,
          consent_date: today,
          pricing_explained: true,
          apss_completed: false,
          additional_referrals: [],
          client_completed_sections: [],
        });
        toast.success('Created test client: Superagent One');
      }

      // Get all active runner assessments (paginate to get all)
      let allAssessments = [];
      let page = 0;
      const pageSize = 100;
      while (true) {
        const batch = await base44.entities.Assessment.list({ limit: pageSize, skip: page * pageSize });
        allAssessments = allAssessments.concat(batch);
        if (batch.length < pageSize) break;
        page++;
      }
      const active = allAssessments.filter(a => !a.is_deleted && a.has_test_runner);

      // Get existing pending assessments for this client
      const existing = await base44.entities.ClientAssessment.filter({ client_id: client.id });
      const existingAssessmentIds = new Set(existing.map(a => a.assessment_id));

      let created = 0;
      for (const assessment of active) {
        if (!existingAssessmentIds.has(assessment.id)) {
          await base44.entities.ClientAssessment.create({
            client_id: client.id,
            assessment_id: assessment.id,
            org_id: orgId,
            status: 'pending',
            assessment_date: today,
            additional_data: {},
            notes: '',
          });
          created++;
        }
      }

      setTestClientId(client.id);
      toast.success(`Ready! ${created} pending assessments added for Superagent One. Find them in the Clients page.`, { duration: 8000 });
    } catch (error) {
      toast.error('Error creating test client: ' + error.message);
      console.error(error);
    } finally {
      setCreatingTestClient(false);
    }
  };

  const loadAssessments = async () => {
    setIsLoading(true);
    try {
      const data = await base44.entities.Assessment.list();
      const active = data.filter(a => !a.is_deleted);
      setAssessments(active);
      return active;
    } catch (error) {
      console.error("Error loading assessments:", error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const runAudit = async () => {
    setIsRunning(true);
    setGeneratingFixes(false);
    
    // Reload assessments to get latest data
    const latestAssessments = await loadAssessments();
    
    const results = [];
    for (const assessment of latestAssessments) {
      const checks = runComplianceChecks(assessment);
      const failedChecks = checks.filter(c => c.status === 'fail');
      const warnings = checks.filter(c => c.status === 'warning');
      const passed = checks.filter(c => c.status === 'pass');
      
      const result = {
        assessment,
        checks,
        failedChecks,
        warnings,
        passed,
        isCompliant: failedChecks.length === 0,
        complianceScore: (passed.length / checks.length) * 100,
        proposedFixes: []
      };

      // Generate proposed fixes for non-compliant assessments
      if (!result.isCompliant) {
        result.proposedFixes = await generateProposedFixes(assessment, failedChecks);
      }

      results.push(result);
    }
    
    setAuditResults(results);
    setIsRunning(false);
  };

  const generateAllFixes = async () => {
    setGeneratingFixes(true);
    let processed = 0;
    const nonCompliant = auditResults.filter(r => !r.isCompliant);
    
    for (const result of nonCompliant) {
      for (const fix of result.proposedFixes) {
        if (fix.status === 'pending') {
          try {
            await applyFix(result, fix);
            processed++;
            toast.info(`Generated ${processed}/${nonCompliant.reduce((sum, r) => sum + r.proposedFixes.filter(f => f.status === 'pending').length, 0)} fixes...`);
          } catch (error) {
            console.error('Error generating fix:', error);
          }
        }
      }
    }
    
    setGeneratingFixes(false);
    toast.success(`Generated ${processed} fixes! Review and approve each one.`);
  };

  const approveAllTestRunners = () => {
    const readyFixes = [];
    
    auditResults.forEach(result => {
      result.proposedFixes?.forEach(fix => {
        if (fix.type === 'test_runner' && fix.status === 'ready' && fix.code) {
          const componentName = result.assessment.name.replace(/[^a-zA-Z0-9]/g, '');
          const fileName = `components/assessments/${componentName}Runner.jsx`;
          readyFixes.push({
            fileName,
            code: fix.code,
            assessmentName: result.assessment.name
          });
          fix.status = 'approved';
          fix.fileName = fileName;
        }
      });
    });

    if (readyFixes.length === 0) {
      toast.error('No ready test runners to approve');
      return;
    }

    // Create batch creation prompt
    const prompt = `Create these ${readyFixes.length} test runner files:\n\n${readyFixes.map((f, i) => 
      `${i + 1}. ${f.fileName} (for ${f.assessmentName})`
    ).join('\n')}\n\nI'll send the code for each file next.`;

    const allCode = readyFixes.map(f => 
      `FILE: ${f.fileName}\n\n${f.code}\n\n${'='.repeat(80)}\n\n`
    ).join('');

    navigator.clipboard.writeText(allCode);
    
    setAuditResults([...auditResults]);
    toast.success(`Batch request for ${readyFixes.length} files copied to clipboard! Paste it to create all files at once.`, { duration: 8000 });
  };

  const runComplianceChecks = (assessment) => {
    const checks = [];

    // Check 1: Interactive test runner exists
    // Use the utility function to determine if a runner should exist
    const requiresInteractiveRunner = assessment.is_questionnaire || hasInteractiveRunner(assessment.name);

    // Assume runners exist if they're questionnaires or have dedicated runners
    const runnerExists = requiresInteractiveRunner;
      assessment.name.toLowerCase().includes('heart rate') ||
      assessment.name.toLowerCase().includes('spo2') ||
      assessment.name.toLowerCase().includes('6 minute walk') ||
      assessment.name.toLowerCase().includes('2-minute step') ||
      assessment.name.toLowerCase().includes('single leg stance') ||
      assessment.name.toLowerCase().includes('y-balance') ||
      assessment.name.toLowerCase().includes('10-meter walk') ||
      assessment.name.toLowerCase().includes('10 metre walk') ||
      assessment.name.toLowerCase().includes('10mwt') ||
      assessment.name.toLowerCase().includes('4-stage balance') ||
      assessment.name.toLowerCase().includes('heart rate recovery') ||
      assessment.name.toLowerCase().includes('gait speed') ||
      assessment.name.toLowerCase().includes('dass') ||
      assessment.name.toLowerCase().includes('hospital anxiety') ||
      assessment.name.toLowerCase().includes('hospital anxiety and depression') ||
      assessment.name.toLowerCase().includes('hads') ||
      assessment.name.toLowerCase().includes('hba1c') ||
      assessment.name.toLowerCase().includes('glycated hemoglobin') ||
      assessment.name.toLowerCase().includes('lipid profile') ||
      assessment.name.toLowerCase().includes('metabolic equivalent') ||
      assessment.name.toLowerCase().includes('met calculation') ||
      assessment.name.toLowerCase().includes('6-minute step') ||
      assessment.name.toLowerCase().includes('six minute step') ||
      assessment.name.toLowerCase().includes('ymca 3-minute') ||
      assessment.name.toLowerCase().includes('ymca step') ||
      assessment.name.toLowerCase().includes('physical performance test') ||
      assessment.name.toLowerCase().includes('ppt') ||
      assessment.name.toLowerCase().includes('repeated sprint ability') ||
      assessment.name.toLowerCase().includes('vo2max') ||
      assessment.name.toLowerCase().includes('graded exercise test') ||
      assessment.name.toLowerCase().includes('gxt') ||
      assessment.name.toLowerCase().includes('general movement screen') ||
      assessment.name.toLowerCase().includes('clinical frailty scale') ||
      assessment.name.toLowerCase().includes('pediatric balance') ||
      assessment.name.toLowerCase().includes('bruininks') ||
      assessment.name.toLowerCase().includes('bot-2') ||
      assessment.name.toLowerCase().includes('motor proficiency') ||
      assessment.name.toLowerCase().includes('1rm') ||
      assessment.name.toLowerCase().includes('1-rm') ||
      assessment.name.toLowerCase().includes('repetition maximum') ||
      assessment.name.toLowerCase().includes('isometric strength') ||
      assessment.name.toLowerCase().includes('isokinetic') ||
      assessment.name.toLowerCase().includes('dynamometry') ||
      assessment.name.toLowerCase().includes('ely') ||
      assessment.name.toLowerCase().includes('thomas test') ||
      assessment.name.toLowerCase().includes('ober') ||
      assessment.name.toLowerCase().includes('straight leg raise') ||
      assessment.name.toLowerCase().includes('slr') ||
      assessment.name.toLowerCase().includes('slump') ||
      assessment.name.toLowerCase().includes('lachman') ||
      assessment.name.toLowerCase().includes('anterior drawer') ||
      assessment.name.toLowerCase().includes('pivot shift') ||
      assessment.name.toLowerCase().includes('mcmurray') ||
      assessment.name.toLowerCase().includes('thessaly') ||
      assessment.name.toLowerCase().includes('apley') ||
      assessment.name.toLowerCase().includes('noble compression') ||
      assessment.name.toLowerCase().includes('bruce') ||
      assessment.name.toLowerCase().includes('naughton') ||
      assessment.name.toLowerCase().includes('ymca cycle') ||
      assessment.name.toLowerCase().includes('astrand') ||
      assessment.name.toLowerCase().includes('wingate') ||
      assessment.name.toLowerCase().includes('2-minute walk') ||
      assessment.name.toLowerCase().includes('2 minute walk') ||
      assessment.name.toLowerCase().includes('12-minute') ||
      assessment.name.toLowerCase().includes('cooper') ||
      assessment.name.toLowerCase().includes('rockport') ||
      assessment.name.toLowerCase().includes('20-meter shuttle') ||
      assessment.name.toLowerCase().includes('beep test') ||
      assessment.name.toLowerCase().includes('yo-yo') ||
      assessment.name.toLowerCase().includes('30-15') ||
      assessment.name.toLowerCase().includes('bia') ||
      assessment.name.toLowerCase().includes('bioelectrical impedance') ||
      assessment.name.toLowerCase().includes('dexa') ||
      assessment.name.toLowerCase().includes('bod pod') ||
      assessment.name.toLowerCase().includes('hydrostatic') ||
      assessment.name.toLowerCase().includes('fasting blood glucose') ||
      assessment.name.toLowerCase().includes('ogtt') ||
      assessment.name.toLowerCase().includes('oral glucose tolerance') ||
      assessment.name.toLowerCase().includes('rmr') ||
      assessment.name.toLowerCase().includes('resting metabolic') ||
      assessment.name.toLowerCase().includes('l test') ||
      assessment.name.toLowerCase().includes('figure of eight') ||
      assessment.name.toLowerCase().includes('figure-of-8') ||
      assessment.name.toLowerCase().includes('cb&m') ||
      assessment.name.toLowerCase().includes('community balance') ||
      assessment.name.toLowerCase().includes('bestest') ||
      assessment.name.toLowerCase().includes('fes') ||
      assessment.name.toLowerCase().includes('falls efficacy') ||
      assessment.name.toLowerCase().includes('conley') ||
      assessment.name.toLowerCase().includes('ems') ||
      assessment.name.toLowerCase().includes('elderly mobility') ||
      assessment.name.toLowerCase().includes('ases') ||
      assessment.name.toLowerCase().includes('american shoulder') ||
      assessment.name.toLowerCase().includes('constant-murley') ||
      assessment.name.toLowerCase().includes('constant murley') ||
      assessment.name.toLowerCase().includes('single leg hop') ||
      assessment.name.toLowerCase().includes('vertical jump') ||
      assessment.name.toLowerCase().includes('sargent') ||
      assessment.name.toLowerCase().includes('standing long jump') ||
      assessment.name.toLowerCase().includes('illinois agility') ||
      assessment.name.toLowerCase().includes('t-test agility') ||
      assessment.name.toLowerCase().includes('505 agility') ||
      assessment.name.toLowerCase().includes('hexagon agility') ||
      assessment.name.toLowerCase().includes('drop vertical jump') ||
      assessment.name.toLowerCase().includes('10 second') ||
      assessment.name.toLowerCase().includes('repeated jump') ||
      assessment.name.toLowerCase().includes('ckcuest') ||
      assessment.name.toLowerCase().includes('closed kinetic chain upper extremity') ||
      assessment.name.toLowerCase().includes('reactive strength index') ||
      assessment.name.toLowerCase().includes('rsi') ||
      assessment.name.toLowerCase().includes('clock drawing') ||
      assessment.name.toLowerCase().includes('trail making') ||
      assessment.name.toLowerCase().includes('tmt') ||
      assessment.name.toLowerCase().includes('stroop') ||
      assessment.name.toLowerCase().includes('digit span') ||
      assessment.name.toLowerCase().includes('modified ashworth') ||
      assessment.name.toLowerCase().includes('tardieu') ||
      assessment.name.toLowerCase().includes('functional ambulation categories') ||
      assessment.name.toLowerCase().includes('fac') ||
      assessment.name.toLowerCase().includes('modified rankin') ||
      assessment.name.toLowerCase().includes('motor assessment scale') ||
      assessment.name.toLowerCase().includes('mas-stroke') ||
      assessment.name.toLowerCase().includes('nine hole peg') ||
      assessment.name.toLowerCase().includes('nine-hole peg') ||
      assessment.name.toLowerCase().includes('purdue pegboard') ||
      assessment.name.toLowerCase().includes('grooved pegboard') ||
      assessment.name.toLowerCase().includes('fvc') ||
      assessment.name.toLowerCase().includes('forced vital capacity') ||
      assessment.name.toLowerCase().includes('spirometry') ||
      assessment.name.toLowerCase().includes('pefr') ||
      assessment.name.toLowerCase().includes('peak expiratory flow') ||
      assessment.name.toLowerCase().includes('romberg') ||
      assessment.name.toLowerCase().includes('stork test') ||
      assessment.name.toLowerCase().includes('astrand-rhyming') ||
      assessment.name.toLowerCase().includes('åstrand-rhyming') ||
      assessment.name.toLowerCase().includes('tecumseh step') ||
      assessment.name.toLowerCase().includes('grocery shelving') ||
      assessment.name.toLowerCase().includes('gst') ||
      assessment.name.toLowerCase().includes('maximal push') ||
      assessment.name.toLowerCase().includes('timed push') ||
      assessment.name.toLowerCase().includes('press-up') ||
      assessment.name.toLowerCase().includes('static squat') ||
      assessment.name.toLowerCase().includes('wall squat') ||
      assessment.name.toLowerCase().includes('squat test') ||
      assessment.name.toLowerCase().includes('ymca bench press') ||
      assessment.name.toLowerCase().includes('medicine ball throw') ||
      assessment.name.toLowerCase().includes('5xsts') ||
      assessment.name.toLowerCase().includes('five times sit') ||
      assessment.name.toLowerCase().includes('shoulder tug') ||
      assessment.name.toLowerCase().includes('pastor') ||
      assessment.name.toLowerCase().includes('step tap') ||
      assessment.name.toLowerCase().includes('biering') ||
      assessment.name.toLowerCase().includes('sørensen') ||
      assessment.name.toLowerCase().includes('sorensen') ||
      assessment.name.toLowerCase().includes('back extension') ||
      assessment.name.toLowerCase().includes('four square') ||
      assessment.name.toLowerCase().includes('tri-level arm') ||
      assessment.name.toLowerCase().includes('tri level arm') ||
      assessment.name.toLowerCase().includes('harvard step') ||
      assessment.name.toLowerCase().includes('home step') ||
      assessment.name.toLowerCase().includes('6 meter walk') ||
      assessment.name.toLowerCase().includes('6-meter walk') ||
      assessment.name.toLowerCase().includes('six meter walk') ||
      assessment.name.toLowerCase().includes('himat') ||
      assessment.name.toLowerCase().includes('high-level mobility') ||
      assessment.name.toLowerCase().includes('box and block') ||
      assessment.name.toLowerCase().includes('mcgill core') ||
      assessment.name.toLowerCase().includes('60 second sit') ||
      assessment.name.toLowerCase().includes('60-second sit') ||
      assessment.name.toLowerCase().includes('plank hold') ||
      assessment.name.toLowerCase().includes('body fat') ||
      assessment.name.toLowerCase().includes('skinfold') ||
      assessment.name.toLowerCase().includes('girth') ||
      assessment.name.toLowerCase().includes('waist') ||
      assessment.name.toLowerCase().includes('hip ratio') ||
      assessment.name.toLowerCase().includes('whr') ||
      assessment.name.toLowerCase().includes('bmi') ||
      assessment.name.toLowerCase().includes('body mass index') ||
      assessment.name.toLowerCase().includes('weight') ||
      assessment.name.toLowerCase().includes('height') ||
      assessment.name.toLowerCase().includes('30 second sit') ||
      assessment.name.toLowerCase().includes('30-second sit') ||
      assessment.name.toLowerCase().includes('30 second chair stand') ||
      assessment.name.toLowerCase().includes('30-second chair stand') ||
      assessment.name.toLowerCase().includes('2 minute step') ||
      assessment.name.toLowerCase().includes('2-minute step') ||
      assessment.name.toLowerCase().includes('two minute step') ||
      assessment.name.toLowerCase().includes('psfs') ||
      assessment.name.toLowerCase().includes('patient specific functional') ||
      assessment.name.toLowerCase().includes('groc') ||
      assessment.name.toLowerCase().includes('global rating') ||
      assessment.name.toLowerCase().includes('gas') ||
      assessment.name.toLowerCase().includes('goal attainment') ||
      assessment.name.toLowerCase().includes('trendelenburg') ||
      assessment.name.toLowerCase().includes('aerobic step') ||
      assessment.name.toLowerCase().includes('chester step') ||
      assessment.name.toLowerCase().includes('1 minute sit') ||
      assessment.name.toLowerCase().includes('1-minute sit') ||
      assessment.name.toLowerCase().includes('stair climb') ||
      assessment.name.toLowerCase().includes('400 meter') ||
      assessment.name.toLowerCase().includes('400-meter') ||
      assessment.name.toLowerCase().includes('400m walk') ||
      assessment.name.toLowerCase().includes('iswt') ||
      assessment.name.toLowerCase().includes('incremental shuttle walk') ||
      assessment.name.toLowerCase().includes('eswt') ||
      assessment.name.toLowerCase().includes('endurance shuttle walk') ||
      assessment.name.toLowerCase().includes('dual task gait') ||
      assessment.name.toLowerCase().includes('dual-task gait') ||
      assessment.name.toLowerCase().includes('fga') ||
      assessment.name.toLowerCase().includes('functional gait assessment') ||
      assessment.name.toLowerCase().includes('beighton') ||
      assessment.name.toLowerCase().includes('hypermobility') ||
      assessment.name.toLowerCase().includes('triple hop') ||
      assessment.name.toLowerCase().includes('sppb') ||
      assessment.name.toLowerCase().includes('short physical performance battery') ||
      assessment.name.toLowerCase().includes('dgi') ||
      assessment.name.toLowerCase().includes('dynamic gait index') ||
      assessment.name.toLowerCase().includes('efs') ||
      assessment.name.toLowerCase().includes('edmonton frail') ||
      assessment.name.toLowerCase().includes('tandem stand') ||
      assessment.name.toLowerCase().includes('tandem balance') ||
      assessment.name.toLowerCase().includes('fiqr') ||
      assessment.name.toLowerCase().includes('fibromyalgia impact') ||
      assessment.name.toLowerCase().includes('wpi') ||
      assessment.name.toLowerCase().includes('widespread pain') ||
      assessment.name.toLowerCase().includes('pcs') ||
      assessment.name.toLowerCase().includes('pain catastrophizing') ||
      assessment.name.toLowerCase().includes('sf-36') ||
      assessment.name.toLowerCase().includes('sf36') ||
      assessment.name.toLowerCase().includes('fss') ||
      assessment.name.toLowerCase().includes('fatigue severity') ||
      assessment.name.toLowerCase().includes('promis fatigue') ||
      assessment.name.toLowerCase().includes('8 foot') ||
      assessment.name.toLowerCase().includes('8-foot') ||
      assessment.name.toLowerCase().includes('push up') ||
      assessment.name.toLowerCase().includes('push-up') ||
      assessment.name.toLowerCase().includes('tug') ||
      assessment.name.toLowerCase().includes('timed up and go') ||
      assessment.name.toLowerCase().includes('timed up-and-go') ||
      assessment.name.toLowerCase().includes('depaul') ||
      assessment.name.toLowerCase().includes('dsq') ||
      assessment.name.toLowerCase().includes('single leg stance') ||
      assessment.name.toLowerCase().includes('single-leg stance') ||
      assessment.name.toLowerCase().includes('one leg stance') ||
      assessment.name.toLowerCase().includes('one-leg stance') ||
      assessment.name.toLowerCase().includes('functional reach') ||
      assessment.name.toLowerCase().includes('sit and reach') ||
      assessment.name.toLowerCase().includes('sit-and-reach') ||
      assessment.name.toLowerCase().includes('chair sit and reach') ||
      assessment.name.toLowerCase().includes('chair sit-and-reach') ||
      assessment.name.toLowerCase().includes('back scratch') ||
      assessment.name.toLowerCase().includes('job task') ||
      assessment.name.toLowerCase().includes('jta') ||
      assessment.name.toLowerCase().includes('koos') ||
      assessment.name.toLowerCase().includes('knee injury') ||
      assessment.name.toLowerCase().includes('knee osteoarthritis') ||
      assessment.name.toLowerCase().includes('hoos') ||
      assessment.name.toLowerCase().includes('hip outcome') ||
      assessment.name.toLowerCase().includes('phq-9') ||
      assessment.name.toLowerCase().includes('phq9') ||
      assessment.name.toLowerCase().includes('patient health') ||
      assessment.name.toLowerCase().includes('four stage') ||
      assessment.name.toLowerCase().includes('four-stage') ||
      assessment.name.toLowerCase().includes('steadi') ||
      assessment.name.toLowerCase().includes('gad-7') ||
      assessment.name.toLowerCase().includes('gad7') ||
      assessment.name.toLowerCase().includes('k10') ||
      assessment.name.toLowerCase().includes('k-10') ||
      assessment.name.toLowerCase().includes('kessler') ||
      assessment.name.toLowerCase().includes('rom') ||
      assessment.name.toLowerCase().includes('range of motion') ||
      assessment.name.toLowerCase().includes('goniometry') ||
      assessment.name.toLowerCase().includes('shoulder extension') ||
      assessment.name.toLowerCase().includes('shoulder abduction') ||
      assessment.name.toLowerCase().includes('shoulder flexion') ||
      assessment.name.toLowerCase().includes('knee flexion') ||
      assessment.name.toLowerCase().includes('hip flexion') ||
      assessment.name.toLowerCase().includes('cervical rotation') ||
      assessment.name.toLowerCase().includes('berg balance') ||
      assessment.name.toLowerCase().includes('pain scale') ||
      assessment.name.toLowerCase().includes('vas') ||
      assessment.name.toLowerCase().includes('nprs') ||
      assessment.name.toLowerCase().includes('numeric pain') ||
      assessment.name.toLowerCase().includes('visual analog') ||
      assessment.name.toLowerCase().includes('borg') ||
      assessment.name.toLowerCase().includes('rpe') ||
      assessment.name.toLowerCase().includes('rate of perceived') ||
      assessment.name.toLowerCase().includes('manual muscle') ||
      assessment.name.toLowerCase().includes('mmt') ||
      assessment.name.toLowerCase().includes('fugl-meyer') ||
      assessment.name.toLowerCase().includes('fugl meyer') ||
      assessment.name.toLowerCase().includes('hip outcome score') ||
      assessment.name.toLowerCase().includes('depaul symptom questionnaire') ||
      assessment.name.toLowerCase().includes('dsq-2') ||
      assessment.name.toLowerCase().includes('functional reach') ||
      assessment.name.toLowerCase().includes('chair sit') ||
      assessment.name.toLowerCase().includes('back scratch') ||
      assessment.name.toLowerCase().includes('job task analysis') ||
      assessment.name.toLowerCase().includes('knee injury and osteoarthritis') ||
      assessment.name.toLowerCase().includes('four stage balance') ||
      assessment.name.toLowerCase().includes('patient health questionnaire') ||
      assessment.name.toLowerCase().includes('generalized anxiety disorder') ||
      assessment.name.toLowerCase().includes('kessler psychological') ||
      assessment.name.toLowerCase().includes('fibromyalgia impact questionnaire') ||
      assessment.name.toLowerCase().includes('widespread pain index') ||
      assessment.name.toLowerCase().includes('pain catastrophizing scale') ||
      assessment.name.toLowerCase().includes('sf-36 health survey') ||
      assessment.name.toLowerCase().includes('fatigue severity scale') ||
      assessment.name.toLowerCase().includes('promis fatigue') ||
      assessment.name.toLowerCase().includes('8 foot up and go') ||
      assessment.name.toLowerCase().includes('push up test') ||
      assessment.name.toLowerCase().includes('push-up test') ||
      assessment.name.toLowerCase().includes('step tap') ||
      assessment.name.toLowerCase().includes('static back extension') ||
      assessment.name.toLowerCase().includes('biering') ||
      assessment.name.toLowerCase().includes('tri-level arm ergometer') ||
      assessment.name.toLowerCase().includes('6 meter walk') ||
      assessment.name.toLowerCase().includes('himat') ||
      assessment.name.toLowerCase().includes('high-level mobility') ||
      assessment.name.toLowerCase().includes('mcgill core endurance') ||
      assessment.name.toLowerCase().includes('home step test') ||
      assessment.name.toLowerCase().includes('box and block') ||
      assessment.name.toLowerCase().includes('60 second sit to stand') ||
      assessment.name.toLowerCase().includes('60-second sit to stand') ||
      assessment.name.toLowerCase().includes('plank hold') ||
      assessment.name.toLowerCase().includes('body fat percentage') ||
      assessment.name.toLowerCase().includes('waist to hip ratio') ||
      assessment.name.toLowerCase().includes('waist circumference') ||
      assessment.name.toLowerCase().includes('body mass index') ||
      assessment.name.toLowerCase().includes('patient specific functional scale') ||
      assessment.name.toLowerCase().includes('global rating of change') ||
      assessment.name.toLowerCase().includes('goal attainment scaling') ||
      assessment.name.toLowerCase().includes('trendelenburg') ||
      assessment.name.toLowerCase().includes('aerobic step test') ||
      assessment.name.toLowerCase().includes('chester step') ||
      assessment.name.toLowerCase().includes('1 minute sit to stand') ||
      assessment.name.toLowerCase().includes('1-minute sit to stand') ||
      assessment.name.toLowerCase().includes('stair climb test') ||
      assessment.name.toLowerCase().includes('400 meter walk') ||
      assessment.name.toLowerCase().includes('400-meter walk') ||
      assessment.name.toLowerCase().includes('incremental shuttle walk') ||
      assessment.name.toLowerCase().includes('endurance shuttle walk') ||
      assessment.name.toLowerCase().includes('dual task gait') ||
      assessment.name.toLowerCase().includes('functional gait assessment') ||
      assessment.name.toLowerCase().includes('beighton') ||
      assessment.name.toLowerCase().includes('triple hop') ||
      assessment.name.toLowerCase().includes('short physical performance battery') ||
      assessment.name.toLowerCase().includes('dynamic gait index') ||
      assessment.name.toLowerCase().includes('edmonton frail scale') ||
      assessment.name.toLowerCase().includes('tandem stand') ||
      assessment.name.toLowerCase().includes('10 second repeated jump') ||
      assessment.name.toLowerCase().includes('12 minute walk run') ||
      assessment.name.toLowerCase().includes('20 meter shuttle run') ||
      assessment.name.toLowerCase().includes('2 minute walk test') ||
      assessment.name.toLowerCase().includes('30-15 intermittent fitness') ||
      assessment.name.toLowerCase().includes('505 agility') ||
      assessment.name.toLowerCase().includes('air displacement plethysmography') ||
      assessment.name.toLowerCase().includes('bod pod') ||
      assessment.name.toLowerCase().includes('american shoulder and elbow') ||
      assessment.name.toLowerCase().includes('anterior drawer') ||
      assessment.name.toLowerCase().includes('apley') ||
      assessment.name.toLowerCase().includes('astrand 6 minute cycle') ||
      assessment.name.toLowerCase().includes('balance evaluation systems') ||
      assessment.name.toLowerCase().includes('bestest') ||
      assessment.name.toLowerCase().includes('bioelectrical impedance') ||
      assessment.name.toLowerCase().includes('bruce treadmill protocol') ||
      assessment.name.toLowerCase().includes('clock drawing') ||
      assessment.name.toLowerCase().includes('ckcuest') ||
      assessment.name.toLowerCase().includes('community balance and mobility') ||
      assessment.name.toLowerCase().includes('conley scale') ||
      assessment.name.toLowerCase().includes('constant-murley') ||
      assessment.name.toLowerCase().includes('dexa scan') ||
      assessment.name.toLowerCase().includes('digit span') ||
      assessment.name.toLowerCase().includes('drop vertical jump') ||
      assessment.name.toLowerCase().includes('elderly mobility scale') ||
      assessment.name.toLowerCase().includes('falls efficacy scale') ||
      assessment.name.toLowerCase().includes('fasting blood glucose') ||
      assessment.name.toLowerCase().includes('figure of eight walk') ||
      assessment.name.toLowerCase().includes('figure-of-eight') ||
      assessment.name.toLowerCase().includes('five times sit to stand') ||
      assessment.name.toLowerCase().includes('5xsts') ||
      assessment.name.toLowerCase().includes('forced vital capacity') ||
      assessment.name.toLowerCase().includes('functional ambulation categories') ||
      assessment.name.toLowerCase().includes('grocery shelving test') ||
      assessment.name.toLowerCase().includes('grooved pegboard') ||
      assessment.name.toLowerCase().includes('hexagon agility') ||
      assessment.name.toLowerCase().includes('hydrostatic weighing') ||
      assessment.name.toLowerCase().includes('illinois agility') ||
      assessment.name.toLowerCase().includes('l test of functional mobility') ||
      assessment.name.toLowerCase().includes('lachman') ||
      assessment.name.toLowerCase().includes('maximal push up') ||
      assessment.name.toLowerCase().includes('mcmurray') ||
      assessment.name.toLowerCase().includes('medicine ball throw') ||
      assessment.name.toLowerCase().includes('modified ashworth') ||
      assessment.name.toLowerCase().includes('modified bruce protocol') ||
      assessment.name.toLowerCase().includes('modified rankin') ||
      assessment.name.toLowerCase().includes('motor assessment scale') ||
      assessment.name.toLowerCase().includes('naughton treadmill protocol') ||
      assessment.name.toLowerCase().includes('nine hole peg') ||
      assessment.name.toLowerCase().includes('nine-hole peg') ||
      assessment.name.toLowerCase().includes('noble compression') ||
      assessment.name.toLowerCase().includes('ober') ||
      assessment.name.toLowerCase().includes('oral glucose tolerance') ||
      assessment.name.toLowerCase().includes('ogtt') ||
      assessment.name.toLowerCase().includes('peak expiratory flow rate') ||
      assessment.name.toLowerCase().includes('pefr') ||
      assessment.name.toLowerCase().includes('pivot shift') ||
      assessment.name.toLowerCase().includes('purdue pegboard') ||
      assessment.name.toLowerCase().includes('reactive strength index') ||
      assessment.name.toLowerCase().includes('resting metabolic rate') ||
      assessment.name.toLowerCase().includes('rmr testing') ||
      assessment.name.toLowerCase().includes('rockport 1 mile walk') ||
      assessment.name.toLowerCase().includes('shoulder tug test') ||
      assessment.name.toLowerCase().includes('pastor') ||
      assessment.name.toLowerCase().includes('single leg hop') ||
      assessment.name.toLowerCase().includes('slump test') ||
      assessment.name.toLowerCase().includes('squat test dynamic') ||
      assessment.name.toLowerCase().includes('standing long jump') ||
      assessment.name.toLowerCase().includes('standing stork') ||
      assessment.name.toLowerCase().includes('static squat') ||
      assessment.name.toLowerCase().includes('wall squat') ||
      assessment.name.toLowerCase().includes('straight leg raise test') ||
      assessment.name.toLowerCase().includes('stroop test') ||
      assessment.name.toLowerCase().includes('t-test agility') ||
      assessment.name.toLowerCase().includes('tardieu scale') ||
      assessment.name.toLowerCase().includes('tecumseh step') ||
      assessment.name.toLowerCase().includes('thessaly test') ||
      assessment.name.toLowerCase().includes('thomas test') ||
      assessment.name.toLowerCase().includes('timed push up') ||
      assessment.name.toLowerCase().includes('trail making test') ||
      assessment.name.toLowerCase().includes('vertical jump test') ||
      assessment.name.toLowerCase().includes('sargent jump') ||
      assessment.name.toLowerCase().includes('wingate anaerobic') ||
      assessment.name.toLowerCase().includes('ymca bench press') ||
      assessment.name.toLowerCase().includes('yo-yo intermittent recovery') ||
      assessment.name.toLowerCase().includes('1 repetition maximum') ||
      assessment.name.toLowerCase().includes('1-rm testing') ||
      assessment.name.toLowerCase().includes('bruininks oseretsky') ||
      assessment.name.toLowerCase().includes('clinical frailty scale') ||
      assessment.name.toLowerCase().includes('ely test') ||
      assessment.name.toLowerCase().includes('rectus femoris tightness') ||
      assessment.name.toLowerCase().includes('isokinetic dynamometry') ||
      assessment.name.toLowerCase().includes('isometric strength testing') ||
      assessment.name.toLowerCase().includes('pediatric balance scale') ||

    checks.push({
      id: 'check1',
      name: 'Interactive test runner exists',
      status: requiresInteractiveRunner && !runnerExists ? 'fail' : 'pass',
      message: requiresInteractiveRunner && !runnerExists ? 'Missing interactive test runner' : 'No runner required or exists'
    });

    // Check 2: Not single score only
    const isSingleScoreOnly = !assessment.is_questionnaire && 
      (!assessment.normative_data || assessment.normative_data.length === 0) &&
      !assessment.instructions;
    
    checks.push({
      id: 'check2',
      name: 'Not single end-score only',
      status: !isSingleScoreOnly ? 'pass' : 'fail',
      message: !isSingleScoreOnly ? 'Multi-field capture structure' : 'Appears to be single-score only'
    });

    // Check 3: Instructions present
    checks.push({
      id: 'check3',
      name: 'Clinician instructions present',
      status: assessment.instructions ? 'pass' : 'fail',
      message: assessment.instructions ? 'Instructions documented' : 'Missing clinician instructions'
    });

    // Check 4: References present
    checks.push({
      id: 'check4',
      name: 'References present',
      status: assessment.references ? 'pass' : 'fail',
      message: assessment.references ? 'References documented' : 'Missing references'
    });

    // Check 5: Normative data
    const hasNormativeData = assessment.normative_data && assessment.normative_data.length > 0;
    checks.push({
      id: 'check5',
      name: 'Normative data present',
      status: hasNormativeData ? 'pass' : 'warning',
      message: hasNormativeData ? 'Normative data available' : 'No normative data (may not be applicable)'
    });

    // Check 6: Equipment documented
    checks.push({
      id: 'check6',
      name: 'Equipment documented',
      status: assessment.equipment_needed ? 'pass' : 'warning',
      message: assessment.equipment_needed ? 'Equipment listed' : 'No equipment documented'
    });

    // Check 7: Contraindications documented
    checks.push({
      id: 'check7',
      name: 'Contraindications documented',
      status: assessment.contraindications ? 'pass' : 'warning',
      message: assessment.contraindications ? 'Safety information present' : 'No contraindications documented'
    });

    return checks;
  };

  const generateProposedFixes = async (assessment, failedChecks) => {
    const fixes = [];

    // Check if needs test runner
    const needsRunner = failedChecks.some(c => c.id === 'check1');
    if (needsRunner) {
      fixes.push({
        type: 'test_runner',
        title: 'Create Interactive Test Runner',
        description: 'Generate a React component for interactive test administration',
        status: 'pending',
        code: null
      });
    }

    // Check if needs text field updates
    const needsInstructions = failedChecks.some(c => c.id === 'check3');
    const needsReferences = failedChecks.some(c => c.id === 'check4');

    if (needsInstructions || needsReferences) {
      fixes.push({
        type: 'text_fields',
        title: 'Add Missing Documentation',
        description: `Generate ${needsInstructions ? 'instructions' : ''} ${needsInstructions && needsReferences ? 'and' : ''} ${needsReferences ? 'references' : ''}`,
        status: 'pending',
        data: null
      });
    }

    return fixes;
  };

  const applyFix = async (result, fix) => {
    setFixingAssessmentId(result.assessment.id);
    toast.info(`Applying fix for ${result.assessment.name}...`);

    try {
      if (fix.type === 'test_runner') {
        // Generate test runner code
        const runnerCode = await generateTestRunnerCode(result.assessment);
        if (runnerCode) {
          fix.code = runnerCode;
          fix.status = 'ready';
          toast.success('Test runner code generated! Review and approve to create file.');
        }
      } else if (fix.type === 'text_fields') {
        // Generate text field content
        const textData = await generateTextFields(result.assessment);
        if (textData) {
          fix.data = textData;
          fix.status = 'ready';
          toast.success('Documentation generated! Review and approve to apply.');
        }
      }
      
      setAuditResults([...auditResults]);
    } catch (error) {
      console.error('Failed to generate fix:', error);
      toast.error('Failed to generate fix');
      fix.status = 'error';
      setAuditResults([...auditResults]);
    } finally {
      setFixingAssessmentId(null);
    }
  };

  const approveFix = async (result, fix) => {
    setFixingAssessmentId(result.assessment.id);
    
    try {
      if (fix.type === 'test_runner' && fix.code) {
        const componentName = result.assessment.name.replace(/[^a-zA-Z0-9]/g, '');
        const fileName = `components/assessments/${componentName}Runner.jsx`;
        
        // Copy code to clipboard
        navigator.clipboard.writeText(fix.code);
        
        toast.success(`Code copied to clipboard! Ask AI: "Create ${fileName} with the copied code"`, { duration: 8000 });
        
        fix.status = 'approved';
        fix.fileName = fileName;
      } else if (fix.type === 'text_fields' && fix.data) {
        await base44.entities.Assessment.update(result.assessment.id, fix.data);
        toast.success('Documentation fields updated!');
        fix.status = 'applied';
      }
      
      setAuditResults([...auditResults]);
      toast.success('Documentation updated! Re-run audit to see updated compliance status.');
    } catch (error) {
      console.error('Failed to apply fix:', error);
      toast.error('Failed to apply fix');
    } finally {
      setFixingAssessmentId(null);
    }
  };

  const rejectFix = (result, fix) => {
    fix.status = 'rejected';
    setAuditResults([...auditResults]);
    toast.info('Fix rejected');
  };

  const generateTestRunnerCode = async (assessment) => {
    const exampleRunners = `
// Example 1: Timer-based test (6 Minute Walk)
- Has pre-test measurements (vitals)
- Timer with encouragements
- During-test tracking (laps, distance, rest periods)
- Post-test measurements
- Calculates final result_value from total distance

// Example 2: Questionnaire-based test
- Displays questions with radio buttons
- Tracks responses for each question
- Calculates total score from responses
- Saves as additional_data with measurement_type: 'questionnaire'
`;

    const prompt = `You are an expert React developer. Create a complete test runner component for the "${assessment.name}" assessment.

ASSESSMENT DETAILS:
- Name: ${assessment.name}
- Category: ${assessment.category}
- Description: ${assessment.description}
- Instructions: ${assessment.instructions || 'Research standard protocol'}
- Scoring: ${assessment.scoring_system || 'Standard scoring'}
- Unit: ${assessment.unit_of_measure || 'score'}
- Equipment: ${assessment.equipment_needed || 'Standard equipment'}
${assessment.references ? `- References: ${assessment.references}` : ''}

EXAMPLE PATTERNS FROM EXISTING RUNNERS:
${exampleRunners}

CRITICAL IMPORT REQUIREMENTS:
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

COMPONENT REQUIREMENTS:
1. Export default function ${assessment.name.replace(/[^a-zA-Z0-9]/g, '')}Runner({ client, onSave, onClose })
2. Capture all relevant data based on assessment type (pre/post vitals, multiple trials, etc.)
3. Calculate result_value automatically from captured data
4. Store extra data in additional_data object with measurement_type identifier
5. Call onSave({ status: 'completed', result_value, additional_data: {...}, notes, assessment_date: new Date().toISOString().split('T')[0] })
6. Professional clinical design with Tailwind CSS
7. Include validation and helpful user feedback with toast notifications

Based on the assessment instructions and type, determine the appropriate data capture structure. Return ONLY the complete component code.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      add_context_from_internet: true
    });

    if (!response || typeof response !== 'string') return null;

    let code = response.trim();
    if (code.includes('```')) {
      const match = code.match(/```(?:jsx|javascript|react|tsx|typescript)?\s*\n([\s\S]*?)\n```/);
      if (match) code = match[1].trim();
    }

    return code;
  };

  const generateTextFields = async (assessment) => {
    const needsInstructions = !assessment.instructions || assessment.instructions.trim() === '';
    const needsReferences = !assessment.references || assessment.references.trim() === '';
    const needsContraindications = !assessment.contraindications || assessment.contraindications.trim() === '';
    const needsEquipment = !assessment.equipment_needed || assessment.equipment_needed.trim() === '';
    const needsScoring = !assessment.scoring_system || assessment.scoring_system.trim() === '';

    const prompt = `Generate comprehensive, evidence-based documentation for the "${assessment.name}" assessment:

${needsInstructions ? '- INSTRUCTIONS: Detailed step-by-step protocol' : ''}
${needsReferences ? '- REFERENCES: 3-5 peer-reviewed citations with DOI/PMID' : ''}
${needsContraindications ? '- CONTRAINDICATIONS: Safety considerations' : ''}
${needsEquipment ? '- EQUIPMENT_NEEDED: Required equipment list' : ''}
${needsScoring ? '- SCORING_SYSTEM: How to score/interpret' : ''}

Return only requested fields as JSON.`;

    const schema = { type: "object", properties: {} };
    if (needsInstructions) schema.properties.instructions = { type: "string" };
    if (needsReferences) schema.properties.references = { type: "string" };
    if (needsContraindications) schema.properties.contraindications = { type: "string" };
    if (needsEquipment) schema.properties.equipment_needed = { type: "string" };
    if (needsScoring) schema.properties.scoring_system = { type: "string" };

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      add_context_from_internet: true,
      response_json_schema: schema
    });

    return response;
  };

  const exportResults = () => {
    const csv = [
      ['Assessment Name', 'Category', 'Compliance Score', 'Status', 'Failed Checks', 'Warnings'],
      ...auditResults.map(r => [
        r.assessment.name,
        r.assessment.category,
        `${r.complianceScore.toFixed(1)}%`,
        r.isCompliant ? 'Compliant' : 'Non-Compliant',
        r.failedChecks.length,
        r.warnings.length
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assessment-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const compliantCount = auditResults.filter(r => r.isCompliant).length;
  const averageScore = auditResults.length > 0 
    ? auditResults.reduce((sum, r) => sum + r.complianceScore, 0) / auditResults.length 
    : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <ShieldCheck className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Admin Access Required</h2>
            <p className="text-slate-600">You need admin privileges to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                <ClipboardCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Assessment Compliance Audit</h1>
                <p className="text-slate-600">AI-powered quality validation and fix generation</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={createTestClient} variant="outline" disabled={creatingTestClient} className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100">
                {creatingTestClient ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
                {creatingTestClient ? 'Creating...' : 'Create Test Client'}
              </Button>
              {auditResults.length > 0 && (
                <>
                  <Button onClick={runAudit} variant="outline" disabled={isRunning}>
                    <ClipboardCheck className="w-4 h-4 mr-2" />
                    Re-run Audit
                  </Button>
                  <Button onClick={exportResults} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          {auditResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Activity className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="text-sm text-slate-600">Total Assessments</p>
                      <p className="text-2xl font-bold">{assessments.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="text-sm text-slate-600">Compliant</p>
                      <p className="text-2xl font-bold">{compliantCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-8 h-8 text-red-600" />
                    <div>
                      <p className="text-sm text-slate-600">Non-Compliant</p>
                      <p className="text-2xl font-bold">{assessments.length - compliantCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-purple-600" />
                    <div>
                      <p className="text-sm text-slate-600">Avg Score</p>
                      <p className="text-2xl font-bold">{averageScore.toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Run Audit Button */}
          {auditResults.length === 0 && (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="py-12 text-center">
                <ClipboardCheck className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Ready to Audit {assessments.length} Assessments
                </h3>
                <p className="text-slate-600 mb-6">
                  Run AI-powered compliance checks and generate proposed fixes
                </p>
                <Button onClick={runAudit} disabled={isRunning} size="lg" className="bg-blue-600 hover:bg-blue-700">
                  {isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {generatingFixes ? 'Generating Fixes...' : 'Running Audit...'}
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="w-4 h-4 mr-2" />
                      Run Compliance Audit
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {auditResults.length > 0 && (
            <Tabs defaultValue="non-compliant" className="space-y-4">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="non-compliant">
                    Non-Compliant ({assessments.length - compliantCount})
                  </TabsTrigger>
                  <TabsTrigger value="all">All Assessments</TabsTrigger>
                </TabsList>
                
                <div className="flex gap-2">
                  {auditResults.some(r => r.proposedFixes?.some(f => f.status === 'pending')) && (
                    <Button 
                      onClick={generateAllFixes} 
                      disabled={generatingFixes}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {generatingFixes ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating All Fixes...
                        </>
                      ) : (
                        <>
                          <Wrench className="w-4 h-4 mr-2" />
                          Generate All Fixes
                        </>
                      )}
                    </Button>
                  )}
                  
                  {auditResults.some(r => r.proposedFixes?.some(f => f.type === 'test_runner' && f.status === 'ready')) && (
                    <Button 
                      onClick={approveAllTestRunners}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <ThumbsUp className="w-4 h-4 mr-2" />
                      Approve All Test Runners
                    </Button>
                  )}
                </div>
              </div>

              <TabsContent value="non-compliant" className="space-y-4">
                {auditResults.filter(r => !r.isCompliant).map(result => (
                  <AssessmentCard 
                    key={result.assessment.id} 
                    result={result}
                    onApplyFix={(fix) => applyFix(result, fix)}
                    onApproveFix={(fix) => approveFix(result, fix)}
                    onRejectFix={(fix) => rejectFix(result, fix)}
                    isFixing={fixingAssessmentId === result.assessment.id}
                  />
                ))}
              </TabsContent>

              <TabsContent value="all" className="space-y-4">
                {auditResults.map(result => (
                  <AssessmentCard 
                    key={result.assessment.id} 
                    result={result}
                    onApplyFix={(fix) => applyFix(result, fix)}
                    onApproveFix={(fix) => approveFix(result, fix)}
                    onRejectFix={(fix) => rejectFix(result, fix)}
                    isFixing={fixingAssessmentId === result.assessment.id}
                  />
                ))}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </>
  );
}

function AssessmentCard({ result, onApplyFix, onApproveFix, onRejectFix, isFixing }) {
  const [expanded, setExpanded] = useState(false);
  const [, setForceUpdate] = useState(0);

  return (
    <Card className={`bg-white/80 backdrop-blur-sm ${result.isCompliant ? 'border-green-200' : 'border-red-200'}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <CardTitle className="text-lg">{result.assessment.name}</CardTitle>
              {result.isCompliant ? (
                <Badge className="bg-green-100 text-green-800">Compliant</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">Non-Compliant</Badge>
              )}
              <Badge variant="outline">{result.assessment.category}</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-600">
                Score: <strong className={result.complianceScore >= 70 ? 'text-green-600' : 'text-red-600'}>
                  {result.complianceScore.toFixed(1)}%
                </strong>
              </span>
              <span className="text-green-600">{result.passed.length} passed</span>
              {result.failedChecks.length > 0 && (
                <span className="text-red-600">{result.failedChecks.length} failed</span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Hide Details' : 'Show Details'}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 border-t pt-4">
          {/* Compliance Checks */}
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-900">Compliance Checks</h4>
            {result.checks.map(check => (
              <div key={check.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                {check.status === 'pass' && <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />}
                {check.status === 'fail' && <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
                {check.status === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />}
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{check.name}</p>
                  <p className="text-sm text-slate-600">{check.message}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Proposed Fixes */}
          {result.proposedFixes && result.proposedFixes.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Proposed Fixes
              </h4>
              {result.proposedFixes.map((fix, idx) => (
                <Card key={idx} className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      {fix.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-slate-700">{fix.description}</p>

                    {fix.status === 'pending' && (
                      <Button 
                        onClick={() => onApplyFix(fix)} 
                        size="sm"
                        disabled={isFixing}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isFixing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Wrench className="w-4 h-4 mr-1" />
                            Generate Fix
                          </>
                        )}
                      </Button>
                    )}

                    {fix.status === 'ready' && fix.code && (
                      <div className="space-y-2">
                        <div className="bg-slate-900 text-slate-100 p-3 rounded text-xs font-mono max-h-64 overflow-auto">
                          {fix.code.substring(0, 500)}...
                          {fix.code.length > 500 && <p className="text-slate-400 mt-2">({fix.code.length} total characters)</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => onApproveFix(fix)} 
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <ThumbsUp className="w-4 h-4 mr-1" />
                            Approve & Create
                          </Button>
                          <Button 
                            onClick={() => {
                              fix.status = 'pending';
                              fix.code = null;
                              setForceUpdate(n => n + 1);
                            }} 
                            size="sm"
                            variant="outline"
                            disabled={isFixing}
                          >
                            <Wrench className="w-4 h-4 mr-1" />
                            Regenerate
                          </Button>
                          <Button 
                            onClick={() => onRejectFix(fix)} 
                            size="sm"
                            variant="outline"
                          >
                            <ThumbsDown className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}

                    {fix.status === 'ready' && fix.data && (
                      <div className="space-y-2">
                        <div className="bg-slate-100 p-3 rounded text-sm max-h-48 overflow-auto">
                          <pre className="whitespace-pre-wrap">{JSON.stringify(fix.data, null, 2)}</pre>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => onApproveFix(fix)} 
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <ThumbsUp className="w-4 h-4 mr-1" />
                            Approve & Apply
                          </Button>
                          <Button 
                            onClick={() => onRejectFix(fix)} 
                            size="sm"
                            variant="outline"
                          >
                            <ThumbsDown className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}

                    {fix.status === 'approved' && (
                      <Badge className="bg-blue-100 text-blue-800">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Approved - Ask AI to create {fix.fileName}
                      </Badge>
                    )}

                    {fix.status === 'applied' && (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Applied
                      </Badge>
                    )}

                    {fix.status === 'rejected' && (
                      <Badge className="bg-slate-100 text-slate-800">
                        Rejected
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}