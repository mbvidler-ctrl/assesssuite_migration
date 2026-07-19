import React, { useState, useEffect, useCallback, useRef } from "react";
import { SOAPNote } from "@/entities/SOAPNote";
import { ClientAssessment } from "@/entities/ClientAssessment";
import { Assessment } from "@/entities/Assessment";
import { ClientCondition } from "@/entities/ClientCondition";
import { User } from "@/entities/User";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { uploadTenantFile } from "@/lib/fileIntegrations";
import { X, Save, ChevronLeft, ChevronRight, Lock, Edit, History, Printer, Calendar, Clock, MapPin, Trash2, AlertTriangle, RefreshCw, Mic, Square, Loader2, Activity, ClipboardList, Sparkles, Paperclip, Upload, FileText, Copy, Check } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { toast } from "sonner";
import { base44 } from '@/api/base44Client';
import moment from "moment";
import { format } from 'date-fns';
import PrintableSOAPNote from "./PrintableSOAPNote";
import { createPageUrl } from "@/utils";
import { generateObjectiveText } from "../assessments/generateObjectiveText";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AppointmentReminderModal from './AppointmentReminderModal';
import VitalsQuickEntry from './VitalsQuickEntry';
import { SecureFileAudio, SecureFileLink } from '@/components/files/SecureFile';
import PendingAssessmentsModal from './PendingAssessmentsModal';
import AssessmentTestRunnerRouter from '../assessments/AssessmentTestRunnerRouter';
import ComplianceSection from './ComplianceSection';
import { todayLocal } from "@/lib/localDate";
import { recordLegalEvent } from "@/lib/legal/recordAcceptance";
import { EVENT_TYPES } from "@/lib/legal/documentRegistry";
import AIDisclosureNote from "@/components/legal/AIDisclosureNote";
import { useAuth } from "@/lib/AuthContext";

export default function SOAPNoteModal({
  appointment,
  client,
  onClose,
  onNavigate,
  hasPrev = false,
  hasNext = false,
  sessionInfo = null
}) {
  // Transcription launch switch (public settings, server-enforced too):
  // recording stays available; Transcribe/Dissect surfaces hide when off.
  const { appPublicSettings } = useAuth();
  const transcriptionEnabled = appPublicSettings?.public_settings?.transcription_enabled === true;

  const [soapNote, setSoapNote] = useState(null);
  const [originalSoapNote, setOriginalSoapNote] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAmending, setIsAmending] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isEditingSessionDetails, setIsEditingSessionDetails] = useState(false);
  
  // Modified sessionDetails state to include location_id and location_name
  const [sessionDetails, setSessionDetails] = useState({
    date: '',
    time: '',
    location_id: '', // New field for the UUID of the selected location
    location_name: '', // New field for the clinic name (display value)
    custom_location: '' // New field for custom location text when "other" is selected
  });
  const [noteName, setNoteName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const printRef = useRef();

  // New state for user's locations
  const [locations, setLocations] = useState([]);
  const [showReminders, setShowReminders] = useState(false);
  const [showVitalsEntry, setShowVitalsEntry] = useState(false);
  const [showPendingAssessments, setShowPendingAssessments] = useState(false);
  const [isGeneratingAssessment, setIsGeneratingAssessment] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [pendingAssessments, setPendingAssessments] = useState([]);
  const [recommendedAssessments, setRecommendedAssessments] = useState([]);
  const [runningAssessment, setRunningAssessment] = useState(null);
  const [copiedSOAP, setCopiedSOAP] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const fileInputRef = useRef(null);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSavingAudio, setIsSavingAudio] = useState(false);
  const [showRecordingConsent, setShowRecordingConsent] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null);

  // Transcription states
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastTranscribedUrl, setLastTranscribedUrl] = useState(null);
  const [showTranscriptPanel, setShowTranscriptPanel] = useState(false);
  const [sessionTranscript, setSessionTranscript] = useState('');
  const [isDissecting, setIsDissecting] = useState(false);


  // Fetch current user and their locations
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  
  const loadUserData = useCallback(async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
      setLocations(user.locations || []); // Assume user object has a 'locations' array
      setLocationsLoaded(true);
    } catch (error) {
      console.error("Failed to fetch current user or locations:", error);
      toast.error("Failed to load user data.");
      setLocationsLoaded(true); // Still mark as loaded even on error
    }
  }, []); // No dependencies for initial load

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);


  const generateObjectiveFromAssessments = useCallback(async (assessments, noteDate) => {
    if (assessments.length === 0) return '';

    let objectiveText = '';

    for (const ca of assessments) {
      // Use centralized generateObjectiveText function which prioritizes soap_text
      const assessmentText = generateObjectiveText(ca, ca);
      if (assessmentText) {
        objectiveText += assessmentText;
      }
    }

    return objectiveText;
  }, []);

  const loadAssessmentsSidebar = useCallback(async () => {
    try {
      // Load pending assessments and all assessments first
      const [pending, allAssessments] = await Promise.all([
        ClientAssessment.filter({ 
          client_id: client.id, 
          status: 'pending' 
        }),
        Assessment.list()
      ]);
      
      // Create a map for quick lookup
      const assessmentMap = new Map(allAssessments.map(a => [a.id, a]));
      
      // Get assessment details for pending
      const pendingWithDetails = pending.map(ca => {
        const assessment = assessmentMap.get(ca.assessment_id);
        return {
          ...ca,
          name: assessment?.name || 'Unknown',
          category: assessment?.category || 'general'
        };
      }).filter(ca => ca.name !== 'Unknown'); // Filter out assessments that don't exist anymore
      
      setPendingAssessments(pendingWithDetails);

      // Load client conditions
      const conditions = await ClientCondition.filter({ 
        client_id: client.id, 
        is_active: true 
      });

      // Find recommended assessments based on conditions (allAssessments already loaded above)
      const recommended = [];
      conditions.forEach(condition => {
        allAssessments.forEach(assessment => {
          if (assessment.conditions_indicated && 
              assessment.conditions_indicated.some(indicated => 
                condition.condition_name.toLowerCase().includes(indicated.toLowerCase()) ||
                indicated.toLowerCase().includes(condition.condition_name.toLowerCase())
              )
          ) {
            // Check if not already in client assessments
            const alreadyExists = pending.some(ca => ca.assessment_id === assessment.id);
            const alreadyInRecommended = recommended.some(r => r.id === assessment.id);
            
            if (!alreadyExists && !alreadyInRecommended) {
              recommended.push({
                ...assessment,
                relatedCondition: condition.condition_name
              });
            }
          }
        });
      });

      setRecommendedAssessments(recommended.slice(0, 5)); // Limit to top 5
    } catch (error) {
      console.error('Error loading assessments sidebar:', error);
    }
  }, [client.id]);

  const loadSOAPNoteAndAssessments = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load sidebar assessments
      await loadAssessmentsSidebar();
      let existingNotes = [];
      
      // Try to find existing SOAP note
      if (appointment.id && !appointment.isVirtual) {
        // For real appointments, search by appointment_id
        existingNotes = await SOAPNote.filter({ appointment_id: appointment.id });
      } else if (appointment.isVirtual) {
        // For virtual appointments, search by client_id and date
        const allClientNotes = await SOAPNote.filter({ client_id: client.id });
        const appointmentDate = format(new Date(appointment.start_time || appointment.start), 'yyyy-MM-dd');
        
        // Find notes from the same day that don't have an appointment_id (indicating a virtual/unlinked note)
        existingNotes = allClientNotes.filter(note => {
          const noteDate = format(new Date(note.note_date), 'yyyy-MM-dd');
          // Check if it's the same day AND if appointment_id is null or undefined
          return noteDate === appointmentDate && !note.appointment_id;
        });
      }

      let noteToSet;
      if (existingNotes.length > 0) {
        noteToSet = existingNotes[0];
        
        // Set session details from existing note
        const noteDate = new Date(noteToSet.note_date);
        let initialLocationId = noteToSet.location_id || ''; // Get location_id from note (new field)
        let initialLocationName = noteToSet.session_location || ''; // Fallback to old string name if ID is missing

        // If we have an ID and locations are loaded, find the actual name
        if (initialLocationId && locations.length > 0) {
            const foundLocation = locations.find(loc => loc.id === initialLocationId);
            if (foundLocation) {
                initialLocationName = foundLocation.clinic_name;
            }
        } else if (noteToSet.session_location && locations.length > 0) {
            // If only old session_location (name) exists, try to map it back to an ID
            const foundLocation = locations.find(loc => loc.clinic_name === noteToSet.session_location);
            if (foundLocation) {
                initialLocationId = foundLocation.id;
            }
        }
        
        setSessionDetails({
          date: format(noteDate, 'yyyy-MM-dd'),
          time: format(noteDate, 'HH:mm'),
          location_id: initialLocationId,
          location_name: initialLocationName
        });
        setNoteName(noteToSet.note_name || '');
      } else { // New Note
        const noteDate = appointment.start_time || appointment.start || new Date().toISOString();
        const startDate = new Date(noteDate);
        
        let defaultLocationId = '';
        let defaultLocationName = '';

        // Prioritize appointment's location, then user's main, then first available
        if (appointment.location_id && locations.length > 0) {
            const apptLocation = locations.find(loc => loc.id === appointment.location_id);
            if (apptLocation) {
                defaultLocationId = apptLocation.id;
                defaultLocationName = apptLocation.clinic_name;
            }
        } else if (locations.length > 0) {
            const mainLocation = locations.find(loc => loc.is_main) || locations[0];
            if (mainLocation) { // Ensure a location was found
                defaultLocationId = mainLocation.id;
                defaultLocationName = mainLocation.clinic_name;
            }
        }
        
        setSessionDetails({
          date: format(startDate, 'yyyy-MM-dd'),
          time: format(startDate, 'HH:mm'),
          location_id: defaultLocationId,
          location_name: defaultLocationName
        });
        
        noteToSet = {
          client_id: client.id,
          appointment_id: appointment.isVirtual ? null : appointment.id,
          note_date: noteDate,
          location_id: defaultLocationId, // Store ID
          session_location: defaultLocationName, // Store Name
          note_name: '',
          subjective: '',
          objective: '',
          assessment: '',
          plan: '',
          other: '',
          status: 'draft',
          history: []
        };
        setNoteName('');
      }

      let clientAssessments = [];
      
      if (appointment.id && !appointment.isVirtual) {
        clientAssessments = await ClientAssessment.filter({ appointment_id: appointment.id });
      }
      
      if (clientAssessments.length === 0) {
        const allClientAssessments = await ClientAssessment.filter({ client_id: client.id });
        const appointmentDate = format(new Date(appointment.start_time || appointment.start), 'yyyy-MM-dd');
        
        clientAssessments = allClientAssessments.filter(ca => {
          if (!ca.assessment_date) return false;
          const assessmentDate = format(new Date(ca.assessment_date), 'yyyy-MM-dd');
          return assessmentDate === appointmentDate;
        });
      }

      const assessmentPromises = clientAssessments.map(async (ca) => {
        const assessment = await Assessment.filter({ id: ca.assessment_id });
        return {
          ...ca,
          name: assessment[0]?.name || 'Unknown Assessment',
          unit_of_measure: assessment[0]?.unit_of_measure || ''
        };
      });

      const assessmentsWithNames = await Promise.all(assessmentPromises);
      setAssessments(assessmentsWithNames);

      if (assessmentsWithNames.length > 0 && (!noteToSet.objective || noteToSet.objective.trim() === '')) {
        // Pass the noteToSet.note_date directly to generateObjectiveFromAssessments
        const generatedObjective = await generateObjectiveFromAssessments(assessmentsWithNames, noteToSet.note_date);
        noteToSet.objective = generatedObjective;
      }
      
      if (!noteToSet.note_date) {
        noteToSet.note_date = appointment.start_time || appointment.start || new Date().toISOString();
      }
      
      setSoapNote(noteToSet);
      setOriginalSoapNote(JSON.parse(JSON.stringify(noteToSet)));
    } catch (error) {
      console.error("Error loading SOAP note data:", error);
      toast.error("Failed to load SOAP note data.");
    } finally {
      setIsLoading(false);
    }
  }, [appointment, client, generateObjectiveFromAssessments, currentUser, locations]);


  useEffect(() => {
    // Only proceed if currentUser is loaded AND locations have been loaded (even if empty array)
    if (appointment && client && currentUser && locationsLoaded) {
      setIsAmending(false);
      loadSOAPNoteAndAssessments();
    }
  }, [appointment?.id, client?.id, currentUser?.email, locationsLoaded, loadSOAPNoteAndAssessments]);

  // Check for imported protocol plan from sessionStorage
  useEffect(() => {
    const importedPlan = sessionStorage.getItem('importedProtocolPlan');
    if (importedPlan && soapNote) {
      const currentPlan = soapNote.plan || '';
      const newPlan = currentPlan ? `${currentPlan}\n\n${importedPlan}` : importedPlan;
      handleInputChange('plan', newPlan);
      sessionStorage.removeItem('importedProtocolPlan');
      toast.success("Treatment protocol imported to plan section");
    }
  }, [soapNote?.id]);

  const handleInputChange = (field, value) => {
    setSoapNote(prev => ({ ...prev, [field]: value }));
  };

  const handleSessionDetailChange = (field, value) => {
    setSessionDetails(prev => {
      if (field === 'location_id') {
        if (value === 'other') {
          return {
            ...prev,
            location_id: 'other',
            location_name: '',
            custom_location: ''
          };
        }
        const selectedLoc = locations.find(loc => loc.id === value);
        return {
          ...prev,
          location_id: value,
          location_name: selectedLoc ? selectedLoc.clinic_name : '',
          custom_location: ''
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSaveSessionDetails = () => {
    // Combine date and time into ISO string
    const combinedDateTime = new Date(`${sessionDetails.date}T${sessionDetails.time}`).toISOString();
    
    // Determine the location name to save
    const finalLocationName = sessionDetails.location_id === 'other' 
      ? sessionDetails.custom_location 
      : sessionDetails.location_name;
    
    // Update the soap note with new details
    setSoapNote(prev => ({
      ...prev,
      note_date: combinedDateTime,
      location_id: sessionDetails.location_id === 'other' ? null : sessionDetails.location_id, // Store null if "other"
      session_location: finalLocationName // Store the custom or selected location name
    }));
    
    setIsEditingSessionDetails(false);
    toast.success("Session details updated");
  };

  // Recording consent is captured per session, immediately before capture
  // starts — not at signup — per policy-suite doc 27 clause 2 ("Recording/
  // transcription consent ... per participant and session/function", a
  // requirement that a signup-time tick cannot satisfy). This records the
  // clinician's own consent-and-authority event for this specific session;
  // the client's own consent remains the treating practice's separate duty
  // under the Patient Collection Notice and Consent Pack (policy-suite doc 12).
  const handleConfirmRecording = async () => {
    setShowRecordingConsent(false);
    try {
      await recordLegalEvent({
        eventType: EVENT_TYPES.RECORDING_CONSENT,
        userEmail: currentUser?.email,
        orgId: client?.org_id,
        actorCapacity: "clinician",
        sessionContext: soapNote?.id || appointment?.id || `virtual-${client?.id}-${Date.now()}`,
      });
    } catch (error) {
      console.error("Failed to record recording consent", error);
      toast.error("Failed to record consent. Recording not started.");
      return;
    }
    startRecording();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      setIsRecording(true);
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await saveRecording(audioBlob);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success('Recording started!');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Check microphone permissions.');
    }
  };

  const saveRecording = async (audioBlob) => {
    setIsSavingAudio(true);
    try {
      const audioFile = new File([audioBlob], `session-${Date.now()}.webm`, { type: 'audio/webm' });
      const { file_url } = await uploadTenantFile({
        file: audioFile,
        org_id: client.org_id,
        purpose: 'audio-transcription',
        subject_date_of_birth: client.date_of_birth || undefined,
      });

      const newAudioEntry = {
        url: file_url,
        recorded_at: new Date().toISOString(),
        label: isAmending ? `Amendment Recording ${(soapNote?.session_audio_urls?.length || 0) + 1}` : 'Session Recording'
      };

      // Get existing audio URLs array or create from legacy field
      const existingUrls = soapNote?.session_audio_urls || [];

      // If there's a legacy single URL and no array yet, migrate it
      if (existingUrls.length === 0 && soapNote?.session_audio_url) {
        existingUrls.push({
          url: soapNote.session_audio_url,
          recorded_at: soapNote.note_date || new Date().toISOString(),
          label: 'Original Session Recording'
        });
      }

      const updatedUrls = [...existingUrls, newAudioEntry];

      // Update local state
      setSoapNote(prev => ({
        ...prev,
        session_audio_urls: updatedUrls,
        session_audio_url: file_url // Keep legacy field updated too
      }));

      // Save to database immediately if note exists
      if (soapNote?.id) {
        await SOAPNote.update(soapNote.id, { 
          session_audio_urls: updatedUrls,
          session_audio_url: file_url
        });
      }

      toast.success('Recording saved!');
    } catch (error) {
      console.error('Error saving recording:', error);
      toast.error('Failed to save recording.');
    } finally {
      setIsSavingAudio(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const transcribeAudio = async (audioUrl) => {
    if (!audioUrl || audioUrl === lastTranscribedUrl) return;
    setIsTranscribing(true);
    setLastTranscribedUrl(audioUrl);
    setShowTranscriptPanel(true);
    try {
      const result = await base44.functions.invoke('transcribeSession', { action: 'transcribe', audio_url: audioUrl });
      // functions.invoke returns the raw response envelope; the body is under
      // .data (matching the response.data || response convention used elsewhere).
      const payload = result?.data ?? result;
      if (payload?.transcript) {
        setSessionTranscript(prev => prev ? prev + '\n\n---\n\n' + payload.transcript : payload.transcript);
        toast.success('Transcription complete!');
      } else {
        setLastTranscribedUrl(null); // allow retry
        toast.error('Transcription returned empty result.');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      setLastTranscribedUrl(null); // allow retry
      toast.error('Transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const dissectToSOAP = async () => {
    if (!sessionTranscript) return;
    setIsDissecting(true);
    try {
      const result = await base44.functions.invoke('transcribeSession', { action: 'dissect_to_soap', transcript: sessionTranscript });
      const payload = result?.data ?? result;
      if (payload?.success) {
        setSoapNote(prev => ({
          ...prev,
          subjective: payload.subjective ? (prev.subjective ? prev.subjective + '\n\n' + payload.subjective : payload.subjective) : prev.subjective,
          objective: payload.objective ? (prev.objective ? prev.objective + '\n\n' + payload.objective : payload.objective) : prev.objective,
          assessment: payload.assessment ? (prev.assessment ? prev.assessment + '\n\n' + payload.assessment : payload.assessment) : prev.assessment,
          plan: payload.plan ? (prev.plan ? prev.plan + '\n\n' + payload.plan : payload.plan) : prev.plan,
        }));
        setShowTranscriptPanel(false);
        toast.success('SOAP note populated from transcript!');
      } else {
        toast.error('Failed to dissect transcript.');
      }
    } catch (error) {
      console.error('Dissect error:', error);
      toast.error('Dissection failed. Please try again.');
    } finally {
      setIsDissecting(false);
    }
  };

  const handleAttachmentUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingAttachment(true);
    try {
      // Upload file to storage
      const { file_url } = await uploadTenantFile({
        file,
        org_id: client.org_id,
        purpose: 'clinical-attachment',
        subject_date_of_birth: client.date_of_birth || undefined,
      });

      // Create document record in ClientDocument entity
      const documentData = {
        org_id: client.org_id,
        client_id: client.id,
        document_type: 'report',
        file_url: file_url,
        file_name: file.name,
        notes: `Attached to SOAP note - ${moment(soapNote.note_date).format('LL')}`
      };

      const savedDocument = await base44.entities.ClientDocument.create(documentData);

      // Add to SOAP note's plan_attachments
      const newAttachment = {
        document_id: savedDocument.id,
        file_url: file_url,
        file_name: file.name,
        uploaded_at: new Date().toISOString()
      };

      const updatedAttachments = [...(soapNote.plan_attachments || []), newAttachment];
      
      setSoapNote(prev => ({
        ...prev,
        plan_attachments: updatedAttachments
      }));

      // Save to database immediately if note exists
      if (soapNote?.id) {
        await base44.entities.SOAPNote.update(soapNote.id, { 
          plan_attachments: updatedAttachments
        });
      }

      toast.success(`${file.name} attached to plan`);
    } catch (error) {
      console.error('Error uploading attachment:', error);
      toast.error('Failed to upload attachment');
    } finally {
      setIsUploadingAttachment(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = async (index) => {
    try {
      const updatedAttachments = soapNote.plan_attachments.filter((_, i) => i !== index);
      
      setSoapNote(prev => ({
        ...prev,
        plan_attachments: updatedAttachments
      }));

      // Save to database if note exists
      if (soapNote?.id) {
        await base44.entities.SOAPNote.update(soapNote.id, { 
          plan_attachments: updatedAttachments
        });
      }

      toast.success('Attachment removed');
    } catch (error) {
      console.error('Error removing attachment:', error);
      toast.error('Failed to remove attachment');
    }
  };



  const handleSave = useCallback(async (actionType = 'draft') => { // actionType: 'draft', 'publish', 'amend'
    if (!currentUser && (actionType === 'publish' || actionType === 'amend')) {
      toast.error("Could not verify user. Please try again.");
      return;
    }
    setIsSaving(true);
    try {
      const combinedDateTime = new Date(`${sessionDetails.date}T${sessionDetails.time}`).toISOString();

      let historyEntry = null;
      let newStatus = soapNote.status; // Default to current status
      let publishedDate = soapNote.published_date;
      let publishedBy = soapNote.published_by;

      if (actionType === 'draft') {
        newStatus = 'draft';
      } else if (actionType === 'publish') {
        newStatus = 'published';
        publishedDate = new Date().toISOString();
        publishedBy = currentUser.email;
        historyEntry = {
          timestamp: new Date().toISOString(),
          user_email: currentUser.email,
          action: "published"
        };
      } else if (actionType === 'amend') {
        newStatus = 'published'; // Remains published
        // Keep existing publishedDate and publishedBy
        historyEntry = {
          timestamp: new Date().toISOString(),
          user_email: currentUser.email,
          action: "amended"
        };
      }

      // Determine the location name to save
      const finalLocationName = sessionDetails.location_id === 'other' 
        ? sessionDetails.custom_location 
        : sessionDetails.location_name;

      const dataToSave = {
        org_id: client.org_id,
        client_id: soapNote.client_id,
        appointment_id: appointment.isVirtual ? undefined : (soapNote.appointment_id || appointment.id || undefined),
        note_date: combinedDateTime,
        location_id: sessionDetails.location_id === 'other' ? null : sessionDetails.location_id,
        session_location: finalLocationName,
        note_name: noteName || '',
        subjective: soapNote.subjective || '',
        compliance: soapNote.compliance || {},
        objective: soapNote.objective || '',
        assessment: soapNote.assessment || '',
        plan: soapNote.plan || '',
        plan_attachments: soapNote.plan_attachments || [],
        other: soapNote.other || '',
        full_transcript: soapNote.full_transcript || '',
        session_audio_url: soapNote.session_audio_url || '',
        status: newStatus,
        published_date: publishedDate,
        published_by: publishedBy,
        history: [...(soapNote.history || []), ...(historyEntry ? [historyEntry] : [])]
      };

      // Remove appointment_id entirely if undefined
      if (dataToSave.appointment_id === undefined) {
        delete dataToSave.appointment_id;
      }

      let updatedNote;
      if (soapNote.id) {
        updatedNote = await SOAPNote.update(soapNote.id, dataToSave);
      } else {
        updatedNote = await SOAPNote.create(dataToSave);
      }

      setSoapNote(updatedNote);
      setOriginalSoapNote(JSON.parse(JSON.stringify(updatedNote)));

      // Update session details state to match what was saved
      const savedDate = new Date(updatedNote.note_date);
      setSessionDetails({
        date: format(savedDate, 'yyyy-MM-dd'),
        time: format(savedDate, 'HH:mm'),
        location_id: updatedNote.location_id || '',
        location_name: updatedNote.session_location || ''
      });

      if (actionType === 'draft') {
        toast.success("Draft saved successfully.");
      } else if (actionType === 'publish') {
        toast.success("Note published and locked.");
        setShowReminders(true); // Trigger reminders after publishing
      } else if (actionType === 'amend') {
        setIsAmending(false);
        toast.success("Changes saved and note re-locked.");
      }
    } catch (error) {
      console.error(`Error saving note (${actionType}):`, error);
      toast.error(`Failed to save note: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  }, [appointment, client, currentUser, sessionDetails, soapNote, originalSoapNote]);


  const handleAmendClick = () => {
    setIsAmending(true);
    toast.info("Note unlocked for amendment. Remember to save changes.");
  };

  const handleCancelAmendment = () => {
    setSoapNote(originalSoapNote);
    // Reset session details to original values
    if (originalSoapNote && originalSoapNote.note_date) {
      const noteDate = new Date(originalSoapNote.note_date);
      setSessionDetails({
        date: format(noteDate, 'yyyy-MM-dd'),
        time: format(noteDate, 'HH:mm'),
        location_id: originalSoapNote.location_id || '',
        location_name: originalSoapNote.session_location || ''
      });
    }
    setIsAmending(false);
    toast.warning("Amendment cancelled. No changes were saved.");
  };

  const handlePrint = () => {
    if (!printRef.current) {
        toast.error("Report content is not ready for printing.");
        return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
        printWindow.document.write('<html><head><title>SOAP Note</title>');
        printWindow.document.write('<style>@media print { body { -webkit-print-color-adjust: exact; } }</style>');
        printWindow.document.write('</head><body>');
        // Pass location_name and location_id from sessionDetails to the PrintableSOAPNote component
        printWindow.document.write(printRef.current.innerHTML);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
    } else {
        toast.error("Could not open print window. Please disable your pop-up blocker.");
    }
  };

  const handleDeleteSOAPNote = async () => {
    if (!soapNote?.id) {
      toast.error("Cannot delete an unsaved SOAP note.");
      setShowDeleteDialog(false);
      return;
    }

    try {
      await SOAPNote.delete(soapNote.id);
      toast.success("SOAP note deleted successfully!");
      setShowDeleteDialog(false);
      onClose(); // Close the modal after deletion
    } catch (error) {
      console.error("Error deleting SOAP note:", error);
      toast.error("Failed to delete SOAP note.");
      setShowDeleteDialog(false);
    }
  };

  const handleCloseReminders = () => {
    setShowReminders(false);
    onClose(); // Close SOAP modal after reminders
  };


  const handleCopySOAP = async () => {
    try {
      const lines = [];
      const apptDate = appointment?.start_time
        ? new Date(appointment.start_time).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });

      lines.push(`SOAP NOTE — ${client?.full_name || 'Client'} — ${apptDate}`);
      if (currentUser?.full_name) lines.push(`Clinician: ${currentUser.full_name}`);
      lines.push('');
      lines.push('SUBJECTIVE');
      lines.push('─'.repeat(40));
      lines.push(soapNote?.subjective || '');
      lines.push('');
      lines.push('OBJECTIVE');
      lines.push('─'.repeat(40));
      lines.push(soapNote?.objective || '');
      if (assessments && assessments.length > 0) {
        lines.push('');
        lines.push('Assessment Results:');
        assessments.forEach(ca => {
          const aName = ca.name || 'Assessment';
          const soapText = ca.additional_data?.soap_text || ca.soap_text || '';
          const resultVal = ca.result_value !== undefined && ca.result_value !== null ? ca.result_value : '';
          const unit = ca.unit_of_measure ? ` ${ca.unit_of_measure}` : '';
          if (soapText) {
            lines.push(`• ${aName}: ${soapText}`);
          } else if (resultVal !== '') {
            lines.push(`• ${aName}: ${resultVal}${unit}`);
          } else {
            lines.push(`• ${aName}`);
          }
        });
      }
      lines.push('');
      lines.push('ASSESSMENT');
      lines.push('─'.repeat(40));
      lines.push(soapNote?.assessment || '');
      lines.push('');
      lines.push('PLAN');
      lines.push('─'.repeat(40));
      lines.push(soapNote?.plan || '');
      if (soapNote?.goals) {
        lines.push('');
        lines.push('GOALS');
        lines.push('─'.repeat(40));
        lines.push(soapNote.goals);
      }
      if (soapNote?.other) {
        lines.push('');
        lines.push('OTHER NOTES');
        lines.push('─'.repeat(40));
        lines.push(soapNote.other);
      }

      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedSOAP(true);
      toast.success('SOAP note copied to clipboard!');
      setTimeout(() => setCopiedSOAP(false), 2500);
    } catch (err) {
      toast.error('Failed to copy. Please try again.');
      console.error(err);
    }
  };
  const isPublished = soapNote?.status === 'published';
  const isLocked = isPublished && !isAmending;

  if (isLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="ml-4 text-lg text-slate-600">Loading SOAP Note...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }



  return (
    <>
      {runningAssessment && (
        <AssessmentTestRunnerRouter
          client={client}
          assessment={runningAssessment.assessment}
          clientAssessment={runningAssessment.clientAssessment}
          onClose={() => setRunningAssessment(null)}
          onComplete={async () => {
            // Mark as completed if still pending (safety net in case runner didn't update status)
            if (runningAssessment?.clientAssessment?.id && runningAssessment?.clientAssessment?.status === 'pending') {
              try {
                await base44.entities.ClientAssessment.update(runningAssessment.clientAssessment.id, { status: 'completed' });
              } catch (e) { /* already completed by runner */ }
            }
            // Remove from pending list immediately
            if (runningAssessment?.clientAssessment?.id) {
              setPendingAssessments(prev => prev.filter(p => p.id !== runningAssessment.clientAssessment.id));
            }
            setRunningAssessment(null);
            loadSOAPNoteAndAssessments();
          }}
          isStandaloneMode={false}
        />
      )}

      <Dialog open={!runningAssessment} onOpenChange={onClose}>
        <div className="hidden">
            <PrintableSOAPNote
                ref={printRef}
                // Pass location_name and location_id from sessionDetails for printing
                soapNote={{...soapNote, session_location: sessionDetails.location_name, location_id: sessionDetails.location_id}}
                client={client}
                appointment={appointment}
                clinician={currentUser}
            />
        </div>
        <DialogContent className="max-w-6xl h-[95vh] flex flex-col overflow-hidden">
          <div className="flex flex-1 min-h-0 gap-4">
            {/* Main SOAP Note Content */}
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between pr-6 pb-4">
            <div className="flex items-center gap-4">
              {onNavigate && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onNavigate('prev')}
                  disabled={!hasPrev}
                  className="text-slate-500 hover:text-slate-700 disabled:opacity-30"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              )}

              <div>
                <DialogTitle className="text-xl font-bold">
                  {noteName || `SOAP Note - ${client.full_name}`}
                </DialogTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {moment(soapNote?.note_date || appointment.start_time || appointment.start).format('dddd, MMMM Do YYYY [at] h:mm A')}
                  {sessionInfo && sessionInfo.total > 1 && (
                    <span className="ml-2">
                      (Session {sessionInfo.current} of {sessionInfo.total})
                    </span>
                  )}
                </p>
              </div>

              {onNavigate && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onNavigate('next')}
                  disabled={!hasNext}
                  className="text-slate-500 hover:text-slate-700 disabled:opacity-30"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              )}
            </div>

            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogHeader>

          {isPublished && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-md text-sm text-yellow-800 flex items-center gap-3 mb-4">
              <Lock className="w-5 h-5 flex-shrink-0" />
              <div>
                <span className="font-semibold">This note was published on {moment(soapNote.published_date).format('lll')} by {soapNote.published_by}.</span>
                {isAmending && <span className="block">You are currently amending this note.</span>}
              </div>
            </div>
          )}

          {/* Session Details Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
            {!isEditingSessionDetails ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-slate-600" />
                    <span className="font-medium">{sessionDetails.date ? format(new Date(sessionDetails.date), 'PPP') : 'No date set'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-slate-600" />
                    <span className="font-medium">{sessionDetails.time || 'No time set'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-slate-600" />
                    <span className="font-medium">
                      {sessionDetails.location_id === 'other' 
                        ? (sessionDetails.custom_location || 'Other') 
                        : (sessionDetails.location_name || 'No location set')}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingSessionDetails(true)}
                  disabled={isLocked}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Session Details
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="session-date" className="text-sm font-medium">Session Date</Label>
                    <Input
                      id="session-date"
                      type="date"
                      value={sessionDetails.date}
                      onChange={(e) => handleSessionDetailChange('date', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="session-time" className="text-sm font-medium">Session Time</Label>
                    <Input
                      id="session-time"
                      type="time"
                      value={sessionDetails.time}
                      onChange={(e) => handleSessionDetailChange('time', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="session-location-select" className="text-sm font-medium">Location</Label>
                  <Select
                    value={sessionDetails.location_id}
                    onValueChange={(value) => handleSessionDetailChange('location_id', value)}
                    disabled={isLocked}
                  >
                    <SelectTrigger id="session-location-select" className="mt-1">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.length > 0 ? (
                        locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.clinic_name} {location.is_main && '(Main)'}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value={null} disabled>No locations available</SelectItem>
                      )}
                      <SelectItem value="other">Other (specify below)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {sessionDetails.location_id === 'other' && (
                  <div>
                    <Label htmlFor="custom-location" className="text-sm font-medium">Specify Location</Label>
                    <Input
                      id="custom-location"
                      value={sessionDetails.custom_location}
                      onChange={(e) => handleSessionDetailChange('custom_location', e.target.value)}
                      placeholder="Enter session location"
                      className="mt-1"
                      disabled={isLocked}
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="note-name" className="text-sm font-medium">Note Name (Optional)</Label>
                  <Input
                    id="note-name"
                    value={noteName}
                    onChange={(e) => setNoteName(e.target.value)}
                    placeholder="e.g., PCP Session 1, ECR Final Review"
                    className="mt-1"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (originalSoapNote) {
                        const noteDate = new Date(originalSoapNote.note_date);
                        setSessionDetails({
                          date: format(noteDate, 'yyyy-MM-dd'),
                          time: format(noteDate, 'HH:mm'),
                          location_id: originalSoapNote.location_id || '',
                          location_name: originalSoapNote.session_location || ''
                        });
                      } else if (soapNote) { // Fallback if originalSoapNote is not yet set (e.g. new note being edited for the first time)
                        const noteDate = new Date(soapNote.note_date);
                        setSessionDetails({
                          date: format(noteDate, 'yyyy-MM-dd'),
                          time: format(noteDate, 'HH:mm'),
                          location_id: soapNote.location_id || '',
                          location_name: soapNote.session_location || ''
                        });
                      }
                      setIsEditingSessionDetails(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveSessionDetails}
                  >
                    Save Details
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Recording Section */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border-2 border-purple-200 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`} />
                <div>
                  <h4 className="font-semibold text-slate-900">Session Audio Recording</h4>
                  <p className="text-xs text-slate-600">
                    {isRecording 
                      ? `Recording... ${formatRecordingTime(recordingTime)}`
                      : isSavingAudio
                        ? 'Saving recording...'
                        : 'Record your session for documentation'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                {!isRecording ? (
                  !isLocked && (
                    <Button
                      onClick={() => setShowRecordingConsent(true)}
                      disabled={isSavingAudio || isTranscribing}
                      className="bg-purple-600 hover:bg-purple-700"
                      size="sm"
                    >
                      <Mic className="w-4 h-4 mr-2" />
                      {isAmending ? 'Add Recording' : 'Record'}
                    </Button>
                  )
                ) : (
                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    size="sm"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                )}
              </div>
            </div>

            {/* Display all audio recordings */}
            {(soapNote?.session_audio_urls?.length > 0 || soapNote?.session_audio_url) && (
              <div className="mt-3 space-y-2">
                {soapNote?.session_audio_urls?.length > 0 ? (
                  soapNote.session_audio_urls.map((audio, index) => (
                    <div key={index} className="bg-white rounded-lg p-2 border border-purple-100">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-slate-700">
                          {audio.label || `Recording ${index + 1}`}
                          {audio.recorded_at && (
                            <span className="text-slate-400 ml-2">
                              {moment(audio.recorded_at).format('MMM D, h:mm A')}
                            </span>
                          )}
                        </p>
                        {transcriptionEnabled && !isLocked && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => transcribeAudio(audio.url)}
                            disabled={isTranscribing || isRecording || isSavingAudio}
                          >
                            {isTranscribing ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <FileText className="w-3 h-3 mr-1" />
                            )}
                            Transcribe
                          </Button>
                        )}
                      </div>
                      <SecureFileAudio src={audio.url} orgId={client.org_id} controls className="w-full h-8" />
                    </div>
                  ))
                ) : soapNote?.session_audio_url && (
                  <div className="bg-white rounded-lg p-2 border border-purple-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-slate-700">Session Recording</p>
                      {transcriptionEnabled && !isLocked && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => transcribeAudio(soapNote.session_audio_url)}
                          disabled={isTranscribing || isRecording || isSavingAudio}
                        >
                          {isTranscribing ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <FileText className="w-3 h-3 mr-1" />
                          )}
                          Transcribe
                        </Button>
                      )}
                    </div>
                    <SecureFileAudio src={soapNote.session_audio_url} orgId={client.org_id} controls className="w-full h-8" />
                  </div>
                )}
              </div>
            )}

            {/* Transcript panel: populated by transcribeAudio, consumed by dissectToSOAP */}
            {transcriptionEnabled && showTranscriptPanel && (
              <div className="mt-3 bg-white rounded-lg p-3 border border-purple-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-slate-700">Session Transcript</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setShowTranscriptPanel(false)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                {isTranscribing && (
                  <p className="text-xs text-slate-500 flex items-center gap-2 mb-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Transcribing audio...
                  </p>
                )}
                <Textarea
                  value={sessionTranscript}
                  onChange={(e) => setSessionTranscript(e.target.value)}
                  rows={6}
                  placeholder="Transcript will appear here once transcription completes."
                  className="text-sm"
                />
                {!isLocked && (
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      onClick={dissectToSOAP}
                      disabled={isDissecting || isTranscribing || !sessionTranscript}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {isDissecting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Dissect to SOAP
                    </Button>
                  </div>
                )}
                <AIDisclosureNote className="mt-2" />
              </div>
            )}

          </div>

          <div className="space-y-4 pr-2 py-4">
            <div>
              <Label htmlFor="subjective" className="text-lg font-semibold">Subjective</Label>
              <Textarea
                id="subjective"
                value={soapNote?.subjective || ''}
                onChange={(e) => handleInputChange("subjective", e.target.value)}
                disabled={isLocked}
                rows={4}
                placeholder="The client's own reports: symptoms, history, concerns, goals, and anything they tell you about their condition."
                className={`mt-2 ${isLocked ? 'bg-slate-50' : ''} placeholder:text-slate-400`}
              />
            </div>

            <ComplianceSection
              value={soapNote?.compliance || {}}
              onChange={(v) => handleInputChange("compliance", v)}
              disabled={isLocked}
            />

            <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="objective" className="text-lg font-semibold">Objective</Label>
                  <div className="flex gap-2">
                    {!isLocked && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowVitalsEntry(true)}
                      >
                        <Activity className="w-4 h-4 mr-2" />
                        Add Vitals
                      </Button>
                    )}
                    {assessments.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const regenerated = await generateObjectiveFromAssessments(assessments, soapNote.note_date);
                          handleInputChange("objective", regenerated);
                          toast.success("Objective section refreshed with full assessment details");
                        }}
                        disabled={isLocked}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh Assessments
                      </Button>
                    )}
                  </div>
                </div>
              <Textarea
                id="objective"
                value={soapNote?.objective || ''}
                onChange={(e) => handleInputChange("objective", e.target.value)}
                disabled={isLocked}
                rows={6}
                placeholder="What you observe or measure: assessments, test results, vital signs, ROM, strength, gait, and factual clinical findings."
                className={`mt-2 ${isLocked ? 'bg-slate-50' : ''} placeholder:text-slate-400`}
              />
              </div>

              <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="assessment" className="text-lg font-semibold">Assessment</Label>
                    <div className="flex gap-2">
                      {!isLocked && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            setIsGeneratingAssessment(true);
                            try {
                              // Fetch client conditions for context
                              const conditions = await ClientCondition.filter({ client_id: client.id, is_active: true });
                              const conditionsList = conditions.map(c => `${c.condition_name}${c.medication ? ` (on ${c.medication})` : ''}`).join(', ');

                              const result = await base44.integrations.Core.InvokeLLM({
                                prompt: `You are a clinical exercise physiologist writing a SOAP note assessment section. Based on the following information, write a professional clinical assessment.

                      CLIENT BACKGROUND:
                      - Name: ${client.full_name}
                      - Referral Reason: ${client.referral_reason || 'Not specified'}
                      - Medical Conditions: ${conditionsList || 'None documented'}
                      - Client Goals: ${client.client_goals || 'Not specified'}

                      Subjective: ${soapNote?.subjective || 'Not provided'}

                      Objective: ${soapNote?.objective || 'Not provided'}

                      Write a concise clinical assessment that interprets the subjective and objective data in context of the client's medical history and referral reason. Identify functional limitations, contributing factors, and current progress. Keep it professional and clinical. 2-4 sentences max.`,
                                response_json_schema: {
                                  type: "object",
                                  properties: {
                                    assessment: { type: "string" }
                                  }
                                }
                              });
                              handleInputChange("assessment", result.assessment);
                              toast.success("AI assessment generated");
                            } catch (error) {
                              console.error("Failed to generate assessment:", error);
                              toast.error("Failed to generate AI assessment");
                            } finally {
                              setIsGeneratingAssessment(false);
                            }
                          }}
                          disabled={isGeneratingAssessment}
                        >
                          {isGeneratingAssessment ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4 mr-2" />
                          )}
                          AI Help
                        </Button>
                      )}
                      {!isLocked && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPendingAssessments(true)}
                        >
                          <ClipboardList className="w-4 h-4 mr-2" />
                          Run Assessments
                        </Button>
                      )}
                    </div>
                  </div>
                  <Textarea
                id="assessment"
                value={soapNote?.assessment || ''}
                onChange={(e) => handleInputChange("assessment", e.target.value)}
                disabled={isLocked}
                rows={4}
                placeholder="Your professional interpretation of the subjective and objective data—what it means, the likely condition, contributing factors, and progress."
                className={`mt-2 ${isLocked ? 'bg-slate-50' : ''} placeholder:text-slate-400`}
                />
                <AIDisclosureNote className="mt-1" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="plan" className="text-lg font-semibold">Plan</Label>
                    <div className="flex gap-2">
                      {!isLocked && (
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleAttachmentUpload}
                            className="hidden"
                            accept=".pdf,.docx,.jpg,.jpeg,.png"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingAttachment}
                          >
                            {isUploadingAttachment ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Paperclip className="w-4 h-4 mr-2" />
                            )}
                            Attach Document
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              setIsGeneratingPlan(true);
                              try {
                                // Fetch client conditions for context
                                const conditions = await ClientCondition.filter({ client_id: client.id, is_active: true });
                                const conditionsList = conditions.map(c => `${c.condition_name}${c.medication ? ` (on ${c.medication})` : ''}`).join(', ');

                                const result = await base44.integrations.Core.InvokeLLM({
                                  prompt: `You are a clinical exercise physiologist writing a SOAP note plan section. Based on the following information, write a professional treatment plan.

                        CLIENT BACKGROUND:
                        - Name: ${client.full_name}
                        - Referral Reason: ${client.referral_reason || 'Not specified'}
                        - Medical Conditions: ${conditionsList || 'None documented'}
                        - Client Goals: ${client.client_goals || 'Not specified'}

                        Subjective: ${soapNote?.subjective || 'Not provided'}

                        Objective: ${soapNote?.objective || 'Not provided'}

                        Assessment: ${soapNote?.assessment || 'Not provided'}

                        Write a concise clinical plan that outlines the next steps considering the client's conditions and goals: treatment plan, exercises, education, referrals if needed, goals for the next session, and follow-up actions. Keep it professional and actionable. Use bullet points or short sentences.`,
                                  response_json_schema: {
                                    type: "object",
                                    properties: {
                                      plan: { type: "string" }
                                    }
                                  }
                                });
                                handleInputChange("plan", result.plan);
                                toast.success("AI plan generated");
                              } catch (error) {
                                console.error("Failed to generate plan:", error);
                                toast.error("Failed to generate AI plan");
                              } finally {
                                setIsGeneratingPlan(false);
                              }
                            }}
                            disabled={isGeneratingPlan}
                          >
                            {isGeneratingPlan ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4 mr-2" />
                            )}
                            AI Help
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <Textarea
                id="plan"
                value={soapNote?.plan || ''}
                onChange={(e) => handleInputChange("plan", e.target.value)}
                disabled={isLocked}
                rows={4}
                placeholder="What will happen next: treatment plan, exercises, education, referrals, goals for the next session, and any follow-up actions."
                className={`mt-2 ${isLocked ? 'bg-slate-50' : ''} placeholder:text-slate-400`}
                />
                <AIDisclosureNote className="mt-1" />

                {/* Plan Attachments */}
                {soapNote?.plan_attachments && soapNote.plan_attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-slate-700">Attachments:</p>
                    {soapNote.plan_attachments.map((attachment, index) => (
                      <div key={index} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <SecureFileLink
                          href={attachment.file_url}
                          orgId={client.org_id}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 flex-1"
                        >
                          <FileText className="w-4 h-4" />
                          <span className="text-sm font-medium">{attachment.file_name}</span>
                          <span className="text-xs text-slate-500">
                            ({moment(attachment.uploaded_at).format('MMM D, YYYY')})
                          </span>
                        </SecureFileLink>
                        {!isLocked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAttachment(index)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                </div>
            
            <div>
              <Label htmlFor="other" className="text-lg font-semibold">Other</Label>
              <Textarea
                id="other"
                value={soapNote?.other || ''}
                onChange={(e) => handleInputChange("other", e.target.value)}
                disabled={isLocked}
                rows={4}
                placeholder="Any other important information from the consult: communications, billing notes, equipment needs, or administrative details."
                className={`mt-2 ${isLocked ? 'bg-slate-50' : ''} placeholder:text-slate-400`}
              />
            </div>

            {soapNote?.history && soapNote.history.length > 0 && (
                                <Accordion type="single" collapsible className="w-full pt-4">
                                  <AccordionItem value="item-1">
                                    <AccordionTrigger>
                                      <div className="flex items-center gap-2 text-lg font-semibold text-slate-700">
                                        <History className="w-5 h-5" /> Note History
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      <div className="flex justify-end mb-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const printWindow = window.open('', '_blank', 'width=800,height=600');
                                            if (printWindow) {
                                              const historyHtml = soapNote.history.slice().reverse().map(entry => `
                                                <div style="margin-bottom: 16px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px;">
                                                  <p style="font-weight: 600; margin: 0 0 4px 0;">
                                                    <span style="text-transform: capitalize;">${entry.action}</span> by ${entry.user_email}
                                                  </p>
                                                  <p style="color: #64748b; font-size: 12px; margin: 0;">
                                                    ${moment(entry.timestamp).format('LLL')}
                                                  </p>
                                                </div>
                                              `).join('');

                                              printWindow.document.write(`
                                                <html>
                                                  <head><title>SOAP Note History - ${client.full_name}</title></head>
                                                  <body style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
                                                    <h1 style="font-size: 24px; margin-bottom: 8px;">SOAP Note History</h1>
                                                    <p style="color: #64748b; margin-bottom: 24px;">Client: ${client.full_name} | Note Date: ${moment(soapNote.note_date).format('LL')}</p>
                                                    ${historyHtml}
                                                  </body>
                                                </html>
                                              `);
                                              printWindow.document.close();
                                              printWindow.focus();
                                              setTimeout(() => {
                                                printWindow.print();
                                                printWindow.close();
                                              }, 250);
                                            }
                                          }}
                                        >
                                          <Printer className="w-4 h-4 mr-2" />
                                          Print History
                                        </Button>
                                      </div>
                                      <div className="space-y-3 max-h-48 overflow-y-auto pr-2 mt-2">
                                        {soapNote.history.slice().reverse().map((entry, index) => (
                                          <div key={index} className="flex items-start gap-3 text-sm p-2 bg-slate-50 rounded-lg border">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                               <div className="text-blue-600 font-bold">{entry.user_email ? entry.user_email.charAt(0).toUpperCase() : '?'}</div>
                                            </div>
                                            <div>
                                              <p className="font-medium text-slate-800">
                                                <span className="capitalize font-semibold">{entry.action}</span> by {entry.user_email}
                                              </p>
                                              <p className="text-xs text-slate-500">
                                                {moment(entry.timestamp).format('LLL')}
                                              </p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                </Accordion>
                              )}
          </div>

          <DialogFooter className="pt-4 border-t flex-shrink-0 mt-auto bg-white">
            <div className="flex justify-between w-full items-center gap-2">
              <div className="flex gap-2">
                  <Button variant="outline" onClick={handlePrint} disabled={!isPublished}>
                      <Printer className="w-4 h-4 mr-2" />
                      Print
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCopySOAP}
                    className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    {copiedSOAP ? (
                      <><Check className="w-4 h-4 text-green-600" /> Copied!</>
                    ) : (
                      <><Copy className="w-4 h-4" /> Copy SOAP Note</>
                    )}
                  </Button>
                  {soapNote?.id && (
                    <Button 
                      variant="outline" 
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={isAmending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Note
                    </Button>
                  )}
                  {isPublished && !isAmending && (
                      <Button variant="outline" onClick={handleAmendClick}>
                          <Edit className="w-4 h-4 mr-2" />
                          Amend Note
                      </Button>
                  )}
                  {isAmending && (
                      <>
                          <Button variant="destructive" onClick={handleCancelAmendment}>
                              Cancel Amendment
                          </Button>
                          <Button onClick={() => handleSave('amend')} disabled={isSaving}>
                              <Save className="w-4 h-4 mr-2" />
                              {isSaving ? 'Saving...' : 'Save Changes'}
                          </Button>
                      </>
                  )}
              </div>

              <div className="flex gap-2">
                {!isPublished && (
                  <>
                    <Button variant="outline" onClick={() => handleSave('draft')} disabled={isSaving}>
                        <Save className="w-4 h-4 mr-2" />
                        Save Draft
                    </Button>
                    <Button onClick={() => handleSave('publish')} disabled={isSaving}>
                        <Lock className="w-4 h-4 mr-2" />
                        {isSaving ? 'Publishing...' : 'Publish'}
                    </Button>
                  </>
                )}
                 <Button variant="secondary" onClick={onClose}>Close</Button>
              </div>
            </div>
          </DialogFooter>
          </div>

            {/* Right Sidebar - Assessments */}
            <div className="w-80 border-l border-slate-200 pl-4 flex-shrink-0 overflow-y-auto">
              <div className="space-y-4 sticky top-0">
                {/* Pending Assessments */}
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    Pending Assessments
                    {pendingAssessments.length > 0 && (
                      <Badge className="bg-orange-100 text-orange-800 border-0">{pendingAssessments.length}</Badge>
                    )}
                  </h3>
                  {pendingAssessments.length > 0 ? (
                    <div className="space-y-2">
                      {pendingAssessments.map((pend) => (
                        <button
                          key={pend.id}
                          onClick={async () => {
                            if (!isLocked) {
                              try {
                                const assessmentDetails = await Assessment.filter({ id: pend.assessment_id });
                                if (assessmentDetails.length > 0) {
                                  setRunningAssessment({
                                    clientAssessment: pend,
                                    assessment: assessmentDetails[0]
                                  });
                                } else {
                                  toast.error('Assessment not found');
                                }
                              } catch (error) {
                                console.error('Error loading assessment:', error);
                                toast.error('Failed to load assessment');
                              }
                            }
                          }}
                          className="w-full p-3 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg text-left transition-colors"
                          disabled={isLocked}
                        >
                          <p className="font-medium text-sm text-slate-900">{pend.name}</p>
                          <p className="text-xs text-slate-600 capitalize">{pend.category?.replace(/_/g, ' ')}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No pending assessments</p>
                  )}
                </div>

                {/* Recommended Assessments */}
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Recommended
                  </h3>
                  {recommendedAssessments.length > 0 ? (
                    <div className="space-y-2">
                      {recommendedAssessments.map((assessment) => (
                        <button
                          key={assessment.id}
                          onClick={async () => {
                            if (!isLocked) {
                              try {
                                const newCA = await ClientAssessment.create({
                                  org_id: client.org_id,
                                  client_id: client.id,
                                  assessment_id: assessment.id,
                                  appointment_id: appointment.id,
                                  status: 'pending',
                                  assessment_date: todayLocal()
                                });
                                
                                setRunningAssessment({
                                  clientAssessment: newCA,
                                  assessment: assessment
                                });
                              } catch (error) {
                                console.error('Error creating assessment:', error);
                                toast.error('Failed to start assessment');
                              }
                            }
                          }}
                          className="w-full p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-left transition-colors"
                          disabled={isLocked}
                        >
                          <p className="font-medium text-sm text-slate-900">{assessment.name}</p>
                          <p className="text-xs text-slate-600">For: {assessment.relatedCondition}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No recommendations</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

              {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SOAP Note</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-semibold text-red-800">Warning: This action cannot be undone!</p>
                  <p className="text-red-700">
                    You are about to permanently delete this SOAP note for {client.full_name}.
                  </p>
                  {isPublished && (
                    <p className="text-red-700 font-semibold">
                      This is a published note. Deleting it will remove all clinical documentation for this session.
                    </p>
                  )}
                </div>
              </div>
              <p className="text-sm">
                Are you sure you want to delete this SOAP note from {moment(soapNote?.note_date).format('LL')}?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSOAPNote}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete SOAP Note
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recording consent — captured per session, immediately before capture
          starts (see handleConfirmRecording). Distinct from, and in addition
          to, the client's own consent obtained by the treating practice. */}
      <AlertDialog open={showRecordingConsent} onOpenChange={setShowRecordingConsent}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Session recording consent</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Before recording this session, confirm:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>You have obtained the client's (and any other participant's) consent to record this session, in accordance with your state or territory's recording laws.</li>
                <li>The recording will be uploaded and, if you request transcription, sent to AssessSuite's transcription provider.</li>
                <li>Your own consent to this recording and its processing is being logged for this specific session.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRecording} className="bg-purple-600 hover:bg-purple-700">
              Confirm and start recording
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Show reminders after publishing SOAP note */}
      {showVitalsEntry && (
        <VitalsQuickEntry
          isOpen={showVitalsEntry}
          onClose={() => setShowVitalsEntry(false)}
          existingObjective={soapNote?.objective || ''}
          onInsert={(newObjective) => handleInputChange("objective", newObjective)}
        />
      )}

      {showPendingAssessments && (
        <PendingAssessmentsModal
          isOpen={showPendingAssessments}
          onClose={() => setShowPendingAssessments(false)}
          client={client}
          clientId={client?.id}
          appointmentId={appointment?.id}
          onAssessmentCompleted={loadSOAPNoteAndAssessments}
        />
      )}

      {showReminders && (
        <AppointmentReminderModal
          client={client}
          lastAppointmentDate={appointment.start_time}
          onClose={handleCloseReminders}
          onBookAppointment={(date) => {
            toast.success('Navigate to calendar to book the suggested appointment');
          }}
          onBookAssessment={(date) => {
            toast.success('Navigate to assessments to schedule the recommended assessment');
          }}
        />
      )}
    </>
  );
}
