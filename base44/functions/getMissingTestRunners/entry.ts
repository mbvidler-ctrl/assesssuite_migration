import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// This list mirrors the detection logic in TestRunner.js
function hasDetectedRunner(name) {
  const n = name.toLowerCase();
  // All the is*() checks from TestRunner.js
  if (n.includes('blood pressure')) return true;
  if (n.includes('heart rate') && !n.includes('recovery')) return true;
  if (n.includes('oxygen saturation') || n.includes('spo2')) return true;
  if (name === 'Five-Times Sit-to-Stand Test (5xSTS)') return true;
  if (n.includes('hand grip') || n.includes('grip strength')) return true;
  if (n === '6 minute walk test') return true;
  if (n === '2-minute step test') return true;
  if (n.includes('single leg stance') || n.includes('one-leg stance')) return true;
  if (n === 'y-balance test') return true;
  if (n.includes('10-meter walk test') || n.includes('10mwt')) return true;
  if (n.includes('4-stage balance') || n.includes('four stage balance')) return true;
  if (n === 'habitual gait speed' || n === 'fast gait speed') return true;
  if (n.includes('gait speed')) return true;
  if (n === 'heart rate recovery') return true;
  if (n.includes('pain scales') || n.includes('vas/nprs')) return true;
  if (n.includes('range of motion') || n.includes('rom assessment')) return true;
  if (n.includes('ebbeling') || n.includes('single-stage treadmill')) return true;
  if (n.includes('moca') || n.includes('montreal cognitive')) return true;
  if (n.includes('manual muscle')) return true;
  if (n.includes('waist-hip') || n.includes('waist hip ratio') || n === 'waist-hip ratio') return true;
  if (n.includes('body mass index') || n === 'bmi') return true;
  if (n.includes('waist circumference') && !n.includes('hip')) return true;
  if (n === 'height') return true;
  if (n === 'weight') return true;
  if (n.includes('berg balance')) return true;
  if (n.includes('timed up and go') || n.includes('tug')) return true;
  if ((n.includes('chair stand') || n.includes('sit to stand') || n.includes('sit-to-stand')) && !n.includes('1-minute') && !n.includes('1 minute')) return true;
  if (n.includes('1-minute') || n.includes('1 minute')) return true;
  if (n.includes('functional reach')) return true;
  if (n.includes('back scratch')) return true;
  if (n.includes('sit and reach') || n.includes('sit & reach')) return true;
  if (n.includes('romberg')) return true;
  if (n.includes('stork')) return true;
  if (n.includes('ctsib') || n.includes('sensory interaction')) return true;
  if (n.includes('four square') || n.includes('4 square')) return true;
  if (n.includes('skinfold')) return true;
  if (n.includes('girth measurement')) return true;
  if (n.includes('iswt') || n.includes('incremental shuttle')) return true;
  if (n.includes('harvard step')) return true;
  if (n.includes('box and block')) return true;
  if (n.includes('himat') || n.includes('high-level mobility')) return true;
  if (n.includes('astrand') || n.includes('åstrand')) return true;
  if (n.includes('job task analysis') || n.includes('icare')) return true;
  if (n.includes('borg') && n.includes('rpe')) return true;
  if (n.includes('general movement screen')) return true;
  if (n.includes('gad-7') || n.includes('gad7')) return true;
  if (n.includes('phq-9') || n.includes('phq9')) return true;
  if (n.includes('arm curl') || n.includes('bicep curl')) return true;
  if (n.includes('k10') || n.includes('k-10') || n.includes('kessler')) return true;
  if (n.includes('hoos') || (n.includes('hip') && n.includes('osteoarthritis'))) return true;
  if (n.includes('koos') || (n.includes('knee') && n.includes('osteoarthritis') && n.includes('outcome'))) return true;
  if (n.includes('pediatric balance')) return true;
  if (n.includes('repeated jump') || n.includes('10-s repeated jump') || n.includes('10/5 repeated jump')) return true;
  if (n.includes('ckcuest') || n.includes('closed kinetic chain upper')) return true;
  if (n.includes('1rm') || n.includes('1-repetition maximum') || n.includes('one repetition maximum')) return true;
  if (n.includes('isometric strength')) return true;
  if (n.includes('isokinetic')) return true;
  if (n.includes("ely's test") || n.includes("ely test")) return true;
  if (n.includes("thomas test")) return true;
  if (n.includes("ober's test") || n.includes("ober test")) return true;
  if (n.includes('straight leg raise') || n.includes('slr')) return true;
  if (n.includes('slump test')) return true;
  if (n.includes('lachman')) return true;
  if (n.includes('anterior drawer') && n.includes('knee')) return true;
  if (n.includes('pivot shift')) return true;
  if (n.includes('mcmurray')) return true;
  if (n.includes('thessaly')) return true;
  if (n.includes('apley')) return true;
  if (n.includes('noble')) return true;
  if (n.includes('bruce')) return true;
  if (n.includes('naughton')) return true;
  if (n.includes('ymca cycle')) return true;
  if (n.includes('wingate')) return true;
  if (n.includes('2 minute walk') || n.includes('two minute walk')) return true;
  if (n.includes('cooper') || n.includes('12 minute') || n.includes('12-minute')) return true;
  if (n.includes('beep') || (n.includes('20') && n.includes('shuttle'))) return true;
  if (n.includes('yo-yo') || n.includes('yoyo')) return true;
  if (n.includes('30-15') || n.includes('30 15')) return true;
  if (n.includes('repeated sprint ability')) return true;
  if (n.includes('heart rate recovery') && n.includes('minute')) return true;
  if (n.includes('vo2max testing') || n.includes('maximal graded exercise')) return true;
  if (n.includes('hba1c') || n.includes('glycated hemoglobin')) return true;
  if (n.includes('lipid profile')) return true;
  if (n.includes('met calculation') || n.includes('metabolic equivalent')) return true;
  if (n.includes('6-minute step') || n.includes('6 minute step')) return true;
  if (n.includes('physical performance test') || n.includes('ppt')) return true;
  if (n.includes('community balance') || n.includes('cb&m')) return true;
  if (n.includes('bestest') || n.includes('balance evaluation systems')) return true;
  if (n.includes('elderly mobility scale') || n.includes('ems')) return true;
  if (n.includes('ymca 3-minute') || n.includes('ymca 3 minute')) return true;
  if (n.includes('dynamic gait index') || n.includes('dgi')) return true;
  if (n.includes('rockport') || n.includes('1-mile walk')) return true;
  if (n.includes('ten meter walk') || n.includes('10 meter walk') || n.includes('10-meter walk')) return true;
  if (n.includes('dass-21') || n.includes('dass21') || n.includes('dass 21')) return true;
  if (n.includes('hospital anxiety and depression') || n.includes('hads')) return true;
  if (n.includes('clinical frailty scale') || n.includes('cfs')) return true;
  if (n.includes('ies-r') || n.includes('impact of event')) return true;
  if (n.includes('pcl-5') || n.includes('ptsd checklist')) return true;
  if (n.includes('insomnia severity')) return true;
  if (n.includes('mrc dyspnea') || n.includes('medical research council dysp')) return true;
  if (n.includes('copd assessment test') || n.includes(' cat')) return true;
  if (n.includes('clinical copd questionnaire') || n.includes('ccq')) return true;
  if (n.includes('leicester cough')) return true;
  if (n.includes('ikdc') || n.includes('international knee documentation')) return true;
  if (n.includes('functional independence measure') || n.includes('fim')) return true;
  if (n.includes('barthel index')) return true;
  if (n.includes('rivermead mobility')) return true;
  if (n.includes('roland') || n.includes('roland-morris')) return true;
  if (n.includes('quickdash') || n.includes('quick dash')) return true;
  if (n.includes('faam') || n.includes('foot and ankle ability')) return true;
  if (n.includes('abc scale') || n.includes('activities-specific balance confidence')) return true;
  if (n.includes('chalder fatigue')) return true;
  if (n.includes('psqi') || n.includes('pittsburgh sleep')) return true;
  if (n.includes('sarc-f') || n.includes('sarcf')) return true;
  if (n.includes('neck disability') || n.includes('ndi')) return true;
  if (n.includes('oswestry') || n.includes('odi')) return true;
  if (n.includes('ases') || n.includes('american shoulder and elbow')) return true;
  if (n.includes('dexa') || n.includes('bone density')) return true;
  if (n.includes('conley scale')) return true;
  if (n.includes('perceived stress scale') || n.includes('pss-10')) return true;
  if (n.includes('constant') && n.includes('murley')) return true;
  if (n.includes('lysholm')) return true;
  if (n.includes('acl-rsi') || n.includes('acl return to sport')) return true;
  if (n.includes('global rating of change') || n.includes('groc')) return true;
  if (n.includes('sgrq') || n.includes("st george's respiratory")) return true;
  if (n.includes('fabq') || n.includes('fear-avoidance beliefs')) return true;
  if (n.includes('single leg hop')) return true;
  if (n.includes('drop vertical jump')) return true;
  if ((n.includes('vertical jump') || n.includes('sargent jump')) && !n.includes('drop')) return true;
  if (n.includes('standing long jump')) return true;
  if (n.includes('clock drawing')) return true;
  if (n.includes('trail making') || n.includes('tmt')) return true;
  if (n.includes('tinetti') || n.includes('poma')) return true;
  if (n.includes('6') && n.includes('minute') && n.includes('walk')) return true;
  // Standalone wrappers
  if (n.includes('6') && n.includes('meter') && n.includes('walk')) return true;
  if (n.includes('8') && n.includes('foot') && n.includes('go')) return true;
  if (n.includes('400') && n.includes('meter') && n.includes('walk')) return true;
  if (n.includes('6') && n.includes('minute') && n.includes('step')) return true;
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Security patch ASX-SEC-20260703-01: this function previously had no
    // caller-identity or role check of any kind. Admin-only guard added;
    // see docs/ASX-SEC-20260703-01-patch-note.md.
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const allAssessments = await base44.entities.Assessment.list('-created_date', 500);
    
    const missing = allAssessments.filter(a => {
      if (a.is_deleted) return false;
      if (a.is_questionnaire && a.questions?.length > 0) return false; // questionnaire runner handles these
      return !hasDetectedRunner(a.name);
    });

    return Response.json({
      total: allAssessments.length,
      missing_count: missing.length,
      missing: missing.map((a, i) => ({
        num: i + 1,
        name: a.name,
        id: a.id,
        is_questionnaire: a.is_questionnaire,
        has_questions: a.questions?.length > 0
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});