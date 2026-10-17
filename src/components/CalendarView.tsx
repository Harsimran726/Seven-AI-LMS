import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, Clock, User, Plus, Search, Filter, Mail, CheckCircle2, 
  AlertTriangle, ChevronLeft, ChevronRight, Settings, Users, BookOpen, Trash2, Edit, X,
  ExternalLink, Send, Sparkles, AlertCircle, Info, ShieldCheck, ToggleLeft, ToggleRight,
  Check, CalendarDays
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { CalendarEvent, TeacherAvailability, DailyAvailabilityOverride, Lead, Batch } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { sendDemoEmailNotification } from '../lib/emailNotifier';

// Default teacher list for SevenAI Institute
export const DEFAULT_TEACHERS = [
  { name: 'Harsimran Singh', email: 'harsimransingh27448@gmail.com', defaultStart: '09:00', defaultEnd: '18:00' },
  { name: 'Nishant Mittal', email: 'nishant@sevenai.edu.in', defaultStart: '10:00', defaultEnd: '19:00' },
  { name: 'Nikhil Mittal', email: 'nikhil@sevenai.edu.in', defaultStart: '09:00', defaultEnd: '17:00' },
  { name: 'Jagdeep Kaur', email: 'jagdeep@sevenai.edu.in', defaultStart: '10:00', defaultEnd: '18:00' },
];

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------------------------------------------------------------------------
// SERVICE TYPES & FUNCTION: Teacher Schedule Tracking & Slot Calculation
// ---------------------------------------------------------------------------
export interface TeacherSlotStatus {
  timeLabel: string; // "09:00 - 10:00"
  startTime: string; // "09:00"
  endTime: string; // "10:00"
  status: 'available' | 'booked' | 'blocked' | 'off';
  bookedEvent?: CalendarEvent;
  note?: string;
}

export interface TeacherScheduleReport {
  teacherName: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  isWorkingDay: boolean;
  dailyStatus: 'available' | 'leave' | 'busy' | 'partial';
  workingHours: { startTime: string; endTime: string };
  slots: TeacherSlotStatus[];
  totalSlotsCount: number;
  availableSlotsCount: number;
  bookedSlotsCount: number;
  blockedSlotsCount: number;
  dailyOverrideNote?: string;
}

/**
 * Service function to track teacher schedules, including slots for 'available' and 'booked'.
 */
export function trackTeacherSchedule(
  teacherName: string,
  dateStr: string, // YYYY-MM-DD
  teacherAvailabilities: TeacherAvailability[],
  calendarEvents: CalendarEvent[],
  defaultTeachersList = DEFAULT_TEACHERS
): TeacherScheduleReport {
  const defaultObj = defaultTeachersList.find(t => t.name === teacherName);
  const availConfig = teacherAvailabilities.find(a => a.teacherName === teacherName);

  const startTime = availConfig?.startTime || defaultObj?.defaultStart || '09:00';
  const endTime = availConfig?.endTime || defaultObj?.defaultEnd || '18:00';
  const daysOfWeek = availConfig?.daysOfWeek || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Parse date string for day of week name
  const parts = dateStr.split('-').map(Number);
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayName = DAYS_OF_WEEK[dateObj.getDay()] || 'Monday';
  const isWorkingDay = daysOfWeek.includes(dayName);

  // Check daily override for dateStr
  const override = availConfig?.dailyOverrides?.[dateStr];
  const dailyStatus = override?.status || (isWorkingDay ? 'available' : 'leave');
  const blockedSlots = override?.blockedSlots || [];

  // Active events for this teacher and date
  const teacherEvents = calendarEvents.filter(
    e => e.teacherName === teacherName && e.date === dateStr && e.status !== 'cancelled'
  );

  const slots: TeacherSlotStatus[] = [];
  const startHour = parseInt(startTime.split(':')[0], 10);
  const endHour = parseInt(endTime.split(':')[0], 10);

  for (let h = startHour; h < endHour; h++) {
    const sTime = `${String(h).padStart(2, '0')}:00`;
    const eTime = `${String(h + 1).padStart(2, '0')}:00`;
    const timeLabel = `${sTime} - ${eTime}`;

    let status: 'available' | 'booked' | 'blocked' | 'off' = 'available';
    let bookedEvent: CalendarEvent | undefined = undefined;

    if (dailyStatus === 'leave' || !isWorkingDay) {
      status = 'off';
    } else if (blockedSlots.includes(sTime) || dailyStatus === 'busy') {
      status = 'blocked';
    } else {
      // Overlap check with scheduled demo/batch events
      const overlappingEvent = teacherEvents.find(evt => {
        return (sTime >= evt.startTime && sTime < evt.endTime) ||
               (eTime > evt.startTime && eTime <= evt.endTime) ||
               (sTime <= evt.startTime && eTime >= evt.endTime);
      });

      if (overlappingEvent) {
        status = 'booked';
        bookedEvent = overlappingEvent;
      }
    }

    slots.push({
      timeLabel,
      startTime: sTime,
      endTime: eTime,
      status,
      bookedEvent,
      note: override?.notes
    });
  }

  const totalSlotsCount = slots.length;
  const availableSlotsCount = slots.filter(s => s.status === 'available').length;
  const bookedSlotsCount = slots.filter(s => s.status === 'booked').length;
  const blockedSlotsCount = slots.filter(s => s.status === 'blocked' || s.status === 'off').length;

  return {
    teacherName,
    date: dateStr,
    dayOfWeek: dayName,
    isWorkingDay,
    dailyStatus,
    workingHours: { startTime, endTime },
    slots,
    totalSlotsCount,
    availableSlotsCount,
    bookedSlotsCount,
    blockedSlotsCount,
    dailyOverrideNote: override?.notes
  };
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT: Academic Calendar & Teacher Scheduling View
// ---------------------------------------------------------------------------
export default function CalendarView() {
  const { calendarEvents, teacherAvailabilities, leads, batches, emailLogs, loading } = useData();
  const { user } = useAuth();

  // Navigation & View State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'teachers'>('month');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive Teacher Schedule View Date
  const [scheduleViewDate, setScheduleViewDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Modals & Drawers
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [showToggleStatusModal, setShowToggleStatusModal] = useState(false);
  const [showEmailLogsDrawer, setShowEmailLogsDrawer] = useState(false);
  const [selectedDayEventsModal, setSelectedDayEventsModal] = useState<string | null>(null);

  // Pre-selected parameters for modal triggers
  const [targetTeacherForToggle, setTargetTeacherForToggle] = useState<string>('Harsimran Singh');
  const [targetDateForToggle, setTargetDateForToggle] = useState<string>(new Date().toISOString().split('T')[0]);

  // Toast Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Date Navigation Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setScheduleViewDate(new Date().toISOString().split('T')[0]);
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return calendarEvents.filter(evt => {
      const matchesTeacher = selectedTeacherFilter === 'all' || evt.teacherName === selectedTeacherFilter;
      const matchesType = selectedTypeFilter === 'all' || evt.type === selectedTypeFilter;
      const matchesSearch = !searchQuery || 
        evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (evt.studentName && evt.studentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (evt.course && evt.course.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesTeacher && matchesType && matchesSearch;
    });
  }, [calendarEvents, selectedTeacherFilter, selectedTypeFilter, searchQuery]);

  // Days in current month grid calculation
  const monthGridDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sun
    const totalDays = lastDay.getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthLastDay - i);
      const dateStr = prevDate.toISOString().split('T')[0];
      days.push({ dateStr, dayNum: prevMonthLastDay - i, isCurrentMonth: false, isToday: false });
    }

    // Current month days
    const todayStr = new Date().toISOString().split('T')[0];
    for (let d = 1; d <= totalDays; d++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr
      });
    }

    // Next month padding days to complete grid
    const remainingCells = (42 - days.length) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const nextDate = new Date(year, month + 1, i);
      const dateStr = nextDate.toISOString().split('T')[0];
      days.push({ dateStr, dayNum: i, isCurrentMonth: false, isToday: false });
    }

    return days;
  }, [year, month]);

  // Group events by date map
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach(evt => {
      if (!map[evt.date]) map[evt.date] = [];
      map[evt.date].push(evt);
    });
    return map;
  }, [filteredEvents]);

  // Delete event handler
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await deleteDoc(doc(db, 'calendar_events', eventId));
      showToast('Event removed from calendar.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'calendar_events');
    }
  };

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Stats calculation
  const totalDemos = calendarEvents.filter(e => e.type === 'demo').length;
  const totalBatches = calendarEvents.filter(e => e.type === 'batch').length;
  const totalMailSent = emailLogs.length;

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-emerald-900/95 text-emerald-100 border border-emerald-500/40 px-5 py-3.5 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-emerald-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2.5 bg-indigo-500/15 border border-indigo-500/30 rounded-xl text-indigo-400">
                <CalendarIcon className="w-6 h-6" />
              </span>
              <h1 className="text-2xl font-bold text-white tracking-tight">Academic Calendar & Teacher Timing</h1>
            </div>
            <p className="text-sm text-slate-400 max-w-2xl">
              Schedule student demo classes, track teacher schedules ('available' vs 'booked' slots), toggle daily availability, and send automated teacher email alerts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setTargetTeacherForToggle(user?.displayName || 'Harsimran Singh');
                setTargetDateForToggle(new Date().toISOString().split('T')[0]);
                setShowToggleStatusModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all transform active:scale-95"
            >
              <ToggleLeft className="w-4 h-4 text-emerald-200" />
              Toggle Daily Availability
            </button>
            <button
              onClick={() => setShowDemoModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-semibold rounded-xl text-sm shadow-md transition-all transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Schedule Demo Slot
            </button>
            <button
              onClick={() => setShowBatchModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm shadow-md transition-all active:scale-95"
            >
              <BookOpen className="w-4 h-4" />
              Add Batch Timing
            </button>
            <button
              onClick={() => setShowEmailLogsDrawer(true)}
              className="relative flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm transition-all"
            >
              <Mail className="w-4 h-4 text-indigo-400" />
              Email Logs
              {totalMailSent > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-indigo-500 text-white text-xs font-bold rounded-full">
                  {totalMailSent}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Overview Stats Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{totalDemos}</div>
              <div className="text-xs text-slate-400">Total Demo Slots</div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{totalBatches}</div>
              <div className="text-xs text-slate-400">Scheduled Batches</div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">
                {DEFAULT_TEACHERS.length}
              </div>
              <div className="text-xs text-slate-400">Configured Teachers</div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{totalMailSent}</div>
              <div className="text-xs text-slate-400">Email Alerts Dispatched</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation, View Switcher & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
        {/* Date Month Navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-1">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition"
              title="Previous Month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700 rounded-lg transition"
            >
              Today
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition"
              title="Next Month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <h2 className="text-lg font-bold text-white tracking-wide">{monthName}</h2>
        </div>

        {/* View Selector Tabs */}
        <div className="flex items-center bg-slate-800 border border-slate-700 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('month')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              viewMode === 'month' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Month Grid
          </button>
          <button
            onClick={() => setViewMode('teachers')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              viewMode === 'teachers' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Teacher Schedules & Daily Status
          </button>
        </div>

        {/* Teacher & Event Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 md:w-48">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search calendar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white text-xs pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Teacher Filter */}
          <select
            value={selectedTeacherFilter}
            onChange={(e) => setSelectedTeacherFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Teachers</option>
            {DEFAULT_TEACHERS.map(t => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>

          {/* Event Type Filter */}
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Event Types</option>
            <option value="demo">Demo Slots</option>
            <option value="batch">Batches</option>
          </select>
        </div>
      </div>

      {/* VIEW MODE 1: Month Calendar Grid */}
      {viewMode === 'month' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-900/80 text-center py-3">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.slice(0, 3)}</span>
              </div>
            ))}
          </div>

          {/* Month Grid Cells */}
          <div className="grid grid-cols-7 auto-rows-fr gap-px bg-slate-800/40">
            {monthGridDays.map((cell, idx) => {
              const dayEvents = eventsByDate[cell.dateStr] || [];

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDayEventsModal(cell.dateStr)}
                  className={`min-h-[110px] p-2 bg-slate-900/90 transition-colors cursor-pointer hover:bg-slate-800/70 group relative ${
                    !cell.isCurrentMonth ? 'opacity-30 bg-slate-950/40' : ''
                  } ${cell.isToday ? 'ring-2 ring-indigo-500/80 bg-indigo-950/20' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        cell.isToday
                          ? 'bg-indigo-600 text-white shadow-md'
                          : cell.isCurrentMonth
                          ? 'text-slate-300 group-hover:text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-full">
                        {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                      </span>
                    )}
                  </div>

                  {/* Day Events Preview Pills */}
                  <div className="space-y-1 overflow-hidden max-h-[75px]">
                    {dayEvents.slice(0, 3).map((evt) => {
                      const isDemo = evt.type === 'demo';

                      return (
                        <div
                          key={evt.id}
                          className={`px-1.5 py-0.5 rounded text-[11px] font-medium truncate flex items-center justify-between border ${
                            isDemo
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                          }`}
                          title={`${evt.title} (${evt.startTime} - ${evt.endTime}) Teacher: ${evt.teacherName}`}
                        >
                          <span className="truncate">
                            <span className="font-bold mr-1">{evt.startTime}</span>
                            {isDemo ? '🎯 Demo' : '📚 Batch'}: {evt.studentName || evt.title}
                          </span>
                        </div>
                      );
                    })}

                    {dayEvents.length > 3 && (
                      <div className="text-[10px] font-medium text-slate-400 pl-1">
                        +{dayEvents.length - 3} more...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: Teacher Schedules & Daily Availability Tracker */}
      {viewMode === 'teachers' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                Teacher Schedule & Slot Availability Tracking
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect calculated 1-hour slots ('available' vs 'booked' vs 'off') for any date
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-300 font-medium">Select Date:</span>
                <input
                  type="date"
                  value={scheduleViewDate}
                  onChange={(e) => setScheduleViewDate(e.target.value)}
                  className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                />
              </div>

              <button
                onClick={() => setShowAvailabilityModal(true)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 rounded-xl transition"
              >
                + Shift Hours Setup
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {DEFAULT_TEACHERS.map((teacher) => {
              const availConfig = teacherAvailabilities.find(a => a.teacherName === teacher.name);
              
              // Run service function to calculate teacher schedule report for selected date
              const report = trackTeacherSchedule(
                teacher.name,
                scheduleViewDate,
                teacherAvailabilities,
                calendarEvents
              );

              return (
                <div key={teacher.name} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative flex flex-col justify-between">
                  <div>
                    {/* Header Info */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow">
                          {teacher.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-white">{teacher.name}</h4>
                          <p className="text-xs text-slate-400">{availConfig?.teacherEmail || teacher.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {report.dailyStatus === 'leave' ? (
                          <span className="px-2.5 py-1 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-full text-xs font-semibold">
                            🔴 On Leave / Off
                          </span>
                        ) : report.dailyStatus === 'busy' ? (
                          <span className="px-2.5 py-1 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-full text-xs font-semibold">
                            🟠 Fully Busy
                          </span>
                        ) : report.availableSlotsCount > 0 ? (
                          <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-semibold">
                            🟢 {report.availableSlotsCount} Slots Available
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded-full text-xs font-semibold">
                            🟣 Fully Booked
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Standard Shift & Working Days */}
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                        <span className="flex items-center gap-2 text-slate-400">
                          <Clock className="w-4 h-4 text-emerald-400" />
                          Shift Timing ({report.dayOfWeek})
                        </span>
                        <span className="font-semibold text-white">
                          {report.workingHours.startTime} - {report.workingHours.endTime}
                        </span>
                      </div>

                      {/* Live Slots Tracker Summary Bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                          <span className="text-slate-400">Slots on {scheduleViewDate}:</span>
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-400 font-bold">{report.availableSlotsCount} Available</span>
                            <span className="text-purple-400 font-bold">{report.bookedSlotsCount} Booked</span>
                            <span className="text-slate-400">{report.blockedSlotsCount} Off</span>
                          </div>
                        </div>

                        {/* Visual Progress Bar */}
                        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex border border-slate-700/60">
                          {report.totalSlotsCount > 0 && (
                            <>
                              <div 
                                style={{ width: `${(report.availableSlotsCount / report.totalSlotsCount) * 100}%` }}
                                className="bg-emerald-500 transition-all" 
                                title={`${report.availableSlotsCount} available slots`}
                              />
                              <div 
                                style={{ width: `${(report.bookedSlotsCount / report.totalSlotsCount) * 100}%` }}
                                className="bg-purple-500 transition-all" 
                                title={`${report.bookedSlotsCount} booked slots`}
                              />
                              <div 
                                style={{ width: `${(report.blockedSlotsCount / report.totalSlotsCount) * 100}%` }}
                                className="bg-slate-600 transition-all" 
                                title={`${report.blockedSlotsCount} blocked/off slots`}
                              />
                            </>
                          )}
                        </div>
                      </div>

                      {/* Interactive Hourly Slot Grid */}
                      <div className="pt-2">
                        <span className="text-xs font-semibold text-slate-400 block mb-2">
                          Calculated Hourly Slots:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                          {report.slots.map(slot => {
                            const isAvailable = slot.status === 'available';
                            const isBooked = slot.status === 'booked';

                            return (
                              <div
                                key={slot.startTime}
                                className={`p-2 rounded-xl border text-xs flex flex-col justify-between transition ${
                                  isAvailable
                                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                                    : isBooked
                                    ? 'bg-purple-950/20 border-purple-500/30 text-purple-200'
                                    : 'bg-slate-800/40 border-slate-700/50 text-slate-500'
                                }`}
                              >
                                <div className="flex items-center justify-between font-bold">
                                  <span>{slot.startTime}</span>
                                  {isAvailable ? (
                                    <span className="text-[10px] text-emerald-400 font-semibold uppercase">Free</span>
                                  ) : isBooked ? (
                                    <span className="text-[10px] text-purple-400 font-semibold uppercase">Booked</span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500 font-semibold uppercase">Off</span>
                                  )}
                                </div>

                                {isBooked && slot.bookedEvent && (
                                  <div className="text-[10px] text-slate-300 mt-1 truncate font-medium">
                                    {slot.bookedEvent.type === 'demo' ? '🎯' : '📚'} {slot.bookedEvent.studentName || slot.bookedEvent.title}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {report.dailyOverrideNote && (
                        <div className="p-2.5 bg-indigo-950/20 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 italic">
                          "{report.dailyOverrideNote}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Toggle Daily Status Button */}
                  <div className="pt-4 mt-4 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setTargetTeacherForToggle(teacher.name);
                        setTargetDateForToggle(scheduleViewDate);
                        setShowToggleStatusModal(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition"
                    >
                      <ToggleLeft className="w-4 h-4 text-emerald-400" />
                      Toggle Daily Status & Slots for {teacher.name.split(' ')[0]}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: Toggle Teacher Daily Availability Status Form */}
      {showToggleStatusModal && (
        <TeacherDailyStatusToggleModal
          initialTeacherName={targetTeacherForToggle}
          initialDate={targetDateForToggle}
          onClose={() => setShowToggleStatusModal(false)}
          onSuccess={(msg) => {
            setShowToggleStatusModal(false);
            showToast(msg);
          }}
        />
      )}

      {/* MODAL: Schedule Demo Class Slot */}
      {showDemoModal && (
        <ScheduleDemoModal
          onClose={() => setShowDemoModal(false)}
          onSuccess={(msg) => {
            setShowDemoModal(false);
            showToast(msg);
          }}
        />
      )}

      {/* MODAL: Schedule Batch Timing */}
      {showBatchModal && (
        <ScheduleBatchModal
          onClose={() => setShowBatchModal(false)}
          onSuccess={(msg) => {
            setShowBatchModal(false);
            showToast(msg);
          }}
        />
      )}

      {/* MODAL: Teacher Shift Hours Setup */}
      {showAvailabilityModal && (
        <TeacherShiftHoursModal
          onClose={() => setShowAvailabilityModal(false)}
          onSuccess={(msg) => {
            setShowAvailabilityModal(false);
            showToast(msg);
          }}
        />
      )}

      {/* DRAWER / MODAL: Email Notification Logs */}
      {showEmailLogsDrawer && (
        <EmailLogsDrawer
          onClose={() => setShowEmailLogsDrawer(false)}
        />
      )}

      {/* MODAL: Day Specific Events Modal */}
      {selectedDayEventsModal && (
        <DayEventsModal
          dateStr={selectedDayEventsModal}
          events={eventsByDate[selectedDayEventsModal] || []}
          onClose={() => setSelectedDayEventsModal(null)}
          onDeleteEvent={handleDeleteEvent}
          onOpenScheduleDemo={() => {
            setSelectedDayEventsModal(null);
            setShowDemoModal(true);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUBCOMPONENT: Teacher Daily Status & Slot Toggle Form Modal
// ---------------------------------------------------------------------------
function TeacherDailyStatusToggleModal({
  initialTeacherName,
  initialDate,
  onClose,
  onSuccess
}: {
  initialTeacherName?: string;
  initialDate?: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const { teacherAvailabilities, calendarEvents } = useData();
  const [selectedTeacher, setSelectedTeacher] = useState(initialTeacherName || 'Harsimran Singh');
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [dailyStatus, setDailyStatus] = useState<'available' | 'leave' | 'busy' | 'partial'>('available');
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when teacher or date selection changes
  useEffect(() => {
    const report = trackTeacherSchedule(selectedTeacher, selectedDate, teacherAvailabilities, calendarEvents);
    setDailyStatus(report.dailyStatus);

    const availConfig = teacherAvailabilities.find(a => a.teacherName === selectedTeacher);
    const override = availConfig?.dailyOverrides?.[selectedDate];
    if (override) {
      setBlockedSlots(override.blockedSlots || []);
      setNote(override.notes || '');
    } else {
      setBlockedSlots([]);
      setNote('');
    }
  }, [selectedTeacher, selectedDate, teacherAvailabilities, calendarEvents]);

  // Compute live schedule report
  const scheduleReport = useMemo(() => {
    return trackTeacherSchedule(selectedTeacher, selectedDate, teacherAvailabilities, calendarEvents);
  }, [selectedTeacher, selectedDate, teacherAvailabilities, calendarEvents]);

  const toggleSlotBlocked = (slotTime: string) => {
    if (blockedSlots.includes(slotTime)) {
      setBlockedSlots(blockedSlots.filter(s => s !== slotTime));
    } else {
      setBlockedSlots([...blockedSlots, slotTime]);
    }
    if (dailyStatus === 'available' || dailyStatus === 'leave') {
      setDailyStatus('partial');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const existing = teacherAvailabilities.find(a => a.teacherName === selectedTeacher);
      const teacherObj = DEFAULT_TEACHERS.find(t => t.name === selectedTeacher);

      const overrideData: DailyAvailabilityOverride = {
        date: selectedDate,
        status: dailyStatus,
        blockedSlots,
        notes: note
      };

      if (existing) {
        const updatedOverrides = {
          ...(existing.dailyOverrides || {}),
          [selectedDate]: overrideData
        };
        await updateDoc(doc(db, 'teacher_availability', existing.id), {
          dailyOverrides: updatedOverrides,
          updatedAt: Date.now()
        });
      } else {
        await addDoc(collection(db, 'teacher_availability'), {
          instituteId: 'SevenAI',
          teacherName: selectedTeacher,
          teacherEmail: teacherObj?.email || '',
          startTime: teacherObj?.defaultStart || '09:00',
          endTime: teacherObj?.defaultEnd || '18:00',
          daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          dailyOverrides: {
            [selectedDate]: overrideData
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }

      onSuccess(`Daily availability status updated for ${selectedTeacher} on ${selectedDate}!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'teacher_availability');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-500/15 text-indigo-400 rounded-xl">
              <ToggleLeft className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">Toggle Daily Availability Status</h3>
              <p className="text-xs text-slate-400">Set overall status or block/unblock hourly slots</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Teacher</label>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white font-semibold text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:border-indigo-500"
              >
                {DEFAULT_TEACHERS.map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Overall Daily Status</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'available', label: '🟢 Available', desc: 'Full Shift' },
                { id: 'leave', label: '🔴 On Leave', desc: 'Out / Off' },
                { id: 'partial', label: '🟡 Partial', desc: 'Custom Hours' },
                { id: 'busy', label: '🟠 Fully Busy', desc: 'Unavailable' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setDailyStatus(st.id as any);
                    if (st.id === 'available') setBlockedSlots([]);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    dailyStatus === st.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold">{st.label}</div>
                  <div className="text-[10px] text-slate-400">{st.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Slot-by-Slot Interactive Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-300">
                Shift Hourly Slots ({scheduleReport.workingHours.startTime} - {scheduleReport.workingHours.endTime})
              </label>
              <span className="text-[11px] text-slate-400">Click slot to toggle block</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800 max-h-48 overflow-y-auto">
              {scheduleReport.slots.map((s) => {
                const isManuallyBlocked = blockedSlots.includes(s.startTime);
                const isBooked = s.status === 'booked';
                const isOff = dailyStatus === 'leave' || s.status === 'off';

                let badgeColor = 'bg-emerald-950/50 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60';
                let statusText = 'Available';

                if (isBooked) {
                  badgeColor = 'bg-purple-950/50 text-purple-300 border-purple-500/40 cursor-not-allowed';
                  statusText = `Booked (${s.bookedEvent?.type === 'demo' ? 'Demo' : 'Batch'})`;
                } else if (isOff) {
                  badgeColor = 'bg-slate-800 text-slate-500 border-slate-700';
                  statusText = 'Teacher Off';
                } else if (isManuallyBlocked || s.status === 'blocked') {
                  badgeColor = 'bg-rose-950/50 text-rose-300 border-rose-500/40 hover:bg-rose-900/60';
                  statusText = 'Blocked';
                }

                return (
                  <button
                    key={s.startTime}
                    type="button"
                    disabled={isBooked}
                    onClick={() => toggleSlotBlocked(s.startTime)}
                    className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center ${badgeColor}`}
                  >
                    <span className="text-xs font-bold">{s.startTime}</span>
                    <span className="text-[10px] opacity-80 truncate max-w-full">{statusText}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Status Note / Reason (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Attending external seminar, doctor appointment..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-emerald-400 font-semibold">{scheduleReport.availableSlotsCount} Available</span>
              <span className="text-purple-400 font-semibold">{scheduleReport.bookedSlotsCount} Booked</span>
              <span className="text-slate-400">{scheduleReport.blockedSlotsCount} Off/Blocked</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition"
              >
                {isSaving ? 'Saving...' : 'Save Availability'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUBCOMPONENT: Schedule Demo Class Modal
// ---------------------------------------------------------------------------
function ScheduleDemoModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const { leads, calendarEvents, teacherAvailabilities } = useData();
  const { user } = useAuth();

  const [leadId, setLeadId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentContact, setStudentContact] = useState('');
  const [course, setCourse] = useState('Full Stack Web Development');
  const [teacherName, setTeacherName] = useState('Harsimran Singh');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('11:00');
  const [endTime, setEndTime] = useState('12:00');
  const [notes, setNotes] = useState('');
  const [sendEmailAlert, setSendEmailAlert] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fill student info when selecting lead
  const handleSelectLead = (lId: string) => {
    setLeadId(lId);
    if (!lId) return;
    const l = leads.find(item => item.id === lId);
    if (l) {
      setStudentName(l.name || '');
      setStudentContact(l.mobile || '');
      if (l.courseInterest) setCourse(l.courseInterest);
      if (l.handleBy && DEFAULT_TEACHERS.some(t => t.name === l.handleBy)) {
        setTeacherName(l.handleBy);
      }
    }
  };

  // Run service function to check slot status for selected teacher and date
  const scheduleReport = useMemo(() => {
    return trackTeacherSchedule(teacherName, date, teacherAvailabilities, calendarEvents);
  }, [teacherName, date, teacherAvailabilities, calendarEvents]);

  // Conflict Check
  const conflictCheck = useMemo(() => {
    const sameTeacherEvents = calendarEvents.filter(e => e.teacherName === teacherName && e.date === date && e.status !== 'cancelled');
    const hasConflict = sameTeacherEvents.some(e => {
      return (startTime >= e.startTime && startTime < e.endTime) ||
             (endTime > e.startTime && endTime <= e.endTime);
    });

    const teacherConfig = teacherAvailabilities.find(a => a.teacherName === teacherName);
    let isOutsideHours = false;
    if (teacherConfig) {
      if (startTime < teacherConfig.startTime || endTime > teacherConfig.endTime) {
        isOutsideHours = true;
      }
    }

    return { hasConflict, isOutsideHours, sameTeacherEvents };
  }, [teacherName, date, startTime, endTime, calendarEvents, teacherAvailabilities]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      alert('Please enter student name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedTeacherObj = DEFAULT_TEACHERS.find(t => t.name === teacherName);
      const teacherEmail = selectedTeacherObj?.email || `${teacherName.toLowerCase().replace(/[^a-z0-9]/g, '')}@sevenai.edu.in`;

      const demoTitle = `Demo: ${course} for ${studentName}`;

      // 1. Save Calendar Event in Firestore
      await addDoc(collection(db, 'calendar_events'), {
        instituteId: 'SevenAI',
        title: demoTitle,
        type: 'demo',
        teacherName,
        teacherEmail,
        studentName,
        studentContact,
        leadId: leadId || null,
        course,
        date,
        startTime,
        endTime,
        status: 'scheduled',
        notes,
        createdByStaffName: user?.displayName || user?.email || 'Admin',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // 2. Dispatch Email Notification if enabled
      if (sendEmailAlert) {
        await sendDemoEmailNotification({
          teacherName,
          teacherEmail,
          demoTitle,
          studentName,
          course,
          date,
          startTime,
          endTime,
          scheduledBy: user?.displayName || user?.email || 'Admin',
          notes,
          openMailClient: false
        });
      }

      onSuccess(`Demo slot scheduled for ${studentName} with ${teacherName}! Email alert sent.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'calendar_events');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-500/15 text-amber-400 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">Schedule Student Demo Class</h3>
              <p className="text-xs text-slate-400">Select available teacher time slot and alert teacher</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Select Lead Quick Auto-fill */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Select Existing Lead (Optional)</label>
            <select
              value={leadId}
              onChange={(e) => handleSelectLead(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Choose from Lead Directory --</option>
              {leads.map(l => (
                <option key={l.id} value={l.id}>{l.name} - {l.mobile} ({l.courseInterest || 'General'})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Student Name *</label>
              <input
                type="text"
                required
                placeholder="Student Name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Student Contact</label>
              <input
                type="text"
                placeholder="Mobile number"
                value={studentContact}
                onChange={(e) => setStudentContact(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Course / Topic</label>
              <input
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Teacher *</label>
              <select
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white font-semibold text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
              >
                {DEFAULT_TEACHERS.map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Demo Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs px-2.5 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs px-2.5 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">End Time</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs px-2.5 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Quick Slot Picker based on trackTeacherSchedule report */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300">{teacherName}'s Slots on {date}:</span>
              <span className="text-emerald-400 font-bold">{scheduleReport.availableSlotsCount} Free</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {scheduleReport.slots.map(s => {
                const isSelected = startTime === s.startTime;
                const isFree = s.status === 'available';

                return (
                  <button
                    key={s.startTime}
                    type="button"
                    disabled={!isFree}
                    onClick={() => {
                      setStartTime(s.startTime);
                      setEndTime(s.endTime);
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                        : isFree
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/50'
                        : 'bg-slate-800/40 text-slate-500 border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    {s.startTime} {isFree ? '✓' : '✗'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conflict Warning Indicator */}
          {conflictCheck.hasConflict && (
            <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl flex items-center gap-2.5 text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>Warning: Teacher {teacherName} already has another class scheduled during this time.</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Session Notes / Instructions</label>
            <textarea
              rows={2}
              placeholder="e.g. Needs focus on React basics..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Email Alert Toggle */}
          <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-400" />
              <div className="text-xs">
                <div className="font-bold text-slate-200">Send Instant Teacher Email Notification</div>
                <div className="text-slate-400 text-[11px]">Dispatch booking details to teacher email</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={sendEmailAlert}
              onChange={(e) => setSendEmailAlert(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-xl shadow transition"
            >
              {isSubmitting ? 'Booking & Notifying...' : 'Confirm Demo Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUBCOMPONENT: Schedule Batch Modal
// ---------------------------------------------------------------------------
function ScheduleBatchModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const { batches, calendarEvents } = useData();
  const { user } = useAuth();

  const [batchTitle, setBatchTitle] = useState('Full Stack Web Dev Morning Batch');
  const [teacherName, setTeacherName] = useState('Harsimran Singh');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedTeacherObj = DEFAULT_TEACHERS.find(t => t.name === teacherName);
      const teacherEmail = selectedTeacherObj?.email || `${teacherName.toLowerCase().replace(/[^a-z0-9]/g, '')}@sevenai.edu.in`;

      await addDoc(collection(db, 'calendar_events'), {
        instituteId: 'SevenAI',
        title: batchTitle,
        type: 'batch',
        teacherName,
        teacherEmail,
        date,
        startTime,
        endTime,
        status: 'scheduled',
        notes,
        createdByStaffName: user?.displayName || user?.email || 'Admin',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      onSuccess(`Batch timing "${batchTitle}" added to calendar!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'calendar_events');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-500/15 text-indigo-400 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </span>
            <h3 className="text-base font-bold text-white">Add Batch Schedule</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Batch / Class Name *</label>
            <input
              type="text"
              required
              value={batchTitle}
              onChange={(e) => setBatchTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Teacher *</label>
            <select
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white font-semibold text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
            >
              {DEFAULT_TEACHERS.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs px-2.5 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs px-2.5 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">End Time</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs px-2.5 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Notes</label>
            <input
              type="text"
              placeholder="e.g. Module 3: Database & ORMs"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition"
            >
              Save Batch Timing
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUBCOMPONENT: Teacher Shift Hours Setup Modal
// ---------------------------------------------------------------------------
function TeacherShiftHoursModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const { teacherAvailabilities } = useData();

  const [selectedTeacher, setSelectedTeacher] = useState('Harsimran Singh');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  const [isSaving, setIsSaving] = useState(false);

  const handleTeacherChange = (name: string) => {
    setSelectedTeacher(name);
    const existing = teacherAvailabilities.find(a => a.teacherName === name);
    if (existing) {
      setStartTime(existing.startTime);
      setEndTime(existing.endTime);
      setSelectedDays(existing.daysOfWeek || []);
    } else {
      const def = DEFAULT_TEACHERS.find(t => t.name === name);
      if (def) {
        setStartTime(def.defaultStart);
        setEndTime(def.defaultEnd);
      }
    }
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const existing = teacherAvailabilities.find(a => a.teacherName === selectedTeacher);
      const teacherObj = DEFAULT_TEACHERS.find(t => t.name === selectedTeacher);

      if (existing) {
        await updateDoc(doc(db, 'teacher_availability', existing.id), {
          startTime,
          endTime,
          daysOfWeek: selectedDays,
          updatedAt: Date.now(),
        });
      } else {
        await addDoc(collection(db, 'teacher_availability'), {
          instituteId: 'SevenAI',
          teacherName: selectedTeacher,
          teacherEmail: teacherObj?.email || '',
          startTime,
          endTime,
          daysOfWeek: selectedDays,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      onSuccess(`Working hours shift updated for ${selectedTeacher}!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'teacher_availability');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-500/15 text-emerald-400 rounded-xl">
              <Clock className="w-5 h-5" />
            </span>
            <h3 className="text-base font-bold text-white">Teacher Shift Hours Setup</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Select Teacher</label>
            <select
              value={selectedTeacher}
              onChange={(e) => handleTeacherChange(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white font-semibold text-xs px-3 py-2.5 rounded-xl focus:outline-none"
            >
              {DEFAULT_TEACHERS.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Shift Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs px-3 py-2.5 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Shift End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs px-3 py-2.5 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Available Working Days</label>
            <div className="grid grid-cols-3 gap-2">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${
                      isSelected
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition"
            >
              {isSaving ? 'Saving...' : 'Save Shift Config'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUBCOMPONENT: Email Notification Logs Drawer
// ---------------------------------------------------------------------------
function EmailLogsDrawer({ onClose }: { onClose: () => void }) {
  const { emailLogs } = useData();

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-500/15 text-indigo-400 rounded-xl">
              <Mail className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">Dispatched Email Alerts</h3>
              <p className="text-xs text-slate-400">Audit log of notifications sent to teachers</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {emailLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No email alerts sent yet. Schedule a demo slot to dispatch alerts!
            </div>
          ) : (
            emailLogs.map((log) => (
              <div key={log.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold text-white">{log.teacherName}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(log.sentAt).toLocaleString()}
                  </span>
                </div>

                <div className="text-xs text-slate-300 font-medium">
                  To: <span className="text-slate-200">{log.toEmail}</span>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-lg text-xs font-mono text-slate-300 space-y-1">
                  <div className="font-semibold text-indigo-300">{log.subject}</div>
                  <div className="text-[11px] text-slate-400 line-clamp-3">{log.body}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUBCOMPONENT: Day Agenda Modal
// ---------------------------------------------------------------------------
function DayEventsModal({
  dateStr,
  events,
  onClose,
  onDeleteEvent,
  onOpenScheduleDemo
}: {
  dateStr: string;
  events: CalendarEvent[];
  onClose: () => void;
  onDeleteEvent: (id: string) => void;
  onOpenScheduleDemo: () => void;
}) {
  const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">{formattedDate}</h3>
            <p className="text-xs text-slate-400">{events.length} event(s) scheduled for this day</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {events.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No events scheduled on this date.
            </div>
          ) : (
            events.map((evt) => {
              const isDemo = evt.type === 'demo';
              return (
                <div
                  key={evt.id}
                  className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                    isDemo
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : 'bg-indigo-950/20 border-indigo-500/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isDemo ? 'bg-amber-500/20 text-amber-300' : 'bg-indigo-500/20 text-indigo-300'
                      }`}>
                        {isDemo ? '🎯 Demo Class' : '📚 Student Batch'}
                      </span>
                      <span className="text-xs font-bold text-white">{evt.startTime} - {evt.endTime}</span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-100">{evt.title}</h4>

                    <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                      <div>Teacher: <span className="text-slate-200 font-semibold">{evt.teacherName}</span></div>
                      {evt.studentName && <div>Student: <span className="text-slate-200">{evt.studentName} ({evt.studentContact || 'N/A'})</span></div>}
                      {evt.course && <div>Course: <span className="text-slate-200">{evt.course}</span></div>}
                      {evt.notes && <div className="text-slate-400 italic mt-1">"{evt.notes}"</div>}
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteEvent(evt.id)}
                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg transition"
                    title="Delete Event"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/90">
          <button
            onClick={onOpenScheduleDemo}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow hover:bg-amber-400 transition"
          >
            <Plus className="w-4 h-4" />
            Book Demo On This Date
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
