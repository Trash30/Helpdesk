import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle, BellOff, Phone, Mail, Plus, Ticket,
  Pencil, Trash2, ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/axios';
import { useClientPanel } from '@/contexts/ClientPanelContext';
import { usePermissions } from '@/hooks/usePermissions';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 50%, 45%)`;
}

function formatHours(hours: number): string {
  if (hours < 1) return '< 1h';
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `${days}j`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientDetail {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  isSurveyable: boolean;
  notes: string | null;
  createdAt: string;
  roleId: string | null;
  role: { id: string; name: string; color: string } | null;
  organisation: { id: string; name: string } | null;
  club: { id: string; name: string } | null;
  tickets: TicketRow[];
  _count: {
    tickets: number;
    openTickets?: number;
    resolvedTickets?: number;
  };
  avgResolutionHours?: number | null;
}

interface TicketRow {
  id: string;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  category: { name: string; color: string } | null;
  assignedTo: { firstName: string; lastName: string } | null;
}

// ── KPI mini-card ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  color = '#6b7280',
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="border rounded-lg px-4 py-3 text-center">
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { openClientPanel } = useClientPanel();
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: client, isLoading, error } = useQuery<ClientDetail>({
    queryKey: ['client-detail', id],
    queryFn: async () => (await api.get(`/clients/${id}`)).data?.data,
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/clients/${id}`),
    onSuccess: () => {
      toast.success('Client supprimé');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      navigate('/clients');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? 'Erreur lors de la suppression';
      toast.error(msg);
    },
  });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync();
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground">Client introuvable.</p>
        <Button variant="ghost" onClick={() => navigate('/clients')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux clients
        </Button>
      </div>
    );
  }

  const openCount = client._count.openTickets ?? 0;
  const resolvedCount = client._count.resolvedTickets ?? 0;
  const totalCount = client._count.tickets;
  const avgResolution = client.avgResolutionHours ?? null;

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-4xl">
        {/* Back link */}
        <Link to="/clients" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Retour aux clients
        </Link>

        {/* Header */}
        <div className="flex items-start gap-3 sm:gap-4">
          <div
            className="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold shrink-0"
            style={{ backgroundColor: stringToColor(`${client.firstName} ${client.lastName}`) }}
          >
            {getInitials(client.firstName, client.lastName)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold break-words">{client.firstName} {client.lastName}</h1>
            {client.role && (
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold text-white mt-1"
                style={{ backgroundColor: client.role.color }}
              >
                {client.role.name}
              </span>
            )}
          </div>
          {can('clients.edit') && (
            <Button variant="outline" onClick={() => openClientPanel(client.id)}>
              <Pencil className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          )}
        </div>

        <Separator />

        {/* Info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Société</p>
            <p>{client.company || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Téléphone</p>
            {client.phone
              ? <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 text-primary hover:underline"><Phone className="h-3.5 w-3.5" />{client.phone}</a>
              : <p className="text-muted-foreground">—</p>
            }
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Email</p>
            {client.email
              ? <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-primary hover:underline"><Mail className="h-3.5 w-3.5" />{client.email}</a>
              : <p className="text-muted-foreground">—</p>
            }
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Organisation</p>
            <p>{client.organisation?.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Club / Ville</p>
            <p>{client.club?.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Enquêtes</p>
            {client.isSurveyable ? (
              <span className="flex items-center gap-1.5 text-green-700">
                <CheckCircle className="h-4 w-4" />Activées
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <BellOff className="h-4 w-4" />Désactivées
              </span>
            )}
          </div>
          {client.notes && (
            <div className="col-span-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Membre depuis</p>
            <p>{new Date(client.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        <Separator />

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Total tickets" value={totalCount} />
          <KpiCard label="Tickets ouverts" value={openCount} color={openCount > 0 ? '#185FA5' : '#6b7280'} />
          <KpiCard label="Tickets résolus" value={resolvedCount} color="#3B6D11" />
          <KpiCard
            label="Temps moyen résolution"
            value={avgResolution != null ? formatHours(avgResolution) : '—'}
          />
        </div>

        <Separator />

        {/* Ticket history */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Historique des tickets</h2>
              <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium">
                {totalCount}
              </span>
            </div>
            {can('tickets.create') && (
              <Button
                size="sm"
                variant="outline"
                className="w-full sm:w-auto h-10 sm:h-8"
                onClick={() => navigate(`/tickets/new?clientId=${client.id}`)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Cr\u00e9er un ticket
              </Button>
            )}
          </div>

          {client.tickets.length === 0 ? (
            <div className="text-center py-12 border rounded-lg">
              <Ticket className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Aucun ticket pour ce client</p>
            </div>
          ) : (
            <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-2">
              {client.tickets.map(ticket => (
                <div
                  key={ticket.id}
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                  className="rounded-lg border bg-card p-3 active:bg-muted/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-primary font-medium">{ticket.ticketNumber}</span>
                    <span className="text-xs text-muted-foreground">{relativeTime(ticket.createdAt)}</span>
                  </div>
                  <p className="text-sm font-medium leading-snug line-clamp-2 mb-2">{ticket.title}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={ticket.status} />
                    {ticket.category && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: ticket.category.color }}
                      >
                        {ticket.category.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Titre</th>
                    <th className="px-4 py-3 text-left hidden lg:table-cell">Cat\u00e9gorie</th>
                    <th className="px-4 py-3 text-left">Priorit\u00e9</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                    <th className="px-4 py-3 text-left hidden lg:table-cell">Assign\u00e9</th>
                    <th className="px-4 py-3 text-left">Cr\u00e9\u00e9 le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {client.tickets.map(ticket => (
                    <tr
                      key={ticket.id}
                      className="hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-primary text-xs font-medium">
                          {ticket.ticketNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[240px]">
                        <span className="truncate block">
                          {ticket.title.length > 60 ? ticket.title.slice(0, 60) + '\u2026' : ticket.title}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {ticket.category ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: ticket.category.color }}
                          >
                            {ticket.category.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">\u2014</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><PriorityBadge priority={ticket.priority} /></td>
                      <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {ticket.assignedTo
                          ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
                          : '\u2014'}
                      </td>
                      <td className="px-4 py-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground cursor-default">
                              {relativeTime(ticket.createdAt)}
                            </span>
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
            </>
          )}
        </div>

        {/* Danger zone */}
        {can('clients.delete') && (
          <>
            <Separator />
            <div className="border border-destructive/30 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-destructive">Zone de danger</h3>
              <p className="text-sm text-muted-foreground">
                La suppression d'un client est irréversible. Tous ses tickets doivent être fermés au préalable.
              </p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                      disabled={openCount > 0}
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer ce client
                    </Button>
                  </span>
                </TooltipTrigger>
                {openCount > 0 && (
                  <TooltipContent>
                    Ce client a {openCount} ticket{openCount > 1 ? 's' : ''} ouvert{openCount > 1 ? 's' : ''}
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </>
        )}
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={open => !open && setShowDeleteConfirm(false)}
        title={`Supprimer ${client.firstName} ${client.lastName} ?`}
        description="Cette action est irréversible. Toutes les données associées à ce client seront définitivement supprimées."
        confirmLabel="Supprimer"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </TooltipProvider>
  );
}
