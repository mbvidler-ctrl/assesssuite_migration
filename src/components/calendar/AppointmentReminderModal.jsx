import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Calendar, 
  ClipboardList, 
  FileText, 
  AlertCircle, 
  Clock,
  CheckCircle,
  X
} from 'lucide-react';
import { format, addWeeks, addDays, parseISO } from 'date-fns';
import { toast } from 'sonner';

export default function AppointmentReminderModal({ 
  client, 
  lastAppointmentDate,
  onClose, 
  onBookAppointment,
  onBookAssessment 
}) {
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dismissedReminders, setDismissedReminders] = useState([]);

  useEffect(() => {
    if (client) {
      analyzeClientNeeds();
    }
  }, [client]);

  const analyzeClientNeeds = async () => {
    setIsLoading(true);
    try {
      // Get all appointments and assessments for this client
      const [appointments, assessments, soapNotes] = await Promise.all([
        base44.entities.Appointment.filter({ client_id: client.id }),
        base44.entities.ClientAssessment.filter({ client_id: client.id }),
        base44.entities.SOAPNote.filter({ client_id: client.id, status: 'published' })
      ]);

      const completedAppointments = appointments.filter(apt => 
        apt.status === 'completed' || apt.status === 'scheduled'
      ).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

      const completedSessions = soapNotes.length;
      const lastSession = completedAppointments[completedAppointments.length - 1];
      
      const suggestions = [];

      // Funding source specific reminders
      switch(client.funding_source) {
        case 'dva':
          suggestions.push(...getDVAReminders(completedSessions, assessments, lastSession));
          break;
        case 'medicare':
          suggestions.push(...getMedicareReminders(completedSessions, assessments, lastSession));
          break;
        case 'workcover_qld':
          suggestions.push(...getWorkCoverReminders(completedSessions, assessments, lastSession));
          break;
        case 'ndis':
          suggestions.push(...getNDISReminders(completedSessions, assessments, lastSession));
          break;
        case 'private_health':
          suggestions.push(...getPrivateHealthReminders(completedSessions, assessments, lastSession));
          break;
        case 'aged_care':
        case 'my_aged_care':
          suggestions.push(...getAgedCareReminders(completedSessions, assessments, lastSession));
          break;
        default:
          suggestions.push(...getGeneralReminders(completedSessions, assessments, lastSession));
      }

      setReminders(suggestions);
    } catch (error) {
      console.error('Error analyzing client needs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDVAReminders = (sessionCount, assessments, lastSession) => {
    const reminders = [];
    const cyclePosition = sessionCount % 5;
    
    if (cyclePosition === 4 || sessionCount === 4) {
      reminders.push({
        id: 'dva-end-cycle',
        type: 'report',
        priority: 'high',
        title: 'DVA End of Cycle Report Due',
        description: `Session ${sessionCount + 1} will complete this cycle. End of Cycle Report is required before starting the next cycle.`,
        action: 'Generate DVA End of Cycle Report',
        dueAfterSessions: 1,
        icon: FileText,
        color: 'red'
      });
    } else if (cyclePosition === 0 && sessionCount > 0) {
      reminders.push({
        id: 'dva-new-cycle',
        type: 'report',
        priority: 'high',
        title: 'New DVA Cycle - Patient Care Plan Required',
        description: 'Starting a new cycle of 5 sessions. A new Patient Care Plan should be prepared.',
        action: 'Generate DVA Patient Care Plan',
        icon: ClipboardList,
        color: 'orange'
      });
    }

    if (sessionCount % 5 === 2) {
      reminders.push({
        id: 'dva-reassessment',
        type: 'assessment',
        priority: 'medium',
        title: 'Mid-Cycle Progress Assessment Recommended',
        description: 'Consider reassessing client progress to track improvements.',
        action: 'Schedule Assessment',
        suggestedDate: lastSession ? addWeeks(parseISO(lastSession.start_time), 1) : addWeeks(new Date(), 1),
        icon: ClipboardList,
        color: 'blue'
      });
    }

    return reminders;
  };

  const getMedicareReminders = (sessionCount, assessments, lastSession) => {
    const reminders = [];
    
    if (sessionCount >= 4) {
      reminders.push({
        id: 'medicare-final-report',
        type: 'report',
        priority: 'high',
        title: 'Medicare Sessions Almost Complete',
        description: `${sessionCount} sessions completed. Final letter to GP is recommended before discharge.`,
        action: 'Generate Medicare Final Letter',
        icon: FileText,
        color: 'red'
      });
    }

    if (sessionCount === 0) {
      reminders.push({
        id: 'medicare-initial',
        type: 'report',
        priority: 'medium',
        title: 'Medicare Initial Assessment Letter',
        description: 'Send initial assessment letter to referring GP.',
        action: 'Generate Medicare Initial Letter',
        icon: FileText,
        color: 'blue'
      });
    }

    if (sessionCount === 2) {
      reminders.push({
        id: 'medicare-progress',
        type: 'assessment',
        priority: 'medium',
        title: 'Mid-Treatment Progress Assessment',
        description: 'Reassess client progress to determine treatment effectiveness.',
        action: 'Schedule Assessment',
        suggestedDate: lastSession ? addWeeks(parseISO(lastSession.start_time), 1) : addWeeks(new Date(), 1),
        icon: ClipboardList,
        color: 'blue'
      });
    }

    return reminders;
  };

  const getWorkCoverReminders = (sessionCount, assessments, lastSession) => {
    const reminders = [];
    
    if (sessionCount % 4 === 0 && sessionCount > 0) {
      reminders.push({
        id: 'workcover-progress',
        type: 'report',
        priority: 'high',
        title: 'WorkCover Progress Report Due',
        description: 'Progress report required for case manager after every 4 sessions.',
        action: 'Generate WorkCover Progress Report',
        icon: FileText,
        color: 'orange'
      });
    }

    if (sessionCount === 0) {
      reminders.push({
        id: 'workcover-pmp',
        type: 'report',
        priority: 'high',
        title: 'WorkCover PMP Required',
        description: 'Provisional Medical Plan (PMP) should be submitted after initial assessment.',
        action: 'Generate WorkCover PMP',
        icon: FileText,
        color: 'red'
      });
    }

    if (sessionCount % 4 === 2) {
      reminders.push({
        id: 'workcover-functional',
        type: 'assessment',
        priority: 'medium',
        title: 'Functional Capacity Assessment',
        description: 'Reassess work capacity and functional limitations.',
        action: 'Schedule Assessment',
        suggestedDate: lastSession ? addWeeks(parseISO(lastSession.start_time), 1) : addWeeks(new Date(), 1),
        icon: ClipboardList,
        color: 'blue'
      });
    }

    return reminders;
  };

  const getNDISReminders = (sessionCount, assessments, lastSession) => {
    const reminders = [];
    
    if (sessionCount % 6 === 0 && sessionCount > 0) {
      reminders.push({
        id: 'ndis-progress',
        type: 'report',
        priority: 'medium',
        title: 'NDIS Progress Update Recommended',
        description: 'Update support coordinator on client progress and goal achievement.',
        action: 'Generate NDIS Progress Report',
        icon: FileText,
        color: 'blue'
      });
    }

    if (sessionCount === 0) {
      reminders.push({
        id: 'ndis-initial',
        type: 'report',
        priority: 'medium',
        title: 'NDIS Initial Assessment',
        description: 'Document baseline functional capacity for NDIS records.',
        action: 'Generate NDIS Initial Assessment',
        icon: FileText,
        color: 'blue'
      });
    }

    return reminders;
  };

  const getPrivateHealthReminders = (sessionCount, assessments, lastSession) => {
    const reminders = [];
    
    if (sessionCount % 5 === 0 && sessionCount > 0) {
      reminders.push({
        id: 'private-progress',
        type: 'report',
        priority: 'medium',
        title: 'Private Health Progress Report',
        description: 'Progress report may be required for insurance claim continuation.',
        action: 'Generate Private Health Progress Report',
        icon: FileText,
        color: 'blue'
      });
    }

    if (sessionCount === 0) {
      reminders.push({
        id: 'private-initial',
        type: 'report',
        priority: 'medium',
        title: 'Private Health Initial Assessment',
        description: 'Initial assessment report for private health insurer.',
        action: 'Generate Private Health Initial Assessment',
        icon: FileText,
        color: 'blue'
      });
    }

    return reminders;
  };

  const getAgedCareReminders = (sessionCount, assessments, lastSession) => {
    const reminders = [];
    
    if (sessionCount % 6 === 0 && sessionCount > 0) {
      reminders.push({
        id: 'aged-care-review',
        type: 'report',
        priority: 'medium',
        title: 'Aged Care Review Report',
        description: 'Update case manager on functional improvements and safety.',
        action: 'Generate Aged Care Assessment',
        icon: FileText,
        color: 'blue'
      });
    }

    return reminders;
  };

  const getGeneralReminders = (sessionCount, assessments, lastSession) => {
    const reminders = [];
    
    if (sessionCount % 5 === 0 && sessionCount > 0) {
      reminders.push({
        id: 'general-reassessment',
        type: 'assessment',
        priority: 'medium',
        title: 'Progress Reassessment Recommended',
        description: 'Regular reassessment helps track client progress.',
        action: 'Schedule Assessment',
        suggestedDate: lastSession ? addWeeks(parseISO(lastSession.start_time), 1) : addWeeks(new Date(), 1),
        icon: ClipboardList,
        color: 'blue'
      });
    }

    return reminders;
  };

  const handleDismiss = (reminderId) => {
    setDismissedReminders(prev => [...prev, reminderId]);
  };

  const handleAction = (reminder) => {
    if (reminder.type === 'report') {
      onClose();
      toast.success(`Navigate to Reports to generate: ${reminder.action}`);
    } else if (reminder.type === 'assessment') {
      if (onBookAssessment) {
        onBookAssessment(reminder.suggestedDate);
      }
      onClose();
    } else if (reminder.type === 'appointment') {
      if (onBookAppointment) {
        onBookAppointment(reminder.suggestedDate);
      }
      onClose();
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return 'border-red-300 bg-red-50';
      case 'medium': return 'border-blue-300 bg-blue-50';
      case 'low': return 'border-gray-300 bg-gray-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const getPriorityBadge = (priority) => {
    switch(priority) {
      case 'high': return <Badge className="bg-red-600">High Priority</Badge>;
      case 'medium': return <Badge className="bg-blue-600">Medium Priority</Badge>;
      case 'low': return <Badge variant="secondary">Low Priority</Badge>;
      default: return null;
    }
  };

  const activeReminders = reminders.filter(r => !dismissedReminders.includes(r.id));

  if (isLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent>
          <div className="p-8 text-center">
            <p>Analyzing client progress...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (activeReminders.length === 0) {
    return null; // Don't show modal if no reminders
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            Clinical Reminders for {client.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <p className="text-sm text-slate-600">
            Based on {client.full_name}'s funding source (<Badge variant="outline">{client.funding_source?.toUpperCase()}</Badge>) and treatment progress, here are some recommendations:
          </p>

          {activeReminders.map((reminder) => {
            const Icon = reminder.icon;
            return (
              <Card key={reminder.id} className={`border-2 ${getPriorityColor(reminder.priority)}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        <Icon className="w-5 h-5 text-slate-700" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900">{reminder.title}</h4>
                          {getPriorityBadge(reminder.priority)}
                        </div>
                        <p className="text-sm text-slate-600">{reminder.description}</p>
                        {reminder.suggestedDate && (
                          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Suggested: {format(reminder.suggestedDate, 'PPP')}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDismiss(reminder.id)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAction(reminder)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {reminder.action}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDismiss(reminder.id)}
                    >
                      Not Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}