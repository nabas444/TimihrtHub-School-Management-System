import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Save, Settings } from 'lucide-react';
import PageLoader from '../../components/ui/PageLoader';
import toast from 'react-hot-toast';

export default function SchoolSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({});
  const [settings, setSettings] = useState({});

  const { data: school, isLoading } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => api.get('/schools/profile').then((r) => r.data.data),
    onSuccess: (d) => { setForm({ name: d.name, email: d.email ?? '', phone: d.phone ?? '', address: d.address ?? '', city: d.city ?? '', website: d.website ?? '', academicYear: d.academicYear, termSystem: d.termSystem, gradingSystem: d.gradingSystem }); setSettings(d.settings ?? {}); },
  });

  const profileMutation = useMutation({
    mutationFn: (d) => api.patch('/schools/profile', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['school-profile'] }); toast.success('School profile updated'); },
  });

  const settingsMutation = useMutation({
    mutationFn: (d) => api.patch('/schools/settings', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['school-profile'] }); toast.success('Settings saved'); },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setSetting = (k) => (e) => setSettings((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="page-title">School Settings</h1><p className="page-subtitle">Configure your school's profile and policies</p></div>

      {/* School Profile */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">School Information</h3>
        <div className="space-y-4">
          <div><label className="label">School Name</label><input className="input" value={form.name ?? ''} onChange={set('name')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Email</label><input className="input" type="email" value={form.email ?? ''} onChange={set('email')} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone ?? ''} onChange={set('phone')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">City</label><input className="input" value={form.city ?? ''} onChange={set('city')} /></div>
            <div><label className="label">Website</label><input className="input" value={form.website ?? ''} onChange={set('website')} placeholder="https://…" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Academic Year</label><input className="input" value={form.academicYear ?? ''} onChange={set('academicYear')} placeholder="2024/2025" /></div>
            <div><label className="label">Term System</label>
              <select className="input" value={form.termSystem ?? ''} onChange={set('termSystem')}>
                {['SEMESTER', 'TRIMESTER', 'QUARTER'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="label">Grading</label>
              <select className="input" value={form.gradingSystem ?? ''} onChange={set('gradingSystem')}>
                {['PERCENTAGE', 'GPA', 'LETTER'].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <button className="btn-primary" onClick={() => profileMutation.mutate(form)} disabled={profileMutation.isPending}>
            <Save className="w-4 h-4" /> {profileMutation.isPending ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* School Policies */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Settings className="w-4 h-4" /> School Policies</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Attendance Start</label><input className="input" type="time" value={settings.attendanceStartTime ?? '08:00'} onChange={setSetting('attendanceStartTime')} /></div>
            <div><label className="label">Late Threshold (mins)</label><input className="input" type="number" value={settings.lateThresholdMinutes ?? 15} onChange={setSetting('lateThresholdMinutes')} /></div>
          </div>
          <div><label className="label">Pass Mark (%)</label><input className="input" type="number" min="0" max="100" value={settings.passMarkPercentage ?? 50} onChange={setSetting('passMarkPercentage')} /></div>
          <div className="space-y-3">
            {[
              ['allowParentChat', 'Allow parents to chat with teachers'],
              ['allowStudentChat', 'Allow students to use chat'],
              ['enableAiFeatures', 'Enable AI insights and chatbot'],
              ['enableLibrary', 'Enable library management'],
              ['enableTransport', 'Enable transport/bus routes'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={settings[key] ?? true} onChange={setSetting(key)} className="rounded w-4 h-4 accent-primary-600" />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
          <button className="btn-primary" onClick={() => settingsMutation.mutate(settings)} disabled={settingsMutation.isPending}>
            <Save className="w-4 h-4" /> {settingsMutation.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
