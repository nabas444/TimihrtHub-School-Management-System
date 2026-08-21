import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logoImg from "../assets/logo.png";
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
  LifeBuoy,
  FileText,
  Rss,
  Users,
  UserCog,
  Heart,
  CreditCard,
  CheckCircle2,
  Layers,
  Volume2,
  VolumeX,
  TrendingUp,
  Activity,
  BarChart2,
  Bell,
  Lock,
  Download,
  Clock,
  Award,
  FileSpreadsheet,
  Search,
  MapPin,
  Phone,
  Mail,
  Send,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";

// ─────────────────────────────────────────────────────────────────────────
// Video / Media Placeholders
// ─────────────────────────────────────────────────────────────────────────

// TODO(user): replace with provided hero background video URL
const HERO_VIDEO_URL = "";

// TODO(user): replace with provided closing-section image or video URL
const CLOSING_MEDIA_URL = "";

// ─────────────────────────────────────────────────────────────────────────
// Contact & Social Information
// ─────────────────────────────────────────────────────────────────────────

// Address for school contact info
const FOOTER_ADDRESS = "Addis Ababa, Kolfe Keranio, Woreda 02";

// Mobile phone contact
const FOOTER_MOBILE = "+251 96 608 0363";

// Official email contact
const FOOTER_EMAIL = "info.timhirthub.school@TimhirtHub.edu.et";

// Social channels
const FOOTER_WHATSAPP_URL = "https://wa.me/qr/5JPXZ2VU3OX4D1";
const FOOTER_TELEGRAM_URL = "https://t.me/nabas444";

function WhatsAppIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.48-8.413Z" />
    </svg>
  );
}

function TelegramIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0Zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.832.939Z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Content — grounded in the actual product surface (see /services, /pricing)
// ─────────────────────────────────────────────────────────────────────────

const SERVICE_CATEGORIES = [
  {
    category: "Academics",
    services: [
      {
        icon: GraduationCap,
        title: "Grading & report cards",
        description:
          "Automatic GPA, class rankings, and printable report cards — accurate for a 5-student class or a 500-student campus.",
      },
      {
        icon: Sparkles,
        title: "AI insights",
        description:
          "Flag at-risk students early and summarize performance trends for a class, term, or grade level.",
      },
    ],
  },
  {
    category: "Daily Operations",
    services: [
      {
        icon: CalendarCheck,
        title: "Attendance & timetable",
        description:
          "Mark attendance in seconds and build conflict-free class timetables that update everywhere at once.",
      },
      {
        icon: DollarSign,
        title: "Fees & billing",
        description:
          "Invoicing, partial payments, and receipts, with a live view of what's collected versus what's still outstanding.",
      },
      {
        icon: BookOpen,
        title: "Library",
        description:
          "Catalogue every title, track issues and returns, and calculate overdue fines without a spreadsheet.",
      },
    ],
  },
  {
    category: "Family & Access",
    services: [
      {
        icon: MessageSquare,
        title: "Family communication",
        description:
          "Announcements, direct messaging, and SMS alerts that reach parents even without a smartphone.",
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
    ],
  },
];

const SERVICES = SERVICE_CATEGORIES.flatMap((c) => c.services);

const ROLE_TABS = [
  {
    id: "admin",
    label: "School Leaders & Admins",
    shortRole: "Leadership",
    icon: UserCog,
    badge: "Institutional Command Center",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    themeColor: "from-blue-600 to-indigo-700",
    accentColor: "text-blue-600",
    title: "Enterprise governance, compliance, and campus intelligence",
    intro:
      "Empower principals and administrative directors with live master rosters, national curriculum configurations, staff HR oversight, and automated Ministry of Education compliance reporting.",
    kpis: [
      { label: "Campus Attendance", val: "97.4%", trend: "+2.1% this term" },
      { label: "Enrolled Roster", val: "1,480", trend: "100% Verified" },
      { label: "Fee Realization", val: "94.8%", trend: "On Target" },
    ],
    highlights: [
      "Master directory of all students, teachers, and staff with full emergency contacts",
      "Automated term scheduling, subject assignments, and grade-level allocations",
      "Campus-wide live attendance monitor with instant absence escalation",
      "One-click generation of official Ministry of Education compliance rosters",
      "Enterprise multi-tier permissions (RBAC) with tamper-evident audit logging",
    ],
    features: [
      "Student Directory",
      "Term & Class Setup",
      "Staff HR & Leave",
      "Disciplinary Log",
      "System Audit Trail",
      "Annual Plan Approval",
    ],
    ctaText: "Explore Administrative Tools",
    ctaLink: "/register",
  },
  {
    id: "teacher",
    label: "Teachers & Educators",
    shortRole: "Educators",
    icon: BookOpen,
    badge: "Classroom & Grading Suite",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    themeColor: "from-emerald-600 to-teal-700",
    accentColor: "text-emerald-600",
    title: "15-second roll call, Continuous Assessment, and lesson planning",
    intro:
      "Save 5+ hours weekly with intuitive attendance marking, automated continuous assessment scoring (CA 60 / Exam 40), and collaborative annual schemes of work.",
    kpis: [
      { label: "Roll Call Speed", val: "< 15s", trend: "Per classroom" },
      { label: "Marking Computation", val: "Auto", trend: "CA 60 + Exam 40" },
      { label: "Offline Sync", val: "Instant", trend: "Zero data loss" },
    ],
    highlights: [
      "Rapid touch/click attendance marking with one-tap batch submissions",
      "Continuous Assessment (CA 60) and Final Exam (40) mark sheets with auto-GPA",
      "Integrated Annual Scheme of Work spreadsheet editor with PDF export",
      "Direct homework assignments with digital submissions and rubric grading",
      "Two-way parent messaging with built-in Amharic & Afaan Oromo support",
    ],
    features: [
      "Subject Score Entry",
      "Attendance Sheet",
      "Annual Plan Editor",
      "Assignment Manager",
      "Parent Messaging",
      "Paperless Leave",
    ],
    ctaText: "Explore Teacher Portal",
    ctaLink: "/register",
  },
  {
    id: "parent",
    label: "Parents & Guardians",
    shortRole: "Families",
    icon: Heart,
    badge: "Family Transparency Portal",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
    themeColor: "from-rose-600 to-pink-700",
    accentColor: "text-rose-600",
    title: "Real-time visibility into your child's attendance and academic growth",
    intro:
      "Give families total clarity with instant arrival alerts, digital term report cards with subject rankings, and direct fee receipts in English, Amharic, or Afaan Oromo.",
    kpis: [
      { label: "Arrival Alert", val: "Real-time", trend: "SMS & Push" },
      { label: "Fee Receipts", val: "Instant", trend: "Telebirr / CBE" },
      { label: "Languages", val: "3", trend: "Amharic / Oromo / Eng" },
    ],
    highlights: [
      "Real-time SMS & push alerts the moment your student is marked present or late",
      "Official term report cards with subject scores, GPA, and teacher remarks",
      "Instant tuition payment invoices with verified Telebirr / CBE digital receipts",
      "Multi-student switcher to view all children across grades from a single account",
      "Direct two-way messaging channel with homeroom and subject teachers",
    ],
    features: [
      "Multi-Child Switcher",
      "Attendance Notices",
      "Digital Fee Receipts",
      "Report Card PDF",
      "Teacher Chat",
      "School Announcements",
    ],
    ctaText: "Explore Parent Portal",
    ctaLink: "/register",
  },
  {
    id: "student",
    label: "Students & Learners",
    shortRole: "Students",
    icon: GraduationCap,
    badge: "Learner Hub & AI Study Coach",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    themeColor: "from-purple-600 to-indigo-700",
    accentColor: "text-purple-600",
    title: "Interactive schedules, assignment dropboxes, and academic growth",
    intro:
      "Everything students need to thrive: live period timetables, digital homework submissions, extracurricular club directories, and AI-powered revision support.",
    kpis: [
      { label: "Live Timetable", val: "Active", trend: "Periods & Rooms" },
      { label: "Homework Hub", val: "24/7", trend: "Online Dropbox" },
      { label: "AI Study Coach", val: "Ready", trend: "Curriculum-aligned" },
    ],
    highlights: [
      "Personalized daily timetable showing class periods, rooms, and teachers",
      "Online homework submission with live countdown timers and teacher feedback",
      "Continuous assessment marks tracker with live GPA and subject trends",
      "School club directory with meeting schedules, events, and membership",
      "AI-guided revision coach for personalized exam preparation and homework help",
    ],
    features: [
      "Live Timetable",
      "Homework Dropbox",
      "Exam Results",
      "Class Chat",
      "Club Hub",
      "AI Tutor",
    ],
    ctaText: "Explore Student Hub",
    ctaLink: "/register",
  },
  {
    id: "finance",
    label: "Finance & Bursar",
    shortRole: "Finance",
    icon: DollarSign,
    badge: "Tuition & Financial Operations",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    themeColor: "from-amber-600 to-yellow-600",
    accentColor: "text-amber-600",
    title: "Automated billing, verified digital receipts, and audit reporting",
    intro:
      "Eliminate manual ledger math. Configure custom fee categories, monitor collected versus outstanding balances by class, and issue verified digital receipts.",
    kpis: [
      { label: "Collection Rate", val: "94.8%", trend: "+8.2% vs last term" },
      { label: "Reconciliation", val: "Automated", trend: "Zero manual math" },
      { label: "Receipt Ledger", val: "100%", trend: "Audited & Exportable" },
    ],
    highlights: [
      "Multi-category fee structures (Tuition, Transport, Uniforms, Lab fees)",
      "Automated digital invoice generation with automated parent reminder notices",
      "Direct integration with Telebirr, CBE, and bank deposit reconciliation",
      "Live financial dashboard showing real-time revenue collection targets",
      "One-click export of certified ledger spreadsheets for school board audits",
    ],
    features: [
      "Fee Collection",
      "Invoice Generator",
      "Receipt Ledger",
      "Overdue Alerts",
      "Audit CSV Export",
      "Multi-Category Fees",
    ],
    ctaText: "Explore Finance Suite",
    ctaLink: "/register",
  },
];

const RESOURCES = [
  {
    icon: LifeBuoy,
    title: "Help Center",
    description:
      "Guides, step-by-step tutorials, and answers to help your school make the most of TimhirtHub.",
    to: "/help",
  },
  {
    icon: FileText,
    title: "API Documentation",
    description:
      "Integrate TimhirtHub with existing school databases, biometric attendance devices, and custom tools.",
    to: "/docs/api",
  },
  {
    icon: Rss,
    title: "Release Notes",
    description:
      "Explore recent feature releases, offline sync enhancements, and platform performance updates.",
    to: "/release-notes",
  },
  {
    icon: Users,
    title: "Community",
    description:
      "Connect with Ethiopian educators and administrators, share best practices, and request features.",
    to: "/community",
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
    "School Leaders & Admins",
    "Teachers & Educators",
    "Parents & Guardians",
    "Students & Learners",
    "Finance & Bursar",
  ],
  Company: ["About", "Security", "Status", "Contact"],
  Resources: ["Help center", "API docs", "Release notes", "Community", "FAQ"],
};

const ROLE_LINK_MAP = {
  "School Leaders & Admins": "admin",
  "Teachers & Educators": "teacher",
  "Parents & Guardians": "parent",
  "Students & Learners": "student",
  "Finance & Bursar": "finance",
};

const RESOURCE_LINKS = {
  "Help center": "/help",
  "API docs": "/docs/api",
  "Release notes": "/release-notes",
  Community: "/community",
  FAQ: "#footer-faq",
};

// ─────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const {
    isAuthenticated,
    isAdmin,
    isTeacher,
    isStudent,
    isParent,
    isFinance,
  } = useAuthStore();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [activeRoleTab, setActiveRoleTab] = useState("admin");
  const [openFaq, setOpenFaq] = useState(0);
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [faqSearch, setFaqSearch] = useState("");
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [activeModalRole, setActiveModalRole] = useState("admin");

  const [servicesVideoVisible, setServicesVideoVisible] = useState(false);
  const [isHeroMuted, setIsHeroMuted] = useState(true);
  const [isHeroVideoPlaying, setIsHeroVideoPlaying] = useState(false);
  const [isServicesMuted, setIsServicesMuted] = useState(true);

  const servicesRef = useRef(null);
  const resourcesRef = useRef(null);
  const servicesSectionRef = useRef(null);
  const heroIframeRef = useRef(null);
  const servicesIframeRef = useRef(null);

  const toggleHeroAudio = () => {
    if (heroIframeRef.current?.contentWindow) {
      const nextMuted = !isHeroMuted;
      const func = nextMuted ? "mute" : "unMute";
      heroIframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func, args: [] }),
        "*"
      );
      setIsHeroMuted(nextMuted);
    }
  };

  const toggleServicesAudio = () => {
    if (servicesIframeRef.current?.contentWindow) {
      const nextMuted = !isServicesMuted;
      const func = nextMuted ? "mute" : "unMute";
      servicesIframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func, args: [] }),
        "*"
      );
      setIsServicesMuted(nextMuted);
    }
  };

  const getDashboardPath = () => {
    if (isAdmin()) return "/dashboard";
    if (isTeacher()) return "/dashboard";
    if (isFinance()) return "/dashboard";
    if (isStudent()) return "/dashboard";
    if (isParent()) return "/dashboard";
    return "/dashboard";
  };

  const getServiceRoute = (service) => {
    if (!isAuthenticated) return "/";
    if (service.title.includes("Attendance")) return "/attendance";
    if (service.title.includes("Grading")) return "/grades";
    if (service.title.includes("Fees")) return "/fees";
    if (service.title.includes("Family")) return "/chat";
    if (service.title.includes("Library")) return "/library";
    if (service.title.includes("AI")) return "/ai";
    return getDashboardPath();
  };

  const getPrimaryAction = () => {
    if (isAuthenticated) {
      return {
        to: getDashboardPath(),
        label: "Go to dashboard",
      };
    }
    return {
      to: "/register",
      label: "Start free trial",
    };
  };

  const getSecondaryAction = () => {
    if (isAuthenticated) {
      return {
        to: "/billing",
        label: "Upgrade",
      };
    }
    return {
      to: "#pricing",
      label: "See pricing",
    };
  };

  const primaryAction = getPrimaryAction();
  const secondaryAction = getSecondaryAction();

  const currentRole =
    ROLE_TABS.find((r) => r.id === activeRoleTab) || ROLE_TABS[0];
  const currentModalRole =
    ROLE_TABS.find((r) => r.id === activeModalRole) || ROLE_TABS[0];

  const filteredFaqs = FAQS.filter(
    (f) =>
      f.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.answer.toLowerCase().includes(faqSearch.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        servicesRef.current &&
        !servicesRef.current.contains(event.target)
      ) {
        setServicesOpen(false);
      }
      if (
        resourcesRef.current &&
        !resourcesRef.current.contains(event.target)
      ) {
        setResourcesOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === "Escape") {
        setServicesOpen(false);
        setResourcesOpen(false);
        setFaqModalOpen(false);
        setRoleModalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    // Scroll reveal observer
    const revealElements = document.querySelectorAll(".reveal-section");
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100", "translate-y-0");
            entry.target.classList.remove("opacity-0", "translate-y-6");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealElements.forEach((el) => revealObserver.observe(el));

    // Services video trigger observer (fires once when ~35% visible)
    let videoObserver;
    if (servicesSectionRef.current) {
      videoObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setServicesVideoVisible(true);
            videoObserver.disconnect();
          }
        },
        { threshold: 0.35 }
      );
      videoObserver.observe(servicesSectionRef.current);
    }

    // YouTube hero playback message listener
    const handleYouTubeMessage = (e) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.event === "onStateChange" || data?.info?.playerState !== undefined) {
          const state = data?.info?.playerState ?? data?.info;
          if (state === 1) {
            setIsHeroVideoPlaying(true);
          } else if (state === 2 || state === 0) {
            setIsHeroVideoPlaying(false);
          }
        }
      } catch {
        // non-JSON message
      }
    };
    window.addEventListener("message", handleYouTubeMessage);

    // Fallback: If video starts without postMessage callback within 3.5s
    const heroFallbackTimer = setTimeout(() => {
      setIsHeroVideoPlaying(true);
    }, 3500);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("message", handleYouTubeMessage);
      clearTimeout(heroFallbackTimer);
      revealObserver.disconnect();
      if (videoObserver) videoObserver.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center shrink-0">
            <img
              src={logoImg}
              alt="TimhirtHub"
              className="h-12 sm:h-14 w-auto max-h-16 object-contain transition-transform hover:scale-105"
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {/* 1. Categorized Services Mega-Menu */}
            <div className="relative" ref={servicesRef}>
              <button
                type="button"
                onClick={() => {
                  setServicesOpen((v) => !v);
                  setResourcesOpen(false);
                }}
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
                <div className="absolute left-1/2 top-full mt-2 w-[740px] -translate-x-1/2 animate-fade-in rounded-2xl border border-gray-100 bg-white p-6 shadow-card-hover">
                  <div className="grid grid-cols-3 gap-6">
                    {SERVICE_CATEGORIES.map((cat) => (
                      <div key={cat.category} className="space-y-2">
                        <p className="px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                          {cat.category}
                        </p>
                        <div className="space-y-1">
                          {cat.services.map((service) => (
                            <Link
                              key={service.title}
                              to={
                                isAuthenticated
                                  ? getServiceRoute(service)
                                  : "#services"
                              }
                              onClick={() => setServicesOpen(false)}
                              className="group flex items-start gap-2.5 rounded-xl p-2.5 transition-colors hover:bg-primary-50"
                            >
                              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                                <service.icon className="h-4 w-4" />
                              </span>
                              <span>
                                <span className="block text-xs font-bold text-gray-900 group-hover:text-primary-700">
                                  {service.title}
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-snug text-gray-500 line-clamp-2">
                                  {service.description}
                                </span>
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 border-t border-gray-100 pt-3 flex items-center justify-between text-xs">
                    <span className="text-gray-400">
                      All modules work offline & sync automatically
                    </span>
                    <a
                      href="#services"
                      onClick={() => setServicesOpen(false)}
                      className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-700"
                    >
                      View all features
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Resources Dropdown */}
            <div className="relative" ref={resourcesRef}>
              <button
                type="button"
                onClick={() => {
                  setResourcesOpen((v) => !v);
                  setServicesOpen(false);
                }}
                aria-expanded={resourcesOpen}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                Resources
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    resourcesOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {resourcesOpen && (
                <div className="absolute left-1/2 top-full mt-2 w-[340px] -translate-x-1/2 animate-fade-in rounded-2xl border border-gray-100 bg-white p-3 shadow-card-hover">
                  <div className="space-y-1">
                    {RESOURCES.map((res) => (
                      <Link
                        key={res.title}
                        to={res.to}
                        onClick={() => setResourcesOpen(false)}
                        className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-primary-50"
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                          <res.icon className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="block text-xs font-bold text-gray-900 group-hover:text-primary-700">
                            {res.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">
                            {res.description}
                          </span>
                        </div>
                      </Link>
                    ))}
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
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {isAuthenticated ? (
              <>
                <Link to={primaryAction.to} className="btn-primary">
                  {primaryAction.label}
                </Link>
                <Link to={secondaryAction.to} className="btn btn-ghost">
                  {secondaryAction.label}
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost">
                  Sign in
                </Link>
                <Link to="/register" className="btn-primary">
                  Start free trial
                </Link>
              </>
            )}
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
          <div className="animate-slide-in border-t border-gray-100 bg-white px-4 pb-6 pt-3 lg:hidden max-h-[85vh] overflow-y-auto">
            {SERVICE_CATEGORIES.map((cat) => (
              <div key={cat.category} className="mb-4">
                <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {cat.category}
                </p>
                <div className="grid grid-cols-1 gap-1">
                  {cat.services.map((service) => (
                    <Link
                      key={service.title}
                      to={getServiceRoute(service)}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <service.icon className="h-4 w-4 text-primary-600" />
                      <span className="font-medium">{service.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            <div className="mb-4 border-t border-gray-100 pt-3">
              <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Resources
              </p>
              <div className="grid grid-cols-1 gap-1">
                {RESOURCES.map((res) => (
                  <Link
                    key={res.title}
                    to={res.to}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <res.icon className="h-4 w-4 text-primary-600" />
                    <span className="font-medium">{res.title}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
              <a
                href="#pricing"
                onClick={() => setMobileOpen(false)}
                className="px-2 py-2 text-sm font-medium text-gray-700"
              >
                Pricing
              </a>
              {isAuthenticated ? (
                <>
                  <Link to={primaryAction.to} className="btn-primary w-full">
                    {primaryAction.label}
                  </Link>
                  <Link
                    to={secondaryAction.to}
                    className="btn btn-secondary w-full"
                  >
                    {secondaryAction.label}
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn btn-secondary w-full">
                    Sign in
                  </Link>
                  <Link to="/register" className="btn-primary w-full">
                    Start free trial
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 min-h-[600px] flex items-center">
        {/* Animated Royal Blue & Radiant White/Cyan Ambient Canvas Layer */}
        <div
          className={`absolute inset-0 hero-animated-bg overflow-hidden pointer-events-none transition-all duration-1000 ease-in-out ${
            isHeroVideoPlaying
              ? "opacity-35 scale-105"
              : "opacity-100 scale-100"
          }`}
        >
          {/* Drifting Floating Cyan Glowing Orb */}
          <div
            className="absolute -top-24 -left-24 w-[480px] h-[480px] rounded-full bg-cyan-400/25 blur-3xl pointer-events-none"
            style={{ animation: "orbFloatA 10s ease-in-out infinite" }}
          />

          {/* Drifting Floating White/Sky Glowing Orb */}
          <div
            className="absolute -bottom-28 right-1/4 w-[520px] h-[520px] rounded-full bg-blue-300/20 blur-3xl pointer-events-none"
            style={{ animation: "orbFloatB 13s ease-in-out infinite" }}
          />

          {/* Diagonal Glass Light Shimmer Band */}
          <div
            className="absolute inset-y-0 w-48 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none"
            style={{ animation: "shimmerWave 8s ease-in-out infinite" }}
          />
        </div>

        {/* Background YouTube video layer - Natural 16:9 unzoomed framing */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-0">
          <iframe
            ref={heroIframeRef}
            src="https://www.youtube.com/embed/GWsBXpZhCxA?autoplay=1&mute=1&loop=1&playlist=GWsBXpZhCxA&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&playsinline=1&enablejsapi=1"
            title="TimhirtHub Hero Background"
            allow="autoplay; encrypted-media"
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] min-w-[177.77vh] h-[56.25vw] min-h-full pointer-events-none transition-opacity duration-1000 ease-in-out ${
              isHeroVideoPlaying ? "opacity-100" : "opacity-0"
            }`}
            tabIndex={-1}
          />
        </div>

        {/* Deep Left-to-Right Scrim Gradient for 100% Typography Contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent pointer-events-none z-[1]" />

        {/* Floating Sound Toggle Button for Hero */}
        <div className="absolute bottom-6 right-6 z-20">
          <button
            type="button"
            onClick={toggleHeroAudio}
            className="group flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold text-white bg-black/60 hover:bg-black/80 border border-white/30 backdrop-blur-md transition-all shadow-2xl hover:scale-105"
            aria-label={isHeroMuted ? "Unmute video audio" : "Mute video audio"}
          >
            {isHeroMuted ? (
              <>
                <VolumeX className="h-4 w-4 text-amber-400" />
                <span>Unmute Audio</span>
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4 text-emerald-400 animate-pulse" />
                <span>Sound Playing</span>
              </>
            )}
          </button>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28 w-full">
          {/* Unified synchronized animation for top text, middle 3 dashes, and bottom text */}
          <style>{`
            @keyframes heroGradientSlide {
              0% {
                background-position: 0% 50%;
              }
              50% {
                background-position: 100% 50%;
              }
              100% {
                background-position: 0% 50%;
              }
            }

            @keyframes orbFloatA {
              0%, 100% {
                transform: translate(0px, 0px) scale(1);
                opacity: 0.75;
              }
              50% {
                transform: translate(70px, -50px) scale(1.25);
                opacity: 0.95;
              }
            }

            @keyframes orbFloatB {
              0%, 100% {
                transform: translate(0px, 0px) scale(1);
                opacity: 0.55;
              }
              50% {
                transform: translate(-60px, 45px) scale(1.3);
                opacity: 0.9;
              }
            }

            @keyframes shimmerWave {
              0% {
                transform: translateX(-100%) rotate(25deg);
              }
              100% {
                transform: translateX(250%) rotate(25deg);
              }
            }

            .hero-animated-bg {
              background: linear-gradient(
                135deg,
                #050b14 0%,
                #0c2340 18%,
                #1d4ed8 45%,
                #0284c7 68%,
                #38bdf8 82%,
                #ffffff 92%,
                #0c2340 100%
              );
              background-size: 300% 300%;
              animation: heroGradientSlide 12s ease-in-out infinite;
            }

            @keyframes syncRevealAndEraseUnified {
              0% {
                clip-path: inset(0 100% 0 0);
                opacity: 0;
              }
              6% {
                opacity: 1;
              }
              42% {
                clip-path: inset(0 0% 0 0);
                opacity: 1;
              }
              65% {
                clip-path: inset(0 0% 0 0);
                opacity: 1;
              }
              90% {
                clip-path: inset(0 100% 0 0);
                opacity: 0.2;
              }
              100% {
                clip-path: inset(0 100% 0 0);
                opacity: 0;
              }
            }

            .animate-sync-together {
              display: inline-flex;
              flex-direction: column;
              align-items: flex-start;
              animation: syncRevealAndEraseUnified 3.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }
          `}</style>

          {/* Direct typography on video - Zero rectangular frame or blurred box */}
          <div className="max-w-2xl space-y-3">
            {/* Unified block: Top text, 3 thin dashes, and bottom text moving together at equal speed */}
            <div className="animate-sync-together space-y-3">
              {/* 1. Top text */}
              <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] whitespace-nowrap">
                Run your entire school
              </h1>

              {/* 2. Middle 3 thin glowing dash segments */}
              <div className="py-1 flex items-center gap-2.5">
                <span className="h-[2px] w-8 sm:w-10 rounded-full bg-amber-400 shadow-[0_0_10px_#F59E0B]" />
                <span className="h-[2px] w-12 sm:w-16 rounded-full bg-amber-300 shadow-[0_0_10px_#FCD34D]" />
                <span className="h-[2px] w-16 sm:w-24 rounded-full bg-amber-400 shadow-[0_0_10px_#F59E0B]" />
              </div>

              {/* 3. Bottom text */}
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-amber-400 drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] whitespace-nowrap">
                even offline.
              </h2>
            </div>

            <p className="text-lg text-white/95 font-medium leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] max-w-xl pt-1">
              All-in-one school management for attendance, grades, fees, and communication.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <Link
                to={primaryAction.to}
                className="btn-primary btn-lg shadow-2xl hover:scale-105 transition-transform"
              >
                {primaryAction.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={secondaryAction.to}
                className="inline-flex items-center justify-center rounded-xl font-bold transition-all px-6 py-3 text-base text-white bg-black/40 hover:bg-black/60 border border-white/40 backdrop-blur-xs shadow-xl"
              >
                {secondaryAction.label}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Build Your TimhirtHub Section ──────────────────────────────── */}
      <section className="border-y border-gray-100 bg-gradient-to-b from-slate-50/70 via-white to-slate-50/70 py-16 sm:py-20 reveal-section">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-200/90 bg-primary-50 px-4 py-1.5 text-xs font-bold text-primary-700 shadow-2xs">
            <Sparkles className="h-3.5 w-3.5 text-primary-600" />
            <span>Unified SIS & LMS Platform</span>
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            Build Your TimhirtHub
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-gray-600 leading-relaxed">
            Learn how TimhirtHub unlocks operational excellence that empowers administrators, educators, and families to advance student outcomes.
          </p>

          {/* Role interactive triggers */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            {ROLE_TABS.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => {
                  setActiveModalRole(role.id);
                  setRoleModalOpen(true);
                }}
                className="group inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-gray-700 shadow-2xs transition-all duration-300 hover:border-primary-400 hover:bg-primary-50/70 hover:text-primary-800 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
              >
                <role.icon className="h-4 w-4 text-primary-600 transition-transform group-hover:scale-110" />
                <span>{role.label}</span>
                <ArrowRight className="h-3 w-3 text-gray-400 group-hover:text-primary-600 transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services Video Presentation ─────────────────────────────────── */}
      <section
        id="services"
        ref={servicesSectionRef}
        className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 reveal-section"
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-gray-200/80 dark:border-gray-800 bg-gray-950 shadow-2xl">
          {servicesVideoVisible && (
            <>
              {/* Overscan crop: scaled and shifted so top title bar & bottom branding are completely clipped off */}
              <iframe
                ref={servicesIframeRef}
                src="https://www.youtube.com/embed/dQknNQcM4cU?autoplay=1&mute=1&loop=1&playlist=dQknNQcM4cU&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&playsinline=1&enablejsapi=1"
                title="TimhirtHub Services Overview"
                allow="autoplay; encrypted-media; picture-in-picture"
                className="absolute -top-[12%] -left-[12%] h-[124%] w-[124%] object-cover pointer-events-none"
                tabIndex={-1}
              />
              {/* Transparent shield intercepting mouse interactions */}
              <div className="absolute inset-0 z-10 pointer-events-auto bg-transparent" />

              {/* Floating audio control pill */}
              <div className="absolute bottom-4 right-4 z-20">
                <button
                  type="button"
                  onClick={toggleServicesAudio}
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/60 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md transition-all hover:bg-black/80 hover:scale-105"
                  aria-label={isServicesMuted ? "Turn on audio" : "Mute audio"}
                >
                  {isServicesMuted ? (
                    <>
                      <VolumeX className="h-4 w-4 text-amber-400" />
                      <span>Sound Off</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4 text-emerald-400" />
                      <span>Sound On</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="bg-gray-50/70 py-20 reveal-section border-y border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
              How it works
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Live in an afternoon, not a semester
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className="group relative rounded-3xl bg-white p-7 sm:p-8 border border-gray-200/80 shadow-card transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-xl hover:border-primary-300 overflow-hidden cursor-default"
              >
                {/* Top accent glowing hover bar */}
                <div className="absolute top-0 left-0 h-1 w-0 bg-gradient-to-r from-primary-500 to-indigo-500 rounded-t-3xl transition-all duration-300 ease-out group-hover:w-full" />

                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-primary-600 transition-colors group-hover:text-primary-700">
                    {step.number}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-primary-100 group-hover:bg-primary-500 transition-colors" />
                </div>

                <h3 className="mt-3 text-lg font-bold text-gray-900 transition-colors group-hover:text-primary-600">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
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
        className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 reveal-section"
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

      {/* ── 6. Closing CTA Section ─────────────────────────────────────── */}
      <section className="bg-primary-950 reveal-section">
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
              to={primaryAction.to}
              className="btn btn-lg bg-white text-primary-900 hover:bg-primary-50"
            >
              {primaryAction.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to={secondaryAction.to}
              className="btn btn-lg border border-primary-700 text-white hover:bg-primary-900"
            >
              {secondaryAction.label}
            </Link>
          </div>
        </div>
      </section>

      {/* ── 7. Footer (With Integrated FAQ & Solutions Modals) ─────────────── */}
      <footer id="contact" className="bg-white text-gray-900 border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-6">
            <div className="col-span-2 lg:col-span-2 space-y-4">
              <Link to="/" className="flex items-center">
                <img
                  src={logoImg}
                  alt="TimhirtHub"
                  className="h-16 sm:h-20 w-auto max-h-24 object-contain"
                />
              </Link>
              <p className="max-w-xs text-sm leading-6 text-gray-600">
                School management for Ethiopian schools — attendance, grading,
                fees, and family communication in one place.
              </p>

              {/* Contact Details */}
              <div className="space-y-2.5 pt-2 text-xs text-gray-600">
                {FOOTER_ADDRESS && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary-600 shrink-0 mt-0.5" />
                    <span>{FOOTER_ADDRESS}</span>
                  </div>
                )}
                {FOOTER_MOBILE && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary-600 shrink-0" />
                    <a
                      href={`tel:${FOOTER_MOBILE.replace(/\s+/g, "")}`}
                      className="hover:text-primary-600 font-medium transition-colors"
                    >
                      {FOOTER_MOBILE}
                    </a>
                  </div>
                )}
                {FOOTER_EMAIL && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary-600 shrink-0" />
                    <a
                      href={`mailto:${FOOTER_EMAIL}`}
                      className="hover:text-primary-600 font-medium transition-colors truncate max-w-xs"
                    >
                      {FOOTER_EMAIL}
                    </a>
                  </div>
                )}
              </div>

              {/* Social Channels (WhatsApp & Telegram) */}
              {(FOOTER_WHATSAPP_URL || FOOTER_TELEGRAM_URL) && (
                <div className="flex items-center gap-2.5 pt-1">
                  {FOOTER_WHATSAPP_URL && (
                    <a
                      href={FOOTER_WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600 transition-all hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-600"
                      title="Chat on WhatsApp"
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                    </a>
                  )}
                  {FOOTER_TELEGRAM_URL && (
                    <a
                      href={FOOTER_TELEGRAM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600 transition-all hover:bg-sky-50 hover:border-sky-300 hover:text-sky-600"
                      title="Contact on Telegram (@nabas444)"
                    >
                      <TelegramIcon className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}

              {/* Newsletter Signup (Placeholder) */}
              {/* TODO(user): wire up to a real mailing list provider once one is chosen */}
              <div className="pt-2 max-w-xs space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Stay updated
                </p>
                <form onSubmit={(e) => e.preventDefault()} className="flex items-center gap-1.5">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    disabled
                    className="input text-xs h-8 flex-1 bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200"
                  />
                  <button
                    type="button"
                    disabled
                    className="btn-primary btn-sm text-xs h-8 px-2.5 opacity-60 cursor-not-allowed inline-flex items-center gap-1"
                    title="Newsletter subscription coming soon"
                  >
                    <Send className="h-3 w-3" />
                  </button>
                </form>
                <p className="text-[10px] text-gray-400 italic">
                  Newsletter coming soon. Reach out directly above!
                </p>
              </div>
            </div>

            {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
              <div key={heading}>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                  {heading}
                </h4>
                <ul className="mt-4 space-y-3">
                  {links.map((link) => (
                    <li key={link}>
                      {link === "FAQ" ? (
                        <button
                          type="button"
                          onClick={() => setFaqModalOpen(true)}
                          className="group relative inline-flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900 cursor-pointer text-left"
                        >
                          <span className="relative pb-0.5">
                            Frequently Asked Questions
                            <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-primary-600 transition-all duration-300 ease-out group-hover:w-full" />
                          </span>
                          <span className="rounded-full bg-gray-100 border border-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
                            FAQ
                          </span>
                        </button>
                      ) : link === "Contact" ? (
                        <a
                          href="#contact"
                          className="group relative inline-flex items-center text-sm text-gray-600 transition-colors hover:text-gray-900"
                        >
                          <span className="relative pb-0.5">
                            Contact
                            <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-primary-600 transition-all duration-300 ease-out group-hover:w-full" />
                          </span>
                        </a>
                      ) : ROLE_LINK_MAP[link] ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveModalRole(ROLE_LINK_MAP[link]);
                            setRoleModalOpen(true);
                          }}
                          className="group relative inline-flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900 cursor-pointer text-left"
                        >
                          <span className="relative pb-0.5">
                            {link}
                            <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-primary-600 transition-all duration-300 ease-out group-hover:w-full" />
                          </span>
                        </button>
                      ) : RESOURCE_LINKS[link] ? (
                        <Link
                          to={RESOURCE_LINKS[link]}
                          className="group relative inline-flex items-center text-sm text-gray-600 transition-colors hover:text-gray-900"
                        >
                          <span className="relative pb-0.5">
                            {link}
                            <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-primary-600 transition-all duration-300 ease-out group-hover:w-full" />
                          </span>
                        </Link>
                      ) : (
                        <a
                          href="#services"
                          className="group relative inline-flex items-center text-sm text-gray-600 transition-colors hover:text-gray-900"
                        >
                          <span className="relative pb-0.5">
                            {link}
                            <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-primary-600 transition-all duration-300 ease-out group-hover:w-full" />
                          </span>
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col gap-4 border-t border-gray-100 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} TimhirtHub. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <a href="#" className="group relative inline-flex items-center text-xs text-gray-600 hover:text-gray-900 transition-colors">
                <span className="relative pb-0.5">
                  Privacy policy
                  <span className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary-600 transition-all duration-300 ease-out group-hover:w-full" />
                </span>
              </a>
              <a href="#" className="group relative inline-flex items-center text-xs text-gray-600 hover:text-gray-900 transition-colors">
                <span className="relative pb-0.5">
                  Terms of service
                  <span className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary-600 transition-all duration-300 ease-out group-hover:w-full" />
                </span>
              </a>
              <button
                type="button"
                onClick={() => setFaqModalOpen(true)}
                className="group relative inline-flex items-center text-xs text-gray-600 hover:text-gray-900 cursor-pointer transition-colors"
              >
                <span className="relative pb-0.5">
                  FAQ & Knowledge Base
                  <span className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary-600 transition-all duration-300 ease-out group-hover:w-full" />
                </span>
              </button>
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <Globe className="h-3.5 w-3.5 text-gray-500" />
                <span>English</span>
                <span className="text-gray-300">·</span>
                <span>አማርኛ</span>
                <span className="text-gray-300">·</span>
                <span>Afaan Oromoo</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* ── 8. Interactive FAQ Modal / Revealed Card ─────────────────────── */}
      {faqModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
          onClick={() => setFaqModalOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xl animate-scale-in dark:bg-gray-900 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 dark:bg-primary-950/60 px-3 py-1 text-xs font-bold text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
                  Knowledge & Support Hub
                </span>
                <h3 className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
                  Frequently Asked Questions
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Answers regarding offline access, multi-language support, and security.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFaqModalOpen(false)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                aria-label="Close FAQ dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Interactive Search Filter */}
            <div className="mt-4 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder="Search questions (e.g. offline, languages, pricing, records)..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50/80 pl-10 pr-16 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              {faqSearch && (
                <button
                  type="button"
                  onClick={() => setFaqSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  Clear
                </button>
              )}
            </div>

            {/* FAQ Accordion List */}
            <div className="mt-4 flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
              {filteredFaqs.length > 0 ? (
                filteredFaqs.map((faq, index) => {
                  const isOpen = openFaq === index;
                  return (
                    <div key={faq.question}>
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : index)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-100/70 dark:hover:bg-gray-800/80"
                        aria-expanded={isOpen}
                      >
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {faq.question}
                        </span>
                        {isOpen ? (
                          <Minus className="h-4 w-4 shrink-0 text-primary-600" />
                        ) : (
                          <Plus className="h-4 w-4 shrink-0 text-gray-400" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="animate-fade-in px-5 pb-4">
                          <p className="text-xs sm:text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                            {faq.answer}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-sm text-gray-500">
                  No questions match "{faqSearch}". Try searching for "offline", "contract", or "languages".
                </div>
              )}
            </div>

            {/* Modal Footer Note */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Tenant-isolated by design — school data is strictly private.</span>
              </div>
              <button
                type="button"
                onClick={() => setFaqModalOpen(false)}
                className="btn btn-secondary py-1.5 px-4 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. Interactive Role Description Modal / Revealed Card ─────────── */}
      {roleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in"
          onClick={() => setRoleModalOpen(false)}
        >
          <div
            className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-6 sm:p-10 shadow-2xl animate-scale-in dark:bg-gray-900 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header & Role Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                  Role-Tailored Workspaces
                </p>
                <h3 className="mt-1 text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
                  {currentModalRole.label}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Role Switcher Pill Tabs */}
                <div className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-gray-200 bg-gray-50/80 p-1 dark:border-gray-700 dark:bg-gray-800">
                  {ROLE_TABS.map((role) => {
                    const isActive = activeModalRole === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setActiveModalRole(role.id)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                          isActive
                            ? "bg-primary-600 text-white shadow-xs"
                            : "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700"
                        }`}
                      >
                        <role.icon className="h-3.5 w-3.5" />
                        <span>{role.shortRole || role.label}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setRoleModalOpen(false)}
                  className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors ml-2 shrink-0"
                  aria-label="Close dialog"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: 2 Columns */}
            <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
              {/* Left Column: Narrative, KPIs, and Highlights */}
              <div className="space-y-6">
                <div>
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-bold shadow-2xs ${currentModalRole.badgeColor}`}>
                    <span className="h-2 w-2 rounded-full bg-current animate-ping" />
                    <currentModalRole.icon className="h-3.5 w-3.5" />
                    <span>{currentModalRole.badge}</span>
                  </div>
                  <h4 className="mt-3 text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white leading-tight">
                    {currentModalRole.title}
                  </h4>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    {currentModalRole.intro}
                  </p>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-3 gap-2.5">
                  {currentModalRole.kpis.map((kpi) => (
                    <div key={kpi.label} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3 shadow-2xs dark:border-gray-800 dark:bg-gray-800/60">
                      <p className="text-[10px] font-semibold text-gray-500 truncate dark:text-gray-400">{kpi.label}</p>
                      <p className="mt-1 text-base sm:text-lg font-black text-gray-900 dark:text-white">{kpi.val}</p>
                      <p className="text-[9px] font-bold text-primary-600 truncate dark:text-primary-400">{kpi.trend}</p>
                    </div>
                  ))}
                </div>

                {/* Highlights */}
                <div className="space-y-2.5 pt-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Included Daily Workflows
                  </p>
                  <ul className="space-y-2">
                    {currentModalRole.highlights.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <div className="flex flex-wrap items-center gap-3 pt-3">
                  <Link
                    to={primaryAction.to}
                    className="btn-primary shadow-lg hover:scale-105 transition-transform"
                    onClick={() => setRoleModalOpen(false)}
                  >
                    {currentModalRole.ctaText}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setRoleModalOpen(false)}
                    className="btn btn-secondary"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Right Column: Live Simulated Mockup Preview */}
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 relative overflow-hidden">
                  <div className="relative z-10">
                    {activeModalRole === "admin" && (
                      <div className="space-y-4 font-sans text-xs">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                            <span className="font-semibold text-slate-300">Live Campus Command</span>
                          </div>
                          <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-blue-300 border border-blue-500/30">
                            2026/27 Term 3
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-xl bg-slate-800/80 p-3 border border-slate-700/60">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Attendance</p>
                            <p className="text-base font-black text-emerald-400">97.4%</p>
                            <p className="text-[9px] text-emerald-300/80">38 absent</p>
                          </div>
                          <div className="rounded-xl bg-slate-800/80 p-3 border border-slate-700/60">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Roster</p>
                            <p className="text-base font-black text-white">1,480</p>
                            <p className="text-[9px] text-blue-300/80">42 sections</p>
                          </div>
                          <div className="rounded-xl bg-slate-800/80 p-3 border border-slate-700/60">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Fees</p>
                            <p className="text-base font-black text-amber-400">94.8%</p>
                            <p className="text-[9px] text-amber-300/80">ETB 2.48M</p>
                          </div>
                        </div>
                        <div className="space-y-2 pt-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live Campus Activity</p>
                          <div className="rounded-xl bg-slate-800/50 p-2.5 border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between text-slate-300">
                              <span className="flex items-center gap-2 truncate">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                <span className="truncate">Grade 10B Roll Call finalized</span>
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 shrink-0">08:15 AM</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-300">
                              <span className="flex items-center gap-2 truncate">
                                <FileSpreadsheet className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                <span className="truncate">Physics Annual Scheme approved</span>
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 shrink-0">Yesterday</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeModalRole === "teacher" && (
                      <div className="space-y-4 font-sans text-xs">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div>
                            <p className="font-bold text-white">Grade 10A · Mathematics</p>
                            <p className="text-[10px] text-slate-400">Continuous Assessment (CA 60 / Exam 40)</p>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                            Offline Sync
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                            <span>Student</span>
                            <span className="text-center">CA (60)</span>
                            <span className="text-center">Exam (40)</span>
                            <span className="text-right">Total</span>
                          </div>
                          <div className="rounded-lg bg-slate-800/70 p-2 border border-slate-700/60 grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center text-slate-200">
                            <span className="font-medium truncate">Abebe Kebede</span>
                            <span className="font-mono text-center text-emerald-300 font-bold">58</span>
                            <span className="font-mono text-center text-slate-300">38</span>
                            <span className="font-mono text-right font-black text-emerald-400">96 (A)</span>
                          </div>
                          <div className="rounded-lg bg-slate-800/40 p-2 border border-slate-800 grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center text-slate-200">
                            <span className="font-medium truncate">Sara Tesfaye</span>
                            <span className="font-mono text-center text-emerald-300 font-bold">54</span>
                            <span className="font-mono text-center text-slate-300">36</span>
                            <span className="font-mono text-right font-black text-blue-400">90 (A)</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeModalRole === "parent" && (
                      <div className="space-y-4 font-sans text-xs">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-300 border border-rose-500/30">
                              👦 Abebe · Grade 10A
                            </span>
                            <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-400">
                              👧 Tigist · Gr. 6B
                            </span>
                          </div>
                        </div>
                        <div className="rounded-xl bg-gradient-to-r from-emerald-950/70 to-slate-900 border border-emerald-800/60 p-3">
                          <div className="flex items-start gap-2.5">
                            <span className="rounded-lg bg-emerald-500/20 p-1.5 text-emerald-300 shrink-0">
                              <CheckCircle2 className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="font-bold text-emerald-200">Arrival Alert · Checked In</p>
                              <p className="text-[11px] text-emerald-300/80">Abebe arrived safely today at 8:02 AM.</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-slate-800/40 p-2.5 border border-slate-800 text-[11px]">
                          <span className="text-slate-300">Term 3 Tuition: <strong>ETB 4,500</strong></span>
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            Paid · Telebirr Verified
                          </span>
                        </div>
                      </div>
                    )}

                    {activeModalRole === "student" && (
                      <div className="space-y-4 font-sans text-xs">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div>
                            <p className="font-bold text-white">Abebe Kebede · Grade 10A</p>
                            <p className="text-[10px] text-slate-400">Honor Roll · Semester GPA 3.92</p>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="rounded-lg bg-slate-800/80 p-2.5 border border-purple-500/30 flex items-center justify-between text-slate-200">
                            <div>
                              <span className="font-bold text-purple-300">08:30 AM · Period 1</span>
                              <p className="text-white font-medium">Advanced Mathematics (Room 204)</p>
                            </div>
                            <span className="rounded-md bg-purple-500/20 px-2 py-1 text-[10px] font-mono text-purple-200 font-bold">
                              In Progress
                            </span>
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-800/50 p-2.5 border border-slate-800 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-200">Chemistry Chapter 5 Lab Report</p>
                            <p className="text-[10px] text-amber-300">⏳ Due today by 11:59 PM</p>
                          </div>
                          <span className="rounded-lg bg-primary-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs">
                            Submit Online
                          </span>
                        </div>
                      </div>
                    )}

                    {activeModalRole === "finance" && (
                      <div className="space-y-4 font-sans text-xs">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div>
                            <p className="font-bold text-white">Tuition & Financial Operations</p>
                            <p className="text-[10px] text-slate-400">2026/27 Academic Year Revenue</p>
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-800/80 p-3 border border-slate-700/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300 font-medium">Collection Progress</span>
                            <span className="font-mono font-black text-amber-400">94.8%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400 w-[94.8%]" />
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-800/40 p-2 border border-slate-800 flex items-center justify-between">
                          <span className="truncate text-slate-200">Abebe Kebede (Gr 10A) · ETB 4,500</span>
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300 font-bold">
                            Telebirr Verified
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Capabilities */}
                <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    Core Capabilities in the Workspace
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentModalRole.features.map((feat) => (
                      <span
                        key={feat}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200/80 bg-white px-2 py-0.5 text-xs font-semibold text-gray-800 shadow-2xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      >
                        <Layers className="h-3 w-3 text-primary-600 dark:text-primary-400" />
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
