import React, { useState, useEffect } from "react";
import { SOAPNote, Appointment, ClientAssessment, Assessment } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Plus, 
  Edit, 
  Eye, 
  Calendar,
  Loader2,
  Clock,
  CheckCircle2,
  FileEdit,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import SOAPNoteModal from "../calendar/SOAPNoteModal";

export default function ClientSOAPNotes({ client }) {
  const [soapNotes, setSoapNotes] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSOAPModal, setShowSOAPModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (client && client.id) {
      loadSOAPNotes();
    }
  }, [client?.id]);

  const loadSOAPNotes = async () => {
    setIsLoading(true);
    try {
      const [notesData, appointmentsData] = await Promise.all([
        SOAPNote.filter({ client_id: client.id }),
        Appointment.filter({ client_id: client.id })
      ]);

      // Sort notes by date (newest first)
      const sortedNotes = notesData.sort((a, b) => 
        new Date(b.note_date) - new Date(a.note_date)
      );
      
      // Sort appointments by date
      const sortedAppointments = appointmentsData
        .map(apt => ({
          ...apt,
          start: new Date(apt.start_time),
          end: new Date(apt.end_time),
        }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      setSoapNotes(sortedNotes);
      setAppointments(sortedAppointments);
    } catch (error) {
      console.error("Error loading SOAP notes:", error);
      toast.error("Failed to load SOAP notes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewSOAPNote = () => {
    // Create a new "virtual" appointment for today
    const now = new Date();
    const virtualAppointment = {
      id: `virtual_${Date.now()}`,
      title: `Session with ${client.full_name}`,
      client_id: client.id,
      start_time: now.toISOString(),
      end_time: new Date(now.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour later
      start: now,
      end: new Date(now.getTime() + 60 * 60 * 1000),
      status: 'completed',
      notes: '',
      isVirtual: true // Flag to indicate this is not a real calendar appointment
    };

    setSelectedAppointment(virtualAppointment);
    setCurrentIndex(-1);
    setShowSOAPModal(true);
  };

  const handleEditSOAPNote = (note) => {
    // Find the appointment for this note
    const appointment = appointments.find(apt => apt.id === note.appointment_id);
    
    if (appointment) {
      const appointmentIndex = appointments.findIndex(apt => apt.id === note.appointment_id);
      setSelectedAppointment(appointment);
      setCurrentIndex(appointmentIndex);
    } else {
      // Create a virtual appointment based on the note.
      // If the note has an appointment_id (e.g. from automated test data), use it so the modal
      // can look up the SOAP note by appointment_id rather than searching by date+null.
      const virtualAppointment = {
        id: note.appointment_id || `virtual_${Date.now()}`,
        title: `Session with ${client.full_name}`,
        client_id: client.id,
        start_time: note.note_date,
        end_time: note.note_date,
        start: new Date(note.note_date),
        end: new Date(note.note_date),
        status: 'completed',
        notes: '',
        isVirtual: !note.appointment_id  // Only mark virtual if there's no real appointment_id
      };
      setSelectedAppointment(virtualAppointment);
      setCurrentIndex(-1);
    }
    
    setShowSOAPModal(true);
  };

  const handleCloseModal = () => {
    setShowSOAPModal(false);
    setSelectedAppointment(null);
    setCurrentIndex(-1);
    loadSOAPNotes(); // Refresh the list
  };

  const handleNavigate = (direction) => {
    if (currentIndex === -1) return; // Can't navigate if no appointment context
    
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < appointments.length) {
      setSelectedAppointment(appointments[newIndex]);
      setCurrentIndex(newIndex);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardContent className="py-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-slate-500">Loading SOAP notes...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-blue-600" />
                Client SOAP Notes
              </CardTitle>
              <Badge variant="secondary">{soapNotes.length}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNewSOAPNote();
                }}
                className="bg-blue-600 hover:bg-blue-700"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                New SOAP Note
              </Button>
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent>
            {soapNotes.length > 0 ? (
              <div className="space-y-3">
                {soapNotes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  onClick={() => handleEditSOAPNote(note)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-900">
                          {note.note_name || 'Session Note'}
                        </h4>
                        <Badge 
                          variant={note.status === 'published' ? 'default' : 'secondary'}
                          className={note.status === 'published' ? 'bg-green-100 text-green-800' : ''}
                        >
                          {note.status === 'published' ? (
                            <><CheckCircle2 className="w-3 h-3 mr-1" /> Published</>
                          ) : (
                            <><Clock className="w-3 h-3 mr-1" /> Draft</>
                          )}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(note.note_date), 'PPP')}
                        {note.published_date && (
                          <span className="text-xs">
                            • Published {format(new Date(note.published_date), 'PPp')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditSOAPNote(note);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {note.status === 'published' ? 'View' : 'Edit'}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-4">No SOAP notes recorded yet</p>
              <Button
                onClick={handleNewSOAPNote}
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First SOAP Note
              </Button>
            </div>
          )}
          </CardContent>
        )}
      </Card>

      {showSOAPModal && selectedAppointment && (
        <SOAPNoteModal
          appointment={selectedAppointment}
          client={client}
          onClose={handleCloseModal}
          onNavigate={currentIndex >= 0 ? handleNavigate : null}
          hasPrev={currentIndex > 0}
          hasNext={currentIndex >= 0 && currentIndex < appointments.length - 1}
          sessionInfo={currentIndex >= 0 ? {
            current: currentIndex + 1,
            total: appointments.length,
          } : null}
        />
      )}
    </>
  );
}