const PRIORITY_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  CRITICAL: { label: 'Critique', bg: '#FCEBEB', color: '#A32D2D' },
  HIGH:     { label: 'Haute',    bg: '#FAEEDA', color: '#854F0B' },
  MEDIUM:   { label: 'Moyenne',  bg: '#E6F1FB', color: '#185FA5' },
  LOW:      { label: 'Basse',    bg: '#EAF3DE', color: '#3B6D11' },
};

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

export function PriorityBadge({ priority, className = '' }: PriorityBadgeProps) {
  const cfg = PRIORITY_CONFIG[priority] ?? { label: priority, bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

export { PRIORITY_CONFIG };
