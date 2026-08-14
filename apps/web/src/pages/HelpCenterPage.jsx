import { useState } from 'react';
import { Search, LifeBuoy, Mail, MessageCircle, ChevronDown, BookOpen, Wifi, CreditCard, ShieldCheck, Users } from 'lucide-react';

const CATEGORIES = [
  {
    icon: BookOpen,
    title: 'Getting Started',
    faqs: [
      { q: 'How do I add students, teachers, and staff to my school?', a: 'Admins can add users individually from Users → Add User, or import a whole class at once with Users → Bulk Import Students (CSV).' },
      { q: 'How are roles and permissions handled?', a: 'Every account has one role — Super Admin, Admin, Teacher, Staff, Student, or Parent — which controls what they can see across grading, attendance, fees, and messaging.' },
      { q: 'Can I use TimhirtHub in Amharic or Afaan Oromo?', a: 'Yes. Switch languages from your profile menu at any time — English, Amharic, and Afaan Oromo are fully supported across the app.' },
    ],
  },
  {
    icon: Users,
    title: 'Grading & Academics',
    faqs: [
      { q: 'How are class rankings calculated?', a: 'TimhirtHub uses standard competition ranking (1224 style) — students with tied averages share the same rank, and the next rank skips accordingly.' },
      { q: 'Can I generate report cards and mark sheets as PDFs?', a: 'Yes — report cards, mark sheets, and attendance sheets can all be generated and printed directly from the Grades and Attendance pages.' },
    ],
  },
  {
    icon: Wifi,
    title: 'Offline & Installing the App',
    faqs: [
      { q: 'Does TimhirtHub work without an internet connection?', a: 'TimhirtHub is a Progressive Web App. Once loaded, the app shell and your most recently viewed grades/reports stay available offline. Attendance marked while offline is queued automatically and synced the moment you reconnect.' },
      { q: 'How do I install TimhirtHub on my phone or desktop?', a: 'Open TimhirtHub in Chrome or Edge and choose "Install app" from the browser menu, or "Add to Home Screen" on mobile.' },
    ],
  },
  {
    icon: CreditCard,
    title: 'Fees & Billing',
    faqs: [
      { q: 'What payment statuses exist for an invoice?', a: 'Invoices move through Pending → Partial → Paid as payments are recorded, with support for discounts and overpayment protection.' },
      { q: 'How do I upgrade or manage my school\u2019s subscription?', a: 'Go to Settings → Billing to view your current plan, compare tiers, or open the secure billing portal to update payment details.' },
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Account & Data',
    faqs: [
      { q: 'Can parents see other students\u2019 information?', a: 'No. Parents only see data for children linked to their account, and all access is scoped to your school — no cross-school visibility exists.' },
      { q: 'How do I reset a forgotten password?', a: 'Use "Forgot password" on the login screen. For security, we never confirm whether an email exists in our system.' },
    ],
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-gray-900">{q}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="pb-4 text-sm text-gray-600 leading-relaxed">{a}</p>}
    </div>
  );
}

export default function HelpCenterPage() {
  const [query, setQuery] = useState('');

  const filtered = CATEGORIES.map((cat) => ({
    ...cat,
    faqs: cat.faqs.filter(
      (f) =>
        f.q.toLowerCase().includes(query.toLowerCase()) ||
        f.a.toLowerCase().includes(query.toLowerCase()),
    ),
  })).filter((cat) => cat.faqs.length > 0);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="bg-primary-700 text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <LifeBuoy className="w-10 h-10 mx-auto mb-4 text-primary-200" />
          <h1 className="text-3xl font-bold">How can we help?</h1>
          <p className="mt-2 text-primary-100">Search the TimhirtHub Help Center or browse by topic below.</p>
          <div className="mt-6 relative max-w-xl mx-auto">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for answers…"
              className="w-full rounded-xl pl-11 pr-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 grid gap-6">
        {(query ? filtered : CATEGORIES).map((cat) => (
          <section key={cat.title} className="card">
            <div className="card-header">
              <div className="flex items-center gap-3">
                <cat.icon className="w-5 h-5 text-primary-600" />
                <h2 className="font-semibold text-gray-900">{cat.title}</h2>
              </div>
            </div>
            <div className="card-body pt-0">
              {cat.faqs.map((f) => (
                <FaqItem key={f.q} {...f} />
              ))}
            </div>
          </section>
        ))}
        {query && filtered.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-12">No results for “{query}”. Try a different search or contact support below.</p>
        )}

        <section className="card card-body flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-900">Still stuck?</h3>
            <p className="text-sm text-gray-600">Our support team typically replies within one business day.</p>
          </div>
          <div className="flex gap-3">
            <a href="mailto:support@timhirthub.com" className="btn-secondary">
              <Mail className="w-4 h-4" /> Email support
            </a>
            <a href="/community" className="btn-primary">
              <MessageCircle className="w-4 h-4" /> Ask the community
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
