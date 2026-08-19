import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Users,
  BookOpen,
  Coffee,
  Utensils,
  MapPin,
  Sparkles,
  Printer,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  CalendarRange,
  Layers,
} from 'lucide-react';
import api from '../../lib/api';
import { Badge, EmptyState } from '../../components/ui/index';
import Modal from '../../components/ui/Modal';
import PageLoader from '../../components/ui/PageLoader';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const DAYS_OF_WEEK = [
  { key: 'MONDAY', label: 'Monday', short: 'Mon' },
  { key: 'TUESDAY', label: 'Tuesday', short: 'Tue' },
  { key: 'WEDNESDAY', label: 'Wednesday', short: 'Wed' },
  { key: 'THURSDAY', label: 'Thursday', short: 'Thu' },
  { key: 'FRIDAY', label: 'Friday', short: 'Fri' },
  { key: 'SATURDAY', label: 'Saturday', short: 'Sat' },
  { key: 'SUNDAY', label: 'Sunday', short: 'Sun' },
];

const PERIOD_COLORS = [
  'bg-blue-50 border-blue-200 text-blue-900',
  'bg-emerald-50 border-emerald-200 text-emerald-900',
  'bg-purple-50 border-purple-200 text-purple-900',
  'bg-amber-50 border-amber-200 text-amber-900',
  'bg-rose-50 border-rose-200 text-rose-900',
  'bg-indigo-50 border-indigo-200 text-indigo-900',
  'bg-teal-50 border-teal-200 text-teal-900',
  'bg-cyan-50 border-cyan-200 text-cyan-900',
  'bg-orange-50 border-orange-200 text-orange-900',
];

const DEFAULT_BELL_PRESETS = [
  { period: 'Period 1', start: '08:00', end: '08:45', type: 'CLASS' },
  { period: 'Period 2', start: '08:50', end: '09:35', type: 'CLASS' },
  { period: 'Morning Break', start: '09:35', end: '10:00', type: 'BREAK' },
  { period: 'Period 3', start: '10:00', end: '10:45', type: 'CLASS' },
  { period: 'Period 4', start: '10:50', end: '11:35', type: 'CLASS' },
  { period: 'Lunch Break', start: '11:35', end: '12:30', type: 'LUNCH' },
  { period: 'Period 5', start: '12:30', end: '13:15', type: 'CLASS' },
  { period: 'Period 6', start: '13:20', end: '14:05', type: 'CLASS' },
  { period: 'Period 7', start: '14:10', end: '14:55', type: 'CLASS' },
];

export default function TimetablePage() {
  const { isAdmin, isTeacher, isStudent } = useAuthStore();
  const qc = useQueryClient();
  const canManage = isAdmin();

  // Navigation & View Mode State
  const [viewMode, setViewMode] = useState('weekly'); // 'daily' | 'weekly' | 'monthly' | 'yearly'
  const [filterType, setFilterType] = useState('class'); // 'class' | 'teacher'
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedDay, setSelectedDay] = useState('MONDAY');
  const [showWeekends, setShowWeekends] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal State
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [quickBuilderOpen, setQuickBuilderOpen] = useState(false);

  // Form State for Slot creation / edit
  const [form, setForm] = useState({
    dayOfWeek: 'MONDAY',
    startTime: '08:00',
    endTime: '08:45',
    subjectId: '',
    teacherProfileId: '',
    room: '',
  });

  // Fetch Classes
  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/academics/classes').then((r) => r.data.data),
  });

  // Fetch Subjects
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.get('/academics/subjects').then((r) => r.data.data),
  });

  // Fetch Teachers
  const { data: teachers } = useQuery({
    queryKey: ['timetable-teachers'],
    queryFn: () => api.get('/timetable/teachers').then((r) => r.data.data),
  });

  // Fetch Academic Terms for yearly view
  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => api.get('/academics/terms').then((r) => r.data.data),
  });

  // Set default class once loaded
  useMemo(() => {
    if (classes?.length > 0 && !selectedClassId && filterType === 'class') {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId, filterType]);

  // Query Timetable
  const activeClassId = selectedClassId || classes?.[0]?.id;
  const activeTeacherId = selectedTeacherId || teachers?.[0]?.user?.id;

  const { data: timetableData, isLoading: timetableLoading } = useQuery({
    queryKey: ['timetable', filterType, filterType === 'class' ? activeClassId : activeTeacherId],
    queryFn: () => {
      if (filterType === 'teacher' && activeTeacherId) {
        return api.get(`/timetable/teacher/${activeTeacherId}`).then((r) => r.data.data);
      }
      if (activeClassId) {
        return api.get(`/timetable/class/${activeClassId}`).then((r) => r.data.data);
      }
      return { grouped: {}, slots: [] };
    },
    enabled: filterType === 'class' ? !!activeClassId : !!activeTeacherId,
  });

  const slots = timetableData?.slots ?? [];
  const groupedDays = timetableData?.grouped ?? {};

  // Active days list based on weekend toggle
  const activeDays = useMemo(() => {
    return showWeekends ? DAYS_OF_WEEK : DAYS_OF_WEEK.slice(0, 5);
  }, [showWeekends]);

  // Unique time slots across all days
  const timeHeaders = useMemo(() => {
    const set = new Set(slots.map((s) => `${s.startTime}-${s.endTime}`));
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return sorted.map((range) => {
      const [startTime, endTime] = range.split('-');
      return { startTime, endTime, range };
    });
  }, [slots]);

  // Assign consistent colors to subjects
  const subjectColors = useMemo(() => {
    const map = {};
    let idx = 0;
    (subjects ?? []).forEach((s) => {
      map[s.id] = PERIOD_COLORS[idx % PERIOD_COLORS.length];
      map[s.name] = PERIOD_COLORS[idx % PERIOD_COLORS.length];
      idx++;
    });
    return map;
  }, [subjects]);

  // Mutations
  const createSlotMutation = useMutation({
    mutationFn: (d) => api.post('/timetable/slots', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timetable'] });
      toast.success('Timetable period scheduled successfully');
      setSlotModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to create timetable slot');
    },
  });

  const updateSlotMutation = useMutation({
    mutationFn: ({ id, ...d }) => api.patch(`/timetable/slots/${id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timetable'] });
      toast.success('Period updated');
      setSlotModalOpen(false);
      setEditingSlot(null);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update period');
    },
  });

  const deleteSlotMutation = useMutation({
    mutationFn: (id) => api.delete(`/timetable/slots/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timetable'] });
      toast.success('Period removed from schedule');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete period');
    },
  });

  const clearTimetableMutation = useMutation({
    mutationFn: (clsId) => api.delete(`/timetable/class/${clsId}/clear`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timetable'] });
      toast.success('Class timetable cleared');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to clear timetable');
    },
  });

  const resetForm = () => {
    setForm({
      dayOfWeek: 'MONDAY',
      startTime: '08:00',
      endTime: '08:45',
      subjectId: subjects?.[0]?.id || '',
      teacherProfileId: teachers?.[0]?.id || '',
      room: '',
    });
    setEditingSlot(null);
  };

  const handleOpenAddModal = (preset = {}) => {
    setEditingSlot(null);
    setForm({
      dayOfWeek: preset.dayOfWeek || selectedDay || 'MONDAY',
      startTime: preset.startTime || '08:00',
      endTime: preset.endTime || '08:45',
      subjectId: preset.subjectId || subjects?.[0]?.id || '',
      teacherProfileId: preset.teacherProfileId || teachers?.[0]?.id || '',
      room: preset.room || '',
    });
    setSlotModalOpen(true);
  };

  const handleOpenEditModal = (slot) => {
    setEditingSlot(slot);
    setForm({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subjectId: slot.subjectTeaching?.subject?.id || '',
      teacherProfileId: slot.subjectTeaching?.teacherProfile?.id || '',
      room: slot.room || '',
    });
    setSlotModalOpen(true);
  };

  const handleSaveSlot = () => {
    if (!activeClassId && filterType === 'class') {
      toast.error('Please select a class first');
      return;
    }

    const payload = {
      classId: activeClassId,
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      subjectId: form.subjectId,
      teacherProfileId: form.teacherProfileId || undefined,
      room: form.room || undefined,
    };

    if (editingSlot) {
      updateSlotMutation.mutate({ id: editingSlot.id, ...payload });
    } else {
      createSlotMutation.mutate(payload);
    }
  };

  const currentSelectedClass = classes?.find((c) => c.id === activeClassId);
  const currentSelectedTeacher = teachers?.find((t) => t.user?.id === activeTeacherId);

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <CalendarIcon className="w-7 h-7 text-primary-600" />
            Timetable & Schedule Planner
          </h1>
          <p className="page-subtitle">
            Configure periods, class subjects, assigned teachers, break/lunch times, and view schedules.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <>
              <button
                className="btn-secondary"
                onClick={() => setQuickBuilderOpen(true)}
                title="View standard bell schedule and period templates"
              >
                <Sparkles className="w-4 h-4 text-amber-500" /> Bell Schedule
              </button>
              <button className="btn-primary" onClick={() => handleOpenAddModal()}>
                <Plus className="w-4 h-4" /> Add Period Slot
              </button>
            </>
          )}
          <button
            className="btn-secondary p-2.5"
            onClick={() => window.print()}
            title="Print or export timetable"
          >
            <Printer className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* ── Control & Filter Bar ───────────────────────────────── */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Filter Type & Target Selection */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
              <button
                onClick={() => setFilterType('class')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  filterType === 'class'
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 inline mr-1" /> By Class
              </button>
              <button
                onClick={() => setFilterType('teacher')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  filterType === 'teacher'
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 inline mr-1" /> By Teacher
              </button>
            </div>

            {filterType === 'class' ? (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                  Target Class:
                </label>
                <select
                  className="input py-1.5 text-sm min-w-44"
                  value={activeClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                >
                  {(classes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.gradeLevel ? `(${c.gradeLevel.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                  Select Teacher:
                </label>
                <select
                  className="input py-1.5 text-sm min-w-48"
                  value={activeTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                >
                  {(teachers ?? []).map((t) => (
                    <option key={t.user.id} value={t.user.id}>
                      {t.user.firstName} {t.user.lastName} ({t.teachings?.length || 0} subjects)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Weekend Toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 ml-2">
              <input
                type="checkbox"
                checked={showWeekends}
                onChange={(e) => setShowWeekends(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span>Include Sat / Sun</span>
            </label>
          </div>

          {/* View Mode Switcher */}
          <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50 self-start lg:self-auto">
            {[
              { id: 'weekly', label: 'Weekly Grid', icon: Layers },
              { id: 'daily', label: 'Daily View', icon: Clock },
              { id: 'monthly', label: 'Monthly View', icon: CalendarIcon },
              { id: 'yearly', label: 'Academic Term', icon: CalendarRange },
            ].map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    viewMode === mode.id
                      ? 'bg-white text-primary-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Info Banner for Active Class / Teacher */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100 flex-wrap gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            {filterType === 'class' && currentSelectedClass && (
              <>
                <span>
                  <strong>Class:</strong> {currentSelectedClass.name}
                </span>
                {currentSelectedClass.gradeLevel && (
                  <span>
                    <strong>Grade:</strong> {currentSelectedClass.gradeLevel.name}
                  </span>
                )}
                <span>
                  <strong>Academic Year:</strong> {currentSelectedClass.academicYear}
                </span>
              </>
            )}
            {filterType === 'teacher' && currentSelectedTeacher && (
              <>
                <span>
                  <strong>Teacher:</strong> {currentSelectedTeacher.user.firstName}{' '}
                  {currentSelectedTeacher.user.lastName}
                </span>
                <span>
                  <strong>Email:</strong> {currentSelectedTeacher.user.email}
                </span>
              </>
            )}
            <span>
              <strong>Total Scheduled Slots:</strong> {slots.length}
            </span>
          </div>

          {canManage && filterType === 'class' && slots.length > 0 && (
            <button
              onClick={() => {
                if (
                  confirm(
                    `Are you sure you want to clear all timetable periods for ${currentSelectedClass?.name}?`
                  )
                ) {
                  clearTimetableMutation.mutate(activeClassId);
                }
              }}
              className="text-red-600 hover:text-red-800 text-xs font-medium hover:underline inline-flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Clear Class Timetable
            </button>
          )}
        </div>
      </div>

      {/* ── Main View Content ──────────────────────────────────── */}
      {timetableLoading || classesLoading ? (
        <PageLoader />
      ) : (
        <>
          {/* ════════════════════════════════════════════════════════ */}
          {/* 1. WEEKLY GRID VIEW                                     */}
          {/* ════════════════════════════════════════════════════════ */}
          {viewMode === 'weekly' && (
            <div className="card overflow-hidden shadow-sm border border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-left">
                      <th className="p-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider w-24 bg-gray-100/70 border-r border-gray-200">
                        Day / Time
                      </th>
                      {timeHeaders.length > 0 ? (
                        timeHeaders.map((t, idx) => (
                          <th
                            key={t.range}
                            className="p-3 text-center border-r border-gray-200 min-w-36 text-xs font-semibold text-gray-700 bg-gray-50"
                          >
                            <span className="block font-bold text-gray-900">Period {idx + 1}</span>
                            <span className="text-[11px] font-mono text-gray-500">
                              {t.startTime} – {t.endTime}
                            </span>
                          </th>
                        ))
                      ) : (
                        <th className="p-3.5 text-center text-xs text-gray-400 font-normal">
                          Configured Periods
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {activeDays.map((dayObj) => {
                      const daySlots = groupedDays[dayObj.key] ?? [];
                      const isWeekend = dayObj.key === 'SATURDAY' || dayObj.key === 'SUNDAY';

                      return (
                        <tr
                          key={dayObj.key}
                          className={`hover:bg-gray-50/50 transition-colors ${
                            isWeekend ? 'bg-gray-50/40' : ''
                          }`}
                        >
                          {/* Day Column Header */}
                          <td className="p-3.5 font-bold text-xs text-gray-800 bg-gray-50/80 border-r border-gray-200 align-top">
                            <div className="flex items-center justify-between">
                              <span>{dayObj.label}</span>
                              {canManage && (
                                <button
                                  onClick={() => handleOpenAddModal({ dayOfWeek: dayObj.key })}
                                  className="p-1 rounded text-primary-600 hover:bg-primary-50"
                                  title={`Add period on ${dayObj.label}`}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            {isWeekend && (
                              <span className="inline-block mt-1 text-[10px] uppercase font-semibold text-gray-400">
                                Weekend
                              </span>
                            )}
                          </td>

                          {/* Time Slots for the Day */}
                          {timeHeaders.length > 0 ? (
                            timeHeaders.map((t) => {
                              const slot = daySlots.find(
                                (s) => s.startTime === t.startTime && s.endTime === t.endTime
                              );

                              if (!slot) {
                                return (
                                  <td
                                    key={t.range}
                                    className="p-2 border-r border-gray-200 align-top text-center"
                                  >
                                    {canManage ? (
                                      <button
                                        onClick={() =>
                                          handleOpenAddModal({
                                            dayOfWeek: dayObj.key,
                                            startTime: t.startTime,
                                            endTime: t.endTime,
                                          })
                                        }
                                        className="w-full h-20 rounded-lg border border-dashed border-gray-200 hover:border-primary-400 hover:bg-primary-50/30 flex flex-col items-center justify-center text-gray-300 hover:text-primary-600 transition-all group"
                                      >
                                        <Plus className="w-4 h-4 mb-0.5 opacity-40 group-hover:opacity-100" />
                                        <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100">
                                          Add
                                        </span>
                                      </button>
                                    ) : (
                                      <div className="h-20 flex items-center justify-center text-gray-300 text-xs">
                                        —
                                      </div>
                                    )}
                                  </td>
                                );
                              }

                              const subjectName = slot.subjectTeaching?.subject?.name || 'Class Period';
                              const teacher = slot.subjectTeaching?.teacherProfile?.user;
                              const slotColor =
                                subjectColors[subjectName] ||
                                'bg-primary-50 border-primary-200 text-primary-900';

                              return (
                                <td
                                  key={t.range}
                                  className="p-2 border-r border-gray-200 align-top relative group"
                                >
                                  <div
                                    className={`rounded-lg p-2.5 border transition-all h-full min-h-20 flex flex-col justify-between shadow-xs ${slotColor}`}
                                  >
                                    <div>
                                      <div className="flex items-start justify-between gap-1">
                                        <h4 className="font-bold text-xs leading-snug line-clamp-1">
                                          {subjectName}
                                        </h4>
                                        {canManage && (
                                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                              onClick={() => handleOpenEditModal(slot)}
                                              className="p-0.5 rounded hover:bg-white/60 text-gray-600"
                                              title="Edit period"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={() => {
                                                if (confirm(`Remove ${subjectName} period?`)) {
                                                  deleteSlotMutation.mutate(slot.id);
                                                }
                                              }}
                                              className="p-0.5 rounded hover:bg-white/60 text-red-600"
                                              title="Delete period"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>

                                      {filterType === 'class' && teacher && (
                                        <p className="text-[11px] font-medium opacity-80 mt-1 flex items-center gap-1 line-clamp-1">
                                          <GraduationCap className="w-3 h-3 inline flex-shrink-0" />
                                          {teacher.firstName} {teacher.lastName}
                                        </p>
                                      )}

                                      {filterType === 'teacher' && slot.class && (
                                        <p className="text-[11px] font-medium opacity-80 mt-1 flex items-center gap-1">
                                          <Users className="w-3 h-3 inline flex-shrink-0" />
                                          Class {slot.class.name}
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] opacity-75 mt-2 pt-1 border-t border-black/5">
                                      <span className="font-mono">
                                        {slot.startTime}–{slot.endTime}
                                      </span>
                                      {slot.room && (
                                        <span className="flex items-center gap-0.5 line-clamp-1">
                                          <MapPin className="w-2.5 h-2.5" />
                                          {slot.room}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              );
                            })
                          ) : (
                            <td colSpan={6} className="p-6 text-center text-gray-400 text-xs">
                              {canManage ? (
                                <button
                                  onClick={() => handleOpenAddModal({ dayOfWeek: dayObj.key })}
                                  className="btn-secondary btn-sm"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Add first period for {dayObj.label}
                                </button>
                              ) : (
                                'No periods scheduled'
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {slots.length === 0 && (
                <div className="p-12 text-center bg-gray-50 border-t border-gray-200">
                  <EmptyState
                    icon={CalendarIcon}
                    title="No timetable periods configured yet"
                    description={
                      canManage
                        ? 'Get started by creating period slots or use the Bell Schedule quick builder above.'
                        : 'No schedule has been published for this selection.'
                    }
                  />
                  {canManage && (
                    <div className="mt-4 flex justify-center gap-3">
                      <button
                        className="btn-primary btn-sm"
                        onClick={() => handleOpenAddModal()}
                      >
                        <Plus className="w-4 h-4" /> Add Period
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => setQuickBuilderOpen(true)}
                      >
                        <Sparkles className="w-4 h-4" /> Bell Schedule Templates
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════ */}
          {/* 2. DAILY TIMELINE VIEW                                  */}
          {/* ════════════════════════════════════════════════════════ */}
          {viewMode === 'daily' && (
            <div className="space-y-4">
              {/* Day selector tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {activeDays.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setSelectedDay(d.key)}
                    className={`px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 whitespace-nowrap ${
                      selectedDay === d.key
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{d.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                        selectedDay === d.key
                          ? 'bg-primary-700 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {groupedDays[d.key]?.length ?? 0}
                    </span>
                  </button>
                ))}
              </div>

              {/* Daily Schedule List */}
              <div className="space-y-3">
                {(groupedDays[selectedDay] ?? []).length === 0 ? (
                  <div className="card p-12 text-center">
                    <EmptyState
                      icon={Clock}
                      title={`No periods scheduled for ${
                        DAYS_OF_WEEK.find((d) => d.key === selectedDay)?.label
                      }`}
                      description={
                        canManage
                          ? 'Click the button below to add a class period or break.'
                          : 'No scheduled activities for this day.'
                      }
                    />
                    {canManage && (
                      <button
                        className="btn-primary btn-sm mt-4 inline-flex items-center gap-1"
                        onClick={() => handleOpenAddModal({ dayOfWeek: selectedDay })}
                      >
                        <Plus className="w-4 h-4" /> Add Period for {selectedDay}
                      </button>
                    )}
                  </div>
                ) : (
                  (groupedDays[selectedDay] ?? []).map((slot, idx) => {
                    const subjectName = slot.subjectTeaching?.subject?.name || 'Class Period';
                    const teacher = slot.subjectTeaching?.teacherProfile?.user;
                    const slotColor =
                      subjectColors[subjectName] ||
                      'bg-primary-50 border-primary-200 text-primary-900';

                    return (
                      <div
                        key={slot.id}
                        className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary-300 transition-all"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">
                              Period
                            </span>
                            <span className="text-base font-extrabold text-gray-900">
                              {idx + 1}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-bold text-base text-gray-900">
                                {subjectName}
                              </span>
                              {slot.subjectTeaching?.subject?.code && (
                                <Badge variant="gray">
                                  {slot.subjectTeaching.subject.code}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                              <span className="flex items-center gap-1 font-mono font-medium text-gray-700">
                                <Clock className="w-3.5 h-3.5 text-primary-600" />
                                {slot.startTime} – {slot.endTime}
                              </span>

                              {teacher && (
                                <span className="flex items-center gap-1">
                                  <GraduationCap className="w-3.5 h-3.5 text-gray-400" />
                                  Teacher: {teacher.firstName} {teacher.lastName}
                                </span>
                              )}

                              {slot.class && filterType === 'teacher' && (
                                <span className="flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5 text-gray-400" />
                                  Class: {slot.class.name}
                                </span>
                              )}

                              {slot.room && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                  Venue: {slot.room}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                            <button
                              className="btn-secondary btn-sm"
                              onClick={() => handleOpenEditModal(slot)}
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              className="btn-ghost p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              onClick={() => {
                                if (confirm(`Remove ${subjectName} period?`)) {
                                  deleteSlotMutation.mutate(slot.id);
                                }
                              }}
                              title="Delete period"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════ */}
          {/* 3. MONTHLY CALENDAR VIEW                                */}
          {/* ════════════════════════════════════════════════════════ */}
          {viewMode === 'monthly' && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-gray-900">
                    {format(currentDate, 'MMMM yyyy')}
                  </h3>
                  <Badge variant="blue">Timetable Calendar</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setCurrentDate(
                        (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)
                      )
                    }
                    className="btn-secondary btn-sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentDate(new Date())}
                    className="btn-secondary btn-sm"
                  >
                    Today
                  </button>
                  <button
                    onClick={() =>
                      setCurrentDate(
                        (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
                      )
                    }
                    className="btn-secondary btn-sm"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Month calendar grid representation */}
              <div className="grid grid-cols-7 gap-2 border-t border-gray-100 pt-3">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div
                    key={day}
                    className="text-center font-bold text-xs text-gray-400 py-1 uppercase"
                  >
                    {day}
                  </div>
                ))}

                {/* Calendar Days */}
                {Array.from({ length: 35 }).map((_, i) => {
                  const dayNum = (i % 31) + 1;
                  const dayOfWeekIdx = i % 7;
                  const dayKey = DAYS_OF_WEEK[dayOfWeekIdx]?.key;
                  const daySlots = groupedDays[dayKey] ?? [];

                  return (
                    <div
                      key={i}
                      className="min-h-24 p-2 border border-gray-100 rounded-xl bg-white hover:border-primary-200 transition-colors flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-700">{dayNum}</span>
                        {daySlots.length > 0 && (
                          <span className="text-[10px] font-medium text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-full">
                            {daySlots.length} periods
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 overflow-hidden">
                        {daySlots.slice(0, 2).map((s) => (
                          <div
                            key={s.id}
                            className="text-[10px] truncate px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 font-medium border border-gray-100"
                          >
                            {s.startTime} {s.subjectTeaching?.subject?.name}
                          </div>
                        ))}
                        {daySlots.length > 2 && (
                          <span className="text-[9px] text-gray-400 font-medium pl-1">
                            +{daySlots.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════ */}
          {/* 4. ACADEMIC YEAR / TERM SCHEDULE VIEW                   */}
          {/* ════════════════════════════════════════════════════════ */}
          {viewMode === 'yearly' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-5">
                  <h4 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-1.5">
                    <CalendarRange className="w-4 h-4 text-primary-600" />
                    Academic Terms
                  </h4>
                  <p className="text-xs text-gray-500 mb-3">
                    Active academic calendar schedule
                  </p>
                  <div className="space-y-2">
                    {(terms ?? []).length === 0 ? (
                      <p className="text-xs text-gray-400">No terms configured</p>
                    ) : (
                      (terms ?? []).map((term) => (
                        <div
                          key={term.id}
                          className="p-3 rounded-lg border border-gray-100 bg-gray-50 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-900">{term.name}</span>
                            {term.isCurrent && <Badge variant="green">Current Term</Badge>}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1 font-mono">
                            {format(new Date(term.startDate), 'dd MMM yyyy')} –{' '}
                            {format(new Date(term.endDate), 'dd MMM yyyy')}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="card p-5">
                  <h4 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    Weekly Hours Breakdown
                  </h4>
                  <p className="text-xs text-gray-500 mb-3">
                    Calculated teaching hours for this class
                  </p>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-xs py-1 border-b border-gray-100">
                      <span className="text-gray-600">Total Weekly Periods:</span>
                      <span className="font-bold text-gray-900">{slots.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs py-1 border-b border-gray-100">
                      <span className="text-gray-600">Core Subject Periods:</span>
                      <span className="font-bold text-emerald-600">{slots.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs py-1 border-b border-gray-100">
                      <span className="text-gray-600">Weekly Active Days:</span>
                      <span className="font-bold text-gray-900">
                        {activeDays.length} days
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card p-5">
                  <h4 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-purple-600" />
                    Subjects in Timetable
                  </h4>
                  <p className="text-xs text-gray-500 mb-3">
                    Unique subjects taught weekly
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(
                      new Set(slots.map((s) => s.subjectTeaching?.subject?.name).filter(Boolean))
                    ).map((name) => (
                      <span
                        key={name}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-100"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Add / Edit Period Slot Modal ───────────────────────── */}
      <Modal
        open={slotModalOpen}
        onClose={() => {
          setSlotModalOpen(false);
          resetForm();
        }}
        title={editingSlot ? 'Edit Timetable Period' : 'Schedule Timetable Period'}
        size="lg"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => {
                setSlotModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleSaveSlot}
              disabled={
                createSlotMutation.isPending ||
                updateSlotMutation.isPending ||
                !form.startTime ||
                !form.endTime ||
                !form.subjectId
              }
            >
              {createSlotMutation.isPending || updateSlotMutation.isPending
                ? 'Saving…'
                : editingSlot
                ? 'Save Changes'
                : 'Schedule Period'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Target Class *</label>
              <select
                className="input"
                value={activeClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                disabled={!!editingSlot}
                required
              >
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.gradeLevel ? `(${c.gradeLevel.name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Day of Week *</label>
              <select
                className="input"
                value={form.dayOfWeek}
                onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: e.target.value }))}
                required
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Academic Subject *</label>
              <select
                className="input"
                value={form.subjectId}
                onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
                required
              >
                <option value="">— Select Subject —</option>
                {(subjects ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Assigned Teacher (Optional)</label>
              <select
                className="input"
                value={form.teacherProfileId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, teacherProfileId: e.target.value }))
                }
              >
                <option value="">— Auto-Assign or Select Teacher —</option>
                {(teachers ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.user.firstName} {t.user.lastName} ({t.user.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Start Time *</label>
              <input
                className="input"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="label">End Time *</label>
              <input
                className="input"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="label">Room / Venue</label>
              <input
                className="input"
                placeholder="e.g. Room 101, Lab 2"
                value={form.room}
                onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
              />
            </div>
          </div>

          {/* Quick timing presets */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
              Quick Timing Presets:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '08:00 – 08:45', start: '08:00', end: '08:45' },
                { label: '08:50 – 09:35', start: '08:50', end: '09:35' },
                { label: '10:00 – 10:45', start: '10:00', end: '10:45' },
                { label: '10:50 – 11:35', start: '10:50', end: '11:35' },
                { label: '12:30 – 13:15', start: '12:30', end: '13:15' },
                { label: '13:20 – 14:05', start: '13:20', end: '14:05' },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, startTime: p.start, endTime: p.end }))
                  }
                  className="px-2.5 py-1 rounded bg-gray-100 hover:bg-primary-100 hover:text-primary-800 text-[11px] font-mono text-gray-700 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Bell Schedule & Preset Template Modal ───────────────── */}
      <Modal
        open={quickBuilderOpen}
        onClose={() => setQuickBuilderOpen(false)}
        title="Standard School Bell Schedule & Timings"
        size="lg"
        footer={
          <button className="btn-secondary" onClick={() => setQuickBuilderOpen(false)}>
            Close
          </button>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Standard daily timetable periods with configured class durations, morning recess, and lunch break bands:
          </p>

          <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
            {DEFAULT_BELL_PRESETS.map((preset) => {
              const isBreak = preset.type === 'BREAK';
              const isLunch = preset.type === 'LUNCH';

              return (
                <div
                  key={preset.period}
                  className={`p-3 flex items-center justify-between text-xs ${
                    isBreak
                      ? 'bg-amber-50/60 font-medium'
                      : isLunch
                      ? 'bg-emerald-50/60 font-medium'
                      : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isBreak
                          ? 'bg-amber-100 text-amber-700'
                          : isLunch
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {isBreak ? (
                        <Coffee className="w-4 h-4" />
                      ) : isLunch ? (
                        <Utensils className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h5 className="font-bold text-gray-900">{preset.period}</h5>
                      <span className="text-gray-500 font-mono">
                        {preset.start} – {preset.end}
                      </span>
                    </div>
                  </div>

                  <div>
                    {isBreak ? (
                      <Badge variant="yellow">Morning Recess</Badge>
                    ) : isLunch ? (
                      <Badge variant="green">Lunch Break</Badge>
                    ) : (
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => {
                          setQuickBuilderOpen(false);
                          handleOpenAddModal({
                            startTime: preset.start,
                            endTime: preset.end,
                          });
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" /> Assign Subject
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
