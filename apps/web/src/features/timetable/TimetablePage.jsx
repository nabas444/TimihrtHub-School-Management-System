import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import PageLoader from '../../components/ui/PageLoader';
import { useAuthStore } from '../../store/authStore';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const COLORS = ['bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-purple-100 text-purple-800', 'bg-amber-100 text-amber-800', 'bg-pink-100 text-pink-800', 'bg-indigo-100 text-indigo-800'];

export default function TimetablePage() {
  const { isTeacher, isAdmin, isStudent } = useAuthStore();
  const [classId, setClassId] = useState('');

  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/academics/classes').then((r) => r.data.data) });

  const { data: timetable, isLoading } = useQuery({
    queryKey: ['timetable', isTeacher() ? 'teacher' : classId],
    queryFn: () => isTeacher() || isAdmin()
      ? api.get('/timetable/teacher').then((r) => r.data.data)
      : api.get(`/timetable/class/${classId}`).then((r) => r.data.data),
    enabled: isTeacher() || isAdmin() || !!classId,
  });

  // Build unique time slots
  const allSlots = Object.values(timetable ?? {}).flat();
  const times = [...new Set(allSlots.map((s) => s.startTime))].sort();
  const subjectColors = {};
  let colorIdx = 0;
  allSlots.forEach((s) => {
    const name = s.subjectTeaching?.subject?.name;
    if (name && !subjectColors[name]) subjectColors[name] = COLORS[colorIdx++ % COLORS.length];
  });

  return (
    <div className="space-y-6">
      <div className="page-header flex-wrap gap-3">
        <div><h1 className="page-title">Timetable</h1><p className="page-subtitle">Weekly class schedule</p></div>
        {!isTeacher() && (
          <select className="input w-40" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">— Select class —</option>
            {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {isLoading ? <PageLoader /> : !timetable ? (
        <div className="card card-body text-center text-gray-400 py-12">
          {isTeacher() || isAdmin() ? 'No timetable found' : 'Select a class to view timetable'}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table min-w-max">
            <thead>
              <tr>
                <th className="w-20">Time</th>
                {DAYS.map((d) => <th key={d} className="w-36">{d.charAt(0) + d.slice(1).toLowerCase()}</th>)}
              </tr>
            </thead>
            <tbody>
              {times.map((time) => (
                <tr key={time}>
                  <td className="text-xs text-gray-500 font-mono">{time}</td>
                  {DAYS.map((day) => {
                    const slot = (timetable[day] ?? []).find((s) => s.startTime === time);
                    if (!slot) return <td key={day} />;
                    const subj = slot.subjectTeaching?.subject?.name ?? '?';
                    const teacher = slot.subjectTeaching?.teacher?.user;
                    return (
                      <td key={day}>
                        <div className={`rounded-lg px-2 py-2 text-xs font-medium ${subjectColors[subj] ?? 'bg-gray-100 text-gray-600'}`}>
                          <p className="font-semibold">{subj}</p>
                          {teacher && <p className="opacity-70 mt-0.5">{teacher.firstName} {teacher.lastName}</p>}
                          <p className="opacity-60 mt-0.5">{slot.startTime}–{slot.endTime}</p>
                          {slot.room && <p className="opacity-60">{slot.room}</p>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {times.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-400 py-8">No slots found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
