export const CLUB_CATEGORIES = [
  { id: "ALL", label: "All Categories", icon: "✨" },
  { id: "ACADEMIC", label: "Academic", icon: "📚", color: "indigo" },
  { id: "SCIENCE", label: "Science", icon: "🔬", color: "teal" },
  { id: "TECHNOLOGY", label: "Technology & Robotics", icon: "💻", color: "cyan" },
  { id: "MATHEMATICS", label: "Mathematics", icon: "🧮", color: "blue" },
  { id: "ARTS", label: "Fine Arts & Design", icon: "🎨", color: "pink" },
  { id: "MUSIC", label: "Music & Performing", icon: "🎵", color: "purple" },
  { id: "SPORTS", label: "Sports & Athletics", icon: "⚽", color: "green" },
  { id: "DEBATE", label: "Debate & Model UN", icon: "🎙️", color: "amber" },
  { id: "CULTURE", label: "Culture & Language", icon: "🌍", color: "orange" },
  { id: "ENTREPRENEURSHIP", label: "Entrepreneurship", icon: "🚀", color: "emerald" },
  { id: "COMMUNITY_SERVICE", label: "Community Service", icon: "🤝", color: "rose" },
  { id: "ENVIRONMENT", label: "Environment & Eco", icon: "🌿", color: "emerald" },
  { id: "OTHER", label: "Other Interest", icon: "💡", color: "gray" },
];

export const STATUS_CONFIG = {
  ACTIVE: { label: "Active", variant: "green", bg: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  PENDING_APPROVAL: { label: "Pending Approval", variant: "yellow", bg: "bg-amber-50 text-amber-800 border-amber-200" },
  RENEWAL_REQUIRED: { label: "Renewal Required", variant: "blue", bg: "bg-blue-50 text-blue-800 border-blue-200" },
  SUSPENDED: { label: "Suspended", variant: "red", bg: "bg-rose-50 text-rose-800 border-rose-200" },
  ARCHIVED: { label: "Archived", variant: "gray", bg: "bg-gray-100 text-gray-700 border-gray-200" },
  REJECTED: { label: "Rejected", variant: "red", bg: "bg-red-50 text-red-700 border-red-200" },
  DRAFT: { label: "Draft", variant: "gray", bg: "bg-gray-50 text-gray-600 border-gray-200" },
};
