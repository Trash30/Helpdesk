import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Match {
  competition: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  venue?: string;
  country?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  broadcasterLogo?: string;
}

interface MatchAttachment {
  id: string;
  matchKey: string;
  originalName: string;
  size: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const COMPETITION_META: Record<string, { label: string; favicon: string }> = {
  LIGUE1:         { label: 'Ligue 1',       favicon: 'https://www.ligue1.com/favicon.ico' },
  TOP14:          { label: 'Top 14',        favicon: 'https://top14.lnr.fr/favicon.ico' },
  PRO_D2:         { label: 'Pro D2',        favicon: 'https://prod2.lnr.fr/favicon.ico' },
  EPCR:           { label: 'Champions Cup', favicon: 'https://media-cdn.incrowdsports.com/77535d85-bcdc-49b9-9dc9-879e70d9adba.svg' },
  EPCR_CHALLENGE: { label: 'Challenge Cup', favicon: 'https://media-cdn.incrowdsports.com/96d27751-bc48-42e6-890e-a389508ab133.svg' },
  SUPER_LEAGUE:   { label: 'Super League',  favicon: 'https://www.superleague.co.uk/favicon.ico' },
  LNH:            { label: 'Starligue',     favicon: 'https://www.lnh.fr/medias/_site/header/logo-lnh.svg' },
  ELMS:           { label: 'ELMS',          favicon: 'https://www.europeanlemansseries.com/favicon.ico' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMatchKey(m: Match): string {
  return `${m.competition}_${m.homeTeam}_${m.awayTeam}_${m.date}`;
}

function countryCodeToFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

function formatTime(m: Match): string {
  if (!m.time) return '';
  return m.time.replace(':', 'h');
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function TodayEventsPage() {
  const today = new Date();

  const { data: sportsData, isLoading } = useQuery({
    queryKey: ['sports-matches'],
    queryFn: () => api.get('/sports/matches').then((r) => r.data),
    staleTime: 1000 * 60 * 60,
  });

  // Filter to today only
  const todayMatches: Match[] = (sportsData?.data ?? []).filter((m: Match) => {
    const d = new Date(m.date);
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  });

  // Sort by time
  const sorted = [...todayMatches].sort((a, b) => a.date.localeCompare(b.date));

  // Build matchKeys for attachment query
  const matchKeys = sorted.map(getMatchKey);

  const { data: attachmentsData } = useQuery({
    queryKey: ['match-attachments-today', matchKeys],
    queryFn: async () => {
      if (matchKeys.length === 0) return [];
      return (
        (await api.post('/sports/match-attachments/query', { matchKeys })).data
          ?.data ?? []
      ) as MatchAttachment[];
    },
    enabled: matchKeys.length > 0,
  });

  const attachmentsByKey = new Map<string, MatchAttachment[]>();
  (attachmentsData ?? []).forEach((att) => {
    const list = attachmentsByKey.get(att.matchKey) ?? [];
    list.push(att);
    attachmentsByKey.set(att.matchKey, list);
  });

  // Group by competition
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold capitalize">
          Evenements du {dateLabel}
        </h1>
      </div>

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
            const meta = COMPETITION_META[comp] ?? {
              label: comp,
              favicon: '',
            };
            return (
              <Card key={comp} className="shadow-sm">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    {meta.favicon && (
                      <img
                        src={meta.favicon}
                        alt={meta.label}
                        className="w-5 h-5 object-contain rounded-sm"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    {meta.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 divide-y">
                  {matches.map((m, idx) => {
                    const key = getMatchKey(m);
                    const atts = attachmentsByKey.get(key) ?? [];
                    const isElms = m.competition === 'ELMS';
                    const isRace = m.awayTeam === 'Race';

                    return (
                      <div key={idx} className="py-3">
                        {isElms ? (
                          // ELMS layout
                          <div className="flex items-center gap-2">
                            {m.homeTeamLogo && (
                              <img
                                src={m.homeTeamLogo}
                                alt="ELMS"
                                className="w-5 h-5 object-contain shrink-0"
                              />
                            )}
                            {m.country && (
                              <span className="text-base leading-none">
                                {countryCodeToFlag(m.country)}
                              </span>
                            )}
                            <span className="text-sm font-medium flex-1 truncate">
                              {m.homeTeam.replace(/^ELMS\s+/i, '')}
                            </span>
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                                isRace
                                  ? 'bg-orange-100 text-orange-700 border border-orange-200'
                                  : 'bg-blue-100 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {m.awayTeam}
                            </span>
                            {m.time && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {formatTime(m)}
                              </span>
                            )}
                          </div>
                        ) : (
                          // Standard layout
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                              {m.homeTeamLogo && (
                                <img
                                  src={m.homeTeamLogo}
                                  alt={m.homeTeam}
                                  className="w-5 h-5 object-contain shrink-0"
                                  onError={(e) => {
                                    (
                                      e.target as HTMLImageElement
                                    ).style.display = 'none';
                                  }}
                                />
                              )}
                              <span className="text-sm font-medium truncate text-right">
                                {m.homeTeam}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground font-medium shrink-0">
                              vs
                            </span>
                            <div className="flex items-center gap-2 flex-1 justify-start min-w-0">
                              {m.awayTeamLogo && (
                                <img
                                  src={m.awayTeamLogo}
                                  alt={m.awayTeam}
                                  className="w-5 h-5 object-contain shrink-0"
                                  onError={(e) => {
                                    (
                                      e.target as HTMLImageElement
                                    ).style.display = 'none';
                                  }}
                                />
                              )}
                              <span className="text-sm font-medium truncate">
                                {m.awayTeam}
                              </span>
                            </div>
                            {m.time && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {formatTime(m)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Pieces jointes */}
                        {atts.length > 0 && (
                          <div className="mt-2 space-y-1 pl-2">
                            {atts.map((att) => (
                              <div
                                key={att.id}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                              >
                                <span>📄</span>
                                <button
                                  type="button"
                                  className="truncate hover:text-foreground hover:underline text-left"
                                  onClick={() =>
                                    window.open(
                                      `/api/sports/match-attachments/${att.id}/download`,
                                      '_blank',
                                    )
                                  }
                                >
                                  {att.originalName}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
