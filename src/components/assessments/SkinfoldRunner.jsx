import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save } from 'lucide-react';

const SKINFOLD_SITES = [
  { id: 'triceps', name: 'Triceps', description: 'Midpoint of upper arm, vertical fold' },
  { id: 'biceps', name: 'Biceps', description: 'Front of upper arm, vertical fold' },
  { id: 'subscapular', name: 'Subscapular', description: 'Below shoulder blade, diagonal fold' },
  { id: 'suprailiac', name: 'Suprailiac', description: 'Above hip bone, diagonal fold' },
  { id: 'abdominal', name: 'Abdominal', description: 'Beside navel, vertical fold' },
  { id: 'chest', name: 'Chest/Pectoral', description: 'Diagonal fold, anterior axilla to nipple' },
  { id: 'thigh', name: 'Thigh', description: 'Front of thigh, vertical fold' },
  { id: 'calf', name: 'Calf', description: 'Medial calf, vertical fold' }
];

export default function SkinfoldRunner({ protocol = '7-site', onSave, onClose, initialData }) {
  const [selectedSites, setSelectedSites] = useState(initialData?.sites || []);
  const [measurements, setMeasurements] = useState(initialData?.measurements || {});
  const [observations, setObservations] = useState(initialData?.observations || "");

  const handleMeasurementChange = (siteId, trial, value) => {
    setMeasurements({
      ...measurements,
      [siteId]: {
        ...measurements[siteId],
        [trial]: value
      }
    });
  };

  const calculateSiteAverage = (siteId) => {
    const m = measurements[siteId];
    if (!m) return null;
    const trials = [
      parseFloat(m.trial1) || 0,
      parseFloat(m.trial2) || 0,
      parseFloat(m.trial3) || 0
    ].filter(v => v > 0);
    return trials.length > 0 ? (trials.reduce((a, b) => a + b) / trials.length).toFixed(1) : null;
  };

  const calculateTotalSum = () => {
    let sum = 0;
    selectedSites.forEach(siteId => {
      const avg = calculateSiteAverage(siteId);
      if (avg) sum += parseFloat(avg);
    });
    return sum.toFixed(1);
  };

  const handleSave = () => {
    const siteMeasurements = {};
    selectedSites.forEach(siteId => {
      const m = measurements[siteId];
      siteMeasurements[siteId] = {
        trial1: parseFloat(m?.trial1) || null,
        trial2: parseFloat(m?.trial2) || null,
        trial3: parseFloat(m?.trial3) || null,
        average: parseFloat(calculateSiteAverage(siteId)) || null
      };
    });

    // Build comprehensive SOAP text
    let soapText = `â€¢ Skinfold Measurements (${protocol}):\n`;
    soapText += `  Total Sum: ${calculateTotalSum()}mm\n\n  Site Measurements:\n`;
    selectedSites.forEach(siteId => {
      const site = SKINFOLD_SITES.find(s => s.id === siteId);
      const m = siteMeasurements[siteId];
      soapText += `  ${site.name}: ${m.average}mm\n`;
    });
    if (observations) soapText += `\n  Observations: ${observations}\n`;

    onSave({
      result_value: parseFloat(calculateTotalSum()),
      additional_data: {
        soap_text: soapText,
        protocol,
        sites: selectedSites,
        measurements: siteMeasurements,
        total_sum: parseFloat(calculateTotalSum()),
        measurement_type: 'skinfold'
      },
      notes: observations,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl flex flex-col bg-white" style={{ maxHeight: '90vh' }}>
        <CardHeader className="flex-shrink-0 flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl font-bold">Skinfold Measurements</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Record 3 trials per site (mm)</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6 overflow-y-auto flex-1">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Select sites to measure, take 3 measurements per site. Average will be calculated automatically.
            </p>
          </div>

          {/* Site Selection */}
          <div>
            <Label className="mb-2 block">Select Measurement Sites</Label>
            <div className="grid md:grid-cols-2 gap-2">
              {SKINFOLD_SITES.map(site => (
                <Button
                  key={site.id}
                  type="button"
                  variant={selectedSites.includes(site.id) ? "default" : "outline"}
                  onClick={() => {
                    if (selectedSites.includes(site.id)) {
                      setSelectedSites(selectedSites.filter(s => s !== site.id));
                    } else {
                      setSelectedSites([...selectedSites, site.id]);
                    }
                  }}
                  className="justify-start text-left h-auto py-2"
                >
                  <div className="text-sm">
                    <div className="font-semibold">{site.name}</div>
                    <div className="text-xs opacity-80">{site.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Measurements */}
          {selectedSites.length > 0 && (
            <div className="space-y-4">
              {selectedSites.map(siteId => {
                const site = SKINFOLD_SITES.find(s => s.id === siteId);
                return (
                  <Card key={siteId} className="border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-base">{site.name}</CardTitle>
                      <p className="text-xs text-slate-500">{site.description}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor={`${siteId}_trial1`} className="text-xs">Trial 1 (mm)</Label>
                          <Input
                            id={`${siteId}_trial1`}
                            type="number"
                            step="0.1"
                            value={measurements[siteId]?.trial1 || ""}
                            onChange={(e) => handleMeasurementChange(siteId, 'trial1', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`${siteId}_trial2`} className="text-xs">Trial 2 (mm)</Label>
                          <Input
                            id={`${siteId}_trial2`}
                            type="number"
                            step="0.1"
                            value={measurements[siteId]?.trial2 || ""}
                            onChange={(e) => handleMeasurementChange(siteId, 'trial2', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`${siteId}_trial3`} className="text-xs">Trial 3 (mm)</Label>
                          <Input
                            id={`${siteId}_trial3`}
                            type="number"
                            step="0.1"
                            value={measurements[siteId]?.trial3 || ""}
                            onChange={(e) => handleMeasurementChange(siteId, 'trial3', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      {calculateSiteAverage(siteId) && (
                        <p className="text-sm text-slate-600 mt-2">
                          Average: <span className="font-bold">{calculateSiteAverage(siteId)} mm</span>
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {selectedSites.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-2">Sum of Skinfolds</h4>
              <p className="text-4xl font-bold text-blue-600">{calculateTotalSum()} mm</p>
            </div>
          )}

          <div>
            <Label htmlFor="observations">Observations</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="mt-1"
              rows={2}
              placeholder="Measurement difficulties, skin quality..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}