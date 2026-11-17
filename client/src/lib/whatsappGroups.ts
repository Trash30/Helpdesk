/**
 * Groupes WhatsApp de suivi des matchs — logique pure (sans React).
 *
 * Entrées :
 *  - le fichier Excel de planification VOGO (une ligne par match, blocs par championnat,
 *    chaque bloc ayant sa propre ligne d'en-tête « Championnat | Journée | Date | ... »)
 *  - les matchs de la semaine renvoyés par GET /sports/matches (widget sports)
 *
 * Sortie : un « plan » de groupes (nom, RO, technicien, numéros normalisés) prêt à être
 * créé sur WhatsApp Business.
 */
import * as XLSX from 'xlsx';
import type { Competition, Match } from '@/components/sports/SportsMatchesWidget';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Person {
  name: string;
  /** Numéro tel que saisi dans l'Excel */
  rawPhone: string;
  /** Numéro E.164 (+33612345678) ou null si illisible */
  phone: string | null;
}

export interface PlanningRow {
  /** Index de la ligne dans la feuille (1-based), pour les messages d'erreur */
  rowNumber: number;
  championship: string;
  competition: Competition | null;
  round: string;
  /** Date du match au format YYYY-MM-DD */
  date: string | null;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  time: string;
  ro: Person;
  technician: Person;
}

export interface GroupPlan {
  id: string;
  row: PlanningRow;
  /** Match officiel rapproché (widget sports), null si aucun */
  match: Match | null;
  /** Rapprochement sûr (les deux équipes reconnues) ou à vérifier */
  matchConfidence: 'sure' | 'check' | 'none';
  warnings: string[];
}

// ─── Lecture Excel ───────────────────────────────────────────────────────────

const CHAMPIONSHIP_TO_COMPETITION: Record<string, Competition> = {
  TOP14: 'TOP14',
  PROD2: 'PRO_D2',
};

function norm(s: unknown): string {
  return String(s ?? '')
    .replace(/ /g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function clean(s: unknown): string {
  return String(s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/** Excel serial (1900 date system) ou Date ou "JJ/MM/AAAA" → "YYYY-MM-DD" */
function toIsoDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const m = String(v).trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

/** "06 88 44 83 70", "06.30.76.10.52", "+33 6..." → "+33688448370" */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (digits.startsWith('+')) {
    return /^\+\d{8,15}$/.test(digits) ? digits : null;
  }
  // Numéro français national : 0X XX XX XX XX
  if (/^0[1-9]\d{8}$/.test(digits)) return `+33${digits.slice(1)}`;
  // Numéro français sans le 0 initial (Excel supprime parfois le zéro)
  if (/^[67]\d{8}$/.test(digits)) return `+33${digits}`;
  return null;
}

export function formatPhone(e164: string): string {
  const m = e164.match(/^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/);
  return m ? `+33 ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : e164;
}

interface HeaderMap {
  championship: number;
  round: number;
  date: number;
  home: number;
  away: number;
  venue: number;
  time: number;
  ro: number;
  technician: number;
}

function readHeader(row: unknown[]): HeaderMap | null {
  const cells = row.map(norm);
  const find = (pred: (c: string) => boolean) => cells.findIndex(pred);
  const championship = find((c) => c === 'championnat');
  if (championship < 0) return null;
  const map: HeaderMap = {
    championship,
    round: find((c) => c.startsWith('journee')),
    date: find((c) => c === 'date'),
    home: find((c) => c.includes('domicile')),
    away: find((c) => c.includes('exterieur')),
    venue: find((c) => c.includes('stade') || c.includes('lieu')),
    time: find((c) => c === 'heure'),
    ro: find((c) => c === 'ro'),
    technician: find((c) => c.startsWith('technicien')),
  };
  if (map.date < 0 || map.home < 0 || map.away < 0) return null;
  return map;
}

function person(row: unknown[], nameIdx: number): Person {
  if (nameIdx < 0) return { name: '', rawPhone: '', phone: null };
  // Le numéro est dans la colonne qui suit immédiatement le nom
  const rawPhone = clean(row[nameIdx + 1]);
  return { name: clean(row[nameIdx]), rawPhone, phone: normalizePhone(rawPhone) };
}

/** Lit toutes les feuilles du classeur et renvoie une ligne par match. */
export function parsePlanningWorkbook(data: ArrayBuffer): PlanningRow[] {
  const wb = XLSX.read(data, { type: 'array' });
  const rows: PlanningRow[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const table = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
    let header: HeaderMap | null = null;

    table.forEach((row, i) => {
      const h = readHeader(row);
      if (h) {
        header = h;
        return;
      }
      if (!header) return;
      const hh: HeaderMap = header;
      const homeTeam = clean(row[hh.home]);
      const awayTeam = clean(row[hh.away]);
      if (!homeTeam || !awayTeam) return;

      const championship = clean(row[hh.championship]);
      const key = championship.toUpperCase().replace(/[^A-Z0-9]/g, '');
      rows.push({
        rowNumber: i + 1,
        championship,
        competition: CHAMPIONSHIP_TO_COMPETITION[key] ?? null,
        round: hh.round >= 0 ? clean(row[hh.round]) : '',
        date: toIsoDate(row[hh.date]),
        homeTeam,
        awayTeam,
        venue: hh.venue >= 0 ? clean(row[hh.venue]) : '',
        time: hh.time >= 0 ? clean(row[hh.time]) : '',
        ro: person(row, hh.ro),
        technician: person(row, hh.technician),
      });
    });
  }
  return rows;
}

// ─── Rapprochement avec le calendrier officiel ──────────────────────────────

/** Mots trop génériques pour identifier un club */
const STOPWORDS = new Set([
  'rugby', 'club', 'us', 'fc', 'rc', 'as', 'su', 'ca', 'sa', 'cs', 'asm', 'uson',
  'olympique', 'xv', 'de', 'du', 'la', 'le', 'les', 'et', 'pb', 'dr', 'hr', 'herault', 'stade',
]);

/** Alias connus : nom Excel/usage → mot-clé présent dans le nom officiel */
const ALIASES: Record<string, string[]> = {
  lou: ['lyon'],
  lyon: ['lou'],
  ubb: ['bordeaux', 'begles'],
  mhr: ['montpellier'],
  usap: ['perpignan'],
  bopb: ['biarritz'],
  asbh: ['beziers'],
  vrdr: ['valence', 'romans'],
  r92: ['racing'],
  nissa: ['nice'],
  nice: ['nissa'],
  paloise: ['pau'],
  pau: ['paloise'],
};

function tokens(name: string): string[] {
  const base = norm(name)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
  const extra = norm(name)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .flatMap((t) => ALIASES[t] ?? []);
  return [...new Set([...base, ...extra])];
}

/**
 * Ressemblance de deux mots : 1 si identiques, sinon longueur du préfixe commun rapportée
 * au mot le plus long (« rochelais » / « rochelle » → 0,67), 0 sous 4 lettres communes.
 * Le score gradué départage les voisins (« toulousain » est plus proche de « toulouse »
 * que « toulon »).
 */
function wordSimilarity(x: string, y: string): number {
  if (x === y) return 1;
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  if (i < 4) return 0;
  const r = i / Math.max(x.length, y.length);
  return r >= 0.6 ? r : 0;
}

/** 0 (rien en commun) → 1 (mêmes mots-clés) */
export function teamSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  let total = 0;
  for (const x of ta) {
    total += Math.max(0, ...tb.map((y) => wordSimilarity(x, y)));
  }
  return Math.min(1, total / Math.min(ta.length, tb.length));
}

/** Date calendaire Europe/Paris (YYYY-MM-DD) d'un match du widget */
export function parisDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

export function matchId(m: Match): string {
  return `${m.competition}_${m.homeTeam}_${m.awayTeam}_${m.date}`;
}

/**
 * Rapproche chaque ligne Excel d'un match du calendrier officiel
 * (même compétition, même jour, équipes les plus ressemblantes).
 */
export function buildGroupPlans(rows: PlanningRow[], matches: Match[]): GroupPlan[] {
  const used = new Set<string>();

  // Score de chaque couple ligne / match candidat
  const scored = rows.map((row) => {
    const candidates = matches
      .filter((m) => (!row.competition || m.competition === row.competition) && (!row.date || parisDate(m.date) === row.date))
      .map((m) => {
        const h = teamSimilarity(row.homeTeam, m.homeTeam);
        const a = teamSimilarity(row.awayTeam, m.awayTeam);
        return { m, h, a, score: h + a };
      })
      .sort((x, y) => y.score - x.score);
    return { row, candidates };
  });

  // Attribution gloutonne : les rapprochements les plus sûrs d'abord
  const order = [...scored].sort((x, y) => (y.candidates[0]?.score ?? 0) - (x.candidates[0]?.score ?? 0));
  const result = new Map<PlanningRow, { m: Match | null; conf: GroupPlan['matchConfidence'] }>();
  for (const { row, candidates } of order) {
    const best = candidates.find((c) => !used.has(matchId(c.m)) && c.score > 0);
    if (best) {
      used.add(matchId(best.m));
      result.set(row, { m: best.m, conf: best.h > 0 && best.a > 0 ? 'sure' : 'check' });
    } else {
      result.set(row, { m: null, conf: 'none' });
    }
  }

  // Seconde passe : s'il ne reste qu'un match libre et une ligne non rapprochée le même jour,
  // on les associe (cas d'un nom de club totalement différent, ex. abréviation inconnue).
  for (const { row, candidates } of scored) {
    const r = result.get(row)!;
    if (r.m) continue;
    const free = candidates.filter((c) => !used.has(matchId(c.m)));
    const orphansSameDay = scored.filter(
      (s) => !result.get(s.row)!.m && s.row.date === row.date && s.row.competition === row.competition,
    );
    if (free.length === 1 && orphansSameDay.length === 1) {
      used.add(matchId(free[0].m));
      result.set(row, { m: free[0].m, conf: 'check' });
    }
  }

  return rows.map((row, i) => {
    const r = result.get(row)!;
    const warnings: string[] = [];
    if (!row.date) warnings.push('Date illisible dans le fichier');
    if (!row.competition) warnings.push(`Championnat « ${row.championship} » non reconnu`);
    if (!row.ro.name) warnings.push('RO manquant');
    else if (!row.ro.phone) warnings.push(`Numéro du RO illisible (« ${row.ro.rawPhone} »)`);
    if (!row.technician.name) warnings.push('Technicien manquant');
    else if (!row.technician.phone) warnings.push(`Numéro du technicien illisible (« ${row.technician.rawPhone} »)`);
    if (r.conf === 'none') warnings.push('Match introuvable dans le calendrier officiel de la semaine');
    if (r.conf === 'check') warnings.push('Rapprochement avec le calendrier officiel à vérifier');
    return { id: `${i}_${row.rowNumber}`, row, match: r.m, matchConfidence: r.conf, warnings };
  });
}

// ─── Nom du groupe ───────────────────────────────────────────────────────────

/** "2026-10-31" → "31.10.26" */
export function formatGroupDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

/** WhatsApp limite le nom d'un groupe à 100 caractères */
export const WHATSAPP_GROUP_NAME_MAX = 100;

export function buildGroupName(
  plan: GroupPlan,
  source: 'official' | 'excel',
): string {
  const useOfficial = source === 'official' && plan.match;
  const date = useOfficial ? parisDate(plan.match!.date) : plan.row.date;
  const home = useOfficial ? plan.match!.homeTeam : plan.row.homeTeam;
  const away = useOfficial ? plan.match!.awayTeam : plan.row.awayTeam;
  const name = `${date ? formatGroupDate(date) : '??.??.??'} - ${clean(home)} vs ${clean(away)}`;
  return name.slice(0, WHATSAPP_GROUP_NAME_MAX);
}

// ─── Logo (avatar du groupe) ─────────────────────────────────────────────────

/**
 * Redimensionne une image en carré 640×640 (format attendu par WhatsApp pour la photo
 * de groupe), centrée sur fond blanc, et renvoie une data URL PNG.
 */
export async function toSquareAvatar(file: File, size = 640): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image illisible'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponible');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    // Marge de 10 % : WhatsApp affiche l'avatar en rond
    const box = size * 0.8;
    const ratio = Math.min(box / img.width, box / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
