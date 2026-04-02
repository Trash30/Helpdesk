import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';

// ─── Types ───────────────────────────────────────────────────────────────────

type Competition = 'LNH' | 'PRO_D2' | 'TOP14';

interface Match {
  competition: Competition;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  venue?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
}

interface SportsMatchesResponse {
  data: Match[];
  lastUpdated: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COMPETITION_META: Record<Competition, { label: string; favicon: string }> = {
  TOP14:  { label: 'Top 14',    favicon: 'https://top14.lnr.fr/favicon.ico' },
  PRO_D2: { label: 'Pro D2',    favicon: 'https://prod2.lnr.fr/favicon.ico' },
  LNH:    { label: 'Starligue', favicon: 'https://www.lnh.fr/favicon.ico' },
};

const COMPETITION_ORDER: Competition[] = ['TOP14', 'PRO_D2', 'LNH'];

const DAY_NAMES = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitialsFromTeam(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function formatMatchDate(dateStr: string, time: string): string {
  const d = new Date(dateStr);
  const day = DAY_NAMES[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');

  if (!time) {
    return `${day} ${dd}/${mm}`;
  }

  const formattedTime = time.replace(':', 'h');
  return `${day} ${dd}/${mm} \u00B7 ${formattedTime}`;
}

function groupAndSort(matches: Match[]): Map<Competition, Match[]> {
  const grouped = new Map<Competition, Match[]>();

  for (const comp of COMPETITION_ORDER) {
    const compMatches = matches
      .filter((m) => m.competition === comp)
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });

    if (compMatches.length > 0) {
      grouped.set(comp, compMatches);
    }
  }

  return grouped;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface TeamLogoProps {
  logoUrl?: string;
  teamName: string;
}

function TeamLogo({ logoUrl, teamName }: TeamLogoProps) {
  const [hasError, setHasError] = useState(false);

  if (!logoUrl || hasError) {
    return (
      <div className="w-6 h-6 rounded-sm bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
        {getInitialsFromTeam(teamName)}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={teamName}
      className="w-6 h-6 object-contain rounded-sm shrink-0"
      onError={() => setHasError(true)}
    />
  );
}

interface MatchRowProps {
  match: Match;
}

function MatchRow({ match }: MatchRowProps) {
  return (
    <div className="flex flex-col items-center gap-1 py-2.5 px-3">
      <div className="flex items-center justify-center gap-2 w-full">
        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          <span className="text-sm font-medium truncate text-right">{match.homeTeam}</span>
          <TeamLogo logoUrl={match.homeTeamLogo} teamName={match.homeTeam} />
        </div>

        <span className="text-xs text-muted-foreground font-medium px-1.5 shrink-0">vs</span>

        <div className="flex items-center gap-2 flex-1 justify-start min-w-0">
          <TeamLogo logoUrl={match.awayTeamLogo} teamName={match.awayTeam} />
          <span className="text-sm font-medium truncate">{match.awayTeam}</span>
        </div>
      </div>

      <span className="text-xs text-muted-foreground">
        {formatMatchDate(match.date, match.time)}
      </span>
    </div>
  );
}

// ─── Main Widget ─────────────────────────────────────────────────────────────

export function SportsMatchesWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sports-matches'],
    queryFn: async () => (await api.get('/sports/matches')).data as SportsMatchesResponse,
    staleTime: 1000 * 60 * 60,
  });

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Matchs de la semaine</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <LoadingSkeleton />}

        {isError && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Donn&eacute;es non disponibles
          </p>
        )}

        {!isLoading && !isError && data && <MatchesList matches={data.data} />}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

interface MatchesListProps {
  matches: Match[];
}

function MatchesList({ matches }: MatchesListProps) {
  if (matches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Aucun match cette semaine
      </p>
    );
  }

  const grouped = groupAndSort(matches);

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([competition, compMatches]) => {
        const meta = COMPETITION_META[competition];
        return (
          <div key={competition}>
            <div className="flex items-center gap-2 mb-2 pb-1.5 border-b">
              <CompetitionFavicon favicon={meta.favicon} label={meta.label} />
              <span className="text-sm font-semibold">{meta.label}</span>
            </div>

            <div className="divide-y">
              {compMatches.map((match, idx) => (
                <MatchRow key={`${match.homeTeam}-${match.awayTeam}-${idx}`} match={match} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface CompetitionFaviconProps {
  favicon: string;
  label: string;
}

function CompetitionFavicon({ favicon, label }: CompetitionFaviconProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="w-5 h-5 rounded-sm bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">
        {label.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={favicon}
      alt={label}
      className="w-5 h-5 rounded-sm shrink-0"
      onError={() => setHasError(true)}
    />
  );
}
