import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';
import {
  Ticket as TicketIcon, Clock, CheckCircle, Star,
  ExternalLink, AlertTriangle,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { getInitials, timeAgo, fullDate } from '@/lib/utils';
import api from '@/lib/axios';
import { SportsMatchesWidget } from '@/components/sports/SportsMatchesWidget';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function csatColor(score: number): string {
  if (score < 50) return '#E24B4A';
  if (score <= 75) return '#EF9F27';
  return '#639922';
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#E24B4A',
  HIGH: '#EF9F27',
  MEDIUM: '#378ADD',
  LOW: '#639922',
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Critique',
  HIGH: 'Haute',
  MEDIUM: 'Moyenne',
  LOW: 'Basse',
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  color: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}

function KpiCard({ label, value, color, icon, children }: KpiCardProps) {
  return (
    <Card className="shadow-sm overflow-hidden">
      <div style={{ height: '3px', backgroundColor: color }} />
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <span style={{ color }} className="opacity-80">{icon}</span>
        </div>
        <p className="text-3xl font-bold" style={{ color }}>{value}</p>
        {children}
      </CardContent>
    </Card>
  );
}

function KpiSkeleton() {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-5 rounded" />
        </div>
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-2 w-full" />
      </CardContent>
    </Card>
  );
}

// ─── Urgent tickets table ─────────────────────────────────────────────────────

interface UrgentTicketsTableProps {
  tickets: any[];
  loading: boolean;
}

function UrgentTicketsTable({ tickets, loading }: UrgentTicketsTableProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Tickets urgents</CardTitle>
          <Link
            to="/tickets?priority[]=CRITICAL&priority[]=HIGH&status[]=OPEN&status[]=IN_PROGRESS"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Voir tous <ExternalLink size={12} />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        {loading ? (
          <div className="px-6 space-y-3 py-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <p className="px-6 py-4 text-sm text-muted-foreground">Aucun ticket urgent.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">#</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Client</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Titre</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Priorité</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Statut</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs hidden lg:table-cell">Assigné</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs hidden md:table-cell">Créé le</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket: any) => (
                  <tr key={ticket.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={`/tickets/${ticket.id}`}
                        className="font-mono text-xs text-primary hover:underline font-semibold"
                      >
                        {ticket.ticketNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium leading-tight">
                        {ticket.client?.firstName} {ticket.client?.lastName}
                      </p>
                      {ticket.client?.phone && (
                        <p className="text-xs text-muted-foreground">{ticket.client.phone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="truncate text-sm" title={ticket.title}>{ticket.title}</p>
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
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold shrink-0">
                            {getInitials(ticket.assignedTo.firstName, ticket.assignedTo.lastName)}
                          </span>
                          <span className="text-xs truncate max-w-[80px]">
                            {ticket.assignedTo.firstName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground cursor-default">
                              {timeAgo(ticket.createdAt)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{fullDate(ticket.createdAt)}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const isAdmin = can('admin.access');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data.data),
    refetchInterval: 60000,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['dashboard-trends'],
    queryFn: () => api.get('/dashboard/trends').then(r => r.data.data),
    refetchInterval: 60000,
  });

  const { data: urgentData, isLoading: urgentLoading } = useQuery({
    queryKey: ['dashboard-urgent'],
    queryFn: () =>
      api
        .get('/tickets?priority[]=CRITICAL&priority[]=HIGH&status[]=OPEN&status[]=IN_PROGRESS&limit=10')
        .then(r => r.data.data ?? []),
    refetchInterval: 60000,
  });

  const csat = stats?.csatGlobal;
  const csatScore = csat?.score ?? 0;
  const csatColorVal = csatColor(csatScore);

  // Donut chart data
  const priorityData = stats?.ticketsByPriority
    ? Object.entries(stats.ticketsByPriority)
        .filter(([, v]) => (v as number) > 0)
        .map(([key, value]) => ({ name: PRIORITY_LABELS[key] ?? key, value: value as number, key }))
    : [];

  const donutTotal = priorityData.reduce((sum, d) => sum + d.value, 0);

  // Bar chart data (agent names trimmed to 10 chars)
  const agentData = (stats?.ticketsByAgent ?? []).map((a: any) => ({
    name: a.agentName.split(' ')[0].substring(0, 10),
    count: a.count,
  }));

  // Trend data: show every 7th date label only
  const trendData = (trends ?? []).map((d: any, i: number) => ({
    ...d,
    displayDate: i % 7 === 0 ? d.date.slice(5) : '', // MM-DD
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      {/* ── ROW 1 — KPI cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
        {statsLoading ? (
          [...Array(4)].map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label="Tickets ouverts"
              value={stats?.openTickets ?? 0}
              color="#0070C1"
              icon={<TicketIcon size={20} />}
            />

            <KpiCard
              label="En cours"
              value={stats?.inProgressTickets ?? 0}
              color="#EF9F27"
              icon={<Clock size={20} />}
            />

            <KpiCard
              label="Fermés aujourd'hui"
              value={stats?.closedToday ?? stats?.resolvedToday ?? 0}
              color="#639922"
              icon={<CheckCircle size={20} />}
            />

            {/* CSAT Card */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <KpiCard
                      label="CSAT global"
                      value={`${csatScore.toFixed(1)}%`}
                      color={csatColorVal}
                      icon={<Star size={20} />}
                    >
                      <div className="mt-2 space-y-1">
                        {/* Progress bar */}
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${csatScore}%`, backgroundColor: csatColorVal }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{csat?.total ?? 0} réponses</span>
                          {csat?.vsLastMonth !== undefined && csat.vsLastMonth !== 0 && (
                            <span
                              className="text-xs font-semibold px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: csat.vsLastMonth > 0 ? '#EAF3DE' : '#FCEBEB',
                                color: csat.vsLastMonth > 0 ? '#3B6D11' : '#A32D2D',
                              }}
                            >
                              {csat.vsLastMonth > 0 ? '+' : ''}{csat.vsLastMonth.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </KpiCard>
                  </div>
                </TooltipTrigger>
                {csat && (
                  <TooltipContent className="space-y-1 text-xs" side="bottom">
                    <p>Satisfaits (≥4) : <strong>{csat.satisfied}</strong></p>
                    <p>Neutres (=3) : <strong>{csat.neutral}</strong></p>
                    <p>Non satisfaits (≤2) : <strong>{csat.unsatisfied}</strong></p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>

            {/* Stale tickets card */}
            {stats?.staleTickets !== undefined && (
              <Card
                className={`cursor-pointer transition-colors hover:shadow-md ${
                  (stats.staleTickets ?? 0) > 0
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                    : 'hover:bg-muted/40'
                }`}
                onClick={() => navigate('/tickets?status[]=OPEN&status[]=IN_PROGRESS&status[]=PENDING&staleDays=5')}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground font-medium">Tickets en attente de MAJ</p>
                    <span className={`opacity-80 ${(stats.staleTickets ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                      <AlertTriangle size={20} />
                    </span>
                  </div>
                  <p className={`text-3xl font-bold ${(stats.staleTickets ?? 0) > 0 ? 'text-amber-700 dark:text-amber-200' : 'text-foreground'}`}>
                    {stats.staleTickets ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Sans MAJ depuis &gt; 5 jours</p>
                </CardContent>
              </Card>
            )}

            {/* My stale tickets card (agents only) */}
            {!isAdmin && stats?.myStaleTickets !== undefined && (
              <Card
                className={`cursor-pointer transition-colors hover:shadow-md ${
                  (stats.myStaleTickets ?? 0) > 0
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                    : 'hover:bg-muted/40'
                }`}
                onClick={() => navigate('/tickets?status[]=OPEN&status[]=IN_PROGRESS&status[]=PENDING&staleDays=5&assignedToMe=true')}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground font-medium">Mes tickets en attente de MAJ</p>
                    <span className={`opacity-80 ${(stats.myStaleTickets ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                      <Clock size={20} />
                    </span>
                  </div>
                  <p className={`text-3xl font-bold ${(stats.myStaleTickets ?? 0) > 0 ? 'text-amber-700 dark:text-amber-200' : 'text-foreground'}`}>
                    {stats.myStaleTickets ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Mes tickets sans MAJ &gt; 5j</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* ── ROW 2 — Line chart + Donut ──────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Line chart — 60% */}
        <Card className="flex-[3] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tickets créés — 30 derniers jours</CardTitle>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6 }}
                    formatter={(v: number) => [v, 'Tickets']}
                    labelFormatter={(label: string) => label || ''}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#0070C1"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#0070C1' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Donut chart — 40% */}
        <Card className="flex-[2] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Par priorité</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    labelLine={false}
                  >
                    {priorityData.map((entry) => (
                      <Cell key={entry.key} fill={PRIORITY_COLORS[entry.key] ?? '#888'} />
                    ))}
                  </Pie>
                  {/* Center label via custom component trick */}
                  <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" className="text-foreground">
                    <tspan fontSize="22" fontWeight="700" fill="currentColor">{donutTotal}</tspan>
                  </text>
                  <text x="50%" y="56%" textAnchor="middle" dominantBaseline="central" className="text-muted-foreground">
                    <tspan fontSize="11" fill="currentColor">actifs</tspan>
                  </text>
                  <RechartsTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6 }}
                    formatter={(v: number, _: string, entry: any) => [v, entry.payload.name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {/* Legend */}
            {!statsLoading && (
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
                {priorityData.map(d => (
                  <div key={d.key} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[d.key] }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 3 — Bar chart + Recent activity ─────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Horizontal bar chart — 50% */}
        <Card className="flex-1 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tickets par agent</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : agentData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Aucune donnée disponible.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, agentData.length * 36)}>
                <BarChart
                  data={agentData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={70}
                  />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6 }}
                    formatter={(v: number) => [v, 'Tickets']}
                  />
                  <Bar dataKey="count" fill="#0070C1" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent activity — 50% */}
        <Card className="flex-1 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Activité récente</CardTitle>
              <Link to="/tickets" className="text-xs text-primary hover:underline">Voir tout</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {statsLoading ? (
              <div className="px-6 space-y-3 py-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (stats?.recentActivity ?? []).length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">Aucune activité récente.</p>
            ) : (
              <ul className="divide-y">
                {(stats?.recentActivity ?? []).map((log: any) => (
                  <li key={log.id} className="flex items-start gap-3 px-6 py-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                      {log.user
                        ? getInitials(log.user.firstName, log.user.lastName)
                        : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Système'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {log.action}
                        {log.ticket && (
                          <> — <Link to={`/tickets/${log.ticketId}`} className="text-primary hover:underline">{log.ticket.ticketNumber}</Link></>
                        )}
                      </p>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground shrink-0 cursor-default">
                            {timeAgo(log.createdAt)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{fullDate(log.createdAt)}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 4 — Urgent tickets table ────────────────────────────────── */}
      <UrgentTicketsTable tickets={urgentData ?? []} loading={urgentLoading} />

      {/* ── ROW 5 — Tickets by Organisation (admin only) ────────────────── */}
      {can('tickets.viewAll') && (stats?.ticketsByOrganisation ?? []).length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tickets par Organisation</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Organisation</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Total</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Ouverts</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">En cours</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs hidden lg:table-cell">En attente</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Fermés</th>
                  </tr>
                </thead>
                <tbody>
                  {[...stats.ticketsByOrganisation]
                    .sort((a: any, b: any) => b.total - a.total)
                    .map((org: any) => (
                      <tr
                        key={org.organisationId}
                        className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => navigate(`/tickets?organisationId=${org.organisationId}`)}
                      >
                        <td className="px-4 py-3 font-medium">{org.organisationName}</td>
                        <td className="px-4 py-3 text-right font-semibold">{org.total}</td>
                        <td className="px-4 py-3 text-right text-blue-600">{org.open}</td>
                        <td className="px-4 py-3 text-right text-orange-600">{org.inProgress}</td>
                        <td className="px-4 py-3 text-right text-pink-600 hidden lg:table-cell">{org.pending}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{org.closed}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ROW 6 — Tickets by Club (admin only) ─────────────────────────── */}
      {can('tickets.viewAll') && (stats?.ticketsByClub ?? []).length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tickets par Club</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Club</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Total</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Ouverts</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">En cours</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">En attente</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Fermés</th>
                  </tr>
                </thead>
                <tbody>
                  {[...stats.ticketsByClub]
                    .sort((a: any, b: any) => b.total - a.total)
                    .map((club: any) => (
                      <tr
                        key={club.clubId}
                        className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => navigate(`/tickets?clubId=${club.clubId}`)}
                      >
                        <td className="px-4 py-3 font-medium">{club.clubName}</td>
                        <td className="px-4 py-3 text-right font-semibold">{club.total}</td>
                        <td className="px-4 py-3 text-right text-blue-600">{club.open}</td>
                        <td className="px-4 py-3 text-right text-orange-600">{club.inProgress}</td>
                        <td className="px-4 py-3 text-right text-pink-600">{club.pending}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{club.closed}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ROW 7 — Sports Matches Widget ─────────────────────────────────── */}
      <SportsMatchesWidget />
    </div>
  );
}
