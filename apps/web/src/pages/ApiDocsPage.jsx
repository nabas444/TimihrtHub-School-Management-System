import { useState } from 'react';
import { Code2, KeyRound, ChevronRight } from 'lucide-react';

const METHOD_STYLES = {
  GET: 'bg-blue-50 text-blue-700',
  POST: 'bg-green-50 text-green-700',
  PATCH: 'bg-amber-50 text-amber-700',
  DELETE: 'bg-red-50 text-red-700',
};

const MODULES = [
  {
    name: 'Auth',
    base: '/api/v1/auth',
    endpoints: [
      { method: 'POST', path: '/login', desc: 'Authenticate and receive an access + refresh token pair.' },
      { method: 'POST', path: '/refresh', desc: 'Rotate a refresh token for a new access token.' },
      { method: 'POST', path: '/logout', desc: 'Invalidate the current session (or all sessions).' },
      { method: 'POST', path: '/forgot-password', desc: 'Request a password reset email. Never confirms whether the address exists.' },
    ],
  },
  {
    name: 'Users',
    base: '/api/v1/users',
    auth: 'Bearer token required',
    endpoints: [
      { method: 'GET', path: '/me', desc: 'Get the current user\u2019s profile.' },
      { method: 'PATCH', path: '/me', desc: 'Update the current user\u2019s profile.' },
      { method: 'GET', path: '/', desc: 'List users in your school.', role: 'Admin, Super Admin, Teacher' },
      { method: 'POST', path: '/', desc: 'Create a user.', role: 'Admin, Super Admin' },
      { method: 'POST', path: '/bulk-students', desc: 'Bulk-import students from a roster.', role: 'Admin, Super Admin' },
      { method: 'PATCH', path: '/:id/toggle-status', desc: 'Activate or deactivate an account.', role: 'Admin, Super Admin' },
    ],
  },
  {
    name: 'Academics',
    base: '/api/v1/academics',
    endpoints: [
      { method: 'GET', path: '/reports/:studentId', desc: 'Generate a report card, including standard-competition class rank.' },
      { method: 'GET', path: '/results', desc: 'Read-through cached for offline viewing (grades, reports).' },
      { method: 'POST', path: '/grades', desc: 'Record grades for an assignment or exam.', role: 'Teacher, Admin' },
    ],
  },
  {
    name: 'Attendance',
    base: '/api/v1/attendance',
    endpoints: [
      { method: 'POST', path: '/mark', desc: 'Mark attendance for a class. Queued automatically on the client when offline.', role: 'Teacher, Admin' },
      { method: 'GET', path: '/class/:classId', desc: 'Get present / absent / late / unmarked summary counts for a class.' },
    ],
  },
  {
    name: 'Behaviour',
    base: '/api/v1/behaviour',
    endpoints: [
      { method: 'GET', path: '/student/:studentId/summary', desc: 'Behaviour summary — visible to staff, the student themself, or a linked parent only.' },
      { method: 'PATCH', path: '/:id/resolve', desc: 'Mark a behaviour record resolved.', role: 'Staff' },
    ],
  },
  {
    name: 'Library',
    base: '/api/v1/library',
    endpoints: [
      { method: 'POST', path: '/:bookId/issue', desc: 'Issue a book to a student in your school.', role: 'Staff' },
      { method: 'PATCH', path: '/:bookId/return/:issueId', desc: 'Process a book return and calculate any overdue fine.', role: 'Staff' },
    ],
  },
  {
    name: 'Fees',
    base: '/api/v1/fees',
    endpoints: [
      { method: 'POST', path: '/invoices/:id/payments', desc: 'Record a payment. Handles Pending → Partial → Paid transitions and discounts.', role: 'Admin' },
    ],
  },
  {
    name: 'Billing (subscription)',
    base: '/api/v1/billing',
    endpoints: [
      { method: 'GET', path: '/plans', desc: 'List available subscription plans.' },
      { method: 'POST', path: '/checkout', desc: 'Create a Stripe checkout session for a plan upgrade.', role: 'Admin, Super Admin' },
      { method: 'POST', path: '/portal', desc: 'Open the Stripe billing portal.', role: 'Admin, Super Admin' },
    ],
  },
  {
    name: 'Files',
    base: '/api/v1/files',
    endpoints: [
      { method: 'POST', path: '/upload', desc: 'Upload a file (max 25MB; images, PDFs, Office docs, audio/video).' },
      { method: 'GET', path: '/', desc: 'List files visible to you — students/parents see public or class-scoped files only.' },
      { method: 'DELETE', path: '/:id', desc: 'Delete a file. Requires ownership or Admin.' },
    ],
  },
  {
    name: 'Notifications & SMS',
    base: '/api/v1/notifications',
    endpoints: [
      { method: 'POST', path: '/sms/test', desc: 'Send a test SMS via Africa\u2019s Talking.', role: 'Admin' },
    ],
  },
];

export default function ApiDocsPage() {
  const [active, setActive] = useState(MODULES[0].name);
  const activeModule = MODULES.find((m) => m.name === active);

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col md:flex-row">
      <aside className="md:w-64 shrink-0 bg-white border-r border-gray-100 md:min-h-screen p-6">
        <div className="flex items-center gap-2 mb-6">
          <Code2 className="w-5 h-5 text-primary-600" />
          <h1 className="font-bold text-gray-900">API Reference</h1>
        </div>
        <nav className="space-y-1">
          {MODULES.map((m) => (
            <button
              key={m.name}
              onClick={() => setActive(m.name)}
              className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                active === m.name ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m.name}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-8">
          <KeyRound className="w-4 h-4" />
          All authenticated endpoints require <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">Authorization: Bearer &lt;access_token&gt;</code>. Requests are scoped to the caller\u2019s school; cross-school access is never permitted.
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-1">{activeModule.name}</h2>
        <p className="text-sm text-gray-500 mb-6 font-mono">{activeModule.base}</p>

        <div className="card divide-y divide-gray-100">
          {activeModule.endpoints.map((e) => (
            <div key={e.method + e.path} className="p-5">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-1 rounded-md ${METHOD_STYLES[e.method]}`}>{e.method}</span>
                <code className="text-sm font-mono text-gray-900">{activeModule.base}{e.path}</code>
                {e.role && (
                  <span className="text-xs text-gray-500 ml-auto">Requires: {e.role}</span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-2">{e.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
