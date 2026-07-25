import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

function relativeTime(dateStr: string | null, t: TFunction): string {
  if (!dateStr) return t('time.never');
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const day = Math.floor(diff / 86400000);
  if (day === 0) return t('time.today');
  if (day === 1) return t('time.yesterday');
  if (day < 30) return t('time.daysAgo', { count: day });
  if (day < 365) return t('time.monthsAgo', { count: Math.floor(day / 30) });
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
  const { t } = useTranslation('clients');
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
          <h1 className="text-2xl font-bold">{t('list.title')}</h1>
          {can('clients.create') && (
            <Button onClick={() => openClientPanel()}>
              <Plus className="h-4 w-4 mr-2" />
              {t('list.newClient')}
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('list.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-11 sm:h-10 pl-9 pr-4 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <MultiSelect
              options={roleOptions}
              value={roleIds}
              onChange={setRoleIds}
              placeholder={t('list.filterByRole')}
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={openOnly}
                onChange={e => setOpenOnly(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              {t('list.openTicketsOnly')}
            </label>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('list.loadError')}</h3>
            <p className="text-muted-foreground text-sm mb-4">{t('list.loadErrorDesc')}</p>
            <Button variant="outline" onClick={() => refetch()}>
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('list.retry')}
            </Button>
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('list.empty')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search || roleIds.length > 0 || openOnly
                ? t('list.emptyFiltered')
                : t('list.emptyNone')}
            </p>
            {can('clients.create') && !search && roleIds.length === 0 && !openOnly && (
              <Button onClick={() => openClientPanel()}>
                <Plus className="h-4 w-4 mr-2" />
                {t('list.createFirst')}
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-2">
              {data.data.map(client => (
                <div
                  key={client.id}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="rounded-lg border bg-card p-3 active:bg-muted/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white text-xs font-semibold shrink-0"
                      style={{ backgroundColor: stringToColor(`${client.firstName} ${client.lastName}`) }}
                    >
                      {getInitials(client.firstName, client.lastName)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{client.firstName} {client.lastName}</p>
                      {client.company && <p className="text-xs text-muted-foreground truncate">{client.company}</p>}
                    </div>
                    {(client.openTicketsCount ?? 0) > 0 && (
                      <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 shrink-0">
                        {client.openTicketsCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {client.role && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: client.role.color }}
                      >
                        {client.role.name}
                      </span>
                    )}
                    {client.phone && (
                      <a href={`tel:${client.phone}`} onClick={e => e.stopPropagation()} className="text-xs text-muted-foreground hover:text-foreground">
                        {client.phone}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block rounded-lg border overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">{t('list.colName')}</th>
                    <th className="px-4 py-3 text-left hidden xl:table-cell">{t('list.colCompany')}</th>
                    <th className="px-4 py-3 text-left">{t('list.colPhone')}</th>
                    <th className="px-4 py-3 text-left hidden xl:table-cell">{t('list.colEmail')}</th>
                    <th className="px-4 py-3 text-left">{t('list.colRole')}</th>
                    <th className="px-4 py-3 text-center hidden lg:table-cell">{t('list.colSurveys')}</th>
                    <th className="px-4 py-3 text-center">{t('list.colOpen')}</th>
                    <th className="px-4 py-3 text-center hidden lg:table-cell">{t('list.colTotal')}</th>
                    <th className="px-4 py-3 text-left hidden lg:table-cell">{t('list.colLastActivity')}</th>
                    <th className="px-4 py-3 text-right">{t('list.colActions')}</th>
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
                        {client.company || '\u2014'}
                      </td>
                      <td className="px-4 py-3">
                        {client.phone
                          ? <a href={`tel:${client.phone}`} className="text-foreground hover:underline">{client.phone}</a>
                          : <span className="text-muted-foreground">\u2014</span>
                        }
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {client.email
                          ? <a href={`mailto:${client.email}`} className="text-foreground hover:underline truncate block max-w-[160px]">{client.email}</a>
                          : <span className="text-muted-foreground">\u2014</span>
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
                          <span className="text-muted-foreground">\u2014</span>
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
                            <TooltipContent>{t('list.surveysDisabled')}</TooltipContent>
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
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                        {relativeTime(client.lastActivityAt ?? null, t)}
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
                            <TooltipContent>{t('list.view')}</TooltipContent>
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
                              <TooltipContent>{t('list.edit')}</TooltipContent>
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
                              <TooltipContent>{t('list.newTicket')}</TooltipContent>
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs sm:text-sm text-muted-foreground shrink-0">
                {t('list.count', { count: data.total })}
              </p>
              <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
