import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export default function FoodDiaryTemplate({ isOpen, onClose }) {
  const print24Hour = () => {
    const printContent = `
      <html>
        <head>
          <title>24-Hour Food Diary</title>
          <style>
            @page { margin: 1cm; }
            body { font-family: Arial, sans-serif; margin: 0; line-height: 1.6; }
            h1 { color: #1e293b; border-bottom: 3px solid #3b82f6; padding-bottom: 0.5rem; margin-bottom: 1rem; }
            .info { margin-bottom: 1.5rem; }
            .info-line { margin: 0.5rem 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.5rem; }
            .meal-section { margin: 1rem 0; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; }
            .meal-title { font-weight: bold; color: #475569; font-size: 1.1rem; margin-bottom: 0.75rem; }
            .field { margin: 0.75rem 0; }
            .label { font-weight: bold; color: #64748b; display: inline-block; width: 120px; }
            .blank-line { display: inline-block; border-bottom: 1px solid #cbd5e1; width: calc(100% - 130px); min-height: 20px; }
            .notes-area { border: 1px solid #cbd5e1; min-height: 80px; padding: 0.5rem; border-radius: 0.25rem; margin-top: 0.5rem; }
          </style>
        </head>
        <body>
          <h1>24-HOUR FOOD DIARY</h1>
          
          <div class="info">
            <div class="info-line"><strong>Name:</strong> _____________________________________________</div>
            <div class="info-line"><strong>Date:</strong> _____________________________________________</div>
          </div>

          <p style="margin-bottom: 1rem; color: #64748b; font-size: 0.9rem;">
            <strong>Instructions:</strong> Record everything you eat and drink for 24 hours. Include all meals, snacks, beverages, and water. 
            Be as specific as possible with portion sizes (e.g., 1 cup, 200g, 2 slices).
          </p>

          <div class="meal-section">
            <div class="meal-title">BREAKFAST</div>
            <div class="field"><span class="label">Time:</span> <span class="blank-line"></span></div>
            <div class="field"><span class="label">Food/Drink:</span> <span class="blank-line"></span></div>
            <div class="field"><span class="label"></span> <span class="blank-line"></span></div>
            <div class="field"><span class="label">Portion Size:</span> <span class="blank-line"></span></div>
          </div>

          <div class="meal-section">
            <div class="meal-title">MORNING SNACK</div>
            <div class="field"><span class="label">Time:</span> <span class="blank-line"></span></div>
            <div class="field"><span class="label">Food/Drink:</span> <span class="blank-line"></span></div>
            <div class="field"><span class="label">Portion Size:</span> <span class="blank-line"></span></div>
          </div>

          <div class="meal-section">
            <div class="meal-title">LUNCH</div>
            <div class="field"><span class="label">Time:</span> <span class="blank-line"></span></div>
            <div class="field"><span class="label">Food/Drink:</span> <span class="blank-line"></span></div>
            <div class="field"><span class="label"></span> <span class="blank-line"></span></div>
            <div class="field"><span class="label">Portion Size:</span> <span class="blank-line"></span></div>
          </div>

          <div class="meal-section">
            <div class="meal-title">AFTERNOON SNACK</div>
            <div class="field"><span class="label">Time:</span> <span class="blank-line"></span></div>
            <div class="field"><span class="label">Food/Drink:</span> <span class="blank-line"></span></div>
            <div class="field"><span class="label">Portion Size:</span> <span class="blank-line"></span></div>
          </div>

          <div class="meal-section">
            <div class="meal-title">DINNER</div>
            <div class="field"><span class="label">Time:</span> <span class="blank-line"></span></div>
            <div class="field"><span class="label">Food/Drink:</span> <span class="blank-line"></span></div>
            <div class="field"><span class="label"></span> <span class="blank-line"></span></div>
            <div class="field"><span class="label">Portion Size:</span> <span class="blank-line"></span></div>
          </div>

          <div class="meal-section">
            <div class="meal-title">EVENING SNACK</div>
            <div class="field"><span class="label">Time:</span> <span class="blank-line"></span></div>
            <div class="field"><span class="label">Food/Drink:</span> <span class="blank-line"></span></div>
            <div class="field"><span class="label">Portion Size:</span> <span class="blank-line"></span></div>
          </div>

          <div class="meal-section">
            <div class="field"><span class="label">Total Water:</span> <span class="blank-line"></span></div>
          </div>

          <div class="meal-section">
            <div class="meal-title">ADDITIONAL NOTES</div>
            <div class="notes-area"></div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const print7Day = () => {
    const printContent = `
      <html>
        <head>
          <title>7-Day Food Diary</title>
          <style>
            @page { margin: 1cm; }
            body { font-family: Arial, sans-serif; margin: 0; line-height: 1.4; font-size: 0.9rem; }
            h1 { color: #1e293b; border-bottom: 3px solid #3b82f6; padding-bottom: 0.5rem; margin-bottom: 1rem; }
            .info { margin-bottom: 1rem; }
            .info-line { margin: 0.3rem 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.3rem; }
            .day-section { margin: 1.5rem 0; page-break-inside: avoid; border: 1px solid #e2e8f0; padding: 0.75rem; border-radius: 0.5rem; }
            .day-title { font-weight: bold; color: #1e293b; font-size: 1.1rem; margin-bottom: 0.5rem; background: #f1f5f9; padding: 0.5rem; border-radius: 0.25rem; }
            .meal { margin: 0.5rem 0; padding: 0.5rem; background: #f8fafc; border-radius: 0.25rem; }
            .meal-name { font-weight: bold; color: #475569; margin-bottom: 0.25rem; }
            .field { margin: 0.25rem 0; font-size: 0.85rem; }
            .label { font-weight: bold; color: #64748b; display: inline-block; width: 80px; }
            .blank-line { display: inline-block; border-bottom: 1px solid #cbd5e1; width: calc(100% - 90px); min-height: 16px; }
          </style>
        </head>
        <body>
          <h1>7-DAY FOOD DIARY</h1>
          
          <div class="info">
            <div class="info-line"><strong>Name:</strong> ___________________________________</div>
          </div>

          <p style="margin-bottom: 1rem; color: #64748b; font-size: 0.85rem;">
            <strong>Instructions:</strong> Record all meals, snacks, and beverages for 7 days. Include portion sizes and times.
          </p>

          ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => `
            <div class="day-section">
              <div class="day-title">${day.toUpperCase()} - Date: _______________</div>
              
              <div class="meal">
                <div class="meal-name">Breakfast</div>
                <div class="field"><span class="label">Time:</span> <span class="blank-line"></span></div>
                <div class="field"><span class="label">Food:</span> <span class="blank-line"></span></div>
              </div>

              <div class="meal">
                <div class="meal-name">Morning Snack</div>
                <div class="field"><span class="label">Food:</span> <span class="blank-line"></span></div>
              </div>

              <div class="meal">
                <div class="meal-name">Lunch</div>
                <div class="field"><span class="label">Time:</span> <span class="blank-line"></span></div>
                <div class="field"><span class="label">Food:</span> <span class="blank-line"></span></div>
              </div>

              <div class="meal">
                <div class="meal-name">Afternoon Snack</div>
                <div class="field"><span class="label">Food:</span> <span class="blank-line"></span></div>
              </div>

              <div class="meal">
                <div class="meal-name">Dinner</div>
                <div class="field"><span class="label">Time:</span> <span class="blank-line"></span></div>
                <div class="field"><span class="label">Food:</span> <span class="blank-line"></span></div>
              </div>

              <div class="meal">
                <div class="meal-name">Evening Snack</div>
                <div class="field"><span class="label">Food:</span> <span class="blank-line"></span></div>
              </div>

              <div class="field" style="margin-top: 0.5rem;"><span class="label">Water:</span> <span class="blank-line"></span></div>
            </div>
          `).join('')}
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Printable Food Diary Templates</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Print blank food diary templates for clients to complete at home. 
            You can enter the data into the software once they return the completed form.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 border border-slate-200 rounded-lg space-y-3">
              <h3 className="font-semibold text-slate-900">24-Hour Food Diary</h3>
              <p className="text-sm text-slate-600">
                Detailed single-day tracking with space for all meals, snacks, and notes.
              </p>
              <Button onClick={print24Hour} className="w-full">
                <Printer className="w-4 h-4 mr-2" />
                Print 24-Hour Template
              </Button>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg space-y-3">
              <h3 className="font-semibold text-slate-900">7-Day Food Diary</h3>
              <p className="text-sm text-slate-600">
                Week-long tracking template for comprehensive dietary assessment.
              </p>
              <Button onClick={print7Day} className="w-full">
                <Printer className="w-4 h-4 mr-2" />
                Print 7-Day Template
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}