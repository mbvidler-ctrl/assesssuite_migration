import React, { useState, useEffect } from 'react';
import { InvokeLLM } from '@/integrations/Core';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Bot, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function MedicationAlerts({ conditions, client }) {
    const [alerts, setAlerts] = useState([]);
    const [labels, setLabels] = useState([]); // authoritative openFDA label data per medication
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const run = async () => {
            const conditionMedications = (conditions || [])
                .map(c => c.medication)
                .filter(m => m && m.trim() !== '');
            const apssQ15Medications = (client?.apss_s2_medications_list || '')
                .split('\n')
                .map(m => m.trim())
                .filter(m => m !== '');
            const medications = [...new Set([...conditionMedications, ...apssQ15Medications])];

            if (medications.length === 0) {
                setAlerts([]);
                setLabels([]);
                return;
            }

            setIsLoading(true);
            setError(null);

            // 1) Authoritative grounding: fetch real drug-label information
            //    (RxNorm ingredient + openFDA label) for each medication. Terms
            //    only leave the server — no client data.
            let labelResults = [];
            try {
                const resp = await base44.functions.invoke('medicalLookup', { medications });
                const payload = resp?.data ?? resp;
                labelResults = Array.isArray(payload?.medications) ? payload.medications : [];
            } catch (e) {
                labelResults = [];
            }
            setLabels(labelResults);

            // 2) AI considerations, GROUNDED in the retrieved label text where
            //    available (the model is instructed to base its sentence only on
            //    the supplied label, not on its own memory).
            try {
                const groundingByName = {};
                labelResults.forEach(l => { if (l?.input) groundingByName[l.input] = l; });
                const medicationList = medications.map((med, idx) => {
                    const l = groundingByName[med];
                    const labelBits = l?.label
                        ? [l.label.contraindications, l.label.warnings, l.label.boxed_warning].filter(Boolean).join(' ')
                        : '';
                    return `${idx + 1}. ${med}${l?.ingredient ? ` (ingredient: ${l.ingredient})` : ''}` +
                        (labelBits ? `\n   Reference label (US FDA): ${labelBits.slice(0, 500)}` : '');
                }).join('\n');

                const prompt = `You are advising an exercise physiologist. For each medication below, write ONE concise sentence on its most relevant consideration for physical exercise (drowsiness, dizziness, balance, heart rate, blood pressure, exercise tolerance). Where "Reference label" text is provided, base your sentence ONLY on that label information and do not introduce facts it does not support. If no concern is relevant, say so. Use the EXACT medication name as listed.\n\n${medicationList}`;

                const response_json_schema = {
                    type: "object",
                    properties: {
                        alerts: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    medication_name: { type: "string" },
                                    alert_text: { type: "string" }
                                },
                                required: ["medication_name", "alert_text"]
                            }
                        }
                    },
                    required: ["alerts"]
                };

                const result = await InvokeLLM({ prompt, response_json_schema });
                setAlerts(result && result.alerts ? result.alerts : []);
            } catch (err) {
                console.error("Error fetching medication alerts:", err);
                setError("An error occurred while analyzing medications.");
            } finally {
                setIsLoading(false);
            }
        };

        run();
    }, [conditions, client?.apss_s2_medications_list]);

    const conditionMeds = (conditions || []).some(c => c.medication && c.medication.trim() !== '');
    const apssQ15Meds = (client?.apss_s2_medications_list || '').trim() !== '';

    if (!conditionMeds && !apssQ15Meds) {
        return null;
    }

    const labelsWithData = labels.filter(l => l && l.label);

    return (
        <Card className="bg-amber-50 border-amber-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                    <Bot className="w-5 h-5" />
                    Medication Considerations
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading && (
                    <div className="space-y-3">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-3/4" />
                    </div>
                )}
                {error && <p className="text-red-600">{error}</p>}

                {!isLoading && !error && (
                    <>
                        {/* Authoritative, sourced label information */}
                        {labelsWithData.length > 0 && (
                            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                                <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                                    <ShieldCheck className="w-4 h-4" />
                                    From the manufacturer's drug label
                                </div>
                                <ul className="space-y-2">
                                    {labelsWithData.map((l, i) => (
                                        <li key={i} className="text-sm">
                                            <span className="font-semibold text-slate-800">{l.input}{l.ingredient && l.ingredient.toLowerCase() !== l.input.toLowerCase() ? ` (${l.ingredient})` : ''}:</span>
                                            {l.label.contraindications && <p className="text-slate-700 leading-snug"><span className="font-medium">Contraindications:</span> {l.label.contraindications}</p>}
                                            {l.label.warnings && <p className="text-slate-700 leading-snug"><span className="font-medium">Warnings:</span> {l.label.warnings}</p>}
                                            {l.label.boxed_warning && <p className="text-red-700 leading-snug"><span className="font-medium">Boxed warning:</span> {l.label.boxed_warning}</p>}
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-xs text-slate-500 mt-2">Source: US FDA drug label (openFDA), matched at generic-ingredient level. Verify against Australian product information; not a substitute for clinical judgement.</p>
                            </div>
                        )}

                        {/* AI-drafted considerations — decision support, not verified */}
                        {alerts.length > 0 && (
                            <div>
                                <p className="text-xs text-amber-700 mb-2">AI-drafted considerations (decision support — review against the label above and product information):</p>
                                <ul className="space-y-3">
                                    {alerts.map((alert, index) => (
                                        <li key={index} className="flex items-start gap-3">
                                            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <span className="font-semibold text-slate-800">{alert.medication_name}:</span>
                                                <p className="text-slate-700 leading-snug">{alert.alert_text}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {labelsWithData.length === 0 && alerts.length === 0 && (
                            <p className="text-slate-600">No specific exercise-related alerts identified for the listed medications.</p>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
