import { STATUS_TOKENS, type StatusKey } from '@/lib/colors';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const key = status as StatusKey;
  const token = STATUS_TOKENS[key];
  const label = token?.label ?? status;
  const style = token
    ? { backgroundColor: token.bg, color: token.fg }
    : { backgroundColor: '#f3f4f6', color: '#6b7280' };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}
      style={style}
    >
      {label}
    </span>
  );
}
