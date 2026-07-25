import { useTranslation } from 'react-i18next';
import { PRIORITY_TOKENS, type PriorityKey } from '@/lib/colors';

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

export function PriorityBadge({ priority, className = '' }: PriorityBadgeProps) {
  const { t } = useTranslation('common');
  const key = priority as PriorityKey;
  const token = PRIORITY_TOKENS[key];
  const label = token ? t(`priority.${key}`) : priority;
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
