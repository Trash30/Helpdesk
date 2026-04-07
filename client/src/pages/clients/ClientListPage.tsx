import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Plus, UserPlus, BellOff, Eye, Pencil, Ticket,
  RotateCcw,
} from 'lucide-react';
import api from '@/lib/axios';
import { useClientPanel } from '@/contexts/ClientPanelContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useDebounce } from '@/hooks/useDebounce';
import { MultiSelect } from '@/components/common/MultiSelect';
import { Pagination } from '@/components/common/Pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Jamais';
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const day = Math.floor(diff / 86400000);
  if (day === 0) return "aujourd'hui";
  if (day === 1) return 'hier';
  if (day < 30) return `il y a ${day}j`;
  if (day < 365) return `il y a ${Math.floor(day / 30)}mois`;
  return date.toLocaleDateString('fr-FR');
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 50%, 45%)`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientRow {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  isSurveyable: boolean;
  role: { id: string; name: string; color: string } | null;
  _count: { tickets: number };
  openTicketsCount?: number;
  lastActivityAt?: string | null;
}

interface ClientsResponse {
  data: ClientRow[];
  total: number;
  page: number;
  totalPages: number;
}

interface ClientRole {
  id: string;
  name: string;
  color: string;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-muted/50 h-10 border-b" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-4 w-24 ml-4" />
          <Skeleton className="h-4 w-24 ml-4" />
          <Skeleton className="h-4 w-32 ml-4" />
          <Skeleton className="h-5 w-16 rounded-full ml-4" />
          <Skeleton className="h-4 w-12 ml-auto" />
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ClientListPage() {
  const navigate = useNavigate();
  const { openClientPanel } = useClientPanel();
  const { can } = usePermissions();

  const [search, setSearch] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [openOnly, setOpenOnly] = useState(false);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, roleIds, openOnly]);

  const { data, isLoading, isError, refetch } = useQuery<ClientsResponse>({
    queryKey: ['clients', debouncedSearch, roleIds, openOnly, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      roleIds.forEach(id => params.append('roleId[]', id));
      if (openOnly) params.set('hasOpenTickets', 'true');
      params.set('page', String(page));
      params.set('limit', '25');
      const res = await api.get(`/clients?${params.toString()}`);
      return res.data;
    },
  });

  const { data: clientRoles } = useQuery<ClientRole[]>({
    queryKey: ['client-roles-public'],
    queryFn: async () => (await api.get('/client-roles')).data?.data ?? [],
  });

  const roleOptions = (clientRoles ?? []).map(r => ({ value: r.id, label: r.name }));

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Clients</h1>
          {can('clients.create') && (
            <Button onClick={() => openClientPanel()}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau client
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par nom, société, email, téléphone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <MultiSelect
              options={roleOptions}
              value={roleIds}
              onChange={setRoleIds}
              placeholder="Filtrer par rôle"
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={openOnly}
                onChange={e => setOpenOnly(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Tickets ouverts uniquement
            </label>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Impossible de charger les clients</h3>
            <p className="text-muted-foreground text-sm mb-4">Une erreur est survenue lors du chargement.</p>
            <Button variant="outline" onClick={() => refetch()}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reessayer
            </Button>
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Aucun client</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search || roleIds.length > 0 || openOnly
                ? 'Aucun client ne correspond à vos filtres.'
                : 'Aucun client pour le moment.'}
            </p>
            {can('clients.create') && !search && roleIds.length === 0 && !openOnly && (
              <Button onClick={() => openClientPanel()}>
                <Plus className="h-4 w-4 mr-2" />
                Créer le premier client
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Nom</th>
                    <th className="px-4 py-3 text-left hidden xl:table-cell">Société</th>
                    <th className="px-4 py-3 text-left">Téléphone</th>
                    <th className="px-4 py-3 text-left hidden xl:table-cell">Email</th>
                    <th className="px-4 py-3 text-left">Rôle</th>
                    <th className="px-4 py-3 text-center hidden lg:table-cell">Enquêtes</th>
                    <th className="px-4 py-3 text-center">Ouverts</th>
                    <th className="px-4 py-3 text-center hidden lg:table-cell">Total</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">Dernière activité</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map(client => (
                    <tr key={client.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          to={`/clients/${client.id}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-semibold shrink-0"
                            style={{ backgroundColor: stringToColor(`${client.firstName} ${client.lastName}`) }}
                          >
                            {getInitials(client.firstName, client.lastName)}
                          </span>
                          <span className="font-medium">
                            {client.firstName} {client.lastName}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">
                        {client.company || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {client.phone
                          ? <a href={`tel:${client.phone}`} className="text-foreground hover:underline">{client.phone}</a>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {client.email
                          ? <a href={`mailto:${client.email}`} className="text-foreground hover:underline truncate block max-w-[160px]">{client.email}</a>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {client.role ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: client.role.color }}
                          >
                            {client.role.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        {!client.isSurveyable ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex justify-center">
                                <BellOff className="h-4 w-4 text-muted-foreground" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Enquêtes désactivées</TooltipContent>
                          </Tooltip>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full text-xs font-semibold
                            ${(client.openTicketsCount ?? 0) > 0
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-muted text-muted-foreground'}`}
                        >
                          {client.openTicketsCount ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground hidden lg:table-cell">
                        {client._count.tickets}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                        {relativeTime(client.lastActivityAt ?? null)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => navigate(`/clients/${client.id}`)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Voir</TooltipContent>
                          </Tooltip>
                          {can('clients.edit') && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => openClientPanel(client.id)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Modifier</TooltipContent>
                            </Tooltip>
                          )}
                          {can('tickets.create') && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => navigate(`/tickets/new?clientId=${client.id}`)}
                                >
                                  <Ticket className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Nouveau ticket</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {data.total} client{data.total !== 1 ? 's' : ''} au total
              </p>
              <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
