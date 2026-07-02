import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

const colorClasses = {
  blue: {
    bg: "bg-blue-500",
    light: "bg-blue-50",
    text: "text-blue-600"
  },
  green: {
    bg: "bg-green-500", 
    light: "bg-green-50",
    text: "text-green-600"
  },
  red: {
    bg: "bg-red-500",
    light: "bg-red-50", 
    text: "text-red-600"
  },
  purple: {
    bg: "bg-purple-500",
    light: "bg-purple-50",
    text: "text-purple-600"
  }
};

export default function StatCard({ title, value, icon: Icon, color, trend }) {
  const colors = colorClasses[color];

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <div className={`p-2 rounded-lg ${colors.light}`}>
          <Icon className={`w-4 h-4 ${colors.text}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <p className="text-3xl font-bold text-slate-900">{value}</p>
          {trend && (
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-500">{trend}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}