import React, { useState, useEffect } from 'react';
import { InvokeLLM } from '@/integrations/Core';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Bot, ShieldCheck, ChevronDown, Maximize2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function MedicationAlerts({ conditions, client }) {
    const [alerts, setAlerts] = useState([]);
    const [labels, setLabels] = useState([]); // authoritative openFDA label data per medication
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [showDialog, setShowDialog] = useState(false);

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
    const medNames = [...new Set([...labelsWithData.map(l => l.input), ...alerts.map(a => a.medication_name)])];
    const boxedCount = labelsWithData.filter(l => l.label.boxed_warning).length;

    // Full detail body, shared by the inline expansion and the reading dialog.
    // allOpen expands every per-medication accordion item (used in the dialog).
    const renderDetails = (allOpen) => (
        <>
            {/* Authoritative, sourced label information */}
            {labelsWithData.length > 0 && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                        <ShieldCheck className="w-4 h-4" />
                        From the manufacturer's drug label
                    </div>
                    <Accordion type="multiple" defaultValue={allOpen ? labelsWithData.map((_, i) => `med-${i}`) : []}>
                        {labelsWithData.map((l, i) => (
                            <AccordionItem key={i} value={`med-${i}`} className="border-green-200">
                                <AccordionTrigger className="py-2 text-sm font-semibold text-slate-800">
                                    <span className="flex items-center gap-2 text-left">
                                        {l.input}{l.ingredient && l.ingredient.toLowerCase() !== l.input.toLowerCase() ? ` (${l.ingredient})` : ''}
                                        {l.label.boxed_warning && <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                                    </span>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-1 text-sm">
                                    {l.label.contraindications && <p className="text-slate-700 leading-snug"><span className="font-medium">Contraindications:</span> {l.label.contraindications}</p>}
                                    {l.label.warnings && <p className="text-slate-700 leading-snug"><span className="font-medium">Warnings:</span> {l.label.warnings}</p>}
                                    {l.label.boxed_warning && <p className="text-red-700 leading-snug"><span className="font-medium">Boxed warning:</span> {l.label.boxed_warning}</p>}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
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
    );

    return (
        <Card className="bg-amber-50 border-amber-200">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-amber-800">
                        <Bot className="w-5 h-5" />
                        Medication Considerations
                    </CardTitle>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-800" title="Open in full view" onClick={() => setShowDialog(true)}>
                            <Maximize2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-800" title={expanded ? 'Collapse' : 'Expand'} onClick={() => setExpanded(e => !e)}>
                            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </Button>
                    </div>
                </div>
                {!expanded && !isLoading && !error && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {medNames.slice(0, 6).map((m, i) => (
                            <Badge key={i} variant="outline" className="border-amber-300 text-amber-900 bg-amber-100/60">{m}</Badge>
                        ))}
                        {medNames.length > 6 && <Badge variant="outline" className="border-amber-300 text-amber-900">+{medNames.length - 6} more</Badge>}
                        {boxedCount > 0 && (
                            <Badge className="bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {boxedCount} boxed warning{boxedCount > 1 ? 's' : ''}
                            </Badge>
                        )}
                        <button type="button" onClick={() => setExpanded(true)} className="text-xs text-amber-800 underline underline-offset-2 ml-1">
                            View details
                        </button>
                    </div>
                )}
            </CardHeader>
            {(expanded || isLoading || error) && (
                <CardContent className="space-y-4">
                    {isLoading && (
                        <div className="space-y-3">
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-3/4" />
                        </div>
                    )}
                    {error && <p className="text-red-600">{error}</p>}
                    {!isLoading && !error && renderDetails(false)}
                </CardContent>
            )}

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-800">
                            <Bot className="w-5 h-5" />
                            Medication Considerations
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {isLoading && <p className="text-slate-600">Loading…</p>}
                        {error && <p className="text-red-600">{error}</p>}
                        {!isLoading && !error && renderDetails(true)}
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
