import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  CheckCircle2, 
  ClipboardList,
  User,
  Phone,
  CreditCard,
  Heart,
  Target,
  FileCheck,
  ArrowRight
} from 'lucide-react';

export default function OnboardingStatus({ client, conditions = [] }) {
  const sections = useMemo(() => {
    return [
      {
        id: 1,
        name: 'Personal Information',
        icon: User,
        required: ['full_name', 'date_of_birth', 'gender'],
        optional: ['pronouns', 'cultural_considerations'],
        check: () => {
          return client.full_name && client.date_of_birth && client.gender;
        }
      },
      {
        id: 2,
        name: 'Referral Information',
        icon: Phone,
        required: [],
        optional: ['referral_source', 'referral_source_name', 'referral_reason', 'primary_gp_name'],
        check: () => {
          return client.referral_source || client.referral_source_name;
        }
      },
      {
        id: 3,
        name: 'Funding Information',
        icon: CreditCard,
        required: ['funding_source'],
        optional: [],
        check: () => {
          return !!client.funding_source;
        }
      },
      {
        id: 4,
        name: 'APSS Stage 1',
        icon: ClipboardList,
        required: [],
        optional: [],
        check: () => {
          return client.apss_completed === true;
        }
      },
      {
        id: 5,
        name: 'APSS Stage 2',
        icon: ClipboardList,
        required: [],
        optional: [],
        check: () => {
          return client.apss_stage2_completed === true;
        }
      },
      {
        id: 6,
        name: 'Medical History',
        icon: Heart,
        required: [],
        optional: [],
        check: () => {
          return conditions && conditions.length > 0;
        }
      },
      {
        id: 7,
        name: 'Client Goals',
        icon: Target,
        required: [],
        optional: ['client_goals'],
        check: () => {
          return client.client_goals && client.client_goals.trim() !== '';
        }
      },
      {
        id: 8,
        name: 'Consent & Confirmation',
        icon: FileCheck,
        required: ['consent_confirmed'],
        optional: ['privacy_consent', 'assessment_consent', 'pricing_explained'],
        check: () => {
          return client.consent_confirmed === true;
        }
      }
    ];
  }, [client, conditions]);

  const sectionStatuses = sections.map(section => ({
    ...section,
    isComplete: section.check()
  }));

  const completedCount = sectionStatuses.filter(s => s.isComplete).length;
  const totalCount = sections.length;
  const isFullyOnboarded = completedCount === totalCount;
  const completionPercentage = Math.round((completedCount / totalCount) * 100);

  // Find first incomplete section for the "Continue" button
  const firstIncompleteSection = sectionStatuses.find(s => !s.isComplete);

  return (
    <Card className={`${
      isFullyOnboarded 
        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200/80' 
        : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/80'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className={`flex items-center gap-2 ${
            isFullyOnboarded ? 'text-green-800' : 'text-amber-800'
          }`}>
            {isFullyOnboarded ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Onboarding Complete
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5" />
                Onboarding Incomplete
              </>
            )}
          </CardTitle>
          <Badge variant="outline" className={
            isFullyOnboarded 
              ? 'bg-green-100 text-green-800 border-green-300'
              : 'bg-amber-100 text-amber-800 border-amber-300'
          }>
            {completionPercentage}% Complete
          </Badge>
        </div>
        <p className={`text-sm mt-1 ${
          isFullyOnboarded ? 'text-green-700' : 'text-amber-700'
        }`}>
          {isFullyOnboarded 
            ? 'All onboarding sections completed. Click any section to edit details.'
            : `${completedCount} of ${totalCount} sections completed. Complete the remaining sections for a full client profile.`
          }
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {sectionStatuses.map(section => (
            <Link 
              key={section.id} 
              to={createPageUrl(`Onboarding?id=${client.id}&step=${section.id}`)}
              className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                section.isComplete 
                  ? 'bg-green-100/80 text-green-800 hover:bg-green-100' 
                  : 'bg-white/80 text-amber-800 hover:bg-white border border-amber-200'
              }`}
            >
              {section.isComplete ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              ) : (
                <section.icon className="w-4 h-4 text-amber-600 flex-shrink-0" />
              )}
              <span className="text-xs font-medium truncate">{section.name}</span>
            </Link>
          ))}
        </div>

        {!isFullyOnboarded && firstIncompleteSection && (
          <Link to={createPageUrl(`Onboarding?id=${client.id}&step=${firstIncompleteSection.id}`)}>
            <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white mt-2">
              Continue Onboarding
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}