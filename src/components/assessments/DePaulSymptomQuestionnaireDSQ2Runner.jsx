import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, ChevronLeft, ChevronRight, Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import { PROM_NEURO_DSQ2_SYMPTOM_DOMAINS as SYMPTOM_DOMAINS, PROM_NEURO_DSQ2_FREQ_OPTIONS as FREQ_OPTIONS, PROM_NEURO_DSQ2_SEV_OPTIONS as SEV_OPTIONS, PROM_NEURO_DSQ2_PEM_TRIGGERS as PEM_TRIGGERS, PROM_NEURO_DSQ2_RECOVERY_OPTIONS as RECOVERY_OPTIONS } from '@/lib/clinical/scorers/extrasPromNeuro';

// DSQ-2 symptom items — rated for Frequency (0-4) and Severity (0-4)

const ALL_ITEMS = SYMPTOM_DOMAINS.flatMap(d => d.items.map(item => ({ item, domain: d.domain })));



// PEM-specific questions


const ITEMS_PER_PAGE = 8;

export default function DePaulSymptomQuestionnaireDSQ2Runner({ client, onSave, onClose }) {
  // freq[i] and sev[i] for each item
  const [freq, setFreq] = useState(Array(ALL_ITEMS.length).fill(null));
  const [sev, setSev] = useState(Array(ALL_ITEMS.length).fill(null));
  const [pemTriggers, setPemTriggers] = useState([]);
  const [pemRecovery, setPemRecovery] = useState(null);
  const [pemNotes, setPemNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [page, setPage] = useState(0); // 0..N = symptom pages, N+1 = PEM detail page

  const symptomPages = Math.ceil(ALL_ITEMS.length / ITEMS_PER_PAGE);
  const totalPages = symptomPages + 2; // +1 for intro, +1 for PEM detail

  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, ALL_ITEMS.length);
  const currentItems = page > 0 && page <= symptomPages ? ALL_ITEMS.slice(startIdx, endIdx) : [];

  const answeredCount = freq.filter(v => v !== null).length;
  const progress = Math.round(((answeredCount + (page >= symptomPages ? 5 : 0)) / (ALL_ITEMS.length + 3)) * 100);

  const setFreqAt = (localIdx, val) => {
    const updated = [...freq];
    updated[startIdx + localIdx] = val;
    setFreq(updated);
  };

  const setSevAt = (localIdx, val) => {
    const updated = [...sev];
    updated[startIdx + localIdx] = val;
    setSev(updated);
  };

  const toggleTrigger = (trigger) => {
    setPemTriggers(prev =>
      prev.includes(trigger) ? prev.filter(t => t !== trigger) : [...prev, trigger]
    );
  };

  const handleSave = () => {
    const unansweredFreq = freq.filter(v => v === null).length;
    if (unansweredFreq > 0) {
      toast.error(`${unansweredFreq} symptom frequency ratings still missing.`);
      return;
    }

    // Compute domain scores (mean of freq*sev composite per domain)
    const domainScores = SYMPTOM_DOMAINS.map(domain => {
      let itemStart = 0;
      SYMPTOM_DOMAINS.forEach((d, di) => {
        if (d.domain === domain.domain) return;
        if (SYMPTOM_DOMAINS.indexOf(d) < SYMPTOM_DOMAINS.indexOf(domain)) itemStart += d.items.length;
      });
      // simpler: find index range
      const indices = domain.items.map((_, i) => {
        return ALL_ITEMS.findIndex((it, gi) => it.domain === domain.domain && gi >= 0) + i;
      });
      return { domain: domain.domain };
    });

    // Flat composite: sum of (freq[i] * sev[i]) for items where freq > 0
    let totalComposite = 0;
    let scoredItems = 0;
    ALL_ITEMS.forEach((_, i) => {
      if (freq[i] > 0 && sev[i] !== null) {
        totalComposite += freq[i] * sev[i];
        scoredItems++;
      }
    });
    const avgComposite = scoredItems > 0 ? Math.round((totalComposite / (scoredItems * 16)) * 100) / 100 : 0;

    // Domain breakdown
    let domainBreakdown = {};
    let offset = 0;
    SYMPTOM_DOMAINS.forEach(d => {
      let domainTotal = 0;
      let domainCount = 0;
      d.items.forEach((_, i) => {
        const gi = offset + i;
        if (freq[gi] !== null) { domainTotal += freq[gi]; domainCount++; }
      });
      domainBreakdown[d.domain] = domainCount > 0 ? Math.round((domainTotal / domainCount) * 10) / 10 : 0;
      offset += d.items.length;
    });

    const soapLines = ["DSQ-2 Domain Breakdown:"];
    let offset2 = 0;
    SYMPTOM_DOMAINS.forEach(d => {
      soapLines.push(`\n  ${d.domain} (Avg Frequency: ${domainBreakdown[d.domain]}/4):`);
      d.items.forEach((item, i) => {
        const gi = offset2 + i;
        const freqLabel = FREQ_OPTIONS.find(o => o.value === freq[gi])?.label.replace("\n", " ") ?? "—";
        const sevLabel = SEV_OPTIONS.find(o => o.value === sev[gi])?.label.replace("\n", " ") ?? "—";
        soapLines.push(`    - ${item}: Freq ${freq[gi] ?? "—"}/4 (${freqLabel}), Severity ${sev[gi] ?? "—"}/4 (${sevLabel})`);
      });
      offset2 += d.items.length;
    });
    soapLines.push(`\nPEM Triggers: ${pemTriggers.length > 0 ? pemTriggers.join(", ") : "None reported"}`);
    if (pemRecovery) soapLines.push(`PEM Recovery Time: ${pemRecovery}`);

    const soap_text = `DePaul Symptom Questionnaire (DSQ-2)\n• Total composite score: ${avgComposite}\n\n${soapLines.join("\n")}`;

    onSave({
      result_value: avgComposite,
      additional_data: {
        measurement_type: "dsq2",
        frequency_ratings: freq,
        severity_ratings: sev,
        domain_scores: domainBreakdown,
        pem_triggers: pemTriggers,
        pem_recovery_time: pemRecovery,
        pem_notes: pemNotes,
        soap_text,
      },
      notes,
      assessment_date: todayLocal(),
    });
  };

  // Current domain name for header
  const currentDomainName = page === 0
    ? "Overview & Instructions"
    : page > 0 && page <= symptomPages
    ? (() => {
        let offset = 0;
        for (const d of SYMPTOM_DOMAINS) {
          if (startIdx < offset + d.items.length) return d.domain;
          offset += d.items.length;
        }
        return "";
      })()
    : "PEM Detail & Recovery";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-slate-900">DePaul Symptom Questionnaire (DSQ-2)</h2>
            <p className="text-sm text-slate-500">{ALL_ITEMS.length} symptoms · Frequency &amp; Severity · Past 6 months</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-3 bg-slate-50 border-b">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span className="font-medium text-blue-700">{currentDomainName}</span>
            <span>Page {page + 1} of {totalPages}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${Math.max(3, progress)}%` }} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {page === 0 ? (
            /* Overview & Instructions */
            <div className="space-y-6">
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                    <Info className="w-5 h-5" />
                    Clinician Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-blue-900 space-y-3">
                  <div>
                    <p className="font-semibold">Assessment Overview:</p>
                    <p className="ml-4">The DePaul Symptom Questionnaire (DSQ-2) assesses 56 symptoms of myalgic encephalomyelitis/chronic fatigue syndrome (ME/CFS). The client rates each symptom's frequency and severity over the past 6 months.</p>
                  </div>
                  <div>
                    <p className="font-semibold">Administration Guidelines:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1 text-xs mt-1">
                      <li>Explain that the assessment takes 10–15 minutes</li>
                      <li>Emphasize that there are no "right" or "wrong" answers</li>
                      <li>Clarify that questions cover the <strong>past 6 months only</strong></li>
                      <li>Frequency: How often the symptom occurred (Never to Always)</li>
                      <li>Severity: How severe when present (Not present to Very severe)</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold">Scoring Notes:</p>
                    <p className="ml-4 text-xs">Composite score calculated as average of (frequency × severity) for reported symptoms. Domain breakdowns provided for clinical interpretation.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">About the DSQ-2</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-700 space-y-3">
                  <p>The DePaul Symptom Questionnaire is a validated symptom assessment tool for ME/CFS diagnosis and severity tracking. It covers 8 symptom domains:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                    <li>Post-Exertional Malaise (PEM)</li>
                    <li>Sleep Problems</li>
                    <li>Pain</li>
                    <li>Neurocognitive Symptoms</li>
                    <li>Autonomic Manifestations</li>
                    <li>Neuroendocrine Manifestations</li>
                    <li>Immune Manifestations</li>
                    <li>Additional Symptoms</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-slate-50">
                <CardHeader>
                  <CardTitle className="text-base">References</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-700 space-y-2">
                  <p><strong>Friedberg F, Bateman L, Berman S, et al.</strong> Chronic Fatigue Syndrome in Adults and Children. American Family Physician. 2020.</p>
                  <p><strong>Carruthers BM, van de Sande MI, De Meirleir KL, et al.</strong> Myalgic Encephalomyelitis: International Consensus Criteria. Journal of Internal Medicine. 2011;270(4):327–338.</p>
                  <p><strong>Institute of Medicine (IOM).</strong> Beyond Myalgic Encephalomyelitis/Chronic Fatigue Syndrome: Redefining an Illness. National Academies Press. 2015.</p>
                  <Button
                    onClick={() => window.open('https://me-cfs.org/', '_blank')}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    <ExternalLink className="w-3 h-3 mr-2" />
                    ME/CFS International Resources
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : page > 0 && page <= symptomPages ? (
            <>
              <p className="text-xs text-slate-500 italic">Rate how often each symptom occurred <strong>in the past 6 months</strong>, and its severity when present.</p>
              {currentItems.map(({ item }, localIdx) => {
                const globalIdx = startIdx + localIdx;
                return (
                  <div key={globalIdx} className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                    <p className="text-sm font-medium text-slate-800 mb-2">
                      <span className="text-blue-600 font-semibold mr-2">{globalIdx + 1}.</span>{item}
                    </p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">Frequency</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FREQ_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setFreqAt(localIdx, opt.value)}
                              className={`px-2.5 py-1 rounded-lg text-xs border transition-all leading-tight text-center ${
                                freq[globalIdx] === opt.value
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-blue-400"
                              }`}
                            >
                              {opt.value} – {opt.label.split("\n")[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">Severity</p>
                        <div className="flex flex-wrap gap-1.5">
                          {SEV_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setSevAt(localIdx, opt.value)}
                              className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                                sev[globalIdx] === opt.value
                                  ? "bg-orange-500 text-white border-orange-500"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-orange-300"
                              }`}
                            >
                              {opt.value} – {opt.label.split("\n")[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            /* PEM Detail Page */
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-slate-800 mb-3">Post-Exertional Malaise (PEM) Triggers</h3>
                <p className="text-xs text-slate-500 mb-3">Select all that trigger your PEM symptoms:</p>
                <div className="flex flex-wrap gap-2">
                  {PEM_TRIGGERS.map(trigger => (
                    <button
                      key={trigger}
                      onClick={() => toggleTrigger(trigger)}
                      className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-all ${
                        pemTriggers.includes(trigger)
                          ? "bg-red-100 text-red-800 border-red-400"
                          : "bg-white text-slate-600 border-slate-200 hover:border-red-300"
                      }`}
                    >
                      {trigger}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 mb-3">Typical PEM Recovery Time</h3>
                <div className="flex flex-wrap gap-2">
                  {RECOVERY_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setPemRecovery(opt)}
                      className={`px-3 py-2 rounded-lg text-xs border font-medium transition-all ${
                        pemRecovery === opt
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-200 hover:border-blue-400"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">PEM Additional Notes</label>
                <Textarea value={pemNotes} onChange={e => setPemNotes(e.target.value)} placeholder="Describe PEM pattern, activities that cause it, etc." rows={3} />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Clinical Notes</label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional clinical observations..." rows={3} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t bg-slate-50">
          <Button variant="outline" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <span className="text-xs text-slate-400">{page === 0 ? "Overview" : page <= symptomPages ? `${answeredCount}/${ALL_ITEMS.length} rated` : "PEM Details"}</span>
          {page < totalPages - 1 ? (
            <Button onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" /> Save DSQ-2
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
