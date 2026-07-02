import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save } from 'lucide-react';

const GIRTH_SITES = [
  { id: 'chest', name: 'Chest', description: 'At nipple line' },
  { id: 'waist', name: 'Waist', description: 'Narrowest point' },
  { id: 'abdomen', name: 'Abdomen', description: 'At umbilicus' },
  { id: 'hips', name: 'Hips', description: 'Maximum protrusion of buttocks' },
  { id: 'thigh_proximal', name: 'Proximal Thigh', description: 'Gluteal fold' },
  { id: 'thigh_mid', name: 'Mid-Thigh', description: 'Midpoint between hip and knee' },
  { id: 'thigh_distal', name: 'Distal Thigh', description: 'Just above patella' },
  { id: 'knee', name: 'Knee', description: 'At knee joint line' },
  { id: 'calf', name: 'Calf', description: 'Maximum girth' },
  { id: 'ankle', name: 'Ankle', description: 'Minimum girth above malleoli' },
  { id: 'arm_relaxed', name: 'Upper Arm (Relaxed)', description: 'Midpoint, relaxed' },
  { id: 'arm_flexed', name: 'Upper Arm (Flexed)', description: 'Maximum contraction' },
  { id: 'forearm', name: 'Forearm', description: 'Maximum girth' },
  { id: 'wrist', name: 'Wrist', description: 'Distal to styloid processes' }
];

export default function GirthMeasurementsRunner({ onSave, onClose, initialData }) {
  const [selectedSites, setSelectedSites] = useState(initialData?.sites || []);
  const [measurements, setMeasurements] = useState(initialData?.measurements || {});
  const [observations, setObservations] = useState(initialData?.observations || "");

  const handleMeasurementChange = (siteId, side, value) => {
    setMeasurements({
      ...measurements,
      [siteId]: {
        ...measurements[siteId],
        [side]: value
      }
    });
  };

  const handleSave = () => {
    const siteMeasurements = {};
    selectedSites.forEach(siteId => {
      const m = measurements[siteId];
      siteMeasurements[siteId] = {
        left: parseFloat(m?.left) || null,
        right: parseFloat(m?.right) || null,
        center: parseFloat(m?.center) || null
      };
    });

    const siteLines = selectedSites.map(siteId => {
      const site = GIRTH_SITES.find(s => s.id === siteId);
      const m = siteMeasurements[siteId];
      if (isBilateral(siteId)) {
        const parts = [];
        if (m.left) parts.push(`L: ${m.left} cm`);
        if (m.right) parts.push(`R: ${m.right} cm`);
        return `  ${site.name}: ${parts.join(', ')}`;
      } else {
        return `  ${site.name}: ${m.center ?? 'â€”'} cm`;
      }
    }).join('\n');

    const soapText = `â€¢ Girth Measurements:\n${siteLines}${observations ? `\n\n  Observations: ${observations}` : ''}`;

    onSave({
      result_value: selectedSites.length,
      additional_data: {
        soap_text: soapText,
        sites: selectedSites,
        measurements: siteMeasurements,
      },
      notes: observations,
      assessment_date: new Date().toISOString().split('T')[0],
    });
  };

  const isBilateral = (siteId) => {
    return ['thigh_proximal', 'thigh_mid', 'thigh_distal', 'knee', 'calf', 'ankle', 'arm_relaxed', 'arm_flexed', 'forearm', 'wrist'].includes(siteId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl font-bold">Girth Measurements</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Circumference measurements at various body sites (cm)</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Select sites to measure. Bilateral sites will have left/right fields. Use measuring tape at consistent tension.
            </p>
          </div>

          {/* Site Selection */}
          <div>
            <Label className="mb-2 block">Select Measurement Sites</Label>
            <div className="grid md:grid-cols-2 gap-2">
              {GIRTH_SITES.map(site => (
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
            <div className="space-y-3">
              {selectedSites.map(siteId => {
                const site = GIRTH_SITES.find(s => s.id === siteId);
                const bilateral = isBilateral(siteId);
                
                return (
                  <Card key={siteId} className="border-slate-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{site.name}</CardTitle>
                      <p className="text-xs text-slate-500">{site.description}</p>
                    </CardHeader>
                    <CardContent>
                      {bilateral ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor={`${siteId}_left`} className="text-xs">Left (cm)</Label>
                            <Input
                              id={`${siteId}_left`}
                              type="number"
                              step="0.1"
                              value={measurements[siteId]?.left || ""}
                              onChange={(e) => handleMeasurementChange(siteId, 'left', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`${siteId}_right`} className="text-xs">Right (cm)</Label>
                            <Input
                              id={`${siteId}_right`}
                              type="number"
                              step="0.1"
                              value={measurements[siteId]?.right || ""}
                              onChange={(e) => handleMeasurementChange(siteId, 'right', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <Label htmlFor={`${siteId}_center`} className="text-xs">Measurement (cm)</Label>
                          <Input
                            id={`${siteId}_center`}
                            type="number"
                            step="0.1"
                            value={measurements[siteId]?.center || ""}
                            onChange={(e) => handleMeasurementChange(siteId, 'center', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
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
              placeholder="Swelling, muscle bulk, asymmetries..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={selectedSites.length === 0}>
              <Save className="w-4 h-4 mr-2" />
              Save Measurements
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}