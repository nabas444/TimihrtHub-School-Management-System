import { CheckCircle2, Clock, Sparkles } from 'lucide-react';

const RELEASES = [
  {
    version: 'v0.7',
    date: 'August 2026',
    status: 'in-progress',
    title: 'Test Coverage & Hardening',
    notes: [
      'Added an automated test suite covering authentication, RBAC, tenancy isolation, fee payment transitions, and grading.',
      'Fixed an authorization gap in behaviour records, staff payroll/leave access, and library tenancy scoping.',
      'Ongoing: expanding coverage to timetable, chat, billing, and file management modules.',
    ],
  },
  {
    version: 'v0.6',
    date: 'August 2026',
    status: 'shipped',
    title: 'Offline-First & Installable App',
    notes: [
      'TimhirtHub can now be installed on desktop and mobile like a native app.',
      'Attendance can be marked while offline and syncs automatically once reconnected.',
      'Recently viewed grades, reports, and dashboards stay available without a connection.',
    ],
  },
  {
    version: 'v0.5',
    date: 'August 2026',
    status: 'shipped',
    title: 'SMS Notifications',
    notes: [
      'Schools can now send SMS notifications to parents and staff.',
      'Added opt-in preference controls on user profiles.',
    ],
  },
  {
    version: 'v0.4',
    date: 'August 2026',
    status: 'shipped',
    title: 'Multi-Language Support',
    notes: [
      'TimhirtHub is now available in English, Amharic, and Afaan Oromo.',
      'Language can be switched instantly from any account\u2019s profile menu.',
    ],
  },
  {
    version: 'v0.3',
    date: 'July 2026',
    status: 'shipped',
    title: 'Document Generation & Printing',
    notes: [
      'Added PDF generation for report cards, mark sheets, ID cards, and attendance sheets.',
      'Fixed a pagination bug where attendance sheets over 24 students silently dropped extra rows.',
    ],
  },
  {
    version: 'v0.2',
    date: 'July 2026',
    status: 'shipped',
    title: 'Grading Completeness',
    notes: [
      'Introduced standard competition class ranking (ties share a rank; the next rank skips accordingly).',
    ],
  },
  {
    version: 'v0.1',
    date: 'July 2026',
    status: 'shipped',
    title: 'Initial Release',
    notes: ['TimhirtHub launched — academic, attendance, fee, and communication management for schools.'],
  },
];

const STATUS_STYLES = {
  shipped: { icon: CheckCircle2, label: 'Shipped', className: 'text-green-600 bg-green-50' },
  'in-progress': { icon: Clock, label: 'In progress', className: 'text-amber-600 bg-amber-50' },
};

export default function ReleaseNotesPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="bg-primary-700 text-white">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <Sparkles className="w-10 h-10 mx-auto mb-4 text-primary-200" />
          <h1 className="text-3xl font-bold">Release Notes</h1>
          <p className="mt-2 text-primary-100">What\u2019s new in TimhirtHub, one release at a time.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <ol className="relative border-l-2 border-gray-200 ml-3 space-y-10">
          {RELEASES.map((r) => {
            const status = STATUS_STYLES[r.status];
            return (
              <li key={r.version} className="ml-6">
                <span className="absolute -left-[9px] w-4 h-4 rounded-full bg-primary-600 ring-4 ring-gray-50" />
                <div className="card card-body">
                  <div className="flex items-center flex-wrap gap-3 mb-2">
                    <span className="text-sm font-mono font-semibold text-primary-700">{r.version}</span>
                    <span className="text-xs text-gray-400">{r.date}</span>
                    <span className={`ml-auto inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${status.className}`}>
                      <status.icon className="w-3.5 h-3.5" /> {status.label}
                    </span>
                  </div>
                  <h2 className="font-semibold text-gray-900 mb-2">{r.title}</h2>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                    {r.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
