import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import moment from "moment";
import { Appointment, Client } from "@/entities/all";
import { User } from "@/entities/User";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Input,
} from "@/components/ui/input";
import {
  Calendar as CalendarIcon,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  X as XIcon,
} from "lucide-react";
import AppointmentModal from "@/components/calendar/AppointmentModal";
import SOAPNoteModal from "@/components/calendar/SOAPNoteModal";
import { useSearchParams } from "react-router-dom";
import { toast } from 'sonner';

// --- Status colour config ---
const STATUS_STYLES = {
  scheduled: { bg: "#1a56db", border: "#1e40af", text: "#ffffff" },
  completed: { bg: "#059669", border: "#047857", text: "#ffffff" },
  cancelled:  { bg: "#dc2626", border: "#991b1b", text: "#ffffff" },
  no_show:    { bg: "#7c3aed", border: "#5b21b6", text: "#ffffff" },
};
const DEFAULT_STYLE = { bg: "#1a56db", border: "#1e40af", text: "#ffffff" };
const getStyle = (status) => STATUS_STYLES[status] || DEFAULT_STYLE;

// --- Time constants (defaults — overridden by user calendar settings) ---
const SLOT_HEIGHT = 16; // px per 15-min slot
const HOUR_HEIGHT = SLOT_HEIGHT * 4; // 64px per hour
const DEFAULT_START_HOUR = 4;
const DEFAULT_END_HOUR = 22;

// --- Month View ---
const MonthView = ({ currentDate, events, onDayClick, onEventClick }) => {
  const firstDayOfCalendar = currentDate.clone().startOf("month").startOf("week");
  const lastDayOfCalendar = currentDate.clone().endOf("month").endOf("week");

  const calendarDays = [];
  let day = firstDayOfCalendar.clone();
  while (day.isBefore(lastDayOfCalendar, "day")) {
    calendarDays.push(day.clone());
    day.add(1, "day");
  }

  const getEventsForDay = (date) =>
    events.filter((e) => moment(e.start).isSame(date, "day")).sort((a, b) => a.start - b.start);

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 border-b border-slate-200">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-xs font-semibold uppercase tracking-wider text-slate-500 py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1">
        {calendarDays.map((day) => {
          const isToday = day.isSame(moment(), "day");
          const isCurrentMonth = day.isSame(currentDate, "month");
          const eventsOnDay = getEventsForDay(day);
          return (
            <div
              key={day.format("YYYY-MM-DD")}
              className={`border-b border-r border-slate-100 p-1 flex flex-col cursor-pointer min-h-[90px] ${
                isCurrentMonth ? "bg-white hover:bg-slate-50" : "bg-slate-50/60"
              } ${isToday ? "!bg-blue-50" : ""}`}
              onClick={() => onDayClick(day.toDate())}
            >
              <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full mb-1 ${
                isToday ? "bg-blue-600 text-white" : isCurrentMonth ? "text-slate-700" : "text-slate-300"
              }`}>
                {day.format("D")}
              </span>
              <div className="space-y-0.5 overflow-hidden">
                {eventsOnDay.slice(0, 3).map((event) => {
                  const s = getStyle(event.status);
                  return (
                    <div
                      key={event.id}
                      className="text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: s.bg, color: s.text }}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                    >
                      {moment(event.start).format("h:mma")} {event.title}
                    </div>
                  );
                })}
                {eventsOnDay.length > 3 && (
                  <div className="text-xs text-slate-400 px-1">+{eventsOnDay.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- Halaxy-style Time Grid ---
const TimeGridView = ({ days, events, onSlotClick, onEventClick, calSettings, workingHours }) => {
  const scrollRef = useRef(null);

  const startHour = (() => {
    if (!workingHours) return DEFAULT_START_HOUR;
    const opens = Object.values(workingHours)
      .filter(d => d.open && d.start)
      .map(d => parseInt(d.start.split(':')[0]));
    return opens.length ? Math.max(0, Math.min(...opens) - 1) : DEFAULT_START_HOUR;
  })();
  const endHour = (() => {
    if (!workingHours) return DEFAULT_END_HOUR;
    const closes = Object.values(workingHours)
      .filter(d => d.open && d.end)
      .map(d => {
        const [h, m] = d.end.split(':').map(Number);
        return m > 0 ? h + 1 : h;
      });
    return closes.length ? Math.min(24, Math.max(...closes) + 1) : DEFAULT_END_HOUR;
  })();
  const totalHours = endHour - startHour;

  useEffect(() => {
    if (scrollRef.current) {
      const firstOpen = workingHours
        ? Math.min(...Object.values(workingHours).filter(d => d.open && d.start).map(d => parseInt(d.start)))
        : 8;
      const offset = (firstOpen - startHour) * HOUR_HEIGHT;
      scrollRef.current.scrollTop = Math.max(0, offset);
    }
  }, [startHour]);

  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      slots.push({ h, m });
    }
  }

  const getDayKey = (day) => {
    const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return keys[day.day()];
  };
  const getDayHours = (day) => workingHours?.[getDayKey(day)] || null;

  const getEventPos = (event) => {
    const startMins = moment(event.start).diff(moment(event.start).clone().startOf('day').add(startHour, 'hours'), 'minutes');
    const durationMins = moment(event.end).diff(moment(event.start), 'minutes');
    const top = Math.max(0, (startMins / 15) * SLOT_HEIGHT);
    const height = Math.max(SLOT_HEIGHT, (durationMins / 15) * SLOT_HEIGHT);
    return { top, height };
  };

  const eventsByDay = useMemo(() => {
    const map = new Map();
    days.forEach((day) => {
      const dayKey = day.format("YYYY-MM-DD");
      const dayEvents = events
        .filter((e) => moment(e.start).isSame(day, "day"))
        .sort((a, b) => moment(a.start).valueOf() - moment(b.start).valueOf());
      map.set(dayKey, dayEvents);
    });
    return map;
  }, [days, events]);

  const totalHeight = totalHours * HOUR_HEIGHT;

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex border-b border-slate-200 bg-white sticky top-0 z-20">
          <div className="w-16 flex-shrink-0" />
          {days.map((day) => {
            const isToday = day.isSame(moment(), "day");
            return (
              <div
                key={day.format("YYYY-MM-DD")}
                className={`flex-1 text-center py-2 text-sm font-semibold border-l border-slate-200 ${
                  isToday ? "text-blue-600" : "text-slate-700"
                }`}
              >
                <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {day.format("ddd")}
                </span>
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold mx-auto ${
                  isToday ? "bg-blue-600 text-white" : "text-slate-800"
                }`}>
                  {day.format("D")}
                </span>
                <span className="block text-xs text-slate-400">{day.format("MMM")}</span>
              </div>
            );
          })}
        </div>

        <div className="flex" style={{ height: `${totalHeight}px` }}>
          <div className="w-16 flex-shrink-0 relative">
            {Array.from({ length: totalHours }, (_, i) => (
              i === 0 ? null : (
                <div
                  key={i}
                  className="absolute w-full pointer-events-none"
                  style={{ top: `${i * HOUR_HEIGHT}px`, height: 0, overflow: "visible" }}
                >
                  <span
                    className="absolute right-2 text-xs text-slate-400 select-none"
                    style={{ top: 0, transform: "translateY(-100%)", lineHeight: "1" }}
                  >
                    {moment({ hour: startHour + i }).format("h:mm a")}
                  </span>
                </div>
              )
            ))}
          </div>

          {days.map((day) => {
            const dayKey = day.format("YYYY-MM-DD");
            const dayEvents = eventsByDay.get(dayKey) || [];

            return (
              <div
                key={dayKey}
                className="flex-1 relative border-l border-slate-200"
                style={{ height: `${totalHeight}px` }}
              >
                {(() => {
                  const dh = getDayHours(day);
                  if (!dh || !dh.open) {
                    return (
                      <div className="absolute inset-0 bg-slate-100/70 pointer-events-none z-0" />
                    );
                  }
                  const openMins = parseInt(dh.start.split(':')[0]) * 60 + parseInt(dh.start.split(':')[1]);
                  const closeMins = parseInt(dh.end.split(':')[0]) * 60 + parseInt(dh.end.split(':')[1]);
                  const startOffsetMins = startHour * 60;
                  const beforeTop = Math.max(0, (openMins - startOffsetMins) / 15 * SLOT_HEIGHT);
                  const afterTop = Math.max(0, (closeMins - startOffsetMins) / 15 * SLOT_HEIGHT);
                  return (
                    <>
                      {beforeTop > 0 && (
                        <div className="absolute left-0 right-0 bg-slate-100/70 pointer-events-none z-0" style={{ top: 0, height: `${beforeTop}px` }} />
                      )}
                      {afterTop < totalHeight && (
                        <div className="absolute left-0 right-0 bg-slate-100/70 pointer-events-none z-0" style={{ top: `${afterTop}px`, bottom: 0 }} />
                      )}
                    </>
                  );
                })()}

                {slots.map(({ h, m }, i) => (
                  <div
                    key={i}
                    className="absolute w-full"
                    style={{
                      top: `${i * SLOT_HEIGHT}px`,
                      height: `${SLOT_HEIGHT}px`,
                      borderTop: m === 0
                        ? "1px solid #cbd5e1"
                        : "1px dashed #e2e8f0",
                    }}
                    onClick={() => onSlotClick(day.clone().hour(h).minute(m).toDate())}
                  />
                ))}

                {dayEvents.map((event) => {
                  const { top, height } = getEventPos(event);
                  const s = getStyle(event.status);
                  const eventBg = event.appointment_colour || s.bg;
                  return (
                    <div
                      key={event.id}
                      className="absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 z-10 cursor-pointer overflow-hidden hover:brightness-90 transition-all"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: eventBg,
                        color: s.text,
                        borderLeft: `3px solid ${event.appointment_colour || s.border}`,
                      }}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                    >
                      <p className="text-xs font-semibold leading-tight truncate">
                        {moment(event.start).format("h:mma")} – {moment(event.end).format("h:mma")}
                      </p>
                      <p className="text-xs leading-tight truncate font-medium">
                        {event.title}
                      </p>
                      {event.location && height >= SLOT_HEIGHT * 3 && (
                        <p className="text-xs leading-tight truncate opacity-80">{event.location}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Main Calendar Page ---
export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalInfo, setModalInfo] = useState({ isOpen: false, event: null });
  const [soapNoteModal, setSoapNoteModal] = useState({ isOpen: false, appointment: null, client: null, allAppointments: [], currentIndex: -1 });
  const [currentDate, setCurrentDate] = useState(moment());
  const [calSettings, setCalSettings] = useState(null);
  const [view, setView] = useState("week");
  const [searchQuery, setSearchQuery] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();

  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      if (currentUser.calendar_settings) {
        setCalSettings(currentUser.calendar_settings);
        if (currentUser.calendar_settings.default_view) {
          setView(currentUser.calendar_settings.default_view);
        }
        if (currentUser.calendar_settings.week_start === 'mon') {
          moment.updateLocale('en', { week: { dow: 1 } });
        } else {
          moment.updateLocale('en', { week: { dow: 0 } });
        }
      }
      const orgMemberships = await base44.entities.OrganizationMember.filter({ user_email: currentUser.email });
      const userOrgId = orgMemberships.length > 0 ? orgMemberships[0].org_id : null;

      if (!userOrgId) {
        setEvents([]);
        setClients([]);
        return [];
      }

      const clientsData = await Client.filter({ org_id: userOrgId });
      const clientNameMap = new Map(clientsData.map((c) => [c.id, c.full_name]));

      const allAppointments = await Appointment.filter({ org_id: userOrgId });
      const formattedEvents = allAppointments.map((apt) => ({
        id: apt.id,
        title: clientNameMap.get(apt.client_id) || apt.title?.replace("Appointment with ", "") || "Appointment",
        start: moment(apt.start_time).toDate(),
        end: moment(apt.end_time).toDate(),
        client_id: apt.client_id,
        notes: apt.notes,
        status: apt.status,
        location: apt.location,
        org_id: apt.org_id,
        appointment_type: apt.appointment_type,
        appointment_colour: apt.appointment_colour,
      }));

      setEvents(formattedEvents);
      setClients(clientsData);
      return formattedEvents;
    } catch (error) {
      console.error("Error loading calendar data:", error);
      toast.error("Failed to load calendar data.");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const openSOAPId = searchParams.get("openSOAP");
    if (openSOAPId && events.length > 0) {
      const eventToOpen = events.find((e) => e.id === openSOAPId);
      if (eventToOpen) {
        setCurrentDate(moment(eventToOpen.start));
        handleOpenSOAPNote(eventToOpen);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("openSOAP");
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [events, searchParams, setSearchParams]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  const handleNewAppointment = (date) => {
    const duration = calSettings?.default_appt_duration || 60;
    setModalInfo({ isOpen: true, event: { start: date, end: moment(date).add(duration, "minutes").toDate() } });
  };

  const handleSelectEvent = (event) => {
    setModalInfo({ isOpen: true, event });
  };

  const closeModal = () => setModalInfo({ isOpen: false, event: null });

  const handleSave = async (appointmentData, shouldClose = true) => {
    try {
      let title = appointmentData.title;
      const client = clients.find((c) => c.id === appointmentData.client_id);
      if (client) title = client.full_name;

      const dataToSave = { ...appointmentData, title };
      if (dataToSave.start_time instanceof Date) dataToSave.start_time = dataToSave.start_time.toISOString();
      if (dataToSave.end_time instanceof Date) dataToSave.end_time = dataToSave.end_time.toISOString();

      let savedAppointment;
      if (dataToSave.id) {
        savedAppointment = await Appointment.update(dataToSave.id, dataToSave);
        toast.success("Appointment updated!");
      } else {
        savedAppointment = await Appointment.create(dataToSave);
        toast.success("Appointment created!");
      }

      const updatedEvents = await fetchCalendarData();

      if (!shouldClose && savedAppointment) {
        const updatedEvent = updatedEvents.find((e) => e.id === savedAppointment.id);
        if (updatedEvent) setModalInfo({ isOpen: true, event: updatedEvent });
      } else if (shouldClose) {
        closeModal();
      }
    } catch (error) {
      toast.error("Failed to save appointment.");
    }
  };

  const handleDelete = async (appointmentId) => {
    try {
      await Appointment.delete(appointmentId);
      toast.success("Appointment deleted!");
      closeModal();
      fetchCalendarData();
    } catch (error) {
      toast.error("Failed to delete appointment.");
    }
  };

  const handleOpenSOAPNote = async (appointment) => {
    const client = clients.find((c) => c.id === appointment.client_id);
    if (!client) { toast.error("Could not find client."); return; }
    setModalInfo({ isOpen: false, event: null });
    try {
      const allAppointmentsForClient = await Appointment.filter({ client_id: client.id });
      const sorted = allAppointmentsForClient
        .map((apt) => ({ ...apt, start: new Date(apt.start_time), end: new Date(apt.end_time) }))
        .sort((a, b) => a.start - b.start);
      const currentIndex = sorted.findIndex((apt) => apt.id === appointment.id);
      setSoapNoteModal({ isOpen: true, appointment, client, allAppointments: sorted, currentIndex });
    } catch (error) {
      toast.error("Failed to load SOAP note.");
    }
  };

  const handleCloseSOAPNote = () => {
    setSoapNoteModal({ isOpen: false, appointment: null, client: null, allAppointments: [], currentIndex: -1 });
    fetchCalendarData();
  };

  const handleNavigateSOAP = (direction) => {
    setSoapNoteModal((prev) => {
      const newIndex = direction === "next" ? prev.currentIndex + 1 : prev.currentIndex - 1;
      if (newIndex >= 0 && newIndex < prev.allAppointments.length) {
        const newAppointment = prev.allAppointments[newIndex];
        const newClient = clients.find((c) => c.id === newAppointment.client_id) || prev.client;
        return { ...prev, appointment: newAppointment, client: newClient, currentIndex: newIndex };
      }
      return prev;
    });
  };

  const handleNavigate = (action) => {
    if (action === "today") { setCurrentDate(moment()); return; }
    const unit = view === "week" ? "week" : view === "day" ? "day" : "month";
    setCurrentDate((d) => d.clone()[action === "prev" ? "subtract" : "add"](1, unit));
  };

  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const getWeekDays = () => {
    const allDays = Array.from({ length: 7 }, (_, i) => currentDate.clone().startOf("week").add(i, "days"));
    if (calSettings?.hide_closed_days && calSettings?.working_hours) {
      return allDays.filter(d => calSettings.working_hours[DAY_KEYS[d.day()]]?.open !== false);
    }
    return allDays;
  };

  const getHeaderTitle = () => {
    if (view === "day") return currentDate.format("dddd, D MMM YYYY");
    if (view === "week") {
      const s = currentDate.clone().startOf("week");
      const e = currentDate.clone().endOf("week");
      return `${s.format("D")} – ${e.format("D MMM YYYY")}`;
    }
    return currentDate.format("MMMM YYYY");
  };

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(e =>
      e.title?.toLowerCase().includes(q) ||
      e.location?.toLowerCase().includes(q) ||
      e.appointment_type?.toLowerCase().includes(q)
    );
  }, [events, searchQuery]);

  const renderView = () => {
    const wh = calSettings?.working_hours || null;
    if (view === "day") return <TimeGridView days={[currentDate]} events={filteredEvents} onSlotClick={handleNewAppointment} onEventClick={handleSelectEvent} calSettings={calSettings} workingHours={wh} />;
    if (view === "week") return <TimeGridView days={getWeekDays()} events={filteredEvents} onSlotClick={handleNewAppointment} onEventClick={handleSelectEvent} calSettings={calSettings} workingHours={wh} />;
    return <MonthView currentDate={currentDate} events={filteredEvents} onDayClick={(date) => { setCurrentDate(moment(date)); setView("day"); }} onEventClick={handleSelectEvent} />;
  };

  return (
    <>
      <div className="flex flex-col h-screen bg-white">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-800">Appointment Calendar</span>
          </div>
          <div className="relative flex-1 max-w-xs mx-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleNewAppointment(new Date())}>
            <Plus className="w-4 h-4 mr-1" />
            New Appointment
          </Button>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-white flex-wrap">
          <Button variant="outline" size="sm" onClick={() => handleNavigate("today")} className="text-xs">Today</Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => handleNavigate("prev")}>
            &lt; {view === "week" ? "Week" : view === "day" ? "Day" : "Month"}
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => handleNavigate("next")}>
            {view === "week" ? "Week" : view === "day" ? "Day" : "Month"} &gt;
          </Button>

          <span className="text-sm font-semibold text-slate-700 ml-2">{getHeaderTitle()}</span>

          <div className="ml-auto flex items-center gap-1 bg-slate-100 rounded p-0.5">
            {["day", "week", "month"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-xs rounded font-medium transition-colors capitalize ${
                  view === v ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 px-4 py-1.5 border-b border-slate-100 bg-white text-xs text-slate-500 flex-wrap">
          {[
            { color: "#1a56db", label: "Scheduled" },
            { color: "#059669", label: "Completed" },
            { color: "#dc2626", label: "Cancelled" },
            { color: "#7c3aed", label: "No Show" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
          {searchQuery && (
            <span className="ml-auto text-blue-600 font-medium text-xs">
              {filteredEvents.length} result{filteredEvents.length !== 1 ? 's' : ''} for "{searchQuery}"
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            {renderView()}
          </div>
        )}

        {modalInfo.isOpen && (
          <AppointmentModal
            appointment={modalInfo.event}
            clients={clients}
            onClose={closeModal}
            onSave={handleSave}
            onDelete={handleDelete}
            onOpenSOAPNote={handleOpenSOAPNote}
            calSettings={calSettings}
          />
        )}

        {soapNoteModal.isOpen && (
          <SOAPNoteModal
            appointment={soapNoteModal.appointment}
            client={soapNoteModal.client}
            onClose={handleCloseSOAPNote}
            onNavigate={handleNavigateSOAP}
            hasPrev={soapNoteModal.currentIndex > 0}
            hasNext={soapNoteModal.currentIndex < soapNoteModal.allAppointments.length - 1}
            sessionInfo={{ current: soapNoteModal.currentIndex + 1, total: soapNoteModal.allAppointments.length }}
          />
        )}
      </div>
    </>
  );
}