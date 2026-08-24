import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BIA_RUNNER_SPEC,
  TEN_RM_RUNNER_SPEC,
  TSK_RUNNER_SPEC,
} from '../../src/lib/clinical/scorers/classDRepairs.js';
import {
  DASS21_OPTIONS,
  DASS21_QUESTIONS,
  DASS21_SOURCE,
} from '../../src/lib/clinical/dass21.js';
import { STRUCTURED_ASSESSMENT_FIELDS } from '../../src/lib/clinical/assessmentScoring.js';
import { RUNNER_SPECS as EXTRAS_BODY_FITNESS_RUNNER_SPECS } from '../../src/lib/clinical/scorers/extrasBodyFitness.js';
import { RUNNER_SPECS as EXTRAS_FUNCTIONAL_ORTHO_RUNNER_SPECS } from '../../src/lib/clinical/scorers/extrasFunctionalOrtho.js';
import { RUNNER_SPECS as EXTRAS_MOBILITY_BALANCE_ORTHO_RUNNER_SPECS } from '../../src/lib/clinical/scorers/extrasMobilityBalanceOrtho.js';
import { RUNNER_SPECS as EXTRAS_PHYSIOLOGICAL_RUNNER_SPECS } from '../../src/lib/clinical/scorers/extrasPhysiological.js';
import { RUNNER_SPECS as EXTRAS_PROM_NEURO_RUNNER_SPECS } from '../../src/lib/clinical/scorers/extrasPromNeuro.js';
import {
  BESS_RUNNER_SPEC,
  BOD_POD_RUNNER_SPEC,
  EDSS_RUNNER_SPEC,
  EFS_RUNNER_SPEC,
  IPAQ_SHORT_FORM_RUNNER_SPEC,
} from '../../src/lib/clinical/scorers/maintainedPhysioAdditions.js';
import { RUNNER_SPECS as RESIDUAL_ASSESSMENT_RUNNER_SPECS } from '../../src/lib/clinical/scorers/residualAssessments.js';
import {
  EIGHT_FOOT_UP_GO_RUNNER_SPEC,
  FIM_RUNNER_SPEC,
  FOUR_HUNDRED_METRE_WALK_RUNNER_SPEC,
  SIX_METRE_WALK_RUNNER_SPEC,
  SIX_MINUTE_STEP_RUNNER_SPEC,
} from '../../src/lib/clinical/scorers/standaloneAndFim.js';
import { TUDS_RUNNER_SPEC } from '../../src/lib/clinical/tuds.js';
import { RUNNER_SPECS as CORE_B_RUNNER_SPECS } from '../../src/lib/clinical/scorers/coreB.js';
import { RUNNER_SPECS as CORE_A_RUNNER_SPECS } from '../../src/lib/clinical/scorers/coreA.js';
import { normalisedFileSha256 } from './normalised-source-hash.mjs';
import { PHYSIO_ROUTE_ASSIGNMENTS } from './physio-route-assignments.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function fileSha256(relativePath) {
  return normalisedFileSha256(path.join(REPOSITORY_ROOT, relativePath));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function scorerModuleMarker(scorerFile) {
  return `@/${scorerFile.replace(/^src\//, '').replace(/\.js$/, '')}`;
}

function implementationBindingSha256({
  componentFile,
  componentSha256,
  scorerFile,
  scorerSha256,
  bindingMarker,
}) {
  return sha256([
    componentFile,
    componentSha256,
    scorerFile,
    scorerSha256,
    bindingMarker,
  ].join('\n'));
}

function withImplementation(runnerSpec, componentFile, scorerFile) {
  const componentSha256 = fileSha256(componentFile);
  const scorerSha256 = fileSha256(scorerFile);
  const bindingMarker = scorerModuleMarker(scorerFile);
  const componentSource = fs.readFileSync(path.join(REPOSITORY_ROOT, componentFile), 'utf8');
  if (!componentSource.includes(bindingMarker)) {
    throw new Error(
      `${runnerSpec.runnerKey} component ${componentFile} does not declare scorer-module binding ${bindingMarker}`,
    );
  }
  return Object.freeze({
    ...runnerSpec,
    implementation: Object.freeze({
      component_file: componentFile,
      component_sha256: componentSha256,
      scorer_file: scorerFile,
      scorer_sha256: scorerSha256,
      component_scorer_binding_marker: bindingMarker,
      component_scorer_binding_sha256: implementationBindingSha256({
        componentFile,
        componentSha256,
        scorerFile,
        scorerSha256,
        bindingMarker,
      }),
    }),
  });
}

function questionnaireItems(items) {
  return items.map((item) => ({
    key: item.key,
    question_text: item.prompt,
    question_type: item.type || item.question_type || 'single_choice',
    required: item.required,
    ...(Array.isArray(item.options) ? { options: item.options } : {}),
    ...(item.min !== undefined ? { min: item.min } : {}),
    ...(item.max !== undefined ? { max: item.max } : {}),
    ...(item.unit ? { unit: item.unit } : {}),
  }));
}

function routeBoundOverlays({ runnerSpecs, componentFiles, scorerFile, questionnaireRunnerKeys = [] }) {
  const questionnaireKeys = new Set(questionnaireRunnerKeys);
  const entries = runnerSpecs.map((runnerSpec) => {
    const matches = Object.entries(PHYSIO_ROUTE_ASSIGNMENTS)
      .filter(([, assignment]) => assignment.runnerKey === runnerSpec.runnerKey);
    if (matches.length !== 1) {
      throw new Error(`${runnerSpec.runnerKey} must map to exactly one canonical route; found ${matches.length}`);
    }
    const [[canonicalId, assignment]] = matches;
    if (assignment.scoringKey !== runnerSpec.scoringKey) {
      throw new Error(`${runnerSpec.runnerKey} route/scorer mismatch: ${assignment.scoringKey} != ${runnerSpec.scoringKey}`);
    }
    const componentFile = componentFiles[runnerSpec.runnerKey];
    if (!componentFile) throw new Error(`${runnerSpec.runnerKey} has no production component binding`);
    const overlay = {
      runnerSpec: withImplementation(runnerSpec, componentFile, scorerFile),
      ...(runnerSpec.kind !== 'questionnaire' ? { isQuestionnaire: false } : {}),
      ...(questionnaireKeys.has(runnerSpec.runnerKey)
        ? {
          questions: Object.freeze(questionnaireItems(runnerSpec.items)),
          isQuestionnaire: true,
        }
        : {}),
    };
    return [canonicalId, Object.freeze(overlay)];
  });
  return Object.freeze(Object.fromEntries(entries));
}

const EXTRAS_BODY_FITNESS_COMPONENT_FILES = Object.freeze({
  bmi_full: 'src/components/assessments/BodyMassIndexBMIRunner.jsx',
  whr_full: 'src/components/assessments/WaisttoHipRatioWHRRunner.jsx',
  girth: 'src/components/assessments/GirthMeasurementsRunner.jsx',
  body_fat_skinfold: 'src/components/assessments/BodyFatPercentageSkinfoldsRunner.jsx',
  home_step: 'src/components/assessments/HomeStepTestRunner.jsx',
  '12min_walk': 'src/components/assessments/12MinuteWalkRunTestCooperRunner.jsx',
  max_push: 'src/components/assessments/MaximalPushUpTestRunner.jsx',
  fvc: 'src/components/assessments/ForcedVitalCapacityFVCSpirometryRunner.jsx',
  pefr: 'src/components/assessments/PeakExpiratoryFlowRatePEFRRunner.jsx',
  ymca_cycle: 'src/components/assessments/YMCACycleErgometerProtocolRunner.jsx',
  wingate: 'src/components/assessments/WingateAnaerobicTestRunner.jsx',
  rsa_generic: 'src/components/assessments/RSARunner.jsx',
  hydrostatic: 'src/components/assessments/HydrostaticWeighingRunner.jsx',
  rmr: 'src/components/assessments/RestingMetabolicRateRMRTestingRunner.jsx',
  rsa_6x30: 'src/components/assessments/RSARunner.jsx',
  rsa_10x20: 'src/components/assessments/RSARunner.jsx',
  rsa_7x35: 'src/components/assessments/RSARunner.jsx',
  rsa_shuttle: 'src/components/assessments/RSARunner.jsx',
  vo2max_gxt_full: 'src/components/assessments/VO2maxGXTRunner.jsx',
  met_calc_full: 'src/components/assessments/MetabolicEquivalentMETCalculationRunner.jsx',
});

const EXTRAS_FUNCTIONAL_ORTHO_COMPONENT_FILES = Object.freeze({
  arm_curl: 'src/components/assessments/ArmCurlRunner.jsx',
  '30sec_sts': 'src/components/assessments/30SecondSittoStandTestRunner.jsx',
  triple_hop: 'src/components/assessments/TripleHopTestRunner.jsx',
  trendelenburg: 'src/components/assessments/TrendelenburgTestRunner.jsx',
  stair_climb: 'src/components/assessments/StairClimbTestRunner.jsx',
  two_min_step: 'src/components/assessments/TwoMinuteStepTestRunner.jsx',
  step_tap: 'src/components/assessments/StepTapTestRunner.jsx',
  box_block_test: 'src/components/assessments/BoxandBlockTestRunner.jsx',
  mcgill: 'src/components/assessments/McGillCoreEnduranceTestBatteryRunner.jsx',
  '60sec_sts': 'src/components/assessments/60SecondSittoStandTestRunner.jsx',
  distress_thermometer: 'src/components/assessments/DistressThermometerRunner.jsx',
  static_back: 'src/components/assessments/StaticBackExtensionBieringSrensenTestRunner.jsx',
  rombergs_standing: 'src/components/assessments/RombergsTestofStandingBalanceRunner.jsx',
  shoulder_tug: 'src/components/assessments/ShoulderTugTestPastorsTestRunner.jsx',
  gst: 'src/components/assessments/GroceryShelvingTestGSTRunner.jsx',
  timed_push_up: 'src/components/assessments/TimedPushUpTestPressUpTestRunner.jsx',
  static_squat: 'src/components/assessments/StaticSquatTestWallSquatRunner.jsx',
  squat: 'src/components/assessments/SquatTestDynamicRunner.jsx',
  ymca_bench: 'src/components/assessments/YMCABenchPressTestRunner.jsx',
  '5xsts': 'src/components/assessments/FiveTimesSittoStandTest5xSTSRunner.jsx',
  fac: 'src/components/assessments/FunctionalAmbulationCategoriesFACRunner.jsx',
  modified_rankin: 'src/components/assessments/ModifiedRankinScaleRunner.jsx',
  nine_peg: 'src/components/assessments/NineHolePegTestRunner.jsx',
  grooved_peg: 'src/components/assessments/GroovedPegboardTestRunner.jsx',
  elys_test: 'src/components/assessments/ElysTestRectusFemorisTightnessRunner.jsx',
  thomas_test: 'src/components/assessments/ThomasTestHipFlexorTightnessRunner.jsx',
  anterior_drawer_knee: 'src/components/assessments/AnteriorDrawerTestKneeRunner.jsx',
  noble_compression: 'src/components/assessments/NobleCompressionTestRunner.jsx',
});

const EXTRAS_MOBILITY_BALANCE_ORTHO_COMPONENT_FILES = Object.freeze({
  jta_icare: 'src/components/assessments/JobTaskAnalysisiCareforWorkCoverRunner.jsx',
  tug_full: 'src/components/assessments/TimedUpAndGoRunner.jsx',
  sit_reach_test: 'src/components/assessments/SitandReachTestRunner.jsx',
  chair_sit_reach: 'src/components/assessments/ChairSitandReachTestRunner.jsx',
  back_scratch_test: 'src/components/assessments/BackScratchTestRunner.jsx',
  functional_reach_test: 'src/components/assessments/FunctionalReachTestRunner.jsx',
  single_leg_stance_test: 'src/components/assessments/SingleLegStanceTestRunner.jsx',
  sppb: 'src/components/assessments/ShortPhysicalPerformanceBatterySPPBRunner.jsx',
  tandem_stand: 'src/components/assessments/TandemStandBalanceTestRunner.jsx',
  sebt: 'src/components/assessments/SEBTRunner.jsx',
  ten_metre_walk: 'src/components/assessments/TenMetreWalkTest10MWTRunner.jsx',
  beighton: 'src/components/assessments/BeightonHypermobilityScoreRunner.jsx',
  dual_task_gait: 'src/components/assessments/DualTaskGaitAssessmentRunner.jsx',
  plank: 'src/components/assessments/PlankHoldTestRunner.jsx',
  standing_stork: 'src/components/assessments/StandingStorkTestRunner.jsx',
  med_ball: 'src/components/assessments/MedicineBallThrowRunner.jsx',
  purdue_peg: 'src/components/assessments/PurduePegboardTestRunner.jsx',
  standing_long_jump: 'src/components/assessments/StandingLongJumpRunner.jsx',
  illinois: 'src/components/assessments/IllinoisAgilityTestRunner.jsx',
  t_test: 'src/components/assessments/TTestAgilityRunner.jsx',
  505: 'src/components/assessments/505AgilityTestRunner.jsx',
  hexagon: 'src/components/assessments/HexagonAgilityTestRunner.jsx',
  rsi: 'src/components/assessments/ReactiveStrengthIndexRSIRunner.jsx',
  '10sec_jump': 'src/components/assessments/10SecondRepeatedJumpTestRunner.jsx',
  ckcuest_full: 'src/components/assessments/ClosedKineticChainUpperExtremityStabilityTestCKCUESTRunner.jsx',
  isometric_testing: 'src/components/assessments/IsometricStrengthTestingRunner.jsx',
  isokinetic_dyn: 'src/components/assessments/IsokineticDynamometryRunner.jsx',
  obers_test: 'src/components/assessments/ObersTestITBTightnessRunner.jsx',
  slr_test: 'src/components/assessments/StraightLegRaiseSLRRunner.jsx',
  slump_test: 'src/components/assessments/SlumpTestRunner.jsx',
  lachman_test: 'src/components/assessments/LachmanTestRunner.jsx',
  pivot_shift: 'src/components/assessments/PivotShiftTestRunner.jsx',
  mcmurrays_test: 'src/components/assessments/McMurraysTestRunner.jsx',
  thessaly_test: 'src/components/assessments/ThessalyRunner.jsx',
  apleys_compression: 'src/components/assessments/ApleysCompressionTestRunner.jsx',
  l_test: 'src/components/assessments/LTestofFunctionalMobilityRunner.jsx',
  figure8: 'src/components/assessments/FigureofEightWalkTestRunner.jsx',
  visual_rom: 'src/components/assessments/VisualROMAssessmentRunner.jsx',
});

const EXTRAS_PROM_NEURO_COMPONENT_FILES = Object.freeze({
  odi: 'src/components/assessments/ODIRunner.jsx',
  fma: 'src/components/assessments/FuglMeyerAssessmentFMARunner.jsx',
  sarc_f: 'src/components/assessments/SARCFQuestionnaireRunner.jsx',
  ndi: 'src/components/assessments/NeckDisabilityIndexNDIRunner.jsx',
  k10_full: 'src/components/assessments/KesslerPsychologicalDistressScaleK10Runner.jsx',
  hoos_full: 'src/components/assessments/HipOutcomeScoreHOOSRunner.jsx',
  koos_full: 'src/components/assessments/KneeInjuryandOsteoarthritisOutcomeScoreKOOSRunner.jsx',
  fiqr: 'src/components/assessments/FibromyalgiaImpactQuestionnaireRevisedFIQRRunner.jsx',
  wpi: 'src/components/assessments/WidespreadPainIndexWPIandSymptomSeverityScaleSSSRunner.jsx',
  pcs: 'src/components/assessments/PainCatastrophizingScalePCSRunner.jsx',
  dsq2: 'src/components/assessments/DePaulSymptomQuestionnaireDSQ2Runner.jsx',
  chalder_fatigue: 'src/components/assessments/ChalderFatigueScaleRunner.jsx',
  sf36: 'src/components/assessments/SF36HealthSurveyRunner.jsx',
  fss: 'src/components/assessments/FatigueSeverityScaleFSSRunner.jsx',
  promis_fatigue: 'src/components/assessments/PROMISFatigueScaleShortForm8aRunner.jsx',
  psqi: 'src/components/assessments/PittsburghSleepQualityIndexPSQIRunner.jsx',
  dgi_full: 'src/components/assessments/DynamicGaitIndexDGIRunner.jsx',
  fga: 'src/components/assessments/FunctionalGaitAssessmentFGARunner.jsx',
  parq: 'src/components/assessments/PARQRunner.jsx',
  gas: 'src/components/assessments/GoalAttainmentScalingGASRunner.jsx',
  psfs: 'src/components/assessments/PSFSRunner.jsx',
  lefs: 'src/components/assessments/LEFSRunner.jsx',
  himat_full: 'src/components/assessments/HighLevelMobilityAssessmentToolHiMATRunner.jsx',
  aqol: 'src/components/assessments/AQoLRunner.jsx',
  spadi: 'src/components/assessments/SPADIRunner.jsx',
  breq: 'src/components/assessments/BREQRunner.jsx',
  pase: 'src/components/assessments/PhysicalActivityScalefortheElderlyPASERunner.jsx',
  qbpds: 'src/components/assessments/TestRunnerExtras.jsx',
  womac: 'src/components/assessments/WOMACRunner.jsx',
  stroop: 'src/components/assessments/StroopTestRunner.jsx',
  digit_span: 'src/components/assessments/TestRunnerExtras.jsx',
  mas: 'src/components/assessments/ModifiedAshworthScaleMASRunner.jsx',
  tardieu: 'src/components/assessments/TardieuScaleRunner.jsx',
  barthel: 'src/components/assessments/BarthelIndexRunner.jsx',
  abc_scale: 'src/components/assessments/ActivitiesspecificBalanceConfidenceABCScaleRunner.jsx',
  mas_stroke: 'src/components/assessments/MotorAssessmentScaleMASStrokeRunner.jsx',
  rivermead_mobility: 'src/components/assessments/RivermadMobilityIndexRunner.jsx',
  roland: 'src/components/assessments/RolandMorrisDisabilityQuestionnaireRunner.jsx',
  dash: 'src/components/assessments/DASHRunner.jsx',
  faam: 'src/components/assessments/FootandAnkleAbilityMeasureFAAMRunner.jsx',
  ikdc: 'src/components/assessments/InternationalKneeDocumentationCommitteeIKDCRunner.jsx',
  cat: 'src/components/assessments/COPDAssessmentTestCATRunner.jsx',
  ccq: 'src/components/assessments/ClinicalCOPDQuestionnaireCCQRunner.jsx',
  lcq: 'src/components/assessments/LeicesterCoughQuestionnaireLCQRunner.jsx',
  cbm_full: 'src/components/assessments/CommunityBalanceMobilityScaleCBMRunner.jsx',
  bestest_full: 'src/components/assessments/BESTestRunner.jsx',
  fesi: 'src/components/assessments/FallsEfficacyScaleInternationalFESIRunner.jsx',
  ems_full: 'src/components/assessments/ElderlyMobilityScaleEMSRunner.jsx',
  pcl5: 'src/components/assessments/PCL5Runner.jsx',
  isi: 'src/components/assessments/InsomniaSeverityIndexISIRunner.jsx',
  pediatric_balance: 'src/components/assessments/PediatricBalanceScaleRunner.jsx',
  ppt_full: 'src/components/assessments/PhysicalPerformanceTestPPTRunner.jsx',
  phq9_full: 'src/components/assessments/PHQ9PatientHealthQuestionnaire9Runner.jsx',
  gad7_full: 'src/components/assessments/GAD7GeneralizedAnxietyDisorder7Runner.jsx',
});

const CORE_B_COMPONENT_FILES = Object.freeze({
  hads: 'src/components/assessments/HADSRunner.jsx',
  ebbeling: 'src/components/assessments/EbbelingTestRunner.jsx',
  'harvard-step': 'src/components/assessments/HarvardStepRunner.jsx',
  'rockport-walk': 'src/components/assessments/RockportWalkRunner.jsx',
  'resting-heart-rate': 'src/components/assessments/VitalSignsRunner.jsx',
  astrand: 'src/components/assessments/AstrandTestRunner.jsx',
  'vertical-jump': 'src/components/assessments/VerticalJumpTestRunner.jsx',
  ases: 'src/components/assessments/AmericanShoulderandElbowSurgeonsASESScoreRunner.jsx',
  'constant-murley': 'src/components/assessments/ConstantMurleyScoreRunner.jsx',
  lysholm: 'src/components/assessments/LysholmKneeScoreRunner.jsx',
  'acl-rsi': 'src/components/assessments/ACLRSIRunner.jsx',
  fabq: 'src/components/assessments/FearAvoidanceBeliefsQuestionnaireFABQRunner.jsx',
  'drop-vertical-jump': 'src/components/assessments/DropVerticalJumpRunner.jsx',
  naughton: 'src/components/assessments/NaughtonTreadmillProtocolRunner.jsx',
  sgrq: 'src/components/assessments/StGeorgesRespiratoryQuestionnaireSGRQRunner.jsx',
  dexa: 'src/components/assessments/DEXAScanResultsInterpretationRunner.jsx',
  conley: 'src/components/assessments/ConleyScaleRunner.jsx',
  'perceived-stress-scale': 'src/components/assessments/PerceivedStressScalePSSRunner.jsx',
  'heart-rate-recovery': 'src/components/assessments/HRRRunner.jsx',
  'lipid-profile': 'src/components/assessments/LipidProfileRunner.jsx',
  'borg-rpe': 'src/components/assessments/BorgRPERunner.jsx',
  quickdash: 'src/components/assessments/QuickDASHRunner.jsx',
});

const CORE_A_COMPONENT_FILES = Object.freeze({
  'range-of-motion': 'src/components/assessments/ROMAssessmentRunner.jsx',
  'manual-muscle-testing': 'src/components/assessments/ManualMuscleTestRunner.jsx',
  'pain-scales': 'src/components/assessments/PainScalesRunner.jsx',
  'single-leg-stance': 'src/components/assessments/SingleLegStanceRunner.jsx',
  'berg-balance': 'src/components/assessments/BergBalanceRunner.jsx',
  'hand-grip': 'src/components/assessments/TestRunner.jsx',
  'clinical-frailty-scale': 'src/components/assessments/ClinicalFrailtyScaleRunner.jsx',
  'four-meter-gait-speed': 'src/components/assessments/GaitSpeedRunner.jsx',
  'habitual-gait-speed': 'src/components/assessments/GaitSpeedRunner.jsx',
  'fast-gait-speed': 'src/components/assessments/GaitSpeedRunner.jsx',
  'y-balance': 'src/components/assessments/TestRunner.jsx',
  'four-stage-balance': 'src/components/assessments/FourStageBalanceRunner.jsx',
  'modified-thomas': 'src/components/assessments/SpecialTestsRunner.jsx',
  'single-leg-hop': 'src/components/assessments/SingleLegHopTestsRunner.jsx',
  'one-minute-sit-to-stand': 'src/components/assessments/1MinuteSittoStandTestRunner.jsx',
  groc: 'src/components/assessments/GlobalRatingofChangeScaleGROCRunner.jsx',
  'four-square-step': 'src/components/assessments/FourSquareStepRunner.jsx',
  ctsib: 'src/components/assessments/CTSIBRunner.jsx',
  'clock-drawing': 'src/components/assessments/ClockDrawingTestRunner.jsx',
  'general-movement-screen': 'src/components/assessments/GeneralMovementScreenRunner.jsx',
  tinetti: 'src/components/assessments/TinettiRunner.jsx',
  'six-minute-walk': 'src/components/assessments/SixMinuteWalkRunner.jsx',
});

const EXTRAS_PHYSIOLOGICAL_COMPONENT_FILES = Object.freeze({
  heart_rate: 'src/components/assessments/VitalSignsRunner.jsx',
  'spo2-exercise': 'src/components/assessments/VitalSignsRunner.jsx',
  'spo2-resting': 'src/components/assessments/VitalSignsRunner.jsx',
  blood_pressure: 'src/components/assessments/VitalSignsRunner.jsx',
  ymca_3min_step: 'src/components/assessments/YMCA3MinuteStepTestRunner.jsx',
  aerobic_step: 'src/components/assessments/StepTestAerobicStepTestRunner.jsx',
  chester: 'src/components/assessments/ChesterStepTestRunner.jsx',
  eswt: 'src/components/assessments/EnduranceShuttleWalkTestESWTRunner.jsx',
  height_measurement: 'src/components/assessments/HeightRunner.jsx',
  weight_measure: 'src/components/assessments/WeightRunner.jsx',
  waist_circ: 'src/components/assessments/WaistCircumferenceRunner.jsx',
  tri_arm: 'src/components/assessments/TriLevelArmErgometerTestRunner.jsx',
  tecumseh: 'src/components/assessments/TecumsehStepTestRunner.jsx',
  balke: 'src/components/assessments/BalkeWareTreadmillTestRunner.jsx',
  modified_bruce: 'src/components/assessments/ModifiedBruceProtocolRunner.jsx',
  '1rm_testing': 'src/components/assessments/1RepetitionMaximum1RMTestingRunner.jsx',
  bruce_treadmill: 'src/components/assessments/BruceProtocolRunner.jsx',
  '2min_walk': 'src/components/assessments/2MinuteWalkTest2MWTRunner.jsx',
  '20m_shuttle': 'src/components/assessments/20MeterShuttleRunBeepTestRunner.jsx',
  '3015_ift': 'src/components/assessments/3015IntermittentFitnessTestRunner.jsx',
  fasting_glucose: 'src/components/assessments/FastingBloodGlucoseRunner.jsx',
  ogtt: 'src/components/assessments/OralGlucoseToleranceTestOGTTRunner.jsx',
  hba1c: 'src/components/assessments/HbA1cRunner.jsx',
});

const RESIDUAL_ASSESSMENT_COMPONENT_FILES = Object.freeze({
  crdq: 'src/components/assessments/QuestionnaireRunner.jsx',
  uefs: 'src/components/assessments/QuestionnaireRunner.jsx',
  'start-back': 'src/components/assessments/QuestionnaireRunner.jsx',
  orebro: 'src/components/assessments/QuestionnaireRunner.jsx',
  'neurological-screen': 'src/components/assessments/StructuredAssessmentRunner.jsx',
  astrand_rhyming_step: 'src/components/assessments/AstrandRhymingStepTestRunner.jsx',
});

const STANDALONE_AND_FIM_RUNNER_SPECS = Object.freeze([
  EIGHT_FOOT_UP_GO_RUNNER_SPEC,
  SIX_METRE_WALK_RUNNER_SPEC,
  FOUR_HUNDRED_METRE_WALK_RUNNER_SPEC,
  SIX_MINUTE_STEP_RUNNER_SPEC,
  FIM_RUNNER_SPEC,
]);

const STANDALONE_AND_FIM_COMPONENT_FILES = Object.freeze({
  '8-foot-up-go': 'src/components/assessments/8FootUpandGoRunner.jsx',
  '6-meter-walk': 'src/components/assessments/6MeterWalkTestRunner.jsx',
  '400-meter-walk': 'src/components/assessments/400MeterWalkTestRunner.jsx',
  '6-minute-step': 'src/components/assessments/SixMinuteStepTestRunner.jsx',
  fim: 'src/components/assessments/FunctionalIndependenceMeasureFIMRunner.jsx',
});

const EXTRAS_BODY_FITNESS_RUNTIME_SPEC_OVERLAYS = routeBoundOverlays({
  runnerSpecs: EXTRAS_BODY_FITNESS_RUNNER_SPECS,
  componentFiles: EXTRAS_BODY_FITNESS_COMPONENT_FILES,
  scorerFile: 'src/lib/clinical/scorers/extrasBodyFitness.js',
});

const EXTRAS_FUNCTIONAL_ORTHO_RUNTIME_SPEC_OVERLAYS = routeBoundOverlays({
  runnerSpecs: EXTRAS_FUNCTIONAL_ORTHO_RUNNER_SPECS,
  componentFiles: EXTRAS_FUNCTIONAL_ORTHO_COMPONENT_FILES,
  scorerFile: 'src/lib/clinical/scorers/extrasFunctionalOrtho.js',
});

const EXTRAS_MOBILITY_BALANCE_ORTHO_RUNTIME_SPEC_OVERLAYS = routeBoundOverlays({
  runnerSpecs: EXTRAS_MOBILITY_BALANCE_ORTHO_RUNNER_SPECS,
  componentFiles: EXTRAS_MOBILITY_BALANCE_ORTHO_COMPONENT_FILES,
  scorerFile: 'src/lib/clinical/scorers/extrasMobilityBalanceOrtho.js',
});

const EXTRAS_PROM_NEURO_RUNTIME_SPEC_OVERLAYS = routeBoundOverlays({
  runnerSpecs: EXTRAS_PROM_NEURO_RUNNER_SPECS,
  componentFiles: EXTRAS_PROM_NEURO_COMPONENT_FILES,
  scorerFile: 'src/lib/clinical/scorers/extrasPromNeuro.js',
  questionnaireRunnerKeys: EXTRAS_PROM_NEURO_RUNNER_SPECS
    .filter(({ kind }) => kind === 'questionnaire')
    .map(({ runnerKey }) => runnerKey),
});

const CORE_B_RUNTIME_SPEC_OVERLAYS = routeBoundOverlays({
  runnerSpecs: CORE_B_RUNNER_SPECS,
  componentFiles: CORE_B_COMPONENT_FILES,
  scorerFile: 'src/lib/clinical/scorers/coreB.js',
  questionnaireRunnerKeys: CORE_B_RUNNER_SPECS
    .filter(({ kind }) => kind === 'questionnaire')
    .map(({ runnerKey }) => runnerKey),
});

const CORE_A_RUNTIME_SPEC_OVERLAYS = routeBoundOverlays({
  runnerSpecs: CORE_A_RUNNER_SPECS,
  componentFiles: CORE_A_COMPONENT_FILES,
  scorerFile: 'src/lib/clinical/scorers/coreA.js',
});

const EXTRAS_PHYSIOLOGICAL_RUNTIME_SPEC_OVERLAYS = routeBoundOverlays({
  runnerSpecs: EXTRAS_PHYSIOLOGICAL_RUNNER_SPECS,
  componentFiles: EXTRAS_PHYSIOLOGICAL_COMPONENT_FILES,
  scorerFile: 'src/lib/clinical/scorers/extrasPhysiological.js',
});

const RESIDUAL_ASSESSMENT_RUNTIME_SPEC_OVERLAYS = routeBoundOverlays({
  runnerSpecs: RESIDUAL_ASSESSMENT_RUNNER_SPECS,
  componentFiles: RESIDUAL_ASSESSMENT_COMPONENT_FILES,
  scorerFile: 'src/lib/clinical/scorers/residualAssessments.js',
  questionnaireRunnerKeys: ['uefs', 'start-back', 'orebro'],
});

const STANDALONE_AND_FIM_RUNTIME_SPEC_OVERLAYS = routeBoundOverlays({
  runnerSpecs: STANDALONE_AND_FIM_RUNNER_SPECS,
  componentFiles: STANDALONE_AND_FIM_COMPONENT_FILES,
  scorerFile: 'src/lib/clinical/scorers/standaloneAndFim.js',
  questionnaireRunnerKeys: ['fim'],
});

export const CANONICAL_DRIVEN_QUESTIONNAIRE_ROUTES = Object.freeze({
  'assessment:ep-import:691eb419ae95315ff3bad4f1': Object.freeze({ runnerKey: 'bpi', scoringKey: 'bpi' }),
  'assessment:ep-import:691eb419ae95315ff3bad4f2': Object.freeze({ runnerKey: 'questionnaire-sum', scoringKey: 'questionnaire-sum' }),
  'assessment:ep-import:691eb4829e643c502051e85a': Object.freeze({ runnerKey: 'questionnaire-sum', scoringKey: 'questionnaire-sum' }),
  'assessment:ep-import:691eb4e43832246976294ae4': Object.freeze({ runnerKey: 'questionnaire-sum', scoringKey: 'questionnaire-sum' }),
  'assessment:ep-import:6933d97ed8d7afa0d779cc3f': Object.freeze({ runnerKey: 'questionnaire-sum', scoringKey: 'questionnaire-sum' }),
  'assessment:ep-import:6933d97ed8d7afa0d779cc40': Object.freeze({ runnerKey: 'questionnaire-sum', scoringKey: 'questionnaire-sum' }),
  'assessment:ep-import:6933d97ed8d7afa0d779cc7b': Object.freeze({ runnerKey: 'questionnaire-sum', scoringKey: 'questionnaire-sum' }),
});

export function buildCanonicalQuestionnaireRunnerSpec({ questions, runnerKey, scoringKey }) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error(`${scoringKey} canonical questionnaire has no ordered items`);
  }
  return withImplementation(
    Object.freeze({
      schemaVersion: 1,
      kind: 'questionnaire',
      runnerKey,
      scoringKey,
      fields: Object.freeze([]),
      items: Object.freeze(questions.map((question, index) => Object.freeze({
        ...question,
        key: question.key || `q${index + 1}`,
        prompt: question.prompt || question.question_text,
        required: question.required !== false,
      }))),
      scoring: Object.freeze({
        method: scoringKey === 'bpi'
          ? 'bpi-four-item-severity-mean-and-seven-item-interference-mean'
          : 'sum-canonical-option-values',
        version: scoringKey === 'bpi'
          ? 'bpi-short-form-severity-4-interference-7'
          : 'canonical-questionnaire-sum.v1',
      }),
      result: Object.freeze({
        primaryField: scoringKey === 'bpi' ? 'pain_severity_score' : 'total_score',
        unit: 'points',
        additionalDataFields: Object.freeze(['responses', 'soap_text']),
      }),
    }),
    'src/components/assessments/QuestionnaireRunner.jsx',
    'src/lib/clinical/assessmentScoring.js',
  );
}

export const PHYSIO_RUNTIME_SPEC_OVERLAYS = Object.freeze({
  ...EXTRAS_BODY_FITNESS_RUNTIME_SPEC_OVERLAYS,
  ...EXTRAS_FUNCTIONAL_ORTHO_RUNTIME_SPEC_OVERLAYS,
  ...EXTRAS_MOBILITY_BALANCE_ORTHO_RUNTIME_SPEC_OVERLAYS,
  ...EXTRAS_PROM_NEURO_RUNTIME_SPEC_OVERLAYS,
  ...EXTRAS_PHYSIOLOGICAL_RUNTIME_SPEC_OVERLAYS,
  ...CORE_B_RUNTIME_SPEC_OVERLAYS,
  ...CORE_A_RUNTIME_SPEC_OVERLAYS,
  ...RESIDUAL_ASSESSMENT_RUNTIME_SPEC_OVERLAYS,
  ...STANDALONE_AND_FIM_RUNTIME_SPEC_OVERLAYS,
  'assessment:physio-component:balance-error-scoring-system': Object.freeze({
    runnerSpec: withImplementation(
      BESS_RUNNER_SPEC,
      'src/components/assessments/BESSRunner.jsx',
      'src/lib/clinical/scorers/maintainedPhysioAdditions.js',
    ),
  }),
  'assessment:physio-component:air-displacement-plethysmography-bod-pod': Object.freeze({
    runnerSpec: withImplementation(
      BOD_POD_RUNNER_SPEC,
      'src/components/assessments/AirDisplacementPlethysmographyBodPodRunner.jsx',
      'src/lib/clinical/scorers/maintainedPhysioAdditions.js',
    ),
  }),
  'assessment:physio-component:expanded-disability-status-scale': Object.freeze({
    runnerSpec: withImplementation(
      EDSS_RUNNER_SPEC,
      'src/components/assessments/EDSSRunner.jsx',
      'src/lib/clinical/scorers/maintainedPhysioAdditions.js',
    ),
  }),
  'assessment:physio-component:international-physical-activity-questionnaire-short-form': Object.freeze({
    runnerSpec: withImplementation(
      IPAQ_SHORT_FORM_RUNNER_SPEC,
      'src/components/assessments/IPAQRunner.jsx',
      'src/lib/clinical/scorers/maintainedPhysioAdditions.js',
    ),
    questions: Object.freeze(questionnaireItems(IPAQ_SHORT_FORM_RUNNER_SPEC.items)),
    isQuestionnaire: true,
  }),
  'assessment:physio-component:edmonton-frail-scale': Object.freeze({
    runnerSpec: withImplementation(
      EFS_RUNNER_SPEC,
      'src/components/assessments/EdmontonFrailScaleEFSRunner.jsx',
      'src/lib/clinical/scorers/maintainedPhysioAdditions.js',
    ),
    questions: Object.freeze(questionnaireItems(EFS_RUNNER_SPEC.items)),
    isQuestionnaire: true,
  }),
  'assessment:physio-component:timed-up-and-down-stairs': Object.freeze({
    runnerSpec: withImplementation(
      TUDS_RUNNER_SPEC,
      'src/components/assessments/TUDSRunner.jsx',
      'src/lib/clinical/tuds.js',
    ),
  }),
  'assessment:ep-import:6875c72f2289fc627a74b0c1': Object.freeze({
    runnerSpec: withImplementation(
      Object.freeze({
        schemaVersion: 1,
        kind: 'measurement',
        runnerKey: 'ankle-dorsiflexion-rom',
        scoringKey: 'ankle-dorsiflexion-rom',
        fields: STRUCTURED_ASSESSMENT_FIELDS['ankle-dorsiflexion-rom'],
        scoring: Object.freeze({ method: 'direct-angle', version: 'ankle-dorsiflexion-rom.v1' }),
        result: Object.freeze({
          primaryField: 'degrees',
          unit: 'degrees',
          additionalDataFields: Object.freeze(['side', 'knee_position', 'soap_text']),
        }),
      }),
      'src/components/assessments/StructuredAssessmentRunner.jsx',
      'src/lib/clinical/assessmentScoring.js',
    ),
  }),
  'assessment:ep-synthetic:dass-21': Object.freeze({
    runnerSpec: withImplementation(
      Object.freeze({
        schemaVersion: 1,
        kind: 'questionnaire',
        runnerKey: 'dass21',
        scoringKey: 'dass21',
        fields: Object.freeze([]),
        items: Object.freeze(DASS21_QUESTIONS.map((question, index) => Object.freeze({
          key: `q${index + 1}`,
          prompt: question.text,
          domain: question.category,
          required: true,
          options: Object.freeze(DASS21_OPTIONS.map((label, value) => Object.freeze({ label, value }))),
        }))),
        scoring: Object.freeze({
          method: 'three-seven-item-subscale-sums-multiplied-by-two',
          version: 'dass21.v1',
          subscales: Object.freeze(['depression', 'anxiety', 'stress']),
        }),
        result: Object.freeze({
          primaryField: 'combined_subscale_total',
          unit: 'points',
          additionalDataFields: Object.freeze([
            'depression_score',
            'anxiety_score',
            'stress_score',
            'items',
            'soap_text',
          ]),
        }),
        provenance: Object.freeze({ sourceCitation: DASS21_SOURCE }),
      }),
      'src/components/assessments/DASS21Runner.jsx',
      'src/lib/clinical/dass21.js',
    ),
    questions: Object.freeze(DASS21_QUESTIONS.map((question, index) => Object.freeze({
      key: `q${index + 1}`,
      question_text: question.text,
      question_type: 'single_choice',
      domain: question.category,
      required: true,
      options: Object.freeze(DASS21_OPTIONS.map((label, value) => Object.freeze({ label, value }))),
    }))),
    isQuestionnaire: true,
  }),
  'assessment:ep-import:691eb419ae95315ff3bad4fa': Object.freeze({
    runnerSpec: withImplementation(
      TSK_RUNNER_SPEC,
      'src/components/assessments/TampaScaleKinesiophobiaTSK17Runner.jsx',
      'src/lib/clinical/scorers/classDRepairs.js',
    ),
    questions: Object.freeze(questionnaireItems(TSK_RUNNER_SPEC.items)),
    isQuestionnaire: true,
  }),
  'assessment:ep-import:6933cc3f697c55fe37e0bc21': Object.freeze({
    runnerSpec: withImplementation(
      TEN_RM_RUNNER_SPEC,
      'src/components/assessments/TenRepetitionMaximum10RMRunner.jsx',
      'src/lib/clinical/scorers/classDRepairs.js',
    ),
  }),
  'assessment:ep-import:6933d97ed8d7afa0d779cc81': Object.freeze({
    runnerSpec: withImplementation(
      BIA_RUNNER_SPEC,
      'src/components/assessments/BioelectricalImpedanceAnalysisBIARunner.jsx',
      'src/lib/clinical/scorers/classDRepairs.js',
    ),
  }),
});
