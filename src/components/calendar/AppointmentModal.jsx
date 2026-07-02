import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, Trash2, FileText, ClipboardList, AlertTriangle, User, Search, RepeatIcon, CalendarDays } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import moment from 'moment';
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
import AppointmentReminderModal from './AppointmentReminderModal';

export default function AppointmentModal({
    appointment,
    clients,
    onClose,
    onSave,
    onDelete,
    onOpenSOAPNote,
    calSettings
}) {
    const {
        register,
        handleSubmit,
        control,
        reset,
        setValue,
        watch,
        formState,
    } = useForm({
        defaultValues: {
            title: '', client_id: '', location_id: '', start_time: '', end_time: '',
            status: 'scheduled', notes: '', appointment_type: '', appointment_colour: ''
        }
    });

    const { errors } = formState;
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteBlockers, setDeleteBlockers] = useState({ soapNotes: 0, assessments: 0 });
    const [isCheckingBlockers, setIsCheckingBlockers] = useState(false);
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [filteredClients, setFilteredClients] = useState([]);
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);
    const [locations, setLocations] = useState([]);
    const [showReminders, setShowReminders] = useState(false);
    const [savedAppointment, setSavedAppointment] = useState(null);
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurringFrequency, setRecurringFrequency] = useState('weekly');
    const [recurringEndType, setRecurringEndType] = useState('count');
    const [recurringCount, setRecurringCount] = useState(8);
    const [recurringEndDate, setRecurringEndDate] = useState('');
    const [isSavingRecurring, setIsSavingRecurring] = useState(false);

    const clientIdValue = watch('client_id');

    useEffect(() => {
        loadLocations();
    }, []);

    const loadLocations = async () => {
        try {
            const userData = await base44.auth.me();
            setLocations(userData.locations || []);
        } catch (error) {
            console.error("Failed to load locations:", error);
        }
    };

    const startTimeValue = watch('start_time');
    useEffect(() => {
        if (!appointment?.id && startTimeValue && calSettings?.default_appt_duration) {
            const end = moment(startTimeValue).add(calSettings.default_appt_duration, 'minutes').format('YYYY-MM-DDTHH:mm');
            setValue('end_time', end);
        }
    }, [startTimeValue]);

    useEffect(() => {
        if (appointment) {
            reset({
                title: appointment.title || '',
                client_id: appointment.client_id || '',
                location_id: appointment.location_id || '',
                start_time: appointment.start_time || appointment.start ? moment(appointment.start_time || appointment.start).format('YYYY-MM-DDTHH:mm') : '',
                end_time: appointment.end_time || appointment.end ? moment(appointment.end_time || appointment.end).format('YYYY-MM-DDTHH:mm') : '',
                status: appointment.status || 'scheduled',
                notes: appointment.notes || '',
                appointment_type: appointment.appointment_type || '',
                appointment_colour: appointment.appointment_colour || ''
            });

            if (appointment.client_id) {
                const client = clients.find(c => c.id === appointment.client_id);
                if (client) {
                    setSelectedClient(client);
                    setClientSearchTerm(client.full_name);
                }
            }
        }
    }, [appointment, reset, clients]);

    useEffect(() => {
        if (clientSearchTerm) {
            const filtered = clients.filter(client =>
                client.full_name.toLowerCase().includes(clientSearchTerm.toLowerCase())
            );
            setFilteredClients(filtered);
        } else {
            setFilteredClients([]);
        }
    }, [clientSearchTerm, clients]);

    const handleClientSelect = (client) => {
        setSelectedClient(client);
        setClientSearchTerm(client.full_name);
        setValue('client_id', client.id, { shouldValidate: true });
        setShowClientDropdown(false);
    };

    const handleClientSearchChange = (e) => {
        const value = e.target.value;
        setClientSearchTerm(value);
        setShowClientDropdown(true);
        if (!value) {
            setSelectedClient(null);
            setValue('client_id', '');
        }
    };

    const checkDeleteBlockers = async () => {
        if (!appointment?.id) return { soapNotes: 0, assessments: 0 };

        setIsCheckingBlockers(true);
        try {
            const { SOAPNote } = await import('@/entities/SOAPNote');
            const { ClientAssessment } = await import('@/entities/ClientAssessment');

            const [soapNotes, assessments] = await Promise.all([
                SOAPNote.filter({ appointment_id: appointment.id }),
                ClientAssessment.filter({ appointment_id: appointment.id })
            ]);

            const blockers = {
                soapNotes: soapNotes.length,
                assessments: assessments.length
            };

            setDeleteBlockers(blockers);
            return blockers;
        } catch (error) {
            console.error("Failed to check delete blockers:", error);
            return { soapNotes: 0, assessments: 0 };
        } finally {
            setIsCheckingBlockers(false);
        }
    };

    const handleSave = async (formData) => {
        setIsSaving(true);
        try {
            const appointmentToSave = {
                ...formData,
                start_time: new Date(formData.start_time).toISOString(),
                end_time: new Date(formData.end_time).toISOString(),
            };
            if (appointment?.id) {
                appointmentToSave.id = appointment.id;
            }
            await onSave(appointmentToSave, false);
        } catch (error) {
            console.error("Failed to save appointment:", error);
            toast.error("Failed to save. Please check the details and try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveAndClose = async (formData) => {
        if (isRecurring && !appointment?.id) {
            setIsSavingRecurring(true);
            try {
                const start = moment(formData.start_time);
                const end = moment(formData.end_time);
                const durationMins = end.diff(start, 'minutes');
                const freqMap = {
                    weekly:      { n: 1, unit: 'weeks' },
                    fortnightly: { n: 2, unit: 'weeks' },
                    '4weekly':   { n: 4, unit: 'weeks' },
                    monthly:     { n: 1, unit: 'months' },
                };
                const freq = freqMap[recurringFrequency] || freqMap.weekly;
                const seriesId = `series_${Date.now()}`;
                let dates = [];
                let cur = start.clone();
                if (recurringEndType === 'count') {
                    for (let i = 0; i < Math.max(1, recurringCount); i++) {
                        dates.push(cur.clone());
                        cur.add(freq.n, freq.unit);
                    }
                } else {
                    const endD = moment(recurringEndDate).endOf('day');
                    while (cur.isSameOrBefore(endD) && dates.length < 52) {
                        dates.push(cur.clone());
                        cur.add(freq.n, freq.unit);
                    }
                }
                let firstSaved = null;
                for (let i = 0; i < dates.length; i++) {
                    const d = dates[i];
                    const apptData = {
                        ...formData,
                        start_time: d.toISOString(),
                        end_time: d.clone().add(durationMins, 'minutes').toISOString(),
                        series_id: seriesId,
                        series_index: i,
                        series_total: dates.length,
                    };
                    const saved = await onSave(apptData, false);
                    if (i === 0) firstSaved = saved;
                }
                toast.success(`Created ${dates.length} recurring appointment${dates.length > 1 ? 's' : ''}!`);
                setSavedAppointment(firstSaved || formData);
                setShowReminders(true);
            } catch (error) {
                console.error("Recurring save failed:", error);
                toast.error("Failed to create recurring appointments.");
            } finally {
                setIsSavingRecurring(false);
            }
            return;
        }

        setIsSaving(true);
        try {
            const appointmentToSave = {
                ...formData,
                start_time: new Date(formData.start_time).toISOString(),
                end_time: new Date(formData.end_time).toISOString(),
            };
            if (appointment?.id) {
                appointmentToSave.id = appointment.id;
            }

            await onSave(appointmentToSave, false);

            setSavedAppointment(appointmentToSave);
            setShowReminders(true);

        } catch (error) {
            console.error("Failed to save appointment:", error);
            toast.error("Failed to save. Please check the details and try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAppointment = async () => {
        if (!appointment?.id) {
            setShowDeleteDialog(false);
            return;
        }

        const blockers = await checkDeleteBlockers();

        if (blockers.soapNotes > 0 || blockers.assessments > 0) {
            return;
        }

        try {
            await onDelete(appointment.id);
            setShowDeleteDialog(false);
            onClose();
        } catch (error) {
            console.error("Failed to delete appointment:", error);
            setShowDeleteDialog(false);
        }
    };

    const handleDeleteClick = async () => {
        if (!appointment?.id) return;
        await checkDeleteBlockers();
        setShowDeleteDialog(true);
    };

    const handleCancel = (force = false) => {
        const formIsDirty = formState.isDirty;
        if (!force && formIsDirty) {
            if (window.confirm("You have unsaved changes. Are you sure you want to discard them and close?")) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    const handleRunAssessment = () => {
        if (!appointment?.client_id || !appointment?.id) {
            toast.error("Please select a client and save the appointment first.");
            return;
        }
        const returnToUrl = `${window.location.origin}${createPageUrl(`Calendar?openAppointmentId=${appointment.id}`)}`;
        const url = createPageUrl(`AssessmentLibrary?mode=run&clientId=${appointment.client_id}&appointmentId=${appointment.id}&returnTo=${encodeURIComponent(returnToUrl)}`);
        navigate(url);
        onClose();
    };

    const handleViewClientProfile = () => {
        if (!appointment?.client_id) {
            toast.error("Please select a client first.");
            return;
        }
        navigate(createPageUrl(`ClientProfile?id=${appointment.client_id}`));
        onClose();
    };

    const handleCloseReminders = () => {
        setShowReminders(false);
        onClose();
    };

    const canDelete = deleteBlockers.soapNotes === 0 && deleteBlockers.assessments === 0;

    return (
        <>
            <Dialog open={true} onOpenChange={() => handleCancel()}>
                <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{appointment?.id ? 'Edit Appointment' : 'New Appointment'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 pt-4">
                        <form id="appointment-form" onSubmit={handleSubmit(handleSaveAndClose)} className="space-y-4">
                            <div>
                                <Label htmlFor="title">Appointment Title</Label>
                                <Input
                                    id="title"
                                    {...register('title', { required: 'Appointment title is required' })}
                                    placeholder="e.g., Initial Assessment, Follow-up Session"
                                    className="mt-1"
                                />
                                {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
                            </div>

                            <div>
                                <Label htmlFor="client">Client *</Label>
                                <div className="relative mt-1">
                                    <div className="flex items-center">
                                        <Search className="absolute left-3 w-4 h-4 text-slate-400" />
                                        <Input
                                            value={clientSearchTerm}
                                            onChange={handleClientSearchChange}
                                            onFocus={() => setShowClientDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowClientDropdown(false), 100)}
                                            placeholder="Type to search for a client..."
                                            className="pl-10"
                                        />
                                    </div>
                                    <input type="hidden" {...register('client_id', { required: 'Client selection is required' })} />
                                    {showClientDropdown && filteredClients.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                            {filteredClients.map((client) => (
                                                <div
                                                    key={client.id}
                                                    className="p-3 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-b-0"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => handleClientSelect(client)}
                                                >
                                                    <p className="font-medium">{client.full_name}</p>
                                                    <p className="text-sm text-slate-500">{client.email}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {selectedClient && (
                                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded flex items-center justify-between">
                                        <span className="text-sm text-blue-800">Selected: {selectedClient.full_name}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedClient(null);
                                                setClientSearchTerm('');
                                                setValue('client_id', '', { shouldValidate: true });
                                            }}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                                {errors.client_id && <p className="text-red-500 text-sm mt-1">{errors.client_id.message}</p>}
                            </div>

                            <div>
                                <Label htmlFor="location_id">Location *</Label>
                                <Controller
                                    name="location_id"
                                    control={control}
                                    rules={{ required: 'Location is required' }}
                                    render={({ field }) => (
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            className="mt-1"
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select location" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {locations.map((location) => (
                                                    <SelectItem key={location.id} value={location.id}>
                                                        {location.clinic_name}
                                                        {location.is_main && ' (Main)'}
                                                        {location.clinic_address && (
                                                            <span className="text-xs text-slate-500 block">{location.clinic_address}</span>
                                                        )}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.location_id && <p className="text-red-500 text-sm mt-1">{errors.location_id.message}</p>}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="start_time">Start Time</Label>
                                    <Input
                                        id="start_time"
                                        type="datetime-local"
                                        {...register('start_time', { required: 'Start time is required' })}
                                        className="mt-1"
                                    />
                                    {errors.start_time && <p className="text-red-500 text-sm mt-1">{errors.start_time.message}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="end_time">End Time</Label>
                                    <Input
                                        id="end_time"
                                        type="datetime-local"
                                        {...register('end_time', { required: 'End time is required' })}
                                        className="mt-1"
                                    />
                                    {errors.end_time && <p className="text-red-500 text-sm mt-1">{errors.end_time.message}</p>}
                                </div>
                            </div>

                            {calSettings?.appointment_types?.length > 0 && (
                              <div>
                                <Label>Appointment Type</Label>
                                <Controller
                                  name="appointment_type"
                                  control={control}
                                  render={({ field }) => (
                                    <Select
                                      value={field.value}
                                      onValueChange={(v) => {
                                        field.onChange(v);
                                        const t = calSettings.appointment_types.find(t => t.name === v);
                                        if (t) setValue('appointment_colour', t.colour);
                                      }}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Select type (optional)" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {calSettings.appointment_types.map(t => (
                                          <SelectItem key={t.id} value={t.name}>
                                            <span className="flex items-center gap-2">
                                              <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.colour }} />
                                              {t.name}
                                            </span>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                              </div>
                            )}

                            <div>
                                <Label htmlFor="status">Appointment Status</Label>
                                <Controller
                                    name="status"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value} className="mt-1">
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                                <SelectItem value="completed">Completed</SelectItem>
                                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                                <SelectItem value="no_show">No Show</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>

                            <div>
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    {...register('notes')}
                                    placeholder="Add any additional notes about this appointment..."
                                    className="mt-1"
                                    rows={3}
                                />
                            </div>

                            {!appointment?.id && (
                                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <CalendarDays className="w-4 h-4 text-slate-600" />
                                            <Label className="font-semibold text-slate-800 text-sm">Recurring Appointments</Label>
                                        </div>
                                        <Switch
                                            checked={isRecurring}
                                            onCheckedChange={setIsRecurring}
                                        />
                                    </div>
                                    {isRecurring && (
                                        <div className="space-y-3">
                                            <div>
                                                <Label className="text-xs text-slate-600">Frequency</Label>
                                                <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
                                                    <SelectTrigger className="mt-1 h-8 text-sm">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="weekly">Weekly</SelectItem>
                                                        <SelectItem value="fortnightly">Fortnightly (every 2 weeks)</SelectItem>
                                                        <SelectItem value="4weekly">Every 4 weeks</SelectItem>
                                                        <SelectItem value="monthly">Monthly (same date)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-xs text-slate-600">End after</Label>
                                                <div className="flex gap-2 mt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setRecurringEndType('count')}
                                                        className={`flex-1 py-1.5 px-3 text-xs rounded border transition-colors ${recurringEndType === 'count' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                                                    >
                                                        Number of sessions
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setRecurringEndType('date')}
                                                        className={`flex-1 py-1.5 px-3 text-xs rounded border transition-colors ${recurringEndType === 'date' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                                                    >
                                                        End date
                                                    </button>
                                                </div>
                                            </div>
                                            {recurringEndType === 'count' ? (
                                                <div>
                                                    <Label className="text-xs text-slate-600">Number of appointments</Label>
                                                    <input
                                                        type="number"
                                                        min={2}
                                                        max={52}
                                                        value={recurringCount}
                                                        onChange={(e) => setRecurringCount(Math.max(2, Math.min(52, parseInt(e.target.value) || 2)))}
                                                        className="mt-1 w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
                                                    />
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        Will create {recurringCount} appointment{recurringCount !== 1 ? 's' : ''} ({recurringFrequency === 'weekly' ? `${recurringCount} weeks` : recurringFrequency === 'fortnightly' ? `${recurringCount * 2} weeks` : recurringFrequency === '4weekly' ? `${recurringCount * 4} weeks` : `~${recurringCount} months`})
                                                    </p>
                                                </div>
                                            ) : (
                                                <div>
                                                    <Label className="text-xs text-slate-600">Repeat until</Label>
                                                    <input
                                                        type="date"
                                                        value={recurringEndDate}
                                                        onChange={(e) => setRecurringEndDate(e.target.value)}
                                                        className="mt-1 w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
                                                    />
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 text-xs p-2.5 rounded border border-blue-200">
                                                <RepeatIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                                <span>Booking recurring {recurringFrequency} appointments</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </form>

                        {appointment?.id && appointment?.client_id && (
                            <div className="border-t pt-6">
                                <h3 className="text-lg font-semibold mb-4">Session Actions</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => onOpenSOAPNote(appointment)}
                                        className="justify-start text-left h-auto py-3"
                                    >
                                        <FileText className="w-5 h-5 mr-3 flex-shrink-0 text-blue-600" />
                                        <div>
                                            <p className="font-semibold text-slate-800">Open SOAP Note</p>
                                            <p className="text-xs text-slate-500 font-normal">Document the client session</p>
                                        </div>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleRunAssessment}
                                        className="justify-start text-left h-auto py-3"
                                    >
                                        <ClipboardList className="w-5 h-5 mr-3 flex-shrink-0 text-purple-600" />
                                        <div>
                                            <p className="font-semibold text-slate-800">Add / Run Assessment</p>
                                            <p className="text-xs text-slate-500 font-normal">Perform a clinical assessment</p>
                                        </div>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleViewClientProfile}
                                        className="justify-start text-left h-auto py-3"
                                    >
                                        <User className="w-5 h-5 mr-3 flex-shrink-0 text-green-600" />
                                        <div>
                                            <p className="font-semibold text-slate-800">View Client Profile</p>
                                            <p className="text-xs text-slate-500 font-normal">Open full client record</p>
                                        </div>
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="border-t pt-6 flex justify-between items-center">
                            <div>
                                {appointment?.id && (
                                    <div>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            onClick={handleDeleteClick}
                                            className="flex items-center gap-2"
                                            disabled={isCheckingBlockers}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            {isCheckingBlockers ? 'Checking...' : 'Delete Appointment'}
                                        </Button>
                                        {((deleteBlockers.soapNotes > 0 || deleteBlockers.assessments > 0) && !isCheckingBlockers) && (
                                            <p className="text-sm text-slate-500 mt-2">
                                                Cannot delete:
                                                {deleteBlockers.soapNotes > 0 && ` ${deleteBlockers.soapNotes} SOAP note(s)`}
                                                {deleteBlockers.soapNotes > 0 && deleteBlockers.assessments > 0 && ','}
                                                {deleteBlockers.assessments > 0 && ` ${deleteBlockers.assessments} assessment(s)`}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => handleCancel()}>
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleSubmit(handleSave)}
                                    disabled={isSaving}
                                    className="flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {isSaving ? 'Saving...' : 'Save'}
                                </Button>
                                <Button
                                    type="submit"
                                    form="appointment-form"
                                    disabled={isSaving || isSavingRecurring}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                                >
                                    <Save className="w-4 h-4" />
                                    {isSavingRecurring ? `Creating series...` : isSaving ? 'Saving...' : isRecurring && !appointment?.id ? `Book ${recurringCount} Appointments` : 'Save & Close'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {canDelete ? 'Delete Appointment' : 'Cannot Delete Appointment'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                            {canDelete ? (
                                <>
                                    <p>Are you sure you want to delete this appointment?</p>
                                    <p className="font-semibold">This action cannot be undone.</p>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                        <div className="space-y-2">
                                            <p className="font-semibold text-red-800">This appointment cannot be deleted because it has:</p>
                                            <ul className="list-disc list-inside space-y-1 text-red-700">
                                                {deleteBlockers.soapNotes > 0 && (
                                                    <li>{deleteBlockers.soapNotes} SOAP note(s) attached</li>
                                                )}
                                                {deleteBlockers.assessments > 0 && (
                                                    <li>{deleteBlockers.assessments} assessment(s) recorded</li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                    <p className="text-sm">Please delete or remove these items first:</p>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                        {deleteBlockers.soapNotes > 0 && (
                                            <li>Delete SOAP notes from the appointment</li>
                                        )}
                                        {deleteBlockers.assessments > 0 && (
                                            <li>Remove assessments from the client profile</li>
                                        )}
                                    </ul>
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {canDelete ? 'Cancel' : 'Close'}
                        </AlertDialogCancel>
                        {canDelete && (
                            <AlertDialogAction
                                onClick={handleDeleteAppointment}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                Delete Appointment
                            </AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {showReminders && savedAppointment && (
                <AppointmentReminderModal
                    client={clients.find(c => c.id === savedAppointment.client_id)}
                    lastAppointmentDate={savedAppointment.start_time}
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