import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertTriangle, CheckCircle2, Copy, Download, ExternalLink, FileSpreadsheet, ImageUp,
  Loader2, LogOut, MessageCircle, Play, RefreshCw, RotateCcw, Users, XCircle,
} from 'lucide-react';
import api from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { COMPETITION_META, type Match } from '@/components/sports/SportsMatchesWidget';
import {
  buildGroupName, buildGroupPlans, formatPhone, matchId, parisDate, parsePlanningWorkbook,
  toSquareAvatar, WHATSAPP_GROUP_NAME_MAX, type GroupPlan, type Person, type PlanningRow,
} from '@/lib/whatsappGroups';

// ─── Persistance locale (confort par navigateur, jamais bloquante) ──────────

const LS_LOGO = 'whatsapp_groups_logo';
const LS_PLANNING = 'whatsapp_groups_planning';
const LS_STATE = 'whatsapp_groups_state';

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible ou plein : on continue sans persistance */
  }
}

interface StoredPlanning {
  fileName: string;
  importedAt: string;
  rows: PlanningRow[];
}

interface GroupState {
  /** Nom saisi à la main (remplace le nom calculé) */
  name?: string;
  /** Match choisi à la main : matchId, ou '' pour « aucun » */
  matchId?: string;
  created?: boolean;
}

type NameSource = 'official' | 'excel';

// ─── API WhatsApp (création automatique) ────────────────────────────────────

interface WaStatus {
  state: 'DISCONNECTED' | 'STARTING' | 'QR' | 'READY' | 'ERROR';
  qr: string | null;
  phone: string | null;
  name: string | null;
  error: string | null;
}

interface WaGroupResult {
  key: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'CREATED' | 'EXISTS' | 'FAILED';
  pictureSet: boolean;
  participants: { phone: string; ok: boolean; invited: boolean; message: string }[];
  error: string | null;
}

interface WaJob {
  id: string;
  finishedAt: string | null;
  results: WaGroupResult[];
}

async function copy(text: string, label = 'Copié') {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error('Copie impossible');
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function WhatsAppGroupsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const [logo, setLogo] = useState<string | null>(() => lsGet<string | null>(LS_LOGO, null));
  const [planning, setPlanning] = useState<StoredPlanning | null>(() => lsGet<StoredPlanning | null>(LS_PLANNING, null));
  const [state, setState] = useState<Record<string, GroupState>>(() => lsGet(LS_STATE, {}));
  const [nameSource, setNameSource] = useState<NameSource>('official');

  useEffect(() => lsSet(LS_LOGO, logo), [logo]);
  useEffect(() => lsSet(LS_PLANNING, planning), [planning]);
  useEffect(() => lsSet(LS_STATE, state), [state]);

  const queryClient = useQueryClient();
  const { data: sportsData, isLoading } = useQuery({
    queryKey: ['sports-matches'],
    queryFn: async () => (await api.get('/sports/matches')).data as { data: Match[]; lastUpdated: string },
    staleTime: 1000 * 60 * 60,
    refetchOnMount: 'always',
  });
  const refreshMutation = useMutation({
    mutationFn: async () => (await api.post('/sports/refresh')).data as { data: Match[]; lastUpdated: string },
    onSuccess: (fresh) => {
      queryClient.setQueryData(['sports-matches'], fresh);
      toast.success('Calendrier actualisé');
    },
    onError: (err: any) => {
      toast.error(err?.response?.status === 429 ? (err.response.data?.error ?? 'Réessayez dans un instant') : 'Actualisation impossible');
    },
  });
  const weekMatches = useMemo(
    () => (sportsData?.data ?? []).filter((m) => m.competition === 'TOP14' || m.competition === 'PRO_D2'),
    [sportsData],
  );
  const matchesById = useMemo(() => new Map(weekMatches.map((m) => [matchId(m), m])), [weekMatches]);

  const plans: GroupPlan[] = useMemo(() => {
    if (!planning) return [];
    return buildGroupPlans(planning.rows, weekMatches).map((p) => {
      const override = state[p.id]?.matchId;
      if (override === undefined) return p;
      const m = override ? matchesById.get(override) ?? null : null;
      return {
        ...p,
        match: m,
        matchConfidence: m ? 'sure' : 'none',
        warnings: p.warnings.filter((w) => !w.startsWith('Rapprochement') && !w.startsWith('Match introuvable')),
      };
    });
  }, [planning, weekMatches, state, matchesById]);

  // ── Connexion WhatsApp + création automatique ──
  const { data: wa } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: async () => (await api.get('/whatsapp/status')).data as WaStatus,
    refetchInterval: (q) => (q.state.data?.state === 'STARTING' || q.state.data?.state === 'QR' ? 2000 : 15000),
  });
  const connectMutation = useMutation({
    mutationFn: async () => (await api.post('/whatsapp/connect')).data as WaStatus,
    onSuccess: (d) => queryClient.setQueryData(['whatsapp-status'], d),
    onError: (err: any) => {
      const status = err?.response?.status;
      const detail = err?.response?.data?.error ?? (status === 404 ? 'route introuvable : redémarrez le serveur' : err?.message);
      toast.error(`Connexion impossible${status ? ` (${status})` : ''} : ${detail}`);
    },
  });
  const logoutMutation = useMutation({
    mutationFn: async () => (await api.post('/whatsapp/logout')).data as WaStatus,
    onSuccess: (d) => queryClient.setQueryData(['whatsapp-status'], d),
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const { data: job } = useQuery({
    queryKey: ['whatsapp-job', jobId],
    queryFn: async () => (await api.get(`/whatsapp/groups/jobs/${jobId}`)).data as WaJob,
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data?.finishedAt ? false : 2000),
  });
  const resultByKey = useMemo(() => new Map((job?.results ?? []).map((r) => [r.key, r])), [job]);

  // Les groupes créés (ou déjà existants) sont cochés automatiquement
  useEffect(() => {
    if (!job) return;
    const done = job.results.filter((r) => r.status === 'CREATED' || r.status === 'EXISTS');
    if (done.length === 0) return;
    setState((s) => {
      let changed = false;
      const next = { ...s };
      for (const r of done) {
        if (!next[r.key]?.created) {
          next[r.key] = { ...next[r.key], created: true };
          changed = true;
        }
      }
      return changed ? next : s;
    });
  }, [job]);
  const jobRunning = !!jobId && !!job && !job.finishedAt;

  const groups = plans.map((p) => ({
    plan: p,
    name: state[p.id]?.name ?? buildGroupName(p, nameSource),
    created: !!state[p.id]?.created,
  }));
  const createdCount = groups.filter((g) => g.created).length;
  const warningCount = groups.filter((g) => g.plan.warnings.length > 0).length;

  const pending = groups.filter((g) => !g.created && [g.plan.row.ro.phone, g.plan.row.technician.phone].some(Boolean));
  const createMutation = useMutation({
    mutationFn: async () =>
      (await api.post('/whatsapp/groups', {
        picture: logo,
        groups: pending.map((g) => ({
          key: g.plan.id,
          name: g.name,
          participants: [g.plan.row.ro.phone, g.plan.row.technician.phone].filter((p): p is string => !!p),
        })),
      })).data as WaJob,
    onSuccess: (j) => {
      setJobId(j.id);
      toast.success('Création lancée');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Création impossible'),
  });

  const patch = (id: string, value: Partial<GroupState>) =>
    setState((s) => ({ ...s, [id]: { ...s[id], ...value } }));

  // ── Import Excel ──
  const onFile = async (file: File) => {
    try {
      const rows = parsePlanningWorkbook(await file.arrayBuffer());
      if (rows.length === 0) {
        toast.error('Aucun match trouvé : vérifiez la ligne d\'en-tête « Championnat | Journée | Date | … »');
        return;
      }
      setPlanning({ fileName: file.name, importedAt: new Date().toISOString(), rows });
      setState({});
      toast.success(`${rows.length} matchs importés`);
    } catch {
      toast.error('Fichier Excel illisible');
    }
  };

  // ── Logo ──
  const onLogo = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Choisissez une image (PNG, JPG, SVG…)');
      return;
    }
    try {
      setLogo(await toSquareAvatar(file));
      toast.success('Logo enregistré');
    } catch {
      toast.error('Image illisible');
    }
  };

  const downloadLogo = () => {
    if (!logo) return;
    const a = document.createElement('a');
    a.href = logo;
    a.download = 'logo-groupe-whatsapp.png';
    a.click();
  };

  // ── Export du plan ──
  const planJson = () =>
    JSON.stringify(
      groups.map((g) => ({
        name: g.name,
        competition: g.plan.match?.competition ?? g.plan.row.competition,
        date: g.plan.match ? parisDate(g.plan.match.date) : g.plan.row.date,
        members: [
          { role: 'RO', name: g.plan.row.ro.name, phone: g.plan.row.ro.phone },
          { role: 'Technicien', name: g.plan.row.technician.name, phone: g.plan.row.technician.phone },
        ],
        created: g.created,
        warnings: g.plan.warnings,
      })),
      null,
      2,
    );

  const reset = () => {
    setPlanning(null);
    setState({});
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-[#25D366]" />
            Groupes WhatsApp des matchs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Un groupe par match : vous, le RO et le technicien VOGO. Importez la planification, vérifiez, puis créez les groupes sur WhatsApp Business.
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="https://web.whatsapp.com/" target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Ouvrir WhatsApp Web
          </a>
        </Button>
      </div>

      {/* ── Étapes 1 & 2 ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">1. Logo des groupes</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 rounded-full border bg-white overflow-hidden flex items-center justify-center">
              {logo ? (
                <img src={logo} alt="Logo des groupes" className="h-full w-full object-cover" />
              ) : (
                <ImageUp className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onLogo(f);
                  e.target.value = '';
                }}
              />
              <Button size="sm" variant="outline" onClick={() => logoRef.current?.click()}>
                <ImageUp /> {logo ? 'Changer' : 'Choisir le logo'}
              </Button>
              {logo && (
                <Button size="sm" variant="outline" onClick={downloadLogo}>
                  <Download /> Télécharger
                </Button>
              )}
              <p className="text-xs text-muted-foreground w-full">
                Recadré en carré 640×640. Conservé dans ce navigateur d'une semaine à l'autre.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">2. Planification de la semaine</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = '';
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => fileRef.current?.click()}>
                <FileSpreadsheet /> Importer l'Excel
              </Button>
              {planning && (
                <Button size="sm" variant="ghost" onClick={reset}>
                  <RotateCcw /> Vider
                </Button>
              )}
            </div>
            {planning ? (
              <p className="text-xs text-muted-foreground">
                {planning.fileName} · {planning.rows.length} matchs · importé le{' '}
                {new Date(planning.importedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Colonnes utilisées : Championnat, Date, Équipe à domicile, Équipe à l'extérieur, « RO » + tel, « Technicien VOGO » + tel.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Calendrier officiel :{' '}
              {isLoading ? 'chargement…' : `${weekMatches.length} matchs Top 14 / Pro D2 cette semaine`}
              {sportsData?.lastUpdated && ` · mis à jour le ${new Date(sportsData.lastUpdated).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`}
            </p>
            <Button size="sm" variant="outline" onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending || isLoading}>
              <RefreshCw className={refreshMutation.isPending ? 'animate-spin' : ''} /> Actualiser les matchs
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Connexion WhatsApp ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Connexion WhatsApp Business</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {wa?.state === 'READY' ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span>Connecté{wa.name ? ` : ${wa.name}` : ''}{wa.phone ? ` (${formatPhone(wa.phone)})` : ''}</span>
              <Button size="sm" variant="ghost" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
                <LogOut /> Déconnecter
              </Button>
            </div>
          ) : wa?.state === 'QR' && wa.qr ? (
            <div className="flex flex-wrap items-center gap-4">
              <img src={wa.qr} alt="QR code WhatsApp" className="h-44 w-44 rounded border bg-white" />
              <p className="text-sm text-muted-foreground max-w-sm">
                Sur le téléphone : WhatsApp Business → Paramètres → Appareils connectés → Connecter un appareil, puis scannez ce code.
              </p>
            </div>
          ) : wa?.state === 'STARTING' ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Démarrage de la connexion…</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                <MessageCircle /> Connecter WhatsApp
              </Button>
              {wa?.error && <span className="text-xs text-amber-700">{wa.error}</span>}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Le compte connecté est ajouté à chaque groupe avec le RO et le technicien. Un seul scan suffit : la session est conservée sur le serveur.
          </p>
        </CardContent>
      </Card>

      {/* ── Étape 3 : groupes ── */}
      {planning && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">
                3. Groupes à créer{' '}
                <span className="font-normal text-muted-foreground">
                  · {createdCount}/{groups.length} créés
                  {warningCount > 0 && ` · ${warningCount} à vérifier`}
                </span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-md border p-0.5 text-xs" role="group" aria-label="Source des noms d'équipes">
                  {(['official', 'excel'] as NameSource[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNameSource(s)}
                      className={`px-2.5 py-1 rounded ${nameSource === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {s === 'official' ? 'Noms du calendrier officiel' : 'Noms de l\'Excel'}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={() => createMutation.mutate()}
                  disabled={wa?.state !== 'READY' || pending.length === 0 || createMutation.isPending || jobRunning}
                  title={wa?.state !== 'READY' ? "Connectez WhatsApp d'abord" : undefined}
                >
                  {jobRunning ? <Loader2 className="animate-spin" /> : <Play />}
                  {jobRunning ? 'Création en cours…' : `Créer ${pending.length} groupe${pending.length > 1 ? 's' : ''}`}
                </Button>
                <Button size="sm" variant="outline" onClick={() => copy(planJson(), 'Plan copié')}>
                  <Copy /> Copier le plan
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <Skeleton className="h-24 w-full" />}
            {groups.map(({ plan, name, created }) => (
              <GroupRow
                key={plan.id}
                plan={plan}
                name={name}
                created={created}
                result={resultByKey.get(plan.id)}
                weekMatches={weekMatches}
                onName={(v) => patch(plan.id, { name: v })}
                onResetName={() => patch(plan.id, { name: undefined })}
                onMatch={(id) => patch(plan.id, { matchId: id, name: undefined })}
                onCreated={(v) => patch(plan.id, { created: v })}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Ligne de groupe ─────────────────────────────────────────────────────────

interface GroupRowProps {
  plan: GroupPlan;
  name: string;
  created: boolean;
  result?: WaGroupResult;
  weekMatches: Match[];
  onName: (v: string) => void;
  onResetName: () => void;
  onMatch: (matchId: string) => void;
  onCreated: (v: boolean) => void;
}

function GroupRow({ plan, name, created, result, weekMatches, onName, onResetName, onMatch, onCreated }: GroupRowProps) {
  const comp = plan.match?.competition ?? plan.row.competition;
  const candidates = weekMatches.filter((m) => !plan.row.competition || m.competition === plan.row.competition);
  const hasWarnings = plan.warnings.length > 0;

  return (
    <div
      data-group-name={name}
      className={`rounded-lg border p-3 sm:p-4 transition-colors ${created ? 'bg-muted/40 opacity-70' : hasWarnings ? 'border-amber-300 bg-amber-50/40 dark:bg-amber-950/10' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Checkbox
          checked={created}
          onCheckedChange={(v) => onCreated(v === true)}
          aria-label="Groupe créé"
          title="Groupe créé"
        />
        {comp && (
          <span className="text-[11px] font-semibold uppercase tracking-wide rounded bg-[#185FA5]/10 text-[#185FA5] px-2 py-0.5">
            {COMPETITION_META[comp].label}
          </span>
        )}
        <div className="flex flex-1 min-w-[240px] items-center gap-1">
          <Input
            value={name}
            maxLength={WHATSAPP_GROUP_NAME_MAX}
            onChange={(e) => onName(e.target.value)}
            className="h-9 font-medium"
            aria-label="Nom du groupe"
          />
          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => copy(name, 'Nom copié')} title="Copier le nom">
            <Copy />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={onResetName} title="Nom par défaut">
            <RotateCcw />
          </Button>
        </div>
        {result?.status === 'RUNNING' && <Loader2 className="h-5 w-5 animate-spin text-[#185FA5]" />}
        {created && <CheckCircle2 className="h-5 w-5 text-green-600" />}
        {result?.status === 'FAILED' && <XCircle className="h-5 w-5 text-red-600" />}
      </div>

      {result && (result.status === 'FAILED' || result.participants.some((p) => !p.ok)) && (
        <div className="mt-2 space-y-1">
          {result.error && <p className="text-xs text-red-600">{result.error}</p>}
          {result.participants.filter((p) => !p.ok).map((p) => (
            <p key={p.phone} className="text-xs text-amber-700">{formatPhone(p.phone)} : {p.message}</p>
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <MemberLine role="RO" person={plan.row.ro} />
        <MemberLine role="Technicien" person={plan.row.technician} />
      </div>

      {(hasWarnings || plan.matchConfidence !== 'sure') && (
        <div className="mt-3 space-y-2">
          {plan.warnings.map((w) => (
            <p key={w} className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {w}
            </p>
          ))}
          <label className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              Excel : {plan.row.homeTeam} vs {plan.row.awayTeam} → match officiel :
            </span>
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs max-w-full"
              value={plan.match ? matchId(plan.match) : ''}
              onChange={(e) => onMatch(e.target.value)}
            >
              <option value="">— Aucun (noms de l'Excel) —</option>
              {candidates.map((m) => (
                <option key={matchId(m)} value={matchId(m)}>
                  {parisDate(m.date).split('-').reverse().join('/')} · {m.homeTeam} vs {m.awayTeam}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

function MemberLine({ role, person }: { role: string; person: Person }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm min-w-0">
      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-xs text-muted-foreground w-20 shrink-0">{role}</span>
      <span className="truncate font-medium">{person.name || '—'}</span>
      {person.phone ? (
        <>
          <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{formatPhone(person.phone)}</span>
          <button
            type="button"
            onClick={() => copy(person.phone!, 'Numéro copié')}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            title="Copier le numéro"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <a
            href={`https://wa.me/${person.phone.slice(1)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[#25D366] hover:opacity-80"
            title="Ouvrir la discussion WhatsApp"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        </>
      ) : (
        person.rawPhone && <span className="ml-auto text-xs text-amber-700">{person.rawPhone}</span>
      )}
    </div>
  );
}
