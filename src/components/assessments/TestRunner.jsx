import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { X, Save, Play, Pause, RotateCcw, Ruler, Users } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import AppointmentReminderModal from '../calendar/AppointmentReminderModal';
import BodyPainChart from './BodyPainChart';
import { resolveAssessmentDate } from './assessmentDate';
import ROMAssessmentRunner from './ROMAssessmentRunner';
import EbbelingTestRunner from './EbbelingTestRunner';
import MoCARunner from './MoCARunner';
import ManualMuscleTestRunner from './ManualMuscleTestRunner';
import WaistHipRatioRunner from './WaistHipRatioRunner';
import BergBalanceRunner from './BergBalanceRunner';
import TUGRunner from './TUGRunner';
import ChairStandRunner from './ChairStandRunner';
import FunctionalReachRunner from './FunctionalReachRunner';
import BackScratchRunner from './BackScratchRunner';
import SitAndReachRunner from './SitAndReachRunner';
import RombergRunner from './RombergRunner';
import StorkTestRunner from './StorkTestRunner';
import CTSIBRunner from './CTSIBRunner';
import FourSquareStepRunner from './FourSquareStepRunner';
import SkinfoldRunner from './SkinfoldRunner';
import GirthMeasurementsRunner from './GirthMeasurementsRunner';
import ISWTRunner from './ISWTRunner';
import HarvardStepRunner from './HarvardStepRunner';
import BoxAndBlockRunner from './BoxAndBlockRunner';
import HiMATRunner from './HiMATRunner';
import AstrandTestRunner from './AstrandTestRunner';
import JTARunner from './JTARunner';
import SixMinuteWalkRunner from './SixMinuteWalkRunner';
import BorgRPERunner from './BorgRPERunner';
import GeneralMovementScreenRunner from './GeneralMovementScreenRunner';
import GAD7Runner from './GAD7Runner';
import PHQ9Runner from './PHQ9Runner';
import ArmCurlRunner from './ArmCurlRunner';
import K10Runner from './K10Runner';
import FourStageBalanceRunner from './FourStageBalanceRunner';
import HOOSRunner from './HOOSRunner';
import KOOSRunner from './KOOSRunner';
import PediatricBalanceRunner from './PediatricBalanceRunner';
import RepeatedJumpRunner from './RepeatedJumpRunner';
import CKCUESTRunner from './CKCUESTRunner';
import OneRMRunner from './OneRMRunner';
import IsometricStrengthRunner from './IsometricStrengthRunner';
import IsokineticsRunner from './IsokineticsRunner';
import SpecialTestsRunner from './SpecialTestsRunner';
import SLRRunner from './SLRRunner';
import SlumpRunner from './SlumpRunner';
import KneeStabilityRunner from './KneeStabilityRunner';
import ThessalyRunner from './ThessalyRunner';
import ApleysRunner from './ApleysRunner';
import NobleRunner from './NobleRunner';
import BruceProtocolRunner from './BruceProtocolRunner';
import CycleProtocolRunner from './CycleProtocolRunner';
import TwoMinuteWalkRunner from './TwoMinuteWalkRunner';
import CooperTestRunner from './CooperTestRunner';
import BeepTestRunner from './BeepTestRunner';
import YoYoTestRunner from './YoYoTestRunner';
import ThirtyFifteenIFTRunner from './ThirtyFifteenIFTRunner';
import RSARunner from './RSARunner';
import HRRRunner from './HRRRunner';
import VO2maxGXTRunner from './VO2maxGXTRunner';
import TUDSRunner from './TUDSRunner';
import HbA1cRunner from './HbA1cRunner';
import LipidProfileRunner from './LipidProfileRunner';
import METCalculationRunner from './METCalculationRunner';
import SixMinuteStepRunner from './SixMinuteStepRunner';
import PPTRunner from './PPTRunner';
import CBMRunner from './CBMRunner';
import BESTestRunner from './BESTestRunner';
import EMSRunner from './EMSRunner';
import YMCA3MinStepRunner from './YMCA3MinStepRunner';
import DynamicGaitIndexRunner from './DynamicGaitIndexDGIRunner';
import RockportWalkRunner from './RockportWalkRunner';
import { todayLocal } from "@/lib/localDate";
import TenMeterWalkRunner from './TenMeterWalkRunner';
import DASS21Runner from './DASS21Runner';
import HADSRunner from './HADSRunner';
import ClinicalFrailtyScaleRunner from './ClinicalFrailtyScaleRunner';
import VitalSignsRunner from './VitalSignsRunner';
import SingleLegStanceRunner from './SingleLegStanceRunner';
import PainScalesRunner from './PainScalesRunner';
import BodyMeasurementsRunner from './BodyMeasurementsRunner';
import GaitSpeedRunner from './GaitSpeedRunner';
import ImpactofEventScaleRevisedIESRRunner from './ImpactofEventScaleRevisedIESRRunner';
import PTSDChecklistforDSM5PCL5Runner from './PTSDChecklistforDSM5PCL5Runner';
import InsomniaSeverityIndexISIRunner from './InsomniaSeverityIndexISIRunner';
import MedicalResearchCouncilMRCDyspneaScaleRunner from './MedicalResearchCouncilMRCDyspneaScaleRunner';
import COPDAssessmentTestCATRunner from './COPDAssessmentTestCATRunner';
import ClinicalCOPDQuestionnaireCCQRunner from './ClinicalCOPDQuestionnaireCCQRunner';
import LeicesterCoughQuestionnaireLCQRunner from './LeicesterCoughQuestionnaireLCQRunner';
import InternationalKneeDocumentationCommitteeIKDCRunner from './InternationalKneeDocumentationCommitteeIKDCRunner';
import FunctionalIndependenceMeasureFIMRunner from './FunctionalIndependenceMeasureFIMRunner';
import BarthelIndexRunner from './BarthelIndexRunner';
import RivermeadMobilityIndexRunner from './RivermeadMobilityIndexRunner';
import RolandMorrisDisabilityQuestionnaireRunner from './RolandMorrisDisabilityQuestionnaireRunner';
import QuickDASHRunner from './QuickDASHRunner';
import FootandAnkleAbilityMeasureFAAMRunner from './FootandAnkleAbilityMeasureFAAMRunner';
import ActivitiesspecificBalanceConfidenceABCScaleRunner from './ActivitiesspecificBalanceConfidenceABCScaleRunner';
import ChalderFatigueScaleRunner from './ChalderFatigueScaleRunner';
import PittsburghSleepQualityIndexPSQIRunner from './PittsburghSleepQualityIndexPSQIRunner';
import SARCFQuestionnaireRunner from './SARCFQuestionnaireRunner';
import NeckDisabilityIndexNDIRunner from './NeckDisabilityIndexNDIRunner';
import OswestryDisabilityIndexODIRunner from './OswestryDisabilityIndexODIRunner';
import AmericanShoulderandElbowSurgeonsASESScoreRunner from './AmericanShoulderandElbowSurgeonsASESScoreRunner';
import DEXAScanResultsInterpretationRunner from './DEXAScanResultsInterpretationRunner';
import ConleyScaleRunner from './ConleyScaleRunner';
import PerceivedStressScalePSSRunner from './PerceivedStressScalePSSRunner';
import ConstantMurleyScoreRunner from './ConstantMurleyScoreRunner';
import LysholmKneeScoreRunner from './LysholmKneeScoreRunner';
import ACLRSIRunner from './ACLRSIRunner';
import GlobalRatingofChangeScaleGROCRunner from './GlobalRatingofChangeScaleGROCRunner';
import StGeorgesRespiratoryQuestionnaireSGRQRunner from './StGeorgesRespiratoryQuestionnaireSGRQRunner';
import FearAvoidanceBeliefsQuestionnaireFABQRunner from './FearAvoidanceBeliefsQuestionnaireFABQRunner';
import SingleLegHopTestsRunner from './SingleLegHopTestsRunner';
import DropVerticalJumpRunner from './DropVerticalJumpRunner';
import VerticalJumpTestRunner from './VerticalJumpTestRunner';

import ClockDrawingTestRunner from './ClockDrawingTestRunner';
import TrailMakingTestTMTPartsAandBRunner from './TrailMakingTestTMTPartsAandBRunner';
import TinettiRunner from './TinettiRunner';
import OneMinuteSitToStandTestRunner from './1MinuteSittoStandTestRunner'; import ModifiedRankinScaleRunner from './ModifiedRankinScaleRunner'; import NaughtonTreadmillProtocolRunner from './NaughtonTreadmillProtocolRunner';import { saveAssessmentToSOAP } from './TestRunnerSOAPHelper';

export default function TestRunner({ client, assessment, clientAssessment, onClose, onComplete, isStandaloneMode = false, clinicianNotes }) {
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointmentId');
  const [clinicianName, setClinicianName] = useState("");
  const [selectedClient, setSelectedClient] = useState(client);
  const [allClients, setAllClients] = useState([]);
  const [showClientDropdown, setShowClientDropdown] = useState(isStandaloneMode);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionnaireResponses, setQuestionnaireResponses] = useState(
    clientAssessment?.additional_data?.responses || {}
  );
  const [result, setResult] = useState({
    result_value: clientAssessment?.result_value || "",
    notes: clientAssessment?.notes || "",
    barriers: clientAssessment?.barriers || "",
    assessment_date: (clientAssessment?.assessment_date || new Date().toISOString()).split('T')[0],
    client_name: client?.full_name || "",
    assessor_name: "",
    // For 5xSTS scales
    rpe_scale: clientAssessment?.additional_data?.rpe_scale || "",
    breathlessness_scale: clientAssessment?.additional_data?.breathlessness_scale || "",
    pain_scale: clientAssessment?.additional_data?.pain_scale || "",
    // For vital signs assessments
    pre_exercise_systolic: clientAssessment?.additional_data?.pre_exercise_systolic || "",
    pre_exercise_diastolic: clientAssessment?.additional_data?.pre_exercise_diastolic || "",
    post_exercise_systolic: clientAssessment?.additional_data?.post_exercise_systolic || "",
    post_exercise_diastolic: clientAssessment?.additional_data?.post_exercise_diastolic || "",
    pre_exercise_hr: clientAssessment?.additional_data?.pre_exercise_hr || "",
    post_exercise_hr: clientAssessment?.additional_data?.post_exercise_hr || "",
    recovery_hr_1min: clientAssessment?.additional_data?.recovery_hr_1min || "",
    recovery_hr_2min: clientAssessment?.additional_data?.recovery_hr_2min || "",
    recovery_hr_3min: clientAssessment?.additional_data?.recovery_hr_3min || "",
    recovery_hr_5min: clientAssessment?.additional_data?.recovery_hr_5min || "",
    // Heart Rate Recovery specific
    hrr_peak_hr: clientAssessment?.additional_data?.hrr_peak_hr || "",
    hrr_1min: clientAssessment?.additional_data?.hrr_1min || "",
    hrr_2min: clientAssessment?.additional_data?.hrr_2min || "",
    hrr_3min: clientAssessment?.additional_data?.hrr_3min || "",
    pre_exercise_spo2: clientAssessment?.additional_data?.pre_exercise_spo2 || "",
    post_exercise_spo2: clientAssessment?.additional_data?.post_exercise_spo2 || "",
    recovery_spo2: clientAssessment?.additional_data?.recovery_spo2 || "",
    // For Hand Grip Strength
    dominant_hand: clientAssessment?.additional_data?.dominant_hand || "right",
    dominant_trial_1: clientAssessment?.additional_data?.dominant_trial_1 || "",
    dominant_trial_2: clientAssessment?.additional_data?.dominant_trial_2 || "",
    dominant_trial_3: clientAssessment?.additional_data?.dominant_trial_3 || "",
    non_dominant_trial_1: clientAssessment?.additional_data?.non_dominant_trial_1 || "",
    non_dominant_trial_2: clientAssessment?.additional_data?.non_dominant_trial_2 || "",
    non_dominant_trial_3: clientAssessment?.additional_data?.non_dominant_trial_3 || "",
    // For 6 Minute Walk Test
    sixmwt_pre_hr: clientAssessment?.additional_data?.sixmwt_pre_hr || "",
    sixmwt_pre_bp_sys: clientAssessment?.additional_data?.sixmwt_pre_bp_sys || "",
    sixmwt_pre_bp_dia: clientAssessment?.additional_data?.sixmwt_pre_bp_dia || "",
    sixmwt_pre_spo2: clientAssessment?.additional_data?.sixmwt_pre_spo2 || "",
    sixmwt_pre_rpe: clientAssessment?.additional_data?.sixmwt_pre_rpe || "",
    sixmwt_post_hr: clientAssessment?.additional_data?.sixmwt_post_hr || "",
    sixmwt_post_spo2: clientAssessment?.additional_data?.sixmwt_post_spo2 || "",
    sixmwt_post_rpe: clientAssessment?.additional_data?.sixmwt_post_rpe || "",
    sixmwt_post_dyspnea: clientAssessment?.additional_data?.sixmwt_post_dyspnea || "",
    sixmwt_laps: clientAssessment?.additional_data?.sixmwt_laps || "",
    sixmwt_rest_periods: clientAssessment?.additional_data?.sixmwt_rest_periods || "",
    // For 2-Minute Step Test
    two_min_step_rpe: clientAssessment?.additional_data?.two_min_step_rpe || "",
    two_min_step_breathlessness: clientAssessment?.additional_data?.two_min_step_breathlessness || "",
    two_min_step_pain: clientAssessment?.additional_data?.two_min_step_pain || "",
    // For Single Leg Stance
    single_leg_right_trial1: clientAssessment?.additional_data?.single_leg_right_trial1 || "",
    single_leg_right_trial2: clientAssessment?.additional_data?.single_leg_right_trial2 || "",
    single_leg_right_trial3: clientAssessment?.additional_data?.single_leg_right_trial3 || "",
    single_leg_left_trial1: clientAssessment?.additional_data?.single_leg_left_trial1 || "",
    single_leg_left_trial2: clientAssessment?.additional_data?.single_leg_left_trial2 || "",
    single_leg_left_trial3: clientAssessment?.additional_data?.single_leg_left_trial3 || "",
    // New SLS fields (eyes open/closed)
    sls_left_eyes_open: clientAssessment?.additional_data?.sls_left_eyes_open || "",
    sls_right_eyes_open: clientAssessment?.additional_data?.sls_right_eyes_open || "",
    sls_left_eyes_closed: clientAssessment?.additional_data?.sls_left_eyes_closed || "",
    sls_right_eyes_closed: clientAssessment?.additional_data?.sls_right_eyes_closed || "",
    sls_dominant_leg: clientAssessment?.additional_data?.sls_dominant_leg || "",
    sls_required_support: clientAssessment?.additional_data?.sls_required_support || "",
    sls_stop_reason: clientAssessment?.additional_data?.sls_stop_reason || "",
    // Y-Balance Test
    ybt_limb_length_left: clientAssessment?.additional_data?.ybt_limb_length_left || "",
    ybt_limb_length_right: clientAssessment?.additional_data?.ybt_limb_length_right || "",
    ybt_left_anterior: clientAssessment?.additional_data?.ybt_left_anterior || "",
    ybt_left_posteromedial: clientAssessment?.additional_data?.ybt_left_posteromedial || "",
    ybt_left_posterolateral: clientAssessment?.additional_data?.ybt_left_posterolateral || "",
    ybt_right_anterior: clientAssessment?.additional_data?.ybt_right_anterior || "",
    ybt_right_posteromedial: clientAssessment?.additional_data?.ybt_right_posteromedial || "",
    ybt_right_posterolateral: clientAssessment?.additional_data?.ybt_right_posterolateral || "",
    // 10-Meter Walk Test
    tenm_comfortable_time: clientAssessment?.additional_data?.tenm_comfortable_time || "",
    tenm_fast_time: clientAssessment?.additional_data?.tenm_fast_time || "",
    tenm_assistive_device: clientAssessment?.additional_data?.tenm_assistive_device || "",
    tenm_gait_deviations: clientAssessment?.additional_data?.tenm_gait_deviations || "",
    // 4-Stage Balance Test
    four_stage_feet_together: clientAssessment?.additional_data?.four_stage_feet_together || "",
    four_stage_semi_tandem: clientAssessment?.additional_data?.four_stage_semi_tandem || "",
    four_stage_tandem: clientAssessment?.additional_data?.four_stage_tandem || "",
    four_stage_single_leg: clientAssessment?.additional_data?.four_stage_single_leg || "",
    // Habitual/Fast Gait Speed
    gait_distance: clientAssessment?.additional_data?.gait_distance || "4",
    gait_time_trial1: clientAssessment?.additional_data?.gait_time_trial1 || "",
    gait_time_trial2: clientAssessment?.additional_data?.gait_time_trial2 || "",
    gait_time_trial3: clientAssessment?.additional_data?.gait_time_trial3 || "",
    gait_assistive_device: clientAssessment?.additional_data?.gait_assistive_device || "",
    // Pain Scales (VAS/NPRS)
    pain_locations: clientAssessment?.additional_data?.pain_locations || [],
    // ROM Assessment
    rom_data: clientAssessment?.additional_data?.rom_data || null,
    // BMI calculation fields
    height_cm: clientAssessment?.additional_data?.height_cm || "",
    weight_kg: clientAssessment?.additional_data?.weight_kg || "",
    // Waist circumference
    waist_cm: clientAssessment?.additional_data?.waist_cm || "",
    hip_cm: clientAssessment?.additional_data?.hip_cm || ""
    });

  const [showReminders, setShowReminders] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showROMRunner, setShowROMRunner] = useState(false);
  const [showEbbelingRunner, setShowEbbelingRunner] = useState(false);
  const [showMoCARunner, setShowMoCARunner] = useState(false);
  const [showMMTRunner, setShowMMTRunner] = useState(false);
  const [showWHRRunner, setShowWHRRunner] = useState(false);
  const [showBergRunner, setShowBergRunner] = useState(false);
  const [showTUGRunner, setShowTUGRunner] = useState(false);
  const [showChairStandRunner, setShowChairStandRunner] = useState(false);
  const [showFunctionalReachRunner, setShowFunctionalReachRunner] = useState(false);
  const [showBackScratchRunner, setShowBackScratchRunner] = useState(false);
  const [showSitReachRunner, setShowSitReachRunner] = useState(false);
  const [showRombergRunner, setShowRombergRunner] = useState(false);
  const [showStorkRunner, setShowStorkRunner] = useState(false);
  const [showCTSIBRunner, setShowCTSIBRunner] = useState(false);
  const [showFourSquareRunner, setShowFourSquareRunner] = useState(false);
  const [showSkinfoldRunner, setShowSkinfoldRunner] = useState(false);
  const [showGirthRunner, setShowGirthRunner] = useState(false);
  const [showISWTRunner, setShowISWTRunner] = useState(false);
  const [showHarvardRunner, setShowHarvardRunner] = useState(false);
  const [showBoxBlockRunner, setShowBoxBlockRunner] = useState(false);
  const [showHiMATRunner, setShowHiMATRunner] = useState(false);
  const [showAstrandRunner, setShowAstrandRunner] = useState(false);
  const [showJTARunner, setShowJTARunner] = useState(false);
  const [show6MWTRunner, setShow6MWTRunner] = useState(false);
  const [showBorgRPERunner, setShowBorgRPERunner] = useState(false);
  const [showGMSRunner, setShowGMSRunner] = useState(false);
  const [showGAD7Runner, setShowGAD7Runner] = useState(false);
  const [showPHQ9Runner, setShowPHQ9Runner] = useState(false);
  const [showArmCurlRunner, setShowArmCurlRunner] = useState(false);
  const [showK10Runner, setShowK10Runner] = useState(false);
  const [showFourStageBalanceRunner, setShowFourStageBalanceRunner] = useState(false);
  const [showHOOSRunner, setShowHOOSRunner] = useState(false);
  const [showKOOSRunner, setShowKOOSRunner] = useState(false);
  const [showPediatricBalanceRunner, setShowPediatricBalanceRunner] = useState(false);
  const [showRepeatedJumpRunner, setShowRepeatedJumpRunner] = useState(false);
  const [showCKCUESTRunner, setShowCKCUESTRunner] = useState(false);
  const [showOneRMRunner, setShowOneRMRunner] = useState(false);
  const [showIsometricRunner, setShowIsometricRunner] = useState(false);
  const [showIsokineticsRunner, setShowIsokineticsRunner] = useState(false);
  const [showSpecialTestsRunner, setShowSpecialTestsRunner] = useState(false);
  const [showSLRRunner, setShowSLRRunner] = useState(false);
  const [showSlumpRunner, setShowSlumpRunner] = useState(false);
  const [showKneeStabilityRunner, setShowKneeStabilityRunner] = useState(false);
  const [showThessalyRunner, setShowThessalyRunner] = useState(false);
  const [showApleysRunner, setShowApleysRunner] = useState(false);
  const [showNobleRunner, setShowNobleRunner] = useState(false);
  const [showBruceRunner, setShowBruceRunner] = useState(false);
  const [showCycleRunner, setShowCycleRunner] = useState(false);
  const [showTwoMinWalkRunner, setShowTwoMinWalkRunner] = useState(false);
  const [showCooperRunner, setShowCooperRunner] = useState(false);
  const [showBeepRunner, setShowBeepRunner] = useState(false);
  const [showYoYoRunner, setShowYoYoRunner] = useState(false);
  const [showThirtyFifteenRunner, setShowThirtyFifteenRunner] = useState(false);
  const [showRSARunner, setShowRSARunner] = useState(false);
  const [showHRRRunner, setShowHRRRunner] = useState(false);
  const [showVO2maxGXTRunner, setShowVO2maxGXTRunner] = useState(false);
  const [showHbA1cRunner, setShowHbA1cRunner] = useState(false);
  const [showLipidProfileRunner, setShowLipidProfileRunner] = useState(false);
  const [showMETCalcRunner, setShowMETCalcRunner] = useState(false);
  const [showSixMinStepRunner, setShowSixMinStepRunner] = useState(false);
  const [showPPTRunner, setShowPPTRunner] = useState(false);
  const [showCBMRunner, setShowCBMRunner] = useState(false);
  const [showBESTestRunner, setShowBESTestRunner] = useState(false);
  const [showEMSRunner, setShowEMSRunner] = useState(false);
  const [showYMCA3MinStepRunner, setShowYMCA3MinStepRunner] = useState(false);
  const [showDGIRunner, setShowDGIRunner] = useState(false);
  const [showRockportRunner, setShowRockportRunner] = useState(false);
  const [showTenMeterWalkRunner, setShowTenMeterWalkRunner] = useState(false);
  const [showDASS21Runner, setShowDASS21Runner] = useState(false);
  const [showHADSRunner, setShowHADSRunner] = useState(false);
  const [showClinicalFrailtyScaleRunner, setShowClinicalFrailtyScaleRunner] = useState(false);
  const [showVitalSignsRunner, setShowVitalSignsRunner] = useState(false);
  const [showSingleLegStanceRunner, setShowSingleLegStanceRunner] = useState(false);
  const [showYBalanceRunner, setShowYBalanceRunner] = useState(false);
  const [showPainScalesRunner, setShowPainScalesRunner] = useState(false);
  const [showBodyMeasurementsRunner, setShowBodyMeasurementsRunner] = useState(false);
  const [showGaitSpeedRunner, setShowGaitSpeedRunner] = useState(false);
  const [showIESRRunner, setShowIESRRunner] = useState(false);
  const [showPCL5Runner, setShowPCL5Runner] = useState(false);
  const [showISIRunner, setShowISIRunner] = useState(false);
  const [showMRCDyspneaRunner, setShowMRCDyspneaRunner] = useState(false);
  const [showCATRunner, setShowCATRunner] = useState(false);
  const [showCCQRunner, setShowCCQRunner] = useState(false);
  const [showLCQRunner, setShowLCQRunner] = useState(false);
  const [showIKDCRunner, setShowIKDCRunner] = useState(false);
  const [showFIMRunner, setShowFIMRunner] = useState(false);
  const [showBarthelRunner, setShowBarthelRunner] = useState(false);
  const [showRivermeadRunner, setShowRivermeadRunner] = useState(false);
  const [showRMDQRunner, setShowRMDQRunner] = useState(false);
  const [showQuickDASHRunner, setShowQuickDASHRunner] = useState(false);
  const [showFAAMRunner, setShowFAAMRunner] = useState(false);
  const [showABCScaleRunner, setShowABCScaleRunner] = useState(false);
  const [showChalderRunner, setShowChalderRunner] = useState(false);
  const [showPSQIRunner, setShowPSQIRunner] = useState(false);
  const [showSARCFRunner, setShowSARCFRunner] = useState(false);
  const [showNDIRunner, setShowNDIRunner] = useState(false);
  const [showODIRunner, setShowODIRunner] = useState(false);
  const [showASESRunner, setShowASESRunner] = useState(false);
  const [showDEXARunner, setShowDEXARunner] = useState(false);
  const [showConleyRunner, setShowConleyRunner] = useState(false);
  const [showPSSRunner, setShowPSSRunner] = useState(false);
  const [showConstantMurleyRunner, setShowConstantMurleyRunner] = useState(false);
  const [showLysholmRunner, setShowLysholmRunner] = useState(false);
  const [showACLRSIRunner, setShowACLRSIRunner] = useState(false);
  const [showGROCRunner, setShowGROCRunner] = useState(false);
  const [showSGRQRunner, setShowSGRQRunner] = useState(false);
  const [showFABQRunner, setShowFABQRunner] = useState(false);
  const [showSingleLegHopRunner, setShowSingleLegHopRunner] = useState(false);
  const [showDropVerticalJumpRunner, setShowDropVerticalJumpRunner] = useState(false);
  const [showVerticalJumpRunner, setShowVerticalJumpRunner] = useState(false);
  const [showClockDrawingRunner, setShowClockDrawingRunner] = useState(false);
  const [showTMTRunner, setShowTMTRunner] = useState(false);
  const [showTinettiRunner, setShowTinettiRunner] = useState(false);
  const [showOneMinuteSitToStandRunner, setShowOneMinuteSitToStandRunner] = useState(false);
  
  const [mocaData, setMocaData] = useState(clientAssessment?.additional_data?.moca_data || null);
  const [mmtData, setMMTData] = useState(clientAssessment?.additional_data?.mmt_data || null);
  const [whrData, setWHRData] = useState(clientAssessment?.additional_data?.whr_data || null);
  const [bergData, setBergData] = useState(clientAssessment?.additional_data?.berg_data || null);
  const [tugData, setTUGData] = useState(clientAssessment?.additional_data?.tug_data || null);
  const [chairStandData, setChairStandData] = useState(clientAssessment?.additional_data?.chair_stand_data || null);
  const [functionalReachData, setFunctionalReachData] = useState(clientAssessment?.additional_data?.functional_reach_data || null);
  const [backScratchData, setBackScratchData] = useState(clientAssessment?.additional_data?.back_scratch_data || null);
  const [sitReachData, setSitReachData] = useState(clientAssessment?.additional_data?.sit_reach_data || null);
  const [rombergData, setRombergData] = useState(clientAssessment?.additional_data?.romberg_data || null);
  const [storkData, setStorkData] = useState(clientAssessment?.additional_data?.stork_data || null);
  const [ctsibData, setCTSIBData] = useState(clientAssessment?.additional_data?.ctsib_data || null);
  const [fourSquareData, setFourSquareData] = useState(clientAssessment?.additional_data?.four_square_data || null);
  const [skinfoldData, setSkinfoldData] = useState(clientAssessment?.additional_data?.skinfold_data || null);
  const [girthData, setGirthData] = useState(clientAssessment?.additional_data?.girth_data || null);
  const [iswtData, setISWTData] = useState(clientAssessment?.additional_data?.iswt_data || null);
  const [harvardData, setHarvardData] = useState(clientAssessment?.additional_data?.harvard_data || null);
  const [boxBlockData, setBoxBlockData] = useState(clientAssessment?.additional_data?.box_block_data || null);
  const [himatData, setHiMATData] = useState(clientAssessment?.additional_data?.himat_data || null);
  const [astrandData, setAstrandData] = useState(clientAssessment?.additional_data?.astrand_data || null);
  const [jtaData, setJTAData] = useState(clientAssessment?.additional_data?.jta_data || null);
  const [borgRPEData, setBorgRPEData] = useState(clientAssessment?.additional_data?.borg_rpe_data || null);
  const [gmsData, setGMSData] = useState(clientAssessment?.additional_data?.gms_data || null);
  const [gad7Data, setGAD7Data] = useState(clientAssessment?.additional_data?.gad7_data || null);
  const [phq9Data, setPHQ9Data] = useState(clientAssessment?.additional_data?.phq9_data || null);
  const [armCurlData, setArmCurlData] = useState(clientAssessment?.additional_data?.arm_curl_data || null);
  const [k10Data, setK10Data] = useState(clientAssessment?.additional_data?.k10_data || null);
  const [fourStageBalanceData, setFourStageBalanceData] = useState(clientAssessment?.additional_data?.four_stage_balance_data || null);
  const [hoosData, setHOOSData] = useState(clientAssessment?.additional_data?.hoos_data || null);
  const [koosData, setKOOSData] = useState(clientAssessment?.additional_data?.koos_data || null);
  const [repeatedJumpData, setRepeatedJumpData] = useState(clientAssessment?.additional_data?.repeated_jump_data || null);
  const [ckcuestData, setCKCUESTData] = useState(clientAssessment?.additional_data?.ckcuest_data || null);
  const [oneRMData, setOneRMData] = useState(clientAssessment?.additional_data?.one_rm_data || null);
  const [isometricData, setIsometricData] = useState(clientAssessment?.additional_data?.isometric_data || null);
  const [isokineticsData, setIsokineticsData] = useState(clientAssessment?.additional_data?.isokinetics_data || null);
  const [specialTestData, setSpecialTestData] = useState(clientAssessment?.additional_data?.special_test_data || null);
  const [slrData, setSLRData] = useState(clientAssessment?.additional_data?.slr_data || null);
  const [slumpData, setSlumpData] = useState(clientAssessment?.additional_data?.slump_data || null);
  const [kneeStabilityData, setKneeStabilityData] = useState(clientAssessment?.additional_data?.knee_stability_data || null);
  const [thessalyData, setThessalyData] = useState(clientAssessment?.additional_data?.thessaly_data || null);
  const [apleysData, setApleysData] = useState(clientAssessment?.additional_data?.apleys_data || null);
  const [nobleData, setNobleData] = useState(clientAssessment?.additional_data?.noble_data || null);
  const [bruceData, setBruceData] = useState(clientAssessment?.additional_data?.bruce_data || null);
  const [cycleData, setCycleData] = useState(clientAssessment?.additional_data?.cycle_data || null);
  const [twoMinWalkData, setTwoMinWalkData] = useState(clientAssessment?.additional_data?.two_min_walk_data || null);
  const [cooperData, setCooperData] = useState(clientAssessment?.additional_data?.cooper_data || null);
  const [beepData, setBeepData] = useState(clientAssessment?.additional_data?.beep_data || null);
  const [yoyoData, setYoYoData] = useState(clientAssessment?.additional_data?.yoyo_data || null);
  const [thirtyFifteenData, setThirtyFifteenData] = useState(clientAssessment?.additional_data?.thirty_fifteen_data || null);
  const [rsaData, setRSAData] = useState(clientAssessment?.additional_data?.rsa_data || null);
  const [hrrData, setHRRData] = useState(clientAssessment?.additional_data?.hrr_data || null);
  const [vo2maxGXTData, setVO2maxGXTData] = useState(clientAssessment?.additional_data?.vo2max_gxt_data || null);
  const [hba1cData, setHbA1cData] = useState(clientAssessment?.additional_data?.hba1c_data || null);
  const [lipidProfileData, setLipidProfileData] = useState(clientAssessment?.additional_data?.lipid_profile_data || null);
  const [metCalcData, setMETCalcData] = useState(clientAssessment?.additional_data?.met_calc_data || null);
  const [sixMinStepData, setSixMinStepData] = useState(clientAssessment?.additional_data?.six_min_step_data || null);
  const [pptData, setPPTData] = useState(clientAssessment?.additional_data?.ppt_data || null);
  const [cbmData, setCBMData] = useState(clientAssessment?.additional_data?.cbm_data || null);
  const [bestestData, setBESTestData] = useState(clientAssessment?.additional_data?.bestest_data || null);
  const [emsData, setEMSData] = useState(clientAssessment?.additional_data?.ems_data || null);
  const [ymca3MinStepData, setYMCA3MinStepData] = useState(clientAssessment?.additional_data?.ymca_3min_step_data || null);
  const [dgiData, setDGIData] = useState(clientAssessment?.additional_data?.dgi_data || null);
  const [rockportData, setRockportData] = useState(clientAssessment?.additional_data?.rockport_data || null);
  const [tenMeterWalkData, setTenMeterWalkData] = useState(clientAssessment?.additional_data?.ten_meter_walk_data || null);
  const [dass21Data, setDASS21Data] = useState(clientAssessment?.additional_data?.dass21_data || null);
  const [hadsData, setHadsData] = useState(clientAssessment?.additional_data?.hads_data || null);
  const [clinicalFrailtyScaleData, setClinicalFrailtyScaleData] = useState(clientAssessment?.additional_data?.clinical_frailty_scale_data || null);
  const [vitalSignsData, setVitalSignsData] = useState(clientAssessment?.additional_data?.vital_signs_data || null);
  const [singleLegStanceData, setSingleLegStanceData] = useState(clientAssessment?.additional_data?.single_leg_stance_data || null);
  const [yBalanceData, setYBalanceData] = useState(clientAssessment?.additional_data?.y_balance_data || null);
  const [painScalesData, setPainScalesData] = useState(clientAssessment?.additional_data?.pain_scales_data || null);
  const [bodyMeasurementsData, setBodyMeasurementsData] = useState(clientAssessment?.additional_data?.body_measurements_data || null);
  const [gaitSpeedData, setGaitSpeedData] = useState(clientAssessment?.additional_data?.gait_speed_data || null);
  const [iesrData, setIESRData] = useState(clientAssessment?.additional_data?.iesr_data || null);
  const [pcl5Data, setPCL5Data] = useState(clientAssessment?.additional_data?.pcl5_data || null);
  const [isiData, setISIData] = useState(clientAssessment?.additional_data?.isi_data || null);
  const [mrcDyspneaData, setMRCDyspneaData] = useState(clientAssessment?.additional_data?.mrc_dyspnea_data || null);
  const [catData, setCATData] = useState(clientAssessment?.additional_data?.cat_data || null);
  const [ccqData, setCCQData] = useState(clientAssessment?.additional_data?.ccq_data || null);
  const [lcqData, setLCQData] = useState(clientAssessment?.additional_data?.lcq_data || null);
  const [ikdcData, setIKDCData] = useState(clientAssessment?.additional_data?.ikdc_data || null);
  const [fimData, setFIMData] = useState(clientAssessment?.additional_data?.fim_data || null);
  const [barthelData, setBarthelData] = useState(clientAssessment?.additional_data?.barthel_data || null);
  const [rivermeadData, setRivermeadData] = useState(clientAssessment?.additional_data?.rivermead_data || null);
  const [rmdqData, setRMDQData] = useState(clientAssessment?.additional_data?.rmdq_data || null);
  const [quickDASHData, setQuickDASHData] = useState(clientAssessment?.additional_data?.quick_dash_data || null);
  const [faamData, setFAAMData] = useState(clientAssessment?.additional_data?.faam_data || null);
  const [abcScaleData, setABCScaleData] = useState(clientAssessment?.additional_data?.abc_scale_data || null);
  const [chalderData, setChalderData] = useState(clientAssessment?.additional_data?.chalder_data || null);
  const [psqiData, setPSQIData] = useState(clientAssessment?.additional_data?.psqi_data || null);
  const [sarcfData, setSARCFData] = useState(clientAssessment?.additional_data?.sarcf_data || null);
  const [ndiData, setNDIData] = useState(clientAssessment?.additional_data?.ndi_data || null);
  const [odiData, setODIData] = useState(clientAssessment?.additional_data?.odi_data || null);
  const [asesData, setASESData] = useState(clientAssessment?.additional_data?.ases_data || null);
  const [dexaData, setDEXAData] = useState(clientAssessment?.additional_data?.dexa_data || null);
  const [conleyData, setConleyData] = useState(clientAssessment?.additional_data?.conley_data || null);
  const [pssData, setPSSData] = useState(clientAssessment?.additional_data?.pss_data || null);
  const [constantMurleyData, setConstantMurleyData] = useState(clientAssessment?.additional_data?.constant_murley_data || null);
  const [lysholmData, setLysholmData] = useState(clientAssessment?.additional_data?.lysholm_data || null);
  const [aclrsiData, setACLRSIData] = useState(clientAssessment?.additional_data?.aclrsi_data || null);
  const [grocData, setGROCData] = useState(clientAssessment?.additional_data?.groc_data || null);
  const [sgrqData, setSGRQData] = useState(clientAssessment?.additional_data?.sgrq_data || null);
  const [fabqData, setFABQData] = useState(clientAssessment?.additional_data?.fabq_data || null);
  const [singleLegHopData, setSingleLegHopData] = useState(clientAssessment?.additional_data?.single_leg_hop_data || null);
  const [dropVerticalJumpData, setDropVerticalJumpData] = useState(clientAssessment?.additional_data?.drop_vertical_jump_data || null);
  const [verticalJumpData, setVerticalJumpData] = useState(clientAssessment?.additional_data?.vertical_jump_data || null);
  const [clockDrawingData, setClockDrawingData] = useState(clientAssessment?.additional_data?.clock_drawing_data || null);
  const [tmtData, setTMTData] = useState(clientAssessment?.additional_data?.tmt_data || null);
  const [tinettiData, setTinettiData] = useState(clientAssessment?.additional_data?.tinetti_data || null);
  const [sixMWTData, setSixMWTData] = useState(clientAssessment?.additional_data?.sixmwt_data || null); const [showModifiedRankinRunner, setShowModifiedRankinRunner] = useState(false); const [modifiedRankinData, setModifiedRankinData] = useState(clientAssessment?.additional_data?.modified_rankin_data || null); const [showNaughtonRunner, setShowNaughtonRunner] = useState(false); const [naughtonData, setNaughtonData] = useState(clientAssessment?.additional_data?.naughton_data || null);

  // Timer effect
  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 0.1);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  // Load assessor name and clients on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const user = await base44.auth.me();
        const assessorName = user.clinician_name || user.full_name || "";
        setClinicianName(assessorName);
        setResult(prev => ({ ...prev, assessor_name: assessorName }));
        
        if (isStandaloneMode) {
          // Get user's organization
          const orgMemberships = await base44.entities.OrganizationMember.filter({ user_email: user.email });
          const userOrgId = orgMemberships.length > 0 ? orgMemberships[0].org_id : null;
          
          if (userOrgId) {
            const clients = await base44.entities.Client.filter({ org_id: userOrgId });
            console.log('[TestRunner] Loaded clients for org_id:', userOrgId, 'Count:', clients?.length);
            setAllClients(clients);
          } else {
            console.warn('[TestRunner] User has no organization membership');
            setAllClients([]);
          }
        }
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    loadData();
  }, [isStandaloneMode]);

  const isVitalSignsAssessment = (name) => {
    return isBloodPressureAssessment(name) || isHeartRateAssessment(name) || isSpO2Assessment(name);
  };

  const isBloodPressureAssessment = (name) => {
    return name.toLowerCase().includes('blood pressure');
  };

  const isHeartRateAssessment = (name) => {
    return name.toLowerCase().includes('heart rate') && !name.toLowerCase().includes('recovery');
  };

  const isSpO2Assessment = (name) => {
    return name.toLowerCase().includes('oxygen saturation') || name.toLowerCase().includes('spo2');
  };

  const isFiveTimesSitToStand = () => {
    return assessment.name === 'Five-Times Sit-to-Stand Test (5xSTS)';
  };

  const isHandGripAssessment = (name) => {
    return name.toLowerCase().includes('hand grip') || name.toLowerCase().includes('grip strength');
  };

  const is6MinuteWalkTest = () => {
    return assessment.name === '6 Minute Walk Test';
  };

  const is2MinuteStepTest = () => {
    return assessment.name === '2-Minute Step Test';
  };

  const isSingleLegStance = () => {
    return assessment.name === 'Single Leg Stance Test (SLS)' || assessment.name === 'Single Leg Stance Test' || assessment.name === 'One-Leg Stance Test';
  };

  const isYBalanceTest = () => {
    return assessment.name === 'Y-Balance Test';
  };

  const is10MeterWalkTest = () => {
    return assessment.name === '10-Meter Walk Test (10MWT)';
  };

  const is4StageBalanceTest = () => {
    return assessment.name === '4-Stage Balance Test' ||
           assessment.name.toLowerCase().includes('4 stage balance') ||
           assessment.name.toLowerCase().includes('four stage balance');
  };

  const isHabitualGaitSpeed = () => { const n=assessment.name.toLowerCase(); return n==='habitual gait speed'||(n.includes('gait speed')&&!n.includes('fast')&&!n.includes('4-meter')&&!n.includes('4 meter')&&!n.includes('4-metre')&&!n.includes('4 metre')); };
  const isFastGaitSpeed = () => { const n=assessment.name.toLowerCase(); return n==='fast gait speed'||(n.includes('gait speed')&&n.includes('fast')); };
  const is4MeterGaitSpeed = () => { const n=assessment.name.toLowerCase(); return n.includes('4-meter')||n.includes('4 meter')||n.includes('4-metre')||n.includes('4 metre'); };

  const isHeartRateRecovery = () => {
    return assessment.name === 'Heart Rate Recovery';
  };

  const isPainScales = () => {
    return assessment.name === 'Pain Scales (VAS/NPRS)';
  };

  const isROMAssessment = () => {
    return assessment.name === 'Range of Motion (ROM) Assessment' || 
           assessment.name === 'ROM Assessment' ||
           assessment.name.toLowerCase().includes('range of motion');
  };

  const isEbbelingTest = () => {
    return assessment.name.toLowerCase().includes('ebbeling') || 
           assessment.name.toLowerCase().includes('single-stage treadmill');
  };

  const isMoCATest = () => {
    return assessment.name.toLowerCase().includes('moca') || 
           assessment.name.toLowerCase().includes('montreal cognitive');
  };

  const isMMTTest = () => {
    return assessment.name.toLowerCase().includes('manual muscle') || 
           assessment.name === 'Manual Muscle Testing (MMT)';
  };

  const isWaistHipRatio = () => {
    return assessment.name.toLowerCase().includes('waist-hip') || 
           assessment.name.toLowerCase().includes('waist hip ratio') ||
           assessment.name === 'Waist-Hip Ratio';
  };

  const isBMITest = () => {
    return assessment.name.toLowerCase().includes('body mass index') ||
           assessment.name === 'BMI';
  };

  const isWaistCircumference = () => {
    return assessment.name.toLowerCase().includes('waist circumference') &&
           !assessment.name.toLowerCase().includes('hip');
  };

  const isHeightTest = () => {
    return assessment.name === 'Height';
  };

  const isWeightTest = () => {
    return assessment.name === 'Weight';
  };

  const isBergBalance = () => {
    return assessment.name.toLowerCase().includes('berg balance');
  };

  const isTUG = () => {
    return assessment.name.toLowerCase().includes('timed up and go') || 
           assessment.name.toLowerCase().includes('tug');
  };

  const isChairStand = () => {
    return (assessment.name.toLowerCase().includes('chair stand') || 
           assessment.name.toLowerCase().includes('sit to stand') ||
           assessment.name.toLowerCase().includes('sit-to-stand')) &&
           !assessment.name.toLowerCase().includes('1-minute') &&
           !assessment.name.toLowerCase().includes('1 minute');
  };

  const isOneMinuteSitToStand = () => {
    return assessment.name.toLowerCase().includes('1-minute') || 
           assessment.name.toLowerCase().includes('1 minute');
  };

  const isFunctionalReach = () => {
    return assessment.name.toLowerCase().includes('functional reach');
  };

  const isBackScratch = () => {
    return assessment.name.toLowerCase().includes('back scratch');
  };

  const isSitAndReach = () => {
    return assessment.name.toLowerCase().includes('sit and reach') || 
           assessment.name.toLowerCase().includes('sit & reach');
  };

  const isRomberg = () => {
    return assessment.name.toLowerCase().includes('romberg');
  };

  const isStorkTest = () => {
    return assessment.name.toLowerCase().includes('stork');
  };

  const isCTSIB = () => {
    return assessment.name.toLowerCase().includes('ctsib') || 
           assessment.name.toLowerCase().includes('sensory interaction');
  };

  const isFourSquareStep = () => {
    return assessment.name.toLowerCase().includes('four square') || 
           assessment.name.toLowerCase().includes('4 square');
  };

  const isSkinfold = () => {
    return assessment.name.toLowerCase().includes('skinfold');
  };

  const isGirthMeasurement = () => {
    return assessment.name.toLowerCase().includes('girth measurement');
  };

  const isISWT = () => {
    return assessment.name.toLowerCase().includes('iswt') || 
           assessment.name.toLowerCase().includes('incremental shuttle');
  };

  const isHarvardStep = () => {
    return assessment.name.toLowerCase().includes('harvard step');
  };

  const isBoxAndBlock = () => {
    return assessment.name.toLowerCase().includes('box and block');
  };

  const isHiMAT = () => {
    return assessment.name.toLowerCase().includes('himat') || 
           assessment.name.toLowerCase().includes('high-level mobility');
  };

  const isAstrand = () => {
    return assessment.name.toLowerCase().includes('astrand') || 
           assessment.name.toLowerCase().includes('åstrand');
  };

  const isJTA = () => {
    return assessment.name.toLowerCase().includes('job task analysis') || 
           assessment.name.toLowerCase().includes('icare');
  };

  const isBorgRPE = () => {
    return assessment.name.toLowerCase().includes('borg') && 
           assessment.name.toLowerCase().includes('rpe');
  };

  const isGeneralMovementScreen = () => {
    return assessment.name.toLowerCase().includes('general movement screen');
  };

  const isGAD7 = () => {
    return assessment.name.toLowerCase().includes('gad-7') || 
           assessment.name.toLowerCase().includes('gad7');
  };

  const isPHQ9 = () => {
    return assessment.name.toLowerCase().includes('phq-9') || 
           assessment.name.toLowerCase().includes('phq9');
  };

  const isArmCurl = () => {
    return assessment.name.toLowerCase().includes('arm curl') || 
           assessment.name.toLowerCase().includes('bicep curl');
  };

  const isK10 = () => {
    return assessment.name.toLowerCase().includes('k10') || 
           assessment.name.toLowerCase().includes('k-10') ||
           assessment.name.toLowerCase().includes('kessler');
  };

  const isHOOS = () => {
    return assessment.name.toLowerCase().includes('hoos') ||
           (assessment.name.toLowerCase().includes('hip') && 
            assessment.name.toLowerCase().includes('osteoarthritis'));
  };

  const isKOOS = () => {
    return assessment.name.toLowerCase().includes('koos') ||
           (assessment.name.toLowerCase().includes('knee') && 
            assessment.name.toLowerCase().includes('osteoarthritis') &&
            assessment.name.toLowerCase().includes('outcome'));
  };

  const isPediatricBalance = () => {
    return assessment.name.toLowerCase().includes('pediatric balance');
  };

  const isRepeatedJump = () => {
    return assessment.name.toLowerCase().includes('repeated jump') || 
           assessment.name.toLowerCase().includes('10-s repeated jump') ||
           assessment.name.toLowerCase().includes('10/5 repeated jump');
  };

  const isCKCUEST = () => {
    return assessment.name.toLowerCase().includes('ckcuest') ||
           assessment.name.toLowerCase().includes('closed kinetic chain upper');
  };

  const isOneRM = () => {
    return assessment.name.toLowerCase().includes('1rm') ||
           assessment.name.toLowerCase().includes('1-repetition maximum') ||
           assessment.name.toLowerCase().includes('one repetition maximum');
  };

  const isIsometricStrength = () => {
    return assessment.name.toLowerCase().includes('isometric strength');
  };

  const isIsokinetics = () => {
    return assessment.name.toLowerCase().includes('isokinetic');
  };

  const isElyTest = () => {
    return assessment.name.toLowerCase().includes("ely's test") ||
           assessment.name.toLowerCase().includes("ely test");
  };

  const isThomasTest = () => {
    return assessment.name.toLowerCase().includes("thomas test");
  };

  const isOberTest = () => {
    return assessment.name.toLowerCase().includes("ober's test") ||
           assessment.name.toLowerCase().includes("ober test");
  };

  const isSLR = () => {
    return assessment.name.toLowerCase().includes('straight leg raise') ||
           assessment.name.toLowerCase().includes('slr');
  };

  const isSlump = () => {
    return assessment.name.toLowerCase().includes('slump test');
  };

  const isLachman = () => {
    return assessment.name.toLowerCase().includes('lachman');
  };

  const isAnteriorDrawer = () => {
    return assessment.name.toLowerCase().includes('anterior drawer') &&
           assessment.name.toLowerCase().includes('knee');
  };

  const isPivotShift = () => {
    return assessment.name.toLowerCase().includes('pivot shift');
  };

  const isMcMurray = () => {
    return assessment.name.toLowerCase().includes('mcmurray');
  };

  const isThessaly = () => {
    return assessment.name.toLowerCase().includes('thessaly');
  };

  const isApleys = () => {
    return assessment.name.toLowerCase().includes('apley');
  };

  const isNoble = () => {
    return assessment.name.toLowerCase().includes('noble');
  };

  const isBruceProtocol = () => {
    return assessment.name.toLowerCase().includes('bruce') && !assessment.name.toLowerCase().includes('naughton');
  };

  const isModifiedBruce = () => {
    return assessment.name.toLowerCase().includes('modified bruce');
  };

  const isNaughton = () => assessment.name.toLowerCase().includes('naughton');

  const isYMCACycle = () => {
    return assessment.name.toLowerCase().includes('ymca cycle');
  };

  const isAstrandCycle = () => {
    return assessment.name.toLowerCase().includes('astrand');
  };

  const isWingate = () => {
    return assessment.name.toLowerCase().includes('wingate');
  };

  const isTwoMinuteWalk = () => {
    return assessment.name.toLowerCase().includes('2 minute walk') || 
           assessment.name.toLowerCase().includes('two minute walk');
  };

  const isCooperTest = () => {
    return assessment.name.toLowerCase().includes('cooper') || 
           assessment.name.toLowerCase().includes('12 minute') ||
           assessment.name.toLowerCase().includes('12-minute');
  };

  const isBeepTest = () => {
    return assessment.name.toLowerCase().includes('beep') || 
           assessment.name.toLowerCase().includes('20') && assessment.name.toLowerCase().includes('shuttle');
  };

  const isYoYoTest = () => {
    return assessment.name.toLowerCase().includes('yo-yo') || 
           assessment.name.toLowerCase().includes('yoyo');
  };

  const isThirtyFifteenIFT = () => {
    return assessment.name.toLowerCase().includes('30-15') || 
           assessment.name.toLowerCase().includes('30 15');
  };

  const isRSATest = () => {
    return assessment.name.toLowerCase().includes('repeated sprint ability');
  };

  const isHRRTest = () => {
    return assessment.name.toLowerCase().includes('heart rate recovery') && 
           assessment.name.toLowerCase().includes('minute');
  };

  const isVO2maxGXT = () => {
    return assessment.name.toLowerCase().includes('vo2max testing') ||
           (assessment.name.toLowerCase().includes('maximal graded exercise'));
  };

  const isHbA1c = () => {
    return assessment.name.toLowerCase().includes('hba1c') ||
           assessment.name.toLowerCase().includes('glycated hemoglobin');
  };

  const isLipidProfile = () => {
    return assessment.name.toLowerCase().includes('lipid profile');
  };

  const isMETCalculation = () => {
    return assessment.name.toLowerCase().includes('met calculation') ||
           assessment.name.toLowerCase().includes('metabolic equivalent');
  };

  const isSixMinuteStep = () => {
    return assessment.name.toLowerCase().includes('6-minute step') ||
           assessment.name.toLowerCase().includes('6 minute step');
  };

  const isPPT = () => {
    return assessment.name.toLowerCase().includes('physical performance test') ||
           assessment.name.toLowerCase().includes('ppt');
  };

  const isCBM = () => {
    return assessment.name.toLowerCase().includes('community balance') ||
           assessment.name.toLowerCase().includes('cb&m');
  };

  const isBESTest = () => {
    return assessment.name.toLowerCase().includes('bestest') ||
           assessment.name.toLowerCase().includes('balance evaluation systems');
  };

  const isEMS = () => {
    return assessment.name.toLowerCase().includes('elderly mobility scale') ||
           assessment.name.toLowerCase().includes('ems');
  };

  const isYMCA3MinStep = () => {
    return assessment.name.toLowerCase().includes('ymca 3-minute') ||
           assessment.name.toLowerCase().includes('ymca 3 minute');
  };

  const isDGI = () => {
    return assessment.name.toLowerCase().includes('dynamic gait index') ||
           assessment.name.toLowerCase().includes('dgi');
  };

  const isRockportWalk = () => {
    return assessment.name.toLowerCase().includes('rockport') ||
           assessment.name.toLowerCase().includes('1-mile walk');
  };

  const isTenMeterWalk = () => {
    return assessment.name.toLowerCase().includes('ten meter walk') ||
           assessment.name.toLowerCase().includes('10 meter walk') ||
           assessment.name.toLowerCase().includes('10-meter walk');
  };

  const isDASS21 = () => {
    return assessment.name.toLowerCase().includes('dass-21') ||
           assessment.name.toLowerCase().includes('dass21') ||
           assessment.name.toLowerCase().includes('dass 21');
  };

  const isHADSTest = () => {
    return assessment.name.toLowerCase().includes('hospital anxiety and depression scale') ||
           assessment.name.toLowerCase().includes('hads');
  };

  const isClinicalFrailtyScaleTest = () => {
    return assessment.name.toLowerCase().includes('clinical frailty scale') ||
           assessment.name.toLowerCase().includes('cfs');
  };

  const isIESR = () => assessment.name.toLowerCase().includes('ies-r') || assessment.name.toLowerCase().includes('impact of event');
  const isPCL5 = () => assessment.name.toLowerCase().includes('pcl-5') || assessment.name.toLowerCase().includes('ptsd checklist');
  const isISI = () => assessment.name.toLowerCase().includes('insomnia severity');
  const isMRCDyspnea = () => assessment.name.toLowerCase().includes('mrc dyspnea') || assessment.name.toLowerCase().includes('medical research council dysp');
  const isCAT = () => assessment.name.toLowerCase().includes('copd assessment test') || assessment.name.toLowerCase().includes('cat');
  const isCCQ = () => assessment.name.toLowerCase().includes('clinical copd questionnaire') || assessment.name.toLowerCase().includes('ccq');
  const isLCQ = () => assessment.name.toLowerCase().includes('leicester cough');
  const isIKDC = () => assessment.name.toLowerCase().includes('ikdc') || assessment.name.toLowerCase().includes('international knee documentation');
  const isFIM = () => assessment.name.toLowerCase().includes('functional independence measure') || assessment.name.toLowerCase().includes('fim');
  const isBarthel = () => assessment.name.toLowerCase().includes('barthel index');
  const isRivermead = () => assessment.name.toLowerCase().includes('rivermead mobility'); const isModifiedRankin = () => assessment.name.toLowerCase().includes('modified rankin') || assessment.name.toLowerCase().includes('rankin scale');
  const isRMDQ = () => assessment.name.toLowerCase().includes('roland') || assessment.name.toLowerCase().includes('roland-morris');
  const isQuickDASH = () => assessment.name.toLowerCase().includes('quickdash') || assessment.name.toLowerCase().includes('quick dash');
  const isFAAM = () => assessment.name.toLowerCase().includes('faam') || assessment.name.toLowerCase().includes('foot and ankle ability');
  const isABCScale = () => assessment.name.toLowerCase().includes('abc scale') || assessment.name.toLowerCase().includes('activities-specific balance confidence');
  const isChalder = () => assessment.name.toLowerCase().includes('chalder fatigue');
  const isPSQI = () => assessment.name.toLowerCase().includes('psqi') || assessment.name.toLowerCase().includes('pittsburgh sleep');
  const isSARCF = () => assessment.name.toLowerCase().includes('sarc-f') || assessment.name.toLowerCase().includes('sarcf');
  const isNDI = () => assessment.name.toLowerCase().includes('neck disability') || assessment.name.toLowerCase().includes('ndi');
  const isODI = () => assessment.name.toLowerCase().includes('oswestry') || assessment.name.toLowerCase() === 'odi' || /\bodi\b/.test(assessment.name.toLowerCase());
  const isASES = () => assessment.name.toLowerCase().includes('ases') || assessment.name.toLowerCase().includes('american shoulder and elbow');
  const isDEXA = () => assessment.name.toLowerCase().includes('dexa') || assessment.name.toLowerCase().includes('bone density');
  const isConley = () => assessment.name.toLowerCase().includes('conley scale');
  const isPSS = () => assessment.name.toLowerCase().includes('perceived stress scale') || assessment.name.toLowerCase().includes('pss-10');
  const isConstantMurley = () => assessment.name.toLowerCase().includes('constant') && assessment.name.toLowerCase().includes('murley');
  const isLysholm = () => assessment.name.toLowerCase().includes('lysholm');
  const isACLRSI = () => assessment.name.toLowerCase().includes('acl-rsi') || assessment.name.toLowerCase().includes('acl return to sport');
  const isGROC = () => assessment.name.toLowerCase().includes('global rating of change') || assessment.name.toLowerCase().includes('groc');
  const isSGRQ = () => assessment.name.toLowerCase().includes('sgrq') || assessment.name.toLowerCase().includes("st george's respiratory");
  const isFABQ = () => assessment.name.toLowerCase().includes('fabq') || assessment.name.toLowerCase().includes('fear-avoidance beliefs');
  const isSingleLegHop = () => assessment.name.toLowerCase().includes('single leg hop');
  const isDropVerticalJump = () => assessment.name.toLowerCase().includes('drop vertical jump');
  const isVerticalJump = () => (assessment.name.toLowerCase().includes('vertical jump') || assessment.name.toLowerCase().includes('sargent jump')) && !assessment.name.toLowerCase().includes('drop');
  const isClockDrawing = () => assessment.name.toLowerCase().includes('clock drawing');
  const isTMT = () => assessment.name.toLowerCase().includes('trail making') || assessment.name.toLowerCase().includes('tmt');
  const isTinetti = () => assessment.name.toLowerCase().includes('tinetti') || assessment.name.toLowerCase().includes('poma');
  const is6MWT = () => assessment.name.toLowerCase().includes('6') && assessment.name.toLowerCase().includes('minute') && assessment.name.toLowerCase().includes('walk');

  const isQuestionnaireAssessment = () => {
    // Exclude tests with dedicated runners from generic questionnaire handler
    if (isDASS21() || isHADSTest() || isClinicalFrailtyScaleTest() || isIESR() || isPCL5() || 
        isISI() || isMRCDyspnea() || isCAT() || isCCQ() || isLCQ() || isIKDC() || isFIM() || 
        isBarthel() || isRivermead() || isRMDQ() || isQuickDASH() || isFAAM() || isABCScale() || 
        isChalder() || isPSQI() || isSARCF() || isNDI() || isODI() || isASES() || isDEXA() || 
        isConley() || isPSS() || isConstantMurley() || isLysholm() || isACLRSI() || isGROC() ||
        isSGRQ() || isFABQ() || isSingleLegHop() || isDropVerticalJump() || isVerticalJump() ||
        isClockDrawing() || isTMT() || isTinetti() || is6MWT() || isModifiedRankin()) return false;
    return assessment.is_questionnaire && assessment.questions && assessment.questions.length > 0;
  };

  const calculateQuestionnaireScore = () => {
    if (!assessment.questions) return 0;
    let totalScore = 0;
    assessment.questions.forEach((q, index) => {
      const response = questionnaireResponses[index];
      if (response !== undefined && response !== null) {
        totalScore += parseFloat(response);
      }
    });
    return totalScore;
  };

  const calculateBestGripScore = () => {
    const dominantScores = [
      parseFloat(result.dominant_trial_1) || 0,
      parseFloat(result.dominant_trial_2) || 0,
      parseFloat(result.dominant_trial_3) || 0
    ];
    const nonDominantScores = [
      parseFloat(result.non_dominant_trial_1) || 0,
      parseFloat(result.non_dominant_trial_2) || 0,
      parseFloat(result.non_dominant_trial_3) || 0
    ];
    
    const bestDominant = Math.max(...dominantScores);
    const bestNonDominant = Math.max(...nonDominantScores);
    
    return { bestDominant, bestNonDominant };
  };

  const generateObjectiveFromAssessment = (assessment, assessmentData) => {
    const rawDs = assessmentData.assessment_date || todayLocal();
    const dp = rawDs.split('-').map(Number);
    const today = (dp.length === 3 && !isNaN(dp[0]) && dp[0] > 1900) ? new Date(dp[0], dp[1]-1, dp[2]) : new Date();
    const dateStr = today.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (assessmentData.additional_data?.soap_text) { let t = `Assessment completed on ${dateStr}:\n\n${assessmentData.additional_data.soap_text}`; if (assessmentData.notes?.trim() && !t.includes(assessmentData.notes)) t += `\n  Clinical Notes: ${assessmentData.notes}`; return t; }
    let objectiveText = `Assessment completed on ${dateStr}:\n\n`;
    const data = assessmentData.additional_data || {};

    // 1RM Testing - Show all exercises with side specificity
    if (data.measurement_type === 'one_rm' && data.one_rm_data) {
      objectiveText += `• ${assessment.name}:\n`;
      if (data.one_rm_data.exercises && data.one_rm_data.exercises.length > 0) {
        data.one_rm_data.exercises.forEach(ex => {
          const sideLabel = ex.side ? ` (${ex.side.toUpperCase()})` : '';
          objectiveText += `  - ${ex.exercise_name}${sideLabel}: ${ex.one_rm_kg} kg (Method: ${ex.calculation_method})\n`;
          if (ex.reps && ex.weight_kg) {
            objectiveText += `    Based on: ${ex.reps} reps @ ${ex.weight_kg} kg\n`;
          }
        });
      }
    }
    // Isometric Strength - Show all tests with sides
    else if (data.measurement_type === 'isometric_strength' && data.isometric_data) {
      objectiveText += `• ${assessment.name}:\n`;
      objectiveText += `  Average Force: ${data.isometric_data.average_force_kg} kg across ${data.isometric_data.total_tests} tests\n`;
      if (data.isometric_data.tests && data.isometric_data.tests.length > 0) {
        objectiveText += `\n  Individual Tests:\n`;
        data.isometric_data.tests.forEach(test => {
          const sideLabel = test.side ? ` (${test.side.toUpperCase()})` : '';
          objectiveText += `  - ${test.joint} ${test.movement}${sideLabel}: ${test.peak_force_kg} kg (Hold: ${test.hold_duration_sec}s)\n`;
        });
      }
    }
    // Isokinetics - Show bilateral data
    else if (data.measurement_type === 'isokinetics' && data.isokinetics_data) {
      objectiveText += `• ${assessment.name}:\n`;
      const iso = data.isokinetics_data;
      objectiveText += `  Joint: ${iso.joint_tested}, Movement: ${iso.movement_tested}, Speed: ${iso.angular_velocity_deg_sec}°/s\n`;
      objectiveText += `  Left Peak Torque: ${iso.left_peak_torque_nm} Nm\n`;
      objectiveText += `  Right Peak Torque: ${iso.right_peak_torque_nm} Nm\n`;
      if (iso.asymmetry_percent) {
        objectiveText += `  Asymmetry: ${iso.asymmetry_percent}% ${iso.asymmetry_percent > 10 ? '⚠ Significant' : ''}\n`;
      }
    }
    // Special Tests (Ely, Thomas, Ober) - Show bilateral results
    else if (data.measurement_type === 'special_test' && data.special_test_data) {
      objectiveText += `• ${assessment.name}:\n`;
      const st = data.special_test_data;
      if (st.left_result) objectiveText += `  Left: ${st.left_result} ${st.left_angle_degrees ? `(${st.left_angle_degrees}°)` : ''}\n`;
      if (st.right_result) objectiveText += `  Right: ${st.right_result} ${st.right_angle_degrees ? `(${st.right_angle_degrees}°)` : ''}\n`;
      if (st.interpretation) objectiveText += `  Interpretation: ${st.interpretation}\n`;
    }
    // SLR Test - Bilateral neural tension
    else if (data.measurement_type === 'slr' && data.slr_data) {
      objectiveText += `• ${assessment.name}:\n`;
      if (data.slr_data.left_data) {
        objectiveText += `  Left: ${data.slr_data.left_data.angle_degrees}° - ${data.slr_data.left_data.interpretation}\n`;
        if (data.slr_data.left_data.pain_location) objectiveText += `    Pain: ${data.slr_data.left_data.pain_location}\n`;
      }
      if (data.slr_data.right_data) {
        objectiveText += `  Right: ${data.slr_data.right_data.angle_degrees}° - ${data.slr_data.right_data.interpretation}\n`;
        if (data.slr_data.right_data.pain_location) objectiveText += `    Pain: ${data.slr_data.right_data.pain_location}\n`;
      }
    }
    // Slump Test - Bilateral
    else if (data.measurement_type === 'slump' && data.slump_data) {
      objectiveText += `• ${assessment.name}:\n`;
      if (data.slump_data.left_data) {
        objectiveText += `  Left: ${data.slump_data.left_data.interpretation}\n`;
        if (data.slump_data.left_data.symptoms) objectiveText += `    Symptoms: ${data.slump_data.left_data.symptoms}\n`;
      }
      if (data.slump_data.right_data) {
        objectiveText += `  Right: ${data.slump_data.right_data.interpretation}\n`;
        if (data.slump_data.right_data.symptoms) objectiveText += `    Symptoms: ${data.slump_data.right_data.symptoms}\n`;
      }
    }
    // Knee Stability Tests - Bilateral
    else if (data.measurement_type === 'knee_stability' && data.knee_stability_data) {
      objectiveText += `• ${assessment.name}:\n`;
      if (data.knee_stability_data.left_interpretation) {
        objectiveText += `  Left: ${data.knee_stability_data.left_interpretation}\n`;
      }
      if (data.knee_stability_data.right_interpretation) {
        objectiveText += `  Right: ${data.knee_stability_data.right_interpretation}\n`;
      }
    }
    // DASS-21 subscale display
    else if (data.depression_score !== undefined && data.anxiety_score !== undefined && data.stress_score !== undefined) {
      objectiveText += `• ${assessment.name}:\n`;
      objectiveText += `  Depression Score: ${data.depression_score}/42 (${data.depression_interpretation})\n`;
      objectiveText += `  Anxiety Score: ${data.anxiety_score}/42 (${data.anxiety_interpretation})\n`;
      objectiveText += `  Stress Score: ${data.stress_score}/42 (${data.stress_interpretation})\n`;
    }
    // HADS - Separate subscales
    else if (data.anxiety_score !== undefined && data.depression_score !== undefined && data.measurement_type !== 'dass21') {
      objectiveText += `• ${assessment.name}:\n`;
      objectiveText += `  Anxiety Score: ${data.anxiety_score}/21 (${data.anxiety_interpretation})\n`;
      objectiveText += `  Depression Score: ${data.depression_score}/21 (${data.depression_interpretation})\n`;
    }
    // Questionnaire-based assessments - show all questions and responses
    else if (assessmentData.additional_data && assessmentData.additional_data.measurement_type === 'questionnaire') {
      objectiveText += `• ${assessment.name}:\n`;
      objectiveText += `  Total Score: ${assessmentData.result_value}\n`;

      if (assessment.questions && assessmentData.additional_data.responses) {
        objectiveText += `\n  Individual Question Responses:\n`;
        assessment.questions.forEach((question, index) => {
        const response = assessmentData.additional_data.responses[index];
        objectiveText += `\n  Q${index + 1}. ${question.question_text}\n`;

        // Find the label for the response
        if (question.question_type === 'yes_no') {
          objectiveText += `      Answer: ${response === 1 ? 'Yes' : 'No'}\n`;
        } else if (question.options) {
          const selectedOption = question.options.find(opt => opt.value === response);
          objectiveText += `      Answer: ${selectedOption ? selectedOption.label : response}\n`;
        } else {
          objectiveText += `      Answer: ${response}\n`;
        }
        });
        objectiveText += `\n`;
        }

        // CRITICAL: Always include notes for questionnaires too
        if (assessmentData.notes && assessmentData.notes.trim()) {
        objectiveText += `  Clinical Notes: ${assessmentData.notes}\n`;
        }
        if (assessmentData.barriers && assessmentData.barriers.trim()) {
        objectiveText += `  Barriers identified: ${assessmentData.barriers}\n`;
        }
        }
    // Custom formatting for Grip Strength
    else if (assessment.name && assessment.name.toLowerCase().includes('grip strength') && assessmentData.additional_data) {
      const data = assessmentData.additional_data;
      const domHand = data.dominant_hand ? data.dominant_hand.charAt(0).toUpperCase() + data.dominant_hand.slice(1) : 'Dominant';
      const nonDomHand = data.dominant_hand === 'right' ? 'Left' : 'Right';

      objectiveText += `• ${assessment.name}:\n`;
      objectiveText += `  - ${domHand} Hand Trials: ${data.dominant_trial_1 || 'N/A'}, ${data.dominant_trial_2 || 'N/A'}, ${data.dominant_trial_3 || 'N/A'} (kg). Best: ${data.dominant_best || 'N/A'} kg\n`;
      objectiveText += `  - ${nonDomHand} Hand Trials: ${data.non_dominant_trial_1 || 'N/A'}, ${data.non_dominant_trial_2 || 'N/A'}, ${data.non_dominant_trial_3 || 'N/A'} (kg). Best: ${data.non_dominant_best || 'N/A'} kg\n`;
    }
    // 6 Minute Walk Test
    else if (assessmentData.additional_data && assessmentData.additional_data.measurement_type === '6mwt') {
      const data = assessmentData.additional_data;
      objectiveText += `• ${assessment.name}:\n`;
      objectiveText += `  Total Distance: ${assessmentData.result_value} meters\n`;
      objectiveText += `  Laps Completed: ${data.sixmwt_laps || 'N/A'}\n`;
      objectiveText += `  Rest Periods: ${data.sixmwt_rest_periods || 0}\n\n`;
      
      objectiveText += `  Pre-Exercise Measurements:\n`;
      objectiveText += `    - Heart Rate: ${data.sixmwt_pre_hr || 'N/A'} bpm\n`;
      objectiveText += `    - Blood Pressure: ${data.sixmwt_pre_bp_sys || 'N/A'}/${data.sixmwt_pre_bp_dia || 'N/A'} mmHg\n`;
      objectiveText += `    - SpO2: ${data.sixmwt_pre_spo2 || 'N/A'}%\n`;
      objectiveText += `    - RPE: ${data.sixmwt_pre_rpe || 'N/A'}/10\n\n`;
      
      objectiveText += `  Post-Exercise Measurements:\n`;
      objectiveText += `    - Heart Rate: ${data.sixmwt_post_hr || 'N/A'} bpm\n`;
      objectiveText += `    - SpO2: ${data.sixmwt_post_spo2 || 'N/A'}%\n`;
      objectiveText += `    - RPE: ${data.sixmwt_post_rpe || 'N/A'}/10\n`;
      objectiveText += `    - Dyspnea: ${data.sixmwt_post_dyspnea || 'N/A'}/10\n`;
      
      // CRITICAL: Include notes for 6MWT
      if (assessmentData.notes && assessmentData.notes.trim()) {
        objectiveText += `\n  Clinical Notes: ${assessmentData.notes}\n`;
      }
      if (assessmentData.barriers && assessmentData.barriers.trim()) {
        objectiveText += `  Barriers identified: ${assessmentData.barriers}\n`;
      }
    }
    // 2-Minute Step Test
    else if (assessmentData.additional_data && assessmentData.additional_data.measurement_type === '2min_step') {
      const data = assessmentData.additional_data;
      objectiveText += `• ${assessment.name}:\n`;
      objectiveText += `  Total Steps: ${assessmentData.result_value}\n\n`;
      objectiveText += `  Post-Test Scales:\n`;
      objectiveText += `    - RPE: ${data.two_min_step_rpe || 'N/A'}/20\n`;
      objectiveText += `    - Breathlessness: ${data.two_min_step_breathlessness || 'N/A'}/10\n`;
      objectiveText += `    - Pain: ${data.two_min_step_pain || 'N/A'}/10\n`;
      
      // CRITICAL: Include notes
      if (assessmentData.notes && assessmentData.notes.trim()) {
        objectiveText += `\n  Clinical Notes: ${assessmentData.notes}\n`;
      }
      if (assessmentData.barriers && assessmentData.barriers.trim()) {
        objectiveText += `  Barriers identified: ${assessmentData.barriers}\n`;
      }
    }
    // Single Leg Stance
    else if (assessmentData.additional_data && assessmentData.additional_data.measurement_type === 'single_leg_stance') {
      const data = assessmentData.additional_data;
      objectiveText += `• ${assessment.name}:\n`;
      objectiveText += `  Eyes Open:\n`;
      objectiveText += `    - Left Leg: ${data.sls_left_eyes_open || 'N/A'} seconds\n`;
      objectiveText += `    - Right Leg: ${data.sls_right_eyes_open || 'N/A'} seconds\n`;
      objectiveText += `  Eyes Closed:\n`;
      objectiveText += `    - Left Leg: ${data.sls_left_eyes_closed || 'N/A'} seconds\n`;
      objectiveText += `    - Right Leg: ${data.sls_right_eyes_closed || 'N/A'} seconds\n`;
      if (data.sls_dominant_leg) {
        objectiveText += `  Dominant Leg: ${data.sls_dominant_leg}\n`;
      }
      if (data.sls_required_support) {
        objectiveText += `  Required Support/Supervision: ${data.sls_required_support}\n`;
      }
      if (data.sls_stop_reason && data.sls_stop_reason !== 'completed') {
        const reasonLabels = {
          'hands_moved': 'Hands moved from position',
          'foot_shifted': 'Supporting foot shifted',
          'foot_touched': 'Lifted foot touched ground/leg',
          'loss_balance': 'Loss of balance',
          'client_stopped': 'Client chose to stop'
        };
        objectiveText += `  Reason for stopping: ${reasonLabels[data.sls_stop_reason] || data.sls_stop_reason}\n`;
      }
      
      // CRITICAL: Include notes
      if (assessmentData.notes && assessmentData.notes.trim()) {
        objectiveText += `\n  Clinical Notes: ${assessmentData.notes}\n`;
      }
      if (assessmentData.barriers && assessmentData.barriers.trim()) {
        objectiveText += `  Barriers identified: ${assessmentData.barriers}\n`;
      }
    }
    // Blood Pressure
    else if (assessmentData.additional_data && assessmentData.additional_data.measurement_type === 'blood_pressure') {
      const data = assessmentData.additional_data;
      objectiveText += `• ${assessment.name}:\n`;
      objectiveText += `  Pre-Exercise: ${data.pre_exercise_systolic}/${data.pre_exercise_diastolic} mmHg\n`;
      if (data.post_exercise_systolic) {
        objectiveText += `  Post-Exercise: ${data.post_exercise_systolic}/${data.post_exercise_diastolic} mmHg\n`;
      }
      
      // CRITICAL: Include notes
      if (assessmentData.notes && assessmentData.notes.trim()) {
        objectiveText += `\n  Clinical Notes: ${assessmentData.notes}\n`;
      }
      if (assessmentData.barriers && assessmentData.barriers.trim()) {
        objectiveText += `  Barriers identified: ${assessmentData.barriers}\n`;
      }
    }
    // Heart Rate
    else if (assessmentData.additional_data && assessmentData.additional_data.measurement_type === 'heart_rate') {
      const data = assessmentData.additional_data;
      objectiveText += `• ${assessment.name}:\n`;
      objectiveText += `  Pre-Exercise: ${data.pre_exercise_hr} bpm\n`;
      if (data.post_exercise_hr) {
        objectiveText += `  Post-Exercise: ${data.post_exercise_hr} bpm\n`;
      }
      if (data.recovery_hr_1min) {
        objectiveText += `  Recovery (1 min): ${data.recovery_hr_1min} bpm\n`;
      }
      if (data.recovery_hr_3min) {
        objectiveText += `  Recovery (3 min): ${data.recovery_hr_3min} bpm\n`;
      }
      if (data.recovery_hr_5min) {
        objectiveText += `  Recovery (5 min): ${data.recovery_hr_5min} bpm\n`;
      }
      
      // CRITICAL: Include notes
      if (assessmentData.notes && assessmentData.notes.trim()) {
        objectiveText += `\n  Clinical Notes: ${assessmentData.notes}\n`;
      }
      if (assessmentData.barriers && assessmentData.barriers.trim()) {
        objectiveText += `  Barriers identified: ${assessmentData.barriers}\n`;
      }
    }
    // SpO2
    else if (assessmentData.additional_data && assessmentData.additional_data.measurement_type === 'spo2') {
      const data = assessmentData.additional_data;
      objectiveText += `• ${assessment.name}:\n`;
      objectiveText += `  Pre-Exercise: ${data.pre_exercise_spo2}%\n`;
      if (data.post_exercise_spo2) {
        objectiveText += `  Post-Exercise: ${data.post_exercise_spo2}%\n`;
      }
      if (data.recovery_spo2) {
        objectiveText += `  Recovery: ${data.recovery_spo2}%\n`;
      }
      
      // CRITICAL: Include notes
      if (assessmentData.notes && assessmentData.notes.trim()) {
        objectiveText += `\n  Clinical Notes: ${assessmentData.notes}\n`;
      }
      if (assessmentData.barriers && assessmentData.barriers.trim()) {
        objectiveText += `  Barriers identified: ${assessmentData.barriers}\n`;
      }
    }
    // Heart Rate Recovery
    else if (assessmentData.additional_data && assessmentData.additional_data.measurement_type === 'heart_rate_recovery') {
      const data = assessmentData.additional_data;
      objectiveText += `• ${assessment.name}:\n`;
      objectiveText += `  Peak Exercise HR: ${data.hrr_peak_hr || 'N/A'} bpm\n`;
      objectiveText += `  Recovery HR at 1 min: ${data.hrr_1min || 'N/A'} bpm\n`;
      if (data.hrr_2min) {
        objectiveText += `  Recovery HR at 2 min: ${data.hrr_2min} bpm\n`;
      }
      if (data.hrr_3min) {
        objectiveText += `  Recovery HR at 3 min: ${data.hrr_3min} bpm\n`;
      }
      objectiveText += `\n  Calculated HRR:\n`;
      if (data.hrr_at_1min !== null) {
        const interp = data.hrr_at_1min < 12 ? '(Abnormal - increased risk)' : data.hrr_at_1min <= 18 ? '(Borderline)' : '(Normal)';
        objectiveText += `    - HRR at 1 min: ${data.hrr_at_1min} bpm ${interp}\n`;
      }
      if (data.hrr_at_2min !== null) {
        objectiveText += `    - HRR at 2 min: ${data.hrr_at_2min} bpm\n`;
      }
      if (data.hrr_at_3min !== null) {
        objectiveText += `    - HRR at 3 min: ${data.hrr_at_3min} bpm\n`;
      }
      
      // CRITICAL: Include notes
      if (assessmentData.notes && assessmentData.notes.trim()) {
        objectiveText += `\n  Clinical Notes: ${assessmentData.notes}\n`;
      }
      if (assessmentData.barriers && assessmentData.barriers.trim()) {
        objectiveText += `  Barriers identified: ${assessmentData.barriers}\n`;
      }
    }
    // ROM Assessment
    else if (assessmentData.additional_data && assessmentData.additional_data.measurement_type === 'rom_assessment') {
      const romData = assessmentData.additional_data.rom_data;
      objectiveText += `• ${assessment.name} - ${romData.jointName}:\n`;

      if (romData.measurements) {
        Object.entries(romData.measurements).forEach(([movement, values]) => {
          if (values.left || values.right) {
            objectiveText += `  - ${movement}: `;
            if (values.left) objectiveText += `L: ${values.left}° `;
            if (values.right) objectiveText += `R: ${values.right}°`;
            objectiveText += '\n';
          }
        });
      }

      if (romData.comments) {
        Object.entries(romData.comments).forEach(([movement, comment]) => {
          if (comment) {
            objectiveText += `    ${movement} notes: ${comment}\n`;
          }
        });
      }
      
      // CRITICAL: Include global notes
      if (assessmentData.notes && assessmentData.notes.trim()) {
        objectiveText += `\n  Clinical Notes: ${assessmentData.notes}\n`;
      }
      if (assessmentData.barriers && assessmentData.barriers.trim()) {
        objectiveText += `  Barriers identified: ${assessmentData.barriers}\n`;
      }
    }
    // Pain Scales (VAS/NPRS)
    else if (assessmentData.additional_data && assessmentData.additional_data.measurement_type === 'pain_scales') {
      const data = assessmentData.additional_data;
      const painScore = assessmentData.result_value;
      const severity = painScore === 0 ? 'No Pain' : painScore <= 3 ? 'Mild' : painScore <= 6 ? 'Moderate' : 'Severe';
      
      objectiveText += `• ${assessment.name}:\n`;
      objectiveText += `  Overall Pain Score: ${painScore}/10 (${severity})\n`;
      
      if (data.pain_locations && data.pain_locations.length > 0) {
        objectiveText += `  Pain Locations:\n`;
        data.pain_locations.forEach(loc => {
          const regionLabels = {
            'head': 'Head', 'neck': 'Neck', 'left_shoulder': 'Left Shoulder', 'right_shoulder': 'Right Shoulder',
            'chest': 'Chest', 'upper_back': 'Upper Back', 'left_arm': 'Left Arm', 'right_arm': 'Right Arm',
            'left_elbow': 'Left Elbow', 'right_elbow': 'Right Elbow', 'left_forearm': 'Left Forearm',
            'right_forearm': 'Right Forearm', 'left_hand': 'Left Hand', 'right_hand': 'Right Hand',
            'abdomen': 'Abdomen', 'lower_back': 'Lower Back', 'left_hip': 'Left Hip', 'right_hip': 'Right Hip',
            'groin': 'Groin', 'left_thigh': 'Left Thigh', 'right_thigh': 'Right Thigh',
            'left_knee': 'Left Knee', 'right_knee': 'Right Knee', 'left_shin': 'Left Shin/Calf',
            'right_shin': 'Right Shin/Calf', 'left_ankle': 'Left Ankle', 'right_ankle': 'Right Ankle',
            'left_foot': 'Left Foot', 'right_foot': 'Right Foot'
          };
          objectiveText += `    - ${regionLabels[loc.region] || loc.region}: ${loc.intensity}/10\n`;
        });
      }
      
      // CRITICAL: Include notes
      if (assessmentData.notes && assessmentData.notes.trim()) {
        objectiveText += `\n  Clinical Notes: ${assessmentData.notes}\n`;
      }
      if (assessmentData.barriers && assessmentData.barriers.trim()) {
        objectiveText += `  Barriers identified: ${assessmentData.barriers}\n`;
      }
    }
    // All other specialized assessments with detailed data extraction
    else if (data.measurement_type) {
      objectiveText += `• ${assessment.name}:\n`;
      
      // Extract all relevant data based on measurement type
      switch(data.measurement_type) {
        case '10_second_repeated_jump':
          if (data.jumps && data.jumps.length > 0) {
            const rsiValues = data.jumps.map(j => j.flight_time_ms / j.contact_time_ms);
            const bestRSI = Math.max(...rsiValues);
            const avgRSI = rsiValues.reduce((sum, r) => sum + r, 0) / rsiValues.length;
            
            objectiveText += `  Total Jumps: ${data.total_jumps}\n`;
            objectiveText += `  Best RSI: ${bestRSI.toFixed(3)}\n`;
            objectiveText += `  Average RSI: ${avgRSI.toFixed(3)}\n`;
            objectiveText += `  Average Flight Time: ${data.average_flight_time_ms}ms\n`;
            objectiveText += `  Average Contact Time: ${data.average_contact_time_ms}ms\n`;
            
            if (data.fatigue_index !== null && data.fatigue_index !== undefined) {
              objectiveText += `  Fatigue Index: ${data.fatigue_index.toFixed(1)}%\n`;
            }
            
            // Individual jump data
            objectiveText += `\n  Individual Jump Data:\n`;
            data.jumps.forEach((jump, idx) => {
              const rsi = (jump.flight_time_ms / jump.contact_time_ms).toFixed(3);
              objectiveText += `    Jump ${idx + 1}: Flight=${jump.flight_time_ms}ms, Contact=${jump.contact_time_ms}ms, RSI=${rsi}`;
              if (jump.jump_height_cm) objectiveText += `, Height=${jump.jump_height_cm}cm`;
              objectiveText += '\n';
            });
          }
          break;
        case 'berg_balance':
          if (data.berg_data) {
            objectiveText += `  Total Score: ${data.berg_data.total}/56\n`;
            objectiveText += `  Interpretation: ${data.berg_data.interpretation}\n`;
            
            // Include individual item scores
            if (data.berg_data.scores) {
              objectiveText += `\n  Individual Item Scores:\n`;
              const items = [
                'Sitting to Standing', 'Standing Unsupported', 'Sitting Unsupported', 'Standing to Sitting',
                'Transfers', 'Standing Eyes Closed', 'Standing Feet Together', 'Reaching Forward',
                'Retrieving Object', 'Turning to Look Behind', 'Turning 360°', 'Placing Foot on Stool',
                'Tandem Stance', 'Standing on One Foot'
              ];
              items.forEach((item, idx) => {
                const itemId = idx + 1;
                if (data.berg_data.scores[itemId] !== undefined) {
                  objectiveText += `    ${itemId}. ${item}: ${data.berg_data.scores[itemId]}/4\n`;
                }
              });
            }
          }
          break;
        case 'tug':
          if (data.tug_data) {
            objectiveText += `  Time: ${data.tug_data.time_seconds || data.tug_data.averageTime}s\n`;
            if (data.tug_data.trials) objectiveText += `  Trials: ${data.tug_data.trials.join('s, ')}s\n`;
            if (data.tug_data.assistive_device && data.tug_data.assistive_device !== 'none') {
              objectiveText += `  Assistive Device: ${data.tug_data.assistive_device}\n`;
            }
            if (data.tug_data.steps_taken) objectiveText += `  Steps: ${data.tug_data.steps_taken}\n`;
            if (data.tug_data.required_assistance && data.tug_data.required_assistance !== 'none') {
              objectiveText += `  Assistance: ${data.tug_data.required_assistance}\n`;
            }
            if (data.tug_data.obstacles_encountered) {
              objectiveText += `  Obstacles: ${data.tug_data.obstacles_encountered}\n`;
            }
            objectiveText += `  Interpretation: ${data.tug_data.interpretation}\n`;
            if (data.tug_data.observations) {
              objectiveText += `  Observations: ${data.tug_data.observations}\n`;
            }
          }
          break;
        case 'chair_stand':
        case '1_minute_sit_to_stand':
          if (data.chair_stand_data) {
            objectiveText += `  Repetitions: ${data.chair_stand_data.repetitions}\n`;
            objectiveText += `  Interpretation: ${data.chair_stand_data.interpretation}\n`;
          }
          break;
        case 'functional_reach': { const _fr=data.functional_reach_data||data; const _frAvg=_fr.averageReach??assessmentData.result_value; objectiveText+=`  Average Reach: ${_frAvg} cm\n`; if(_fr.trials)objectiveText+=`  Trials: ${_fr.trials.join('cm, ')}cm\n`; objectiveText+=`  Interpretation: ${_fr.interpretation||(_frAvg>=25?'Low Fall Risk':_frAvg>=15?'Moderate Risk':'High Fall Risk')}\n`; break; }
        case 'back_scratch':
          if (data.back_scratch_data) {
            objectiveText += `  Left Hand: ${data.back_scratch_data.left_best} cm\n`;
            objectiveText += `  Right Hand: ${data.back_scratch_data.right_best} cm\n`;
            objectiveText += `  Average: ${data.back_scratch_data.average_distance} cm\n`;
          }
          break;
        case 'sit_and_reach':
          if (data.sit_reach_data) {
            objectiveText += `  Best Score: ${data.sit_reach_data.best_score} cm\n`;
            if (data.sit_reach_data.trials) objectiveText += `  Trials: ${data.sit_reach_data.trials.join('cm, ')}cm\n`;
          }
          break;
        case 'moca':
          if (data.moca_data) {
            objectiveText += `  Total Score: ${data.moca_data.total}/30\n`;
            objectiveText += `  Domain Scores:\n`;
            if (data.moca_data.visuospatial !== undefined) objectiveText += `    - Visuospatial/Executive: ${data.moca_data.visuospatial}/5\n`;
            if (data.moca_data.naming !== undefined) objectiveText += `    - Naming: ${data.moca_data.naming}/3\n`;
            if (data.moca_data.attention !== undefined) objectiveText += `    - Attention: ${data.moca_data.attention}/6\n`;
            if (data.moca_data.language !== undefined) objectiveText += `    - Language: ${data.moca_data.language}/3\n`;
            if (data.moca_data.abstraction !== undefined) objectiveText += `    - Abstraction: ${data.moca_data.abstraction}/2\n`;
            if (data.moca_data.delayed_recall !== undefined) objectiveText += `    - Delayed Recall: ${data.moca_data.delayed_recall}/5\n`;
            if (data.moca_data.orientation !== undefined) objectiveText += `    - Orientation: ${data.moca_data.orientation}/6\n`;
          }
          break;
        case 'mmt':
          if (data.mmt_data && data.mmt_data.tests) {
            objectiveText += `  Average Grade: ${data.mmt_data.averageGrade?.toFixed(1)}/5\n`;
            objectiveText += `  Individual Muscle Tests:\n`;
            data.mmt_data.tests.forEach(test => {
              const sideLabel = test.side ? ` (${test.side.toUpperCase()})` : '';
              objectiveText += `    - ${test.muscle}${sideLabel}: ${test.grade}/5\n`;
            });
          }
          break;
        case 'whr':
          if (data.whr_data) {
            objectiveText += `  Waist: ${data.whr_data.waist_cm} cm\n`;
            objectiveText += `  Hip: ${data.whr_data.hip_cm} cm\n`;
            objectiveText += `  WHR: ${data.whr_data.whr_value}\n`;
            objectiveText += `  Risk Category: ${data.whr_data.risk_category}\n`;
          }
          break;
        case 'gad7':
          if (data.gad7_data) {
            objectiveText += `  Total Score: ${data.gad7_data.total_score}/21\n`;
            objectiveText += `  Severity: ${data.gad7_data.severity}\n`;
          }
          break;
        case 'phq9':
          if (data.phq9_data) {
            objectiveText += `  Total Score: ${data.phq9_data.total_score}/27\n`;
            objectiveText += `  Severity: ${data.phq9_data.severity}\n`;
            if (data.phq9_data.suicidal_ideation_endorsed) {
              objectiveText += `  ⚠ ALERT: Suicidal ideation endorsed - follow-up required\n`;
            }
          }
          break;
        case 'k10':
          if (data.k10_data) {
            objectiveText += `  Total Score: ${data.k10_data.total_score}/50\n`;
            objectiveText += `  Severity: ${data.k10_data.severity}\n`;
            objectiveText += `  Risk Level: ${data.k10_data.risk_level}\n`;
          }
          break;
        case 'hoos':
        case 'koos':
          const outcomeData = data.hoos_data || data.koos_data;
          if (outcomeData) {
            objectiveText += `  Average Score: ${outcomeData.average_score}/100\n`;
            objectiveText += `  Subscale Scores:\n`;
            if (outcomeData.pain_score !== undefined) objectiveText += `    - Pain: ${outcomeData.pain_score}/100\n`;
            if (outcomeData.symptoms_score !== undefined) objectiveText += `    - Symptoms: ${outcomeData.symptoms_score}/100\n`;
            if (outcomeData.adl_score !== undefined) objectiveText += `    - ADL: ${outcomeData.adl_score}/100\n`;
            if (outcomeData.sport_rec_score !== undefined) objectiveText += `    - Sport/Recreation: ${outcomeData.sport_rec_score}/100\n`;
            if (outcomeData.qol_score !== undefined) objectiveText += `    - Quality of Life: ${outcomeData.qol_score}/100\n`;
          }
          break;
        case 'single_leg_hop':
          if (data.single_leg_hop_data) {
            objectiveText += `  Limb Symmetry Index: ${data.single_leg_hop_data.result_value}%\n`;
            objectiveText += `  Single Hop - Left: ${data.single_leg_hop_data.single_hop_left}cm, Right: ${data.single_leg_hop_data.single_hop_right}cm\n`;
            if (data.single_leg_hop_data.triple_hop_left) {
              objectiveText += `  Triple Hop - Left: ${data.single_leg_hop_data.triple_hop_left}cm, Right: ${data.single_leg_hop_data.triple_hop_right}cm\n`;
            }
            if (data.single_leg_hop_data.crossover_hop_left) {
              objectiveText += `  Crossover Hop - Left: ${data.single_leg_hop_data.crossover_hop_left}cm, Right: ${data.single_leg_hop_data.crossover_hop_right}cm\n`;
            }
          }
          break;
        case 'six_minute_walk':
          if (data.sixmwt_data) {
            const sixmwtData = data.sixmwt_data;
            objectiveText += `  Distance: ${sixmwtData.distance_metres}m\n`;
            if (sixmwtData.test_duration) {
              objectiveText += `  Test Duration: ${Math.floor(sixmwtData.test_duration / 60)}:${(sixmwtData.test_duration % 60).toString().padStart(2, '0')}\n`;
            }
            if (sixmwtData.laps_completed) objectiveText += `  Laps Completed: ${sixmwtData.laps_completed}\n`;
            if (sixmwtData.rest_periods_count !== undefined) objectiveText += `  Rest Periods: ${sixmwtData.rest_periods_count}\n`;

            objectiveText += `\n  Pre-Test Measurements:\n`;
            if (sixmwtData.pre_hr) objectiveText += `    HR: ${sixmwtData.pre_hr} bpm\n`;
            if (sixmwtData.pre_bp_sys && sixmwtData.pre_bp_dia) objectiveText += `    BP: ${sixmwtData.pre_bp_sys}/${sixmwtData.pre_bp_dia} mmHg\n`;
            if (sixmwtData.pre_spo2) objectiveText += `    SpO2: ${sixmwtData.pre_spo2}%\n`;
            if (sixmwtData.pre_rpe) objectiveText += `    RPE: ${sixmwtData.pre_rpe}/20\n`;

            objectiveText += `\n  Post-Test Measurements:\n`;
            if (sixmwtData.post_hr) objectiveText += `    HR: ${sixmwtData.post_hr} bpm\n`;
            if (sixmwtData.post_spo2) objectiveText += `    SpO2: ${sixmwtData.post_spo2}%\n`;
            if (sixmwtData.post_rpe) objectiveText += `    RPE: ${sixmwtData.post_rpe}/20\n`;
            if (sixmwtData.post_dyspnea) objectiveText += `    Dyspnea: ${sixmwtData.post_dyspnea}/10\n`;

            if (sixmwtData.terminated && sixmwtData.termination_reason) {
              objectiveText += `\n  ⚠ Test Terminated: ${sixmwtData.termination_reason}\n`;
            }

            if (sixmwtData.rest_periods_detail && sixmwtData.rest_periods_detail.length > 0) {
              objectiveText += `\n  Rest Period Details:\n`;
              sixmwtData.rest_periods_detail.forEach((rest, idx) => {
                objectiveText += `    Rest #${idx + 1} at ${Math.floor(rest.time / 60)}:${(rest.time % 60).toString().padStart(2, '0')}`;
                if (rest.reason) objectiveText += `, Reason: ${rest.reason}`;
                if (rest.hr) objectiveText += `, HR: ${rest.hr} bpm`;
                if (rest.spo2) objectiveText += `, SpO2: ${rest.spo2}%`;
                objectiveText += '\n';
              });
            }

            if (sixmwtData.notes && sixmwtData.notes.trim()) {
              objectiveText += `\n  Test Notes: ${sixmwtData.notes}\n`;
            }
          }
          break;
        case 'ten_meter_walk':
          if (data.ten_meter_walk_data) {
            const walkData = data.ten_meter_walk_data;
            objectiveText += `  Walking Speed Type: ${walkData.walking_speed_type === 'comfortable' ? 'Comfortable Pace' : 'Fast Pace'}\n`;
            objectiveText += `  Average Speed: ${walkData.average_speed} m/s\n`;
            objectiveText += `  Average Time: ${walkData.average_time}s\n`;
            objectiveText += `  Interpretation: ${walkData.interpretation}\n`;
            if (walkData.assistive_device && walkData.assistive_device !== 'none') {
              objectiveText += `  Assistive Device: ${walkData.assistive_device}\n`;
            }
            objectiveText += `\n  Individual Trials (${walkData.trials.length}):\n`;
            walkData.trials.forEach((trial, idx) => {
              const speed = (10 / parseFloat(trial.time)).toFixed(2);
              objectiveText += `    Trial ${idx + 1}: ${trial.time}s (${speed} m/s)`;
              if (trial.steps) objectiveText += ` - ${trial.steps} steps`;
              if (trial.observations) objectiveText += ` - ${trial.observations}`;
              objectiveText += '\n';
            });
            if (walkData.notes && walkData.notes.trim()) {
              objectiveText += `  Test Notes: ${walkData.notes}\n`;
            }
          }
          break;
        case 'cooper_test':
          if (data.cooper_data) {
            const cooperData = data.cooper_data;
            objectiveText += `  Distance: ${cooperData.distance_metres}m\n`;
            objectiveText += `  Estimated VO₂max: ${cooperData.estimated_vo2max} ml/kg/min\n`;
            if (cooperData.rpe) objectiveText += `  RPE: ${cooperData.rpe}/20\n`;
            if (cooperData.notes && cooperData.notes.trim()) {
              objectiveText += `  Test Notes: ${cooperData.notes}\n`;
            }
          }
          break;
        case 'beep_test':
          if (data.beep_data || data.final_level) { const beepInfo = data.beep_data || data; objectiveText += `  20m Shuttle Run (Beep Test):\n  MSFT Result: Level ${beepInfo.final_level} Shuttle ${beepInfo.final_shuttle}\n`; if (beepInfo.total_shuttles_completed) objectiveText += `  Total Shuttles Completed: ${beepInfo.total_shuttles_completed}\n`; if (beepInfo.rpe_6_20) objectiveText += `  RPE: ${beepInfo.rpe_6_20}/20\n`; if (beepInfo.peak_hr_bpm) objectiveText += `  Peak HR: ${beepInfo.peak_hr_bpm} bpm\n`; if (beepInfo.termination_reason) objectiveText += `  Termination Reason: ${beepInfo.termination_reason}\n`; if (beepInfo.symptoms_reported?.trim()) objectiveText += `  Symptoms Reported: ${beepInfo.symptoms_reported}\n`; if (beepInfo.notes_deviation?.trim()) objectiveText += `  Protocol Notes: ${beepInfo.notes_deviation}\n`; } break;
        case '4_stage_balance':
          if (data.four_stage_balance_data) { const fsb = data.four_stage_balance_data; objectiveText += `  Highest Stage Achieved: ${fsb.stage_achieved}/4\n  Fall Risk: ${fsb.fall_risk === 'increased' ? 'Increased ⚠' : 'Normal ✓'}\n  Stage 1 (Feet Together): ${fsb.feet_together || '-'} (${fsb.feet_together_time?.toFixed(1) || '-'}s)\n  Stage 2 (Semi-Tandem): ${fsb.semi_tandem || '-'} (${fsb.semi_tandem_time?.toFixed(1) || '-'}s)\n  Stage 3 (Tandem): ${fsb.tandem || '-'} (${fsb.tandem_time?.toFixed(1) || '-'}s)\n  Stage 4 (Single Leg): ${fsb.single_leg || '-'} (${fsb.single_leg_time?.toFixed(1) || '-'}s)\n`; if (fsb.clinician_notes) objectiveText += `  Overall Notes: ${fsb.clinician_notes}\n`; if (fsb.stage_notes) Object.entries(fsb.stage_notes).forEach(([s, n]) => { if (n) objectiveText += `  Notes for ${s.replace(/_/g, ' ')}: ${n}\n`; }); } break;
        case 'thessaly':
        case 'apleys':
        case 'noble':
          const testData = data.thessaly_data || data.apleys_data || data.noble_data;
          if (testData) {
            if (testData.left_data) objectiveText += `  Left Knee: ${testData.left_data.interpretation}\n`;
            if (testData.right_data) objectiveText += `  Right Knee: ${testData.right_data.interpretation}\n`;
          }
          break;
        default:
          // COMPREHENSIVE FALLBACK: Include ALL data from test runners
          objectiveText += `  Result: ${assessmentData.result_value}`;
          if (assessment.unit_of_measure) objectiveText += ` ${assessment.unit_of_measure}`;
          objectiveText += '\n';
          
          // Auto-include any additional structured data not already handled
          if (data && typeof data === 'object') {
            // Exclude already-displayed fields
            const excludeKeys = ['measurement_type'];
            Object.entries(data).forEach(([key, value]) => {
              if (excludeKeys.includes(key)) return;
              if (value === null || value === undefined || value === '') return;
              
              // Format nested objects (like test data)
              if (typeof value === 'object' && !Array.isArray(value)) {
                objectiveText += `\n  ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:\n`;
                Object.entries(value).forEach(([subKey, subValue]) => {
                  if (subValue !== null && subValue !== undefined && subValue !== '') {
                    objectiveText += `    - ${subKey.replace(/_/g, ' ')}: ${subValue}\n`;
                  }
                });
              } else if (Array.isArray(value) && value.length > 0) {
                objectiveText += `  ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${value.length} items recorded\n`;
              } else {
                objectiveText += `  ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${value}\n`;
              }
            });
          }
      }
    }
    else {
      // Standard assessment formatting
      objectiveText += `• ${assessment.name}: ${assessmentData.result_value}`;
      if (assessment.unit_of_measure) {
        objectiveText += ` ${assessment.unit_of_measure}`;
      }
      objectiveText += '\n';

      // Add additional scales for 5xSTS
      if (data.rpe_scale) {
        objectiveText += `  - RPE: ${data.rpe_scale}/20\n`;
      }
      if (data.breathlessness_scale) {
        objectiveText += `  - Breathlessness: ${data.breathlessness_scale}/10\n`;
      }
      if (data.pain_scale) {
        objectiveText += `  - Pain: ${data.pain_scale}/10\n`;
      }
    }

    // CRITICAL: Always include notes and barriers at the end
    if (assessmentData.notes && assessmentData.notes.trim()) {
      objectiveText += `\n  Clinical Notes: ${assessmentData.notes}\n`;
    }

    if (assessmentData.barriers && assessmentData.barriers.trim()) {
      objectiveText += `  Barriers Identified: ${assessmentData.barriers}\n`;
    }

    return objectiveText;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if client is selected in standalone mode
    if (isStandaloneMode && !selectedClient) {
      toast.error("Please select a client to assign this assessment to.");
      return;
    }

    setIsSubmitting(true);
    try {
      // If standalone mode or missing clientAssessment id, create a new record
      let assessmentToUpdate = clientAssessment;
      const needsCreate = (isStandaloneMode && selectedClient) || !assessmentToUpdate?.id;
      if (needsCreate) {
        const tc = (isStandaloneMode && selectedClient) ? selectedClient : client;
        if (!tc?.id) { toast.error("No client found. Cannot save."); setIsSubmitting(false); return; }
        assessmentToUpdate = await base44.entities.ClientAssessment.create({ org_id: tc.org_id, client_id: tc.id, assessment_id: assessment.id, status: 'pending', assessment_date: resolveAssessmentDate(result.assessment_date) });
      }

      let updateData = {
        status: 'completed',
        // Base date: the visible Assessment Date field (the runner-provided date
        // for manual-entry branches). Dedicated-runner branches override this
        // below with the date resolved from their own runner payload.
        assessment_date: resolveAssessmentDate(result.assessment_date),
        notes: result.notes,
        barriers: result.barriers,
        appointment_id: appointmentId || clientAssessment?.appointment_id
      };

      // Dedicated runners must come BEFORE generic questionnaire check
      if (isIESR()) {
        updateData.result_value = iesrData.result_value;
        updateData.additional_data = { iesr_data: iesrData, measurement_type: 'iesr' };
        updateData.assessment_date = resolveAssessmentDate(iesrData?.assessment_date);
      } else if (isPCL5()) {
        updateData.result_value = pcl5Data.result_value;
        updateData.additional_data = { pcl5_data: pcl5Data, measurement_type: 'pcl5' };
        updateData.assessment_date = resolveAssessmentDate(pcl5Data?.assessment_date);
      } else if (isISI()) {
        updateData.result_value = isiData.result_value;
        updateData.additional_data = { isi_data: isiData, measurement_type: 'isi' };
        updateData.assessment_date = resolveAssessmentDate(isiData?.assessment_date);
      } else if (isMRCDyspnea()) {
        updateData.result_value = mrcDyspneaData.result_value;
        updateData.additional_data = { mrc_dyspnea_data: mrcDyspneaData, measurement_type: 'mrc_dyspnea' };
        updateData.assessment_date = resolveAssessmentDate(mrcDyspneaData?.assessment_date);
      } else if (isCAT()) {
        updateData.result_value = catData.result_value;
        updateData.additional_data = { cat_data: catData, measurement_type: 'cat' };
        updateData.assessment_date = resolveAssessmentDate(catData?.assessment_date);
      } else if (isCCQ()) {
        updateData.result_value = ccqData.result_value;
        updateData.additional_data = { ccq_data: ccqData, measurement_type: 'ccq' };
        updateData.assessment_date = resolveAssessmentDate(ccqData?.assessment_date);
      } else if (isLCQ()) {
        updateData.result_value = lcqData.result_value;
        updateData.additional_data = { lcq_data: lcqData, measurement_type: 'lcq' };
        updateData.assessment_date = resolveAssessmentDate(lcqData?.assessment_date);
      } else if (isIKDC()) {
        updateData.result_value = ikdcData.result_value;
        updateData.additional_data = { ikdc_data: ikdcData, measurement_type: 'ikdc' };
        updateData.assessment_date = resolveAssessmentDate(ikdcData?.assessment_date);
      } else if (isFIM()) {
        updateData.result_value = fimData.result_value;
        updateData.additional_data = { fim_data: fimData, measurement_type: 'fim' };
        updateData.assessment_date = resolveAssessmentDate(fimData?.assessment_date);
      } else if (isBarthel()) {
        updateData.result_value = barthelData.result_value;
        updateData.additional_data = { barthel_data: barthelData, measurement_type: 'barthel' };
        updateData.assessment_date = resolveAssessmentDate(barthelData?.assessment_date);
      } else if (isModifiedRankin()) { updateData.result_value = modifiedRankinData.result_value; updateData.additional_data = modifiedRankinData.additional_data || { modified_rankin_data: modifiedRankinData, measurement_type: 'modified_rankin' };
      updateData.assessment_date = resolveAssessmentDate(modifiedRankinData?.assessment_date);
      } else if (isRivermead()) { updateData.result_value = rivermeadData.result_value; updateData.additional_data = { rivermead_data: rivermeadData, measurement_type: 'rivermead' }; updateData.assessment_date = resolveAssessmentDate(rivermeadData?.assessment_date);
      } else if (isRMDQ()) {
        updateData.result_value = rmdqData.result_value;
        updateData.additional_data = { rmdq_data: rmdqData, measurement_type: 'rmdq' };
        updateData.assessment_date = resolveAssessmentDate(rmdqData?.assessment_date);
      } else if (isQuickDASH()) {
        updateData.result_value = quickDASHData.result_value;
        updateData.additional_data = { quick_dash_data: quickDASHData, measurement_type: 'quick_dash' };
        updateData.assessment_date = resolveAssessmentDate(quickDASHData?.assessment_date);
      } else if (isFAAM()) {
        updateData.result_value = faamData.result_value;
        updateData.additional_data = faamData.additional_data || { faam_data: faamData, measurement_type: 'faam' };
        updateData.assessment_date = resolveAssessmentDate(faamData?.assessment_date);
      } else if (isABCScale()) {
        updateData.result_value = abcScaleData.result_value;
        updateData.additional_data = abcScaleData.additional_data || { abc_scale_data: abcScaleData, measurement_type: 'abc_scale' };
        updateData.assessment_date = resolveAssessmentDate(abcScaleData?.assessment_date);
      } else if (isChalder()) {
        updateData.result_value = chalderData.result_value;
        updateData.additional_data = chalderData.additional_data || { chalder_data: chalderData, measurement_type: 'chalder' };
        updateData.assessment_date = resolveAssessmentDate(chalderData?.assessment_date);
      } else if (isPSQI()) {
        updateData.result_value = psqiData.result_value;
        updateData.additional_data = psqiData.additional_data || { psqi_data: psqiData, measurement_type: 'psqi' };
        updateData.assessment_date = resolveAssessmentDate(psqiData?.assessment_date);
      } else if (isSARCF()) {
        updateData.result_value = sarcfData.result_value;
        updateData.additional_data = sarcfData.additional_data || { sarcf_data: sarcfData, measurement_type: 'sarcf' };
        updateData.assessment_date = resolveAssessmentDate(sarcfData?.assessment_date);
      } else if (isNDI()) {
        updateData.result_value = ndiData.result_value;
        updateData.additional_data = ndiData.additional_data || { ndi_data: ndiData, measurement_type: 'ndi' };
        updateData.assessment_date = resolveAssessmentDate(ndiData?.assessment_date);
      } else if (isODI()) {
        updateData.result_value = odiData.result_value;
        updateData.additional_data = odiData.additional_data || { odi_data: odiData, measurement_type: 'odi' };
        updateData.assessment_date = resolveAssessmentDate(odiData?.assessment_date);
      } else if (isASES()) {
        updateData.result_value = asesData.result_value;
        updateData.additional_data = asesData.additional_data || { ases_data: asesData, measurement_type: 'ases' };
        updateData.assessment_date = resolveAssessmentDate(asesData?.assessment_date);
      } else if (isDEXA()) {
        updateData.result_value = dexaData.result_value;
        updateData.additional_data = dexaData.additional_data || { dexa_data: dexaData, measurement_type: 'dexa' };
        updateData.assessment_date = resolveAssessmentDate(dexaData?.assessment_date);
      } else if (isConley()) {
        updateData.result_value = conleyData.result_value;
        updateData.additional_data = conleyData.additional_data || { conley_data: conleyData, measurement_type: 'conley' };
        updateData.assessment_date = resolveAssessmentDate(conleyData?.assessment_date);
      } else if (isPSS()) {
        updateData.result_value = pssData.result_value;
        updateData.additional_data = pssData.additional_data || { pss_data: pssData, measurement_type: 'pss' };
        updateData.assessment_date = resolveAssessmentDate(pssData?.assessment_date);
      } else if (isConstantMurley()) {
        updateData.result_value = constantMurleyData.result_value;
        updateData.additional_data = constantMurleyData.additional_data || { constant_murley_data: constantMurleyData, measurement_type: 'constant_murley' };
        updateData.assessment_date = resolveAssessmentDate(constantMurleyData?.assessment_date);
      } else if (isLysholm()) {
        updateData.result_value = lysholmData.result_value;
        updateData.additional_data = lysholmData.additional_data || { lysholm_data: lysholmData, measurement_type: 'lysholm' };
        updateData.assessment_date = resolveAssessmentDate(lysholmData?.assessment_date);
      } else if (isACLRSI()) {
        updateData.result_value = aclrsiData.result_value;
        updateData.additional_data = aclrsiData.additional_data || { ...aclrsiData, measurement_type: 'aclrsi' };
        updateData.assessment_date = resolveAssessmentDate(aclrsiData?.assessment_date);
      } else if (isGROC()) {
        updateData.result_value = grocData.result_value;
        updateData.additional_data = grocData.additional_data || { groc_data: grocData, measurement_type: 'groc' };
        updateData.assessment_date = resolveAssessmentDate(grocData?.assessment_date);
      } else if (isSGRQ()) {
        updateData.result_value = sgrqData.result_value;
        updateData.additional_data = sgrqData.additional_data || { sgrq_data: sgrqData, measurement_type: 'sgrq' };
        updateData.assessment_date = resolveAssessmentDate(sgrqData?.assessment_date);
      } else if (isFABQ()) {
        updateData.result_value = fabqData.result_value;
        updateData.additional_data = fabqData.additional_data || { fabq_data: fabqData, measurement_type: 'fabq' };
        updateData.assessment_date = resolveAssessmentDate(fabqData?.assessment_date);
      } else if (isSingleLegHop()) {
        updateData.result_value = singleLegHopData.result_value;
        updateData.additional_data = singleLegHopData.additional_data || { single_leg_hop_data: singleLegHopData, measurement_type: 'single_leg_hop' };
        updateData.assessment_date = resolveAssessmentDate(singleLegHopData?.assessment_date);
      } else if (isDropVerticalJump()) {
        updateData.result_value = dropVerticalJumpData.result_value;
        updateData.additional_data = dropVerticalJumpData.additional_data || { drop_vertical_jump_data: dropVerticalJumpData, measurement_type: 'drop_vertical_jump' };
        updateData.assessment_date = resolveAssessmentDate(dropVerticalJumpData?.assessment_date);
      } else if (isVerticalJump()) {
        updateData.result_value = verticalJumpData.result_value;
        updateData.additional_data = verticalJumpData.additional_data || { vertical_jump_data: verticalJumpData, measurement_type: 'vertical_jump' };
        updateData.assessment_date = resolveAssessmentDate(verticalJumpData?.assessment_date);
      } else if (isClockDrawing()) {
        updateData.result_value = clockDrawingData.result_value;
        updateData.additional_data = clockDrawingData.additional_data || { clock_drawing_data: clockDrawingData, measurement_type: 'clock_drawing' };
        updateData.assessment_date = resolveAssessmentDate(clockDrawingData?.assessment_date);
      } else if (isTMT()) {
        updateData.result_value = tmtData.result_value;
        updateData.additional_data = tmtData.additional_data || { tmt_data: tmtData, measurement_type: 'tmt' };
        updateData.assessment_date = resolveAssessmentDate(tmtData?.assessment_date);
      } else if (isTinetti()) {
        updateData.result_value = tinettiData.result_value;
        updateData.additional_data = tinettiData.additional_data || { tinetti_data: tinettiData, measurement_type: 'tinetti' };
        updateData.assessment_date = resolveAssessmentDate(tinettiData?.assessment_date);
      } else if (is6MWT()) {
        updateData.result_value = sixMWTData.distance_metres;
        updateData.additional_data = sixMWTData.additional_data || {
          sixmwt_data: sixMWTData,
          measurement_type: 'six_minute_walk'
        };
        updateData.assessment_date = resolveAssessmentDate(sixMWTData?.assessment_date);
        if (sixMWTData.notes && !result.notes.includes(sixMWTData.notes)) {
          updateData.notes = sixMWTData.notes + (result.notes ? '\n\n' + result.notes : '');
        }
      } else if (isDASS21()) { if (!dass21Data) { toast.error("Please complete the DASS-21 questionnaire first."); setIsSubmitting(false); return; } const d21=dass21Data.additional_data||dass21Data; updateData.result_value=(d21.depression_score||0)+(d21.anxiety_score||0)+(d21.stress_score||0); updateData.additional_data=d21; updateData.assessment_date = resolveAssessmentDate(dass21Data?.assessment_date);
      } else if (isHADSTest()) { const hd=hadsData.additional_data||hadsData; updateData.result_value=(hd.anxiety_score||0)+(hd.depression_score||0); updateData.additional_data=hd; updateData.assessment_date = resolveAssessmentDate(hadsData?.assessment_date);
      } else if (isClinicalFrailtyScaleTest()) {
        updateData.result_value = clinicalFrailtyScaleData.frailty_score;
        updateData.additional_data = clinicalFrailtyScaleData.additional_data || clinicalFrailtyScaleData;
        updateData.assessment_date = resolveAssessmentDate(clinicalFrailtyScaleData?.assessment_date);
      } else if (isQuestionnaireAssessment()) {
        const score = calculateQuestionnaireScore();
        updateData.result_value = score;
        updateData.additional_data = {
          responses: questionnaireResponses,
          measurement_type: 'questionnaire'
        };
      } else if (isHandGripAssessment(assessment.name)) {
        const { bestDominant, bestNonDominant } = calculateBestGripScore();
        updateData.result_value = bestDominant; // Primary result is best dominant hand score
        updateData.additional_data = {
          dominant_hand: result.dominant_hand,
          dominant_trial_1: parseFloat(result.dominant_trial_1) || null,
          dominant_trial_2: parseFloat(result.dominant_trial_2) || null,
          dominant_trial_3: parseFloat(result.dominant_trial_3) || null,
          non_dominant_trial_1: parseFloat(result.non_dominant_trial_1) || null,
          non_dominant_trial_2: parseFloat(result.non_dominant_trial_2) || null,
          non_dominant_trial_3: parseFloat(result.non_dominant_trial_3) || null,
          dominant_best: bestDominant,
          non_dominant_best: bestNonDominant,
          measurement_type: 'hand_grip_strength'
        };
      } else if (is6MinuteWalkTest()) {
        updateData.result_value = parseFloat(result.result_value); // Distance in meters
        updateData.additional_data = {
          sixmwt_pre_hr: result.sixmwt_pre_hr ? parseFloat(result.sixmwt_pre_hr) : null,
          sixmwt_pre_bp_sys: result.sixmwt_pre_bp_sys ? parseFloat(result.sixmwt_pre_bp_sys) : null,
          sixmwt_pre_bp_dia: result.sixmwt_pre_bp_dia ? parseFloat(result.sixmwt_pre_bp_dia) : null,
          sixmwt_pre_spo2: result.sixmwt_pre_spo2 ? parseFloat(result.sixmwt_pre_spo2) : null,
          sixmwt_pre_rpe: result.sixmwt_pre_rpe ? parseFloat(result.sixmwt_pre_rpe) : null,
          sixmwt_post_hr: result.sixmwt_post_hr ? parseFloat(result.sixmwt_post_hr) : null,
          sixmwt_post_spo2: result.sixmwt_post_spo2 ? parseFloat(result.sixmwt_post_spo2) : null,
          sixmwt_post_rpe: result.sixmwt_post_rpe ? parseFloat(result.sixmwt_post_rpe) : null,
          sixmwt_post_dyspnea: result.sixmwt_post_dyspnea ? parseFloat(result.sixmwt_post_dyspnea) : null,
          sixmwt_laps: result.sixmwt_laps ? parseFloat(result.sixmwt_laps) : null,
          sixmwt_rest_periods: result.sixmwt_rest_periods ? parseFloat(result.sixmwt_rest_periods) : null,
          measurement_type: '6mwt'
        };
      } else if (is2MinuteStepTest()) {
        updateData.result_value = parseFloat(result.result_value); // Total steps
        updateData.additional_data = {
          two_min_step_rpe: result.two_min_step_rpe ? parseFloat(result.two_min_step_rpe) : null,
          two_min_step_breathlessness: result.two_min_step_breathlessness ? parseFloat(result.two_min_step_breathlessness) : null,
          two_min_step_pain: result.two_min_step_pain ? parseFloat(result.two_min_step_pain) : null,
          measurement_type: '2min_step'
        };
      } else if (isSingleLegStance()) {
        // Calculate best times for each condition
        const leftEyesOpen = parseFloat(result.sls_left_eyes_open) || 0;
        const rightEyesOpen = parseFloat(result.sls_right_eyes_open) || 0;
        const leftEyesClosed = parseFloat(result.sls_left_eyes_closed) || 0;
        const rightEyesClosed = parseFloat(result.sls_right_eyes_closed) || 0;
        
        // Best eyes open result (primary measure)
        const bestEyesOpen = Math.max(leftEyesOpen, rightEyesOpen);
        
        updateData.result_value = bestEyesOpen; // Best eyes open as primary result
        updateData.additional_data = {
          sls_left_eyes_open: leftEyesOpen || null,
          sls_right_eyes_open: rightEyesOpen || null,
          sls_left_eyes_closed: leftEyesClosed || null,
          sls_right_eyes_closed: rightEyesClosed || null,
          sls_dominant_leg: result.sls_dominant_leg || null,
          sls_required_support: result.sls_required_support || null,
          sls_stop_reason: result.sls_stop_reason || null,
          best_eyes_open: bestEyesOpen,
          best_eyes_closed: Math.max(leftEyesClosed, rightEyesClosed),
          measurement_type: 'single_leg_stance'
        };
      } else if (isYBalanceTest()) {
        const limbLengthLeft = parseFloat(result.ybt_limb_length_left) || 0;
        const limbLengthRight = parseFloat(result.ybt_limb_length_right) || 0;
        
        const leftAnt = parseFloat(result.ybt_left_anterior) || 0;
        const leftPM = parseFloat(result.ybt_left_posteromedial) || 0;
        const leftPL = parseFloat(result.ybt_left_posterolateral) || 0;
        const rightAnt = parseFloat(result.ybt_right_anterior) || 0;
        const rightPM = parseFloat(result.ybt_right_posteromedial) || 0;
        const rightPL = parseFloat(result.ybt_right_posterolateral) || 0;
        
        // Calculate composite scores
        const leftComposite = limbLengthLeft > 0 ? ((leftAnt + leftPM + leftPL) / (3 * limbLengthLeft)) * 100 : 0;
        const rightComposite = limbLengthRight > 0 ? ((rightAnt + rightPM + rightPL) / (3 * limbLengthRight)) * 100 : 0;
        
        updateData.result_value = Math.max(leftComposite, rightComposite).toFixed(1);
        updateData.additional_data = {
          ybt_limb_length_left: limbLengthLeft || null,
          ybt_limb_length_right: limbLengthRight || null,
          ybt_left_anterior: leftAnt || null,
          ybt_left_posteromedial: leftPM || null,
          ybt_left_posterolateral: leftPL || null,
          ybt_right_anterior: rightAnt || null,
          ybt_right_posteromedial: rightPM || null,
          ybt_right_posterolateral: rightPL || null,
          left_composite: leftComposite.toFixed(1),
          right_composite: rightComposite.toFixed(1),
          anterior_asymmetry: Math.abs(leftAnt - rightAnt).toFixed(1),
          measurement_type: 'y_balance'
        };
      } else if (is10MeterWalkTest() || isTenMeterWalk()) {
        updateData.result_value = tenMeterWalkData?.average_speed;
        updateData.additional_data = {
          ten_meter_walk_data: tenMeterWalkData,
          measurement_type: 'ten_meter_walk'
        };
        updateData.assessment_date = resolveAssessmentDate(tenMeterWalkData?.assessment_date);
        // Merge notes from test runner
        if (tenMeterWalkData.notes) {
          updateData.notes = tenMeterWalkData.notes + (result.notes ? '\n\n' + result.notes : '');
        }
      } else if (is4StageBalanceTest()) {
        if (fourStageBalanceData) {
          updateData.result_value = fourStageBalanceData.stage_achieved;
          updateData.notes = fourStageBalanceData.clinician_notes || fourStageBalanceData.notes || updateData.notes;
          updateData.additional_data = { four_stage_balance_data: fourStageBalanceData, measurement_type: '4_stage_balance' };
          updateData.assessment_date = resolveAssessmentDate(fourStageBalanceData?.assessment_date);
        } else {
          const feetTogether = result.four_stage_feet_together;
          const semiTandem = result.four_stage_semi_tandem;
          const tandem = result.four_stage_tandem;
          const singleLeg = result.four_stage_single_leg;
          let stageAchieved = 0;
          if (feetTogether === 'pass') stageAchieved = 1;
          if (semiTandem === 'pass') stageAchieved = 2;
          if (tandem === 'pass') stageAchieved = 3;
          if (singleLeg === 'pass') stageAchieved = 4;
          updateData.result_value = stageAchieved;
          updateData.additional_data = { four_stage_balance_data: { stage_achieved: stageAchieved, feet_together: feetTogether, semi_tandem: semiTandem, tandem, single_leg: singleLeg, fall_risk: tandem !== 'pass' ? 'increased' : 'normal' }, measurement_type: '4_stage_balance' };
        }
      } else if (isHeartRateRecovery()) {
          const peakHR = parseFloat(result.hrr_peak_hr) || 0;
          const hr1min = parseFloat(result.hrr_1min) || 0;
          const hr2min = parseFloat(result.hrr_2min) || 0;
          const hr3min = parseFloat(result.hrr_3min) || 0;

          const hrr1 = peakHR > 0 && hr1min > 0 ? peakHR - hr1min : null;
          const hrr2 = peakHR > 0 && hr2min > 0 ? peakHR - hr2min : null;
          const hrr3 = peakHR > 0 && hr3min > 0 ? peakHR - hr3min : null;

          updateData.result_value = hrr1 || 0; // Primary result is HRR at 1 minute
          updateData.additional_data = {
          hrr_peak_hr: peakHR || null,
          hrr_1min: hr1min || null,
          hrr_2min: hr2min || null,
          hrr_3min: hr3min || null,
          hrr_at_1min: hrr1,
          hrr_at_2min: hrr2,
          hrr_at_3min: hrr3,
          measurement_type: 'heart_rate_recovery'
          };
          } else if (isPainScales()) {
            updateData.result_value = parseFloat(result.result_value);
            updateData.additional_data = {
              pain_locations: result.pain_locations || [],
              measurement_type: 'pain_scales'
            };
          } else if (isROMAssessment()) {
            // Count number of measurements taken
            const romData = result.rom_data;
            let measurementCount = 0;
            if (romData?.measurements) {
              Object.values(romData.measurements).forEach(m => {
                if (m.left) measurementCount++;
                if (m.right) measurementCount++;
              });
            }
            updateData.result_value = measurementCount;
            updateData.additional_data = {
              rom_data: romData,
              measurement_type: 'rom_assessment'
            };
            updateData.assessment_date = resolveAssessmentDate(romData?.assessment_date);
          } else if (isEbbelingTest()) {
            updateData.result_value = parseFloat(result.result_value);
            updateData.additional_data = {
              ...result.ebbeling_data,
              measurement_type: 'ebbeling_sst'
            };
            updateData.assessment_date = resolveAssessmentDate(result.ebbeling_data?.assessment_date);
          } else if (isMoCATest()) {
            updateData.result_value = mocaData.total;
            updateData.additional_data = mocaData.additional_data || {
              moca_data: mocaData,
              measurement_type: 'moca'
            };
            updateData.assessment_date = resolveAssessmentDate(mocaData?.assessment_date);
          } else if (isMMTTest()) {
            updateData.result_value = parseFloat(mmtData.result_value || mmtData.averageGrade || mmtData.additional_data?.average_grade || 0);
            updateData.additional_data = mmtData.additional_data || {
              mmt_data: mmtData,
              measurement_type: 'mmt'
            };
            updateData.assessment_date = resolveAssessmentDate(mmtData?.assessment_date);
          } else if (isWaistHipRatio()) {
            updateData.result_value = whrData.whr_value;
            updateData.additional_data = whrData.additional_data || {
              whr_data: whrData,
              measurement_type: 'whr'
            };
            updateData.assessment_date = resolveAssessmentDate(whrData?.assessment_date);
          } else if ((isBMITest() || isWaistCircumference() || isHeightTest() || isWeightTest()) && bodyMeasurementsData) {
            // BodyMeasurementsRunner emits the standard contract; without this
            // branch Height/Weight fell to the generic else (result_value
            // NaN -> null) and BMI/Waist read manual result fields the runner
            // flow never populates. Runner data wins; the manual-entry
            // branches below remain as the fallback.
            updateData.result_value = parseFloat(bodyMeasurementsData.result_value);
            updateData.additional_data = bodyMeasurementsData.additional_data || {
              body_measurements_data: bodyMeasurementsData,
              measurement_type: 'body_measurements'
            };
            updateData.assessment_date = resolveAssessmentDate(bodyMeasurementsData?.assessment_date);
          } else if (isBMITest()) {
            const heightM = parseFloat(result.height_cm) / 100;
            const weightKg = parseFloat(result.weight_kg);
            const bmi = weightKg / (heightM * heightM);
            let category = 'Unknown';
            if (bmi < 18.5) category = 'Underweight';
            else if (bmi < 25) category = 'Healthy Weight';
            else if (bmi < 30) category = 'Overweight';
            else category = 'Obese';

            updateData.result_value = parseFloat(bmi.toFixed(1));
            updateData.additional_data = {
              height_cm: parseFloat(result.height_cm),
              weight_kg: weightKg,
              bmi_value: parseFloat(bmi.toFixed(1)),
              bmi_category: category,
              measurement_type: 'bmi'
            };
          } else if (isWaistCircumference()) {
            const waistCm = parseFloat(result.waist_cm);
            const sex = client?.gender || 'male';
            let riskCategory = 'Low Risk';

            if (sex === 'male') {
              if (waistCm >= 102) riskCategory = 'Substantially Increased Risk';
              else if (waistCm >= 94) riskCategory = 'Increased Risk';
            } else {
              if (waistCm >= 88) riskCategory = 'Substantially Increased Risk';
              else if (waistCm >= 80) riskCategory = 'Increased Risk';
            }

            updateData.result_value = waistCm;
            updateData.additional_data = {
              waist_cm: waistCm,
              sex,
              risk_category: riskCategory,
              measurement_type: 'waist_circumference'
            };
          } else if (isBergBalance()) {
            updateData.result_value = bergData.total;
            updateData.additional_data = bergData.additional_data || {
              berg_data: bergData,
              measurement_type: 'berg_balance'
            };
            updateData.assessment_date = resolveAssessmentDate(bergData?.assessment_date);
          } else if (isTUG()) {
            updateData.result_value = tugData.result_value || tugData.averageTime || tugData.additional_data?.best_time;
            updateData.additional_data = tugData.additional_data || {
              tug_data: tugData,
              measurement_type: 'tug'
            };
            updateData.assessment_date = resolveAssessmentDate(tugData?.assessment_date);
          } else if (isChairStand()) {
            updateData.result_value = chairStandData.repetitions;
            updateData.additional_data = chairStandData.additional_data || {
              chair_stand_data: chairStandData,
              measurement_type: 'chair_stand'
            };
            updateData.assessment_date = resolveAssessmentDate(chairStandData?.assessment_date);
          } else if (isOneMinuteSitToStand() && chairStandData) {
            // isChairStand() deliberately excludes '1-minute' names, so without
            // this branch the 1MSTS fell into the generic else and stored
            // result_value NaN -> null. Guarded on chairStandData because the
            // detector matches on name alone.
            updateData.result_value = chairStandData.repetitions;
            updateData.additional_data = chairStandData.additional_data || {
              chair_stand_data: chairStandData,
              measurement_type: '1_minute_sit_to_stand'
            };
            updateData.assessment_date = resolveAssessmentDate(chairStandData?.assessment_date);
          } else if (isFunctionalReach()) {
            const _frAD = functionalReachData.additional_data || {};
            updateData.result_value = _frAD.averageReach ?? functionalReachData.averageReach ?? functionalReachData.result_value;
            updateData.additional_data = functionalReachData.additional_data || { functional_reach_data: functionalReachData, measurement_type: 'functional_reach' };
            updateData.assessment_date = resolveAssessmentDate(functionalReachData?.assessment_date);
          } else if (isBackScratch()) {
            updateData.result_value = backScratchData.result_value;
            updateData.additional_data = backScratchData.additional_data || {
              back_scratch_data: backScratchData,
              measurement_type: 'back_scratch'
            };
            updateData.assessment_date = resolveAssessmentDate(backScratchData?.assessment_date);
          } else if (isSitAndReach()) {
            updateData.result_value = sitReachData.best_score;
            updateData.additional_data = sitReachData.additional_data || {
              sit_reach_data: sitReachData,
              measurement_type: 'sit_and_reach'
            };
            updateData.assessment_date = resolveAssessmentDate(sitReachData?.assessment_date);
          } else if (isRomberg()) {
            updateData.result_value = parseFloat(rombergData.eyes_closed_time) || 0;
            updateData.additional_data = rombergData.additional_data || {
              romberg_data: rombergData,
              measurement_type: 'romberg'
            };
            updateData.assessment_date = resolveAssessmentDate(rombergData?.assessment_date);
          } else if (isStorkTest()) {
            updateData.result_value = storkData.best_time;
            updateData.additional_data = storkData.additional_data || {
              stork_data: storkData,
              measurement_type: 'stork'
            };
            updateData.assessment_date = resolveAssessmentDate(storkData?.assessment_date);
          } else if (isCTSIB()) {
            updateData.result_value = ctsibData.result_value ?? ctsibData.conditions_completed;
            updateData.additional_data = ctsibData.additional_data || {
              ctsib_data: ctsibData,
              measurement_type: 'ctsib'
            };
            updateData.assessment_date = resolveAssessmentDate(ctsibData?.assessment_date);
          } else if (isFourSquareStep()) {
            updateData.result_value = fourSquareData.best_time;
            updateData.additional_data = fourSquareData.additional_data || {
              four_square_data: fourSquareData,
              measurement_type: 'four_square_step'
            };
            updateData.assessment_date = resolveAssessmentDate(fourSquareData?.assessment_date);
          } else if (isSkinfold()) {
            updateData.result_value = skinfoldData.total_sum;
            updateData.additional_data = skinfoldData.additional_data || {
              skinfold_data: skinfoldData,
              measurement_type: 'skinfold'
            };
            updateData.assessment_date = resolveAssessmentDate(skinfoldData?.assessment_date);
          } else if (isGirthMeasurement()) {
            updateData.result_value = girthData.sites.length;
            updateData.additional_data = girthData.additional_data || {
              girth_data: girthData,
              measurement_type: 'girth'
            };
            updateData.assessment_date = resolveAssessmentDate(girthData?.assessment_date);
          } else if (isISWT()) {
            updateData.result_value = iswtData.total_distance;
            updateData.additional_data = iswtData.additional_data || {
              iswt_data: iswtData,
              measurement_type: 'iswt'
            };
            updateData.assessment_date = resolveAssessmentDate(iswtData?.assessment_date);
          } else if (isHarvardStep()) {
            updateData.result_value = harvardData.result_value ?? harvardData.fitness_index ?? harvardData.additional_data?.fitness_index;
            updateData.additional_data = harvardData.additional_data || {
              harvard_data: harvardData,
              measurement_type: 'harvard_step'
            };
            updateData.assessment_date = resolveAssessmentDate(harvardData?.assessment_date);
          } else if (isBoxAndBlock()) {
            updateData.result_value = boxBlockData.total_blocks;
            updateData.additional_data = boxBlockData.additional_data || {
              box_block_data: boxBlockData,
              measurement_type: 'box_and_block'
            };
            updateData.assessment_date = resolveAssessmentDate(boxBlockData?.assessment_date);
          } else if (isHiMAT()) {
            updateData.result_value = himatData.total;
            updateData.additional_data = himatData.additional_data || {
              himat_data: himatData,
              measurement_type: 'himat'
            };
            updateData.assessment_date = resolveAssessmentDate(himatData?.assessment_date);
          } else if (isAstrand()) {
            updateData.result_value = astrandData.result_value || astrandData.estimated_vo2max;
            updateData.additional_data = astrandData.additional_data || {
              astrand_data: astrandData,
              measurement_type: 'astrand'
            };
            updateData.assessment_date = resolveAssessmentDate(astrandData?.assessment_date);
          } else if (isJTA()) {
            updateData.result_value = jtaData.tasks ? jtaData.tasks.length : 0;
            updateData.additional_data = jtaData.additional_data || {
              jta_data: jtaData,
              measurement_type: 'jta'
              };
              updateData.assessment_date = resolveAssessmentDate(jtaData?.assessment_date);
              } else if (isBorgRPE()) {
              updateData.result_value = borgRPEData.rpe_value;
              updateData.additional_data = borgRPEData.additional_data || {
              borg_rpe_data: borgRPEData,
              measurement_type: 'borg_rpe'
              };
              updateData.assessment_date = resolveAssessmentDate(borgRPEData?.assessment_date);
              } else if (isGeneralMovementScreen()) {
                updateData.result_value = gmsData.result_value ?? gmsData.total_score ?? gmsData.additional_data?.total_score;
                updateData.additional_data = gmsData.additional_data || {
                  gms_data: gmsData,
                  measurement_type: 'general_movement_screen'
                };
                updateData.assessment_date = resolveAssessmentDate(gmsData?.assessment_date);
              } else if (isGAD7()) {
                updateData.result_value = gad7Data.result_value ?? gad7Data.total_score ?? gad7Data?.additional_data?.total_score;
                updateData.additional_data = gad7Data.additional_data || { gad7_data: gad7Data, measurement_type: 'gad7' };
                updateData.assessment_date = resolveAssessmentDate(gad7Data?.assessment_date);
              } else if (isPHQ9()) {
                updateData.result_value = phq9Data.result_value ?? phq9Data.total_score ?? phq9Data?.additional_data?.total_score;
                updateData.additional_data = phq9Data.additional_data || { phq9_data: phq9Data, measurement_type: 'phq9' };
                updateData.assessment_date = resolveAssessmentDate(phq9Data?.assessment_date);
              } else if (isArmCurl()) {
                updateData.result_value = armCurlData.primary_side_reps;
                updateData.additional_data = armCurlData.additional_data || {
                  arm_curl_data: armCurlData,
                  measurement_type: 'arm_curl'
                };
                updateData.assessment_date = resolveAssessmentDate(armCurlData?.assessment_date);
              } else if (isK10()) {
                updateData.result_value = k10Data.result_value ?? k10Data.total_score ?? k10Data?.additional_data?.total_score;
                updateData.additional_data = k10Data.additional_data || { k10_data: k10Data, measurement_type: 'k10' };
                updateData.assessment_date = resolveAssessmentDate(k10Data?.assessment_date);
              } else if (isHOOS()) {
                updateData.result_value = hoosData.average_score;
                updateData.additional_data = hoosData.additional_data || {
                  hoos_data: hoosData,
                  measurement_type: 'hoos'
                };
                updateData.assessment_date = resolveAssessmentDate(hoosData?.assessment_date);
              } else if (isKOOS()) {
                updateData.result_value = koosData.average_score;
                updateData.additional_data = koosData.additional_data || {
                  koos_data: koosData,
                  measurement_type: 'koos'
                };
                updateData.assessment_date = resolveAssessmentDate(koosData?.assessment_date);
              } else if (isPediatricBalance()) {
                updateData.result_value = result.additional_data.pbs_data.result_value;
                updateData.additional_data = result.additional_data.pbs_data.additional_data || {
                  pbs_data: result.additional_data.pbs_data,
                  measurement_type: 'pediatric_balance'
                };
                updateData.assessment_date = resolveAssessmentDate(result.additional_data.pbs_data?.assessment_date);
              } else if (isRepeatedJump()) {
                updateData.result_value = repeatedJumpData.result_value;
                updateData.additional_data = repeatedJumpData.additional_data;
                updateData.assessment_date = resolveAssessmentDate(repeatedJumpData?.assessment_date);
              } else if (isCKCUEST()) {
                updateData.result_value = ckcuestData.best_touches;
                updateData.additional_data = ckcuestData.additional_data || {
                  ckcuest_data: ckcuestData,
                  measurement_type: 'ckcuest'
                };
                updateData.assessment_date = resolveAssessmentDate(ckcuestData?.assessment_date);
              } else if (isOneRM()) {
                updateData.result_value = oneRMData.result_value;
                updateData.additional_data = oneRMData.additional_data || {
                  one_rm_data: oneRMData,
                  measurement_type: 'one_rm'
                };
                updateData.assessment_date = resolveAssessmentDate(oneRMData?.assessment_date);
              } else if (isIsometricStrength()) {
                updateData.result_value = isometricData.result_value || isometricData.average_force_kg || isometricData.additional_data?.tests?.[0]?.best;
                updateData.additional_data = isometricData.additional_data || {
                  isometric_data: isometricData,
                  measurement_type: 'isometric_strength'
                };
                updateData.assessment_date = resolveAssessmentDate(isometricData?.assessment_date);
              } else if (isIsokinetics()) {
                updateData.result_value = isokineticsData.result_value;
                updateData.additional_data = isokineticsData.additional_data || {
                  isokinetics_data: isokineticsData,
                  measurement_type: 'isokinetics'
                };
                updateData.assessment_date = resolveAssessmentDate(isokineticsData?.assessment_date);
              } else if (isElyTest() || isThomasTest() || isOberTest()) {
                updateData.result_value = specialTestData.result_value;
                updateData.additional_data = specialTestData.additional_data || {
                  special_test_data: specialTestData,
                  measurement_type: 'special_test'
                };
                updateData.assessment_date = resolveAssessmentDate(specialTestData?.assessment_date);
              } else if (isSLR()) {
                updateData.result_value = slrData.result_value;
                updateData.additional_data = slrData.additional_data || {
                  slr_data: slrData,
                  measurement_type: 'slr'
                };
                updateData.assessment_date = resolveAssessmentDate(slrData?.assessment_date);
              } else if (isSlump()) {
                updateData.result_value = slumpData.result_value;
                updateData.additional_data = slumpData.additional_data || {
                  slump_data: slumpData,
                  measurement_type: 'slump'
                };
                updateData.assessment_date = resolveAssessmentDate(slumpData?.assessment_date);
              } else if (isLachman() || isAnteriorDrawer() || isPivotShift() || isMcMurray()) {
                updateData.result_value = kneeStabilityData.result_value;
                updateData.additional_data = kneeStabilityData.additional_data || {
                  knee_stability_data: kneeStabilityData,
                  measurement_type: 'knee_stability'
                };
                updateData.assessment_date = resolveAssessmentDate(kneeStabilityData?.assessment_date);
              } else if (isThessaly()) {
                updateData.result_value = thessalyData.result_value;
                updateData.additional_data = thessalyData.additional_data || {
                  thessaly_data: thessalyData,
                  measurement_type: 'thessaly'
                };
                updateData.assessment_date = resolveAssessmentDate(thessalyData?.assessment_date);
              } else if (isApleys()) {
                updateData.result_value = apleysData.result_value;
                updateData.additional_data = apleysData.additional_data || {
                  apleys_data: apleysData,
                  measurement_type: 'apleys'
                };
                updateData.assessment_date = resolveAssessmentDate(apleysData?.assessment_date);
              } else if (isNoble()) {
                updateData.result_value = nobleData.result_value;
                updateData.additional_data = nobleData.additional_data || {
                  noble_data: nobleData,
                  measurement_type: 'noble'
                };
                updateData.assessment_date = resolveAssessmentDate(nobleData?.assessment_date);
              } else if (isNaughton()) { updateData.result_value = naughtonData.result_value; updateData.additional_data = naughtonData.additional_data || { naughton_data: naughtonData, measurement_type: 'treadmill_protocol' };
              updateData.assessment_date = resolveAssessmentDate(naughtonData?.assessment_date);
              } else if (isBruceProtocol() || isModifiedBruce()) { updateData.result_value = bruceData.result_value;
                updateData.additional_data = bruceData.additional_data || {
                  bruce_data: bruceData,
                  measurement_type: 'treadmill_protocol'
                };
                updateData.assessment_date = resolveAssessmentDate(bruceData?.assessment_date);
              } else if (isYMCACycle() || isAstrandCycle() || isWingate()) {
                updateData.result_value = cycleData.result_value;
                updateData.additional_data = cycleData.additional_data || {
                  cycle_data: cycleData,
                  measurement_type: 'cycle_protocol'
                };
                updateData.assessment_date = resolveAssessmentDate(cycleData?.assessment_date);
              } else if (isTwoMinuteWalk()) {
                updateData.result_value = twoMinWalkData.result_value;
                updateData.additional_data = twoMinWalkData.additional_data || {
                  two_min_walk_data: twoMinWalkData,
                  measurement_type: 'two_minute_walk'
                };
                updateData.assessment_date = resolveAssessmentDate(twoMinWalkData?.assessment_date);
              } else if (isCooperTest()) {
                updateData.result_value = cooperData.result_value;
                updateData.additional_data = cooperData.additional_data || {
                  cooper_data: cooperData,
                  measurement_type: 'cooper_test'
                };
                updateData.assessment_date = resolveAssessmentDate(cooperData?.assessment_date);
                if (cooperData.notes && !result.notes.includes(cooperData.notes)) {
                  updateData.notes = cooperData.notes + (result.notes ? '\n\n' + result.notes : '');
                }
              } else if (isBeepTest()) {
                updateData.result_value = beepData.result_value || beepData.final_level;
                updateData.additional_data = beepData.additional_data || {
                  ...beepData,
                  measurement_type: 'beep_test'
                };
                updateData.assessment_date = resolveAssessmentDate(beepData?.assessment_date);
                // Merge test notes if present
                if (beepData.notes_deviation && !result.notes.includes(beepData.notes_deviation)) {
                  updateData.notes = (beepData.notes_deviation || '') + (result.notes ? '\n\n' + result.notes : '');
                }
              } else if (isYoYoTest()) {
                updateData.result_value = yoyoData.result_value;
                updateData.additional_data = yoyoData.additional_data || {
                  yoyo_data: yoyoData,
                  measurement_type: 'yoyo_test'
                };
                updateData.assessment_date = resolveAssessmentDate(yoyoData?.assessment_date);
              } else if (isThirtyFifteenIFT()) {
               updateData.result_value = thirtyFifteenData.result_value || thirtyFifteenData.vift_kmh;
               updateData.notes = thirtyFifteenData.notes || updateData.notes;
               updateData.additional_data = { ...(thirtyFifteenData.additional_data || {}), measurement_type: 'thirty_fifteen_ift', vift_kmh: thirtyFifteenData.vift_kmh || thirtyFifteenData.result_value, total_stages: thirtyFifteenData.total_stages, rpe: thirtyFifteenData.rpe };
               updateData.assessment_date = resolveAssessmentDate(thirtyFifteenData?.assessment_date);
              } else if (isRSATest()) {
                updateData.result_value = rsaData.result_value;
                updateData.additional_data = rsaData.additional_data || {
                  rsa_data: rsaData,
                  measurement_type: 'rsa_test'
                };
                updateData.assessment_date = resolveAssessmentDate(rsaData?.assessment_date);
              } else if (isHRRTest()) {
                updateData.result_value = hrrData.result_value;
                updateData.additional_data = hrrData.additional_data || {
                  hrr_data: hrrData,
                  measurement_type: 'hrr_test'
                };
                updateData.assessment_date = resolveAssessmentDate(hrrData?.assessment_date);
              } else if (isVO2maxGXT()) {
                updateData.result_value = vo2maxGXTData.result_value;
                updateData.additional_data = vo2maxGXTData.additional_data || {
                  vo2max_gxt_data: vo2maxGXTData,
                  measurement_type: 'vo2max_gxt'
                };
                updateData.assessment_date = resolveAssessmentDate(vo2maxGXTData?.assessment_date);
              } else if (isHbA1c()) {
                updateData.result_value = hba1cData.result_value;
                updateData.additional_data = hba1cData.additional_data || {
                  hba1c_data: hba1cData,
                  measurement_type: 'hba1c'
                };
                updateData.assessment_date = resolveAssessmentDate(hba1cData?.assessment_date);
              } else if (isLipidProfile()) {
                updateData.result_value = lipidProfileData.result_value;
                updateData.additional_data = lipidProfileData.additional_data || {
                  lipid_profile_data: lipidProfileData,
                  measurement_type: 'lipid_profile'
                };
                updateData.assessment_date = resolveAssessmentDate(lipidProfileData?.assessment_date);
              } else if (isMETCalculation()) {
                updateData.result_value = metCalcData.result_value;
                updateData.additional_data = metCalcData.additional_data || {
                  met_calc_data: metCalcData,
                  measurement_type: 'met_calculation'
                };
                updateData.assessment_date = resolveAssessmentDate(metCalcData?.assessment_date);
              } else if (isSixMinuteStep()) {
                updateData.result_value = sixMinStepData.result_value;
                updateData.additional_data = sixMinStepData.additional_data || {
                  six_min_step_data: sixMinStepData,
                  measurement_type: 'six_minute_step'
                };
                updateData.assessment_date = resolveAssessmentDate(sixMinStepData?.assessment_date);
              } else if (isPPT()) {
                updateData.result_value = pptData.result_value;
                updateData.additional_data = pptData.additional_data || {
                  ppt_data: pptData,
                  measurement_type: 'ppt'
                };
                updateData.assessment_date = resolveAssessmentDate(pptData?.assessment_date);
              } else if (isCBM()) {
                updateData.result_value = cbmData.result_value;
                updateData.additional_data = cbmData.additional_data || {
                  cbm_data: cbmData,
                  measurement_type: 'cbm'
                };
                updateData.assessment_date = resolveAssessmentDate(cbmData?.assessment_date);
              } else if (isBESTest()) {
                updateData.result_value = bestestData.result_value;
                updateData.additional_data = bestestData.additional_data || {
                  bestest_data: bestestData,
                  measurement_type: 'bestest'
                };
                updateData.assessment_date = resolveAssessmentDate(bestestData?.assessment_date);
              } else if (isEMS()) {
                updateData.result_value = emsData.result_value;
                updateData.additional_data = emsData.additional_data || {
                  ems_data: emsData,
                  measurement_type: 'ems'
                };
                updateData.assessment_date = resolveAssessmentDate(emsData?.assessment_date);
              } else if (isYMCA3MinStep()) {
                updateData.result_value = ymca3MinStepData.result_value;
                updateData.additional_data = ymca3MinStepData.additional_data || {
                  ymca_3min_step_data: ymca3MinStepData,
                  measurement_type: 'ymca_3min_step'
                };
                updateData.assessment_date = resolveAssessmentDate(ymca3MinStepData?.assessment_date);
              } else if (isDGI()) {
                updateData.result_value = dgiData.result_value;
                updateData.additional_data = dgiData.additional_data || {
                  dgi_data: dgiData,
                  measurement_type: 'dgi'
                };
                updateData.assessment_date = resolveAssessmentDate(dgiData?.assessment_date);
              } else if (isRockportWalk()) {
                updateData.result_value = rockportData.result_value;
                updateData.additional_data = rockportData.additional_data || {
                  rockport_data: rockportData,
                  measurement_type: 'rockport_walk'
                };
                updateData.assessment_date = resolveAssessmentDate(rockportData?.assessment_date);
              } else if ((isHabitualGaitSpeed() || isFastGaitSpeed() || is4MeterGaitSpeed()) && gaitSpeedData) {
        updateData.result_value = gaitSpeedData.result_value;
        updateData.notes = gaitSpeedData.notes || updateData.notes;
        updateData.additional_data = gaitSpeedData.additional_data || { measurement_type: 'habitual_gait', average_speed_ms: gaitSpeedData.result_value };
        updateData.assessment_date = resolveAssessmentDate(gaitSpeedData?.assessment_date);
      } else if ((isHabitualGaitSpeed() || isFastGaitSpeed() || is4MeterGaitSpeed()) && !gaitSpeedData) {
        const distance = parseFloat(result.gait_distance) || 4;
        const times = [parseFloat(result.gait_time_trial1)||0,parseFloat(result.gait_time_trial2)||0,parseFloat(result.gait_time_trial3)||0].filter(t=>t>0);
        const avgTime = times.length>0?times.reduce((a,b)=>a+b)/times.length:0;
        const speed = avgTime>0?(distance/avgTime).toFixed(2):0;
        updateData.result_value = parseFloat(speed);
        updateData.additional_data = { gait_distance:distance, average_time:avgTime.toFixed(2), speed_mps:parseFloat(speed), measurement_type:'habitual_gait' };
      } else if (isVitalSignsAssessment(assessment.name)) {
        // For vital signs, store the primary result and additional data
        if (isBloodPressureAssessment(assessment.name)) {
          updateData.result_value = parseFloat(result.pre_exercise_systolic);
          updateData.additional_data = {
            pre_exercise_systolic: parseFloat(result.pre_exercise_systolic),
            pre_exercise_diastolic: parseFloat(result.pre_exercise_diastolic),
            post_exercise_systolic: result.post_exercise_systolic ? parseFloat(result.post_exercise_systolic) : null,
            post_exercise_diastolic: result.post_exercise_diastolic ? parseFloat(result.post_exercise_diastolic) : null,
            measurement_type: 'blood_pressure'
          };
        } else if (isHeartRateAssessment(assessment.name)) {
          updateData.result_value = parseFloat(result.pre_exercise_hr);
          updateData.additional_data = {
            pre_exercise_hr: parseFloat(result.pre_exercise_hr),
            post_exercise_hr: result.post_exercise_hr ? parseFloat(result.post_exercise_hr) : null,
            recovery_hr_1min: result.recovery_hr_1min ? parseFloat(result.recovery_hr_1min) : null,
            recovery_hr_3min: result.recovery_hr_3min ? parseFloat(result.recovery_hr_3min) : null,
            recovery_hr_5min: result.recovery_hr_5min ? parseFloat(result.recovery_hr_5min) : null,
            measurement_type: 'heart_rate'
          };
        } else if (isSpO2Assessment(assessment.name)) {
          updateData.result_value = parseFloat(result.pre_exercise_spo2);
          updateData.additional_data = {
            pre_exercise_spo2: parseFloat(result.pre_exercise_spo2),
            post_exercise_spo2: result.post_exercise_spo2 ? parseFloat(result.post_exercise_spo2) : null,
            recovery_spo2: result.recovery_spo2 ? parseFloat(result.recovery_spo2) : null,
            measurement_type: 'spo2'
          };
        }
      } else {
        // Standard single-value assessments
        updateData.result_value = parseFloat(result.result_value);

        // Add scales data for 5xSTS
        if (isFiveTimesSitToStand() && (result.rpe_scale || result.breathlessness_scale || result.pain_scale)) {
          updateData.additional_data = {
            rpe_scale: result.rpe_scale ? parseFloat(result.rpe_scale) : null,
            breathlessness_scale: result.breathlessness_scale ? parseFloat(result.breathlessness_scale) : null,
            pain_scale: result.pain_scale ? parseFloat(result.pain_scale) : null
          };
        }
      }

      // Generate objective text for SOAP note
      let objectiveText = generateObjectiveFromAssessment(assessment, updateData);
      if (clinicianNotes && clinicianNotes.trim()) { objectiveText += `\n\nClinician Notes (recorded during assessment):\n${clinicianNotes.trim()}`; }
      await base44.entities.ClientAssessment.update(assessmentToUpdate.id, updateData);
      const clientToUse = selectedClient || client;
      const finalAppointmentId = appointmentId || assessmentToUpdate?.appointment_id;
      try {
        await saveAssessmentToSOAP({
          clientToUse,
          appointmentId: finalAppointmentId,
          objectiveText,
          assessmentToUpdateId: assessmentToUpdate.id,
          updateData
        });
      } catch (soapError) {
        console.error("Error saving to SOAP note:", soapError);
        toast.warning("Assessment saved, but failed to update SOAP note.");
      }

        toast.success("Assessment completed successfully!");
      if (onComplete) onComplete(updateData);
      setShowReminders(true); // Show reminders after completing assessment
      // onClose(); // Removed, as closure is handled by handleCloseReminders
    } catch (error) {
      console.error("Failed to save:", error?.message, error);
      toast.error(`Save failed: ${(error?.message||String(error)).slice(0,100)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseReminders = () => {
    setShowReminders(false);
    onClose(); // Close test runner after reminders
  };

  const renderHandGripFields = () => (
    <div className="space-y-6">
      <div>
        <Label htmlFor="dominant_hand">Dominant Hand</Label>
        <Select value={result.dominant_hand} onValueChange={(value) => setResult({...result, dominant_hand: value})}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select dominant hand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="right">Right</SelectItem>
            <SelectItem value="left">Left</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-semibold text-slate-900">
            Dominant Hand ({result.dominant_hand === 'right' ? 'Right' : 'Left'})
          </h4>
          <div>
            <Label htmlFor="dominant_trial_1">Trial 1 (kg)</Label>
            <Input
              id="dominant_trial_1"
              type="number"
              step="0.1"
              value={result.dominant_trial_1}
              onChange={(e) => setResult({...result, dominant_trial_1: e.target.value})}
              className="mt-1"
              placeholder="Enter grip strength"
            />
          </div>
          <div>
            <Label htmlFor="dominant_trial_2">Trial 2 (kg)</Label>
            <Input
              id="dominant_trial_2"
              type="number"
              step="0.1"
              value={result.dominant_trial_2}
              onChange={(e) => setResult({...result, dominant_trial_2: e.target.value})}
              className="mt-1"
              placeholder="Enter grip strength"
            />
          </div>
          <div>
            <Label htmlFor="dominant_trial_3">Trial 3 (kg)</Label>
            <Input
              id="dominant_trial_3"
              type="number"
              step="0.1"
              value={result.dominant_trial_3}
              onChange={(e) => setResult({...result, dominant_trial_3: e.target.value})}
              className="mt-1"
              placeholder="Enter grip strength"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-slate-900">
            Non-Dominant Hand ({result.dominant_hand === 'right' ? 'Left' : 'Right'})
          </h4>
          <div>
            <Label htmlFor="non_dominant_trial_1">Trial 1 (kg)</Label>
            <Input
              id="non_dominant_trial_1"
              type="number"
              step="0.1"
              value={result.non_dominant_trial_1}
              onChange={(e) => setResult({...result, non_dominant_trial_1: e.target.value})}
              className="mt-1"
              placeholder="Enter grip strength"
            />
          </div>
          <div>
            <Label htmlFor="non_dominant_trial_2">Trial 2 (kg)</Label>
            <Input
              id="non_dominant_trial_2"
              type="number"
              step="0.1"
              value={result.non_dominant_trial_2}
              onChange={(e) => setResult({...result, non_dominant_trial_2: e.target.value})}
              className="mt-1"
              placeholder="Enter grip strength"
            />
          </div>
          <div>
            <Label htmlFor="non_dominant_trial_3">Trial 3 (kg)</Label>
            <Input
              id="non_dominant_trial_3"
              type="number"
              step="0.1"
              value={result.non_dominant_trial_3}
              onChange={(e) => setResult({...result, non_dominant_trial_3: e.target.value})}
              className="mt-1"
              placeholder="Enter grip strength"
            />
          </div>
        </div>
      </div>

      {(result.dominant_trial_1 || result.non_dominant_trial_1) && (
        <div className="bg-slate-50 p-4 rounded-lg">
          <h4 className="font-semibold text-slate-900 mb-2">Best Scores</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-600">Dominant Hand: </span>
              <span className="font-medium">{calculateBestGripScore().bestDominant.toFixed(1)} kg</span>
            </div>
            <div>
              <span className="text-slate-600">Non-Dominant Hand: </span>
              <span className="font-medium">{calculateBestGripScore().bestNonDominant.toFixed(1)} kg</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderVitalSignsFields = () => {
    if (isBloodPressureAssessment(assessment.name)) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pre_exercise_systolic">Pre-Exercise Systolic (mmHg)</Label>
              <Input
                id="pre_exercise_systolic"
                type="number"
                value={result.pre_exercise_systolic}
                onChange={(e) => setResult({...result, pre_exercise_systolic: e.target.value})}
                className="mt-1"
                placeholder="e.g., 120"
              />
            </div>
            <div>
              <Label htmlFor="pre_exercise_diastolic">Pre-Exercise Diastolic (mmHg)</Label>
              <Input
                id="pre_exercise_diastolic"
                type="number"
                value={result.pre_exercise_diastolic}
                onChange={(e) => setResult({...result, pre_exercise_diastolic: e.target.value})}
                className="mt-1"
                placeholder="e.g., 80"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="post_exercise_systolic">Post-Exercise Systolic (mmHg)</Label>
              <Input
                id="post_exercise_systolic"
                type="number"
                value={result.post_exercise_systolic}
                onChange={(e) => setResult({...result, post_exercise_systolic: e.target.value})}
                className="mt-1"
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="post_exercise_diastolic">Post-Exercise Diastolic (mmHg)</Label>
              <Input
                id="post_exercise_diastolic"
                type="number"
                value={result.post_exercise_diastolic}
                onChange={(e) => setResult({...result, post_exercise_diastolic: e.target.value})}
                className="mt-1"
                placeholder="Optional"
              />
            </div>
          </div>
        </div>
      );
    } else if (isHeartRateAssessment(assessment.name)) {
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="pre_exercise_hr">Pre-Exercise Heart Rate (bpm)</Label>
            <Input
              id="pre_exercise_hr"
              type="number"
              value={result.pre_exercise_hr}
              onChange={(e) => setResult({...result, pre_exercise_hr: e.target.value})}
              className="mt-1"
              placeholder="e.g., 72"
            />
          </div>
          <div>
            <Label htmlFor="post_exercise_hr">Post-Exercise Heart Rate (bpm)</Label>
            <Input
              id="post_exercise_hr"
              type="number"
              value={result.post_exercise_hr}
              onChange={(e) => setResult({...result, post_exercise_hr: e.target.value})}
              className="mt-1"
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="recovery_hr_1min">1-Min Recovery (bpm)</Label>
              <Input
                id="recovery_hr_1min"
                type="number"
                value={result.recovery_hr_1min}
                onChange={(e) => setResult({...result, recovery_hr_1min: e.target.value})}
                className="mt-1"
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="recovery_hr_3min">3-Min Recovery (bpm)</Label>
              <Input
                id="recovery_hr_3min"
                type="number"
                value={result.recovery_hr_3min}
                onChange={(e) => setResult({...result, recovery_hr_3min: e.target.value})}
                className="mt-1"
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="recovery_hr_5min">5-Min Recovery (bpm)</Label>
              <Input
                id="recovery_hr_5min"
                type="number"
                value={result.recovery_hr_5min}
                onChange={(e) => setResult({...result, recovery_hr_5min: e.target.value})}
                className="mt-1"
                placeholder="Optional"
              />
            </div>
          </div>
        </div>
      );
    } else if (isSpO2Assessment(assessment.name)) {
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="pre_exercise_spo2">Pre-Exercise SpO2 (%)</Label>
            <Input
              id="pre_exercise_spo2"
              type="number"
              value={result.pre_exercise_spo2}
              onChange={(e) => setResult({...result, pre_exercise_spo2: e.target.value})}
              className="mt-1"
              placeholder="e.g., 98"
            />
          </div>
          <div>
            <Label htmlFor="post_exercise_spo2">Post-Exercise SpO2 (%)</Label>
            <Input
              id="post_exercise_spo2"
              type="number"
              value={result.post_exercise_spo2}
              onChange={(e) => setResult({...result, post_exercise_spo2: e.target.value})}
              className="mt-1"
              placeholder="Optional"
            />
          </div>
          <div>
            <Label htmlFor="recovery_spo2">Recovery SpO2 (%)</Label>
            <Input
              id="recovery_spo2"
              type="number"
              value={result.recovery_spo2}
              onChange={(e) => setResult({...result, recovery_spo2: e.target.value})}
              className="mt-1"
              placeholder="Optional"
            />
          </div>
        </div>
      );
    }
  };



  const render2MinStepFields = () => (
    <div className="space-y-6">
      {/* Timer Section */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-3">2-Minute Timer</h3>
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold text-blue-600 font-mono">
            {timerSeconds.toFixed(1)}s
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => setTimerRunning(!timerRunning)}
              variant={timerRunning ? "destructive" : "default"}
              size="sm"
            >
              {timerRunning ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
              {timerRunning ? 'Stop' : 'Start'}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setTimerRunning(false);
                setTimerSeconds(0);
              }}
              variant="outline"
              size="sm"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>
        {timerSeconds >= 120 && (
          <p className="mt-2 text-green-600 font-semibold">✓ 2 minutes complete! Stop counting.</p>
        )}
      </div>

      <div>
        <Label htmlFor="result_value" className="text-lg font-semibold">Total Right Knee Steps (to target height)</Label>
        <Input
          id="result_value"
          type="number"
          step="1"
          value={result.result_value}
          onChange={(e) => setResult({...result, result_value: e.target.value})}
          className="mt-1 text-2xl font-bold"
          placeholder="e.g., 95"
        />
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-900 mb-3">Post-Test Scales</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="two_min_step_rpe">RPE (6-20)</Label>
            <Input
              id="two_min_step_rpe"
              type="number"
              min="6"
              max="20"
              value={result.two_min_step_rpe}
              onChange={(e) => setResult({...result, two_min_step_rpe: e.target.value})}
              className="mt-1"
              placeholder="Rate of Perceived Exertion"
            />
          </div>
          <div>
            <Label htmlFor="two_min_step_breathlessness">Breathlessness (0-10)</Label>
            <Input
              id="two_min_step_breathlessness"
              type="number"
              min="0"
              max="10"
              value={result.two_min_step_breathlessness}
              onChange={(e) => setResult({...result, two_min_step_breathlessness: e.target.value})}
              className="mt-1"
              placeholder="Dyspnea scale"
            />
          </div>
          <div>
            <Label htmlFor="two_min_step_pain">Pain (0-10)</Label>
            <Input
              id="two_min_step_pain"
              type="number"
              min="0"
              max="10"
              value={result.two_min_step_pain}
              onChange={(e) => setResult({...result, two_min_step_pain: e.target.value})}
              className="mt-1"
              placeholder="Pain level"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderSingleLegStanceFields = () => (
    <div className="space-y-6">
      {/* Timer Section */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-3">Balance Timer (max 60 seconds)</h3>
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold text-blue-600 font-mono">
            {timerSeconds.toFixed(1)}s
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => setTimerRunning(!timerRunning)}
              variant={timerRunning ? "destructive" : "default"}
              size="sm"
            >
              {timerRunning ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
              {timerRunning ? 'Stop' : 'Start'}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setTimerRunning(false);
                setTimerSeconds(0);
              }}
              variant="outline"
              size="sm"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>
        {timerSeconds >= 60 && (
          <p className="mt-2 text-green-600 font-semibold">✓ 60 seconds reached! Maximum time achieved.</p>
        )}
      </div>

      {/* Dominant Leg Selection */}
      <div>
        <Label>Which is the dominant leg?</Label>
        <Select 
          value={result.sls_dominant_leg || ''} 
          onValueChange={(value) => setResult({...result, sls_dominant_leg: value})}
        >
          <SelectTrigger className="mt-1 w-48">
            <SelectValue placeholder="Select dominant leg" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Leg - Eyes Open */}
        <div className="space-y-4 bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold text-slate-900 text-lg">Left Leg - Eyes Open</h4>
          <div>
            <Label htmlFor="sls_left_eyes_open">Time held (seconds)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="sls_left_eyes_open"
                type="number"
                step="0.1"
                max="60"
                value={result.sls_left_eyes_open}
                onChange={(e) => setResult({...result, sls_left_eyes_open: e.target.value})}
                placeholder="Up to 60 seconds"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTimerRunning(false);
                  setResult({...result, sls_left_eyes_open: Math.min(timerSeconds, 60).toFixed(1)});
                }}
                disabled={timerSeconds === 0}
              >
                Use Time
              </Button>
            </div>
          </div>
        </div>

        {/* Right Leg - Eyes Open */}
        <div className="space-y-4 bg-green-50 p-4 rounded-lg">
          <h4 className="font-semibold text-slate-900 text-lg">Right Leg - Eyes Open</h4>
          <div>
            <Label htmlFor="sls_right_eyes_open">Time held (seconds)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="sls_right_eyes_open"
                type="number"
                step="0.1"
                max="60"
                value={result.sls_right_eyes_open}
                onChange={(e) => setResult({...result, sls_right_eyes_open: e.target.value})}
                placeholder="Up to 60 seconds"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTimerRunning(false);
                  setResult({...result, sls_right_eyes_open: Math.min(timerSeconds, 60).toFixed(1)});
                }}
                disabled={timerSeconds === 0}
              >
                Use Time
              </Button>
            </div>
          </div>
        </div>

        {/* Left Leg - Eyes Closed */}
        <div className="space-y-4 bg-purple-50 p-4 rounded-lg">
          <h4 className="font-semibold text-slate-900 text-lg">Left Leg - Eyes Closed</h4>
          <div>
            <Label htmlFor="sls_left_eyes_closed">Time held (seconds)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="sls_left_eyes_closed"
                type="number"
                step="0.1"
                max="60"
                value={result.sls_left_eyes_closed}
                onChange={(e) => setResult({...result, sls_left_eyes_closed: e.target.value})}
                placeholder="Up to 60 seconds"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTimerRunning(false);
                  setResult({...result, sls_left_eyes_closed: Math.min(timerSeconds, 60).toFixed(1)});
                }}
                disabled={timerSeconds === 0}
              >
                Use Time
              </Button>
            </div>
          </div>
        </div>

        {/* Right Leg - Eyes Closed */}
        <div className="space-y-4 bg-amber-50 p-4 rounded-lg">
          <h4 className="font-semibold text-slate-900 text-lg">Right Leg - Eyes Closed</h4>
          <div>
            <Label htmlFor="sls_right_eyes_closed">Time held (seconds)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="sls_right_eyes_closed"
                type="number"
                step="0.1"
                max="60"
                value={result.sls_right_eyes_closed}
                onChange={(e) => setResult({...result, sls_right_eyes_closed: e.target.value})}
                placeholder="Up to 60 seconds"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTimerRunning(false);
                  setResult({...result, sls_right_eyes_closed: Math.min(timerSeconds, 60).toFixed(1)});
                }}
                disabled={timerSeconds === 0}
              >
                Use Time
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Support/Supervision */}
      <div>
        <Label>Did the client require support or supervision?</Label>
        <Select 
          value={result.sls_required_support || ''} 
          onValueChange={(value) => setResult({...result, sls_required_support: value})}
        >
          <SelectTrigger className="mt-1 w-48">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reason for Stopping */}
      <div>
        <Label>Reason for stopping (if before 60 seconds)</Label>
        <Select 
          value={result.sls_stop_reason || ''} 
          onValueChange={(value) => setResult({...result, sls_stop_reason: value})}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select reason (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="completed">Completed 60 seconds</SelectItem>
            <SelectItem value="hands_moved">Hands moved from position</SelectItem>
            <SelectItem value="foot_shifted">Supporting foot shifted</SelectItem>
            <SelectItem value="foot_touched">Lifted foot touched ground/leg</SelectItem>
            <SelectItem value="loss_balance">Loss of balance</SelectItem>
            <SelectItem value="client_stopped">Client chose to stop</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Summary */}
      {(result.sls_left_eyes_open || result.sls_right_eyes_open || result.sls_left_eyes_closed || result.sls_right_eyes_closed) && (
        <div className="bg-slate-100 p-4 rounded-lg">
          <h4 className="font-semibold text-slate-900 mb-3">Results Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <p className="text-slate-600">Left (Open)</p>
              <p className="font-bold text-lg text-blue-600">{result.sls_left_eyes_open || '-'}s</p>
            </div>
            <div className="text-center">
              <p className="text-slate-600">Right (Open)</p>
              <p className="font-bold text-lg text-green-600">{result.sls_right_eyes_open || '-'}s</p>
            </div>
            <div className="text-center">
              <p className="text-slate-600">Left (Closed)</p>
              <p className="font-bold text-lg text-purple-600">{result.sls_left_eyes_closed || '-'}s</p>
            </div>
            <div className="text-center">
              <p className="text-slate-600">Right (Closed)</p>
              <p className="font-bold text-lg text-amber-600">{result.sls_right_eyes_closed || '-'}s</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderYBalanceFields = () => {
    const limbLengthLeft = parseFloat(result.ybt_limb_length_left) || 0;
    const limbLengthRight = parseFloat(result.ybt_limb_length_right) || 0;
    
    const leftAnt = parseFloat(result.ybt_left_anterior) || 0;
    const leftPM = parseFloat(result.ybt_left_posteromedial) || 0;
    const leftPL = parseFloat(result.ybt_left_posterolateral) || 0;
    const rightAnt = parseFloat(result.ybt_right_anterior) || 0;
    const rightPM = parseFloat(result.ybt_right_posteromedial) || 0;
    const rightPL = parseFloat(result.ybt_right_posterolateral) || 0;
    
    const leftComposite = limbLengthLeft > 0 ? ((leftAnt + leftPM + leftPL) / (3 * limbLengthLeft)) * 100 : 0;
    const rightComposite = limbLengthRight > 0 ? ((rightAnt + rightPM + rightPL) / (3 * limbLengthRight)) * 100 : 0;
    const anteriorAsymmetry = Math.abs(leftAnt - rightAnt);

    return (
      <div className="space-y-6">
        {/* Limb Length Measurements */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 mb-3">Limb Length (ASIS to Medial Malleolus)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ybt_limb_length_left">Left Limb Length (cm)</Label>
              <Input
                id="ybt_limb_length_left"
                type="number"
                step="0.1"
                value={result.ybt_limb_length_left}
                onChange={(e) => setResult({...result, ybt_limb_length_left: e.target.value})}
                className="mt-1"
                placeholder="e.g., 85"
              />
            </div>
            <div>
              <Label htmlFor="ybt_limb_length_right">Right Limb Length (cm)</Label>
              <Input
                id="ybt_limb_length_right"
                type="number"
                step="0.1"
                value={result.ybt_limb_length_right}
                onChange={(e) => setResult({...result, ybt_limb_length_right: e.target.value})}
                className="mt-1"
                placeholder="e.g., 85"
              />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Leg Stance */}
          <div className="bg-blue-50 p-4 rounded-lg space-y-4">
            <h4 className="font-semibold text-blue-900 text-lg">Standing on LEFT Leg (Right Reaching)</h4>
            <div>
              <Label htmlFor="ybt_left_anterior">Anterior Reach (cm)</Label>
              <Input
                id="ybt_left_anterior"
                type="number"
                step="0.1"
                value={result.ybt_left_anterior}
                onChange={(e) => setResult({...result, ybt_left_anterior: e.target.value})}
                className="mt-1"
                placeholder="Best of 3 trials"
              />
            </div>
            <div>
              <Label htmlFor="ybt_left_posteromedial">Posteromedial Reach (cm)</Label>
              <Input
                id="ybt_left_posteromedial"
                type="number"
                step="0.1"
                value={result.ybt_left_posteromedial}
                onChange={(e) => setResult({...result, ybt_left_posteromedial: e.target.value})}
                className="mt-1"
                placeholder="Best of 3 trials"
              />
            </div>
            <div>
              <Label htmlFor="ybt_left_posterolateral">Posterolateral Reach (cm)</Label>
              <Input
                id="ybt_left_posterolateral"
                type="number"
                step="0.1"
                value={result.ybt_left_posterolateral}
                onChange={(e) => setResult({...result, ybt_left_posterolateral: e.target.value})}
                className="mt-1"
                placeholder="Best of 3 trials"
              />
            </div>
            {limbLengthLeft > 0 && (
              <div className="bg-white p-3 rounded">
                <span className="text-sm text-slate-600">Composite Score: </span>
                <span className="font-bold text-lg text-blue-600">{leftComposite.toFixed(1)}%</span>
              </div>
            )}
          </div>

          {/* Right Leg Stance */}
          <div className="bg-green-50 p-4 rounded-lg space-y-4">
            <h4 className="font-semibold text-green-900 text-lg">Standing on RIGHT Leg (Left Reaching)</h4>
            <div>
              <Label htmlFor="ybt_right_anterior">Anterior Reach (cm)</Label>
              <Input
                id="ybt_right_anterior"
                type="number"
                step="0.1"
                value={result.ybt_right_anterior}
                onChange={(e) => setResult({...result, ybt_right_anterior: e.target.value})}
                className="mt-1"
                placeholder="Best of 3 trials"
              />
            </div>
            <div>
              <Label htmlFor="ybt_right_posteromedial">Posteromedial Reach (cm)</Label>
              <Input
                id="ybt_right_posteromedial"
                type="number"
                step="0.1"
                value={result.ybt_right_posteromedial}
                onChange={(e) => setResult({...result, ybt_right_posteromedial: e.target.value})}
                className="mt-1"
                placeholder="Best of 3 trials"
              />
            </div>
            <div>
              <Label htmlFor="ybt_right_posterolateral">Posterolateral Reach (cm)</Label>
              <Input
                id="ybt_right_posterolateral"
                type="number"
                step="0.1"
                value={result.ybt_right_posterolateral}
                onChange={(e) => setResult({...result, ybt_right_posterolateral: e.target.value})}
                className="mt-1"
                placeholder="Best of 3 trials"
              />
            </div>
            {limbLengthRight > 0 && (
              <div className="bg-white p-3 rounded">
                <span className="text-sm text-slate-600">Composite Score: </span>
                <span className="font-bold text-lg text-green-600">{rightComposite.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Results Summary */}
        {(leftComposite > 0 || rightComposite > 0) && (
          <div className="bg-slate-100 p-4 rounded-lg">
            <h4 className="font-semibold text-slate-900 mb-3">Results Summary</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <p className="text-slate-600">Left Composite</p>
                <p className="font-bold text-lg text-blue-600">{leftComposite.toFixed(1)}%</p>
              </div>
              <div className="text-center">
                <p className="text-slate-600">Right Composite</p>
                <p className="font-bold text-lg text-green-600">{rightComposite.toFixed(1)}%</p>
              </div>
              <div className="text-center">
                <p className="text-slate-600">Anterior Asymmetry</p>
                <p className={`font-bold text-lg ${anteriorAsymmetry > 4 ? 'text-red-600' : 'text-slate-600'}`}>
                  {anteriorAsymmetry.toFixed(1)} cm
                  {anteriorAsymmetry > 4 && <span className="text-xs block">⚠ Elevated Risk</span>}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const render10MWTFields = () => (
    <div className="space-y-6">
      {/* Timer */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-3">Test Timer (10m timed section)</h3>
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold text-blue-600 font-mono">
            {timerSeconds.toFixed(2)}s
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => setTimerRunning(!timerRunning)}
              variant={timerRunning ? "destructive" : "default"}
              size="sm"
            >
              {timerRunning ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
              {timerRunning ? 'Stop' : 'Start'}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setTimerRunning(false);
                setTimerSeconds(0);
              }}
              variant="outline"
              size="sm"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Comfortable Pace */}
        <div className="bg-blue-50 p-4 rounded-lg space-y-4">
          <h4 className="font-semibold text-blue-900 text-lg">Comfortable Pace</h4>
          <div>
            <Label htmlFor="tenm_comfortable_time">Time (seconds)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="tenm_comfortable_time"
                type="number"
                step="0.01"
                value={result.tenm_comfortable_time}
                onChange={(e) => setResult({...result, tenm_comfortable_time: e.target.value})}
                placeholder="e.g., 8.5"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTimerRunning(false);
                  setResult({...result, tenm_comfortable_time: timerSeconds.toFixed(2)});
                }}
                disabled={timerSeconds === 0}
              >
                Use Time
              </Button>
            </div>
          </div>
          {result.tenm_comfortable_time && (
            <div className="bg-white p-3 rounded">
              <span className="text-sm text-slate-600">Speed: </span>
              <span className="font-bold text-lg text-blue-600">
                {(10 / parseFloat(result.tenm_comfortable_time)).toFixed(2)} m/s
              </span>
            </div>
          )}
        </div>

        {/* Fast Pace */}
        <div className="bg-green-50 p-4 rounded-lg space-y-4">
          <h4 className="font-semibold text-green-900 text-lg">Fast Pace</h4>
          <div>
            <Label htmlFor="tenm_fast_time">Time (seconds)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="tenm_fast_time"
                type="number"
                step="0.01"
                value={result.tenm_fast_time}
                onChange={(e) => setResult({...result, tenm_fast_time: e.target.value})}
                placeholder="e.g., 6.2"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTimerRunning(false);
                  setResult({...result, tenm_fast_time: timerSeconds.toFixed(2)});
                }}
                disabled={timerSeconds === 0}
              >
                Use Time
              </Button>
            </div>
          </div>
          {result.tenm_fast_time && (
            <div className="bg-white p-3 rounded">
              <span className="text-sm text-slate-600">Speed: </span>
              <span className="font-bold text-lg text-green-600">
                {(10 / parseFloat(result.tenm_fast_time)).toFixed(2)} m/s
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Additional Info */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Assistive Device Used</Label>
          <Select 
            value={result.tenm_assistive_device || ''} 
            onValueChange={(value) => setResult({...result, tenm_assistive_device: value})}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select if applicable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="cane">Single Point Cane</SelectItem>
              <SelectItem value="quad_cane">Quad Cane</SelectItem>
              <SelectItem value="walker">Walker</SelectItem>
              <SelectItem value="rollator">Rollator</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="tenm_gait_deviations">Gait Deviations Observed</Label>
          <Input
            id="tenm_gait_deviations"
            value={result.tenm_gait_deviations}
            onChange={(e) => setResult({...result, tenm_gait_deviations: e.target.value})}
            className="mt-1"
            placeholder="e.g., asymmetrical, shuffling"
          />
        </div>
      </div>

      {/* Interpretation */}
      {result.tenm_comfortable_time && (
        <div className="bg-slate-100 p-4 rounded-lg">
          <h4 className="font-semibold text-slate-900 mb-2">Interpretation</h4>
          {(() => {
            const speed = 10 / parseFloat(result.tenm_comfortable_time);
            let interpretation = '';
            let color = '';
            if (speed >= 1.0) {
              interpretation = 'Community Ambulator';
              color = 'text-green-600';
            } else if (speed >= 0.6) {
              interpretation = 'Limited Community Ambulator';
              color = 'text-yellow-600';
            } else {
              interpretation = 'Household Ambulator';
              color = 'text-red-600';
            }
            return <p className={`font-semibold ${color}`}>{interpretation} ({speed.toFixed(2)} m/s)</p>;
          })()}
        </div>
      )}
    </div>
  );

  const render4StageBalanceFields = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h4 className="font-semibold text-blue-900 mb-2">Instructions to Patient:</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• "I'm going to show you four positions."</p>
          <p>• "Try to stand in each position for 10 seconds."</p>
          <p>• "You can hold your arms out, or move your body to help keep your balance, but don't move your feet."</p>
          <p>• "For each position I will say, 'Ready, begin.' Then, I will start timing. After 10 seconds, I will say, 'Stop.'"</p>
        </div>
        <div className="mt-3 pt-3 border-t border-blue-300 text-sm text-blue-800">
          <p><strong>Test Protocol:</strong> Demonstrate each position. Stand next to patient, hold their arm, and help them assume the correct position. When steady, let go and time. If they hold for 10 seconds without moving feet or needing support, proceed to next position. If not, STOP the test.</p>
        </div>
      </div>

      {/* Timer */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-3">10-Second Timer</h3>
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold text-blue-600 font-mono">
            {timerSeconds.toFixed(1)}s
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => setTimerRunning(!timerRunning)}
              variant={timerRunning ? "destructive" : "default"}
              size="sm"
            >
              {timerRunning ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
              {timerRunning ? 'Stop' : 'Start'}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setTimerRunning(false);
                setTimerSeconds(0);
              }}
              variant="outline"
              size="sm"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>
          {timerSeconds >= 10 && (
            <span className="text-green-600 font-semibold">✓ 10 seconds!</span>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Stage 1: Feet Together */}
        <div className={`p-4 rounded-lg border-2 ${result.four_stage_feet_together === 'pass' ? 'bg-green-50 border-green-300' : result.four_stage_feet_together === 'fail' ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
          <h4 className="font-semibold text-slate-900 mb-2">① Stand with feet side-by-side</h4>
          <p className="text-xs text-slate-600 mb-3">Feet together, touching</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={result.four_stage_feet_together === 'pass' ? "default" : "outline"}
              onClick={() => setResult({...result, four_stage_feet_together: 'pass'})}
              className="flex-1"
              size="sm"
            >
              Pass (10s)
            </Button>
            <Button
              type="button"
              variant={result.four_stage_feet_together === 'fail' ? "destructive" : "outline"}
              onClick={() => setResult({...result, four_stage_feet_together: 'fail'})}
              className="flex-1"
              size="sm"
            >
              Fail
            </Button>
          </div>
        </div>

        {/* Stage 2: Semi-Tandem */}
        <div className={`p-4 rounded-lg border-2 ${result.four_stage_semi_tandem === 'pass' ? 'bg-green-50 border-green-300' : result.four_stage_semi_tandem === 'fail' ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
          <h4 className="font-semibold text-slate-900 mb-2">② Place instep touching big toe</h4>
          <p className="text-xs text-slate-600 mb-3">Instep of one foot touching big toe of other foot</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={result.four_stage_semi_tandem === 'pass' ? "default" : "outline"}
              onClick={() => setResult({...result, four_stage_semi_tandem: 'pass'})}
              className="flex-1"
              size="sm"
              disabled={result.four_stage_feet_together !== 'pass'}
            >
              Pass (10s)
            </Button>
            <Button
              type="button"
              variant={result.four_stage_semi_tandem === 'fail' ? "destructive" : "outline"}
              onClick={() => setResult({...result, four_stage_semi_tandem: 'fail'})}
              className="flex-1"
              size="sm"
              disabled={result.four_stage_feet_together !== 'pass'}
            >
              Fail
            </Button>
          </div>
        </div>

        {/* Stage 3: Tandem */}
        <div className={`p-4 rounded-lg border-2 ${result.four_stage_tandem === 'pass' ? 'bg-green-50 border-green-300' : result.four_stage_tandem === 'fail' ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
          <h4 className="font-semibold text-slate-900 mb-2">③ Tandem stand: heel touching toe</h4>
          <p className="text-xs text-slate-600 mb-3">Place one foot in front of the other, heel touching toe</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={result.four_stage_tandem === 'pass' ? "default" : "outline"}
              onClick={() => setResult({...result, four_stage_tandem: 'pass'})}
              className="flex-1"
              size="sm"
              disabled={result.four_stage_semi_tandem !== 'pass'}
            >
              Pass (10s)
            </Button>
            <Button
              type="button"
              variant={result.four_stage_tandem === 'fail' ? "destructive" : "outline"}
              onClick={() => setResult({...result, four_stage_tandem: 'fail'})}
              className="flex-1"
              size="sm"
              disabled={result.four_stage_semi_tandem !== 'pass'}
            >
              Fail
            </Button>
          </div>
        </div>

        {/* Stage 4: Single Leg */}
        <div className={`p-4 rounded-lg border-2 ${result.four_stage_single_leg === 'pass' ? 'bg-green-50 border-green-300' : result.four_stage_single_leg === 'fail' ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
          <h4 className="font-semibold text-slate-900 mb-2">④ Stand on one foot</h4>
          <p className="text-xs text-slate-600 mb-3">Stand on one foot (other foot lifted off ground)</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={result.four_stage_single_leg === 'pass' ? "default" : "outline"}
              onClick={() => setResult({...result, four_stage_single_leg: 'pass'})}
              className="flex-1"
              size="sm"
              disabled={result.four_stage_tandem !== 'pass'}
            >
              Pass (10s)
            </Button>
            <Button
              type="button"
              variant={result.four_stage_single_leg === 'fail' ? "destructive" : "outline"}
              onClick={() => setResult({...result, four_stage_single_leg: 'fail'})}
              className="flex-1"
              size="sm"
              disabled={result.four_stage_tandem !== 'pass'}
            >
              Fail
            </Button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      {result.four_stage_feet_together && (
        <div className={`p-4 rounded-lg ${result.four_stage_tandem !== 'pass' ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <h4 className="font-semibold text-slate-900 mb-2">Results Summary</h4>
          <p className="font-semibold">
            Highest Stage Achieved: {
              result.four_stage_single_leg === 'pass' ? '4 (Single Leg)' :
              result.four_stage_tandem === 'pass' ? '3 (Tandem)' :
              result.four_stage_semi_tandem === 'pass' ? '2 (Semi-Tandem)' :
              result.four_stage_feet_together === 'pass' ? '1 (Feet Together)' : '0'
            }
          </p>
          {result.four_stage_tandem !== 'pass' && (
            <p className="text-red-600 font-semibold mt-2">⚠ Unable to hold tandem stance for 10 seconds = Increased risk of falling</p>
          )}
        </div>
      )}
      
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
        <p><strong>Clinical Note:</strong> An older adult who cannot hold the tandem stand for at least 10 seconds is at increased risk of falling. Consider referral to physical therapy for gait and balance exercises, or to an evidence-based fall prevention program.</p>
      </div>
    </div>
  );

  const renderROMFields = () => (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          Click below to open the ROM Assessment module. Select a joint, view goniometer placement instructions, and record left/right measurements.
        </p>
      </div>

      <Button
        type="button"
        onClick={() => setShowROMRunner(true)}
        className="w-full"
        size="lg"
      >
        <Ruler className="w-5 h-5 mr-2" />
        Open ROM Assessment Module
      </Button>

      {result.rom_data && result.rom_data.joint && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-900 mb-2">Current ROM Data: {result.rom_data.jointName}</h4>
          <div className="space-y-1 text-sm">
            {result.rom_data.measurements && Object.entries(result.rom_data.measurements).map(([movement, values]) => (
              (values.left || values.right) && (
                <p key={movement} className="text-green-800">
                  <strong>{movement}:</strong> 
                  {values.left && ` L: ${values.left}°`}
                  {values.right && ` R: ${values.right}°`}
                </p>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderPainScalesFields = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          Rate overall pain intensity on a scale of 0-10. Then optionally mark specific pain locations on the body diagram below.
        </p>
      </div>

      {/* Pain Score */}
      <div>
        <Label htmlFor="result_value" className="text-lg font-semibold">Overall Pain Score (0-10)</Label>
        <div className="flex gap-2 mt-2 flex-wrap">
          {[0,1,2,3,4,5,6,7,8,9,10].map(score => (
            <Button
              key={score}
              type="button"
              variant={parseFloat(result.result_value) === score ? "default" : "outline"}
              onClick={() => setResult({...result, result_value: score.toString()})}
              className={`w-12 h-12 text-lg font-bold ${
                score === 0 ? 'bg-green-100 hover:bg-green-200 border-green-300' :
                score <= 3 ? 'bg-blue-100 hover:bg-blue-200 border-blue-300' :
                score <= 6 ? 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300' :
                'bg-red-100 hover:bg-red-200 border-red-300'
              } ${parseFloat(result.result_value) === score ? 'ring-2 ring-offset-2 ring-slate-900' : ''}`}
            >
              {score}
            </Button>
          ))}
        </div>
        <div className="flex justify-between text-sm text-slate-500 mt-2 px-1">
          <span>No Pain</span>
          <span>Worst Imaginable</span>
        </div>
      </div>

      {/* Interpretation */}
      {result.result_value && (
        <div className={`p-3 rounded-lg ${
          parseFloat(result.result_value) === 0 ? 'bg-green-50 border border-green-200' :
          parseFloat(result.result_value) <= 3 ? 'bg-blue-50 border border-blue-200' :
          parseFloat(result.result_value) <= 6 ? 'bg-yellow-50 border border-yellow-200' :
          'bg-red-50 border border-red-200'
        }`}>
          <p className="font-semibold">
            {parseFloat(result.result_value) === 0 ? 'No Pain' :
             parseFloat(result.result_value) <= 3 ? 'Mild Pain' :
             parseFloat(result.result_value) <= 6 ? 'Moderate Pain' :
             'Severe Pain'}
          </p>
        </div>
      )}

      {/* Body Pain Chart */}
      <div className="border border-slate-200 rounded-lg p-4">
        <h4 className="font-semibold text-slate-900 mb-3">Pain Location Map (Optional)</h4>
        <BodyPainChart
          painLocations={result.pain_locations}
          onPainLocationsChange={(locations) => setResult({...result, pain_locations: locations})}
        />
      </div>
    </div>
  );

  const renderHeartRateRecoveryFields = () => {
    const peakHR = parseFloat(result.hrr_peak_hr) || 0;
    const hr1min = parseFloat(result.hrr_1min) || 0;
    const hr2min = parseFloat(result.hrr_2min) || 0;
    const hr3min = parseFloat(result.hrr_3min) || 0;
    
    const hrr1 = peakHR > 0 && hr1min > 0 ? peakHR - hr1min : null;
    const hrr2 = peakHR > 0 && hr2min > 0 ? peakHR - hr2min : null;
    const hrr3 = peakHR > 0 && hr3min > 0 ? peakHR - hr3min : null;

    const getHRRInterpretation = (hrr) => {
      if (hrr === null) return null;
      if (hrr < 12) return { text: 'Abnormal (increased risk)', color: 'text-red-600' };
      if (hrr <= 18) return { text: 'Borderline', color: 'text-yellow-600' };
      return { text: 'Normal', color: 'text-green-600' };
    };

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Record heart rate at peak exercise, then at 1, 2, and 3 minutes post-exercise. 
            Heart Rate Recovery (HRR) is automatically calculated as Peak HR minus HR at each time point.
          </p>
        </div>

        {/* Peak Exercise HR */}
        <div className="bg-red-50 p-4 rounded-lg">
          <h4 className="font-semibold text-red-900 text-lg mb-3">Peak Exercise Heart Rate</h4>
          <div>
            <Label htmlFor="hrr_peak_hr">Peak HR (bpm)</Label>
            <Input
              id="hrr_peak_hr"
              type="number"
              value={result.hrr_peak_hr}
              onChange={(e) => setResult({...result, hrr_peak_hr: e.target.value})}
              className="mt-1 text-xl font-bold"
              placeholder="e.g., 165"
            />
          </div>
        </div>

        {/* Recovery HR Measurements */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-semibold text-green-900 text-lg mb-3">Recovery Heart Rate</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="hrr_1min">1 Minute (bpm)</Label>
              <Input
                id="hrr_1min"
                type="number"
                value={result.hrr_1min}
                onChange={(e) => setResult({...result, hrr_1min: e.target.value})}
                className="mt-1"
                placeholder="e.g., 140"
              />
            </div>
            <div>
              <Label htmlFor="hrr_2min">2 Minutes (bpm)</Label>
              <Input
                id="hrr_2min"
                type="number"
                value={result.hrr_2min}
                onChange={(e) => setResult({...result, hrr_2min: e.target.value})}
                className="mt-1"
                placeholder="e.g., 125"
              />
            </div>
            <div>
              <Label htmlFor="hrr_3min">3 Minutes (bpm)</Label>
              <Input
                id="hrr_3min"
                type="number"
                value={result.hrr_3min}
                onChange={(e) => setResult({...result, hrr_3min: e.target.value})}
                className="mt-1"
                placeholder="e.g., 110"
              />
            </div>
          </div>
        </div>

        {/* Calculated HRR Results */}
        {peakHR > 0 && (hrr1 !== null || hrr2 !== null || hrr3 !== null) && (
          <div className="bg-slate-100 p-4 rounded-lg">
            <h4 className="font-semibold text-slate-900 mb-3">Calculated Heart Rate Recovery</h4>
            <div className="grid grid-cols-3 gap-4">
              {hrr1 !== null && (
                <div className="text-center bg-white p-3 rounded-lg">
                  <p className="text-sm text-slate-600">HRR at 1 min</p>
                  <p className="font-bold text-2xl text-blue-600">{hrr1} bpm</p>
                  {getHRRInterpretation(hrr1) && (
                    <p className={`text-xs font-semibold mt-1 ${getHRRInterpretation(hrr1).color}`}>
                      {getHRRInterpretation(hrr1).text}
                    </p>
                  )}
                </div>
              )}
              {hrr2 !== null && (
                <div className="text-center bg-white p-3 rounded-lg">
                  <p className="text-sm text-slate-600">HRR at 2 min</p>
                  <p className="font-bold text-2xl text-blue-600">{hrr2} bpm</p>
                  {hrr2 < 22 && (
                    <p className="text-xs font-semibold mt-1 text-yellow-600">
                      May indicate impaired recovery
                    </p>
                  )}
                </div>
              )}
              {hrr3 !== null && (
                <div className="text-center bg-white p-3 rounded-lg">
                  <p className="text-sm text-slate-600">HRR at 3 min</p>
                  <p className="font-bold text-2xl text-blue-600">{hrr3} bpm</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGaitSpeedFields = () => {
    const distance = parseFloat(result.gait_distance) || 4;
    const times = [
      parseFloat(result.gait_time_trial1) || 0,
      parseFloat(result.gait_time_trial2) || 0,
      parseFloat(result.gait_time_trial3) || 0
    ].filter(t => t > 0);
    const avgTime = times.length > 0 ? times.reduce((a, b) => a + b) / times.length : 0;
    const speed = avgTime > 0 ? distance / avgTime : 0;

    return (
      <div className="space-y-6">
        {/* Timer */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 mb-3">Test Timer</h3>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-blue-600 font-mono">
              {timerSeconds.toFixed(2)}s
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => setTimerRunning(!timerRunning)}
                variant={timerRunning ? "destructive" : "default"}
                size="sm"
              >
                {timerRunning ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                {timerRunning ? 'Stop' : 'Start'}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSeconds(0);
                }}
                variant="outline"
                size="sm"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
            </div>
          </div>
        </div>

        {/* Distance */}
        <div>
          <Label htmlFor="gait_distance">Walking Distance (meters)</Label>
          <Select 
            value={result.gait_distance} 
            onValueChange={(value) => setResult({...result, gait_distance: value})}
          >
            <SelectTrigger className="mt-1 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">4 meters</SelectItem>
              <SelectItem value="6">6 meters</SelectItem>
              <SelectItem value="10">10 meters</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Trials */}
        <div className="bg-blue-50 p-4 rounded-lg space-y-4">
          <h4 className="font-semibold text-blue-900 text-lg">
            {isFastGaitSpeed() ? 'Fast Pace Trials' : 'Comfortable Pace Trials'}
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="gait_time_trial1">Trial 1 (s)</Label>
              <div className="flex gap-1 mt-1">
                <Input
                  id="gait_time_trial1"
                  type="number"
                  step="0.01"
                  value={result.gait_time_trial1}
                  onChange={(e) => setResult({...result, gait_time_trial1: e.target.value})}
                  placeholder="Time"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTimerRunning(false);
                    setResult({...result, gait_time_trial1: timerSeconds.toFixed(2)});
                  }}
                  disabled={timerSeconds === 0}
                >
                  Use
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="gait_time_trial2">Trial 2 (s)</Label>
              <div className="flex gap-1 mt-1">
                <Input
                  id="gait_time_trial2"
                  type="number"
                  step="0.01"
                  value={result.gait_time_trial2}
                  onChange={(e) => setResult({...result, gait_time_trial2: e.target.value})}
                  placeholder="Time"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTimerRunning(false);
                    setResult({...result, gait_time_trial2: timerSeconds.toFixed(2)});
                  }}
                  disabled={timerSeconds === 0}
                >
                  Use
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="gait_time_trial3">Trial 3 (s)</Label>
              <div className="flex gap-1 mt-1">
                <Input
                  id="gait_time_trial3"
                  type="number"
                  step="0.01"
                  value={result.gait_time_trial3}
                  onChange={(e) => setResult({...result, gait_time_trial3: e.target.value})}
                  placeholder="Time"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTimerRunning(false);
                    setResult({...result, gait_time_trial3: timerSeconds.toFixed(2)});
                  }}
                  disabled={timerSeconds === 0}
                >
                  Use
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Assistive Device */}
        <div>
          <Label>Assistive Device Used</Label>
          <Select 
            value={result.gait_assistive_device || ''} 
            onValueChange={(value) => setResult({...result, gait_assistive_device: value})}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select if applicable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="cane">Single Point Cane</SelectItem>
              <SelectItem value="quad_cane">Quad Cane</SelectItem>
              <SelectItem value="walker">Walker</SelectItem>
              <SelectItem value="rollator">Rollator</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Summary */}
        {times.length > 0 && (
          <div className="bg-slate-100 p-4 rounded-lg">
            <h4 className="font-semibold text-slate-900 mb-2">Results Summary</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600">Average Time:</p>
                <p className="font-bold text-lg">{avgTime.toFixed(2)}s</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Gait Speed:</p>
                <p className="font-bold text-lg text-blue-600">{speed.toFixed(2)} m/s</p>
              </div>
            </div>
            {isHabitualGaitSpeed() && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm font-semibold">
                  {speed >= 1.0 ? '✓ Normal community ambulation' : 
                   speed >= 0.8 ? '⚠ Some limitation' : 
                   speed >= 0.6 ? '⚠ Significant limitation' : 
                   '⚠ High fall/frailty risk'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderQuestionnaireFields = () => (!assessment.questions?.length ? null :
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg mb-4">
        <p className="text-sm text-blue-800">
          {assessment.instructions || "Please answer all questions based on your recent experience."}
        </p>
      </div>
      
      {assessment.questions.map((question, index) => (
        <div key={index} className="p-4 bg-slate-50 rounded-lg">
          <Label className="text-base font-medium mb-3 block">
            {index + 1}. {question.question_text}
          </Label>
          
          {question.question_type === 'yes_no' ? (
            <div className="flex gap-4">
              <Button
                type="button"
                variant={questionnaireResponses[index] === 1 ? "default" : "outline"}
                onClick={() => setQuestionnaireResponses({...questionnaireResponses, [index]: 1})}
                className="flex-1"
              >
                Yes
              </Button>
              <Button
                type="button"
                variant={questionnaireResponses[index] === 0 ? "default" : "outline"}
                onClick={() => setQuestionnaireResponses({...questionnaireResponses, [index]: 0})}
                className="flex-1"
              >
                No
              </Button>
            </div>
          ) : question.question_type === 'scale' && question.options ? (
            <div className="space-y-2">
              {question.options.map((option, optIndex) => (
                <Button
                  key={optIndex}
                  type="button"
                  variant={questionnaireResponses[index] === option.value ? "default" : "outline"}
                  onClick={() => setQuestionnaireResponses({...questionnaireResponses, [index]: option.value})}
                  className="w-full justify-start text-left"
                >
                  <span className="font-semibold mr-2">{option.value}:</span> {option.label}
                </Button>
              ))}
            </div>
          ) : question.question_type === 'multiple_choice' && question.options ? (
            <div className="space-y-2">
              {question.options.map((option, optIndex) => (
                <Button
                  key={optIndex}
                  type="button"
                  variant={questionnaireResponses[index] === option.value ? "default" : "outline"}
                  onClick={() => setQuestionnaireResponses({...questionnaireResponses, [index]: option.value})}
                  className="w-full justify-start text-left"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ))}

      {Object.keys(questionnaireResponses).length > 0 && (
        <div className="bg-slate-50 p-4 rounded-lg">
          <h4 className="font-semibold text-slate-900 mb-2">Current Score</h4>
          <p className="text-2xl font-bold text-blue-600">{calculateQuestionnaireScore()} / {(assessment.questions || []).reduce((sum, q) => sum + (q.options ? Math.max(...q.options.map(o => o.value)) : 1), 0)}</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-slate-900">{assessment.name}</h2>
                {isStandaloneMode ? (
                  <div className="mt-2">
                    <Label className="text-sm text-slate-600 mb-1 block">Assign to Client</Label>
                    <Select 
                      value={selectedClient?.id || ''} 
                      onValueChange={(value) => {
                        const client = allClients.find(c => c.id === value);
                        setSelectedClient(client);
                        if (client) {
                          setResult(prev => ({ ...prev, client_name: client.full_name }));
                        }
                      }}
                    >
                      <SelectTrigger className="w-72">
                        <SelectValue placeholder="Select a client to assign this test">
                          {selectedClient ? (
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              {selectedClient.full_name}
                            </div>
                          ) : (
                            <span className="text-slate-400">Select a client</span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {allClients.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="text-slate-600">Client: {client.full_name}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Clinician Instructions - always shown */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-5 shadow-md">
                <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                  <span className="text-lg">💬</span> Clinician Instructions
                </h3>
                <div className="text-base leading-relaxed bg-white/10 backdrop-blur-sm rounded p-3 whitespace-pre-wrap">
                  {assessment.instructions || `Administer the ${assessment.name} according to standardised protocol.\n\n${assessment.description ? `About: ${assessment.description}\n\n` : ''}${assessment.equipment_needed ? `Equipment needed: ${assessment.equipment_needed}\n\n` : ''}${assessment.contraindications ? `⚠ Contraindications: ${assessment.contraindications}\n\n` : ''}${assessment.scoring_system ? `Scoring: ${assessment.scoring_system}` : 'Record the result below and add any clinical observations in the notes field.'}`}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pb-4 border-b">
                <div>
                  <Label htmlFor="client_name">Client Name</Label>
                  <Input
                    id="client_name"
                    value={result.client_name}
                    disabled
                    className="mt-1 bg-slate-50"
                  />
                </div>
                <div>
                  <Label htmlFor="assessor_name">Assessor Name</Label>
                  <Input
                    id="assessor_name"
                    value={result.assessor_name}
                    disabled
                    className="mt-1 bg-slate-50"
                  />
                </div>
                <div>
                  <Label htmlFor="assessment_date">Assessment Date</Label>
                  <Input
                    id="assessment_date"
                    type="date"
                    value={result.assessment_date}
                    onChange={(e) => setResult({...result, assessment_date: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>

              {isDASS21() ? (
                <div className="space-y-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-sm text-purple-800">
                      Click below to start the DASS-21 with all 21 questions measuring depression, anxiety, and stress.
                    </p>
                  </div>
                  <Button type="button" onClick={() => setShowDASS21Runner(true)} className="w-full bg-purple-600 hover:bg-purple-700" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start DASS-21 Assessment
                  </Button>
                  {dass21Data && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">DASS-21 Completed</h4>
                      <div className="space-y-1 text-sm">
                        <p>Depression: <strong className="text-lg">{dass21Data.depression_score}/42</strong> ({dass21Data.depression_interpretation})</p>
                        <p>Anxiety: <strong className="text-lg">{dass21Data.anxiety_score}/42</strong> ({dass21Data.anxiety_interpretation})</p>
                        <p>Stress: <strong className="text-lg">{dass21Data.stress_score}/42</strong> ({dass21Data.stress_interpretation})</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : isHADSTest() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the Hospital Anxiety and Depression Scale (HADS) questionnaire.
                    </p>
                  </div>
                  <Button type="button" onClick={() => setShowHADSRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start HADS Assessment
                  </Button>
                  {hadsData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">HADS Completed</h4>
                      <div className="space-y-1 text-sm">
                        <p>Anxiety: <strong className="text-lg">{hadsData.anxiety_score}/21</strong> ({hadsData.anxiety_interpretation})</p>
                        <p>Depression: <strong className="text-lg">{hadsData.depression_score}/21</strong> ({hadsData.depression_interpretation})</p>
                      </div>
                    </div>
                  )}
                  </div>
                  ) : isClinicalFrailtyScaleTest() ? (
                  <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to complete the Clinical Frailty Scale assessment (score 1-9).
                    </p>
                  </div>
                  <Button type="button" onClick={() => setShowClinicalFrailtyScaleRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Clinical Frailty Scale
                  </Button>
                  {clinicalFrailtyScaleData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Clinical Frailty Scale Completed</h4>
                      <p className="text-sm">Frailty Score: <strong className="text-2xl">{clinicalFrailtyScaleData.frailty_score}</strong> / 9</p>
                    </div>
                  )}
                  </div>
                  ) : isEbbelingTest() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      The Ebbeling Single-Stage Treadmill Test requires an interactive protocol with warm-up, HR monitoring, and VO2max calculation. Click below to start the guided test.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowEbbelingRunner(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Ebbeling Test Protocol
                  </Button>
                  {result.result_value && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{result.result_value} ml/kg/min</p>
                      <p className="text-sm text-green-700">Estimated VO2max</p>
                    </div>
                  )}
                </div>
              ) : isROMAssessment() ? (
                renderROMFields()
              ) : isMoCATest() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to open the MoCA assessment module with all cognitive domains.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowMoCARunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start MoCA Assessment
                  </Button>
                  {mocaData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">MoCA Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{mocaData.total}/30</p>
                    </div>
                  )}
                </div>
              ) : isMMTTest() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to open the Manual Muscle Testing module for detailed strength assessment.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowMMTRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start MMT Assessment
                  </Button>
                  {mmtData && (mmtData.tests || mmtData.additional_data?.tests) && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">MMT Completed</h4>
                      <p className="text-sm">{(mmtData.additional_data?.tests || mmtData.tests || []).length} muscle groups tested</p>
                      <p className="text-2xl font-bold text-green-600">Average: {(mmtData.result_value || mmtData.additional_data?.average_grade || mmtData.averageGrade || 0).toFixed(1)}/5</p>
                    </div>
                  )}
                </div>
              ) : isWaistHipRatio() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to measure waist and hip circumference and calculate ratio.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowWHRRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Ruler className="w-5 h-5 mr-2" />
                    Start Waist-Hip Measurement
                  </Button>
                  {whrData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Measurements Complete</h4>
                      <p className="text-2xl font-bold text-green-600">WHR: {whrData.whr_value}</p>
                      <p className="text-sm text-green-700">{whrData.risk_category}</p>
                    </div>
                  )}
                </div>
              ) : isBergBalance() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the Berg Balance Scale with all 14 items and scoring guidance.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowBergRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Berg Balance Scale
                  </Button>
                  {bergData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Berg Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{bergData.total}/56</p>
                      <p className="text-sm text-green-700">{bergData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isTUG() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the Timed Up and Go test with timer and multi-trial recording.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowTUGRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start TUG Test
                  </Button>
                  {tugData && tugData.trials && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">TUG Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{tugData.averageTime}s</p>
                      <p className="text-sm text-green-700">{tugData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isOneMinuteSitToStand() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the 1-Minute Sit-to-Stand test with timer and detailed data collection.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowOneMinuteSitToStandRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start 1-Minute STS Test
                  </Button>
                  {chairStandData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">1-Minute STS Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{chairStandData.repetitions} reps</p>
                      <p className="text-sm text-green-700">{chairStandData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isChairStand() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the Chair Stand test with timer and repetition counter.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowChairStandRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Chair Stand Test
                  </Button>
                  {chairStandData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Chair Stand Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{chairStandData.repetitions} reps</p>
                      <p className="text-sm text-green-700">{chairStandData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isFunctionalReach() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to perform the Functional Reach Test with multi-trial recording.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowFunctionalReachRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Functional Reach Test
                  </Button>
                  {functionalReachData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Functional Reach Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{functionalReachData.averageReach} cm</p>
                      <p className="text-sm text-green-700">{functionalReachData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isBackScratch() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to perform the Back Scratch test measuring shoulder flexibility.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowBackScratchRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Back Scratch Test
                  </Button>
                  {backScratchData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Back Scratch Completed</h4>
                      <p className="text-lg font-bold text-green-600">
                        Left: {backScratchData.left_best} cm | Right: {backScratchData.right_best} cm
                      </p>
                    </div>
                  )}
                </div>
              ) : isSitAndReach() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to perform the Sit and Reach flexibility test.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowSitReachRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Sit and Reach Test
                  </Button>
                  {sitReachData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Sit and Reach Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{sitReachData.best_score} cm</p>
                    </div>
                  )}
                </div>
              ) : isRomberg() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to perform Romberg's test with timer and result recording.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowRombergRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Romberg Test
                  </Button>
                  {rombergData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Romberg Completed</h4>
                      <p className="text-sm">Eyes Open: {rombergData.eyes_open_time}s | Eyes Closed: {rombergData.eyes_closed_time}s</p>
                      <p className="text-lg font-bold text-green-600">{rombergData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isStorkTest() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to perform the Stork Test (Standing Balance).
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowStorkRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Stork Test
                  </Button>
                  {storkData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Stork Test Completed</h4>
                      <p className="text-lg font-bold text-green-600">Best: {storkData.best_time}s</p>
                      <p className="text-sm text-green-700">{storkData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isCTSIB() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to perform the CTSIB with all 4 sensory conditions.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowCTSIBRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start CTSIB Test
                  </Button>
                  {ctsibData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">CTSIB Completed</h4>
                      <p className="text-lg font-bold text-green-600">{ctsibData.conditions_completed}/4 conditions passed</p>
                    </div>
                  )}
                </div>
              ) : isFourSquareStep() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to perform the Four Square Step Test with timer.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowFourSquareRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Four Square Step Test
                  </Button>
                  {fourSquareData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">FSST Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{fourSquareData.best_time}s</p>
                      <p className="text-sm text-green-700">{fourSquareData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isSkinfold() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to select measurement sites and record skinfold thickness.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowSkinfoldRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Skinfold Measurements
                  </Button>
                  {skinfoldData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Skinfolds Completed</h4>
                      <p className="text-sm">{skinfoldData.sites.length} sites measured</p>
                      <p className="text-2xl font-bold text-green-600">Sum: {skinfoldData.total_sum} mm</p>
                    </div>
                  )}
                </div>
              ) : isGirthMeasurement() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to select sites and record girth measurements.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowGirthRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Girth Measurements
                  </Button>
                  {girthData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Girths Completed</h4>
                      <p className="text-sm">{girthData.sites.length} sites measured</p>
                    </div>
                  )}
                </div>
              ) : isISWT() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the Incremental Shuttle Walk Test protocol.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowISWTRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start ISWT Protocol
                  </Button>
                  {iswtData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">ISWT Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{iswtData.total_distance}m</p>
                      <p className="text-sm text-green-700">Level {iswtData.level_completed}</p>
                    </div>
                  )}
                </div>
              ) : isHarvardStep() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the Harvard Step Test protocol.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowHarvardRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Harvard Step Test
                  </Button>
                  {harvardData && (
                   <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                     <h4 className="font-semibold text-green-900 mb-2">Harvard Step Completed</h4>
                     <p className="text-2xl font-bold text-green-600">Index: {harvardData.result_value ?? harvardData.fitness_index ?? harvardData.additional_data?.fitness_index}</p>
                     <p className="text-sm text-green-700">{harvardData.additional_data?.interpretation ?? harvardData.interpretation}</p>
                   </div>
                  )}
                </div>
              ) : isBoxAndBlock() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the Box and Block dexterity test.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowBoxBlockRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Box and Block Test
                  </Button>
                  {boxBlockData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Box and Block Completed</h4>
                      <p className="text-lg font-bold text-green-600">
                        Dominant: {boxBlockData.dominant_blocks} | Non-dominant: {boxBlockData.non_dominant_blocks}
                      </p>
                    </div>
                  )}
                </div>
              ) : isHiMAT() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the HiMAT high-level mobility assessment.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowHiMATRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start HiMAT Assessment
                  </Button>
                  {himatData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">HiMAT Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{himatData.total}/54</p>
                      <p className="text-sm text-green-700">{himatData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isAstrand() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the Åstrand-Rhyming cycle ergometer test.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowAstrandRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Åstrand Test
                  </Button>
                  {astrandData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Åstrand Test Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{astrandData.estimated_vo2max} ml/kg/min</p>
                      <p className="text-sm text-green-700">{astrandData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isJTA() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the Job Task Analysis for return-to-work assessment.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowJTARunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Job Task Analysis
                  </Button>
                  {jtaData && jtaData.job_title && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Job Analysis Completed</h4>
                      <p className="text-lg font-bold text-green-600">{jtaData.job_title}</p>
                      <p className="text-sm text-green-700">{jtaData.tasks?.length || 0} tasks analyzed</p>
                    </div>
                  )}
                </div>
              ) : isBorgRPE() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the Borg RPE Scale assessment.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowBorgRPERunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Borg RPE Scale
                  </Button>
                  {borgRPEData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">RPE Recorded</h4>
                      <p className="text-2xl font-bold text-green-600">{borgRPEData.rpe_value}</p>
                      <p className="text-sm text-green-700">{borgRPEData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isGeneralMovementScreen() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the General Movement Screen assessment.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowGMSRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start General Movement Screen
                  </Button>
                  {gmsData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Movement Screen Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{gmsData.total_score} / {gmsData.max_score || 72}</p>
                      <p className="text-sm text-green-700">{gmsData.asymmetry_count} asymmetries detected</p>
                    </div>
                  )}
                </div>
              ) : isGAD7() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the GAD-7 anxiety assessment with all 7 questions.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowGAD7Runner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start GAD-7 Assessment
                  </Button>
                  {gad7Data && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">GAD-7 Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{gad7Data.total_score} / 21</p>
                      <p className="text-sm text-green-700">{gad7Data.severity}</p>
                    </div>
                  )}
                </div>
              ) : isPHQ9() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the PHQ-9 depression assessment with all 9 questions.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowPHQ9Runner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start PHQ-9 Assessment
                  </Button>
                  {phq9Data && (
                    <div className={`border rounded-lg p-4 ${
                      phq9Data.suicidal_ideation_endorsed 
                        ? 'bg-red-50 border-red-300' 
                        : 'bg-green-50 border-green-200'
                    }`}>
                      <h4 className={`font-semibold mb-2 ${
                        phq9Data.suicidal_ideation_endorsed ? 'text-red-900' : 'text-green-900'
                      }`}>
                        PHQ-9 Completed
                        {phq9Data.suicidal_ideation_endorsed && " ⚠"}
                      </h4>
                      <p className={`text-2xl font-bold ${
                        phq9Data.suicidal_ideation_endorsed ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {phq9Data.total_score} / 27
                      </p>
                      <p className={`text-sm ${
                        phq9Data.suicidal_ideation_endorsed ? 'text-red-700' : 'text-green-700'
                      }`}>
                        {phq9Data.severity}
                      </p>
                      {phq9Data.suicidal_ideation_endorsed && (
                        <p className="text-xs text-red-800 mt-2 font-semibold">
                          Suicidal ideation endorsed - follow up required
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : isArmCurl() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the 30-Second Arm Curl test with timer and normative comparison.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowArmCurlRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Arm Curl Test
                  </Button>
                  {armCurlData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Arm Curl Completed</h4>
                      <p className="text-lg font-bold text-green-600">
                        Right: {armCurlData.right_arm_reps || 'N/A'} | Left: {armCurlData.left_arm_reps || 'N/A'}
                      </p>
                      {armCurlData.normative_category && (
                        <p className="text-sm text-green-700">{armCurlData.normative_category}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : isK10() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the K10 psychological distress assessment with all 10 questions.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowK10Runner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start K10 Assessment
                  </Button>
                  {k10Data && (
                    <div className={`border rounded-lg p-4 ${
                      k10Data.risk_level === 'severe' 
                        ? 'bg-red-50 border-red-300' 
                        : 'bg-green-50 border-green-200'
                    }`}>
                      <h4 className={`font-semibold mb-2 ${
                        k10Data.risk_level === 'severe' ? 'text-red-900' : 'text-green-900'
                      }`}>
                        K10 Completed
                      </h4>
                      <p className={`text-2xl font-bold ${
                        k10Data.risk_level === 'severe' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {k10Data.total_score} / 50
                      </p>
                      <p className={`text-sm ${
                        k10Data.risk_level === 'severe' ? 'text-red-700' : 'text-green-700'
                      }`}>
                        {k10Data.severity}
                      </p>
                    </div>
                  )}
                </div>
              ) : isHOOS() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the HOOS hip outcome assessment.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowHOOSRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start HOOS Assessment
                  </Button>
                  {hoosData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">HOOS Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{hoosData.average_score} / 100</p>
                      <p className="text-sm text-green-700">Average across all subscales</p>
                    </div>
                  )}
                </div>
              ) : isKOOS() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the KOOS knee outcome assessment.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowKOOSRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start KOOS Assessment
                  </Button>
                  {koosData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">KOOS Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{koosData.average_score} / 100</p>
                      <p className="text-sm text-green-700">Average across all subscales</p>
                    </div>
                  )}
                </div>
              ) : isPediatricBalance() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the Pediatric Balance Scale with all 14 items and scoring guidance.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowPediatricBalanceRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Pediatric Balance Scale
                  </Button>
                  {result.additional_data?.pbs_data && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">PBS Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{result.additional_data.pbs_data.result_value}/56</p>
                      <p className="text-sm text-green-700">{result.additional_data.pbs_data.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isRepeatedJump() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the 10-second Repeated Jump Test with interactive timer and automatic RSI calculation.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowRepeatedJumpRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start 10-Second Jump Test
                  </Button>
                  {repeatedJumpData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Jump Test Completed</h4>
                      <p className="text-2xl font-bold text-green-600">Best RSI: {repeatedJumpData.best_rsi?.toFixed(3)}</p>
                      <p className="text-sm text-green-700">{repeatedJumpData.total_jumps} jumps | Avg RSI: {repeatedJumpData.average_rsi?.toFixed(3)}</p>
                    </div>
                  )}
                </div>
              ) : isCKCUEST() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the CKCUEST with 15-second timer.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowCKCUESTRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start CKCUEST
                  </Button>
                  {ckcuestData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">CKCUEST Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{ckcuestData.best_touches} touches</p>
                      <p className="text-sm text-green-700">{ckcuestData.position_used} position</p>
                    </div>
                  )}
                </div>
              ) : isOneRM() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to record 1RM testing for one or more exercises.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowOneRMRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start 1RM Testing
                  </Button>
                  {oneRMData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">1RM Testing Completed</h4>
                      <p className="text-sm text-green-700">{oneRMData.additional_data?.exercise_tested || "Exercise"} — {oneRMData.result_value} {oneRMData.additional_data?.units || "kg"}</p>
                    </div>
                  )}
                </div>
              ) : isIsometricStrength() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to perform isometric strength testing for multiple joints and movements.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowIsometricRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Isometric Testing
                  </Button>
                  {isometricData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Isometric Testing Completed</h4>
                      <p className="text-2xl font-bold text-green-600">Avg: {isometricData.result_value || isometricData.average_force_kg || isometricData.additional_data?.tests?.[0]?.best} kg</p>
                      <p className="text-sm text-green-700">{isometricData.total_tests} tests completed</p>
                    </div>
                  )}
                </div>
              ) : isIsokinetics() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to record isokinetic dynamometry results.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowIsokineticsRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Isokinetic Test
                  </Button>
                  {isokineticsData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Isokinetic Test Completed</h4>
                      <p className="text-sm">L: {isokineticsData.left_peak_torque_nm}Nm | R: {isokineticsData.right_peak_torque_nm}Nm</p>
                      {isokineticsData.asymmetry_percent && (
                        <p className="text-sm text-slate-600">Asymmetry: {isokineticsData.asymmetry_percent}%</p>
                      )}
                    </div>
                  )}
                </div>
              ) : isElyTest() || isThomasTest() || isOberTest() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to perform {assessment.name}.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowSpecialTestsRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start {assessment.name}
                  </Button>
                  {specialTestData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-lg font-bold text-green-600">{specialTestData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isSLR() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to perform the Straight Leg Raise test with neural tension assessment.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowSLRRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start SLR Test
                  </Button>
                  {slrData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">SLR Completed</h4>
                      <p className="text-sm text-green-700">
                        {slrData.left_data && `Left: ${slrData.left_data.interpretation}`}
                        {slrData.left_data && slrData.right_data && ' | '}
                        {slrData.right_data && `Right: ${slrData.right_data.interpretation}`}
                      </p>
                    </div>
                  )}
                </div>
              ) : isSlump() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to perform the Slump test for neurodynamic assessment.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowSlumpRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Slump Test
                  </Button>
                  {slumpData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Slump Completed</h4>
                      <p className="text-sm text-green-700">
                        {slumpData.left_data && `Left: ${slumpData.left_data.interpretation}`}
                        {slumpData.left_data && slumpData.right_data && ' | '}
                        {slumpData.right_data && `Right: ${slumpData.right_data.interpretation}`}
                      </p>
                    </div>
                  )}
                </div>
              ) : isLachman() || isAnteriorDrawer() || isPivotShift() || isMcMurray() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to perform {assessment.name}.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowKneeStabilityRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start {assessment.name}
                  </Button>
                  {kneeStabilityData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">
                        {kneeStabilityData.left_interpretation && `Left: ${kneeStabilityData.left_interpretation}`}
                        {kneeStabilityData.left_interpretation && kneeStabilityData.right_interpretation && ' | '}
                        {kneeStabilityData.right_interpretation && `Right: ${kneeStabilityData.right_interpretation}`}
                      </p>
                    </div>
                  )}
                </div>
              ) : isThessaly() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">Click below to perform the Thessaly Test.</p>
                  </div>
                  <Button type="button" onClick={() => setShowThessalyRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Thessaly Test
                  </Button>
                  {thessalyData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">
                        {thessalyData.left_data && `Left: ${thessalyData.left_data.interpretation}`}
                        {thessalyData.left_data && thessalyData.right_data && ' | '}
                        {thessalyData.right_data && `Right: ${thessalyData.right_data.interpretation}`}
                      </p>
                    </div>
                  )}
                </div>
              ) : isApleys() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">Click below to perform Apley's Compression Test.</p>
                  </div>
                  <Button type="button" onClick={() => setShowApleysRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Apley's Test
                  </Button>
                  {apleysData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">
                        {apleysData.left_data && `Left: ${apleysData.left_data.interpretation}`}
                        {apleysData.left_data && apleysData.right_data && ' | '}
                        {apleysData.right_data && `Right: ${apleysData.right_data.interpretation}`}
                      </p>
                    </div>
                  )}
                </div>
              ) : isNoble() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">Click below to perform the Noble Compression Test.</p>
                  </div>
                  <Button type="button" onClick={() => setShowNobleRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Noble Test
                  </Button>
                  {nobleData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">
                        {nobleData.left_data && `Left: ${nobleData.left_data.interpretation}`}
                        {nobleData.left_data && nobleData.right_data && ' | '}
                        {nobleData.right_data && `Right: ${nobleData.right_data.interpretation}`}
                      </p>
                    </div>
                  )}
                </div>
              ) : isNaughton() ? (<div className="space-y-4"><Button type="button" onClick={() => setShowNaughtonRunner(true)} className="w-full" size="lg"><Play className="w-5 h-5 mr-2" />Start Naughton Treadmill Protocol</Button>{naughtonData && (<div className="bg-green-50 border border-green-200 rounded-lg p-4"><h4 className="font-semibold text-green-900">Completed — Est. VO₂max: {naughtonData.additional_data?.estimated_vo2max} mL/kg/min</h4></div>)}</div>) : isBruceProtocol() || isModifiedBruce() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">Click below to perform {assessment.name}.</p>
                  </div>
                  <Button type="button" onClick={() => setShowBruceRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start {assessment.name}
                  </Button>
                  {bruceData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">
                        Time: {Math.floor(bruceData.total_time_seconds / 60)}:{(bruceData.total_time_seconds % 60).toString().padStart(2, '0')} | 
                        VO₂max: {bruceData.estimated_vo2max} ml/kg/min
                      </p>
                    </div>
                  )}
                </div>
              ) : isYMCACycle() || isAstrandCycle() || isWingate() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">Click below to perform {assessment.name}.</p>
                  </div>
                  <Button type="button" onClick={() => setShowCycleRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start {assessment.name}
                  </Button>
                  {cycleData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">
                        {cycleData.estimated_vo2max && `VO₂max: ${cycleData.estimated_vo2max} ml/kg/min`}
                      </p>
                    </div>
                  )}
                </div>
              ) : isTwoMinuteWalk() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowTwoMinWalkRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start 2 Minute Walk Test
                  </Button>
                  {twoMinWalkData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">Distance: {twoMinWalkData.distance_metres}m</p>
                    </div>
                  )}
                </div>
              ) : isCooperTest() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowCooperRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Cooper 12-Minute Test
                  </Button>
                  {cooperData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">Distance: {cooperData.distance_metres}m | VO₂max: {cooperData.estimated_vo2max}</p>
                    </div>
                  )}
                </div>
              ) : isBeepTest() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowBeepRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Beep Test
                  </Button>
                  {beepData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">Level: {beepData.final_level} | VO₂max: {beepData.estimated_vo2max}</p>
                    </div>
                  )}
                </div>
              ) : isYoYoTest() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowYoYoRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Yo-Yo Test
                  </Button>
                  {yoyoData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">Distance: {yoyoData.total_distance_metres}m ({yoyoData.test_type})</p>
                    </div>
                  )}
                </div>
              ) : isThirtyFifteenIFT() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowThirtyFifteenRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start 30-15 IFT
                  </Button>
                  {thirtyFifteenData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">VIFT: {thirtyFifteenData.vift_kmh} km/h</p>
                    </div>
                  )}
                </div>
              ) : isRSATest() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowRSARunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start {assessment.name}
                  </Button>
                  {rsaData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">Best: {rsaData.best_time}s | Mean: {rsaData.mean_time}s | Decrement: {rsaData.percentage_decrement}%</p>
                    </div>
                  )}
                </div>
              ) : isHRRTest() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowHRRRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Heart Rate Recovery
                  </Button>
                  {hrrData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">HRR Completed</h4>
                      <p className="text-sm text-green-700">HRR1: {hrrData.hrr_1_minute} bpm | {hrrData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isVO2maxGXT() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowVO2maxGXTRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start VO2max GXT
                  </Button>
                  {vo2maxGXTData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">VO2max: {vo2maxGXTData.peak_vo2_relative} ml/kg/min | {vo2maxGXTData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isHbA1c() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowHbA1cRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Interpret HbA1c Results
                  </Button>
                  {hba1cData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">HbA1c Interpreted</h4>
                      <p className="text-sm text-green-700">{hba1cData.hba1c_percent}% | {hba1cData.interpretation_category}</p>
                    </div>
                  )}
                </div>
              ) : isLipidProfile() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowLipidProfileRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Interpret Lipid Profile
                  </Button>
                  {lipidProfileData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Lipid Profile Interpreted</h4>
                      <p className="text-sm text-green-700">{lipidProfileData.overall_risk}</p>
                    </div>
                  )}
                </div>
              ) : isMETCalculation() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowMETCalcRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Calculate METs
                  </Button>
                  {metCalcData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">METs Calculated</h4>
                      <p className="text-sm text-green-700">{metCalcData.calculated_mets} METs | {metCalcData.classification}</p>
                    </div>
                  )}
                </div>
              ) : isSixMinuteStep() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowSixMinStepRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start 6-Minute Step Test
                  </Button>
                  {sixMinStepData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">{sixMinStepData.total_steps} steps</p>
                    </div>
                  )}
                </div>
              ) : isPPT() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowPPTRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Physical Performance Test
                  </Button>
                  {pptData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">PPT Completed</h4>
                      <p className="text-sm text-green-700">{pptData.total_score}/28 | {pptData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isCBM() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowCBMRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start CB&M Assessment
                  </Button>
                  {cbmData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">CB&M Completed</h4>
                      <p className="text-sm text-green-700">{cbmData.total_score}/96 | {cbmData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isBESTest() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowBESTestRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start BESTest Assessment
                  </Button>
                  {bestestData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">BESTest Completed</h4>
                      <p className="text-sm text-green-700">{bestestData.total_score}/108 ({bestestData.percentage_score}%) | {bestestData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isEMS() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowEMSRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start EMS Assessment
                  </Button>
                  {emsData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">EMS Completed</h4>
                      <p className="text-sm text-green-700">{emsData.total_score}/20 | {emsData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isYMCA3MinStep() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowYMCA3MinStepRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start YMCA 3-Minute Step Test
                  </Button>
                  {ymca3MinStepData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">HR: {ymca3MinStepData.additional_data?.post_exercise_hr} bpm | {ymca3MinStepData.additional_data?.fitness_category}</p>
                    </div>
                  )}
                </div>
              ) : isDGI() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowDGIRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Dynamic Gait Index
                  </Button>
                  {dgiData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">DGI Completed</h4>
                      <p className="text-sm text-green-700">{dgiData.total_score}/24 | {dgiData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isRockportWalk() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowRockportRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Rockport Walk Test
                  </Button>
                  {rockportData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">VO2max: {rockportData.result_value} ml/kg/min | {rockportData.additional_data?.fitness_category}</p>
                    </div>
                  )}
                </div>
              ) : isTenMeterWalk() || is10MeterWalkTest() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the 10-Meter Walk Test with timer, multi-trial recording, and automatic speed calculation.
                    </p>
                  </div>
                  <Button type="button" onClick={() => setShowTenMeterWalkRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start 10-Meter Walk Test
                  </Button>
                  {tenMeterWalkData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{tenMeterWalkData.average_speed} m/s</p>
                      <p className="text-sm text-green-700 mt-1">{tenMeterWalkData.interpretation}</p>
                      {tenMeterWalkData.trials && (
                        <p className="text-xs text-green-600 mt-1">{tenMeterWalkData.trials.length} trials completed</p>
                      )}
                    </div>
                  )}
                </div>
              ) : isASES() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowASESRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start ASES Score
                  </Button>
                  {asesData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">ASES Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{asesData.result_value}/100</p>
                    </div>
                  )}
                </div>
              ) : isDEXA() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowDEXARunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Interpret DEXA Scan Results
                  </Button>
                  {dexaData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">DEXA Results Interpreted</h4>
                      <p className="text-sm text-green-700">Worst T-Score: {dexaData.result_value}</p>
                    </div>
                  )}
                </div>
              ) : isConley() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowConleyRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Conley Scale
                  </Button>
                  {conleyData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Conley Scale Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{conleyData.result_value}/12</p>
                    </div>
                  )}
                </div>
              ) : isPSS() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowPSSRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start PSS-10
                  </Button>
                  {pssData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">PSS-10 Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{pssData.result_value}/40</p>
                    </div>
                  )}
                </div>
              ) : isConstantMurley() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowConstantMurleyRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Constant-Murley Score
                  </Button>
                  {constantMurleyData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Constant-Murley Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{constantMurleyData.result_value}/100</p>
                    </div>
                  )}
                </div>
              ) : isLysholm() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowLysholmRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Lysholm Knee Score
                  </Button>
                  {lysholmData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Lysholm Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{lysholmData.result_value}/100</p>
                    </div>
                  )}
                </div>
              ) : isACLRSI() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowACLRSIRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start ACL-RSI
                  </Button>
                  {aclrsiData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">ACL-RSI Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{aclrsiData.result_value}%</p>
                    </div>
                  )}
                </div>
              ) : isGROC() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowGROCRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start GROC
                  </Button>
                  {grocData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">GROC Completed</h4>
                      <p className="text-2xl font-bold text-green-600">Score: {grocData.result_value}</p>
                    </div>
                  )}
                </div>
              ) : isSGRQ() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowSGRQRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start SGRQ
                  </Button>
                  {sgrqData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">SGRQ Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{sgrqData.result_value}/100</p>
                    </div>
                  )}
                </div>
              ) : isFABQ() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowFABQRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start FABQ
                  </Button>
                  {fabqData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">FABQ Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{fabqData.result_value}/96</p>
                    </div>
                  )}
                </div>
              ) : isSingleLegHop() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowSingleLegHopRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Single Leg Hop Tests
                  </Button>
                  {singleLegHopData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Tests Completed</h4>
                      <p className="text-sm text-green-700">LSI: {singleLegHopData.result_value}%</p>
                    </div>
                  )}
                </div>
              ) : isDropVerticalJump() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowDropVerticalJumpRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Drop Vertical Jump
                  </Button>
                  {dropVerticalJumpData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{dropVerticalJumpData.result_value} cm</p>
                    </div>
                  )}
                </div>
              ) : isVerticalJump() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowVerticalJumpRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Vertical Jump Test
                  </Button>
                  {verticalJumpData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{verticalJumpData.result_value} cm</p>
                    </div>
                  )}
                </div>
              ) : isClockDrawing() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowClockDrawingRunner(true)} className="w-full" size="lg"><Play className="w-5 h-5 mr-2" />Start Clock Drawing Test</Button>
                  {clockDrawingData && (<div className="bg-green-50 border border-green-200 rounded-lg p-4"><h4 className="font-semibold text-green-900 mb-2">Test Completed</h4><p className="text-2xl font-bold text-green-600">{clockDrawingData.result_value}/5</p></div>)}
                </div>
              ) : isTMT() ? (
                <div className="space-y-4">
                  <Button type="button" onClick={() => setShowTMTRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Trail Making Test
                  </Button>
                  {tmtData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-sm text-green-700">Part A: {tmtData.additional_data?.best_part_a}s | Part B: {tmtData.additional_data?.best_part_b}s</p>
                    </div>
                  )}
                </div>
              ) : isTinetti() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the Tinetti POMA with balance and gait sections.
                    </p>
                  </div>
                  <Button type="button" onClick={() => setShowTinettiRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Tinetti POMA
                  </Button>
                  {tinettiData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Tinetti POMA Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{tinettiData.result_value}/28</p>
                      <p className="text-sm text-green-700">Balance: {tinettiData.additional_data?.balance_score}/16 | Gait: {tinettiData.additional_data?.gait_score}/12</p>
                      <p className="text-sm font-semibold mt-1">{tinettiData.additional_data?.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : is6MWT() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Standardized 6-Minute Walk Test with automated timer and encouragements.
                    </p>
                  </div>
                  <Button type="button" onClick={() => setShow6MWTRunner(true)} className="w-full" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start 6-Minute Walk Test
                  </Button>
                  {sixMWTData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">6MWT Completed</h4>
                      <p className="text-3xl font-bold text-green-600">{sixMWTData.distance_metres}m</p>
                      {sixMWTData.test_duration && (
                        <p className="text-sm text-green-700 mt-1">Test Duration: {Math.floor(sixMWTData.test_duration / 60)}:{(sixMWTData.test_duration % 60).toString().padStart(2, '0')}</p>
                      )}
                      {sixMWTData.laps_completed && (
                        <p className="text-sm text-green-700">Laps: {sixMWTData.laps_completed}</p>
                      )}
                      {sixMWTData.rest_periods_count > 0 && (
                        <p className="text-sm text-amber-700">Rest Periods: {sixMWTData.rest_periods_count}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : isQuestionnaireAssessment() ? (
                renderQuestionnaireFields()
              ) : isHandGripAssessment(assessment.name) ? (
                renderHandGripFields()
              ) : is6MinuteWalkTest() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the interactive 6-Minute Walk Test with standardized protocol, timer, and minute-by-minute prompts.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShow6MWTRunner(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Interactive 6MWT Protocol
                  </Button>
                  {result.result_value && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">6MWT Completed</h4>
                      <p className="text-3xl font-bold text-green-600">{result.result_value} meters</p>
                      {result.sixmwt_laps && (
                        <p className="text-sm text-green-700 mt-1">{result.sixmwt_laps} laps | {result.sixmwt_rest_periods || 0} rest periods</p>
                      )}
                    </div>
                  )}
                </div>
              ) : is2MinuteStepTest() ? (
                render2MinStepFields()
              ) : isSingleLegStance() ? (
                renderSingleLegStanceFields()
              ) : is4StageBalanceTest() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to start the 4-Stage Balance Test with interactive timer and fall risk assessment.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowFourStageBalanceRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start 4-Stage Balance Test
                  </Button>
                  {fourStageBalanceData && (
                    <div className={`border rounded-lg p-4 ${
                      fourStageBalanceData.fall_risk === 'increased' 
                        ? 'bg-red-50 border-red-300' 
                        : 'bg-green-50 border-green-200'
                    }`}>
                      <h4 className={`font-semibold mb-2 ${
                        fourStageBalanceData.fall_risk === 'increased' ? 'text-red-900' : 'text-green-900'
                      }`}>
                        4-Stage Balance Completed
                      </h4>
                      <p className={`text-2xl font-bold ${
                        fourStageBalanceData.fall_risk === 'increased' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        Stage {fourStageBalanceData.stage_achieved} / 4
                      </p>
                      <p className={`text-sm ${
                        fourStageBalanceData.fall_risk === 'increased' ? 'text-red-700' : 'text-green-700'
                      }`}>
                        {fourStageBalanceData.fall_risk === 'increased' ? '⚠ Increased fall risk' : '✓ Normal balance'}
                      </p>
                    </div>
                  )}
                </div>
              ) : isHeartRateRecovery() ? (
                renderHeartRateRecoveryFields()
              ) : isPainScales() ? (
                renderPainScalesFields()
              ) : isPainScales() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to record pain ratings using VAS/NPRS scales.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowPainScalesRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Pain Assessment
                  </Button>
                  {painScalesData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Pain Assessment Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{painScalesData.current_pain}/10</p>
                      <p className="text-sm text-green-700">{painScalesData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isBMITest() || isWaistCircumference() || isHeightTest() || isWeightTest() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to record body measurements and calculations.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowBodyMeasurementsRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Record Body Measurements
                  </Button>
                  {bodyMeasurementsData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Measurements Recorded</h4>
                      <p className="text-sm text-green-700">{bodyMeasurementsData.result_value}</p>
                    </div>
                  )}
                </div>
              ) : isHabitualGaitSpeed() || isFastGaitSpeed() || is4MeterGaitSpeed() ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to perform gait speed testing with timer and trials.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowGaitSpeedRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start {is4MeterGaitSpeed() ? '4-Meter Gait Speed Test' : 'Gait Speed Test'}
                  </Button>
                  {gaitSpeedData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Test Completed</h4>
                      <p className="text-2xl font-bold text-green-600">{gaitSpeedData.result_value || gaitSpeedData.average_speed_ms} m/s</p>
                      <p className="text-sm text-green-700">{gaitSpeedData.additional_data?.interpretation || gaitSpeedData.interpretation}</p>
                    </div>
                  )}
                </div>
              ) : isVitalSignsAssessment(assessment.name) ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Click below to record vital signs with interpretations and guidelines.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowVitalSignsRunner(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Record Vital Signs
                  </Button>
                  {vitalSignsData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2">Vital Signs Recorded</h4>
                      <p className="text-sm text-green-700">{vitalSignsData.result_value}</p>
                    </div>
                  )}
                </div>
              ) : isDASS21() ? (
                <div className="space-y-4">
                  {!dass21Data ? (<Button type="button" onClick={() => setShowDASS21Runner(true)} className="w-full" size="lg"><Play className="w-5 h-5 mr-2" />Start DASS-21 Assessment</Button>) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                      <h4 className="font-semibold text-green-900">DASS-21 Completed ✓</h4>
                      <p className="text-sm text-green-700">Depression: {dass21Data.depression_score}/42 ({dass21Data.depression_interpretation}) | Anxiety: {dass21Data.anxiety_score}/42 ({dass21Data.anxiety_interpretation}) | Stress: {dass21Data.stress_score}/42 ({dass21Data.stress_interpretation})</p>
                      <Button type="button" onClick={() => handleSubmit({ preventDefault: () => {} })} disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700">{isSubmitting ? 'Saving...' : 'Save DASS-21 to Client Record'}</Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Timer for timed assessments (excluding those with custom timers) */}
                  {assessment.unit_of_measure === 'seconds' && !is2MinuteStepTest() && !isSingleLegStance() && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <h3 className="font-semibold text-slate-900 mb-3">Test Timer</h3>
                      <div className="flex items-center gap-4">
                        <div className="text-4xl font-bold text-blue-600 font-mono">
                          {timerSeconds.toFixed(1)}s
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={() => setTimerRunning(!timerRunning)}
                            variant={timerRunning ? "destructive" : "default"}
                            size="sm"
                          >
                            {timerRunning ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                            {timerRunning ? 'Stop' : 'Start'}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              setTimerRunning(false);
                              setTimerSeconds(0);
                              setResult({...result, result_value: ""});
                            }}
                            variant="outline"
                            size="sm"
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Reset
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              setTimerRunning(false);
                              setResult({...result, result_value: timerSeconds.toFixed(1)});
                            }}
                            variant="secondary"
                            size="sm"
                            disabled={timerSeconds === 0}
                          >
                            Use Time
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="result_value">Result ({assessment.unit_of_measure || 'score'})</Label>
                    <Input
                      id="result_value"
                      type="number"
                      step="0.1"
                      value={result.result_value}
                      onChange={(e) => setResult({...result, result_value: e.target.value})}
                      className="mt-1"
                      placeholder="Enter the test result"
                    />
                  </div>

                  {/* Additional scales for 5xSTS */}
                  {isFiveTimesSitToStand() && (
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="rpe_scale">RPE (6-20)</Label>
                        <Input
                          id="rpe_scale"
                          type="number"
                          min="6"
                          max="20"
                          value={result.rpe_scale}
                          onChange={(e) => setResult({...result, rpe_scale: e.target.value})}
                          className="mt-1"
                          placeholder="Rate of Perceived Exertion"
                        />
                      </div>
                      <div>
                        <Label htmlFor="breathlessness_scale">Breathlessness (0-10)</Label>
                        <Input
                          id="breathlessness_scale"
                          type="number"
                          min="0"
                          max="10"
                          value={result.breathlessness_scale}
                          onChange={(e) => setResult({...result, breathlessness_scale: e.target.value})}
                          className="mt-1"
                          placeholder="Dyspnea scale"
                        />
                      </div>
                      <div>
                        <Label htmlFor="pain_scale">Pain (0-10)</Label>
                        <Input
                          id="pain_scale"
                          type="number"
                          min="0"
                          max="10"
                          value={result.pain_scale}
                          onChange={(e) => setResult({...result, pain_scale: e.target.value})}
                          className="mt-1"
                          placeholder="Pain level"
                        />
                      </div>
                    </div>
                  )}
                  </div>
                  )}

                  {/* Norms & Interpretation */}
                  {assessment.scoring_system && (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                   📊 Norms & Interpretation
                  </h3>
                  <div className="text-sm text-amber-900 whitespace-pre-wrap">
                   {assessment.scoring_system}
                  </div>
                  </div>
                  )}

                  {/* References */}
                  {assessment.references && (
                  <div className="bg-slate-50 border border-slate-300 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                   📚 References
                  </h3>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">
                   {assessment.references}
                  </div>
                  </div>
                  )}

                  <div>
                  <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={result.notes}
                  onChange={(e) => setResult({...result, notes: e.target.value})}
                  className="mt-1"
                  placeholder="Any observations or additional notes..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="barriers">Barriers Identified</Label>
                <Textarea
                  id="barriers"
                  value={result.barriers}
                  onChange={(e) => setResult({...result, barriers: e.target.value})}
                  className="mt-1"
                  placeholder="Any barriers to rehabilitation or performance noted..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : <Save className="w-4 h-4 mr-2" />}
                  Complete Assessment
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ROM Assessment Runner Modal */}
      {showROMRunner && (
        <ROMAssessmentRunner
          initialData={result.rom_data}
          onSave={(romData) => {
            setResult({ ...result, rom_data: romData });
            setShowROMRunner(false);
          }}
          onClose={() => setShowROMRunner(false)}
        />
      )}

      {/* Ebbeling Test Runner Modal */}
      {showEbbelingRunner && (
        <EbbelingTestRunner
          client={client}
          onSave={(data) => {
            setResult({
              ...result,
              result_value: data.result_value,
              notes: data.notes || result.notes,
              ebbeling_data: data.additional_data
            });
            setShowEbbelingRunner(false);
          }}
          onClose={() => setShowEbbelingRunner(false)}
        />
      )}

      {/* MoCA Runner Modal */}
      {showMoCARunner && (
        <MoCARunner
          onSave={(data) => {
            setMocaData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowMoCARunner(false);
          }}
          onClose={() => setShowMoCARunner(false)}
        />
      )}

      {/* Manual Muscle Test Runner Modal */}
      {showMMTRunner && (
        <ManualMuscleTestRunner
          initialData={mmtData}
          onSave={(data) => {
            setMMTData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowMMTRunner(false);
          }}
          onClose={() => setShowMMTRunner(false)}
        />
      )}

      {/* Waist-Hip Ratio Runner Modal */}
      {showWHRRunner && (
        <WaistHipRatioRunner
          client={selectedClient || client}
          onSave={(data) => {
            setWHRData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowWHRRunner(false);
          }}
          onClose={() => setShowWHRRunner(false)}
        />
      )}

      {/* Berg Balance Runner Modal */}
      {showBergRunner && (
        <BergBalanceRunner
          onSave={(data) => {
            setBergData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowBergRunner(false);
          }}
          onClose={() => setShowBergRunner(false)}
        />
      )}

      {/* Timed Up and Go Runner Modal */}
      {showTUGRunner && (
        <TUGRunner
          onSave={(data) => {
            setTUGData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowTUGRunner(false);
          }}
          onClose={() => setShowTUGRunner(false)}
        />
      )}

      {/* Chair Stand Runner Modal */}
      {showChairStandRunner && (
        <ChairStandRunner
          duration={assessment.name.includes('30') ? 30 : 60}
          onSave={(data) => {
            setChairStandData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowChairStandRunner(false);
          }}
          onClose={() => setShowChairStandRunner(false)}
        />
      )}

      {/* Functional Reach Runner Modal */}
      {showFunctionalReachRunner && (
        <FunctionalReachRunner
          onSave={(data) => {
            setFunctionalReachData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowFunctionalReachRunner(false);
          }}
          onClose={() => setShowFunctionalReachRunner(false)}
        />
      )}

      {/* Back Scratch Runner Modal */}
      {showBackScratchRunner && (
        <BackScratchRunner
          onSave={(data) => {
            setBackScratchData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowBackScratchRunner(false);
          }}
          onClose={() => setShowBackScratchRunner(false)}
        />
      )}

      {/* Sit and Reach Runner Modal */}
      {showSitReachRunner && (
        <SitAndReachRunner
          onSave={(data) => {
            setSitReachData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowSitReachRunner(false);
          }}
          onClose={() => setShowSitReachRunner(false)}
        />
      )}

      {/* Romberg Runner Modal */}
      {showRombergRunner && (
        <RombergRunner
          onSave={(data) => {
            setRombergData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowRombergRunner(false);
          }}
          onClose={() => setShowRombergRunner(false)}
        />
      )}

      {/* Stork Test Runner Modal */}
      {showStorkRunner && (
        <StorkTestRunner
          onSave={(data) => {
            setStorkData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowStorkRunner(false);
          }}
          onClose={() => setShowStorkRunner(false)}
        />
      )}

      {/* CTSIB Runner Modal */}
      {showCTSIBRunner && (
        <CTSIBRunner
          onSave={(data) => {
            setCTSIBData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowCTSIBRunner(false);
          }}
          onClose={() => setShowCTSIBRunner(false)}
        />
      )}

      {/* Four Square Step Runner Modal */}
      {showFourSquareRunner && (
        <FourSquareStepRunner
          onSave={(data) => {
            setFourSquareData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowFourSquareRunner(false);
          }}
          onClose={() => setShowFourSquareRunner(false)}
        />
      )}

      {/* Skinfold Runner Modal */}
      {showSkinfoldRunner && (
        <SkinfoldRunner
          onSave={(data) => {
            setSkinfoldData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowSkinfoldRunner(false);
          }}
          onClose={() => setShowSkinfoldRunner(false)}
        />
      )}

      {/* Girth Measurements Runner Modal */}
      {showGirthRunner && (
        <GirthMeasurementsRunner
          onSave={(data) => {
            setGirthData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowGirthRunner(false);
          }}
          onClose={() => setShowGirthRunner(false)}
        />
      )}

      {/* ISWT Runner Modal */}
      {showISWTRunner && (
        <ISWTRunner
          onSave={(data) => {
            setISWTData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowISWTRunner(false);
          }}
          onClose={() => setShowISWTRunner(false)}
        />
      )}

      {/* Harvard Step Runner Modal */}
      {showHarvardRunner && (
        <HarvardStepRunner
          onSave={(data) => {
            setHarvardData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowHarvardRunner(false);
          }}
          onClose={() => setShowHarvardRunner(false)}
        />
      )}

      {/* Box and Block Runner Modal */}
      {showBoxBlockRunner && (
        <BoxAndBlockRunner
          onSave={(data) => {
            setBoxBlockData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowBoxBlockRunner(false);
          }}
          onClose={() => setShowBoxBlockRunner(false)}
        />
      )}

      {/* HiMAT Runner Modal */}
      {showHiMATRunner && (
        <HiMATRunner
          onSave={(data) => {
            setHiMATData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowHiMATRunner(false);
          }}
          onClose={() => setShowHiMATRunner(false)}
        />
      )}

      {/* Åstrand Test Runner Modal */}
      {showAstrandRunner && (
        <AstrandTestRunner
          onSave={(data) => {
            setAstrandData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowAstrandRunner(false);
          }}
          onClose={() => setShowAstrandRunner(false)}
        />
      )}

      {/* Job Task Analysis Runner Modal */}
      {showJTARunner && (
        <JTARunner
          initialData={jtaData}
          onSave={(data) => {
            setJTAData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowJTARunner(false);
          }}
          onClose={() => setShowJTARunner(false)}
        />
      )}

      {/* 6MWT Runner Modal */}
      {show6MWTRunner && (
        <SixMinuteWalkRunner
          onSave={(data) => {
            // Update result state with all 6MWT data
            setResult(prev => ({
              ...prev,
              result_value: data.result_value?.toString() || '',
              notes: data.notes || prev.notes,
              sixmwt_pre_hr: data.sixmwt_pre_hr?.toString() || '',
              sixmwt_pre_bp_sys: data.sixmwt_pre_bp_sys?.toString() || '',
              sixmwt_pre_bp_dia: data.sixmwt_pre_bp_dia?.toString() || '',
              sixmwt_pre_spo2: data.sixmwt_pre_spo2?.toString() || '',
              sixmwt_pre_rpe: data.sixmwt_pre_rpe?.toString() || '',
              sixmwt_post_hr: data.sixmwt_post_hr?.toString() || '',
              sixmwt_post_spo2: data.sixmwt_post_spo2?.toString() || '',
              sixmwt_post_rpe: data.sixmwt_post_rpe?.toString() || '',
              sixmwt_post_dyspnea: data.sixmwt_post_dyspnea?.toString() || '',
              sixmwt_laps: data.sixmwt_laps?.toString() || '',
              sixmwt_rest_periods: data.sixmwt_rest_periods?.toString() || ''
            }));
            setShow6MWTRunner(false);
          }}
          onClose={() => setShow6MWTRunner(false)}
        />
      )}

      {/* Borg RPE Runner Modal */}
      {showBorgRPERunner && (
        <BorgRPERunner
          onSave={(data) => {
            setBorgRPEData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowBorgRPERunner(false);
          }}
          onClose={() => setShowBorgRPERunner(false)}
        />
      )}

      {/* General Movement Screen Runner Modal */}
      {showGMSRunner && (
        <GeneralMovementScreenRunner
          onSave={(data) => {
            setGMSData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowGMSRunner(false);
          }}
          onClose={() => setShowGMSRunner(false)}
        />
      )}

      {/* GAD-7 Runner Modal */}
      {showGAD7Runner && (
        <GAD7Runner
          onSave={(data) => {
            setGAD7Data(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowGAD7Runner(false);
          }}
          onClose={() => setShowGAD7Runner(false)}
        />
      )}

      {/* PHQ-9 Runner Modal */}
      {showPHQ9Runner && (
        <PHQ9Runner
          onSave={(data) => {
            setPHQ9Data(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowPHQ9Runner(false);
          }}
          onClose={() => setShowPHQ9Runner(false)}
        />
      )}

      {/* Arm Curl Runner Modal */}
      {showArmCurlRunner && (
        <ArmCurlRunner
          client={selectedClient || client}
          onSave={(data) => {
            setArmCurlData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowArmCurlRunner(false);
          }}
          onClose={() => setShowArmCurlRunner(false)}
        />
      )}

      {/* K10 Runner Modal */}
      {showK10Runner && (
        <K10Runner
          onSave={(data) => {
            setK10Data(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowK10Runner(false);
          }}
          onClose={() => setShowK10Runner(false)}
        />
      )}

      {/* 4-Stage Balance Runner Modal */}
      {showFourStageBalanceRunner && (
        <FourStageBalanceRunner
          onSave={(data) => {
            setFourStageBalanceData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowFourStageBalanceRunner(false);
          }}
          onClose={() => setShowFourStageBalanceRunner(false)}
        />
      )}

      {/* HOOS Runner Modal */}
      {showHOOSRunner && (
        <HOOSRunner
          onSave={(data) => {
            setHOOSData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowHOOSRunner(false);
          }}
          onClose={() => setShowHOOSRunner(false)}
        />
      )}

      {/* KOOS Runner Modal */}
      {showKOOSRunner && (
        <KOOSRunner
          onSave={(data) => {
            setKOOSData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowKOOSRunner(false);
          }}
          onClose={() => setShowKOOSRunner(false)}
        />
      )}

      {/* Pediatric Balance Scale Runner Modal */}
      {showPediatricBalanceRunner && (
        <PediatricBalanceRunner
          onSave={(data) => {
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date,
              additional_data: {
                ...prev.additional_data,
                pbs_data: data
              }
            }));
            setShowPediatricBalanceRunner(false);
          }}
          onClose={() => setShowPediatricBalanceRunner(false)}
        />
      )}

      {/* 10-Second Repeated Jump Test Runner Modal */}
      {showRepeatedJumpRunner && (
        <RepeatedJumpRunner
          onSave={(data) => {
            setRepeatedJumpData({
              result_value: data.result_value,
              best_rsi: data.best_rsi,
              average_rsi: data.average_rsi,
              total_jumps: data.total_jumps,
              jumps: data.jumps,
              additional_data: {
                measurement_type: '10_second_repeated_jump',
                total_jumps: data.total_jumps,
                jumps: data.jumps,
                best_rsi: data.best_rsi,
                average_rsi: data.average_rsi,
                average_flight_time_ms: data.average_flight_time_ms || (data.jumps.length > 0 ? Math.round(data.jumps.reduce((sum, j) => sum + j.flight_time_ms, 0) / data.jumps.length) : 0),
                average_contact_time_ms: data.average_contact_time_ms || (data.jumps.length > 0 ? Math.round(data.jumps.reduce((sum, j) => sum + j.contact_time_ms, 0) / data.jumps.length) : 0),
                jump_heights_cm: data.jump_heights_cm || data.jumps.filter(j => j.jump_height_cm).map(j => j.jump_height_cm),
                fatigue_index: data.fatigue_index !== null ? data.fatigue_index : (data.jumps.filter(j => j.jump_height_cm).length > 1 ? 
                  parseFloat(((Math.max(...data.jumps.filter(j => j.jump_height_cm).map(j => j.jump_height_cm)) - Math.min(...data.jumps.filter(j => j.jump_height_cm).map(j => j.jump_height_cm))) / Math.max(...data.jumps.filter(j => j.jump_height_cm).map(j => j.jump_height_cm)) * 100).toFixed(1)) : null)
              }
            });
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes
            }));
            setShowRepeatedJumpRunner(false);
            toast.success("Jump test data saved! Complete the assessment to finalize.");
          }}
          onClose={() => setShowRepeatedJumpRunner(false)}
        />
      )}

      {/* CKCUEST Runner Modal */}
      {showCKCUESTRunner && (
        <CKCUESTRunner
          onSave={(data) => {
            setCKCUESTData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowCKCUESTRunner(false);
          }}
          onClose={() => setShowCKCUESTRunner(false)}
        />
      )}

      {/* 1RM Runner Modal */}
      {showOneRMRunner && (
        <OneRMRunner
          onSave={(data) => {
            setOneRMData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowOneRMRunner(false);
          }}
          onClose={() => setShowOneRMRunner(false)}
        />
      )}

      {/* Isometric Strength Runner Modal */}
      {showIsometricRunner && (
        <IsometricStrengthRunner
          onSave={(data) => {
            setIsometricData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowIsometricRunner(false);
          }}
          onClose={() => setShowIsometricRunner(false)}
        />
      )}

      {/* Isokinetics Runner Modal */}
      {showIsokineticsRunner && (
        <IsokineticsRunner
          onSave={(data) => {
            setIsokineticsData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowIsokineticsRunner(false);
          }}
          onClose={() => setShowIsokineticsRunner(false)}
        />
      )}

      {/* Special Tests Runner Modal */}
      {showSpecialTestsRunner && (
        <SpecialTestsRunner
          testName={assessment.name}
          onSave={(data) => {
            setSpecialTestData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowSpecialTestsRunner(false);
          }}
          onClose={() => setShowSpecialTestsRunner(false)}
        />
      )}

      {/* SLR Runner Modal */}
      {showSLRRunner && (
        <SLRRunner
          onSave={(data) => {
            setSLRData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowSLRRunner(false);
          }}
          onClose={() => setShowSLRRunner(false)}
        />
      )}

      {/* Slump Runner Modal */}
      {showSlumpRunner && (
        <SlumpRunner
          onSave={(data) => {
            setSlumpData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowSlumpRunner(false);
          }}
          onClose={() => setShowSlumpRunner(false)}
        />
      )}

      {/* Knee Stability Runner Modal */}
      {showKneeStabilityRunner && (
        <KneeStabilityRunner
          testType={
            isLachman() ? "Lachman" :
            isAnteriorDrawer() ? "Anterior Drawer" :
            isPivotShift() ? "Pivot Shift" :
            isMcMurray() ? "McMurray's" : ""
          }
          onSave={(data) => {
            setKneeStabilityData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowKneeStabilityRunner(false);
          }}
          onClose={() => setShowKneeStabilityRunner(false)}
        />
      )}

      {/* Thessaly Runner Modal */}
      {showThessalyRunner && (
        <ThessalyRunner
          onSave={(data) => {
            setThessalyData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowThessalyRunner(false);
          }}
          onClose={() => setShowThessalyRunner(false)}
        />
      )}

      {/* Apley's Runner Modal */}
      {showApleysRunner && (
        <ApleysRunner
          onSave={(data) => {
            setApleysData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowApleysRunner(false);
          }}
          onClose={() => setShowApleysRunner(false)}
        />
      )}

      {/* Noble Runner Modal */}
      {showNobleRunner && (
        <NobleRunner
          onSave={(data) => {
            setNobleData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowNobleRunner(false);
          }}
          onClose={() => setShowNobleRunner(false)}
        />
      )}

      {/* Bruce Protocol Runner Modal */}
      {showBruceRunner && (
        <BruceProtocolRunner
          isModified={isModifiedBruce()}
          onSave={(data) => {
            setBruceData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowBruceRunner(false);
          }}
          onClose={() => setShowBruceRunner(false)}
        />
      )}

      {/* Cycle Protocol Runner Modal */}
      {showCycleRunner && (
        <CycleProtocolRunner
          protocol={
            isYMCACycle() ? 'YMCA' :
            isAstrandCycle() ? 'Astrand' :
            isWingate() ? 'Wingate' : 'YMCA'
          }
          onSave={(data) => {
            setCycleData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowCycleRunner(false);
          }}
          onClose={() => setShowCycleRunner(false)}
        />
      )}

      {/* Two Minute Walk Runner */}
      {showTwoMinWalkRunner && (
        <TwoMinuteWalkRunner
          onSave={(data) => {
            setTwoMinWalkData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowTwoMinWalkRunner(false);
          }}
          onClose={() => setShowTwoMinWalkRunner(false)}
        />
      )}

      {/* Cooper Test Runner */}
      {showCooperRunner && (
        <CooperTestRunner
          onSave={(data) => {
            setCooperData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowCooperRunner(false);
          }}
          onClose={() => setShowCooperRunner(false)}
        />
      )}

      {/* Beep Test Runner */}
      {showBeepRunner && (
        <BeepTestRunner
          onSave={(data) => {
            setBeepData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowBeepRunner(false);
          }}
          onClose={() => setShowBeepRunner(false)}
        />
      )}

      {/* Yo-Yo Test Runner */}
      {showYoYoRunner && (
        <YoYoTestRunner
          onSave={(data) => {
            setYoYoData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowYoYoRunner(false);
          }}
          onClose={() => setShowYoYoRunner(false)}
        />
      )}

      {/* 30-15 IFT Runner */}
      {showThirtyFifteenRunner && (
        <ThirtyFifteenIFTRunner
          onSave={(data) => {
            setThirtyFifteenData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            // Do NOT auto-close - let user see the save confirmation and close manually
          }}
          onClose={() => setShowThirtyFifteenRunner(false)}
        />
      )}

      {/* RSA Runner */}
      {showRSARunner && (
        <RSARunner
          testName={assessment.name}
          onSave={(data) => {
            setRSAData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowRSARunner(false);
          }}
          onClose={() => setShowRSARunner(false)}
        />
      )}

      {/* HRR Runner */}
      {showHRRRunner && (
        <HRRRunner
          onSave={(data) => {
            setHRRData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowHRRRunner(false);
          }}
          onClose={() => setShowHRRRunner(false)}
        />
      )}

      {/* VO2max GXT Runner */}
      {showVO2maxGXTRunner && (
        <VO2maxGXTRunner
          onSave={(data) => {
            setVO2maxGXTData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowVO2maxGXTRunner(false);
          }}
          onClose={() => setShowVO2maxGXTRunner(false)}
        />
      )}

      {/* HbA1c Runner */}
      {showHbA1cRunner && (
        <HbA1cRunner
          onSave={(data) => {
            setHbA1cData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowHbA1cRunner(false);
          }}
          onClose={() => setShowHbA1cRunner(false)}
        />
      )}

      {/* Lipid Profile Runner */}
      {showLipidProfileRunner && (
        <LipidProfileRunner
          client={selectedClient || client}
          onSave={(data) => {
            setLipidProfileData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowLipidProfileRunner(false);
          }}
          onClose={() => setShowLipidProfileRunner(false)}
        />
      )}

      {/* MET Calculation Runner */}
      {showMETCalcRunner && (
        <METCalculationRunner
          onSave={(data) => {
            setMETCalcData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowMETCalcRunner(false);
          }}
          onClose={() => setShowMETCalcRunner(false)}
        />
      )}

      {/* 6-Minute Step Runner */}
      {showSixMinStepRunner && (
        <SixMinuteStepRunner
          onSave={(data) => {
            setSixMinStepData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowSixMinStepRunner(false);
          }}
          onClose={() => setShowSixMinStepRunner(false)}
        />
      )}

      {/* PPT Runner */}
      {showPPTRunner && (
        <PPTRunner
          onSave={(data) => {
            setPPTData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowPPTRunner(false);
          }}
          onClose={() => setShowPPTRunner(false)}
        />
      )}

      {/* CB&M Runner */}
      {showCBMRunner && (
        <CBMRunner
          onSave={(data) => {
            setCBMData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowCBMRunner(false);
          }}
          onClose={() => setShowCBMRunner(false)}
        />
      )}

      {/* BESTest Runner */}
      {showBESTestRunner && (
        <BESTestRunner
          onSave={(data) => {
            setBESTestData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowBESTestRunner(false);
          }}
          onClose={() => setShowBESTestRunner(false)}
        />
      )}

      {/* EMS Runner */}
      {showEMSRunner && (
        <EMSRunner
          onSave={(data) => {
            setEMSData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowEMSRunner(false);
          }}
          onClose={() => setShowEMSRunner(false)}
        />
      )}

      {/* YMCA 3-Minute Step Test Runner */}
      {showYMCA3MinStepRunner && (
        <YMCA3MinStepRunner
          client={selectedClient || client}
          onSave={(data) => {
            setYMCA3MinStepData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowYMCA3MinStepRunner(false);
          }}
          onClose={() => setShowYMCA3MinStepRunner(false)}
        />
      )}

      {/* DGI Runner */}
      {showDGIRunner && (
        <DynamicGaitIndexRunner
          onSave={(data) => {
            setDGIData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowDGIRunner(false);
          }}
          onClose={() => setShowDGIRunner(false)}
        />
      )}

      {/* Rockport Walk Test Runner */}
      {showRockportRunner && (
        <RockportWalkRunner
          client={selectedClient || client}
          onSave={(data) => {
            setRockportData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowRockportRunner(false);
          }}
          onClose={() => setShowRockportRunner(false)}
        />
      )}

      {/* Ten Meter Walk Test Runner */}
      {showTenMeterWalkRunner && (
        <TenMeterWalkRunner
          onSave={(data) => {
            setTenMeterWalkData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowTenMeterWalkRunner(false);
          }}
          onClose={() => setShowTenMeterWalkRunner(false)}
        />
      )}

      {/* DASS-21 Runner */}
      {showDASS21Runner && (
        <DASS21Runner
          client={selectedClient || client}
          onSave={(data) => {
            setDASS21Data(data.additional_data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowDASS21Runner(false);
          }}
          onClose={() => setShowDASS21Runner(false)}
        />
      )}

      {/* HADS Runner */}
      {showHADSRunner && (
        <HADSRunner
          onSave={(data) => {
            setHadsData(data.additional_data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowHADSRunner(false);
          }}
          onClose={() => setShowHADSRunner(false)}
        />
      )}

      {/* Clinical Frailty Scale Runner */}
      {showClinicalFrailtyScaleRunner && (
        <ClinicalFrailtyScaleRunner
          client={selectedClient || client}
          onSave={(data) => {
            setClinicalFrailtyScaleData(data.additional_data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowClinicalFrailtyScaleRunner(false);
            toast.success("Clinical Frailty Scale completed!");
          }}
          onClose={() => setShowClinicalFrailtyScaleRunner(false)}
        />
      )}

      {/* Vital Signs Runner */}
      {showVitalSignsRunner && (
        <VitalSignsRunner
          assessmentName={assessment.name}
          onSave={(data) => {
            setVitalSignsData(data.additional_data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowVitalSignsRunner(false);
          }}
          onClose={() => setShowVitalSignsRunner(false)}
        />
      )}

      {/* Single Leg Stance Runner */}
      {showSingleLegStanceRunner && (
        <SingleLegStanceRunner
          onSave={(data) => {
            setSingleLegStanceData(data.additional_data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowSingleLegStanceRunner(false);
          }}
          onClose={() => setShowSingleLegStanceRunner(false)}
        />
      )}

      {/* Pain Scales Runner */}
      {showPainScalesRunner && (
        <PainScalesRunner
          onSave={(data) => {
            setPainScalesData(data.additional_data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowPainScalesRunner(false);
          }}
          onClose={() => setShowPainScalesRunner(false)}
        />
      )}

      {/* Body Measurements Runner */}
      {showBodyMeasurementsRunner && (
        <BodyMeasurementsRunner
          assessmentName={assessment.name}
          onSave={(data) => {
            setBodyMeasurementsData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowBodyMeasurementsRunner(false);
          }}
          onClose={() => setShowBodyMeasurementsRunner(false)}
        />
      )}

      {/* Gait Speed Runner */}
      {showGaitSpeedRunner && (
        <GaitSpeedRunner
          assessmentName={assessment.name}
          onSave={(data) => {
            setGaitSpeedData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowGaitSpeedRunner(false);
          }}
          onClose={() => setShowGaitSpeedRunner(false)}
        />
      )}

      {/* Show reminders after completing assessment */}
      {showReminders && (
        <AppointmentReminderModal
          client={client}
          lastAppointmentDate={new Date().toISOString()} // Use current date for reminder logic
          onClose={handleCloseReminders}
          onBookAppointment={(date) => {
            toast.success('Navigate to calendar to book the suggested appointment');
          }}
          onBookAssessment={(date) => {
            toast.success('Navigate to assessments to schedule the recommended assessment');
          }}
        />
      )}

      {/* IES-R Runner */}
      {showIESRRunner && (
        <ImpactofEventScaleRevisedIESRRunner
          client={selectedClient || client}
          onSave={(data) => {
            setIESRData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowIESRRunner(false);
          }}
          onClose={() => setShowIESRRunner(false)}
        />
      )}

      {/* PCL-5 Runner */}
      {showPCL5Runner && (
        <PTSDChecklistforDSM5PCL5Runner
          client={selectedClient || client}
          onSave={(data) => {
            setPCL5Data(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowPCL5Runner(false);
          }}
          onClose={() => setShowPCL5Runner(false)}
        />
      )}

      {/* ISI Runner */}
      {showISIRunner && (
        <InsomniaSeverityIndexISIRunner
          client={selectedClient || client}
          onSave={(data) => {
            setISIData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowISIRunner(false);
          }}
          onClose={() => setShowISIRunner(false)}
        />
      )}

      {/* MRC Dyspnea Runner */}
      {showMRCDyspneaRunner && (
        <MedicalResearchCouncilMRCDyspneaScaleRunner
          client={selectedClient || client}
          onSave={(data) => {
            setMRCDyspneaData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowMRCDyspneaRunner(false);
          }}
          onClose={() => setShowMRCDyspneaRunner(false)}
        />
      )}

      {/* CAT Runner */}
      {showCATRunner && (
        <COPDAssessmentTestCATRunner
          client={selectedClient || client}
          onSave={(data) => {
            setCATData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowCATRunner(false);
          }}
          onClose={() => setShowCATRunner(false)}
        />
      )}

      {/* CCQ Runner */}
      {showCCQRunner && (
        <ClinicalCOPDQuestionnaireCCQRunner
          client={selectedClient || client}
          onSave={(data) => {
            setCCQData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowCCQRunner(false);
          }}
          onClose={() => setShowCCQRunner(false)}
        />
      )}

      {/* LCQ Runner */}
      {showLCQRunner && (
        <LeicesterCoughQuestionnaireLCQRunner
          client={selectedClient || client}
          onSave={(data) => {
            setLCQData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowLCQRunner(false);
          }}
          onClose={() => setShowLCQRunner(false)}
        />
      )}

      {/* IKDC Runner */}
      {showIKDCRunner && (
        <InternationalKneeDocumentationCommitteeIKDCRunner
          client={selectedClient || client}
          onSave={(data) => {
            setIKDCData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowIKDCRunner(false);
          }}
          onClose={() => setShowIKDCRunner(false)}
        />
      )}

      {/* FIM Runner */}
      {showFIMRunner && (
        <FunctionalIndependenceMeasureFIMRunner
          client={selectedClient || client}
          onSave={(data) => {
            setFIMData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowFIMRunner(false);
          }}
          onClose={() => setShowFIMRunner(false)}
        />
      )}

      {/* Barthel Runner */}
      {showBarthelRunner && (
        <BarthelIndexRunner
          client={selectedClient || client}
          onSave={(data) => {
            setBarthelData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowBarthelRunner(false);
          }}
          onClose={() => setShowBarthelRunner(false)}
        />
      )}

      {/* Rivermead Runner */}
      {showRivermeadRunner && (
        <RivermeadMobilityIndexRunner
          client={selectedClient || client}
          onSave={(data) => {
            setRivermeadData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowRivermeadRunner(false);
          }}
          onClose={() => setShowRivermeadRunner(false)}
        />
      )}

      {/* RMDQ Runner */}
      {showRMDQRunner && (
        <RolandMorrisDisabilityQuestionnaireRunner
          client={selectedClient || client}
          onSave={(data) => {
            setRMDQData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowRMDQRunner(false);
          }}
          onClose={() => setShowRMDQRunner(false)}
        />
      )}

      {/* QuickDASH Runner */}
      {showQuickDASHRunner && (
        <QuickDASHRunner
          client={selectedClient || client}
          onSave={(data) => {
            setQuickDASHData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowQuickDASHRunner(false);
          }}
          onClose={() => setShowQuickDASHRunner(false)}
        />
      )}

      {/* FAAM Runner */}
      {showFAAMRunner && (
        <FootandAnkleAbilityMeasureFAAMRunner
          client={selectedClient || client}
          onSave={(data) => {
            setFAAMData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowFAAMRunner(false);
          }}
          onClose={() => setShowFAAMRunner(false)}
        />
      )}

      {/* ABC Scale Runner */}
      {showABCScaleRunner && (
        <ActivitiesspecificBalanceConfidenceABCScaleRunner
          client={selectedClient || client}
          onSave={(data) => {
            setABCScaleData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowABCScaleRunner(false);
          }}
          onClose={() => setShowABCScaleRunner(false)}
        />
      )}

      {/* Chalder Fatigue Runner */}
      {showChalderRunner && (
        <ChalderFatigueScaleRunner
          client={selectedClient || client}
          onSave={(data) => {
            setChalderData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowChalderRunner(false);
          }}
          onClose={() => setShowChalderRunner(false)}
        />
      )}

      {/* PSQI Runner */}
      {showPSQIRunner && (
        <PittsburghSleepQualityIndexPSQIRunner
          client={selectedClient || client}
          onSave={(data) => {
            setPSQIData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowPSQIRunner(false);
          }}
          onClose={() => setShowPSQIRunner(false)}
        />
      )}

      {/* SARC-F Runner */}
      {showSARCFRunner && (
        <SARCFQuestionnaireRunner
          client={selectedClient || client}
          onSave={(data) => {
            setSARCFData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowSARCFRunner(false);
          }}
          onClose={() => setShowSARCFRunner(false)}
        />
      )}

      {/* NDI Runner */}
      {showNDIRunner && (
        <NeckDisabilityIndexNDIRunner
          client={selectedClient || client}
          onSave={(data) => {
            setNDIData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowNDIRunner(false);
          }}
          onClose={() => setShowNDIRunner(false)}
        />
      )}

      {/* ODI Runner */}
      {showODIRunner && (
        <OswestryDisabilityIndexODIRunner
          client={selectedClient || client}
          onSave={(data) => {
            setODIData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowODIRunner(false);
          }}
          onClose={() => setShowODIRunner(false)}
        />
      )}

      {/* ASES Runner */}
      {showASESRunner && (
        <AmericanShoulderandElbowSurgeonsASESScoreRunner
          client={selectedClient || client}
          onSave={(data) => {
            setASESData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowASESRunner(false);
          }}
          onClose={() => setShowASESRunner(false)}
        />
      )}

      {/* DEXA Runner */}
      {showDEXARunner && (
        <DEXAScanResultsInterpretationRunner
          client={selectedClient || client}
          onSave={(data) => {
            setDEXAData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowDEXARunner(false);
          }}
          onClose={() => setShowDEXARunner(false)}
        />
      )}

      {/* Conley Scale Runner */}
      {showConleyRunner && (
        <ConleyScaleRunner
          client={selectedClient || client}
          onSave={(data) => {
            setConleyData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowConleyRunner(false);
          }}
          onClose={() => setShowConleyRunner(false)}
        />
      )}

      {/* PSS Runner */}
      {showPSSRunner && (
        <PerceivedStressScalePSSRunner
          client={selectedClient || client}
          onSave={(data) => {
            setPSSData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowPSSRunner(false);
          }}
          onClose={() => setShowPSSRunner(false)}
        />
      )}

      {/* Constant-Murley Runner */}
      {showConstantMurleyRunner && (
        <ConstantMurleyScoreRunner
          client={selectedClient || client}
          onSave={(data) => {
            setConstantMurleyData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowConstantMurleyRunner(false);
          }}
          onClose={() => setShowConstantMurleyRunner(false)}
        />
      )}

      {/* Lysholm Runner */}
      {showLysholmRunner && (
        <LysholmKneeScoreRunner
          client={selectedClient || client}
          onSave={(data) => {
            setLysholmData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShowLysholmRunner(false);
          }}
          onClose={() => setShowLysholmRunner(false)}
        />
      )}

      {/* ACL-RSI Runner */}
      {showACLRSIRunner && (
        <ACLRSIRunner
          client={selectedClient || client}
          onSave={(data) => {
            setACLRSIData(data);
            setShowACLRSIRunner(false);
          }}
          onClose={() => setShowACLRSIRunner(false)}
        />
      )}

      {/* GROC Runner */}
      {showGROCRunner && (
        <GlobalRatingofChangeScaleGROCRunner
          client={selectedClient || client}
          onSave={(data) => {
            setGROCData(data);
            setShowGROCRunner(false);
          }}
          onClose={() => setShowGROCRunner(false)}
        />
      )}

      {/* SGRQ Runner */}
      {showSGRQRunner && (
        <StGeorgesRespiratoryQuestionnaireSGRQRunner
          client={selectedClient || client}
          onSave={(data) => {
            setSGRQData(data);
            setShowSGRQRunner(false);
          }}
          onClose={() => setShowSGRQRunner(false)}
        />
      )}

      {/* FABQ Runner */}
      {showFABQRunner && (
        <FearAvoidanceBeliefsQuestionnaireFABQRunner
          client={selectedClient || client}
          onSave={(data) => {
            setFABQData(data);
            setShowFABQRunner(false);
          }}
          onClose={() => setShowFABQRunner(false)}
        />
      )}

      {/* Single Leg Hop Runner */}
      {showSingleLegHopRunner && (
        <SingleLegHopTestsRunner
          client={selectedClient || client}
          onSave={(data) => {
            setSingleLegHopData(data);
            setShowSingleLegHopRunner(false);
          }}
          onClose={() => setShowSingleLegHopRunner(false)}
        />
      )}

      {/* Drop Vertical Jump Runner */}
      {showDropVerticalJumpRunner && (
        <DropVerticalJumpRunner
          client={selectedClient || client}
          onSave={(data) => {
            setDropVerticalJumpData(data);
            setShowDropVerticalJumpRunner(false);
          }}
          onClose={() => setShowDropVerticalJumpRunner(false)}
        />
      )}

      {/* Vertical Jump Runner */}
      {showVerticalJumpRunner && (
        <VerticalJumpTestRunner
          client={selectedClient || client}
          onSave={(data) => {
            setVerticalJumpData(data);
            setShowVerticalJumpRunner(false);
          }}
          onClose={() => setShowVerticalJumpRunner(false)}
        />
      )}

      {showClockDrawingRunner && (<ClockDrawingTestRunner client={selectedClient || client} onSave={(data) => { setClockDrawingData(data); setShowClockDrawingRunner(false); }} onClose={() => setShowClockDrawingRunner(false)} />)}
      {showTMTRunner && (<TrailMakingTestTMTPartsAandBRunner client={selectedClient || client} onSave={(data) => { setTMTData(data); setShowTMTRunner(false); }} onClose={() => setShowTMTRunner(false)} />)}
      {showTinettiRunner && (<TinettiRunner client={selectedClient || client} onSave={(data) => { setTinettiData(data); setShowTinettiRunner(false); }} onClose={() => setShowTinettiRunner(false)} />)}

      {/* 6MWT Runner */}
      {show6MWTRunner && (
        <SixMinuteWalkRunner
          onSave={(data) => {
            setSixMWTData(data);
            setResult(prev => ({
              ...prev,
              notes: data.notes || prev.notes,
              assessment_date: data.assessment_date || prev.assessment_date
            }));
            setShow6MWTRunner(false);
          }}
          onClose={() => setShow6MWTRunner(false)}
        />
      )}

      {showNaughtonRunner && (<NaughtonTreadmillProtocolRunner client={selectedClient || client} onSave={(data) => { setNaughtonData(data); setResult(prev => ({ ...prev, notes: data.notes || prev.notes })); setShowNaughtonRunner(false); }} onClose={() => setShowNaughtonRunner(false)} />)}
      {showOneMinuteSitToStandRunner && (<OneMinuteSitToStandTestRunner client={selectedClient || client} onSave={(data) => { setChairStandData({ repetitions: data.result_value ?? data.repetitions, measurement_type: '1_minute_sit_to_stand', interpretation: data.interpretation || '', additional_data: data.additional_data, assessment_date: data.assessment_date }); setResult(prev => ({ ...prev, notes: data.notes || prev.notes })); setShowOneMinuteSitToStandRunner(false); }} onClose={() => setShowOneMinuteSitToStandRunner(false)} />)}

      {/* Modified Rankin Scale Runner */}
      {showModifiedRankinRunner && (<ModifiedRankinScaleRunner client={selectedClient || client} onSave={(data) => { setModifiedRankinData(data); setShowModifiedRankinRunner(false); }} onClose={() => setShowModifiedRankinRunner(false)} />)}

    </>
  );
}