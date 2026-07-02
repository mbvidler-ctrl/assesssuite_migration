import React, { useState, useEffect } from "react";
import { Client } from "@/entities/Client";
import { Assessment } from "@/entities/Assessment";
import { ClientAssessment } from "@/entities/ClientAssessment";
import { User } from "@/entities/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, User as UserIcon, CheckCircle, ClipboardPlus, ArrowRight, Loader2, X } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function NewAssessment() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  
  const [assessments, setAssessments] = useState([]);
  const [filteredAssessments, setFilteredAssessments] = useState([]);
  
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedAssessments, setSelectedAssessments] = useState([]);
  const [assessmentSearchTerm, setAssessmentSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showRecentClients, setShowRecentClients] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const userData = await User.me();
        const [clientData, assessmentData] = await Promise.all([
          Client.filter({ created_by: userData.email }),
          Assessment.list()
        ]);
        setClients(clientData);
        setAssessments(assessmentData);
        setFilteredAssessments(assessmentData);
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load data.");
      }
      setIsLoading(false);
    }
    loadData();
  }, []);

  useEffect(() => {
    if (clientSearchTerm) {
      const lowercasedTerm = clientSearchTerm.toLowerCase();
      setFilteredClients(
        clients.filter(client =>
          client.full_name.toLowerCase().includes(lowercasedTerm)
        )
      );
      setShowRecentClients(false); 
    } else {
      setFilteredClients([]);
      setShowRecentClients(true);
    }
  }, [clientSearchTerm, clients]);

  useEffect(() => {
    let filtered = assessments;
    if (assessmentSearchTerm) {
      filtered = assessments.filter(assessment => 
        assessment.name.toLowerCase().includes(assessmentSearchTerm.toLowerCase()) ||
        (assessment.search_tags && assessment.search_tags.some(tag => tag.toLowerCase().includes(assessmentSearchTerm.toLowerCase())))
      );
    }
    setFilteredAssessments(filtered);
  }, [assessmentSearchTerm, assessments]);

  const handleAssessmentToggle = (assessmentId) => {
    setSelectedAssessments(prev => 
      prev.includes(assessmentId) 
        ? prev.filter(id => id !== assessmentId)
        : [...prev, assessmentId]
    );
  };

  const handleAssignAssessments = async () => {
    if (!selectedClientId || selectedAssessments.length === 0) return;

    setIsAssigning(true);
    try {
      const assessmentsToCreate = selectedAssessments.map(assessmentId => ({
        client_id: selectedClientId,
        assessment_id: assessmentId,
        status: 'pending',
        assessment_date: new Date().toISOString().split('T')[0]
      }));

      await ClientAssessment.bulkCreate(assessmentsToCreate);

      toast.success(`${selectedAssessments.length} assessment(s) assigned successfully!`);
      navigate(createPageUrl(`ClientProfile?id=${selectedClientId}`));
    } catch (error) {
      console.error("Failed to assign assessments:", error);
      toast.error("An error occurred while assigning assessments.");
    }
    setIsAssigning(false);
  };

  const selectClient = (clientId) => {
    setSelectedClientId(clientId);
    setClientSearchTerm("");
    setFilteredClients([]);
    setShowRecentClients(false);
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const recentClients = clients
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 10);

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
              <ClipboardPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">New Client Assessment</h1>
              <p className="text-slate-600">Assign one or more assessments to a client.</p>
            </div>
          </div>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="text-blue-600"/>
                Step 1: Select a Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-10 bg-slate-200 rounded animate-pulse"></div>
              ) : selectedClient ? (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-semibold text-blue-800">{selectedClient.full_name}</p>
                  <Button variant="ghost" size="icon" onClick={() => {
                    setSelectedClientId(null);
                    setShowRecentClients(true);
                  }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="Search for a client by name..."
                      value={clientSearchTerm}
                      onChange={(e) => setClientSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                    {filteredClients.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredClients.map(client => (
                          <div
                            key={client.id}
                            className="p-3 hover:bg-slate-100 cursor-pointer"
                            onClick={() => selectClient(client.id)}
                          >
                            {client.full_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {showRecentClients && recentClients.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Clients</h3>
                      <div className="grid gap-2 max-h-60 overflow-y-auto">
                        {recentClients.map(client => (
                          <div
                            key={client.id}
                            className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                            onClick={() => selectClient(client.id)}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium text-slate-900">{client.full_name}</p>
                                <p className="text-sm text-slate-600">{client.email}</p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-400" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedClientId && (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ClipboardPlus className="text-blue-600"/>Step 2: Select Assessments</CardTitle>
                 <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search assessments by name or tag..."
                    value={assessmentSearchTerm}
                    onChange={(e) => setAssessmentSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {filteredAssessments.length > 0 ? filteredAssessments.map(assessment => (
                    <div key={assessment.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                      <Checkbox
                        id={`assess-${assessment.id}`}
                        checked={selectedAssessments.includes(assessment.id)}
                        onCheckedChange={() => handleAssessmentToggle(assessment.id)}
                      />
                      <div className="grid gap-1.5 leading-none flex-1">
                        <Label htmlFor={`assess-${assessment.id}`} className="font-semibold text-slate-800 cursor-pointer">
                          {assessment.name}
                        </Label>
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {assessment.description}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-center text-slate-500 py-4">No assessments found.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {selectedClientId && selectedAssessments.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CheckCircle className="text-green-600"/>Step 3: Confirm and Assign</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-slate-700 mb-4">
                        You are about to assign <span className="font-bold">{selectedAssessments.length}</span> assessment(s) to <span className="font-bold">{selectedClient?.full_name}</span>.
                    </p>
                    <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700" 
                        onClick={handleAssignAssessments}
                        disabled={isAssigning}
                    >
                        {isAssigning ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Assigning...</>
                        ) : (
                            <><ArrowRight className="w-4 h-4 mr-2"/>Assign Assessments</>
                        )}
                    </Button>
                </CardContent>
            </Card>
          )}

        </div>
      </div>
    </>
  );
}