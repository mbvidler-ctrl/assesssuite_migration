// Ported from base44/functions/createTestClientWithAssessments/entry.ts.
//
// DELIBERATE, DOCUMENTED DEVIATION FROM CAPTURED SOURCE: the captured
// entry.ts has no role gate at all — any authenticated caller with an org
// membership can create a synthetic client and a full set of assessment
// records inside their own organisation. On the live Base44 platform this
// is a maintenance/seed-data tool with no ordinary-user invocation surface;
// its unrestricted availability is a live-platform security defect recorded
// in docs/qa/20260703-role-entitlement-isolation-analysis.md (G6 finding,
// remediation queue item 2). The finding stands against the live app
// unchanged; the shim hardens this ported copy by requiring the caller to
// be an authenticated admin, matching the function's intended admin-only
// invocation surface. Guard idiom copied verbatim from
// server/functions/getComorbidityReport.mjs. All subsequent logic
// (org-membership lookup, client/assessment creation) is preserved
// unchanged for admin callers.

// Helper to pick a random number in range.
const rnd = (min, max) => Math.round((Math.random() * (max - min) + min) * 10) / 10;
const rndInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Generate rich additional_data based on assessment name.
function generateAssessmentData(assessment) {
  const name = assessment.name.toLowerCase();
  let resultValue = 50;
  let additionalData = {};

  // -- GAIT & MOBILITY ---------------------------------------------------
  if (name.includes('6-meter walk') || name.includes('6 meter walk')) {
    resultValue = rnd(0.9, 1.4);
    additionalData = {
      measurement_type: '6_meter_walk_test',
      best_speed_ms: resultValue,
      best_time_s: Math.round((6 / resultValue) * 10) / 10,
      average_speed_ms: Math.round((resultValue - 0.05) * 100) / 100,
      interpretation: resultValue >= 1.2 ? 'Normal community ambulator' : 'Below community ambulation threshold',
      gait_aids: 'None',
      footwear: 'Athletic shoes',
    };
  } else if (name.includes('10-meter walk') || name.includes('10 meter walk') || name.includes('10mwt')) {
    const speed = rnd(0.8, 1.3);
    resultValue = speed;
    additionalData = {
      measurement_type: 'ten_meter_walk',
      ten_meter_walk_data: {
        walking_speed_type: 'comfortable',
        average_speed: speed,
        average_time: Math.round((10 / speed) * 10) / 10,
        interpretation: speed >= 1.0 ? 'Community ambulator' : 'Limited community ambulator',
        assistive_device: 'none',
        trials: [
          { time: Math.round((10 / (speed + 0.05)) * 10) / 10, steps: rndInt(12, 16), observations: 'Smooth gait' },
          { time: Math.round((10 / speed) * 10) / 10, steps: rndInt(12, 16), observations: '' },
          { time: Math.round((10 / (speed - 0.03)) * 10) / 10, steps: rndInt(12, 16), observations: '' },
        ],
      },
    };
  } else if (name.includes('400-meter walk') || name.includes('400 meter walk')) {
    resultValue = rndInt(320, 420);
    additionalData = {
      measurement_type: '400_meter_walk_test',
      total_time_seconds: resultValue,
      distance_covered_m: 400,
      completed: true,
      number_of_rests: 1,
      laps: [
        { lap_number: 1, lap_time_seconds: rndInt(88, 100) },
        { lap_number: 2, lap_time_seconds: rndInt(88, 100) },
        { lap_number: 3, lap_time_seconds: rndInt(90, 105) },
        { lap_number: 4, lap_time_seconds: rndInt(85, 100) },
      ],
      rest_breaks: [{ duration_seconds: rndInt(20, 45) }],
      gait_observations: 'Mild antalgic gait, reduced stride length bilaterally',
      symptoms_observed: 'Mild breathlessness, no chest pain',
    };
  } else if (name.includes('timed up and go') || (name.includes('tug') && !name.includes('shoulder'))) {
    const time = rnd(9, 16);
    resultValue = time;
    additionalData = {
      measurement_type: 'tug',
      tug_data: {
        time_seconds: time,
        averageTime: time,
        trials: [rnd(time, time + 1.5), time, rnd(time - 0.5, time + 0.5)],
        steps_taken: rndInt(14, 18),
        assistive_device: 'none',
        required_assistance: 'none',
        observations: 'Some trunk sway on turning, cautious pace',
        interpretation: time < 12 ? 'Low fall risk' : time < 20 ? 'Moderate fall risk - monitor' : 'High fall risk',
      },
    };
  } else if (name.includes('8-foot up') || (name.includes('8 foot') && name.includes('go'))) {
    const time = rnd(10, 16);
    resultValue = time;
    additionalData = {
      measurement_type: 'eight_foot_up_and_go',
      best_time_s: time,
      trials: [
        { trial_number: 1, time_seconds: rnd(time, time + 1.2) },
        { trial_number: 2, time_seconds: time },
        { trial_number: 3, time_seconds: rnd(time - 0.3, time + 0.3) },
      ],
      chair_height: 'Standard 43cm',
      assistance_used: 'none',
      interpretation: time < 10 ? 'Low fall risk' : time < 20 ? 'Moderate fall risk' : 'High fall risk',
    };

  // -- BALANCE -------------------------------------------------------------
  } else if (name.includes('berg balance')) {
    resultValue = rndInt(40, 52);
    additionalData = {
      measurement_type: 'berg_balance',
      berg_data: {
        total: resultValue,
        interpretation:
          resultValue >= 45 ? 'Low fall risk' : resultValue >= 21 ? 'Moderate fall risk' : 'High fall risk - wheelchair recommended',
        scores: { 1: 4, 2: 4, 3: 4, 4: 3, 5: 4, 6: 3, 7: 4, 8: 3, 9: 3, 10: 4, 11: 3, 12: 3, 13: 4, 14: 3 },
      },
    };
  } else if (name.includes('single leg stance') || name.includes('single-leg stance')) {
    resultValue = rndInt(12, 25);
    additionalData = {
      measurement_type: 'single_leg_stance',
      sls_left_eyes_open: rndInt(15, 28),
      sls_right_eyes_open: resultValue,
      sls_left_eyes_closed: rndInt(4, 10),
      sls_right_eyes_closed: rndInt(4, 10),
      sls_dominant_leg: 'right',
      sls_required_support: false,
    };
  } else if (name.includes('y-balance') || name.includes('y balance')) {
    resultValue = rnd(82, 96);
    additionalData = {
      measurement_type: 'y_balance',
      ybt_limb_length_left: 92,
      ybt_limb_length_right: 93,
      ybt_left_anterior: rndInt(62, 72),
      ybt_left_posteromedial: rndInt(95, 110),
      ybt_left_posterolateral: rndInt(88, 100),
      left_composite: rnd(84, 96),
      ybt_right_anterior: rndInt(62, 72),
      ybt_right_posteromedial: rndInt(95, 110),
      ybt_right_posterolateral: rndInt(88, 100),
      right_composite: resultValue,
      anterior_asymmetry: rnd(1, 3.5),
    };
  } else if (
    name.includes('four stage balance') ||
    name.includes('4-stage balance') ||
    name.includes('4 stage balance')
  ) {
    resultValue = 3;
    additionalData = {
      measurement_type: '4_stage_balance',
      four_stage_feet_together: 'pass',
      four_stage_semi_tandem: 'pass',
      four_stage_tandem: 'pass',
      four_stage_single_leg: 'fail',
      fall_risk: 'not_elevated',
    };
  } else if (name.includes('functional reach')) {
    resultValue = rndInt(22, 32);
    additionalData = {
      measurement_type: 'functional_reach',
      reach_trial1: rndInt(22, 32),
      reach_trial2: rndInt(22, 32),
      best_reach_cm: resultValue,
      standing_height_cm: 172,
      interpretation: resultValue >= 25 ? 'Low fall risk' : 'Elevated fall risk',
    };

  // -- CARDIORESPIRATORY -----------------------------------------------------
  } else if (name.includes('6-minute walk') || name.includes('6 minute walk') || name.includes('6mwt')) {
    resultValue = rndInt(380, 520);
    additionalData = {
      measurement_type: 'six_minute_walk',
      sixmwt_laps: rndInt(7, 10),
      sixmwt_rest_periods: 0,
      sixmwt_terminated: false,
      sixmwt_test_duration: 360,
      sixmwt_pre_hr: rndInt(68, 80),
      sixmwt_pre_bp_sys: rndInt(118, 135),
      sixmwt_pre_bp_dia: rndInt(72, 85),
      sixmwt_pre_spo2: rndInt(96, 99),
      sixmwt_pre_rpe: rndInt(6, 9),
      sixmwt_post_hr: rndInt(110, 140),
      sixmwt_post_spo2: rndInt(94, 98),
      sixmwt_post_rpe: rndInt(13, 16),
      sixmwt_post_dyspnea: rndInt(2, 5),
    };
  } else if (name.includes('6-minute step') || name.includes('6 minute step')) {
    resultValue = rndInt(55, 90);
    additionalData = {
      measurement_type: '6_minute_step_test',
      steps_completed: resultValue,
      step_height_cm: 20,
      pre_hr: rndInt(68, 78),
      post_hr: rndInt(105, 135),
      pre_spo2: 97,
      post_spo2: rndInt(93, 97),
      rpe_post: rndInt(12, 16),
    };
  } else if (name.includes('heart rate recovery') || name.includes('hrr')) {
    resultValue = rndInt(15, 28);
    additionalData = {
      measurement_type: 'heart_rate_recovery',
      hrr_peak_hr: rndInt(145, 165),
      hrr_1min: rndInt(120, 138),
      hrr_2min: rndInt(105, 120),
      hrr_3min: rndInt(95, 108),
      hrr_at_1min: resultValue,
      hrr_at_2min: rndInt(22, 38),
      hrr_at_3min: rndInt(32, 50),
    };
  } else if (name.includes('2-minute walk') || name.includes('2 minute walk') || name.includes('2mwt')) {
    resultValue = rndInt(140, 185);
    additionalData = {
      measurement_type: '2mwt',
      distance_m: resultValue,
      pre_hr: rndInt(68, 78),
      post_hr: rndInt(95, 120),
      pre_spo2: 97,
      post_spo2: rndInt(94, 97),
      rpe_post: rndInt(10, 14),
    };
  } else if (name.includes('2-minute step') || name.includes('2 minute step')) {
    resultValue = rndInt(60, 90);
    additionalData = {
      measurement_type: '2min_step',
      two_min_step_rpe: rndInt(11, 15),
      two_min_step_breathlessness: rndInt(2, 5),
      two_min_step_pain: rndInt(0, 3),
    };
  } else if (name.includes('rockport')) {
    resultValue = rnd(35, 48);
    additionalData = {
      measurement_type: 'rockport',
      walk_time_min: rnd(14, 18),
      heart_rate_bpm: rndInt(100, 130),
      weight_kg: rndInt(70, 90),
      estimated_vo2max: resultValue,
      classification: resultValue >= 42 ? 'Good' : 'Average',
    };
  } else if (name.includes('beep test') || name.includes('20 meter shuttle') || name.includes('20-meter shuttle')) {
    resultValue = rnd(6, 10);
    additionalData = {
      measurement_type: 'beep_test',
      level_reached: Math.floor(resultValue),
      shuttle_reached: rndInt(1, 8),
      estimated_vo2max: rnd(35, 52),
      max_hr: rndInt(155, 185),
      rpe_final: rndInt(17, 20),
    };

  // -- STRENGTH --------------------------------------------------------------
  } else if (name.includes('grip strength') || name.includes('hand grip')) {
    resultValue = rndInt(32, 48);
    additionalData = {
      measurement_type: 'hand_grip_strength',
      dominant_hand: 'right',
      dominant_trial_1: rndInt(30, 50),
      dominant_trial_2: rndInt(30, 50),
      dominant_trial_3: rndInt(30, 50),
      dominant_best: resultValue,
      non_dominant_trial_1: rndInt(25, 42),
      non_dominant_trial_2: rndInt(25, 42),
      non_dominant_trial_3: rndInt(25, 42),
      non_dominant_best: rndInt(25, 42),
    };
  } else if (name.includes('1 repetition') || name.includes('1rm') || name.includes('one rep')) {
    resultValue = rndInt(60, 120);
    additionalData = {
      measurement_type: '1rm_testing',
      exercise_tested: 'Leg Press',
      one_rm_load: resultValue,
      units: 'kg',
      relative_strength: Math.round((resultValue / 80) * 100) / 100,
      normative_label: resultValue >= 100 ? 'Intermediate' : 'Novice',
      equipment_type: 'Machine',
      spotter_used: true,
      rpe_post: rndInt(8, 10),
      pain_post: rndInt(0, 2),
      attempts: [
        { attemptNumber: 1, load: resultValue - 20, success: true },
        { attemptNumber: 2, load: resultValue - 10, success: true },
        { attemptNumber: 3, load: resultValue, success: true },
        { attemptNumber: 4, load: resultValue + 10, success: false },
      ],
      interpretation_summary: `Client achieved ${resultValue}kg on the leg press, representing ${
        Math.round((resultValue / 80) * 100) / 100
      }x body mass. Classified as ${resultValue >= 100 ? 'Intermediate' : 'Novice'} for age-matched peers.`,
    };
  } else if ((name.includes('sit') && name.includes('stand')) || name.includes('sts')) {
    resultValue = rndInt(8, 16);
    additionalData = {
      rpe_scale: rndInt(10, 14),
      breathlessness_scale: rndInt(1, 4),
      pain_scale: rndInt(0, 3),
    };
  } else if (name.includes('push') && name.includes('up')) {
    resultValue = rndInt(10, 30);
    additionalData = {
      measurement_type: 'push_up_test',
      reps_completed: resultValue,
      test_type: 'standard',
      post_hr: rndInt(100, 130),
      rpe_post: rndInt(12, 16),
      form_breakdown: false,
    };

  // -- JUMP & PLYOMETRIC -------------------------------------------------------
  } else if (
    name.includes('10-second repeated jump') ||
    name.includes('10 second repeated jump') ||
    name.includes('reactive strength index')
  ) {
    const jumps = Array.from({ length: 10 }, () => ({
      flight_time_ms: rndInt(150, 220),
      contact_time_ms: rndInt(180, 280),
      jump_height_cm: rnd(15, 28),
    }));
    const rsiValues = jumps.map((j) => j.flight_time_ms / j.contact_time_ms);
    resultValue = Math.round(Math.max(...rsiValues) * 1000) / 1000;
    additionalData = {
      measurement_type: '10_second_repeated_jump',
      total_jumps: 10,
      best_rsi: resultValue,
      average_rsi: Math.round((rsiValues.reduce((a, b) => a + b, 0) / rsiValues.length) * 1000) / 1000,
      average_flight_time_ms: Math.round(jumps.reduce((a, j) => a + j.flight_time_ms, 0) / jumps.length),
      average_contact_time_ms: Math.round(jumps.reduce((a, j) => a + j.contact_time_ms, 0) / jumps.length),
      fatigue_index: rnd(5, 18),
      jumps,
    };
  } else if (name.includes('vertical jump') || name.includes('sargent')) {
    resultValue = rndInt(28, 48);
    additionalData = {
      measurement_type: 'vertical_jump',
      jump_height_cm: resultValue,
      standing_reach_cm: rndInt(210, 240),
      jump_reach_cm: rndInt(240, 270),
      trial_heights: [rndInt(25, 45), resultValue, rndInt(25, 45)],
    };

  // -- AGILITY -----------------------------------------------------------------
  } else if (name.includes('505 agility')) {
    resultValue = rnd(2.1, 3.0);
    additionalData = {
      measurement_type: '505_agility',
      best_left: rnd(2.1, 3.0),
      best_right: resultValue,
      dominant_leg: 'right',
      asymmetry_pct: rnd(1, 8),
    };

  // -- BODY COMPOSITION ----------------------------------------------------------
  } else if (name.includes('bmi') || name.includes('body mass index')) {
    resultValue = rnd(22, 30);
    additionalData = {
      measurement_type: 'bmi',
      weight_kg: rndInt(70, 95),
      height_cm: rndInt(165, 182),
      bmi: resultValue,
      category: resultValue < 25 ? 'Normal weight' : resultValue < 30 ? 'Overweight' : 'Obese class I',
    };
  } else if (name.includes('waist circumference')) {
    resultValue = rndInt(82, 100);
    additionalData = {
      measurement_type: 'waist_circumference',
      waist_cm: resultValue,
      risk_level: resultValue > 94 ? 'Increased risk (>94cm)' : 'Low risk',
    };
  } else if (name.includes('skinfold') || name.includes('body fat')) {
    resultValue = rnd(18, 26);
    additionalData = {
      measurement_type: 'skinfolds',
      body_fat_pct: resultValue,
      tricep_mm: rndInt(10, 18),
      subscapular_mm: rndInt(12, 20),
      suprailiac_mm: rndInt(10, 22),
      abdominal_mm: rndInt(15, 30),
      sum_of_folds_mm: rndInt(55, 90),
      formula_used: 'Jackson & Pollock 3-site',
    };

  // -- PAIN / FUNCTION / QUESTIONNAIRES ------------------------------------------
  } else if (name.includes('dass')) {
    resultValue = rndInt(14, 26);
    additionalData = {
      measurement_type: 'dass21',
      depression_score: rndInt(2, 10),
      anxiety_score: rndInt(4, 12),
      stress_score: rndInt(8, 16),
      raw_scores: {},
    };
  } else if (name.includes('phq-9') || name.includes('phq9') || name.includes('patient health questionnaire')) {
    resultValue = rndInt(3, 10);
    additionalData = { measurement_type: 'questionnaire', responses: Array(9).fill(0).map(() => rndInt(0, 2)) };
  } else if (name.includes('gad-7') || name.includes('gad7')) {
    resultValue = rndInt(2, 9);
    additionalData = { measurement_type: 'questionnaire', responses: Array(7).fill(0).map(() => rndInt(0, 2)) };
  } else if (name.includes('pain') && (name.includes('scale') || name.includes('vas') || name.includes('nprs'))) {
    resultValue = rndInt(2, 6);
    additionalData = {
      measurement_type: 'pain_scales',
      pain_locations: [
        { region: 'lower_back', intensity: rndInt(2, 6) },
        { region: 'right_knee', intensity: rndInt(1, 4) },
      ],
    };
  } else if (name.includes('oswestry') || name.includes('odi')) {
    resultValue = rndInt(18, 36);
    additionalData = { measurement_type: 'questionnaire', responses: Array(10).fill(0).map(() => rndInt(1, 4)) };
  } else if (name.includes('kessler') || name.includes('k-10') || name.includes('k10')) {
    resultValue = rndInt(16, 26);
    additionalData = { measurement_type: 'questionnaire', responses: Array(10).fill(0).map(() => rndInt(1, 4)) };
  } else if (name.includes('berg') && !name.includes('balance')) {
    resultValue = rndInt(25, 45);
    additionalData = { measurement_type: 'questionnaire', responses: Array(14).fill(0).map(() => rndInt(0, 4)) };

  // -- NEUROLOGICAL ----------------------------------------------------------------
  } else if (name.includes('moca') || name.includes('montreal cognitive')) {
    resultValue = rndInt(22, 28);
    additionalData = {
      measurement_type: 'moca',
      total_score: resultValue,
      education_adjustment: false,
      interpretation: resultValue >= 26 ? 'Normal cognition' : 'Mild cognitive impairment',
    };

  // -- ROM -----------------------------------------------------------------------
  } else if (
    name.toLowerCase().includes('range of motion') ||
    (name.toLowerCase().includes('rom') && !name.toLowerCase().includes('from'))
  ) {
    resultValue = 8;
    const jointName = name.includes('shoulder')
      ? 'Shoulder'
      : name.includes('knee')
        ? 'Knee'
        : name.includes('hip')
          ? 'Hip'
          : name.includes('ankle')
            ? 'Ankle'
            : 'Lumbar';
    additionalData = {
      measurement_type: 'rom_assessment',
      rom_data: {
        jointName,
        measurements: {
          Flexion: { left: rndInt(100, 145), right: rndInt(100, 145) },
          Extension: { left: rndInt(10, 30), right: rndInt(10, 30) },
          'Internal Rotation': { left: rndInt(35, 55), right: rndInt(35, 55) },
          'External Rotation': { left: rndInt(40, 60), right: rndInt(40, 60) },
        },
        comments: { Flexion: 'Minor restriction at end range', Extension: '' },
      },
    };

  // -- VITAL SIGNS -----------------------------------------------------------------
  } else if (name.includes('blood pressure') || name.includes('resting blood pressure')) {
    resultValue = 124;
    additionalData = {
      measurement_type: 'blood_pressure',
      pre_exercise_systolic: rndInt(115, 135),
      pre_exercise_diastolic: rndInt(70, 85),
      post_exercise_systolic: rndInt(130, 155),
      post_exercise_diastolic: rndInt(72, 88),
    };
  } else if (name.includes('resting heart rate') || (name.includes('heart rate') && name.includes('resting'))) {
    resultValue = rndInt(58, 78);
    additionalData = {
      measurement_type: 'heart_rate',
      pre_exercise_hr: resultValue,
      post_exercise_hr: rndInt(80, 100),
    };
  } else if (name.includes('spo2') || name.includes('oxygen saturation')) {
    resultValue = rndInt(96, 99);
    additionalData = {
      measurement_type: 'spo2',
      pre_exercise_spo2: resultValue,
      post_exercise_spo2: rndInt(93, 98),
    };

  // -- QUESTIONNAIRE (generic) ------------------------------------------------------
  } else if (assessment.is_questionnaire && assessment.questions && assessment.questions.length > 0) {
    resultValue = rndInt(12, 30);
    additionalData = {
      measurement_type: 'questionnaire',
      responses: assessment.questions.map((q) => {
        if (q.question_type === 'yes_no') return rndInt(0, 1);
        if (q.options && q.options.length > 0) return q.options[rndInt(0, q.options.length - 1)].value;
        return rndInt(0, 3);
      }),
    };

  // -- GENERIC FALLBACK ---------------------------------------------------------------
  } else {
    resultValue = rndInt(20, 80);
    additionalData = {
      measurement_type: assessment.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      result: resultValue,
      unit: assessment.unit_of_measure || '',
      test_conditions: 'Standardised protocol followed',
      clinician_notes: 'Client cooperative and well motivated. No adverse events. Results recorded per protocol.',
    };
  }

  return { resultValue, additionalData };
}

export default async function createTestClientWithAssessments(ctx) {
  const { user, entities, respond } = ctx;

  if (user?.role !== 'admin') {
    return respond(403, { error: 'Forbidden: Admin access required' });
  }

  const orgMemberships = await entities.OrganizationMember.filter({ user_email: user.email });
  const orgId = orgMemberships?.[0]?.org_id;

  if (!orgId) {
    return respond(400, { error: 'No organization found' });
  }

  const fakeClient = await entities.Client.create({
    org_id: orgId,
    full_name: 'Test Client - Automated',
    date_of_birth: '1980-05-15',
    gender: 'male',
    consent_confirmed: true,
    assigned_clinician_email: user.email,
  });

  const allAssessments = await entities.Assessment.list();

  const now = new Date();
  const appointment = await entities.Appointment.create({
    org_id: orgId,
    client_id: fakeClient.id,
    title: 'Automated Test Session',
    start_time: now.toISOString(),
    end_time: new Date(now.getTime() + 2 * 60 * 60000).toISOString(),
    status: 'completed',
  });

  const soapNote = await entities.SOAPNote.create({
    org_id: orgId,
    client_id: fakeClient.id,
    appointment_id: appointment.id,
    note_date: now.toISOString(),
    objective: 'Automated Assessment Session\n',
    status: 'draft',
  });

  const results = {
    client_id: fakeClient.id,
    client_name: fakeClient.full_name,
    assessments_processed: 0,
    assessments_skipped: 0,
    assessment_results: [],
  };

  let runningObjective = soapNote.objective;

  for (const assessment of allAssessments) {
    if (assessment.is_deleted) {
      results.assessments_skipped++;
      continue;
    }

    try {
      const { resultValue, additionalData } = generateAssessmentData(assessment);

      const clientAssessment = await entities.ClientAssessment.create({
        org_id: orgId,
        client_id: fakeClient.id,
        assessment_id: assessment.id,
        appointment_id: appointment.id,
        status: 'completed',
        result_value: resultValue,
        assessment_date: now.toISOString().split('T')[0],
        additional_data: additionalData,
        notes: `Automated test data for ${assessment.name}`,
      });

      const objectiveText = `- ${assessment.name}: ${resultValue} ${assessment.unit_of_measure || ''}\n`;
      runningObjective += objectiveText;
      await entities.SOAPNote.update(soapNote.id, { objective: runningObjective });

      results.assessments_processed++;
      results.assessment_results.push({
        assessment_name: assessment.name,
        result_value: resultValue,
        client_assessment_id: clientAssessment.id,
      });
    } catch (error) {
      results.assessments_skipped++;
    }
  }

  return respond(200, {
    success: true,
    message: `Created test client and ${results.assessments_processed} assessments`,
    data: results,
  });
}
