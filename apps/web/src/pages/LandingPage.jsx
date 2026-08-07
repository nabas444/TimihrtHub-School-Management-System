import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  CalendarCheck,
  DollarSign,
  MessageSquare,
  BookOpen,
  Sparkles,
  Globe,
  CloudOff,
  ChevronDown,
  Menu,
  X,
  Check,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────
// Content — grounded in the actual product surface (see /services, /pricing)
// ─────────────────────────────────────────────────────────────────────────

const SERVICES = [
  {
    icon: CalendarCheck,
    title: "Attendance & timetable",
    description:
      "Mark attendance in seconds and build conflict-free class timetables that update everywhere at once.",
  },
  {
    icon: GraduationCap,
    title: "Grading & report cards",
    description:
      "Automatic GPA, class rankings, and printable report cards — accurate for a 5-student class or a 500-student campus.",
  },
  {
    icon: DollarSign,
    title: "Fees & billing",
    description:
      "Invoicing, partial payments, and receipts, with a live view of what's collected versus what's still outstanding.",
  },
  {
    icon: MessageSquare,
    title: "Family communication",
    description:
      "Announcements, direct messaging, and SMS alerts that reach parents even without a smartphone.",
  },
  {
    icon: BookOpen,
    title: "Library",
    description:
      "Catalogue every title, track issues and returns, and calculate overdue fines without a spreadsheet.",
  },
  {
    icon: Sparkles,
    title: "AI insights",
    description:
      "Flag at-risk students early and summarize performance trends for a class, term, or grade level.",
  },
  {
    icon: Globe,
    title: "Multi-language",
    description:
      "A full interface in English, Amharic, and Afaan Oromo, so every parent can read what's sent home.",
  },
  {
    icon: CloudOff,
    title: "Works offline",
    description:
      "Mark attendance with no signal — TimhirtHub installs like an app and syncs the moment you're back online.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Set up your school",
    description:
      "Import your roster, configure terms and grade levels, and invite your administrative team.",
  },
  {
    number: "02",
    title: "Invite your team",
    description:
      "Teachers, parents, students, and finance staff each get a role-appropriate view — nothing to explain twice.",
  },
  {
    number: "03",
    title: "Run every day",
    description:
      "Attendance, grades, fees, and messages flow through one system, synced across every device automatically.",
  },
];

const PLANS = [
  {
    id: "FREE",
    name: "Free",
    price: "$0",
    cadence: "/month",
    limit: "Up to 50 students",
    features: ["Basic attendance", "Grade tracking", "2 admin users"],
    cta: "Start free",
  },
  {
    id: "BASIC",
    name: "Basic",
    price: "$29",
    cadence: "/month",
    limit: "Up to 200 students",
    features: [
      "Everything in Free",
      "Parent portal",
      "Chat system",
      "File uploads",
      "5 admin users",
    ],
    cta: "Start free trial",
  },
  {
    id: "STANDARD",
    name: "Standard",
    price: "$79",
    cadence: "/month",
    limit: "Up to 1,000 students",
    features: [
      "Everything in Basic",
      "AI insights",
      "Exam management",
      "Fee management",
      "Library system",
      "Unlimited admins",
    ],
    cta: "Start free trial",
    featured: true,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: "$199",
    cadence: "/month",
    limit: "Unlimited students",
    features: [
      "Everything in Standard",
      "Custom domain",
      "API access",
      "Priority support",
      "Dedicated account manager",
    ],
    cta: "Talk to sales",
  },
];

const FAQS = [
  {
    question: "Does TimhirtHub work without internet?",
    answer:
      "Yes. TimhirtHub installs like an app on any device, and core daily tasks like attendance keep working offline. Everything syncs automatically the moment you're back online.",
  },
  {
    question: "What languages does it support?",
    answer:
      "The full interface is available in English, Amharic, and Afaan Oromo today, with more languages planned.",
  },
  {
    question: "Can we bring over our existing student records?",
    answer:
      "Yes — share a spreadsheet of your current roster and our team will help you import it during setup, at no extra cost.",
  },
  {
    question: "Is there a contract?",
    answer:
      "No. Every plan is month-to-month. Upgrade, downgrade, or cancel anytime from Settings — no calls required.",
  },
  {
    question: "How is our school's data kept separate from others?",
    answer:
      "Every school runs in its own isolated workspace. Role-based access and tenant isolation are enforced on every request, so no user or school can ever see another school's data.",
  },
];

const FOOTER_LINKS = {
  Product: [
    "Attendance & timetable",
    "Grading & report cards",
    "Fees & billing",
    "Communication",
    "Library",
    "AI insights",
  ],
  Solutions: [
    "For administrators",
    "For teachers",
    "For parents & students",
    "For finance teams",
  ],
  Company: ["About", "Security", "Status", "Contact"],
  Resources: ["Help center", "API docs", "Release notes", "Community"],
};

// ─────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const servicesRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (servicesRef.current && !servicesRef.current.contains(event.target)) {
        setServicesOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === "Escape") setServicesOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight text-gray-900">
              TimhirtHub
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            <div className="relative" ref={servicesRef}>
              <button
                type="button"
                onClick={() => setServicesOpen((v) => !v)}
                aria-expanded={servicesOpen}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                Services
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    servicesOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {servicesOpen && (
                <div className="absolute left-1/2 top-full mt-2 w-[560px] -translate-x-1/2 animate-fade-in rounded-2xl border border-gray-100 bg-white p-4 shadow-card-hover">
                  <div className="grid grid-cols-2 gap-1">
                    {SERVICES.map((service) => (
                      <a
                        key={service.title}
                        href="#services"
                        onClick={() => setServicesOpen(false)}
                        className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-primary-50"
                      >
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                          <service.icon className="h-4.5 w-4.5" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-gray-900">
                            {service.title}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-gray-500">
                            {service.description}
                          </span>
                        </span>
                      </a>
                    ))}
                  </div>
                  <div className="mt-2 border-t border-gray-100 pt-3 text-right">
                    <a
                      href="#services"
                      onClick={() => setServicesOpen(false)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700"
                    >
                      View all features
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            <a
              href="#pricing"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              Pricing
            </a>
            <a
              href="#security"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              Security
            </a>
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link to="/login" className="btn btn-ghost">
              Sign in
            </Link>
            <Link to="/register" className="btn-primary">
              Start free trial
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="btn-icon btn-ghost lg:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="animate-slide-in border-t border-gray-100 bg-white px-4 pb-4 pt-2 lg:hidden">
            <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Services
            </p>
            <div className="grid grid-cols-1 gap-0.5">
              {SERVICES.map((service) => (
                <a
                  key={service.title}
                  href="#services"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <service.icon className="h-4 w-4 text-primary-600" />
                  {service.title}
                </a>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
              <a
                href="#pricing"
                className="px-2 py-2 text-sm font-medium text-gray-700"
              >
                Pricing
              </a>
              <Link to="/login" className="btn btn-secondary w-full">
                Sign in
              </Link>
              <Link to="/register" className="btn-primary w-full">
                Start free trial
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-primary-50">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(79,70,229,0.18) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-semibold text-primary-700">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-600" />
              Built for Ethiopian schools
            </div>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Run your entire school —
              <br className="hidden sm:block" />
              even when the internet doesn't.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-gray-600">
              TimhirtHub brings attendance, grading, fees, and family
              communication into one system that installs like an app, works
              offline, and speaks English, Amharic, and Afaan Oromo.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/register" className="btn-primary btn-lg">
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#pricing" className="btn btn-secondary btn-lg">
                See pricing
              </a>
            </div>
            <p className="mt-4 text-xs text-gray-400">
              No credit card required · Free plan available forever
            </p>
          </div>

          {/* Signature visual — a stylized report card, the product's core artifact */}
          <div className="relative">
            <div className="absolute -left-4 -top-4 w-48 rounded-2xl border border-primary-100 bg-white p-4 shadow-card sm:-left-8 sm:-top-8">
              <p className="text-xs font-medium text-gray-400">
                Today's attendance
              </p>
              <p className="mt-1 text-2xl font-extrabold text-gray-900">96%</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full w-[96%] rounded-full bg-primary-600" />
              </div>
            </div>

            <div className="relative ml-auto w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-6 shadow-card-hover">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Abebe Kebede
                  </p>
                  <p className="text-xs text-gray-400">Grade 7A · Term 1</p>
                </div>
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-bold text-primary-700">
                  Rank 2
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { subject: "Mathematics", score: 92, grade: "A" },
                  { subject: "English", score: 85, grade: "A" },
                  { subject: "Biology", score: 78, grade: "B+" },
                ].map((row) => (
                  <div key={row.subject} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs font-medium text-gray-500">
                      {row.subject}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-primary-600"
                        style={{ width: `${row.score}%` }}
                      />
                    </div>
                    <span className="w-7 shrink-0 text-right text-xs font-bold text-gray-900">
                      {row.grade}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                <span className="text-xs font-medium text-gray-500">
                  Overall average
                </span>
                <span className="text-sm font-extrabold text-gray-900">
                  85%
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ────────────────────────────────────────────────── */}
      <section className="border-y border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
            Built for every kind of school
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {[
              "Primary schools",
              "Secondary schools",
              "K-12 academies",
              "Faith-based schools",
              "Boarding schools",
            ].map((label) => (
              <span key={label} className="text-sm font-semibold text-gray-400">
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ───────────────────────────────────────────────────── */}
      <section
        id="services"
        className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Services
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            One system for every part of the school office
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Each module works on its own, or together as a single source of
            truth for administrators, teachers, and families.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service) => (
            <div key={service.title} className="card-hover p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <service.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-bold text-gray-900">
                {service.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Live in an afternoon, not a semester
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className="relative rounded-3xl bg-white p-8 shadow-card"
              >
                <span className="text-sm font-bold text-primary-300">
                  {step.number}
                </span>
                <h3 className="mt-3 text-lg font-bold text-gray-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────── */}
      <section
        id="pricing"
        className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Plans that grow with your school
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Every plan is month-to-month. Start free, upgrade when you need to.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border p-6 ${
                plan.featured
                  ? "border-primary-600 bg-primary-950 text-white shadow-card-hover"
                  : "border-gray-100 bg-white shadow-card"
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-3 py-1 text-xs font-bold text-white">
                  Most popular
                </span>
              )}
              <h3
                className={`text-sm font-bold uppercase tracking-wide ${
                  plan.featured ? "text-primary-200" : "text-gray-500"
                }`}
              >
                {plan.name}
              </h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold">{plan.price}</span>
                <span
                  className={`text-sm ${
                    plan.featured ? "text-primary-200" : "text-gray-400"
                  }`}
                >
                  {plan.cadence}
                </span>
              </div>
              <p
                className={`mt-1 text-xs ${
                  plan.featured ? "text-primary-200" : "text-gray-400"
                }`}
              >
                {plan.limit}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        plan.featured ? "text-primary-300" : "text-primary-600"
                      }`}
                    />
                    <span
                      className={
                        plan.featured ? "text-primary-50" : "text-gray-600"
                      }
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                to="/register"
                className={`mt-8 btn w-full justify-center ${
                  plan.featured
                    ? "bg-white text-primary-900 hover:bg-primary-50"
                    : "btn-secondary"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section id="security" className="bg-gray-50 py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
              Questions
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="mt-12 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.question}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-semibold text-gray-900">
                      {faq.question}
                    </span>
                    {isOpen ? (
                      <Minus className="h-4 w-4 shrink-0 text-primary-600" />
                    ) : (
                      <Plus className="h-4 w-4 shrink-0 text-gray-400" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="animate-fade-in px-6 pb-5">
                      <p className="text-sm leading-6 text-gray-500">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-400">
            <ShieldCheck className="h-4 w-4 text-primary-600" />
            Tenant-isolated by design — your school's data is never visible to
            another school.
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section className="bg-primary-950">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Ready to modernize your school office?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-primary-200">
            Set up your school in an afternoon. No credit card required to
            start.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/register"
              className="btn btn-lg bg-white text-primary-900 hover:bg-primary-50"
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#pricing"
              className="btn btn-lg border border-primary-700 text-white hover:bg-primary-900"
            >
              Compare plans
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="bg-primary-950 text-primary-200">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-6">
            <div className="col-span-2 lg:col-span-2">
              <Link to="/" className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <span className="text-lg font-bold tracking-tight text-white">
                  TimhirtHub
                </span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-6 text-primary-300">
                School management for Ethiopian schools — attendance, grading,
                fees, and family communication in one place.
              </p>
            </div>

            {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
              <div key={heading}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-primary-400">
                  {heading}
                </h4>
                <ul className="mt-4 space-y-3">
                  {links.map((link) => (
                    <li key={link}>
                      <a
                        href="#services"
                        className="text-sm text-primary-200 transition-colors hover:text-white"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col gap-4 border-t border-primary-800 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-primary-400">
              © {new Date().getFullYear()} TimhirtHub. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <a href="#" className="text-xs text-primary-300 hover:text-white">
                Privacy policy
              </a>
              <a href="#" className="text-xs text-primary-300 hover:text-white">
                Terms of service
              </a>
              <div className="flex items-center gap-1 text-xs text-primary-300">
                <Globe className="h-3.5 w-3.5" />
                <span>English</span>
                <span className="text-primary-600">·</span>
                <span>አማርኛ</span>
                <span className="text-primary-600">·</span>
                <span>Afaan Oromoo</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
