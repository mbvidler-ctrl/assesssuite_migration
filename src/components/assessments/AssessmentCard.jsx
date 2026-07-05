import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Plus, Sparkles, FileText } from 'lucide-react';
import { hasInteractiveRunner } from './assessmentRunnerUtils';

export default function AssessmentCard({ assessment, onClick, onSelect, showSelectButton, selectButtonText = "Add to Client" }) {
  const getCategoryColor = (category) => {
    const colors = {
      musculoskeletal: 'bg-blue-100 text-blue-800',
      neurological: 'bg-purple-100 text-purple-800',
      cardio_pulmonary: 'bg-red-100 text-red-800',
      metabolic: 'bg-green-100 text-green-800',
      mental_health: 'bg-yellow-100 text-yellow-800',
      pediatric: 'bg-pink-100 text-pink-800',
      geriatric: 'bg-orange-100 text-orange-800',
      general: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || colors.general;
  };

  const formatCategory = (category) => {
    return category.replace(/_/g, ' & ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Card 
      className="bg-white/80 backdrop-blur-sm border-slate-200/60 hover:shadow-xl transition-all duration-300 group flex flex-col"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 cursor-pointer" onClick={onClick}>
            <CardTitle className="text-lg font-semibold text-slate-900">{assessment.name}</CardTitle>
          </div>
          <button
            onClick={onClick}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0 text-slate-600 hover:text-slate-900"
            title="View details"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2 flex-wrap mt-2">
          <Badge className={`${getCategoryColor(assessment.category)} border-0 w-fit`}>
            {formatCategory(assessment.category)}
          </Badge>
          {hasInteractiveRunner(assessment.name) ? (
            <Badge className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-0 w-fit flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Interactive
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-300 w-fit flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Standard
            </Badge>
          )}
          {/* Quality Status Badge - Show when all checks complete */}
          {assessment.has_test_runner && 
           assessment.results_add_to_soap && 
           assessment.has_normatives && 
           assessment.has_instructions && 
           assessment.has_references && (
            <Badge className="bg-green-600 text-white border-0 w-fit">
              ✓ Verified
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow cursor-pointer" onClick={onClick}>
        <p className="text-sm text-slate-600 line-clamp-3">{assessment.description}</p>
      </CardContent>
    </Card>
  );
}