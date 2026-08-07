import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, variant = 'gray' }) {
  const v = {
    green:   'badge-green',
    red:     'badge-red',
    yellow:  'badge-yellow',
    blue:    'badge-blue',
    purple:  'badge-purple',
    gray:    'badge-gray',
    primary: 'badge-primary',
  };
  return <span className={v[variant] ?? 'badge-gray'}>{children}</span>;
}

// ── Avatar ────────────────────────────────────────────────────────────────────
export function Avatar({ src, name = '?', size = 'md' }) {
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-xl' };
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  if (src) return <img src={src} alt={name} className={clsx('rounded-full object-cover flex-shrink-0', sizes[size])} />;
  return (
    <div className={clsx('rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center flex-shrink-0', sizes[size])}>
      {initials}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-400 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <button className="btn-secondary btn-sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm text-gray-600">Page <strong>{page}</strong> of <strong>{totalPages}</strong></span>
      <button className="btn-secondary btn-sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── SearchInput ───────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────
import Modal from './Modal';
export function ConfirmDialog({ open, onClose, onConfirm, title = 'Confirm', message, danger = false, loading = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={loading}>
          {loading ? 'Please wait…' : 'Confirm'}
        </button>
      </>}
    >
      <p className="text-gray-600 text-sm">{message}</p>
    </Modal>
  );
}
