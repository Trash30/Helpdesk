import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Match,
  MatchAttachment,
  MatchNoteData,
  getMatchKey,
  ElmsMatchRow,
  MatchRow,
  COMPETITION_META,
} from '@/components/sports/SportsMatchesWidget';
import { useAuthStore } from '@/stores/authStore';

interface CommercialEvent {
  id: string;
  clientName: string;
  startDate: string;
  endDate: string;
  location: string;
  competition: string;
  createdBy: { id: string; firstName: string; lastName: string };
}

export function TodayEventsPage() {
  const { t } = useTranslation('sports');
  const today = new Date();
  const { user } = useAuthStore();

  const { data: sportsData, isLoading } = useQuery({
    queryKey: ['sports-matches'],
    queryFn: () => api.get('/sports/matches').then((r) => r.data),
    staleTime: 1000 * 60 * 60,
  });

  const userCompetitions = user?.sportCompetitions ?? [];
  const todayMatches: Match[] = (sportsData?.data ?? []).filter((m: Match) => {
    const d = new Date(m.date);
    const isToday =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    const inPrefs = userCompetitions.length === 0 || userCompetitions.includes(m.competition);
    return isToday && inPrefs;
  });

  const sorted = [...todayMatches].sort((a, b) => a.time.localeCompare(b.time));
  const matchKeys = sorted.map(getMatchKey);

  const { data: attachmentsData } = useQuery({
    queryKey: ['match-attachments-today', matchKeys],
    queryFn: async () => {
      if (matchKeys.length === 0) return [];
      return ((await api.post('/sports/match-attachments/query', { matchKeys })).data?.data ?? []) as MatchAttachment[];
    },
    enabled: matchKeys.length > 0,
  });

  const { data: notesData } = useQuery({
    queryKey: ['match-notes'],
    queryFn: async () => ((await api.get('/sports/match-notes')).data?.data ?? []) as MatchNoteData[],
    enabled: matchKeys.length > 0,
  });

  const attachmentsByKey = new Map<string, MatchAttachment[]>();
  (attachmentsData ?? []).forEach((att) => {
    const list = attachmentsByKey.get(att.matchKey) ?? [];
    list.push(att);
    attachmentsByKey.set(att.matchKey, list);
  });

  const notesByKey = new Map<string, MatchNoteData>();
  (notesData ?? []).forEach((note) => notesByKey.set(note.matchKey, note));

  const { data: commercialEventsData } = useQuery({
    queryKey: ['commercial-events-today'],
    queryFn: async () => ((await api.get('/commercial-events/today')).data?.data ?? []) as CommercialEvent[],
    staleTime: 1000 * 60 * 5,
  });
  const commercialEvents: CommercialEvent[] = commercialEventsData ?? [];

  const grouped = new Map<string, Match[]>();
  for (const m of sorted) {
    const list = grouped.get(m.competition) ?? [];
    list.push(m);
    grouped.set(m.competition, list);
  }

  const dateLabel = today.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold capitalize">
        {t('todayEvents.title', { date: dateLabel })}
      </h1>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('todayEvents.empty')}
          </CardContent>
        </Card>
      )}

      {!isLoading && sorted.length > 0 && (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([comp, matches]) => {
            const meta = COMPETITION_META[comp as keyof typeof COMPETITION_META] ?? { label: comp, favicon: '', calendarUrl: '' };
            return (
              <Card key={comp} className="shadow-sm overflow-hidden">
                <CardHeader className="pb-2 pt-4 px-3 sm:px-6">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    {meta.favicon && (
                      <img
                        src={meta.favicon}
                        alt={meta.label}
                        className="w-5 h-5 object-contain rounded-sm"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    {meta.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 divide-y px-2 sm:px-6 overflow-x-hidden">
                  {matches.map((m, idx) => {
                    const key = getMatchKey(m);
                    return m.competition === 'ELMS' ? (
                      <ElmsMatchRow
                        key={`${key}-${idx}`}
                        match={m}
                        attachments={attachmentsByKey.get(key) ?? []}
                        existingNote={notesByKey.get(key)}
                      />
                    ) : (
                      <MatchRow
                        key={`${key}-${idx}`}
                        match={m}
                        attachments={attachmentsByKey.get(key) ?? []}
                        existingNote={notesByKey.get(key)}
                      />
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {commercialEvents.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="text-base font-semibold text-foreground">{t('todayEvents.missionsTitle')}</h2>
          {commercialEvents.map((ev) => {
            const fmt = (iso: string) =>
              new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            return (
              <Card key={ev.id} className="shadow-sm">
                <CardContent className="py-3 px-4 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{ev.clientName}</span>
                    <span className="text-xs text-muted-foreground">{fmt(ev.startDate)} → {fmt(ev.endDate)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{ev.location} · {ev.competition}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
