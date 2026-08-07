import clsx from 'clsx';

const COLOR_MAP = {
  blue:   'bg-blue-50 text-blue-600',
  green:  'bg-green-50 text-green-600',
  red:    'bg-red-50 text-red-600',
  amber:  'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
  primary:'bg-primary-50 text-primary-600',
};

export default function StatCard({ icon: Icon, label, value, color = 'primary', delta, onClick }) {
  return (
    <div className={clsx('stat-card', onClick && 'cursor-pointer hover:shadow-card-hover transition-shadow')} onClick={onClick}>
      <div className={clsx('stat-icon', COLOR_MAP[color])}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-sm text-gray-500 mt-1">{label}</p>
        {delta && <p className="text-xs text-green-600 mt-0.5 font-medium">{delta}</p>}
      </div>
    </div>
  );
}
