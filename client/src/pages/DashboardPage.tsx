import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CalendarPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('welcome', { name: user?.firstName ?? '' })}</h1>

      {/* ── KPI cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Événements aujourd'hui */}
            <KpiCard
              label={t('kpiEventsToday')}
              value={todayEventCount}
              color="var(--kpi-events-today)"
              icon={<CalendarDays size={20} />}
              onClick={() => navigate('/evenements/aujourd-hui')}
            >
              <p className="text-xs text-muted-foreground mt-1">{t('kpiEventsTodaySub')}</p>
            </KpiCard>

            {/* Sports events this week */}
            <KpiCard
              label={t('kpiEventsWeek')}
              value={sportsEventCount}
              color="var(--kpi-events-week)"
              icon={<CalendarDays size={20} />}
              onClick={() => { document.getElementById('sports-section')?.scrollIntoView({ behavior: 'smooth' }); }}
            >
              <p className="text-xs text-muted-foreground mt-1">{t('kpiEventsWeekSub')}</p>
            </KpiCard>

            {/* Événements commerciaux J+30 */}
            {upcomingEvents.length > 0 && (
              <KpiCard
                label={t('kpiMissionsJ30')}
                value={upcomingEvents.length}
                color="#185FA5"
                icon={<CalendarPlus size={20} />}
                onClick={() => { document.getElementById('commercial-events-section')?.scrollIntoView({ behavior: 'smooth' }); }}
              >
                <p className="text-xs text-muted-foreground mt-1">{t('kpiMissionsJ30Sub')}</p>
              </KpiCard>
            )}
      </div>

      {/* ── Événements commerciaux J+30 ─────────────────────────────── */}
      {upcomingEvents.length > 0 && (
        <div id="commercial-events-section">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarPlus size={16} className="text-primary" />
                  {t('missionsTitle')}
                </CardTitle>
                <span className="text-xs text-muted-foreground">{t('missionCount', { count: upcomingEvents.length })}</span>
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

      {/* ── ROW 7 — Sports Matches Widget ─────────────────────────────────── */}
      <div id="sports-section">
        <SportsMatchesWidget />
      </div>
    </div>
  );
}
