import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Play, Save, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { saveAssessmentToSOAP } from './TestRunnerSOAPHelper';

// Specific runners
import QuestionnaireRunner from './QuestionnaireRunner';
import IllinoisAgilityTestRunner from './IllinoisAgilityTestRunner';
import TTestAgilityRunner from './TTestAgilityRunner';
import FiveOFiveAgilityTestRunner from './505AgilityTestRunner';
import HexagonAgilityTestRunner from './HexagonAgilityTestRunner';
import LTestofFunctionalMobilityRunner from './LTestofFunctionalMobilityRunner';
import FigureofEightWalkTestRunner from './FigureofEightWalkTestRunner';
import FallsEfficacyScaleInternationalFESIRunner from './FallsEfficacyScaleInternationalFESIRunner';
import BruininksOseretskyTestofMotorProficiencyBOT2Runner from './BruininksOseretskyTestofMotorProficiencyBOT2Runner';
import BioelectricalImpedanceAnalysisBIARunner from './BioelectricalImpedanceAnalysisBIARunner';
import BarthelIndexRunner from './BarthelIndexRunner';
import HydrostaticWeighingRunner from './HydrostaticWeighingRunner';
import FastingBloodGlucoseRunner from './FastingBloodGlucoseRunner';
import OralGlucoseToleranceTestOGTTRunner from './OralGlucoseToleranceTestOGTTRunner';
import RestingMetabolicRateRMRTestingRunner from './RestingMetabolicRateRMRTestingRunner';
import FallsEfficacyScaleFESRunner from './FallsEfficacyScaleFESRunner';
import BeightonHypermobilityScoreRunner from './BeightonHypermobilityScoreRunner';
import ChesterStepTestRunner from './ChesterStepTestRunner';
import EdmontonFrailScaleEFSRunner from './EdmontonFrailScaleEFSRunner';
import EnduranceShuttleWalkTestESWTRunner from './EnduranceShuttleWalkTestESWTRunner';
import FatigueSeverityScaleFSSRunner from './FatigueSeverityScaleFSSRunner';
import FibromyalgiaImpactQuestionnaireRevisedFIQRRunner from './FibromyalgiaImpactQuestionnaireRevisedFIQRRunner';
import ForcedVitalCapacityFVCSpirometryRunner from './ForcedVitalCapacityFVCSpirometryRunner';
import FunctionalAmbulationCategoriesFACRunner from './FunctionalAmbulationCategoriesFACRunner';
import FunctionalGaitAssessmentFGARunner from './FunctionalGaitAssessmentFGARunner';
import MaximalPushUpTestRunner from './MaximalPushUpTestRunner';
import McGillCoreEnduranceTestBatteryRunner from './McGillCoreEnduranceTestBatteryRunner';
import ModifiedAshworthScaleMASRunner from './ModifiedAshworthScaleMASRunner';
import ModifiedRankinScaleRunner from './ModifiedRankinScaleRunner';
import NineHolePegTestRunner from './NineHolePegTestRunner';
import PainCatastrophizingScalePCSRunner from './PainCatastrophizingScalePCSRunner';
import PeakExpiratoryFlowRatePEFRRunner from './PeakExpiratoryFlowRatePEFRRunner';
import PlankHoldTestRunner from './PlankHoldTestRunner';
import PushUpTestRunner from './PushUpTestRunner';
import SEBTRunner from './SEBTRunner';
import SF36HealthSurveyRunner from './SF36HealthSurveyRunner';
import ShortPhysicalPerformanceBatterySPPBRunner from './ShortPhysicalPerformanceBatterySPPBRunner';
import SquatTestDynamicRunner from './SquatTestDynamicRunner';
import StairClimbTestRunner from './StairClimbTestRunner';
import StaticBackExtensionBieringSrensenTestRunner from './StaticBackExtensionBieringSrensenTestRunner';
import StroopTestRunner from './StroopTestRunner';
import TandemStandBalanceTestRunner from './TandemStandBalanceTestRunner';
import TrendelenburgTestRunner from './TrendelenburgTestRunner';
import TripleHopTestRunner from './TripleHopTestRunner';
import WOMACRunner from './WOMACRunner';
import WidespreadPainIndexWPIandSymptomSeverityScaleSSSRunner from './WidespreadPainIndexWPIandSymptomSeverityScaleSSSRunner';
import IPAQRunner from './IPAQRunner';
import LEFSRunner from './LEFSRunner';
import GoalAttainmentScalingGASRunner from './GoalAttainmentScalingGASRunner';
import DigitSpanTestRunner from './DigitSpanTestRunner';
import DualTaskGaitAssessmentRunner from './DualTaskGaitAssessmentRunner';
import BilateralFlexibilityRunner from './BilateralFlexibilityRunner';
import MotorAssessmentScaleMASStrokeRunner from './MotorAssessmentScaleMASStrokeRunner';
import TardieuScaleRunner from './TardieuScaleRunner';
import PARQRunner from './PARQRunner';
import EDSSRunner from './EDSSRunner';
import StepTapTestRunner from './StepTapTestRunner';
import TecumsehStepTestRunner from './TecumsehStepTestRunner';
import YMCABenchPressTestRunner from './YMCABenchPressTestRunner';
import MedicineBallThrowRunner from './MedicineBallThrowRunner';
import GroovedPegboardTestRunner from './GroovedPegboardTestRunner';
import GroceryShelvingTestGSTRunner from './GroceryShelvingTestGSTRunner';
import StaticSquatTestWallSquatRunner from './StaticSquatTestWallSquatRunner';
import DEXAScanResultsInterpretationRunner from './DEXAScanResultsInterpretationRunner';
import HomestepTestRunner from './HomeStepTestRunner';
import PurduePegboardTestRunner from './PurduePegboardTestRunner';
import BoxandBlockTestRunner from './BoxandBlockTestRunner';
import ReactiveStrengthIndexRSIRunner from './ReactiveStrengthIndexRSIRunner';
import TriLevelArmErgometerTestRunner from './TriLevelArmErgometerTestRunner';
import BruceProtocolRunner from './BruceProtocolRunner';
import OneRMRunner from './OneRMRunner';
import { todayLocal } from "@/lib/localDate";
import ActivitiesspecificBalanceConfidenceABCScaleRunner from './ActivitiesspecificBalanceConfidenceABCScaleRunner';
import AQoLRunner from './AQoLRunner';
import BalkeWareTreadmillTestRunner from './BalkeWareTreadmillTestRunner';
import BREQRunner from './BREQRunner';
import DASHRunner from './DASHRunner';
import DePaulSymptomQuestionnaireDSQ2Runner from './DePaulSymptomQuestionnaireDSQ2Runner';
import COPDAssessmentTestCATRunner from './COPDAssessmentTestCATRunner';
import ClinicalCOPDQuestionnaireCCQRunner from './ClinicalCOPDQuestionnaireCCQRunner';
import LeicesterCoughQuestionnaireLCQRunner from './LeicesterCoughQuestionnaireLCQRunner';
import DistressThermometerRunner from './DistressThermometerRunner';
import FiveTimesSittoStandTest5xSTSRunner from './FiveTimesSittoStandTest5xSTSRunner';
import FootandAnkleAbilityMeasureFAAMRunner from './FootandAnkleAbilityMeasureFAAMRunner';
import FuglMeyerAssessmentFMARunner from './FuglMeyerAssessmentFMARunner';
import GirthMeasurementsRunner from './GirthMeasurementsRunner';
import HbA1cRunner from './HbA1cRunner';
import VitalSignsRunner from './VitalSignsRunner';
import IESRRunner from './IESRRunner';
import InsomniaSeverityIndexISIRunner from './InsomniaSeverityIndexISIRunner';
import InternationalKneeDocumentationCommitteeIKDCRunner from './InternationalKneeDocumentationCommitteeIKDCRunner';
import IsometricStrengthTestingRunner from './IsometricStrengthTestingRunner';
import IsometricStrengthRunner from './IsometricStrengthRunner';
import NeckDisabilityIndexNDIRunner from './NeckDisabilityIndexNDIRunner';
import ODIRunner from './ODIRunner';
import PSFSRunner from './PSFSRunner';
import PhysicalActivityScalefortheElderlyPASERunner from './PhysicalActivityScalefortheElderlyPASERunner';
import SPADIRunner from './SPADIRunner';
import TenSecondRepeatedJumpTestRunner from './10SecondRepeatedJumpTestRunner';
import TwelveMinuteWalkRunTestCooperRunner from './12MinuteWalkRunTestCooperRunner';
import OneRMTestingRunner from './1RepetitionMaximum1RMTestingRunner';
import TwentyMeterShuttleRunRunner from './20MeterShuttleRunBeepTestRunner';
import TwoMinuteWalkTest2MWTRunner from './2MinuteWalkTest2MWTRunner';
import ThreeOFifteenIntermittentFitnessTestRunner from './3015IntermittentFitnessTestRunner';
import ThirtySecondSittoStandTestRunner from './30SecondSittoStandTestRunner';
import FourHundredMeterWalkRunner from './400MeterWalkTestRunner';
import SixtySecondSittoStandTestRunner from './60SecondSittoStandTestRunner';
import SixMeterWalkTestSimpleRunner from './SixMeterWalkTestSimpleRunner';
import EightFootUpandGoRunner from './8FootUpandGoRunner';
import EightFootUpandGoTestRunner from './8FootUpandGoTestRunner';
import AirDisplacementPlethysmographyBodPodRunner from './AirDisplacementPlethysmographyBodPodRunner';
import AnteriorDrawerTestKneeRunner from './AnteriorDrawerTestKneeRunner';
import ApleysCompressionTestRunner from './ApleysCompressionTestRunner';
import Astrand6MinuteCycleTestRunner from './Astrand6MinuteCycleTestRunner';
import AstrandRhymingStepTestRunner from './AstrandRhymingStepTestRunner';
import AstrandTestRunner from './AstrandTestRunner';
import BESSRunner from './BESSRunner';
import BackScratchTestRunner from './BackScratchTestRunner';
import BalanceEvaluationSystemsTestBESTestRunner from './BalanceEvaluationSystemsTestBESTestRunner';
import BodyFatPercentageSkinfoldsRunner from './BodyFatPercentageSkinfoldsRunner';
import BodyMassIndexBMIRunner from './BodyMassIndexBMIRunner';
// BruceTreadmillProtocolRunner removed — consolidated into BruceProtocolRunner
import ChairSitandReachTestRunner from './ChairSitandReachTestRunner';
import ClosedKineticChainUpperExtremityStabilityTestCKCUESTRunner from './ClosedKineticChainUpperExtremityStabilityTestCKCUESTRunner';
import CommunityBalanceMobilityScaleCBMRunner from './CommunityBalanceMobilityScaleCBMRunner';
import ConleyScaleRunner from './ConleyScaleRunner';
import DynamicGaitIndexDGIRunner from './DynamicGaitIndexDGIRunner';
import ElderlyMobilityScaleEMSRunner from './ElderlyMobilityScaleEMSRunner';
import ElysTestRectusFemorisTightnessRunner from './ElysTestRectusFemorisTightnessRunner';
import FMSRunner from './FMSRunner';
import FourStageBalanceTestRunner from './FourStageBalanceTestRunner';
import FunctionalReachTestRunner from './FunctionalReachTestRunner';
import GAD7GeneralizedAnxietyDisorder7Runner from './GAD7GeneralizedAnxietyDisorder7Runner';
import HeightRunner from './HeightRunner';
import HighLevelMobilityAssessmentToolHiMATRunner from './HighLevelMobilityAssessmentToolHiMATRunner';
import HipOutcomeScoreHOOSRunner from './HipOutcomeScoreHOOSRunner';
import HospitalAnxietyandDepressionScaleHADSRunner from './HospitalAnxietyandDepressionScaleHADSRunner';
import IncrementalShuttleWalkTestISWTRunner from './IncrementalShuttleWalkTestISWTRunner';
import IsokineticDynamometryRunner from './IsokineticDynamometryRunner';
import JobTaskAnalysisJTARunner from './JobTaskAnalysisJTARunner';
import JobTaskAnalysisiCareForWorkCoverRunner from './JobTaskAnalysisiCareforWorkCoverRunner';
import KesslerPsychologicalDistressScaleK10Runner from './KesslerPsychologicalDistressScaleK10Runner';
import KneeInjuryandOsteoarthritisOutcomeScoreKOOSRunner from './KneeInjuryandOsteoarthritisOutcomeScoreKOOSRunner';
import LachmanTestRunner from './LachmanTestRunner';
import McMurraysTestRunner from './McMurraysTestRunner';
import MetabolicEquivalentMETCalculationRunner from './MetabolicEquivalentMETCalculationRunner';
import ModifiedBruceProtocolRunner from './ModifiedBruceProtocolRunner';
import NobleCompressionTestRunner from './NobleCompressionTestRunner';
import ObersTestITBTightnessRunner from './ObersTestITBTightnessRunner';
import PHQ9PatientHealthQuestionnaire9Runner from './PHQ9PatientHealthQuestionnaire9Runner';
import PROMISFatigueScaleShortForm8aRunner from './PROMISFatigueScaleShortForm8aRunner';
import PSS10Runner from './PSS10Runner';
import PatientSpecificFunctionalScalePSFSRunner from './PatientSpecificFunctionalScalePSFSRunner';
import PediatricBalanceScaleRunner from './PediatricBalanceScaleRunner';
import PhysicalPerformanceTestPPTRunner from './PhysicalPerformanceTestPPTRunner';
import PivotShiftTestRunner from './PivotShiftTestRunner';
import QuebecBackPainDisabilityScaleQBPDSRunner from './QuebecBackPainDisabilityScaleQBPDSRunner';
import RepeatedSprintAbilityTest10x20mRunner from './RepeatedSprintAbilityTest10x20mRunner';
import RepeatedSprintAbilityTest6x30mRunner from './RepeatedSprintAbilityTest6x30mRunner';
import RepeatedSprintAbilityTest7x35mRunner from './RepeatedSprintAbilityTest7x35mRunner';
import RepeatedSprintAbilityTestShuttle1515mRunner from './RepeatedSprintAbilityTestShuttle1515mRunner';
import Rockport1MileWalkTestRunner from './Rockport1MileWalkTestRunner';
import RombergsTestofStandingBalanceRunner from './RombergsTestofStandingBalanceRunner';
import ShoulderTugTestPastorsTestRunner from './ShoulderTugTestPastorsTestRunner';
import SingleLegStanceTestRunner from './SingleLegStanceTestRunner';
import SitandReachTestRunner from './SitandReachTestRunner';
import SixMinuteStepTestRunner from './SixMinuteStepTestRunner';
import SlumpTestRunner from './SlumpTestRunner';
import StandingStorkTestRunner from './StandingStorkTestRunner';
import StepTapTest15secondsRunner from './StepTapTest15secondsRunner';
import StepTestAerobicStepTestRunner from './StepTestAerobicStepTestRunner';
import StraightLegRaiseSLRRunner from './StraightLegRaiseSLRRunner';
import TenMetreWalkTest10MWTRunner from './TenMetreWalkTest10MWTRunner';
import ThessalyTestRunner from './ThessalyTestRunner';
import ThirtySecondChairStandTestRunner from './ThirtySecondChairStandTestRunner';
import ThomasTestHipFlexorTightnessRunner from './ThomasTestHipFlexorTightnessRunner';
import TimedPushUpTestPressUpTestRunner from './TimedPushUpTestPressUpTestRunner';
import TimedUpAndGoRunner from './TimedUpAndGoRunner';
import TimedUpandGoTUGRunner from './TimedUpandGoTUGRunner';
import TwoMinuteStepTestRunner from './TwoMinuteStepTestRunner';
import VO2maxTestingMaximalGradedExerciseTestGXTRunner from './VO2maxTestingMaximalGradedExerciseTestGXTRunner';
import VerticalJumpTestSargentJumpRunner from './VerticalJumpTestSargentJumpRunner';
import WaistCircumferenceRunner from './WaistCircumferenceRunner';
import WaisttoHipRatioWHRRunner from './WaisttoHipRatioWHRRunner';
import WeightRunner from './WeightRunner';
import WingateAnaerobicTestRunner from './WingateAnaerobicTestRunner';
import YMCA3MinuteStepTestRunner from './YMCA3MinuteStepTestRunner';
import YMCACycleErgometerProtocolRunner from './YMCACycleErgometerProtocolRunner';
import YoYoIntermittentRecoveryTestsRunner from './YoYoIntermittentRecoveryTestsRunner';
import ArmCurlRunner from './ArmCurlRunner';
import ChalderFatigueScaleRunner from './ChalderFatigueScaleRunner';
import VisualROMAssessmentRunner from './VisualROMAssessmentRunner';
import QuickDASHRunner from './QuickDASHRunner';
import RolandMorrisDisabilityQuestionnaireRunner from './RolandMorrisDisabilityQuestionnaireRunner';
import RivermadMobilityIndexRunner from './RivermadMobilityIndexRunner';
import PCL5Runner from './PCL5Runner';
import PittsburghSleepQualityIndexPSQIRunner from './PittsburghSleepQualityIndexPSQIRunner';
import RSARunner from './RSARunner';
import SARCFQuestionnaireRunner from './SARCFQuestionnaireRunner';
import StandingLongJumpRunner from './StandingLongJumpRunner';


// Thin adapters
function BruceProtocolRunnerAdapter({ client, onSave, onClose, testName }) {
  return <BruceProtocolRunner client={client} onSave={onSave} onClose={onClose} isModified={testName?.includes('Balke')} />;
}

function OneRMAdapterRunner({ client, onSave, onClose, label }) {
  return <OneRMRunner client={client} onSave={onSave} onClose={onClose} />;
}

// Detection helpers
function detect(name) {
  const n = name.toLowerCase();
  if (n.includes('barthel index') || n.includes('barthel')) return 'barthel';
  if (n.includes('five times sit') || n.includes('5x sit') || n.includes('5xsts') || (n.includes('5 times sit') && n.includes('stand'))) return '5xsts';
  if (n.includes('faam') || n.includes('foot and ankle ability measure')) return 'faam';
  if (n.includes('fugl-meyer') || n.includes('fugl meyer') || n.includes('fma') && n.includes('assessment')) return 'fma';
  if (n.includes('illinois agility')) return 'illinois';
  if (n.includes('t-test agility') || n === 't test agility') return 't_test';
  if (n.includes('505 agility') || n.includes('five-oh-five')) return '505';
  if (n.includes('hexagon agility')) return 'hexagon';
  if (n.includes('l test') && n.includes('mobility')) return 'l_test';
  if (n.includes('figure') && n.includes('eight') && n.includes('walk')) return 'figure8';
  if (n.includes('falls efficacy scale-international') || n.includes('fes-i')) return 'fesi';
  if (n.includes('falls efficacy scale') && !n.includes('international')) return 'fes';
  if (n.includes('bruininks') || n.includes('bot-2') || n.includes('bot2')) return 'bot2';
  if (n.includes('bioelectrical impedance') || (n.includes('bia') && !n.includes('scale'))) return 'bia';
  if (n.includes('tampa scale') || n.includes('kinesiophobia') || n.includes('tsk')) return 'tsk';
  if (n.includes('hydrostatic weighing') || n.includes('underwater weighing')) return 'hydrostatic';
  if (n.includes('fasting blood glucose')) return 'fasting_glucose';
  if (n.includes('oral glucose tolerance') || n.includes('ogtt')) return 'ogtt';
  if (n.includes('resting metabolic rate') || n.includes('rmr testing')) return 'rmr';
  if (n.includes('beighton') || n.includes('hypermobility score')) return 'beighton';
  if (n.includes('chester step')) return 'chester';
  if (n.includes('lefs') || n.includes('lower extremity functional scale')) return 'lefs';
  if (n.includes('edmonton frail') || n.includes('efs')) return 'efs';
  if (n.includes('endurance shuttle walk') || n.includes('eswt')) return 'eswt';
  if (n.includes('fatigue severity scale') || n.includes('fss')) return 'fss';
  if (n.includes('fibromyalgia impact') || n.includes('fiqr')) return 'fiqr';
  if (n.includes('forced vital capacity') || n.includes('fvc') || n.includes('spirometry')) return 'fvc';
  if (n.includes('functional ambulation') || n.includes('fac')) return 'fac';
  if (n.includes('functional gait assessment') || n.includes('fga')) return 'fga';
  if (n.includes('maximal push') || n.includes('maximum push')) return 'max_push';
  if (n.includes('mcgill core') || n.includes('biering-sorensen') || (n.includes('core endurance') && n.includes('battery'))) return 'mcgill';
  if (n.includes('modified ashworth') || (n.includes('mas') && n.includes('spasticity'))) return 'mas';
  if (n.includes('modified rankin')) return 'modified_rankin';
  if (n.includes('nine hole peg') || n.includes('nine-hole peg') || n.includes('9-hole peg') || n.includes('9 hole peg')) return 'nine_peg';
  if (n.includes('patient-specific functional') || n.includes('patient specific functional') || n.includes('psfs')) return 'psfs';
  if (n.includes('physical activity scale for the elderly') || n.includes('pase')) return 'pase';
  if (n.includes('pain catastrophizing') || n.includes('pcs')) return 'pcs';
  if (n.includes('peak expiratory flow') || n.includes('pefr') || n.includes('peak flow')) return 'pefr';
  if (n.includes('plank hold') || n.includes('plank test')) return 'plank';
  if (n.includes('timed push') || n.includes('press up test') || n.includes('press-up test')) return 'timed_push_up';
  if (n.includes('push up test') && !n.includes('timed')) return 'push_up';
  if (n.includes('sebt') || n.includes('star excursion')) return 'sebt';
  if (n.includes('sf-36') || n.includes('sf 36') || n.includes('36-item short form')) return 'sf36';
  if (n.includes('short physical performance battery') || n.includes('sppb')) return 'sppb';
  if (n.includes('static squat') || n.includes('wall squat')) return 'static_squat';
  if (n.includes('squat test') || n.includes('dynamic squat') || n.includes('overhead squat')) return 'squat';
  if (n.includes('stair climb')) return 'stair_climb';
  if (n.includes('static back extension') || (n.includes('biering') && n.includes('sorensen'))) return 'static_back';
  if (n.includes('stroop test') || n.includes('stroop color')) return 'stroop';
  if (n.includes('tandem stand balance') && !n.includes('semi')) return 'tandem_stand';
  if (n.includes('trendelenburg')) return 'trendelenburg';
  if (n.includes('triple hop')) return 'triple_hop';
  if (n.includes('womac')) return 'womac';
  if (n.includes('widespread pain index') || n.includes('wpi') || n.includes('symptom severity scale')) return 'wpi';
  if (n.includes('ipaq') || n.includes('international physical activity questionnaire')) return 'ipaq';
  if (n.includes('goal attainment scaling') || n.includes('gas scale')) return 'gas';
  if (n.includes('digit span')) return 'digit_span';
  if (n.includes('dual task gait') || n.includes('dual-task gait')) return 'dual_task_gait';
  if (n.includes('bilateral flexibility') || n.includes('passive hip')) return 'bilateral_flex';
  if (n.includes('motor assessment scale') && n.includes('stroke')) return 'mas_stroke';
  if (n.includes('tardieu') || n.includes('modified tardieu')) return 'tardieu';
  if (n.includes('par-q') || n.includes('parq') || n.includes('physical activity readiness')) return 'parq';
  if (n.includes('edss') || n.includes('expanded disability status')) return 'edss';
  if (n.includes('step tap test') || (n.includes('step tap') && n.includes('15'))) return 'step_tap';
  if (n.includes('home step test') || n.includes('two-minute home step')) return 'home_step';
  if (n.includes('tecumseh') || n.includes('3-minute step')) return 'tecumseh';
  if (n.includes('ymca bench press')) return 'ymca_bench';
  if (n.includes('medicine ball throw') || n.includes('seated medicine ball')) return 'med_ball';
  if (n.includes('grooved pegboard')) return 'grooved_peg';
  if (n.includes('grocery shelving') || n.includes('gst')) return 'gst';
  if (n.includes('purdue pegboard')) return 'purdue_peg';
  if (n.includes('box and block') && n.includes('test')) return 'box_block_test';
  if (n.includes('reactive strength index')) return 'rsi';
  if (n.includes('tri-level arm ergometer') || n.includes('tri level arm ergometer') || (n.includes('tri') && n.includes('arm ergometer'))) return 'tri_arm';
  if (n.includes('balke-ware') || n.includes('balke ware') || (n.includes('balke') && n.includes('treadmill'))) return 'balke';
  if (n.includes('ten repetition maximum') || n.includes('10rm') || n.includes('10 rm')) return '10rm';
  if (n.includes('abc scale') || (n.includes('activities-specific') && n.includes('balance confidence'))) return 'abc_scale';
  if (n.includes('aqol') || (n.includes('assessment of quality of life') && !n.includes('sf'))) return 'aqol';
  if (n.includes('breq') || n.includes('behavioural regulation in exercise') || n.includes('behavioral regulation in exercise')) return 'breq';
  if (n.includes('chronic respiratory disease') || n.includes('crdq')) return 'crdq';
  if ((n.includes('dash') && n.includes('full')) || (n.includes('disabilities of the arm') && !n.includes('quick'))) return 'dash';
  if (n.includes('copd assessment test') || (n.includes('cat') && n.includes('copd')) || n.trim() === 'cat') return 'cat';
  if (n.includes('10 second repeated jump') || n.includes('10-second repeated jump')) return '10sec_jump';
  if (n.includes('12-minute walk') || n.includes('12 minute walk') || (n.includes('cooper') && n.includes('walk'))) return '12min_walk';
  if (n.includes('1-repetition maximum') || n.includes('1 repetition maximum') || (n.includes('1rm') && n.includes('testing'))) return '1rm_testing';
  if (n.includes('20 meter shuttle') || n.includes('20-meter shuttle') || n.includes('20m shuttle')) return '20m_shuttle';
  if (n.includes('2-minute walk') || n.includes('2 minute walk') || n.includes('2mwt')) return '2min_walk';
  if (n.includes('30-15 intermittent') || n.includes('30/15 intermittent') || n.includes('3015')) return '3015_ift';
  if ((n.includes('30-second') || n.includes('30 second')) && n.includes('sit') && n.includes('stand') && !n.includes('chair stand')) return '30sec_sts';
  if (n.includes('400 meter walk') || n.includes('400-meter walk') || n.includes('400m walk')) return '400m_walk';
  if ((n.includes('60-second') || n.includes('60 second')) && n.includes('sit') && n.includes('stand')) return '60sec_sts';
  if (n.includes('6-meter walk') || n.includes('6 meter walk') || n.includes('6m walk') || n.includes('six meter walk')) return '6m_walk_simple';
  if (n.includes('8-foot up') || n.includes('8 foot up') || n.includes('8-ft up') || (n.includes('up and go') && n.includes('8'))) return '8ft_upgo';
  if (n.includes('air displacement plethysmography') || n.includes('bod pod')) return 'bod_pod';
  if (n.includes('anterior drawer') && n.includes('knee')) return 'anterior_drawer_knee';
  if (n.includes("apley") && n.includes('compression')) return 'apleys_compression';
  if (n.includes('astrand') && n.includes('6') && n.includes('cycle')) return 'astrand_6_cycle';
  if (n.includes('astrand') && n.includes('rhyming') && n.includes('step')) return 'astrand_rhyming_step';
  if (n.includes('astrand') && n.includes('rhyming')) return 'astrand_rhyming_cycle';
  if (n.includes('balance error scoring') || n.includes('bess') && n.includes('balance')) return 'bess';
  if (n.includes('back scratch test')) return 'back_scratch_test';
  if (n.includes('balance evaluation systems test') || (n.includes('bestest') && !n.includes('mini'))) return 'bestest_full';
  if (n.includes('body fat') && n.includes('skinfold')) return 'body_fat_skinfold';
  if (n.includes('body mass index') || n === 'bmi') return 'bmi_full';
  if (n.includes('bruce treadmill') && !n.includes('modified')) return 'bruce_treadmill';
  if (n.includes('chair sit and reach') || (n.includes('chair') && n.includes('sit') && n.includes('reach'))) return 'chair_sit_reach';
  if (n.includes('closed kinetic chain upper') || n.includes('ckcuest')) return 'ckcuest_full';
  if (n.includes('community balance') || n.includes('cb&m') || n.includes('cbm') && n.includes('mobility scale')) return 'cbm_full';
  if (n.includes('dynamic gait index') || n.includes('dgi') && n.includes('gait')) return 'dgi_full';
  if (n.includes('elderly mobility scale') || n.includes('ems') && n.includes('elderly')) return 'ems_full';
  if (n.includes("ely") && n.includes('rectus')) return 'elys_test';
  if (n.includes('functional movement screen') || n === 'fms') return 'fms_full';
  if ((n.includes('four-stage balance') || n.includes('four stage balance')) && !n.includes('four square')) return 'four_stage_balance_test';
  if (n.includes('functional reach test')) return 'functional_reach_test';
  if (n.includes('gad-7') || n.includes('gad7') || n.includes('generalized anxiety disorder 7') || (n.includes('anxiety disorder') && n.includes('7'))) return 'gad7_full';
  if (n === 'height' || n.includes('height measurement')) return 'height_measurement';
  if (n.includes('high-level mobility assessment') || n.includes('himat') && n.includes('high')) return 'himat_full';
  if (n.includes('hip outcome score') || n.includes('hoos') && n.includes('hip')) return 'hoos_full';
  if (n.includes('hospital anxiety and depression') || n.includes('hads') && n.includes('hospital')) return 'hads_full';
  if (n.includes('incremental shuttle walk') || n.includes('iswt') && n.includes('incremental')) return 'iswt_full';
  if (n.includes('isokinetic dynamometry')) return 'isokinetic_dyn';
  if (n.includes('job task analysis') && n.includes('icare')) return 'jta_icare';
  if (n.includes('job task analysis') && !n.includes('icare')) return 'jta_full';
  if (n.includes('kessler') || (n.includes('k10') && n.includes('distress'))) return 'k10_full';
  if (n.includes('knee injury') && n.includes('osteoarthritis') && n.includes('outcome') || n.includes('koos') && n.includes('knee injury')) return 'koos_full';
  if (n.includes('lachman test')) return 'lachman_test';
  if (n.includes("mcmurray") || n.includes("mcmurrays")) return 'mcmurrays_test';
  if (n.includes('metabolic equivalent') && n.includes('met') && n.includes('calculation')) return 'met_calc_full';
  if (n.includes('modified bruce')) return 'modified_bruce';
  if (n.includes('noble compression')) return 'noble_compression';
  if (n.includes("ober") && n.includes('itb')) return 'obers_test';
  if (n.includes('phq-9') || n.includes('phq9') || (n.includes('patient health questionnaire') && n.includes('9'))) return 'phq9_full';
  if (n.includes('promis fatigue') || n.includes('promis') && n.includes('fatigue')) return 'promis_fatigue';
  if (n.includes('perceived stress scale') && !n.includes('pss-10') && n.includes('pss') || n === 'pss-10' || n.includes('pss-10')) return 'pss10_full';
  if (n.includes('patient-specific functional scale') || n.includes('patient specific functional scale') && !n.includes('psfs')) return 'psfs_full';
  if (n.includes('pediatric balance scale') || n.includes('paediatric balance scale')) return 'pediatric_balance';
  if (n.includes('physical performance test') && n.includes('ppt')) return 'ppt_full';
  if (n.includes('pivot shift')) return 'pivot_shift';
  if (n.includes('quebec back pain') || n.includes('qbpds')) return 'qbpds';
  if (n.includes('roland-morris') || n.includes('roland morris') || n.includes('rdq')) return 'roland';
  if (n.includes('rivermead mobility index') || n.includes('rivermead mobility') || n.includes('rmi') && n.includes('rivermead')) return 'rivermead_mobility';
  if (n.includes('repeated sprint') && n.includes('10') && n.includes('20')) return 'rsa_10x20';
  if (n.includes('repeated sprint') && n.includes('6') && n.includes('30')) return 'rsa_6x30';
  if (n.includes('repeated sprint') && n.includes('7') && n.includes('35')) return 'rsa_7x35';
  if (n.includes('repeated sprint') && n.includes('shuttle') && (n.includes('15') || n.includes('15+15'))) return 'rsa_shuttle';
  if (n.includes('repeated sprint') || n.includes('rsa') && n.includes('sprint')) return 'rsa_generic';
  if (n.includes('rockport') && n.includes('1') && n.includes('mile')) return 'rockport_1mile';
  if (n.includes("romberg") && n.includes('standing balance')) return 'rombergs_standing';
  if (n.includes('shoulder tug test') || n.includes("pastor") && n.includes('test')) return 'shoulder_tug';
  if (n.includes('single-leg stance test') || n.includes('single leg stance test')) return 'single_leg_stance_test';
  if (n.includes('sit and reach test') && !n.includes('chair')) return 'sit_reach_test';
  if (n.includes('6-minute step') || n.includes('6 minute step') || n.includes('six minute step')) return 'six_min_step_test';
  if (n.includes('slump test')) return 'slump_test';
  if (n.includes('standing stork test')) return 'standing_stork';
  if (n.includes('step tap test') && n.includes('15')) return 'step_tap_15';
  if (n.includes('step test') && n.includes('aerobic')) return 'aerobic_step';
  if (n.includes('straight leg raise') || n.includes('slr') && n.includes('straight')) return 'slr_test';
  if (n.includes('10-metre walk') || n.includes('10 metre walk') || n.includes('10mwt') || (n.includes('10m walk') && !n.includes('6'))) return 'ten_metre_walk';
  if (n.includes('thessaly test')) return 'thessaly_test';
  if ((n.includes('30-second chair') || n.includes('30 second chair')) && n.includes('stand')) return 'thirty_sec_chair';
  if (n.includes('thomas test') && n.includes('hip')) return 'thomas_test';
  if (n.includes('timed push-up') || n.includes('timed push up') || n.includes('press-up test') || n.includes('press up test')) return 'timed_push_up';
  if (n.includes('timed up and go') && !n.includes('dual')) return 'tug_full';
  if (n.includes('two-minute step') || n.includes('2-minute step') || n.includes('two minute step') || n.includes('2 minute step')) return 'two_min_step';
  if (n.includes('vo2max') && n.includes('graded exercise') || n.includes('maximal graded exercise') || n.includes('gxt') && n.includes('vo2')) return 'vo2max_gxt_full';
  if (n.includes('vertical jump') && n.includes('sargent')) return 'sargent_jump';

  if (n.includes('waist circumference') && !n.includes('hip')) return 'waist_circ';
  if ((n.includes('waist') && n.includes('hip ratio')) || n.includes('whr') && n.includes('waist')) return 'whr_full';
  if (n === 'weight' || n.includes('weight assessment') || n.includes('weight measurement')) return 'weight_measure';
  if (n.includes('wingate anaerobic') || n.includes('wingate test')) return 'wingate';
  if (n.includes('ymca') && n.includes('3') && n.includes('minute') && n.includes('step')) return 'ymca_3min_step';
  if (n.includes('ymca') && n.includes('cycle ergometer')) return 'ymca_cycle';
  if (n.includes('yo-yo intermittent') || n.includes('yoyo intermittent') || n.includes('yo yo intermittent')) return 'yoyo_intermittent';
  if (n.includes('y-balance') || n.includes('y balance') || n.includes('ybts') || n.includes('y balance test')) return null; // Y-Balance Test removed
  if (n.includes('standing long jump') || n.includes('broad jump') || n.includes('standing broad jump')) return 'standing_long_jump';
  if (n.includes('depaul') || n.includes('dsq-2') || n.includes('dsq2') || (n.includes('symptom questionnaire') && n.includes('dsq'))) return 'dsq2';
  if (n.includes('clinical copd questionnaire') || n.includes('ccq')) return 'ccq';
  if (n.includes('leicester cough') || n.includes('lcq')) return 'lcq';
  if (n.includes('distress thermometer') || n.includes('distress thermometre')) return 'distress_thermometer';
  if (n.includes('impact of event') || n.includes('ies-r') || n.includes('iesr')) return 'iesr';
  if (n.includes('insomnia severity') || n.includes('isi')) return 'isi';
  if (n.includes('international knee') || n.includes('ikdc') || n.includes('knee documentation')) return 'ikdc';
  if (n.includes('girth measurement') || n.includes('girth measures') || n.includes('circumference measurement')) return 'girth';
  if (n.includes('hba1c') || n.includes('hb a1c') || n.includes('glycated hemoglobin') || n.includes('glycated haemoglobin')) return 'hba1c';
  if (n.includes('isometric strength testing') || (n.includes('isometric') && n.includes('strength') && n.includes('testing'))) return 'isometric_testing';
  if (n.includes('isometric strength') && !n.includes('testing')) return 'isometric_strength';
  if (n.includes('neck disability index') || n.includes('ndi') && n.includes('neck')) return 'ndi';
  if (n.includes('oswestry') || (n.includes('odi') && !n.includes('modified'))) return 'odi';
  if (n.includes('spadi') || n.includes('shoulder pain and disability index')) return 'spadi';
  if (n.includes('blood pressure') || n.includes('bp')) return 'blood_pressure';
  if (n.includes('heart rate') && (n.includes('pre') || n.includes('post') || n.includes('exercise') || n.includes('recovery'))) return 'heart_rate';
  if (n.includes('oxygen saturation') || n.includes('spo2') || n.includes('sp o2')) return 'spo2';
  if (n.includes('vital sign')) return 'vital_signs';
  if (n.includes('conley') || (n.includes('conley') && n.includes('scale'))) return 'conley_scale';
  if (n.includes('arm curl') || n.includes('bicep curl') || n.includes('30-second arm') || n.includes('30 second arm') || n.includes('30s arm') || n.includes('30s bicep')) return 'arm_curl';
  if (n.includes('chalder fatigue') || n.includes('chalder') && n.includes('fatigue')) return 'chalder_fatigue';
  if (n.includes('visual rom') || n.includes('visual range of motion')) return 'visual_rom';
  if (n.includes('quickdash') || n.includes('quick dash') || (n.includes('quick') && n.includes('dash'))) return 'quick_dash';
  if (n.includes('pcl-5') || n.includes('pcl5') || n.includes('ptsd checklist')) return 'pcl5';
  if (n.includes('pittsburgh sleep') || n.includes('psqi')) return 'psqi';
  if (n.includes('sarc-f') || n.includes('sarcf') || (n.includes('sarc') && n.includes('questionnaire'))) return 'sarc_f';
  return null;
  }

export function canHandleAssessment(assessmentName) {
  return detect(assessmentName) !== null;
}

export default function TestRunnerExtras({ client, assessment, clientAssessment, onClose, onComplete, isStandaloneMode = false, clinicianNotes }) {
  const appointmentId = new URLSearchParams(window.location.search).get('appointmentId');
  const [runnerData, setRunnerData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRunner, setShowRunner] = useState(true);
  const [notes, setNotes] = useState(clientAssessment?.notes || "");
  const [barriers, setBarriers] = useState(clientAssessment?.barriers || "");
  const [assessmentDate, setAssessmentDate] = useState(clientAssessment?.assessment_date || todayLocal());

  const [selectedClient, setSelectedClient] = useState(client);
  const [allClients, setAllClients] = useState([]);

  useEffect(() => {
    if (isStandaloneMode) {
      const loadClients = async () => {
        try {
          const user = await base44.auth.me();
          const orgs = await base44.entities.OrganizationMember.filter({ user_email: user.email });
          if (orgs.length > 0) {
            const clients = await base44.entities.Client.filter({ org_id: orgs[0].org_id });
            setAllClients(clients);
          }
        } catch (e) {}
      };
      loadClients();
    }
  }, [isStandaloneMode]);

  const handleRunnerSave = async (data) => {
    if (!data) { toast.error("No data to save"); return; }
    
    setRunnerData(data);
    if (data.notes) setNotes(data.notes);
    if (data.assessment_date) setAssessmentDate(data.assessment_date);

    // Runners that have their own complete UI (like PPT) should auto-submit without showing the confirmation step
    const autoSubmitTypes = ['ppt_full', 'psqi', 'standing_long_jump', 'standing_stork', 'stroop', 'trendelenburg', '2min_walk', 'rivermead_mobility'];
    const currentTestType = detect(assessment.name);
    if (autoSubmitTypes.includes(currentTestType)) {
      // Auto-submit directly
      const clientToUse = selectedClient || client;
      if (!clientToUse) { toast.error("Please select a client."); return; }
      setIsSubmitting(true);
      try {
        let assessmentToUpdate = clientAssessment;
        if (!assessmentToUpdate?.id && clientToUse) {
          assessmentToUpdate = await base44.entities.ClientAssessment.create({
            org_id: clientToUse.org_id, client_id: clientToUse.id,
            assessment_id: assessment.id, status: 'pending',
            assessment_date: data.assessment_date || todayLocal()
          });
        }
        
        if (!assessmentToUpdate?.id) {
          throw new Error("Failed to get assessment record ID");
        }

        const parsedResult = typeof data.result_value === 'string' ? parseFloat(data.result_value) : data.result_value;
        const resultValue = (typeof parsedResult === 'number' && !isNaN(parsedResult)) ? parsedResult : null;
        const updateData = {
          status: 'completed', result_value: resultValue,
          notes: data.notes || '', barriers: '',
          assessment_date: data.assessment_date || todayLocal(),
          additional_data: data.additional_data || {},
          appointment_id: appointmentId || clientAssessment?.appointment_id
        };
        if (data.additional_data?.soap_text) updateData.additional_data.soap_text = data.additional_data.soap_text;
        
        await base44.entities.ClientAssessment.update(assessmentToUpdate.id, updateData);
        
        const rawDs = updateData.assessment_date;
        const dp = rawDs.split('-').map(Number);
        const today = (dp.length === 3 && !isNaN(dp[0]) && dp[0] > 1900) ? new Date(dp[0], dp[1]-1, dp[2]) : new Date();
        const dateStr = today.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const soapContent = data?.additional_data?.soap_text;
        const resultText = resultValue !== null && resultValue !== undefined ? resultValue : 'Assessment recorded';
        let objectiveText = soapContent ? `Assessment completed on ${dateStr}:\n\n${soapContent}` : `Assessment completed on ${dateStr}:\n\n• ${assessment.name}: ${resultText}`;
        if (clinicianNotes && clinicianNotes.trim()) { objectiveText += `\n\nClinician Notes (recorded during assessment):\n${clinicianNotes.trim()}`; }
        
        try {
          await saveAssessmentToSOAP({ clientToUse, appointmentId: appointmentId || assessmentToUpdate?.appointment_id, objectiveText, assessmentToUpdateId: assessmentToUpdate.id, updateData });
        } catch (soapError) { console.error("SOAP note error:", soapError); }
        
        toast.success("Assessment saved successfully!");
        if (onComplete) onComplete(updateData);
        onClose();
      } catch (error) {
        console.error("Auto-submit save error:", error?.message || error);
        toast.error("Failed to save assessment: " + (error?.message || "Unknown error"));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setShowRunner(false);
  };

  const handleSubmit = async () => {
    const clientToUse = selectedClient || client;
    if (!clientToUse) {
      toast.error("Please select a client.");
      return;
    }

    if (!runnerData) {
      toast.error("Please complete the assessment before saving.");
      setShowRunner(true);
      return;
    }

    setIsSubmitting(true);
    try {
       let assessmentToUpdate = clientAssessment;
       if (!assessmentToUpdate?.id && clientToUse) {
         assessmentToUpdate = await base44.entities.ClientAssessment.create({
           org_id: clientToUse.org_id,
           client_id: clientToUse.id,
           assessment_id: assessment.id,
           status: 'pending',
           assessment_date: assessmentDate
         });
       }

       if (!assessmentToUpdate?.id) {
         throw new Error("Failed to get or create assessment record");
       }

       const rawResult = runnerData.result_value;
       const parsedResult = typeof rawResult === 'string' ? parseFloat(rawResult) : rawResult;

       const updateData = {
         status: 'completed',
         result_value: isNaN(parsedResult) ? null : parsedResult,
         notes: notes || runnerData.notes,
         barriers,
         assessment_date: assessmentDate,
         additional_data: runnerData.additional_data || {},
         appointment_id: appointmentId || clientAssessment?.appointment_id
       };

      // Format ISI responses into SOAP-friendly text if not already formatted
      if (testType === 'isi' && runnerData.additional_data?.responses && !runnerData.additional_data?.soap_text) {
        const isiQuestions = [
          'Difficulty falling asleep',
          'Difficulty staying asleep (frequent awakenings or long periods awake)',
          'Problem waking up too early in the morning',
          'Satisfaction with current sleep pattern',
          'Noticeability of impairment in daytime functioning due to sleep problem',
          'Worry or distress caused by the sleep problem',
          'Interference with quality of life caused by the sleep problem'
        ];
        let isiText = `• Insomnia Severity Index (ISI): ${runnerData.result_value || 0} score\n\n  Individual Question Responses:\n`;
        Object.entries(runnerData.additional_data.responses).forEach((entry) => {
          const key = entry[0];
          const value = entry[1];
          const questionNum = parseInt(key.replace('q', ''));
          if (!isNaN(questionNum) && isiQuestions[questionNum - 1]) {
            isiText += `    Q${questionNum}. ${isiQuestions[questionNum - 1]}\n      Response: ${value}/4\n`;
          }
        });
        updateData.additional_data.soap_text = isiText;
      }

      // Ensure soap_text is preserved if runner already created it
      if (runnerData.additional_data?.soap_text) {
        updateData.additional_data.soap_text = runnerData.additional_data.soap_text;
      }

      await base44.entities.ClientAssessment.update(assessmentToUpdate.id, updateData);

      // Generate objective text for SOAP - include ALL data from the runner
       const rawDs = assessmentDate || todayLocal();
       const dp = rawDs.split('-').map(Number);
       const today = (dp.length === 3 && !isNaN(dp[0]) && dp[0] > 1900) ? new Date(dp[0], dp[1]-1, dp[2]) : new Date();
       const dateStr = today.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
       const data = runnerData.additional_data || {};

       // If the runner pre-built a soap_text, use it directly
        let objectiveText;
        const soapContent = data.soap_text || runnerData.notes || updateData.additional_data?.soap_text;

        if (soapContent && typeof soapContent === 'string' && soapContent.trim()) {
          objectiveText = `Assessment completed on ${dateStr}:\n\n${soapContent}`;
          // Add form notes only if they differ from the soap text
          if (notes && notes.trim() && notes !== soapContent && !soapContent.includes(notes)) {
            objectiveText += `\n  Clinical Notes: ${notes}\n`;
          }
          if (barriers && barriers.trim()) objectiveText += `  Barriers Identified: ${barriers}\n`;
          if (clinicianNotes && clinicianNotes.trim()) { objectiveText += `\n\nClinician Notes (recorded during assessment):\n${clinicianNotes.trim()}`; }
       } else if (runnerData.result_value !== null && runnerData.result_value !== undefined && runnerData.result_value !== '') {
       objectiveText = `Assessment completed on ${dateStr}:\n\n• ${assessment.name}: ${runnerData.result_value}${assessment.unit_of_measure ? ` ${assessment.unit_of_measure}` : ''}\n`;

        // If the runner returned questionnaire responses, format them with question text + answer labels
        if (data.responses && assessment.questions && assessment.questions.length > 0) {
          objectiveText += `\n  Individual Question Responses:\n`;
          assessment.questions.forEach((question, index) => {
            const response = data.responses[index];
            if (response === undefined || response === null) return;
            objectiveText += `\n  Q${index + 1}. ${question.question_text}\n`;
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
        } else if (data && typeof data === 'object') {
          // Include ALL additional_data fields from the runner (skip raw responses key without questions)
          const skipKeys = ['measurement_type', 'soap_text', 'responses'];
          Object.entries(data).forEach(([key, value]) => {
            if (skipKeys.includes(key)) return;
            if (value === null || value === undefined || value === '') return;
            if (typeof value === 'object' && !Array.isArray(value)) {
              objectiveText += `\n  ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:\n`;
              Object.entries(value).forEach(([subKey, subValue]) => {
                if (subValue === null || subValue === undefined || subValue === '') return;
                if (typeof subValue === 'object') {
                  objectiveText += `    - ${subKey.replace(/_/g, ' ')}: ${JSON.stringify(subValue)}\n`;
                } else {
                  objectiveText += `    - ${subKey.replace(/_/g, ' ')}: ${subValue}\n`;
                }
              });
            } else if (Array.isArray(value) && value.length > 0) {
              objectiveText += `  ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${value.join(', ')}\n`;
            } else {
              objectiveText += `  ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${value}\n`;
            }
          });
          }

          if (notes && notes.trim()) objectiveText += `\n  Clinical Notes: ${notes}\n`;
          if (barriers && barriers.trim()) objectiveText += `  Barriers Identified: ${barriers}\n`;
          if (clinicianNotes && clinicianNotes.trim()) { objectiveText += `\n\nClinician Notes (recorded during assessment):\n${clinicianNotes.trim()}`; }
          } else {
          // Fallback if no result and no soap text
          objectiveText = `Assessment completed on ${dateStr}:\n\n• ${assessment.name}: Assessment recorded`;
          if (notes && notes.trim()) objectiveText += `\n  Clinical Notes: ${notes}\n`;
          if (barriers && barriers.trim()) objectiveText += `  Barriers Identified: ${barriers}\n`;
          if (clinicianNotes && clinicianNotes.trim()) { objectiveText += `\n\nClinician Notes (recorded during assessment):\n${clinicianNotes.trim()}`; }
          }

      try {
        await saveAssessmentToSOAP({
          clientToUse,
          appointmentId: appointmentId || assessmentToUpdate?.appointment_id,
          objectiveText,
          assessmentToUpdateId: assessmentToUpdate.id,
          updateData
        });
      } catch (soapError) {
        console.error("SOAP note error:", soapError);
      }

      toast.success("Assessment saved successfully!");
      if (onComplete) onComplete(updateData);
      onClose();
      } catch (error) {
      console.error("Save error:", error?.message || error);
      toast.error("Failed to save assessment: " + (error?.message || "Unknown error"));
      } finally {
      setIsSubmitting(false);
      }
  };

  const testType = detect(assessment.name);

  const renderRunner = () => {
    const props = { client: selectedClient || client, onSave: handleRunnerSave, onClose };
    switch(testType) {
      case 'barthel': return <BarthelIndexRunner {...props} assessment={assessment} />;
      case 'illinois': return <IllinoisAgilityTestRunner {...props} />;
      case 't_test': return <TTestAgilityRunner {...props} />;
      case '505': return <FiveOFiveAgilityTestRunner {...props} />;
      case 'hexagon': return <HexagonAgilityTestRunner {...props} />;
      case 'l_test': return <LTestofFunctionalMobilityRunner {...props} />;
      case 'figure8': return <FigureofEightWalkTestRunner {...props} />;
      case 'fesi': return <FallsEfficacyScaleInternationalFESIRunner {...props} />;
      case 'fes': return <FallsEfficacyScaleFESRunner {...props} />;
      case 'bot2': return <BruininksOseretskyTestofMotorProficiencyBOT2Runner {...props} />;
      case 'bia': return <BioelectricalImpedanceAnalysisBIARunner {...props} />;
      case 'hydrostatic': return <HydrostaticWeighingRunner {...props} />;
      case 'fasting_glucose': return <FastingBloodGlucoseRunner {...props} />;
      case 'ogtt': return <OralGlucoseToleranceTestOGTTRunner {...props} />;
      case 'rmr': return <RestingMetabolicRateRMRTestingRunner {...props} />;
      case 'beighton': return <BeightonHypermobilityScoreRunner {...props} />;
      case 'chester': return <ChesterStepTestRunner {...props} />;
      case 'efs': return <EdmontonFrailScaleEFSRunner {...props} />;
      case 'eswt': return <EnduranceShuttleWalkTestESWTRunner {...props} assessment={assessment} />;
      case 'fss': return <FatigueSeverityScaleFSSRunner {...props} />;
      case 'fiqr': return <FibromyalgiaImpactQuestionnaireRevisedFIQRRunner {...props} />;
      case 'fvc': return <ForcedVitalCapacityFVCSpirometryRunner {...props} />;
      case 'fac': return <FunctionalAmbulationCategoriesFACRunner {...props} />;
      case 'fga': return <FunctionalGaitAssessmentFGARunner {...props} />;
      case 'max_push': return <MaximalPushUpTestRunner {...props} />;
      case 'mcgill': return <McGillCoreEnduranceTestBatteryRunner {...props} />;
      case 'mas': return <ModifiedAshworthScaleMASRunner {...props} />;
      case 'modified_rankin': return <ModifiedRankinScaleRunner {...props} />;
      case 'nine_peg': return <NineHolePegTestRunner {...props} />;
      case 'psfs': return <PSFSRunner {...props} />;
      case 'pase': return <PhysicalActivityScalefortheElderlyPASERunner {...props} />;
      case 'pcs': return <PainCatastrophizingScalePCSRunner {...props} />;
      case 'pefr': return <PeakExpiratoryFlowRatePEFRRunner {...props} />;
      case 'plank': return <PlankHoldTestRunner {...props} />;
      case 'push_up': return <PushUpTestRunner {...props} />;
      case 'sebt': return <SEBTRunner {...props} />;
      case 'sf36': return <SF36HealthSurveyRunner {...props} />;
      case 'sppb': return <ShortPhysicalPerformanceBatterySPPBRunner {...props} />;
      case 'squat': return <SquatTestDynamicRunner {...props} />;
      case 'stair_climb': return <StairClimbTestRunner {...props} />;
      case 'static_back': return <StaticBackExtensionBieringSrensenTestRunner {...props} />;
      case 'stroop': return <StroopTestRunner {...props} />;
      case 'tandem_stand': return <TandemStandBalanceTestRunner {...props} />;
      case 'trendelenburg': return <TrendelenburgTestRunner {...props} />;
      case 'triple_hop': return <TripleHopTestRunner {...props} />;
      case 'womac': return <WOMACRunner {...props} />;
      case 'wpi': return <WidespreadPainIndexWPIandSymptomSeverityScaleSSSRunner {...props} />;
      case 'ipaq': return <IPAQRunner {...props} />;
      case 'lefs': return <LEFSRunner {...props} />;
      case 'gas': return <GoalAttainmentScalingGASRunner {...props} />;
      case 'digit_span': return <DigitSpanTestRunner {...props} />;
      case 'dual_task_gait': return <DualTaskGaitAssessmentRunner {...props} />;
      case 'bilateral_flex': return <BilateralFlexibilityRunner {...props} />;
      case 'mas_stroke': return <MotorAssessmentScaleMASStrokeRunner {...props} />;
      case 'tardieu': return <TardieuScaleRunner {...props} />;
      case 'tsk': return <QuestionnaireRunner {...props} assessment={assessment} />;
      case 'parq': return <PARQRunner {...props} />;
      case 'edss': return <EDSSRunner {...props} />;
      case 'step_tap': return <StepTapTestRunner {...props} />;
      case 'home_step': return <HomestepTestRunner {...props} />;
      case 'tecumseh': return <TecumsehStepTestRunner {...props} />;
      case 'ymca_bench': return <YMCABenchPressTestRunner {...props} />;
      case 'med_ball': return <MedicineBallThrowRunner {...props} />;
      case 'grooved_peg': return <GroovedPegboardTestRunner {...props} />;
      case 'gst': return <GroceryShelvingTestGSTRunner {...props} />;
      case 'static_squat': return <StaticSquatTestWallSquatRunner {...props} />;
      case 'purdue_peg': return <PurduePegboardTestRunner {...props} />;
      case 'box_block_test': return <BoxandBlockTestRunner {...props} assessment={assessment} />;
      case 'rsi': return <ReactiveStrengthIndexRSIRunner {...props} />;
      case 'tri_arm': return <TriLevelArmErgometerTestRunner {...props} />;
      case '10rm': return <OneRMTestingRunner {...props} />;
      case 'abc_scale': return <ActivitiesspecificBalanceConfidenceABCScaleRunner {...props} />;
      case 'aqol': return <AQoLRunner {...props} />;
      case 'balke': return <BalkeWareTreadmillTestRunner {...props} />;
      case 'breq': return <BREQRunner {...props} />;
      case 'crdq': return <QuestionnaireRunner {...props} assessment={assessment} />;
      case 'dash': return <DASHRunner {...props} />;
      case 'dsq2': return <DePaulSymptomQuestionnaireDSQ2Runner {...props} />;
      case 'cat': return <COPDAssessmentTestCATRunner {...props} />;
      case 'ccq': return <ClinicalCOPDQuestionnaireCCQRunner {...props} />;
      case 'lcq': return <LeicesterCoughQuestionnaireLCQRunner {...props} />;
      case 'distress_thermometer': return <DistressThermometerRunner {...props} />;
      case '5xsts': return <FiveTimesSittoStandTest5xSTSRunner {...props} />;
      case 'faam': return <FootandAnkleAbilityMeasureFAAMRunner {...props} />;
      case 'fma': return <FuglMeyerAssessmentFMARunner {...props} />;
      case 'girth': return <GirthMeasurementsRunner {...props} />;
      case 'hba1c': return <HbA1cRunner {...props} />;
      case 'iesr': return <IESRRunner {...props} />;
      case 'isi': return <InsomniaSeverityIndexISIRunner {...props} />;
      case 'ikdc': return <InternationalKneeDocumentationCommitteeIKDCRunner {...props} />;
      case 'isometric_testing': return <IsometricStrengthTestingRunner {...props} />;
      case 'isometric_strength': return <IsometricStrengthRunner {...props} />;
      case 'ndi': return <NeckDisabilityIndexNDIRunner {...props} />;
      case 'odi': return <ODIRunner {...props} onSave={handleRunnerSave} onClose={onClose} />;
      case 'spadi': return <SPADIRunner {...props} />;
      case 'vital_signs':
      case 'blood_pressure':
      case 'heart_rate':
      case 'spo2': return <VitalSignsRunner {...props} assessment={assessment} assessmentName={assessment.name} />;
      case '10sec_jump': return <TenSecondRepeatedJumpTestRunner {...props} />;
      case '12min_walk': return <TwelveMinuteWalkRunTestCooperRunner {...props} />;
      case '1rm_testing': return <OneRMTestingRunner {...props} />;
      case '20m_shuttle': return <TwentyMeterShuttleRunRunner {...props} />;
      case '2min_walk': return <TwoMinuteWalkTest2MWTRunner {...props} />;
      case '3015_ift': return <ThreeOFifteenIntermittentFitnessTestRunner {...props} />;
      case '30sec_sts': return <ThirtySecondSittoStandTestRunner {...props} />;
      case '400m_walk': return <FourHundredMeterWalkRunner {...props} />;
      case '60sec_sts': return <SixtySecondSittoStandTestRunner {...props} />;
      case '6m_walk_simple': return <SixMeterWalkTestSimpleRunner {...props} />;
      case '8ft_upgo': return <EightFootUpandGoTestRunner {...props} />;
      case 'bod_pod': return <AirDisplacementPlethysmographyBodPodRunner {...props} />;
      case 'anterior_drawer_knee': return <AnteriorDrawerTestKneeRunner {...props} />;
      case 'apleys_compression': return <ApleysCompressionTestRunner {...props} />;
      case 'astrand_6_cycle': return <Astrand6MinuteCycleTestRunner {...props} />;
      case 'astrand_rhyming_step': return <AstrandRhymingStepTestRunner {...props} />;
      case 'astrand_rhyming_cycle': return <AstrandTestRunner {...props} />;
      case 'bess': return <BESSRunner {...props} />;
      case 'back_scratch_test': return <BackScratchTestRunner {...props} />;
      case 'bestest_full': return <BalanceEvaluationSystemsTestBESTestRunner {...props} />;
      case 'body_fat_skinfold': return <BodyFatPercentageSkinfoldsRunner {...props} />;
      case 'bmi_full': return <BodyMassIndexBMIRunner {...props} />;
      case 'bruce_treadmill': return <BruceProtocolRunner {...props} isModified={false} />;
      case 'chair_sit_reach': return <ChairSitandReachTestRunner {...props} />;
      case 'ckcuest_full': return <ClosedKineticChainUpperExtremityStabilityTestCKCUESTRunner {...props} />;
      case 'cbm_full': return <CommunityBalanceMobilityScaleCBMRunner {...props} />;
      case 'conley_scale': return <ConleyScaleRunner {...props} />;
      case 'dgi_full': return <DynamicGaitIndexDGIRunner {...props} />;
      case 'ems_full': return <ElderlyMobilityScaleEMSRunner {...props} />;
      case 'elys_test': return <ElysTestRectusFemorisTightnessRunner {...props} />;
      case 'fms_full': return <FMSRunner {...props} />;
      case 'four_stage_balance_test': return <FourStageBalanceTestRunner {...props} />;
      case 'functional_reach_test': return <FunctionalReachTestRunner {...props} />;
      case 'gad7_full': return <GAD7GeneralizedAnxietyDisorder7Runner {...props} />;
      case 'height_measurement': return <HeightRunner {...props} />;
      case 'himat_full': return <HighLevelMobilityAssessmentToolHiMATRunner {...props} />;
      case 'hoos_full': return <HipOutcomeScoreHOOSRunner {...props} />;
      case 'hads_full': return <HospitalAnxietyandDepressionScaleHADSRunner {...props} />;
      case 'iswt_full': return <IncrementalShuttleWalkTestISWTRunner {...props} />;
      case 'isokinetic_dyn': return <IsokineticDynamometryRunner {...props} />;
      case 'jta_icare': return <JobTaskAnalysisiCareForWorkCoverRunner {...props} />;
      case 'jta_full': return <JobTaskAnalysisJTARunner {...props} />;
      case 'k10_full': return <KesslerPsychologicalDistressScaleK10Runner {...props} />;
      case 'koos_full': return <KneeInjuryandOsteoarthritisOutcomeScoreKOOSRunner {...props} />;
      case 'lachman_test': return <LachmanTestRunner {...props} />;
      case 'mcmurrays_test': return <McMurraysTestRunner {...props} />;
      case 'met_calc_full': return <MetabolicEquivalentMETCalculationRunner {...props} />;
      case 'modified_bruce': return <ModifiedBruceProtocolRunner {...props} />;
      case 'noble_compression': return <NobleCompressionTestRunner {...props} />;
      case 'obers_test': return <ObersTestITBTightnessRunner {...props} />;
      case 'phq9_full': return <PHQ9PatientHealthQuestionnaire9Runner {...props} />;
      case 'promis_fatigue': return <PROMISFatigueScaleShortForm8aRunner {...props} />;
      case 'pss10_full': return <PSS10Runner {...props} />;
      case 'psfs_full': return <PatientSpecificFunctionalScalePSFSRunner {...props} />;
      case 'pediatric_balance': return <PediatricBalanceScaleRunner {...props} />;
      case 'ppt_full': return <PhysicalPerformanceTestPPTRunner {...props} />;
      case 'pivot_shift': return <PivotShiftTestRunner {...props} />;
      case 'qbpds': return <QuebecBackPainDisabilityScaleQBPDSRunner {...props} />;
      case 'roland': return <RolandMorrisDisabilityQuestionnaireRunner {...props} assessment={assessment} />;
      case 'rivermead_mobility': return <RivermadMobilityIndexRunner {...props} />;
      case 'rsa_10x20': return <RSARunner {...props} assessment={assessment} initialProtocolKey="rsa_10x20" />;
      case 'rsa_6x30': return <RSARunner {...props} assessment={assessment} initialProtocolKey="rsa_6x30" />;
      case 'rsa_7x35': return <RSARunner {...props} assessment={assessment} initialProtocolKey="rsa_7x35" />;
      case 'rsa_shuttle': return <RSARunner {...props} assessment={assessment} initialProtocolKey="rsa_shuttle" />;
      case 'rsa_generic': return <RSARunner {...props} assessment={assessment} />;
      case 'rockport_1mile': return <Rockport1MileWalkTestRunner {...props} />;
      case 'rombergs_standing': return <RombergsTestofStandingBalanceRunner {...props} />;
      case 'shoulder_tug': return <ShoulderTugTestPastorsTestRunner {...props} />;
      case 'single_leg_stance_test': return <SingleLegStanceTestRunner {...props} />;
      case 'sit_reach_test': return <SitandReachTestRunner {...props} />;
      case 'six_min_step_test': return <SixMinuteStepTestRunner {...props} />;
      case 'slump_test': return <SlumpTestRunner {...props} />;
      case 'standing_stork': return <StandingStorkTestRunner {...props} />;
      case 'step_tap_15': return <StepTapTest15secondsRunner {...props} />;
      case 'aerobic_step': return <StepTestAerobicStepTestRunner {...props} />;
      case 'slr_test': return <StraightLegRaiseSLRRunner {...props} />;
      case 'ten_metre_walk': return <TenMetreWalkTest10MWTRunner {...props} />;
      case 'thessaly_test': return <ThessalyTestRunner {...props} />;
      case 'thirty_sec_chair': return <ThirtySecondChairStandTestRunner {...props} />;
      case 'thomas_test': return <ThomasTestHipFlexorTightnessRunner {...props} />;
      case 'timed_push_up': return <TimedPushUpTestPressUpTestRunner {...props} />;
      case 'tug_full': return <TimedUpAndGoRunner {...props} />;
      case 'two_min_step': return <TwoMinuteStepTestRunner {...props} />;
      case 'vo2max_gxt_full': return <VO2maxTestingMaximalGradedExerciseTestGXTRunner {...props} />;
      case 'sargent_jump': return <VerticalJumpTestSargentJumpRunner {...props} />;
      case 'waist_circ': return <WaistCircumferenceRunner {...props} />;
      case 'whr_full': return <WaisttoHipRatioWHRRunner {...props} />;
      case 'weight_measure': return <WeightRunner {...props} />;
      case 'wingate': return <WingateAnaerobicTestRunner {...props} />;
      case 'ymca_3min_step': return <YMCA3MinuteStepTestRunner {...props} />;
      case 'ymca_cycle': return <YMCACycleErgometerProtocolRunner {...props} />;
      case 'yoyo_intermittent': return <YoYoIntermittentRecoveryTestsRunner {...props} />;
      case 'arm_curl': return <ArmCurlRunner {...props} />;
      case 'chalder_fatigue': return <ChalderFatigueScaleRunner {...props} />;
      case 'visual_rom': return <VisualROMAssessmentRunner {...props} />;
      case 'quick_dash': return <QuickDASHRunner {...props} />;
      case 'pcl5': return <PCL5Runner {...props} />;
      case 'psqi': return <PittsburghSleepQualityIndexPSQIRunner {...props} />;
      case 'sarc_f': return <SARCFQuestionnaireRunner {...props} />;
      case 'standing_long_jump': return <StandingLongJumpRunner {...props} />;

      default:
         return assessment?.is_questionnaire ? <QuestionnaireRunner {...props} assessment={assessment} /> : null;
    }
  };

  // Runners that manage their own modal UI — render without wrapper
  const selfModalTypes = ['psqi', 'ppt_full', 'sppb', 'stroop', 'static_back', 'standing_stork',
    'slump_test', 'sebt', 'single_leg_stance_test', 'five_xsts', 'fes', 'fesi', 'bia',
    'pcl5', 'roland', 'sarc_f', 'rivermead_mobility', '2min_walk', 'standing_long_jump'];

  // Show the runner wrapped in a modal overlay
  if (showRunner) {
    const isSelfModal = selfModalTypes.includes(testType);
    if (isSelfModal) {
      return renderRunner();
    }
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {renderRunner()}
        </div>
      </div>
    );
  }

  // Show confirmation/save form after runner completes
  if (!runnerData) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">{assessment.name}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-semibold">Assessment Completed</p>
          {runnerData.result_value !== null && runnerData.result_value !== undefined && runnerData.result_value !== '' ? (
            <p className="text-green-700 text-sm mt-1">
              Result: <strong>{runnerData.result_value} {assessment.unit_of_measure || ''}</strong>
            </p>
          ) : (
            <p className="text-green-700 text-sm mt-1">Assessment recorded successfully</p>
          )}
        </div>

        <div>
          <Label>Assessment Date</Label>
          <Input type="date" value={assessmentDate} onChange={e => setAssessmentDate(e.target.value)} className="mt-1" />
        </div>

        <div>
          <Label>Clinical Notes</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Additional observations..." className="mt-1" />
        </div>

        <div>
          <Label>Barriers Identified</Label>
          <Textarea value={barriers} onChange={e => setBarriers(e.target.value)} rows={2} placeholder="Any barriers noted..." className="mt-1" />
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setShowRunner(true)}>
            Re-run Test
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : <><Save className="w-4 h-4 mr-2" />Save Assessment</>}
          </Button>
        </div>
      </div>
    </div>
  );
}