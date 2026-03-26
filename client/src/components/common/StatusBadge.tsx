const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  OPEN:        { label: 'Ouvert',     bg: '#E6F1FB', color: '#185FA5' },
  IN_PROGRESS: { label: 'En cours',   bg: '#FAEEDA', color: '#854F0B' },
  PENDING:     { label: 'En attente', bg: '#FBEAF0', color: '#993556' },
  CLOSED:      { label: 'Fermé',      bg: '#F1EFE8', color: '#5F5E5A' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

export { STATUS_CONFIG };
