import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Trash2, Upload } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { MatchNoteEditor } from './MatchNoteEditor';
import { MatchReportExport } from './MatchReportExport';
import api from '@/lib/axios';
import { usePermissions } from '@/hooks/usePermissions';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Competition = 'LNH' | 'PRO_D2' | 'TOP14' | 'EPCR' | 'EPCR_CHALLENGE' | 'SUPER_LEAGUE' | 'LIGUE1' | 'ELMS';

export interface Match {
  competition: Competition;
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

interface SportsMatchesResponse {
  data: Match[];
  lastUpdated: string;
}

export interface MatchAttachment {
  id: string;
  matchKey: string;
  originalName: string;
  size: number;
  createdAt: string;
}

export interface MatchNoteData {
  id: string;
  matchKey: string;
  content: string;
  status?: 'VERT' | 'ORANGE' | 'ROUGE';
  competition: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  matchTime: string;
  venue?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  broadcasterLogo?: string;
  author: { id: string; name: string };
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const COMPETITION_META: Record<Competition, { label: string; favicon: string; calendarUrl: string }> = {
  LIGUE1:         { label: 'Ligue 1',       favicon: 'https://www.ligue1.com/favicon.ico',                                                          calendarUrl: 'https://www.ligue1.com/fr/calendar' },
  TOP14:          { label: 'Top 14',        favicon: 'https://top14.lnr.fr/favicon.ico',                                                            calendarUrl: 'https://top14.lnr.fr/calendrier-et-resultats' },
  PRO_D2:         { label: 'Pro D2',        favicon: 'https://prod2.lnr.fr/favicon.ico',                                                            calendarUrl: 'https://prod2.lnr.fr/calendrier-et-resultats' },
  EPCR:           { label: 'Champions Cup', favicon: 'https://media-cdn.incrowdsports.com/77535d85-bcdc-49b9-9dc9-879e70d9adba.svg',                calendarUrl: 'https://www.epcrugby.com/fr/champions-cup/matchs' },
  EPCR_CHALLENGE: { label: 'Challenge Cup', favicon: 'https://media-cdn.incrowdsports.com/96d27751-bc48-42e6-890e-a389508ab133.svg',                calendarUrl: 'https://www.epcrugby.com/fr/challenge-cup/matchs' },
  SUPER_LEAGUE:   { label: 'Super League',  favicon: 'https://www.superleague.co.uk/favicon.ico',                                                   calendarUrl: 'https://www.superleague.co.uk/match-centre' },
  LNH:            { label: 'Liqui Moly Starligue', favicon: 'https://www.lnh.fr/medias/_site/header/logo-lnh.svg',                                    calendarUrl: 'https://www.lnh.fr/liquimoly-starligue/calendrier' },
  ELMS:           { label: 'ELMS',          favicon: 'https://www.europeanlemansseries.com/favicon.ico',                                            calendarUrl: 'https://www.europeanlemansseries.com/en/season/2026' },
};

const COMPETITION_ORDER: Competition[] = ['LIGUE1', 'TOP14', 'PRO_D2', 'EPCR', 'EPCR_CHALLENGE', 'SUPER_LEAGUE', 'LNH', 'ELMS'];

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

export function getMatchKey(match: Match): string {
  return `${match.competition}_${match.homeTeam}_${match.awayTeam}_${match.date}`;
}

function formatFileSize(bytes: number): string {
  const kb = Math.round(bytes / 1024);
  return kb < 1 ? '< 1 Ko' : `${kb} Ko`;
}

function countryCodeToFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
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

interface ElmsMatchRowProps {
  match: Match;
  attachments: MatchAttachment[];
  existingNote?: MatchNoteData;
}

export function ElmsMatchRow({ match, attachments, existingNote }: ElmsMatchRowProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const matchKey = getMatchKey(match);

  // Nettoyer le nom de l'epreuve : enlever le prefixe "ELMS " si present
  const eventName = match.homeTeam.replace(/^ELMS\s+/i, '');

  // Badge couleur : bleu pour Qualifying, orange pour Race
  const isRace = match.awayTeam === 'Race';
  const sessionBadgeClass = isRace
    ? 'bg-orange-100 text-orange-700 border border-orange-200'
    : 'bg-blue-100 text-blue-700 border border-blue-200';

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('matchKey', matchKey);
      formData.append('matchDate', match.date);
      return (await api.post('/sports/match-attachments', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-attachments'] });
      toast.success('PDF ajouté avec succès');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? "Erreur lors de l'envoi du fichier");
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

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (file.type !== 'application/pdf') { toast.error('Seuls les fichiers PDF sont acceptés'); return; }
      uploadMutation.mutate(file);
    },
    [uploadMutation],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.type !== 'application/pdf') { toast.error('Seuls les fichiers PDF sont acceptés'); return; }
      if (file.size > 10 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 10 Mo)'); return; }
      uploadMutation.mutate(file);
      e.target.value = '';
    },
    [uploadMutation],
  );

  return (
    <div className="group flex flex-col gap-1.5 sm:gap-1 py-3 sm:py-2.5 px-2 sm:px-3">
      {/* Ligne principale : flag + nom epreuve + badge session */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {/* Logo ELMS */}
        {match.homeTeamLogo && (
          <img
            src={match.homeTeamLogo}
            alt="ELMS"
            className="w-5 h-5 object-contain shrink-0"
          />
        )}
        {/* Drapeau pays */}
        {match.country && (
          <span className="text-base leading-none shrink-0" title={match.country}>
            {countryCodeToFlag(match.country)}
          </span>
        )}
        {/* Nom de l'epreuve */}
        <span className="text-sm font-medium truncate flex-1 min-w-0">{eventName}</span>
        {/* Badge session */}
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 max-w-[130px] truncate ${sessionBadgeClass}`} title={match.awayTeam}>
          {match.awayTeam}
        </span>
      </div>

      {/* Date/heure */}
      <div className="text-xs text-muted-foreground pl-0.5">
        {formatMatchDate(match.date, match.time)}
      </div>

      {/* PDFs attaches */}
      {attachments.length > 0 && (
        <div className="w-full space-y-1 sm:space-y-0.5">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-2 sm:gap-1.5 text-sm sm:text-xs text-muted-foreground px-1">
              <FileText className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-muted-foreground shrink-0" />
              <button
                type="button"
                className="truncate hover:text-foreground hover:underline transition-colors text-left flex-1 min-w-0 py-1 sm:py-0"
                onClick={() => window.open(`/api/sports/match-attachments/${att.id}/download`, '_blank')}
                title={att.originalName}
              >
                {att.originalName}
              </button>
              <span className="shrink-0 text-muted-foreground/60">({formatFileSize(att.size)})</span>
              {can('admin.access') && (
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center justify-center h-11 w-11 sm:h-auto sm:w-auto hover:text-red-600 transition-colors disabled:opacity-50"
                  onClick={() => setDeleteTarget(att.id)}
                  disabled={deleteMutation.isPending}
                  title="Supprimer"
                  aria-label="Supprimer le PDF"
                >
                  <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Shared file input — used by both mobile button and desktop dropzone */}
      {can('tickets.create') && (
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileSelect}
        />
      )}

      {/* Mobile : bouton visible permanent */}
      {can('tickets.create') && (
        <button
          type="button"
          className="sm:hidden inline-flex items-center gap-1.5 text-xs px-3 py-2 min-h-[40px] rounded border border-dashed border-muted-foreground/40 text-muted-foreground w-full justify-center mt-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          <Upload className="h-4 w-4" />
          {uploadMutation.isPending ? 'Envoi...' : 'Joindre un PDF'}
        </button>
      )}

      {/* Desktop : dropzone drag & drop (hover only) */}
      {can('tickets.create') && (
        <div
          className={`hidden sm:inline-flex w-full border border-dashed rounded px-2 py-1.5 text-center text-xs cursor-pointer transition-all items-center justify-center gap-2
            opacity-0 group-hover:opacity-100 transition-opacity duration-150
            ${uploadMutation.isPending ? 'opacity-50 pointer-events-none' : ''}
            ${isDragOver ? 'border-blue-500 bg-blue-50 text-blue-600 !opacity-100' : 'border-muted-foreground/40 text-muted-foreground/50 hover:border-muted-foreground/60'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <span>{uploadMutation.isPending ? 'Envoi...' : 'Déposer un PDF'}</span>
        </div>
      )}

      {/* Note editor */}
      <MatchNoteEditor
        matchKey={matchKey}
        match={match}
        initialContent={existingNote?.content}
        initialStatus={existingNote?.status}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Supprimer le fichier"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget, {
              onSettled: () => setDeleteTarget(null),
            });
          }
        }}
      />
    </div>
  );
}

interface MatchRowProps {
  match: Match;
  attachments: MatchAttachment[];
  existingNote?: MatchNoteData;
}

export function MatchRow({ match, attachments, existingNote }: MatchRowProps) {
  const [broadcasterError, setBroadcasterError] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const matchKey = getMatchKey(match);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('matchKey', matchKey);
      formData.append('matchDate', match.date);
      return (await api.post('/sports/match-attachments', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-attachments'] });
      toast.success('PDF ajouté avec succès');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Erreur lors de l\'envoi du fichier');
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

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.type !== 'application/pdf') { toast.error('Seuls les fichiers PDF sont acceptés'); return; }
      if (file.size > 10 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 10 Mo)'); return; }
      uploadMutation.mutate(file);
      e.target.value = '';
    },
    [uploadMutation],
  );

  return (
    <div className="group flex flex-col items-center gap-1.5 sm:gap-1 py-3 sm:py-2.5 px-2 sm:px-3">
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

      <div className="flex items-center gap-2 flex-wrap justify-center">
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
        <div className="w-full mt-1 space-y-1 sm:space-y-0.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 sm:gap-1.5 text-sm sm:text-xs text-muted-foreground px-1"
            >
              <FileText className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-muted-foreground shrink-0" />
              <button
                type="button"
                className="truncate hover:text-foreground hover:underline transition-colors text-left flex-1 min-w-0 py-1 sm:py-0"
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
                  className="shrink-0 inline-flex items-center justify-center h-11 w-11 sm:h-auto sm:w-auto hover:text-red-600 transition-colors disabled:opacity-50"
                  onClick={() => setDeleteTarget(att.id)}
                  disabled={deleteMutation.isPending}
                  title="Supprimer"
                  aria-label="Supprimer le PDF"
                >
                  <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Shared file input */}
      {can('tickets.create') && (
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileSelect}
        />
      )}

      {/* Mobile : bouton visible permanent */}
      {can('tickets.create') && (
        <button
          type="button"
          className="sm:hidden inline-flex items-center gap-1.5 text-xs px-3 py-2 min-h-[40px] rounded border border-dashed border-muted-foreground/40 text-muted-foreground w-full justify-center mt-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          <Upload className="h-4 w-4" />
          {uploadMutation.isPending ? 'Envoi...' : 'Joindre un PDF'}
        </button>
      )}

      {/* Desktop : dropzone drag & drop (hover only) */}
      {can('tickets.create') && (
        <div
          className={`hidden sm:inline-flex w-full mt-1 border border-dashed rounded px-2 py-1.5 text-center text-xs cursor-pointer transition-all items-center justify-center gap-2
            opacity-0 group-hover:opacity-100 transition-opacity duration-150
            ${uploadMutation.isPending ? 'opacity-50 pointer-events-none' : ''}
            ${isDragOver ? 'border-blue-500 bg-blue-50 text-blue-600 !opacity-100' : 'border-muted-foreground/40 text-muted-foreground/50 hover:border-muted-foreground/60'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <span>{uploadMutation.isPending ? 'Envoi...' : 'Déposer un PDF'}</span>
        </div>
      )}

      {/* Note editor */}
      <MatchNoteEditor
        matchKey={matchKey}
        match={match}
        initialContent={existingNote?.content}
        initialStatus={existingNote?.status}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Supprimer le fichier"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget, {
              onSettled: () => setDeleteTarget(null),
            });
          }
        }}
      />
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
    <Card className="shadow-sm overflow-hidden">
      <CardHeader className="pb-3 px-3 sm:px-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Matchs de la semaine</CardTitle>
          {data?.data && data.data.length > 0 && <MatchReportExport />}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6 overflow-x-hidden">
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

function getCurrentWeekBounds(): { monday: Date; sunday: Date } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function MatchesList({ matches }: MatchesListProps) {
  // Toujours charger les notes — indépendamment des matchs scrapés,
  // pour pouvoir reconstruire les matchs joués qui ont disparu du scraper.
  const { data: notesData } = useQuery({
    queryKey: ['match-notes'],
    queryFn: async () => ((await api.get('/sports/match-notes')).data?.data ?? []) as MatchNoteData[],
  });

  // Reconstruire les matchs manquants depuis les notes de la semaine courante.
  // Cas typique : le lendemain d'un match LNR, le site le déplace en "résultats"
  // et le scraper ne le retourne plus — mais la note est en DB avec toutes les métadonnées.
  //
  // Comparaison floue sur competition+homeTeam+awayTeam+date-seule (sans l'heure)
  // pour éviter les doublons quand le scraper retourne le même match avec une heure
  // légèrement différente de celle stockée dans la note.
  const scrapedFingerprints = new Set(
    matches.map((m) => `${m.competition}_${m.homeTeam}_${m.awayTeam}_${m.date.slice(0, 10)}`)
  );
  const { monday, sunday } = getCurrentWeekBounds();

  const ghostMatches: Match[] = (notesData ?? [])
    .filter((note) => {
      const fingerprint = `${note.competition}_${note.homeTeam}_${note.awayTeam}_${note.matchDate.slice(0, 10)}`;
      if (scrapedFingerprints.has(fingerprint)) return false;
      const d = new Date(note.matchDate);
      return d >= monday && d <= sunday;
    })
    .map((note) => ({
      competition: note.competition as Competition,
      homeTeam: note.homeTeam,
      awayTeam: note.awayTeam,
      date: note.matchDate,
      time: note.matchTime || '',
      venue: note.venue,
      homeTeamLogo: note.homeTeamLogo,
      awayTeamLogo: note.awayTeamLogo,
      broadcasterLogo: note.broadcasterLogo,
    }));

  const allMatches = [...matches, ...ghostMatches];
  const allMatchKeys = allMatches.map(getMatchKey);

  const { data: attachmentsData } = useQuery({
    queryKey: ['match-attachments', allMatchKeys],
    queryFn: async () => {
      return ((await api.post('/sports/match-attachments/query', { matchKeys: allMatchKeys })).data?.data ?? []) as MatchAttachment[];
    },
    enabled: allMatchKeys.length > 0,
  });

  const attachmentsByKey = new Map<string, MatchAttachment[]>();
  if (attachmentsData) {
    for (const att of attachmentsData) {
      const existing = attachmentsByKey.get(att.matchKey) || [];
      existing.push(att);
      attachmentsByKey.set(att.matchKey, existing);
    }
  }

  const notesByKey = new Map<string, MatchNoteData>();
  const notesByFingerprint = new Map<string, MatchNoteData>();
  if (notesData) {
    for (const note of notesData) {
      notesByKey.set(note.matchKey, note);
      const fp = `${note.competition}_${note.homeTeam}_${note.awayTeam}_${note.matchDate.slice(0, 10)}`;
      notesByFingerprint.set(fp, note);
    }
  }

  const getNoteForMatch = (match: Match): MatchNoteData | undefined => {
    return (
      notesByKey.get(getMatchKey(match)) ??
      notesByFingerprint.get(`${match.competition}_${match.homeTeam}_${match.awayTeam}_${match.date.slice(0, 10)}`)
    );
  };

  if (allMatches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Aucun match cette semaine
      </p>
    );
  }

  const grouped = groupAndSort(allMatches);

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([competition, compMatches]) => {
        const meta = COMPETITION_META[competition];
        return (
          <div key={competition}>
            <div className="flex items-center gap-2 mb-2 pb-1.5 border-b">
              <CompetitionFavicon favicon={meta.favicon} label={meta.label} />
              <a
                href={meta.calendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold hover:underline"
              >
                {meta.label}
              </a>
            </div>

            <div className="divide-y">
              {compMatches.map((match, idx) =>
                match.competition === 'ELMS' ? (
                  <ElmsMatchRow
                    key={`${match.homeTeam}-${match.awayTeam}-${idx}`}
                    match={match}
                    attachments={attachmentsByKey.get(getMatchKey(match)) || []}
                    existingNote={getNoteForMatch(match)}
                  />
                ) : (
                  <MatchRow
                    key={`${match.homeTeam}-${match.awayTeam}-${idx}`}
                    match={match}
                    attachments={attachmentsByKey.get(getMatchKey(match)) || []}
                    existingNote={getNoteForMatch(match)}
                  />
                )
              )}
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
