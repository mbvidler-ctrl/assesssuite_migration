import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, Eye } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientOverview({ clients, isLoading }) {
  const recentClients = clients.slice(0, 5);

  const getStatusBadge = (status) => {
    const variants = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-yellow-100 text-yellow-800", 
      discharged: "bg-gray-100 text-gray-800"
    };
    
    return (
      <Badge className={`${variants[status]} border-0`}>
        {status}
      </Badge>
    );
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Users className="w-5 h-5" />
            Recent Clients
          </CardTitle>
          <Link to={createPageUrl("Clients")}>
            <Button variant="outline" size="sm" className="bg-white/60">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : recentClients.length > 0 ? (
          <div className="space-y-3">
            {recentClients.map((client) => (
              <div key={client.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50/50 transition-colors">
                <div className="flex-1">
                  <h4 className="font-medium text-slate-900 mb-1">{client.full_name}</h4>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(client.created_date), "MMM d, yyyy")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(client.status)}
                  <Link to={createPageUrl(`ClientProfile?id=${client.id}`)}>
                    <Button variant="ghost" size="sm">
                      <Eye className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>No clients yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}