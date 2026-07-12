import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';
import { todayLocal } from "@/lib/localDate";

export default function WaistHipRatioRunner({ client, onSave, onClose }) {
  const [waist, setWaist] = useState('');
  const [hip, setHip] = useState('');
  const [sex, setSex] = useState(client?.gender || 'male');

  const calculateWHR = () => {
    const waistNum = parseFloat(waist);
    const hipNum = parseFloat(hip);
    if (!waistNum || !hipNum || hipNum === 0) return null;
    return (waistNum / hipNum).toFixed(3);
  };

  const getWHRCategory = (whr, sex) => {
    if (!whr) return null;
    
    if (sex === 'male') {
      if (whr < 0.90) return { category: 'Low Risk', color: 'text-green-600', bg: 'bg-green-50' };
      if (whr < 1.00) return { category: 'Moderate Risk', color: 'text-yellow-600', bg: 'bg-yellow-50' };
      return { category: 'High Risk', color: 'text-red-600', bg: 'bg-red-50' };
    } else {
      if (whr < 0.80) return { category: 'Low Risk', color: 'text-green-600', bg: 'bg-green-50' };
      if (whr < 0.85) return { category: 'Moderate Risk', color: 'text-yellow-600', bg: 'bg-yellow-50' };
      return { category: 'High Risk', color: 'text-red-600', bg: 'bg-red-50' };
    }
  };

  const handleSave = () => {
    const whr = calculateWHR();
    const category = getWHRCategory(parseFloat(whr), sex);
    
    const soapText = `• Waist-Hip Ratio Assessment\n  Result: ${whr}\n  Waist: ${waist} cm | Hip: ${hip} cm\n  Risk Category: ${category?.category || 'Unknown'}`;
    onSave({
      result_value: parseFloat(whr),
      additional_data: {
        measurement_type: 'whr',
        soap_text: soapText,
        waist_cm: parseFloat(waist),
        hip_cm: parseFloat(hip),
        whr_value: parseFloat(whr),
        sex,
        whr_category: category?.category || 'Unknown'
      },
      assessment_date: todayLocal()
    });
  };

  const whr = calculateWHR();
  const category = getWHRCategory(parseFloat(whr), sex);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-white">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-xl font-bold">Waist-Hip Ratio Assessment</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Measurement Protocol</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Waist:</strong> Measure midway between lowest rib and iliac crest at end of normal expiration</li>
              <li><strong>Hip:</strong> Measure at widest point over buttocks, feet together</li>
            </ul>
          </div>

          {/* Sex Selection */}
          <div>
            <Label>Client Sex (for WHO risk classification)</Label>
            <Select value={sex} onValueChange={setSex}>
              <SelectTrigger className="mt-1 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Measurements */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="waist">Waist Circumference (cm)</Label>
              <Input
                id="waist"
                type="number"
                step="0.1"
                value={waist}
                onChange={(e) => setWaist(e.target.value)}
                className="mt-1 text-xl"
                placeholder="e.g., 85.5"
              />
            </div>
            <div>
              <Label htmlFor="hip">Hip Circumference (cm)</Label>
              <Input
                id="hip"
                type="number"
                step="0.1"
                value={hip}
                onChange={(e) => setHip(e.target.value)}
                className="mt-1 text-xl"
                placeholder="e.g., 102.0"
              />
            </div>
          </div>

          {/* Calculated Results */}
          {whr && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-300 rounded-lg p-5">
              <h3 className="font-bold text-slate-900 mb-4 text-lg">Calculated Results</h3>
              
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-600 mb-1">Waist-Hip Ratio</p>
                  <p className="text-4xl font-bold text-indigo-600">{whr}</p>
                </div>
                <div className={`rounded-lg p-4 text-center ${category?.bg}`}>
                  <p className="text-sm text-slate-600 mb-1">Risk Category</p>
                  <p className={`text-2xl font-bold ${category?.color}`}>{category?.category}</p>
                </div>
              </div>

              {/* WHO Cut-offs Reference */}
              <div className="bg-white/70 rounded-lg p-4 text-sm">
                <p className="font-semibold text-slate-900 mb-2">WHO Risk Cut-offs:</p>
                <div className="space-y-1 text-slate-700">
                  <p><strong>Men:</strong> &lt;0.90 Low • 0.90-0.99 Moderate • ≥1.00 High</p>
                  <p><strong>Women:</strong> &lt;0.80 Low • 0.80-0.84 Moderate • ≥0.85 High</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleSave}
              disabled={!whr}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Save WHR Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}