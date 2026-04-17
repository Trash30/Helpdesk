import { useQuery } from '@tanstack/react-query';
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

export function TodayEventsPage() {
  const today = new Date();

  const { data: sportsData, isLoading } = useQuery({
    queryKey: ['sports-matches'],
    queryFn: () => api.get('/sports/matches').then((r) => r.data),
    staleTime: 1000 * 60 * 60,
  });

  const todayMatches: Match[] = (sportsData?.data ?? []).filter((m: Match) => {
    const d = new Date(m.date);
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
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
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold capitalize">
        Evenements du {dateLabel}
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
            Aucun evenement sportif aujourd&apos;hui.
          </CardContent>
        </Card>
      )}

      {!isLoading && sorted.length > 0 && (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([comp, matches]) => {
            const meta = COMPETITION_META[comp as keyof typeof COMPETITION_META] ?? { label: comp, favicon: '', calendarUrl: '' };
            return (
              <Card key={comp} className="shadow-sm">
                <CardHeader className="pb-2 pt-4">
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
                <CardContent className="pt-0 divide-y">
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
    </div>
  );
}
