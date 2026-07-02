import React, { useState, useEffect } from 'react';
import { InvokeLLM } from '@/integrations/Core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Bot } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function MedicationAlerts({ conditions, client }) {
    const [alerts, setAlerts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAlerts = async () => {
            // Medications from conditions (per-condition medication field)
            const conditionMedications = (conditions || [])
                .map(c => c.medication)
                .filter(m => m && m.trim() !== '');

            // Medications from APSS Q15 (free-text list, one per line)
            const apssQ15Medications = (client?.apss_s2_medications_list || '')
                .split('\n')
                .map(m => m.trim())
                .filter(m => m !== '');

            const medications = [...new Set([...conditionMedications, ...apssQ15Medications])];
            
            if (medications.length === 0) {
                setAlerts([]);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const medicationList = medications.map((med, idx) => `${idx + 1}. ${med}`).join('\n');
                
                const prompt = `
                    As an expert pharmacologist advising an exercise physiologist, analyze the following medications:
                    
                    ${medicationList}
                    
                    For each medication listed above, provide a concise, one-sentence alert about its most relevant potential side effects or considerations for physical exercise.
                    Focus on impacts on drowsiness, dizziness, balance, heart rate, blood pressure, or exercise tolerance.
                    If a medication has no significant concerns for exercise, state that.
                    
                    IMPORTANT: Use the EXACT medication name as listed above in your response.
                `;

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
                
                if (result && result.alerts) {
                    setAlerts(result.alerts);
                } else {
                    setError("Could not retrieve alerts from AI analysis.");
                }

            } catch (err) {
                console.error("Error fetching medication alerts:", err);
                setError("An error occurred while analyzing medications.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAlerts();
    }, [conditions, client?.apss_s2_medications_list]);

    const conditionMeds = (conditions || []).some(c => c.medication && c.medication.trim() !== '');
    const apssQ15Meds = (client?.apss_s2_medications_list || '').trim() !== '';
    
    if (!conditionMeds && !apssQ15Meds) {
        return null;
    }

    return (
        <Card className="bg-amber-50 border-amber-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                    <Bot className="w-5 h-5" />
                    Medication Considerations
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading && (
                    <div className="space-y-3">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-3/4" />
                    </div>
                )}
                {error && <p className="text-red-600">{error}</p>}
                {!isLoading && !error && (
                    alerts.length > 0 ? (
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
                    ) : (
                        <p className="text-slate-600">No specific exercise-related alerts identified for the listed medications.</p>
                    )
                )}
            </CardContent>
        </Card>
    );
}