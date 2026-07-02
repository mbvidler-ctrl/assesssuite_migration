import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, FileText, MessageSquarePlus, X } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";

import AssessmentCard from "../components/assessments/AssessmentCard";
import AssessmentModal from "../components/assessments/AssessmentModal";
import AddToClientModal from "../components/client/AddToClientModal";
import CreateAssessmentModal from "../components/assessments/CreateAssessmentModal";
import FeedbackModal from "../components/assessments/FeedbackModal";

export default function AssessmentLibrary() {
  const [assessments, setAssessments] = useState([]);
  const [filteredAssessments, setFilteredAssessments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [showAddToClientModal, setShowAddToClientModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // New: Read URL parameters
  const [searchParams] = useSearchParams();
  const preSelectedClientId = searchParams.get('clientId');
  const appointmentId = searchParams.get('appointmentId');
  const mode = searchParams.get('mode'); // 'run' mode means we're running assessments for an appointment
  const returnTo = searchParams.get('returnTo'); // Get the return URL

  useEffect(() => {
    loadAssessments();
  }, []);

  useEffect(() => {
    filterAssessments();
  }, [assessments, searchTerm, categoryFilter]);

  const loadAssessments = async () => {
    setIsLoading(true);
    try {
      const data = await base44.entities.Assessment.list();
      
      // Filter out deleted assessments and YMCA assessments
      const activeAssessments = data.filter(a => !a.is_deleted && !a.name?.toLowerCase().includes('ymca'));
      
      // Remove duplicates and keep the most complete version
      const uniqueAssessmentsMap = new Map();
      const duplicatesFound = [];
      
      activeAssessments.forEach(assessment => {
        if (assessment.name) {
          const normalizedName = assessment.name.toLowerCase().trim();
          
          // Check if already in map
          if (uniqueAssessmentsMap.has(normalizedName)) {
            const existing = uniqueAssessmentsMap.get(normalizedName);
            
            // Skip deletion if either is explicitly marked as NOT a duplicate
            if (assessment.confirmed_not_duplicate || existing.confirmed_not_duplicate) {
              if (!uniqueAssessmentsMap.has(assessment.id)) {
                uniqueAssessmentsMap.set(assessment.id, assessment);
              }
              return;
            }
            
            // Keep the one with more complete data (more fields filled)
            const existingScore = getCompletenessScore(existing);
            const currentScore = getCompletenessScore(assessment);
            
            if (currentScore > existingScore) {
              // Current assessment is more complete, mark existing for deletion
              duplicatesFound.push(existing);
              uniqueAssessmentsMap.set(normalizedName, assessment);
            } else {
              // Existing assessment is more complete, mark current for deletion
              duplicatesFound.push(assessment);
            }
          } else {
            uniqueAssessmentsMap.set(normalizedName, assessment);
          }
        }
      });
      
      // Delete the less complete duplicates
      if (duplicatesFound.length > 0) {
        console.log(`Found ${duplicatesFound.length} duplicate assessments to clean up`);
        try {
          await Promise.all(
            duplicatesFound.map(duplicate => base44.entities.Assessment.delete(duplicate.id))
          );
          toast.success(`Cleaned up ${duplicatesFound.length} duplicate assessments`);
        } catch (error) {
          console.error("Error cleaning up duplicates:", error);
        }
      }
      
      const uniqueAssessments = Array.from(uniqueAssessmentsMap.values());
      setAssessments(uniqueAssessments);
      
    } catch (error) {
      console.error("Error loading assessments:", error);
      toast.error("Failed to load assessments.");
    }
    setIsLoading(false);
  };

  // Function to score how complete an assessment is
  const getCompletenessScore = (assessment) => {
    let score = 0;
    
    // Basic required fields
    if (assessment.name) score += 1;
    if (assessment.description) score += 1;
    if (assessment.category) score += 1;
    
    // Optional but important fields
    if (assessment.instructions) score += 2;
    if (assessment.scoring_system) score += 2;
    if (assessment.unit_of_measure) score += 1;
    if (assessment.equipment_needed) score += 1;
    if (assessment.contraindications) score += 1;
    if (assessment.references) score += 1;
    
    // Array fields
    if (assessment.conditions_indicated && assessment.conditions_indicated.length > 0) score += 1;
    if (assessment.search_tags && assessment.search_tags.length > 0) score += 1;
    if (assessment.normative_data && assessment.normative_data.length > 0) score += 2;
    
    return score;
  };

  const filterAssessments = () => {
    let filtered = [...assessments];

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(assessment =>
        assessment.name.toLowerCase().includes(lowercasedTerm) ||
        assessment.description.toLowerCase().includes(lowercasedTerm) ||
        (assessment.search_tags && assessment.search_tags.some(tag => 
          tag.toLowerCase().includes(lowercasedTerm)
        )) ||
        (assessment.conditions_indicated && assessment.conditions_indicated.some(condition =>
          condition.toLowerCase().includes(lowercasedTerm)
        ))
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(assessment => assessment.category === categoryFilter);
    }

    // Sort alphabetically by name
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    setFilteredAssessments(filtered);
  };

  const handleAssessmentClick = (assessment) => {
    setSelectedAssessment(assessment);
  };

  const handleAddToClient = () => {
    if (!selectedAssessment) return;
    setShowAddToClientModal(true);
  };

  // New: Function to directly run/assign an assessment linked to an appointment
  const handleDirectRunAssessment = async (assessment) => {
    try {
      // Add loading state
      setIsLoading(true);
      
      // Validate required data
      if (!preSelectedClientId || !assessment?.id || !appointmentId) {
        throw new Error("Missing required data: client ID, assessment ID, or appointment ID");
      }

      console.log("Creating client assessment with data:", {
        client_id: preSelectedClientId,
        assessment_id: assessment.id,
        appointment_id: appointmentId
      });

      // Create the client assessment with retry logic
      let clientAssessment;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          // First get the client to fetch org_id
          const client = await base44.entities.Client.get(preSelectedClientId);
          if (!client) {
            throw new Error("Client not found");
          }

          clientAssessment = await base44.entities.ClientAssessment.create({
            org_id: client.org_id,
            client_id: preSelectedClientId,
            assessment_id: assessment.id,
            status: 'pending',
            assessment_date: new Date().toISOString().split('T')[0],
            appointment_id: appointmentId
          });
          break; // Success, exit retry loop
        } catch (createError) {
          retryCount++;
          console.error(`Attempt ${retryCount} failed:`, createError);
          
          if (retryCount >= maxRetries) {
            throw createError; // Re-throw after max retries
          }
          
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
        }
      }

      if (!clientAssessment || !clientAssessment.id) {
        throw new Error("Failed to create client assessment - no ID returned");
      }

      console.log("Successfully created client assessment:", clientAssessment);

      // Navigate to TestRunner, passing the returnTo parameter along
      let url = createPageUrl(`TestRunner?clientAssessmentId=${clientAssessment.id}&appointmentId=${appointmentId}`);
      if (returnTo) {
        url += `&returnTo=${encodeURIComponent(returnTo)}`;
      }

      console.log("Navigating to:", url);
      window.location.href = url; // Direct navigation
      
    } catch (error) {
      console.error("Failed to create client assessment for direct run:", error);
      
      // More specific error messages
      let errorMessage = "Failed to start assessment.";
      if (error.message?.includes("Network Error") || error.message?.includes("network")) {
        errorMessage = "Network connection issue. Please check your internet connection and try again.";
      } else if (error.message?.includes("Missing required data")) {
        errorMessage = "Missing required information. Please try again from the appointment.";
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssessmentAdded = () => {
    toast.success("Assessment added to client successfully!");
    setShowAddToClientModal(false);
    setSelectedAssessment(null);
  };

  const handleCreateAssessment = () => {
    setShowCreateModal(true);
  };

  const handleAssessmentCreated = () => {
    loadAssessments(); // Refresh the list
    setShowCreateModal(false);
    toast.success("Assessment created successfully!");
  };

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "musculoskeletal", label: "Musculoskeletal" },
    { value: "neurological", label: "Neurological" },
    { value: "cardio_pulmonary", label: "Cardio & Pulmonary" },
    { value: "metabolic", label: "Metabolic" },
    { value: "mental_health", label: "Mental Health" },
    { value: "pediatric", label: "Pediatric" },
    { value: "geriatric", label: "Geriatric" },
    { value: "general", label: "General" }
  ];

  const getCategoryCount = (category) => {
    if (category === "all") return assessments.length;
    return assessments.filter(a => a.category === category).length;
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Assessment Library</h1>
                <p className="text-slate-600">Browse and manage clinical assessments</p>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <Button 
                onClick={handleCreateAssessment}
                className="bg-green-600 hover:bg-green-700 w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Assessment
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowFeedbackModal(true)}
                className="w-full"
              >
                <MessageSquarePlus className="w-4 h-4 mr-2" />
                Request an Assessment
              </Button>
            </div>
          </div>

          {/* Search and Filter Bar */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search assessments by name, description, conditions, or tags..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category.value} value={category.value}>
                          <div className="flex items-center justify-between w-full">
                            <span>{category.label}</span>
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {getCategoryCount(category.value)}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Summary */}
          <div className="flex items-center justify-between">
            <p className="text-slate-600">
              Showing {filteredAssessments.length} of {assessments.length} assessments
            </p>
          </div>

          {/* Assessment Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-slate-200 rounded"></div>
                      <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAssessments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAssessments.map((assessment) => (
                <AssessmentCard
                  key={assessment.id}
                  assessment={assessment}
                  onClick={() => handleAssessmentClick(assessment)}
                />
              ))}
            </div>
          ) : (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Assessments Found</h3>
                <p className="text-slate-600 mb-4">
                  {searchTerm || categoryFilter !== "all" 
                    ? "Try adjusting your search or filter criteria"
                    : "No assessments available in the library"
                  }
                </p>
                <Button onClick={handleCreateAssessment} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Assessment
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedAssessment && !showAddToClientModal && (
        <AssessmentModal
          assessment={selectedAssessment}
          onClose={() => setSelectedAssessment(null)}
          onAddToClient={handleAddToClient}
        />
      )}

      {showAddToClientModal && selectedAssessment && (
        <AddToClientModal
          assessment={selectedAssessment}
          onClose={() => {
            setShowAddToClientModal(false);
            setSelectedAssessment(null);
          }}
          onAssessmentAdded={handleAssessmentAdded}
        />
      )}

      {showCreateModal && (
        <CreateAssessmentModal
          onClose={() => setShowCreateModal(false)}
          onAssessmentCreated={handleAssessmentCreated}
        />
      )}

      {showFeedbackModal && (
        <FeedbackModal onClose={() => setShowFeedbackModal(false)} />
      )}
    </>
  );
}