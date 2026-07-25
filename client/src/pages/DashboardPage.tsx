import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';
import {
  Ticket as TicketIcon, Clock, CheckCircle,
  ExternalLink, AlertTriangle, CalendarDays, CalendarPlus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { getInitials, timeAgo, fullDate } from '@/lib/utils';
import { PRIORITY_TOKENS, STATUS_TOKENS } from '@/lib/colors';
import api from '@/lib/axios';
import { SportsMatchesWidget } from '@/components/sports/SportsMatchesWidget';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommercialEventUpcoming {
  id: string;
  clientName: string;
  startDate: string;
  endDate: string;
  location: string;
  competition: string;
  techContactFirstName: string;
  techContactLastName: string;
  techContactPhone: string;
  notes: string;
  createdBy: { id: string; firstName: string; lastName: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: PRIORITY_TOKENS.CRITICAL.solid,
  HIGH:     PRIORITY_TOKENS.HIGH.solid,
  MEDIUM:   PRIORITY_TOKENS.MEDIUM.solid,
  LOW:      PRIORITY_TOKENS.LOW.solid,
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  color: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
}

function KpiCard({ label, value, color, icon, children, onClick }: KpiCardProps) {
  return (
    <Card
      className={`shadow-sm overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
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
  const { t } = useTranslation('tickets');
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t('dashboard.urgentTickets')}</CardTitle>
          <Link
            to="/tickets?priority[]=CRITICAL&priority[]=HIGH&status[]=OPEN&status[]=IN_PROGRESS"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            {t('dashboard.viewAll')} <ExternalLink size={12} />
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
          <p className="px-6 py-4 text-sm text-muted-foreground">{t('dashboard.noUrgentTickets')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">{t('dashboard.columns.number')}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">{t('dashboard.columns.client')}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">{t('dashboard.columns.title')}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">{t('dashboard.columns.priority')}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">{t('dashboard.columns.status')}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs hidden lg:table-cell">{t('dashboard.columns.assigned')}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs hidden md:table-cell">{t('dashboard.columns.createdAt')}</th>
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
  const { t } = useTranslation('tickets');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const { can } = usePermissions();
  const user = useAuthStore((s) => s.user);
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

  const { data: commercialUpcoming } = useQuery({
    queryKey: ['commercial-events-upcoming'],
    queryFn: async () =>
      ((await api.get('/commercial-events/upcoming')).data?.data ?? []) as CommercialEventUpcoming[],
    staleTime: 1000 * 60 * 5,
  });
  const upcomingEvents: CommercialEventUpcoming[] = commercialUpcoming ?? [];

  const { data: sportsData } = useQuery({
    queryKey: ['sports-matches'],
    queryFn: () => api.get('/sports/matches').then(r => r.data),
    staleTime: 1000 * 60 * 60,
  });
  const userCompetitions = user?.sportCompetitions ?? [];
  const allSportsMatches: any[] = sportsData?.data ?? [];
  const filteredSportsMatches = userCompetitions.length > 0
    ? allSportsMatches.filter((m: any) => userCompetitions.includes(m.competition))
    : allSportsMatches;

  const sportsEventCount = filteredSportsMatches.length;

  const today = new Date();
  const todayEventCount = filteredSportsMatches.filter((m: any) => {
    const d = new Date(m.date);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  }).length;

  // Donut chart data
  const priorityData = stats?.ticketsByPriority
    ? Object.entries(stats.ticketsByPriority)
        .filter(([, v]) => (v as number) > 0)
        .map(([key, value]) => ({ name: tc(`priority.${key}`), value: value as number, key }))
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
      <h1 className="text-2xl font-bold">{t('dashboard.welcome', { name: user?.firstName ?? '' })}</h1>

      {/* ── ROW 1 — KPI cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
        {statsLoading ? (
          [...Array(4)].map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label={t('dashboard.kpiOpen')}
              value={stats?.openTickets ?? 0}
              color="var(--kpi-open)"
              icon={<TicketIcon size={20} />}
              onClick={() => navigate('/tickets?status[]=OPEN')}
            />

            <KpiCard
              label={t('dashboard.kpiInProgress')}
              value={stats?.inProgressTickets ?? 0}
              color="var(--kpi-progress)"
              icon={<Clock size={20} />}
              onClick={() => navigate('/tickets?status[]=IN_PROGRESS')}
            />

            <KpiCard
              label={t('dashboard.kpiClosedToday')}
              value={stats?.closedToday ?? stats?.resolvedToday ?? 0}
              color="var(--kpi-closed)"
              icon={<CheckCircle size={20} />}
              onClick={() => navigate('/tickets?status[]=CLOSED&status[]=RESOLVED')}
            />

            {/* Événements aujourd'hui */}
            <KpiCard
              label={t('dashboard.kpiEventsToday')}
              value={todayEventCount}
              color="var(--kpi-events-today)"
              icon={<CalendarDays size={20} />}
              onClick={() => navigate('/evenements/aujourd-hui')}
            >
              <p className="text-xs text-muted-foreground mt-1">{t('dashboard.kpiEventsTodaySub')}</p>
            </KpiCard>

            {/* Sports events this week */}
            <KpiCard
              label={t('dashboard.kpiEventsWeek')}
              value={sportsEventCount}
              color="var(--kpi-events-week)"
              icon={<CalendarDays size={20} />}
              onClick={() => { document.getElementById('sports-section')?.scrollIntoView({ behavior: 'smooth' }); }}
            >
              <p className="text-xs text-muted-foreground mt-1">{t('dashboard.kpiEventsWeekSub')}</p>
            </KpiCard>

            {/* Événements commerciaux J+30 */}
            {upcomingEvents.length > 0 && (
              <KpiCard
                label={t('dashboard.kpiMissionsJ30')}
                value={upcomingEvents.length}
                color="#185FA5"
                icon={<CalendarPlus size={20} />}
                onClick={() => { document.getElementById('commercial-events-section')?.scrollIntoView({ behavior: 'smooth' }); }}
              >
                <p className="text-xs text-muted-foreground mt-1">{t('dashboard.kpiMissionsJ30Sub')}</p>
              </KpiCard>
            )}

            {/* Stale tickets card */}
            {stats?.staleTickets !== undefined && (
              <KpiCard
                label={t('dashboard.kpiStale')}
                value={stats.staleTickets ?? 0}
                color="var(--kpi-warning)"
                icon={<AlertTriangle size={20} />}
                onClick={() => navigate('/tickets?status[]=OPEN&status[]=IN_PROGRESS&status[]=PENDING&staleDays=5')}
              >
                <p className="text-xs text-muted-foreground mt-1">{t('dashboard.kpiStaleSub')}</p>
              </KpiCard>
            )}

            {/* My stale tickets card (agents only) */}
            {!isAdmin && stats?.myStaleTickets !== undefined && (
              <KpiCard
                label={t('dashboard.kpiMyStale')}
                value={stats.myStaleTickets ?? 0}
                color="var(--kpi-warning)"
                icon={<Clock size={20} />}
                onClick={() => navigate('/tickets?status[]=OPEN&status[]=IN_PROGRESS&status[]=PENDING&staleDays=5&assignedToMe=true')}
              >
                <p className="text-xs text-muted-foreground mt-1">{t('dashboard.kpiMyStaleSub')}</p>
              </KpiCard>
            )}
          </>
        )}
      </div>

      {/* ── ROW 2 — Line chart + Donut ──────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Line chart — 60% */}
        <Card className="flex-[3] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dashboard.ticketsCreated30d')}</CardTitle>
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
                    formatter={(v: number) => [v, t('dashboard.tickets')]}
                    labelFormatter={(label: string) => label || ''}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#185FA5"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#185FA5' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Donut chart — 40% */}
        <Card className="flex-[2] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dashboard.byPriority')}</CardTitle>
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
                    <tspan fontSize="11" fill="currentColor">{t('dashboard.active')}</tspan>
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

      {/* ── ROW 3 — Bar chart ───────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4">
        <Card className="flex-1 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dashboard.ticketsByAgent')}</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : agentData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{t('dashboard.noData')}</p>
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
                    formatter={(v: number) => [v, t('dashboard.tickets')]}
                  />
                  <Bar dataKey="count" fill="#185FA5" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── ROW 4 — Urgent tickets table ────────────────────────────────── */}
      <UrgentTicketsTable tickets={urgentData ?? []} loading={urgentLoading} />

      {/* ── Événements commerciaux J+30 ─────────────────────────────── */}
      {upcomingEvents.length > 0 && (
        <div id="commercial-events-section">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarPlus size={16} className="text-primary" />
                  {t('dashboard.missionsTitle')}
                </CardTitle>
                <span className="text-xs text-muted-foreground">{t('dashboard.missionCount', { count: upcomingEvents.length })}</span>
              </div>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              <div className="divide-y">
                {upcomingEvents.map((ev) => {
                  const evLocale = i18n.language === 'en' ? 'en-US' : 'fr-FR';
                  const fmtDate = (iso: string) =>
                    new Date(iso).toLocaleDateString(evLocale, { day: '2-digit', month: '2-digit' });
                  const fmtTime = (iso: string) =>
                    new Date(iso).toLocaleTimeString(evLocale, { hour: '2-digit', minute: '2-digit' });
                  const isSameDay =
                    new Date(ev.startDate).toDateString() === new Date(ev.endDate).toDateString();
                  const dateRange = isSameDay
                    ? `${fmtDate(ev.startDate)} · ${fmtTime(ev.startDate)} → ${fmtTime(ev.endDate)}`
                    : `${fmtDate(ev.startDate)} ${fmtTime(ev.startDate)} → ${fmtDate(ev.endDate)} ${fmtTime(ev.endDate)}`;
                  return (
                    <div key={ev.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 hover:bg-muted/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{ev.clientName}</span>
                          {ev.competition && (
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">{ev.competition}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{dateRange} · {ev.location}</div>
                        {ev.notes && <div className="text-xs text-muted-foreground italic mt-0.5 truncate">{ev.notes}</div>}
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {ev.techContactFirstName} {ev.techContactLastName}
                        {ev.techContactPhone && (
                          <a href={`tel:${ev.techContactPhone}`} className="ml-2 underline hover:text-foreground">{ev.techContactPhone}</a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ROW 5 — Tickets by Organisation (admin only) ────────────────── */}
      {can('tickets.viewAll') && (stats?.ticketsByOrganisation ?? []).length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('dashboard.ticketsByOrganisation')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">{t('dashboard.colOrganisation')}</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('dashboard.colTotal')}</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('dashboard.colOpen')}</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('dashboard.colInProgress')}</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs hidden lg:table-cell">{t('dashboard.colPending')}</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('dashboard.colClosed')}</th>
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
                        <td className="px-4 py-3 text-right font-medium" style={{ color: STATUS_TOKENS.OPEN.fg }}>{org.open}</td>
                        <td className="px-4 py-3 text-right font-medium" style={{ color: STATUS_TOKENS.IN_PROGRESS.fg }}>{org.inProgress}</td>
                        <td className="px-4 py-3 text-right font-medium hidden lg:table-cell" style={{ color: STATUS_TOKENS.PENDING.fg }}>{org.pending}</td>
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
            <CardTitle className="text-base">{t('dashboard.ticketsByClub')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">{t('dashboard.colClub')}</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('dashboard.colTotal')}</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('dashboard.colOpen')}</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('dashboard.colInProgress')}</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('dashboard.colPending')}</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('dashboard.colClosed')}</th>
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
                        <td className="px-4 py-3 text-right font-medium" style={{ color: STATUS_TOKENS.OPEN.fg }}>{club.open}</td>
                        <td className="px-4 py-3 text-right font-medium" style={{ color: STATUS_TOKENS.IN_PROGRESS.fg }}>{club.inProgress}</td>
                        <td className="px-4 py-3 text-right font-medium" style={{ color: STATUS_TOKENS.PENDING.fg }}>{club.pending}</td>
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
      <div id="sports-section">
        <SportsMatchesWidget />
      </div>
    </div>
  );
}
