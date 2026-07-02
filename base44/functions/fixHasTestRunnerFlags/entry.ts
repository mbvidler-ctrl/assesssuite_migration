import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ALL assessments that have runners (TestRunner.js + TestRunnerExtras.js + standalone wrappers)
function hasRunner(name) {
  const n = name.toLowerCase();
  // TestRunner.js runners
  if (n.includes('blood pressure')) return true;
  if (n.includes('heart rate') && !n.includes('recovery')) return true;
  if (n.includes('oxygen saturation') || (n.includes('spo2') && !n.includes('vitals'))) return true;
  if (n.includes('five-times sit') || n.includes('5xsts') || n.includes('five times sit')) return true;
  if (n.includes('hand grip') || n.includes('grip strength')) return true;
  if (n.includes('6') && n.includes('minute') && n.includes('walk')) return true;
  if (n.includes('2-minute step') || n.includes('2 minute step')) return true;
  if (n.includes('single leg stance') || n.includes('one-leg stance')) return true;
  if (n.includes('y-balance') || n.includes('y balance')) return true;
  if ((n.includes('10-meter') || n.includes('10 meter') || n.includes('ten meter') || n.includes('10mwt')) && n.includes('walk')) return true;
  if (n.includes('4-stage balance') || n.includes('4 stage balance') || n.includes('four stage balance')) return true;
  if (n.includes('gait speed') || n.includes('habitual gait') || n.includes('fast gait')) return true;
  if (n.includes('heart rate recovery')) return true;
  if (n.includes('pain scales') || n.includes('vas/nprs') || n.includes('vas / nprs')) return true;
  if (n.includes('range of motion') || n.includes('rom assessment')) return true;
  if (n.includes('ebbeling') || n.includes('single-stage treadmill')) return true;
  if (n.includes('moca') || n.includes('montreal cognitive')) return true;
  if (n.includes('manual muscle')) return true;
  if (n.includes('waist-hip') || n.includes('waist hip ratio')) return true;
  if (n.includes('body mass index') || n === 'bmi') return true;
  if (n.includes('waist circumference') && !n.includes('hip')) return true;
  if (n === 'height' || n === 'weight') return true;
  if (n.includes('berg balance')) return true;
  if (n.includes('timed up and go') || (n.includes('tug') && !n.includes('tuds'))) return true;
  if ((n.includes('chair stand') || (n.includes('sit to stand') || n.includes('sit-to-stand')))) return true;
  if (n.includes('functional reach')) return true;
  if (n.includes('back scratch')) return true;
  if (n.includes('sit and reach') || n.includes('sit & reach')) return true;
  if (n.includes('romberg')) return true;
  if (n.includes('stork')) return true;
  if (n.includes('ctsib') || n.includes('sensory interaction')) return true;
  if (n.includes('four square step') || n.includes('four-square')) return true;
  if (n.includes('skinfold')) return true;
  if (n.includes('girth measurement')) return true;
  if (n.includes('iswt') || n.includes('incremental shuttle walk')) return true;
  if (n.includes('harvard step')) return true;
  if (n.includes('box and block')) return true;
  if (n.includes('himat') || n.includes('high-level mobility')) return true;
  if (n.includes('astrand') || n.includes('Ã¥strand')) return true;
  if (n.includes('job task analysis') || n.includes('icare')) return true;
  if (n.includes('borg') && n.includes('rpe')) return true;
  if (n.includes('general movement screen')) return true;
  if (n.includes('gad-7') || n.includes('gad7') || n.includes('generalized anxiety disorder 7')) return true;
  if (n.includes('phq-9') || n.includes('phq9') || n.includes('patient health questionnaire 9')) return true;
  if (n.includes('arm curl') || n.includes('bicep curl')) return true;
  if (n.includes('k10') || n.includes('k-10') || n.includes('kessler')) return true;
  if (n.includes('hoos') || (n.includes('hip') && n.includes('osteoarthritis') && n.includes('outcome'))) return true;
  if (n.includes('koos') || (n.includes('knee') && n.includes('osteoarthritis') && n.includes('outcome'))) return true;
  if (n.includes('pediatric balance')) return true;
  if (n.includes('repeated jump') || n.includes('10-s repeated jump') || n.includes('10 second repeated')) return true;
  if (n.includes('ckcuest') || n.includes('closed kinetic chain upper')) return true;
  if (n.includes('1rm') || n.includes('1-repetition maximum') || n.includes('one repetition maximum') || n.includes('1 repetition maximum')) return true;
  if (n.includes('isometric strength')) return true;
  if (n.includes('isokinetic')) return true;
  if (n.includes("ely's test") || n.includes('ely test') || n.includes('rectus femoris')) return true;
  if (n.includes('thomas test') || n.includes('hip flexor tightness')) return true;
  if (n.includes("ober's test") || n.includes('ober test') || n.includes('itb tightness')) return true;
  if (n.includes('straight leg raise') || (n.includes('slr') && n.includes('test'))) return true;
  if (n.includes('slump test')) return true;
  if (n.includes('lachman')) return true;
  if (n.includes('anterior drawer') && n.includes('knee')) return true;
  if (n.includes('pivot shift')) return true;
  if (n.includes('mcmurray')) return true;
  if (n.includes('thessaly')) return true;
  if (n.includes("apley") || n.includes("apley's")) return true;
  if (n.includes('noble') && n.includes('compression')) return true;
  if (n.includes('bruce') && (n.includes('protocol') || n.includes('treadmill'))) return true;
  if (n.includes('modified bruce')) return true;
  if (n.includes('naughton')) return true;
  if (n.includes('ymca cycle') || n.includes('ymca bicycle')) return true;
  if (n.includes('wingate')) return true;
  if (n.includes('2 minute walk') || n.includes('2-minute walk') || n.includes('two minute walk')) return true;
  if (n.includes('cooper') || (n.includes('12 minute') && (n.includes('walk') || n.includes('run'))) || (n.includes('12-minute') && (n.includes('walk') || n.includes('run')))) return true;
  if (n.includes('beep test') || n.includes('20m shuttle') || n.includes('20-meter shuttle') || n.includes('20 meter shuttle')) return true;
  if (n.includes('yo-yo') || n.includes('yoyo')) return true;
  if (n.includes('30-15') || n.includes('30 15') || n.includes('30:15')) return true;
  if (n.includes('repeated sprint ability')) return true;
  if (n.includes('heart rate recovery') && (n.includes('1 and 2') || n.includes('â€“ 1') || n.includes('hrr'))) return true;
  if (n.includes('vo2max testing') || n.includes('vo2max test') || n.includes('maximal graded exercise') || n.includes('gxt')) return true;
  if (n.includes('hba1c') || n.includes('glycated hemoglobin')) return true;
  if (n.includes('lipid profile')) return true;
  if (n.includes('met calculation') || n.includes('metabolic equivalent') || n.includes('met calc')) return true;
  if (n.includes('6-minute step') || n.includes('6 minute step')) return true;
  if (n.includes('physical performance test') || (n.includes('ppt') && !n.includes('partial'))) return true;
  if (n.includes('community balance') || n.includes('cb&m') || n.includes('cbm')) return true;
  if (n.includes('bestest') || n.includes('balance evaluation systems')) return true;
  if (n.includes('elderly mobility scale') || n.includes('ems')) return true;
  if (n.includes('ymca 3-minute') || n.includes('ymca 3 minute') || n.includes('ymca 3-min')) return true;
  if (n.includes('dynamic gait index') || n.includes('dgi')) return true;
  if (n.includes('rockport') || n.includes('1-mile walk') || n.includes('1 mile walk')) return true;
  if (n.includes('dass-21') || n.includes('dass21') || n.includes('dass 21')) return true;
  if (n.includes('hospital anxiety and depression') || n.includes('hads')) return true;
  if (n.includes('clinical frailty scale') || n.includes('cfs')) return true;
  if (n.includes('ies-r') || n.includes('iesr') || n.includes('impact of event')) return true;
  if (n.includes('pcl-5') || n.includes('pcl5') || n.includes('ptsd checklist')) return true;
  if (n.includes('insomnia severity')) return true;
  if (n.includes('mrc dyspnea') || n.includes('mrc dyspnoea') || n.includes('medical research council dysp') || n.includes('mrc scale')) return true;
  if (n.includes('copd assessment test') || n.includes('cat questionnaire')) return true;
  if (n.includes('clinical copd questionnaire') || n.includes('ccq')) return true;
  if (n.includes('leicester cough')) return true;
  if (n.includes('ikdc') || n.includes('international knee documentation')) return true;
  if (n.includes('functional independence measure') || (n.includes('fim') && !n.includes('fiqr'))) return true;
  if (n.includes('barthel index') || n.includes('barthel')) return true;
  if (n.includes('rivermead mobility')) return true;
  if (n.includes('roland') && (n.includes('morris') || n.includes('disability'))) return true;
  if (n.includes('quickdash') || n.includes('quick dash') || n.includes('quick-dash')) return true;
  if (n.includes('faam') || n.includes('foot and ankle ability')) return true;
  if (n.includes('abc scale') || n.includes('activities-specific balance confidence')) return true;
  if (n.includes('chalder fatigue')) return true;
  if (n.includes('psqi') || n.includes('pittsburgh sleep quality')) return true;
  if (n.includes('sarc-f') || n.includes('sarcf') || n.includes('sarc f')) return true;
  if (n.includes('neck disability') || n.includes('ndi')) return true;
  if (n.includes('oswestry') || n.includes('odi')) return true;
  if (n.includes('ases') || n.includes('american shoulder and elbow')) return true;
  if (n.includes('dexa') || n.includes('dxa') || n.includes('bone density') || n.includes('air displacement') || n.includes('bod pod')) return true;
  if (n.includes('conley scale') || n.includes('conley fall')) return true;
  if (n.includes('perceived stress scale') || n.includes('pss-10') || n.includes('pss 10')) return true;
  if (n.includes('constant') && n.includes('murley')) return true;
  if (n.includes('lysholm')) return true;
  if (n.includes('acl-rsi') || n.includes('aclrsi') || n.includes('acl return to sport')) return true;
  if (n.includes('global rating of change') || n.includes('groc')) return true;
  if (n.includes("st george's respiratory") || n.includes('sgrq')) return true;
  if (n.includes('fabq') || n.includes('fear-avoidance beliefs') || n.includes('fear avoidance beliefs')) return true;
  if (n.includes('single leg hop')) return true;
  if (n.includes('drop vertical jump')) return true;
  if ((n.includes('vertical jump') || n.includes('sargent jump')) && !n.includes('drop')) return true;
  if (n.includes('standing long jump')) return true;
  if (n.includes('clock drawing')) return true;
  if (n.includes('trail making') || (n.includes('tmt') && n.includes('parts'))) return true;
  if (n.includes('tinetti') || n.includes('poma')) return true;
  if (n.includes('vital signs')) return true;
  if (n.includes('body fat percentage') || n.includes('body fat %')) return true;
  if (n.includes('body measurements') || (n.includes('skinfold') && !n.includes('skinfolds'))) return true;
  // Standalone wrappers
  if (n.includes('6') && n.includes('meter') && n.includes('walk')) return true;
  if (n.includes('8') && n.includes('foot') && n.includes('up') && n.includes('go')) return true;
  if (n.includes('400') && n.includes('meter') && n.includes('walk')) return true;
  if (n.includes('6') && n.includes('minute') && n.includes('step')) return true;
  // TestRunnerExtras.js runners
  if (n.includes('illinois agility')) return true;
  if (n.includes('t-test agility') || n === 't test agility') return true;
  if (n.includes('505 agility') || n.includes('five-oh-five')) return true;
  if (n.includes('hexagon agility')) return true;
  if (n.includes('l test') && n.includes('mobility')) return true;
  if (n.includes('figure') && n.includes('eight') && n.includes('walk')) return true;
  if (n.includes('falls efficacy scale')) return true;
  if (n.includes('bruininks') || n.includes('bot-2') || n.includes('bot2')) return true;
  if (n.includes('bioelectrical impedance') || n.includes('bia')) return true;
  if (n.includes('hydrostatic weighing') || n.includes('underwater weighing')) return true;
  if (n.includes('fasting blood glucose')) return true;
  if (n.includes('oral glucose tolerance') || n.includes('ogtt')) return true;
  if (n.includes('resting metabolic rate') || n.includes('rmr testing')) return true;
  if (n.includes('beighton') || n.includes('hypermobility score')) return true;
  if (n.includes('chester step')) return true;
  if (n.includes('edmonton frail') || n.includes('efs')) return true;
  if (n.includes('endurance shuttle walk') || n.includes('eswt')) return true;
  if (n.includes('fatigue severity scale') || n.includes('fss')) return true;
  if (n.includes('fibromyalgia impact') || n.includes('fiqr')) return true;
  if (n.includes('forced vital capacity') || n.includes('fvc') || n.includes('spirometry')) return true;
  if (n.includes('functional ambulation') || n.includes('fac')) return true;
  if (n.includes('functional gait assessment') || n.includes('fga')) return true;
  if (n.includes('maximal push') || n.includes('maximum push')) return true;
  if (n.includes('mcgill core') || n.includes('biering-sorensen') || (n.includes('core endurance') && n.includes('battery'))) return true;
  if (n.includes('modified ashworth') || (n.includes('mas') && n.includes('spasticity'))) return true;
  if (n.includes('modified rankin')) return true;
  if (n.includes('nine hole peg') || n.includes('9-hole peg') || n.includes('nine-hole peg')) return true;
  if (n.includes('pain catastrophizing') || n.includes('pcs')) return true;
  if (n.includes('peak expiratory flow') || n.includes('pefr') || n.includes('peak flow')) return true;
  if (n.includes('plank hold') || n.includes('plank test')) return true;
  if (n.includes('push up test') || n.includes('press up test') || n.includes('timed push')) return true;
  if (n.includes('sebt') || n.includes('star excursion')) return true;
  if (n.includes('sf-36') || n.includes('sf 36') || n.includes('36-item short form')) return true;
  if (n.includes('short physical performance battery') || n.includes('sppb')) return true;
  if (n.includes('squat test') || n.includes('dynamic squat') || n.includes('overhead squat')) return true;
  if (n.includes('stair climb')) return true;
  if (n.includes('static back extension') || (n.includes('biering') && n.includes('sorensen'))) return true;
  if (n.includes('stroop test') || n.includes('stroop color')) return true;
  if (n.includes('tandem stand balance')) return true;
  if (n.includes('trendelenburg')) return true;
  if (n.includes('triple hop')) return true;
  if (n.includes('womac')) return true;
  if (n.includes('widespread pain index') || n.includes('wpi') || n.includes('symptom severity scale')) return true;
  if (n.includes('ipaq') || n.includes('international physical activity questionnaire')) return true;
  if (n.includes('lefs') || n.includes('lower extremity functional scale')) return true;
  if (n.includes('goal attainment scaling') || n.includes('gas scale')) return true;
  if (n.includes('digit span')) return true;
  if (n.includes('dual task gait') || n.includes('dual-task gait')) return true;
  if (n.includes('bilateral flexibility') || n.includes('passive hip')) return true;
  if (n.includes('motor assessment scale') && n.includes('stroke')) return true;
  if (n.includes('tardieu') || n.includes('modified tardieu')) return true;
  if (n.includes('par-q') || n.includes('parq') || n.includes('physical activity readiness')) return true;
  if (n.includes('edss') || n.includes('expanded disability status')) return true;
  if (n.includes('step tap test') || (n.includes('step tap') && n.includes('15'))) return true;
  if (n.includes('home step test') || n.includes('two-minute home step')) return true;
  if (n.includes('tecumseh') || n.includes('3-minute step')) return true;
  if (n.includes('ymca bench press')) return true;
  if (n.includes('medicine ball throw') || n.includes('seated medicine ball')) return true;
  if (n.includes('grooved pegboard')) return true;
  if (n.includes('grocery shelving') || n.includes('gst')) return true;
  if (n.includes('static squat') || n.includes('wall squat')) return true;
  if (n.includes('purdue pegboard')) return true;
  if (n.includes('box and block test')) return true;
  if (n.includes('reactive strength index')) return true;
  if (n.includes('tri-level arm ergometer') || n.includes('tri level arm ergometer') || (n.includes('tri') && n.includes('arm ergometer'))) return true;
  if (n.includes('balke-ware') || n.includes('balke ware') || (n.includes('balke') && n.includes('treadmill'))) return true;
  if (n.includes('ten repetition maximum') || n.includes('10rm') || n.includes('10 rm')) return true;
  // Questionnaire-based assessments without dedicated runners - treated as questionnaires
  if (n.includes('breq') || n.includes('behavioural regulation in exercise')) return true;
  if (n.includes('physical activity scale for the elderly') || n.includes('pase')) return true;
  if (n.includes('quebec back pain disability')) return true;
  if (n.includes('eortc qlq') || n.includes('eortc-qlq')) return true;
  if (n.includes('assessment of quality of life') || n.includes('aqol')) return true;
  if (n.includes('chronic respiratory disease questionnaire') || n.includes('crdq')) return true;
  if (n.includes('visa-a') || (n.includes('visa') && n.includes('achilles'))) return true;
  if (n.includes('visa-p') || (n.includes('visa') && n.includes('patellar'))) return true;
  if (n.includes('dash') && (n.includes('full version') || n.includes('full dash'))) return true;
  if ((n.includes('mrc') || n.includes('medical research council')) && n.includes('dyspn')) return true;
  // Additional questionnaires/assessments with generic handling
  if (n.includes('spadi') || n.includes('shoulder pain and disability index')) return true;
  if (n.includes('distress thermometer')) return true;
  if (n.includes('frail scale') || (n.includes('frail') && n.includes('scale'))) return true;
  if (n.includes('geriatric depression scale') || n.includes('gds-15') || n.includes('gds 15')) return true;
  if (n.includes('brief pain inventory') || n.includes('bpi')) return true;
  if (n.includes('central sensitization inventory') || n.includes('csi')) return true;
  if (n.includes('depaul symptom') || n.includes('dsq-2') || n.includes('dsq2')) return true;
  if (n.includes('promis fatigue') || n.includes('short form 8a')) return true;
  if (n.includes('waist') && n.includes('hip ratio')) return true;
  if (n.includes('two minute step test') || n.includes('2-minute step test') || n.includes('2 minute step test')) return true;
  if (n.includes('patient-specific functional scale') || n.includes('psfs')) return true;
  if (n.includes('step test') && n.includes('aerobic')) return true;
  if (n.includes('single-leg stance') || n.includes('single leg stance')) return true;
  if (n.includes('shoulder') && n.includes('rom')) return true;
  // ROM assessments (handled by ROMAssessmentRunner)
  if (n.includes('knee') && n.includes('rom')) return true;
  if (n.includes('ankle') && n.includes('rom')) return true;
  if (n.includes('hip') && n.includes('rom')) return true;
  if (n.includes('cervical') && n.includes('rom')) return true;
  if (n.includes('dorsiflexion rom')) return true;
  // Neurological assessments with generic runner
  if (n.includes('fugl-meyer') || n.includes('fugl meyer') || n.includes('fma') && n.includes('assessment')) return true;
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const allAssessments = await base44.asServiceRole.entities.Assessment.list('-created_date', 500);
    
    let updated = 0;
    let alreadyCorrect = 0;
    let stillMissing = [];
    const updates = [];

    for (const assessment of allAssessments) {
      if (assessment.is_deleted) continue;
      
      const should = hasRunner(assessment.name);
      
      if (should && !assessment.has_test_runner) {
        updates.push(
          base44.asServiceRole.entities.Assessment.update(assessment.id, { has_test_runner: true })
        );
        updated++;
      } else if (should && assessment.has_test_runner) {
        alreadyCorrect++;
      } else if (!should) {
        stillMissing.push({ name: assessment.name, id: assessment.id, is_questionnaire: assessment.is_questionnaire });
      }
    }

    for (let i = 0; i < updates.length; i += 20) {
      await Promise.all(updates.slice(i, i + 20));
    }

    return Response.json({
      total_processed: allAssessments.length,
      updated_to_true: updated,
      already_had_runner: alreadyCorrect,
      genuinely_missing_count: stillMissing.length,
      genuinely_missing: stillMissing
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});