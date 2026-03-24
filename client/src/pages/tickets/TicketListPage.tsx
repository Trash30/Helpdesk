import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Plus, ChevronDown, ChevronLeft, ChevronRight,
  TicketIcon, RotateCcw, Download, FileText, FileSpreadsheet, SlidersHorizontal,
} from 'lucide-react';
import api from '@/lib/axios';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/stores/authStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import toast from 'react-hot-toast';

// ── helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_STATUSES = ['OPEN', 'IN_PROGRESS', 'PENDING'];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (min < 1) return "a l'instant";
  if (min < 60) return `il y a ${min}min`;
  if (hour < 24) return `il y a ${hour}h`;
  if (day === 1) return 'hier';
  if (day < 30) return `il y a ${day}j`;
  return date.toLocaleDateString('fr-FR');
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Ouvert',
  IN_PROGRESS: 'En cours',
  PENDING: 'En attente',
  CLOSED: 'Fermé',
  RESOLVED: 'Résolu',
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Critique',
  HIGH: 'Haute',
  MEDIUM: 'Moyenne',
  LOW: 'Basse',
};

// ── MultiSelect ──────────────────────────────────────────────────────────────

interface MultiSelectProps {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}

function MultiSelect({ options, value, onChange, placeholder }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex h-9 min-w-[150px] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm"
      >
        <span className="text-muted-foreground truncate">
          {value.length === 0 ? placeholder : `${value.length} sélectionné${value.length > 1 ? 's' : ''}`}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[170px] rounded-md border bg-popover shadow-md py-1">
          {options.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={value.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="h-4 w-4 rounded border-input"
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {start > 1 && (
        <>
          <Button variant={page === 1 ? 'default' : 'outline'} size="sm" onClick={() => onChange(1)}>1</Button>
          {start > 2 && <span className="px-2 text-muted-foreground">...</span>}
        </>
      )}
      {pages.map(p => (
        <Button
          key={p}
          variant={p === page ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(p)}
        >
          {p}
        </Button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-2 text-muted-foreground">...</span>}
          <Button variant={page === totalPages ? 'default' : 'outline'} size="sm" onClick={() => onChange(totalPages)}>
            {totalPages}
          </Button>
        </>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── Skeletons ────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="bg-muted/50">
            <th className="px-4 py-3"><Skeleton className="h-4 w-16" /></th>
            <th className="px-4 py-3"><Skeleton className="h-4 w-24" /></th>
            <th className="px-4 py-3"><Skeleton className="h-4 w-32" /></th>
            <th className="px-4 py-3 hidden xl:table-cell"><Skeleton className="h-4 w-20" /></th>
            <th className="px-4 py-3"><Skeleton className="h-4 w-16" /></th>
            <th className="px-4 py-3"><Skeleton className="h-4 w-16" /></th>
            <th className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-20" /></th>
            <th className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-20" /></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }).map((_, i) => (
            <tr key={i} className="border-t">
              <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
              <td className="px-4 py-3 hidden xl:table-cell"><Skeleton className="h-4 w-20" /></td>
              <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
              <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
              <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-20" /></td>
              <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-16" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Category badge ───────────────────────────────────────────────────────────

function CategoryBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}

// ── Export dropdown ──────────────────────────────────────────────────────────

function ExportDropdown({ onExportCSV, onExportPDF }: { onExportCSV: () => void; onExportPDF: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" onClick={() => setOpen(o => !o)}>
        <Download className="h-4 w-4 mr-2" />
        Exporter
        <ChevronDown className="h-4 w-4 ml-1" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-md border bg-popover shadow-md py-1">
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
            onClick={() => { onExportCSV(); setOpen(false); }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            CSV (.xlsx compatible)
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
            onClick={() => { onExportPDF(); setOpen(false); }}
          >
            <FileText className="h-4 w-4" />
            PDF
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Ouvert' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'CLOSED', label: 'Fermé' },
];

const PRIORITY_OPTIONS = [
  { value: 'CRITICAL', label: 'Critique' },
  { value: 'HIGH', label: 'Haute' },
  { value: 'MEDIUM', label: 'Moyenne' },
  { value: 'LOW', label: 'Basse' },
];

interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  client: { firstName: string; lastName: string; phone: string | null; company: string | null } | null;
  category: { name: string; color: string } | null;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
}

interface TicketsResponse {
  data: Ticket[];
  total: number;
  page: number;
  totalPages: number;
}

function buildQueryParams(
  search: string,
  statuses: string[],
  priorities: string[],
  categoryId: string,
  assignedToId: string,
  dateFrom: string,
  dateTo: string,
  clubId: string,
  organisationId: string,
  page: number,
  limit: number,
): URLSearchParams {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  statuses.forEach(s => params.append('status[]', s));
  priorities.forEach(p => params.append('priority[]', p));
  if (categoryId) params.set('categoryId', categoryId);
  if (assignedToId) params.set('assignedToId', assignedToId);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (clubId) params.set('clubId', clubId);
  if (organisationId) params.set('organisationId', organisationId);
  params.set('page', String(page));
  params.set('limit', String(limit));
  return params;
}

export function TicketListPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();

  // Read stale ticket params from URL
  const staleDaysParam = searchParams.get('staleDays');
  const assignedToMeParam = searchParams.get('assignedToMe');
  const staleDays = staleDaysParam ? parseInt(staleDaysParam, 10) : null;
  const assignedToMe = assignedToMeParam === 'true';

  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<string[]>(DEFAULT_STATUSES);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clubId, setClubId] = useState('');
  const [organisationId, setOrganisationId] = useState('');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 400);

  const hasFilters = statuses.length > 0 || priorities.length > 0 ||
    categoryId || assignedToId || dateFrom || dateTo || debouncedSearch ||
    clubId || organisationId;

  // Count active filters for mobile badge (excluding default statuses)
  const activeFilterCount = (() => {
    let count = 0;
    const statusesSorted = [...statuses].sort();
    const defaultSorted = [...DEFAULT_STATUSES].sort();
    const statusChanged = statuses.length !== DEFAULT_STATUSES.length || statusesSorted.some((s, i) => s !== defaultSorted[i]);
    if (statusChanged) count++;
    if (priorities.length > 0) count++;
    if (categoryId) count++;
    if (assignedToId) count++;
    if (clubId) count++;
    if (organisationId) count++;
    if (dateFrom || dateTo) count++;
    return count;
  })();

  // Check if filters differ from default
  const isNonDefault = (() => {
    if (priorities.length > 0 || categoryId || assignedToId || dateFrom || dateTo || debouncedSearch || clubId || organisationId) return true;
    if (statuses.length !== DEFAULT_STATUSES.length) return true;
    const sorted = [...statuses].sort();
    const defaultSorted = [...DEFAULT_STATUSES].sort();
    return sorted.some((s, i) => s !== defaultSorted[i]);
  })();

  const resetFilters = useCallback(() => {
    setSearch('');
    setStatuses(DEFAULT_STATUSES);
    setPriorities([]);
    setCategoryId('');
    setAssignedToId('');
    setDateFrom('');
    setDateTo('');
    setClubId('');
    setOrganisationId('');
    setPage(1);
  }, []);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, statuses, priorities, categoryId, assignedToId, dateFrom, dateTo, clubId, organisationId]);

  const { data, isLoading, isError, refetch } = useQuery<TicketsResponse>({
    queryKey: ['tickets', debouncedSearch, statuses, priorities, categoryId, assignedToId, dateFrom, dateTo, clubId, organisationId, page],
    queryFn: async () => {
      const params = buildQueryParams(debouncedSearch, statuses, priorities, categoryId, assignedToId, dateFrom, dateTo, clubId, organisationId, page, 25);
      const res = await api.get(`/tickets?${params.toString()}`);
      return res.data;
    },
  });

  // Apply client-side stale and assignedToMe filters
  const displayedTickets = React.useMemo(() => {
    if (!data?.data) return [];
    let tickets = data.data;
    if (staleDays && staleDays > 0) {
      const cutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000;
      tickets = tickets.filter(t => new Date(t.updatedAt).getTime() < cutoff);
    }
    if (assignedToMe && user) {
      tickets = tickets.filter(t => t.assignedTo?.id === user.id);
    }
    return tickets;
  }, [data?.data, staleDays, assignedToMe, user]);

  const { data: categories } = useQuery<{ id: string; name: string; color: string }[]>({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/categories')).data?.data ?? [],
  });

  const { data: agents } = useQuery<{ id: string; firstName: string; lastName: string }[]>({
    queryKey: ['agents'],
    queryFn: async () => {
      try {
        const res = await api.get('/admin/users');
        return res.data?.data ?? [];
      } catch {
        return [];
      }
    },
    enabled: can('tickets.assign'),
  });

  const { data: clubs } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['clubs'],
    queryFn: async () => (await api.get('/clubs')).data?.data ?? [],
  });

  const { data: organisations } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['organisations'],
    queryFn: async () => (await api.get('/organisations')).data?.data ?? [],
  });

  // ── Export CSV ──────────────────────────────────────────────────────────────
  const handleExportCSV = async () => {
    try {
      const params = buildQueryParams(debouncedSearch, statuses, priorities, categoryId, assignedToId, dateFrom, dateTo, clubId, organisationId, 1, 10000);
      const res = await api.get(`/tickets?${params.toString()}`);
      const tickets: Ticket[] = res.data?.data ?? [];

      const header = ['#', 'Client', 'Titre', 'Catégorie', 'Priorité', 'Statut', 'Assigné à', 'Créé le', 'Dernière MAJ'];
      const rows = tickets.map(t => [
        t.ticketNumber,
        t.client ? `${t.client.firstName} ${t.client.lastName}` : '',
        t.title,
        t.category?.name ?? '',
        PRIORITY_LABELS[t.priority] ?? t.priority,
        STATUS_LABELS[t.status] ?? t.status,
        t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : '',
        new Date(t.createdAt).toLocaleDateString('fr-FR'),
        new Date(t.updatedAt).toLocaleDateString('fr-FR'),
      ]);

      const csvContent = [header, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        .join('\n');

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tickets_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Export CSV terminé');
    } catch {
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  // ── Export PDF ──────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    try {
      const params = buildQueryParams(debouncedSearch, statuses, priorities, categoryId, assignedToId, dateFrom, dateTo, clubId, organisationId, 1, 10000);
      const res = await api.get(`/tickets?${params.toString()}`);
      let tickets: Ticket[] = res.data?.data ?? [];

      let truncated = false;
      if (tickets.length > 1000) {
        tickets = tickets.slice(0, 1000);
        truncated = true;
      }

      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'landscape' });
      const dateStr = new Date().toLocaleDateString('fr-FR');
      doc.setFontSize(14);
      doc.text(`Liste des tickets - ${dateStr}`, 14, 18);

      if (truncated) {
        doc.setFontSize(9);
        doc.setTextColor(200, 0, 0);
        doc.text('Attention : export limité à 1000 lignes.', 14, 25);
        doc.setTextColor(0, 0, 0);
      }

      const head = [['#', 'Client', 'Titre', 'Catégorie', 'Priorité', 'Statut', 'Assigné à', 'Créé le', 'Dernière MAJ']];
      const body = tickets.map(t => [
        t.ticketNumber,
        t.client ? `${t.client.firstName} ${t.client.lastName}` : '',
        t.title.length > 50 ? t.title.slice(0, 50) + '...' : t.title,
        t.category?.name ?? '',
        PRIORITY_LABELS[t.priority] ?? t.priority,
        STATUS_LABELS[t.status] ?? t.status,
        t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : '',
        new Date(t.createdAt).toLocaleDateString('fr-FR'),
        new Date(t.updatedAt).toLocaleDateString('fr-FR'),
      ]);

      autoTable(doc, {
        head,
        body,
        startY: truncated ? 30 : 24,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [24, 95, 165] },
      });

      doc.save(`tickets_${new Date().toISOString().slice(0, 10)}.pdf`);
      if (truncated) {
        toast.success('Export PDF terminé (limité à 1000 lignes)');
      } else {
        toast.success('Export PDF terminé');
      }
    } catch {
      toast.error('Erreur lors de l\'export PDF');
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tickets</h1>
          <div className="flex items-center gap-2">
            <ExportDropdown onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
            {can('tickets.create') && (
              <Button onClick={() => navigate('/tickets/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau ticket
              </Button>
            )}
          </div>
        </div>

        {/* Stale tickets indicator */}
        {(staleDays || assignedToMe) && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
            Filtres actifs depuis l'URL :
            {staleDays && ` tickets sans mise a jour depuis ${staleDays} jours`}
            {assignedToMe && ` - Assigne a moi`}
          </div>
        )}

        {/* Filter bar */}
        <div className="sticky top-0 z-10 bg-background border rounded-lg p-3 shadow-sm space-y-3">
          {/* Search + mobile filter toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher un ticket, client..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-4 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="md:hidden flex items-center gap-1.5 shrink-0"
              onClick={() => setFiltersOpen(o => !o)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtres
              {activeFilterCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {/* Mobile collapsible filters */}
          {filtersOpen && (
            <div className="md:hidden grid grid-cols-2 gap-2">
              <MultiSelect
                options={STATUS_OPTIONS}
                value={statuses}
                onChange={setStatuses}
                placeholder="Statut"
              />
              <MultiSelect
                options={PRIORITY_OPTIONS}
                value={priorities}
                onChange={setPriorities}
                placeholder="Priorite"
              />
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
              >
                <option value="">Toutes les categories</option>
                {categories?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {can('tickets.assign') && (
                <select
                  value={assignedToId}
                  onChange={e => setAssignedToId(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                >
                  <option value="">Tous les agents</option>
                  {agents?.map(a => (
                    <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                  ))}
                </select>
              )}
              <select
                value={clubId}
                onChange={e => setClubId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
              >
                <option value="">Club / Ville</option>
                {clubs?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={organisationId}
                onChange={e => setOrganisationId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
              >
                <option value="">Organisation</option>
                {organisations?.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
              />
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
              />
              {isNonDefault && (
                <button
                  onClick={resetFilters}
                  className="col-span-2 flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reinitialiser les filtres
                </button>
              )}
            </div>
          )}

          {/* Desktop filters row */}
          <div className="hidden md:flex flex-wrap items-center gap-2">
            <MultiSelect
              options={STATUS_OPTIONS}
              value={statuses}
              onChange={setStatuses}
              placeholder="Statut"
            />
            <MultiSelect
              options={PRIORITY_OPTIONS}
              value={priorities}
              onChange={setPriorities}
              placeholder="Priorite"
            />

            {/* Category select */}
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
            >
              <option value="">Toutes les categories</option>
              {categories?.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Agent select */}
            {can('tickets.assign') && (
              <select
                value={assignedToId}
                onChange={e => setAssignedToId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
              >
                <option value="">Tous les agents</option>
                {agents?.map(a => (
                  <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                ))}
              </select>
            )}

            {/* Club select */}
            <select
              value={clubId}
              onChange={e => setClubId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
            >
              <option value="">Club / Ville</option>
              {clubs?.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Organisation select */}
            <select
              value={organisationId}
              onChange={e => setOrganisationId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
            >
              <option value="">Organisation</option>
              {organisations?.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>

            {/* Date range */}
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
            />
            <span className="text-muted-foreground text-sm">-&gt;</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
            />

            {isNonDefault && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground ml-auto"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reinitialiser les filtres
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg">
            <TicketIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Impossible de charger les tickets</h3>
            <p className="text-muted-foreground text-sm mb-4">Une erreur est survenue lors du chargement.</p>
            <Button variant="outline" onClick={() => refetch()}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reessayer
            </Button>
          </div>
        ) : !data || displayedTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg">
            <TicketIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Aucun ticket trouve</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {hasFilters
                ? 'Essayez de modifier vos filtres de recherche.'
                : 'Aucun ticket pour le moment.'}
            </p>
            {can('tickets.create') && !hasFilters && (
              <Button onClick={() => navigate('/tickets/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Creer le premier ticket
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Client</th>
                    <th className="px-4 py-3 text-left">Titre</th>
                    <th className="px-4 py-3 text-left hidden xl:table-cell">Categorie</th>
                    <th className="px-4 py-3 text-left">Priorite</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                    <th className="px-4 py-3 text-left hidden lg:table-cell">Assigne</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">Cree le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayedTickets.map(ticket => (
                    <tr
                      key={ticket.id}
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/tickets/${ticket.id}`}
                          onClick={e => e.stopPropagation()}
                          className="font-mono text-primary hover:underline text-xs font-medium"
                        >
                          {ticket.ticketNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {ticket.client ? (
                          <div>
                            <div className="font-medium">
                              {ticket.client.firstName} {ticket.client.lastName}
                            </div>
                            {ticket.client.phone && (
                              <div className="text-xs text-muted-foreground">{ticket.client.phone}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[240px]">
                        <span className="truncate block" title={ticket.title}>
                          {ticket.title.length > 60 ? ticket.title.slice(0, 60) + '...' : ticket.title}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {ticket.category ? (
                          <CategoryBadge name={ticket.category.name} color={ticket.category.color} />
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={ticket.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {ticket.assignedTo ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                              {getInitials(ticket.assignedTo.firstName, ticket.assignedTo.lastName)}
                            </span>
                            <span className="truncate max-w-[80px]">
                              {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Non assigne</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs cursor-default">{relativeTime(ticket.createdAt)}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {new Date(ticket.createdAt).toLocaleString('fr-FR')}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {data.total} ticket{data.total !== 1 ? 's' : ''} au total
              </p>
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
