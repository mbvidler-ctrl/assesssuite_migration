import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { todayLocal } from "@/lib/localDate";

export default function AddToClientModal({ assessment, onClose, onAssessmentAdded }) {
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const userData = await base44.auth.me();
        
        // Get user's organization
        const orgMemberships = await base44.entities.OrganizationMember.filter({ user_email: userData.email });
        const userOrgId = orgMemberships.length > 0 ? orgMemberships[0].org_id : null;

        if (!userOrgId) {
          console.warn("User has no organization membership");
          setClients([]);
          setFilteredClients([]);
          setIsLoading(false);
          return;
        }

        // Load clients from user's organization only
        const data = await base44.entities.Client.filter({ org_id: userOrgId });
        console.log('[AddToClientModal] Loaded clients for org_id:', userOrgId, 'Count:', data?.length);
        setClients(data || []);
        setFilteredClients(data || []);
      } catch (error) {
        console.error("Error loading clients:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadClients();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = clients.filter(client =>
        client.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(clients);
    }
  }, [searchTerm, clients]);

  const handleAddAssessment = async () => {
    if (!selectedClientId) return;
    setIsAdding(true);
    
    try {
      // Fetch the client to get org_id
      const selectedClient = clients.find(c => c.id === selectedClientId);
      if (!selectedClient) {
        throw new Error("Client not found");
      }

      // Add retry logic
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          await base44.entities.ClientAssessment.create({
            org_id: selectedClient.org_id,
            client_id: selectedClientId,
            assessment_id: assessment.id,
            assessment_date: todayLocal(),
            status: "pending",
          });
          break; // Success
        } catch (createError) {
          retryCount++;
          console.error(`Add assessment attempt ${retryCount} failed:`, createError);
          
          if (retryCount >= maxRetries) {
            throw createError;
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
      
      onAssessmentAdded();
      onClose();
    } catch (error) {
      console.error("Failed to add assessment to client:", error);
      
      let errorMessage = "Failed to add assessment to client.";
      if (error.message?.includes("Network Error") || error.message?.includes("network")) {
        errorMessage = "Network connection issue. Please check your internet connection and try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add "{assessment.name}" to a client</DialogTitle>
        </DialogHeader>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
          {isLoading ? (
            <p>Loading clients...</p>
          ) : (
            filteredClients.map(client => (
              <div
                key={client.id}
                onClick={() => setSelectedClientId(client.id)}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedClientId === client.id
                    ? "bg-blue-100 border-blue-400"
                    : "hover:bg-slate-50"
                }`}
              >
                <p className="font-medium">{client.full_name}</p>
                <p className="text-sm text-slate-500">{client.email}</p>
              </div>
            ))
          )}
          {!isLoading && filteredClients.length === 0 && (
            <p className="text-center text-slate-500">No clients found. You can only see clients you have created.</p>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleAddAssessment}
            disabled={!selectedClientId || isAdding}
          >
            {isAdding ? "Adding..." : "Add to Client"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}