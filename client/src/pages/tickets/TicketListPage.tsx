import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Plus, ChevronDown, ChevronLeft, ChevronRight,
  TicketIcon, RotateCcw,
} from 'lucide-react';
import api from '@/lib/axios';
import { usePermissions } from '@/hooks/usePermissions';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

// ── helpers ─────────────────────────────────────────────────────────────────

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
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min}min`;
  if (hour < 24) return `il y a ${hour}h`;
  if (day === 1) return 'hier';
  if (day < 30) return `il y a ${day}j`;
  return date.toLocaleDateString('fr-FR');
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}

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
          {start > 2 && <span className="px-2 text-muted-foreground">…</span>}
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
          {end < totalPages - 1 && <span className="px-2 text-muted-foreground">…</span>}
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
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 grid grid-cols-8 gap-4">
        {['w-16', 'w-24', 'w-32', 'w-20', 'w-16', 'w-16', 'w-20', 'w-20'].map((w, i) => (
          <Skeleton key={i} className={`h-4 ${w}`} />
        ))}
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="px-4 py-3 grid grid-cols-8 gap-4 border-t">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
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

// ── Main Page ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Ouvert' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'RESOLVED', label: 'Résolu' },
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
  client: { firstName: string; lastName: string; phone: string | null; company: string | null } | null;
  category: { name: string; color: string } | null;
  assignedTo: { firstName: string; lastName: string } | null;
}

interface TicketsResponse {
  data: Ticket[];
  total: number;
  page: number;
  totalPages: number;
}

export function TicketListPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();

  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 400);

  const hasFilters = statuses.length > 0 || priorities.length > 0 ||
    categoryId || assignedToId || dateFrom || dateTo || debouncedSearch;

  const resetFilters = useCallback(() => {
    setSearch('');
    setStatuses([]);
    setPriorities([]);
    setCategoryId('');
    setAssignedToId('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, statuses, priorities, categoryId, assignedToId, dateFrom, dateTo]);

  const { data, isLoading, isError, refetch } = useQuery<TicketsResponse>({
    queryKey: ['tickets', debouncedSearch, statuses, priorities, categoryId, assignedToId, dateFrom, dateTo, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      statuses.forEach(s => params.append('status[]', s));
      priorities.forEach(p => params.append('priority[]', p));
      if (categoryId) params.set('categoryId', categoryId);
      if (assignedToId) params.set('assignedToId', assignedToId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('page', String(page));
      params.set('limit', '25');
      const res = await api.get(`/tickets?${params.toString()}`);
      return res.data;
    },
  });

  const { data: categories } = useQuery<{ id: string; name: string; color: string }[]>({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/categories')).data?.data ?? [],
  });

  const { data: agents } = useQuery<{ id: string; firstName: string; lastName: string }[]>({
    queryKey: ['agents'],
    queryFn: async () => (await api.get('/admin/users')).data?.data ?? [],
    enabled: can('tickets.assign'),
  });

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tickets</h1>
          {can('tickets.create') && (
            <Button onClick={() => navigate('/tickets/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau ticket
            </Button>
          )}
        </div>

        {/* Filter bar */}
        <div className="sticky top-0 z-10 bg-background border rounded-lg p-3 shadow-sm space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher un ticket, client..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2">
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
              placeholder="Priorité"
            />

            {/* Category select */}
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
            >
              <option value="">Toutes les catégories</option>
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

            {/* Date range */}
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
            />
            <span className="text-muted-foreground text-sm">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
            />

            {hasFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground ml-auto"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Réinitialiser les filtres
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
              Réessayer
            </Button>
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg">
            <TicketIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Aucun ticket trouvé</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {hasFilters
                ? 'Essayez de modifier vos filtres de recherche.'
                : 'Aucun ticket pour le moment.'}
            </p>
            {can('tickets.create') && !hasFilters && (
              <Button onClick={() => navigate('/tickets/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Créer le premier ticket
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Client</th>
                    <th className="px-4 py-3 text-left">Titre</th>
                    <th className="px-4 py-3 text-left">Catégorie</th>
                    <th className="px-4 py-3 text-left">Priorité</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                    <th className="px-4 py-3 text-left">Assigné</th>
                    <th className="px-4 py-3 text-left">Créé le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map(ticket => (
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
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[240px]">
                        <span className="truncate block" title={ticket.title}>
                          {ticket.title.length > 60 ? ticket.title.slice(0, 60) + '…' : ticket.title}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {ticket.category ? (
                          <CategoryBadge name={ticket.category.name} color={ticket.category.color} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={ticket.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="px-4 py-3">
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
                          <span className="text-muted-foreground text-xs">Non assigné</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
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
