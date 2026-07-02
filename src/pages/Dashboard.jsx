import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  UserPlus, 
  Users, 
  FileText,
  Activity,
  ArrowRight,
  Clock,
  Calendar,
  HeartPulse,
  TrendingUp,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [topConditions, setTopConditions] = useState([]);
  const [allConditions, setAllConditions] = useState([]);
  const [showAllConditionsModal, setShowAllConditionsModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await base44.auth.me();

      if (!currentUser.clinician_name) {
        navigate(createPageUrl("ProfileSetup"));
        setIsLoading(false);
        return;
      }
      
      setUser(currentUser);

      const memberships = await base44.entities.OrganizationMember.filter({ user_email: currentUser.email });
      const orgId = memberships.length > 0 ? (memberships.find(m => m.is_primary) || memberships[0]).org_id : null;
      
      const [clientsData, assessmentsData, conditionsData] = await Promise.all([
        orgId ? base44.entities.Client.filter({ org_id: orgId }) : Promise.resolve([]),
        base44.entities.Assessment.list(),
        base44.entities.ClientCondition.list()
      ]);
      
      setClients(clientsData);
      setAssessments(assessmentsData);

      if (conditionsData && clientsData) {
        const userClientIds = new Set(clientsData.map(c => c.id));
        const userConditions = conditionsData.filter(condition => 
          userClientIds.has(condition.client_id)
        );
        
        // Split conditions that contain commas (from scanned documents)
        const expandedConditions = [];
        userConditions.forEach(condition => {
          const name = condition.condition_name;
          if (name) {
            // Split by comma and clean up each condition
            const conditionNames = name.split(',').map(n => n.trim()).filter(n => n.length > 0);
            conditionNames.forEach(condName => {
              expandedConditions.push(condName);
            });
          }
        });
        
        // Count occurrences
        const counts = expandedConditions.reduce((acc, condName) => {
          acc[condName] = (acc[condName] || 0) + 1;
          return acc;
        }, {});
        
        const sortedConditions = Object.entries(counts).sort(([,a],[,b]) => b-a);
        
        setTopConditions(sortedConditions.slice(0, 5));
        setAllConditions(sortedConditions);
      } else {
        setTopConditions([]);
        setAllConditions([]);
      }

    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setUser(null);
      setClients([]);
      setAssessments([]);
      setTopConditions([]);
      setAllConditions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const formatTime = (date) => {
    return format(date, 'h:mm a');
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <Activity className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">
                {getGreeting()}, {user.clinician_name}!
              </h1>
              <p className="text-lg text-slate-600">
                Welcome to your Allied Assess dashboard
              </p>
              <div className="flex items-center justify-center gap-4 mt-4 text-sm text-slate-500">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(), 'EEEE, MMMM do, yyyy')}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatTime(new Date())}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-3 gap-6">
            <Link to={createPageUrl("Onboarding")}>
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 hover:shadow-xl transition-all duration-300 cursor-pointer group">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        New Client
                      </h3>
                      <p className="text-slate-600 text-sm">
                        Start client onboarding process
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <UserPlus className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex items-center justify-end mt-4">
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to={createPageUrl("Clients")}>
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 hover:shadow-xl transition-all duration-300 cursor-pointer group">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 group-hover:text-green-600 transition-colors">
                        View All Clients
                      </h3>
                      <p className="text-slate-600 text-sm">
                        Manage your client database
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                      <Users className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <div className="flex items-center justify-end mt-4">
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-green-600 transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to={createPageUrl("AssessmentLibrary")}>
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 hover:shadow-xl transition-all duration-300 cursor-pointer group">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 group-hover:text-purple-600 transition-colors">
                        Assessment Library
                      </h3>
                      <p className="text-slate-600 text-sm">
                        Browse available assessments
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                      <FileText className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                  <div className="flex items-center justify-end mt-4">
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Most Treated Conditions Card */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <HeartPulse className="w-5 h-5" />
                  Most Treated Conditions
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <TrendingUp className="w-3 h-3" />
                    Upskill opportunity
                  </div>
                  {allConditions.length > 5 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllConditionsModal(true)}
                    >
                      View All ({allConditions.length})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {topConditions.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {topConditions.map(([name, count], index) => (
                    <div key={name} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-slate-100 text-slate-600' :
                          index === 2 ? 'bg-orange-100 text-orange-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="font-medium text-slate-800">{name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-600">{count}</span>
                        <span className="text-xs text-slate-500">cases</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-4">No condition data recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* All Conditions Modal */}
      <Dialog open={showAllConditionsModal} onOpenChange={setShowAllConditionsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-blue-600" />
              All Treated Conditions
            </DialogTitle>
            <DialogDescription>
              Complete list of all conditions treated across your client base ({allConditions.length} unique conditions)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {allConditions.map(([name, count], index) => (
              <div key={name} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? 'bg-yellow-100 text-yellow-800' :
                    index === 1 ? 'bg-slate-100 text-slate-600' :
                    index === 2 ? 'bg-orange-100 text-orange-600' :
                    index < 10 ? 'bg-blue-100 text-blue-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="font-medium text-slate-800">{name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600">{count}</span>
                  <span className="text-sm text-slate-500">{count === 1 ? 'case' : 'cases'}</span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}