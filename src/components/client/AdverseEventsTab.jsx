import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { AlertTriangle, FileText, Calendar, User, Plus, Phone, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import AdverseEventForm from "./AdverseEventForm";

export default function AdverseEventsTab({ client }) {
  const [adverseEvents, setAdverseEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewingEvent, setViewingEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showEmergencyNumbers, setShowEmergencyNumbers] = useState(false);

  const EMERGENCY_NUMBERS = [
    { country: "🇦🇺 Australia",    police: "000", ambulance: "000", mental_health: "Lifeline 13 11 14" },
    { country: "🇳🇿 New Zealand",  police: "111", ambulance: "111", mental_health: "Lifeline 0800 543 354" },
    { country: "🇬🇧 United Kingdom", police: "999", ambulance: "999", mental_health: "Samaritans 116 123" },
    { country: "🇺🇸 United States", police: "911", ambulance: "911", mental_health: "988 Suicide & Crisis Lifeline" },
    { country: "🇨🇦 Canada",       police: "911", ambulance: "911", mental_health: "Crisis Services Canada 1-833-456-4566" },
    { country: "🇿🇦 South Africa", police: "10111", ambulance: "10177", mental_health: "SADAG 0800 456 789" },
    { country: "🇸🇬 Singapore",    police: "999", ambulance: "995", mental_health: "SOS 1767" },
    { country: "🇮🇪 Ireland",      police: "999", ambulance: "999", mental_health: "Samaritans 116 123" },
  ];

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      const events = await base44.entities.AdverseEvent.filter(
        { client_id: client.id },
        "-report_date"
      );
      setAdverseEvents(events || []);
    } catch (error) {
      console.error("Error loading adverse events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (client?.id) {
      loadEvents();
    }
  }, [client]);

  const getSeverityBadge = (event) => {
    if (event.is_sae === "yes") return <Badge className="bg-red-100 text-red-800">SAE</Badge>;
    if (event.is_aesi === "yes") return <Badge className="bg-yellow-100 text-yellow-800">AESI</Badge>;
    return <Badge variant="outline">Reported Event</Badge>;
  };

  const getStatusBadge = (status) => {
    const colors = {
      draft: "bg-slate-100 text-slate-800",
      submitted: "bg-blue-100 text-blue-800",
      reviewed: "bg-green-100 text-green-800"
    };
    return <Badge className={colors[status] || colors.draft}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Adverse Events</h2>
          <p className="text-sm text-slate-600">Safety event reports for this client</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-red-600 hover:bg-red-700">
          <Plus className="w-4 h-4 mr-2" />
          Log Adverse Event
        </Button>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-red-800">
            <Phone className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm font-medium">
              If this event is still occurring or the client is in immediate danger,{" "}
              <span className="font-bold">call emergency services in your country immediately.</span>
            </p>
          </div>
          <button
            onClick={() => setShowEmergencyNumbers(v => !v)}
            className="flex items-center gap-1 text-xs text-red-700 hover:text-red-900 whitespace-nowrap font-medium underline underline-offset-2"
          >
            See numbers
            <ChevronDown className={`w-3 h-3 transition-transform ${showEmergencyNumbers ? "rotate-180" : ""}`} />
          </button>
        </div>
        {showEmergencyNumbers && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {EMERGENCY_NUMBERS.map(({ country, police, ambulance, mental_health }) => (
              <div key={country} className="bg-white rounded border border-red-200 px-3 py-2 text-xs space-y-0.5">
                <p className="font-bold text-red-900">{country}</p>
                <p className="text-slate-700">🚔 Police / Ambulance: <span className="font-semibold">{police}</span>{ambulance !== police ? ` / ${ambulance}` : ""}</p>
                <p className="text-slate-600 text-[11px]">{mental_health}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Loading events...</div>
      ) : adverseEvents.length === 0 ? (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-green-600 mx-auto mb-3 opacity-50" />
            <p className="text-slate-600 font-medium">No adverse events reported</p>
            <p className="text-sm text-slate-500 mt-1">This is a good sign - client has had no safety concerns</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {adverseEvents.map(event => (
            <Card key={event.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setViewingEvent(event)}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-5 h-5 ${
                      event.is_sae === "yes" ? "text-red-600" : 
                      event.is_aesi === "yes" ? "text-yellow-600" : 
                      "text-slate-500"
                    }`} />
                    <CardTitle className="text-base">
                      {event.is_sae === "yes" ? "Serious Adverse Event" :
                       event.is_aesi === "yes" ? "Adverse Event of Special Interest" :
                       "Adverse Event Report"}
                    </CardTitle>
                  </div>
                  <div className="flex gap-2">
                    {getSeverityBadge(event)}
                    {getStatusBadge(event.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-slate-600">Report Date</Label>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(event.report_date), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Onset Date</Label>
                    <p className="font-medium">
                      {event.date_of_onset ? format(new Date(event.date_of_onset), 'dd/MM/yyyy') : "—"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Reported By</Label>
                    <p className="font-medium flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {event.clinician_name}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-slate-600">Event Description</Label>
                  <p className="text-sm text-slate-900 mt-1 whitespace-pre-wrap">{event.event_description}</p>
                </div>

                {event.is_sae === "yes" && (
                  <div className="bg-red-50 p-3 rounded border border-red-200">
                    <p className="text-xs font-semibold text-red-900 mb-2">SAE Information</p>
                    <div className="grid md:grid-cols-2 gap-2 text-xs">
                      {event.sae_category && (
                        <div><span className="font-semibold">Category:</span> {event.sae_category.replace(/_/g, ' ')}</div>
                      )}
                      {event.sae_relationship_to_activity && (
                        <div><span className="font-semibold">Relationship:</span> {event.sae_relationship_to_activity.toUpperCase()}</div>
                      )}
                      {event.sae_outcome && (
                        <div className="col-span-2"><span className="font-semibold">Outcome:</span> {event.sae_outcome}</div>
                      )}
                    </div>
                  </div>
                )}

                {event.is_aesi === "yes" && (
                  <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                    <p className="text-xs font-semibold text-yellow-900 mb-2">AESI Information</p>
                    <div className="grid md:grid-cols-2 gap-2 text-xs">
                      {event.aesi_type && (
                        <div><span className="font-semibold">Type:</span> {event.aesi_type.replace(/_/g, ' ')}</div>
                      )}
                      {event.aesi_relationship_to_activity && (
                        <div><span className="font-semibold">Relationship:</span> {event.aesi_relationship_to_activity.toUpperCase()}</div>
                      )}
                      {event.aesi_outcome && (
                        <div className="col-span-2"><span className="font-semibold">Outcome:</span> {event.aesi_outcome}</div>
                      )}
                    </div>
                  </div>
                )}


              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AdverseEventForm
        client={client}
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmitted={loadEvents}
      />

      {viewingEvent && (
        <AdverseEventForm
          client={client}
          isOpen={!!viewingEvent}
          onClose={() => setViewingEvent(null)}
          readOnly={true}
          existingEvent={viewingEvent}
          onEdit={() => {
            const evt = viewingEvent;
            setViewingEvent(null);
            setEditingEvent(evt);
          }}
        />
      )}

      {editingEvent && (
        <AdverseEventForm
          client={client}
          isOpen={!!editingEvent}
          onClose={() => setEditingEvent(null)}
          existingEvent={editingEvent}
          onSubmitted={() => { loadEvents(); setEditingEvent(null); }}
        />
      )}
    </div>
  );
}