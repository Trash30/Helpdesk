import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import { usePermissions } from '@/hooks/usePermissions';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

type Competition = 'LNH' | 'PRO_D2' | 'TOP14' | 'EPCR';

interface Match {
  competition: Competition;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  venue?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  broadcasterLogo?: string;
}

interface SportsMatchesResponse {
  data: Match[];
  lastUpdated: string;
}

interface MatchAttachment {
  id: string;
  matchKey: string;
  originalName: string;
  size: number;
  createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COMPETITION_META: Record<Competition, { label: string; favicon: string }> = {
  TOP14:  { label: 'Top 14',        favicon: 'https://top14.lnr.fr/favicon.ico' },
  PRO_D2: { label: 'Pro D2',        favicon: 'https://prod2.lnr.fr/favicon.ico' },
  EPCR:   { label: 'Champions Cup', favicon: 'https://media-cdn.incrowdsports.com/77535d85-bcdc-49b9-9dc9-879e70d9adba.svg' },
  LNH:    { label: 'Starligue',     favicon: 'https://www.lnh.fr/medias/_site/header/logo-lnh.svg' },
};

const COMPETITION_ORDER: Competition[] = ['TOP14', 'PRO_D2', 'EPCR', 'LNH'];

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

function getMatchKey(match: Match): string {
  return `${match.competition}_${match.homeTeam}_${match.awayTeam}_${match.date}`;
}

function formatFileSize(bytes: number): string {
  const kb = Math.round(bytes / 1024);
  return kb < 1 ? '< 1 Ko' : `${kb} Ko`;
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
  attachments: MatchAttachment[];
}

function MatchRow({ match, attachments }: MatchRowProps) {
  const [broadcasterError, setBroadcasterError] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const matchKey = getMatchKey(match);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('matchKey', matchKey);
      formData.append('matchDate', match.date);
      return (await api.post('/sports/match-attachments', formData)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-attachments'] });
      toast.success('PDF ajouté avec succès');
    },
    onError: () => {
      toast.error('Erreur lors de l\'envoi du fichier');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return (await api.delete(`/sports/match-attachments/${id}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-attachments'] });
      toast.success('PDF supprimé');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression');
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      if (file.type !== 'application/pdf') {
        toast.error('Seuls les fichiers PDF sont acceptés');
        return;
      }

      uploadMutation.mutate(file);
    },
    [uploadMutation],
  );

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

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {formatMatchDate(match.date, match.time)}
        </span>
        {match.broadcasterLogo && !broadcasterError && (
          <img
            src={match.broadcasterLogo}
            alt="Diffuseur"
            className="h-4 object-contain opacity-70"
            onError={() => setBroadcasterError(true)}
          />
        )}
      </div>

      {/* Attached PDFs */}
      {attachments.length > 0 && (
        <div className="w-full mt-1 space-y-0.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 text-xs text-muted-foreground px-1"
            >
              <span className="shrink-0">📄</span>
              <button
                type="button"
                className="truncate hover:text-foreground hover:underline transition-colors text-left"
                onClick={() =>
                  window.open(`/api/sports/match-attachments/${att.id}/download`, '_blank')
                }
                title={att.originalName}
              >
                {att.originalName}
              </button>
              <span className="shrink-0 text-muted-foreground/60">
                ({formatFileSize(att.size)})
              </span>
              {can('admin.access') && (
                <button
                  type="button"
                  className="shrink-0 hover:text-red-600 transition-colors disabled:opacity-50"
                  onClick={() => deleteMutation.mutate(att.id)}
                  disabled={deleteMutation.isPending}
                  title="Supprimer"
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone for admin */}
      {can('admin.access') && (
        <div
          className={`w-full mt-1 border border-dashed rounded px-2 py-1.5 text-center text-xs transition-colors
            ${uploadMutation.isPending ? 'opacity-50 pointer-events-none' : ''}
            ${isDragOver ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-muted-foreground/30 text-muted-foreground/50 hover:border-muted-foreground/50'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {uploadMutation.isPending ? 'Envoi...' : 'Déposer un PDF'}
        </div>
      )}
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
  const matchKeys = matches.map(getMatchKey);

  const { data: attachmentsData } = useQuery({
    queryKey: ['match-attachments'],
    queryFn: async () => {
      const params = new URLSearchParams();
      matchKeys.forEach((key) => params.append('matchKey', key));
      return ((await api.get('/sports/match-attachments', { params })).data?.data ?? []) as MatchAttachment[];
    },
    enabled: matches.length > 0,
  });

  const attachmentsByKey = new Map<string, MatchAttachment[]>();
  if (attachmentsData) {
    for (const att of attachmentsData) {
      const existing = attachmentsByKey.get(att.matchKey) || [];
      existing.push(att);
      attachmentsByKey.set(att.matchKey, existing);
    }
  }

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
                <MatchRow
                  key={`${match.homeTeam}-${match.awayTeam}-${idx}`}
                  match={match}
                  attachments={attachmentsByKey.get(getMatchKey(match)) || []}
                />
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
