import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Calendar, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function RecentActivity({ assessments, clients, isLoading }) {
  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.full_name || "Unknown Client";
  };

  const getComparisonBadge = (comparison) => {
    const variants = {
      well_above_average: { variant: "default", color: "bg-green-100 text-green-800", icon: CheckCircle },
      above_average: { variant: "secondary", color: "bg-blue-100 text-blue-800", icon: CheckCircle },
      average: { variant: "outline", color: "bg-slate-100 text-slate-700", icon: CheckCircle },
      below_average: { variant: "secondary", color: "bg-orange-100 text-orange-800", icon: AlertTriangle },
      well_below_average: { variant: "destructive", color: "bg-red-100 text-red-800", icon: AlertTriangle }
    };
    
    const config = variants[comparison] || variants.average;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} border-0 flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {comparison?.replace(/_/g, ' ')}
      </Badge>
    );
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <Activity className="w-5 h-5" />
          Recent Assessments
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : assessments.length > 0 ? (
          <div className="space-y-3">
            {assessments.map((assessment) => (
              <div key={assessment.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50/50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-medium text-slate-900">{getClientName(assessment.client_id)}</h4>
                    {assessment.is_flagged && (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(assessment.assessment_date), "MMM d, yyyy")}
                    <span className="text-slate-400">â€¢</span>
                    <span>Score: {assessment.result_value}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {assessment.normative_comparison && getComparisonBadge(assessment.normative_comparison)}
                  {assessment.percentile && (
                    <span className="text-xs text-slate-500">{assessment.percentile}th percentile</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Activity className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>No recent assessments</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}