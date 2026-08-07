export default function PageLoader({ text = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-3">
      <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}
