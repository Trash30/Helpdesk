export const PRIORITY_TOKENS = {
  CRITICAL: { bg: '#FCEBEB', fg: '#A32D2D', solid: '#A32D2D' },
  HIGH:     { bg: '#FAEEDA', fg: '#854F0B', solid: '#EF9F27' },
  MEDIUM:   { bg: '#E6F1FB', fg: '#185FA5', solid: '#185FA5' },
  LOW:      { bg: '#EAF3DE', fg: '#3B6D11', solid: '#639922' },
} as const;

export const STATUS_TOKENS = {
  OPEN:        { bg: '#E6F1FB', fg: '#185FA5', label: 'Ouvert' },
  IN_PROGRESS: { bg: '#FAEEDA', fg: '#854F0B', label: 'En cours' },
  PENDING:     { bg: '#FBEAF0', fg: '#993556', label: 'En attente' },
  CLOSED:      { bg: '#F1EFE8', fg: '#3D3C39', label: 'Fermé' },
  RESOLVED:    { bg: '#EAF3DE', fg: '#3B6D11', label: 'Résolu' },
} as const;

export type PriorityKey = keyof typeof PRIORITY_TOKENS;
export type StatusKey = keyof typeof STATUS_TOKENS;
