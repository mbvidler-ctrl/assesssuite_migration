import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity, Heart, Droplets, Brain, Utensils, Pill } from "lucide-react";

export default function VitalsQuickEntry({ isOpen, onClose, onInsert, existingObjective }) {
  const [vitals, setVitals] = useState({
    bp_pre: '',
    hr_pre: '',
    spo2_pre: '',
    arousal: '',
    nutrition: '',
    medications: '',
    bp_post: '',
    hr_post: '',
    spo2_post: '',
    other_post: ''
  });

  const handleChange = (field, value) => {
    setVitals(prev => ({ ...prev, [field]: value }));
  };

  const generateVitalsText = () => {
    let text = '';
    
    // Pre-exercise measures
    const preItems = [];
    if (vitals.bp_pre) preItems.push(`BP Pre Exercise: ${vitals.bp_pre} mmHg`);
    if (vitals.hr_pre) preItems.push(`HR Pre Exercise: ${vitals.hr_pre} bpm`);
    if (vitals.spo2_pre) preItems.push(`SpO2 Pre Exercise: ${vitals.spo2_pre}%`);
    if (vitals.arousal) preItems.push(`Client Arousal: ${vitals.arousal}`);
    if (vitals.nutrition) preItems.push(`Nutrition/Hydration: ${vitals.nutrition}`);
    if (vitals.medications) preItems.push(`Medications: ${vitals.medications}`);
    
    if (preItems.length > 0) {
      text += 'PRE-EXERCISE MEASURES:\n' + preItems.join('\n');
    }
    
    // Post-exercise measures
    const postItems = [];
    if (vitals.bp_post) postItems.push(`BP Post Exercise: ${vitals.bp_post} mmHg`);
    if (vitals.hr_post) postItems.push(`HR Post Exercise: ${vitals.hr_post} bpm`);
    if (vitals.spo2_post) postItems.push(`SpO2 Post Exercise: ${vitals.spo2_post}%`);
    if (vitals.other_post) postItems.push(`Other: ${vitals.other_post}`);
    
    if (postItems.length > 0) {
      if (text) text += '\n\n';
      text += 'POST-EXERCISE MEASURES:\n' + postItems.join('\n');
    }
    
    return text;
  };

  const handleInsert = () => {
    const vitalsText = generateVitalsText();
    if (vitalsText) {
      const newObjective = existingObjective 
        ? `${vitalsText}\n\n${existingObjective}`
        : vitalsText;
      onInsert(newObjective);
    }
    onClose();
  };

  const arousalOptions = [
    'Alert and oriented',
    'Slightly fatigued',
    'Moderately fatigued', 
    'Well-rested',
    'Anxious/stressed',
    'Calm and relaxed'
  ];

  const nutritionOptions = [
    'Well hydrated, eaten within 2 hours',
    'Well hydrated, fasted >3 hours',
    'Mildly dehydrated',
    'Adequate hydration, light meal',
    'Reports poor intake today'
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Quick Vitals Entry
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Pre-Exercise Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-800 border-b pb-2">Pre-Exercise Measures</h3>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Heart className="w-3 h-3 text-red-500" /> BP (mmHg)
                </Label>
                <Input
                  placeholder="120/80"
                  value={vitals.bp_pre}
                  onChange={(e) => handleChange('bp_pre', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Activity className="w-3 h-3 text-red-500" /> HR (bpm)
                </Label>
                <Input
                  placeholder="72"
                  value={vitals.hr_pre}
                  onChange={(e) => handleChange('hr_pre', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-blue-500" /> SpO2 (%)
                </Label>
                <Input
                  placeholder="98"
                  value={vitals.spo2_pre}
                  onChange={(e) => handleChange('spo2_pre', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs flex items-center gap-1">
                <Brain className="w-3 h-3 text-purple-500" /> Client Arousal
              </Label>
              <Select value={vitals.arousal} onValueChange={(v) => handleChange('arousal', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select arousal state" />
                </SelectTrigger>
                <SelectContent>
                  {arousalOptions.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs flex items-center gap-1">
                <Utensils className="w-3 h-3 text-green-500" /> Nutrition/Hydration
              </Label>
              <Select value={vitals.nutrition} onValueChange={(v) => handleChange('nutrition', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select nutrition status" />
                </SelectTrigger>
                <SelectContent>
                  {nutritionOptions.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs flex items-center gap-1">
                <Pill className="w-3 h-3 text-orange-500" /> Medications
              </Label>
              <Input
                placeholder="Medications taken today"
                value={vitals.medications}
                onChange={(e) => handleChange('medications', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Post-Exercise Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-800 border-b pb-2">Post-Exercise Measures</h3>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Heart className="w-3 h-3 text-red-500" /> BP (mmHg)
                </Label>
                <Input
                  placeholder="118/78"
                  value={vitals.bp_post}
                  onChange={(e) => handleChange('bp_post', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Activity className="w-3 h-3 text-red-500" /> HR (bpm)
                </Label>
                <Input
                  placeholder="68"
                  value={vitals.hr_post}
                  onChange={(e) => handleChange('hr_post', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-blue-500" /> SpO2 (%)
                </Label>
                <Input
                  placeholder="99"
                  value={vitals.spo2_post}
                  onChange={(e) => handleChange('spo2_post', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Other Notes</Label>
              <Input
                placeholder="RPE, symptoms, observations..."
                value={vitals.other_post}
                onChange={(e) => handleChange('other_post', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleInsert} className="bg-blue-600 hover:bg-blue-700">
            Insert into Objective
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}