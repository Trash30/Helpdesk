import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Match {
  competition: 'LNH' | 'PRO_D2' | 'TOP14' | 'EPCR' | 'EPCR_CHALLENGE' | 'SUPER_LEAGUE' | 'LIGUE1' | 'ELMS';
  homeTeam: string;
  awayTeam: string;
  date: string;       // ISO date string
  time: string;       // "HH:mm" or "" if unknown
  venue?: string;
  country?: string;        // code ISO 2 lettres, ex: "FR", "ES"
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  broadcasterLogo?: string;  // URL logo diffuseur TV
}

interface CacheEntry {
  data: Match[];
  fetchedAt: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

// Cache expires at end of the day it was fetched (not a fixed TTL)
// This ensures today's matches remain visible even after they've been played,
// since sports websites move completed matches off their fixtures page.
function getCacheExpiry(fetchedAt: number): number {
  const end = new Date(fetchedAt);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const isDev = process.env.NODE_ENV !== 'production';

function log(...args: unknown[]): void {
  if (isDev) {
    console.log('[SportsScraper]', ...args);
  }
}

function logError(...args: unknown[]): void {
  if (isDev) {
    console.error('[SportsScraper]', ...args);
  }
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const cache: Record<string, CacheEntry> = {};

function getCached(key: string): Match[] | null {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() > getCacheExpiry(entry.fetchedAt)) return null;
  return entry.data;
}

function setCache(key: string, data: Match[]): void {
  cache[key] = { data, fetchedAt: Date.now() };
}

function getLastUpdated(): string {
  const timestamps = Object.values(cache)
    .map((e) => e.fetchedAt)
    .filter(Boolean);
  if (timestamps.length === 0) return new Date().toISOString();
  return new Date(Math.max(...timestamps)).toISOString();
}

// ─── Date parsing helpers ───────────────────────────────────────────────────

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 0, fevrier: 1, 'f\u00e9vrier': 1, mars: 2, avril: 3,
  mai: 4, juin: 5, juillet: 6, aout: 7, 'ao\u00fbt': 7,
  septembre: 8, octobre: 9, novembre: 10, decembre: 11, 'd\u00e9cembre': 11,
  jan: 0, fev: 1, 'f\u00e9v': 1, mar: 2, avr: 3,
  jui: 5, juil: 6, jul: 6, aou: 7, 'ao\u00fb': 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11, 'd\u00e9c': 11,
};

// ─── ISO week helpers ───────────────────────────────────────────────────────

function getISOWeekBounds(refDate: Date): { monday: Date; sunday: Date } {
  const d = new Date(refDate);
  d.setHours(0, 0, 0, 0);
  // getDay(): 0=Sun, 1=Mon ... 6=Sat
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
}

/**
 * Checks if a date string falls within the current ISO week (Mon–Sun).
 * Handles the local/UTC mismatch: ISO strings from toISOString() are in UTC,
 * but week bounds are computed in local time. We compare using local dates
 * to avoid edge-case mismatches (e.g. Sunday 23:00 Paris = Monday 01:00 UTC).
 */
function isInCurrentWeek(dateStr: string): boolean {
  const matchDate = new Date(dateStr);
  if (isNaN(matchDate.getTime())) return false;
  // Normalize match date to local midnight for date-only comparison
  const matchLocal = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
  // Use getTime() on the parsed date to recover local components correctly:
  // new Date(isoString) gives UTC; .getFullYear() etc. convert to local automatically
  const { monday, sunday } = getISOWeekBounds(new Date());
  const mondayDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const sundayDate = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());
  return matchLocal >= mondayDate && matchLocal <= sundayDate;
}

// ─── Axios client ───────────────────────────────────────────────────────────

function createClient(): AxiosInstance {
  return axios.create({
    timeout: 10_000,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
    },
  });
}

// ─── LNR date helper ────────────────────────────────────────────────────────

/**
 * Parses "jeudi 02 avril" (no year) + "21h00" into an ISO date string.
 * Infers the year: current year, or next year if the date is > 4 months past.
 */
function parseLNRDate(rawDate: string, rawTime: string): string {
  const dateMatch = rawDate.toLowerCase().match(/(\d{1,2})\s+([a-zéùûôàèîïœæ]+)/);
  if (!dateMatch) {
    log(`parseLNRDate: no date pattern found in "${rawDate}"`);
    return '';
  }

  const day = parseInt(dateMatch[1], 10);
  const monthName = dateMatch[2].normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip accents
  const month = FRENCH_MONTHS[dateMatch[2]] ?? FRENCH_MONTHS[monthName];
  if (month === undefined) {
    log(`parseLNRDate: unknown month "${dateMatch[2]}" (normalized: "${monthName}") in "${rawDate}"`);
    return '';
  }

  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month, day);
  // If candidate is more than 4 months in the past, assume next year
  if (candidate.getTime() < now.getTime() - 4 * 30 * 24 * 60 * 60 * 1000) {
    year++;
  }

  const timeMatch = rawTime.match(/(\d{1,2})h(\d{2})/);
  const hours = timeMatch ? parseInt(timeMatch[1], 10) : 0;
  const minutes = timeMatch ? parseInt(timeMatch[2], 10) : 0;

  return new Date(year, month, day, hours, minutes).toISOString();
}

// ─── LNR Scraper (Pro D2 & Top 14) ─────────────────────────────────────────

/**
 * Scrapes the LNR calendar pages (same DOM structure for Pro D2 and Top 14).
 *
 * Actual HTML structure (verified):
 *   .calendar-results__fixture-date  → "jeudi 02 avril"
 *   .match-line
 *     .club-line.club-line--reversed  → home team
 *       img.club-line__icon-img[src]  → home logo
 *       a.club-line__name             → home team name
 *     .match-line__result
 *       .match-line__time             → "21h00"
 *     .club-line (no --reversed)      → away team
 *       img.club-line__icon-img[src]  → away logo
 *       a.club-line__name             → away team name
 */
async function scrapeLNR(
  url: string,
  competition: 'PRO_D2' | 'TOP14'
): Promise<Match[]> {
  const client = createClient();
  const matches: Match[] = [];

  try {
    const resp = await client.get(url);
    const $ = cheerio.load(resp.data as string);

    let currentDate = '';

    // Iterate in document order: capture date headers then match lines
    $('.calendar-results__fixture-date, .match-line').each((_i, el) => {
      const tagEl = $(el);

      if (tagEl.hasClass('calendar-results__fixture-date')) {
        currentDate = tagEl.text().trim();
        return;
      }

      // It's a .match-line
      const homeClub = tagEl.find('.club-line--reversed');
      const awayClub = tagEl.find('.club-line').not('.club-line--reversed').first();

      const homeTeam = homeClub.find('.club-line__name').first().text().trim();
      const awayTeam = awayClub.find('.club-line__name').first().text().trim();

      if (!homeTeam || !awayTeam) return;

      const homeLogoSrc = homeClub.find('img.club-line__icon-img').first().attr('src');
      const awayLogoSrc = awayClub.find('img.club-line__icon-img').first().attr('src');
      const broadcasterSrc = tagEl.find('img.match-line__broadcaster').first().attr('src');

      const rawTime = tagEl.find('.match-line__time').first().text().trim();
      const dateIso = parseLNRDate(currentDate, rawTime);

      matches.push({
        competition,
        homeTeam,
        awayTeam,
        date: dateIso,
        time: rawTime.replace('h', ':') || '',
        homeTeamLogo: homeLogoSrc || undefined,
        awayTeamLogo: awayLogoSrc || undefined,
        broadcasterLogo: broadcasterSrc || undefined,
      });
    });

    log(`${competition}: scraped ${matches.length} total matches from ${url}`);
  } catch (err) {
    logError(`${competition} scraping failed:`, err instanceof Error ? err.message : err);
    return [];
  }

  const filtered = matches.filter((m) => m.date && isInCurrentWeek(m.date));
  log(`${competition}: ${filtered.length} matches in current week`);
  return filtered;
}

// ─── LNH Scraper (ajaxpost1 endpoint) ───────────────────────────────────────

/**
 * Scrapes LNH Starligue via the internal AJAX endpoint discovered in DevTools.
 * POST /ajaxpost1 with days_id=all returns the full season HTML calendar.
 * Parsed with cheerio using verified selectors.
 *
 * Selectors (verified on live response):
 *   .calendars-listing-item  → each match block
 *   .col-competitions text   → "ven. 03 avril 20h00"
 *   .team-logo:nth(0) .team-name → home team
 *   .team-logo:nth(1) .team-name → away team
 *   .team-logo img           → team logos
 *   .tv-icon img             → broadcaster logo
 */
async function scrapeLNH(): Promise<Match[]> {
  const client = createClient();
  const LNH_BASE = 'https://www.lnh.fr';

  try {
    // WARNING: seasons_id and key are season-specific and WILL expire.
    // Update these at the start of each new LNH season by inspecting
    // network requests on https://www.lnh.fr/liquimoly-starligue/calendrier
    const params = new URLSearchParams({
      seasons_id: '39',
      days_id: 'all',
      teams_id: 'all',
      univers: 'd1-26623',
      key: '608423208',
      current_month: 'all',
      type: 'all',
      type_id: 'all',
      contents_controller: 'sportsCalendars',
      contents_action: 'index_ajax',
      cache: 'yes',
      cacheKeys: 'univers,contents_controller,contents_action,type,seasons_id,days_id,teams_id,current_month',
    });

    const resp = await client.post(`${LNH_BASE}/ajaxpost1`, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${LNH_BASE}/liquimoly-starligue/calendrier`,
      },
    });

    const $ = cheerio.load(resp.data as string);
    const matches: Match[] = [];

    $('.calendars-listing-item').each((_i, el) => {
      const block = $(el);

      // Date + time from .col-competitions text node after <br>
      const colComp = block.find('.col-competitions');
      const rawDatetime = (colComp.html() || '')
        .replace(/<[^>]+>/g, '\n')   // strip tags
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .join(' ');                   // e.g. "Liqui Moly StarLigue - J22 ven. 03 avril 20h00"

      // Extract "DD mois HHhMM" — skip the "Jxx" round and day-of-week abbreviation
      // Handles both abbreviated ("ven. 03 avril 20h00") and full day names
      // ("vendredi 03 avril 20h00") as the LNH endpoint format varies.
      const lnhDateMatch = rawDatetime.match(/[a-zéè]{2,8}\.?\s+(\d{1,2})\s+([a-zéùûôàèîïœæ]+)\.?\s+(\d{1,2}h\d{2})/i);
      const rawTime = lnhDateMatch ? lnhDateMatch[3] : '';
      const cleanDate = lnhDateMatch ? `${lnhDateMatch[1]} ${lnhDateMatch[2]}` : rawDatetime;
      const parsed = { date: parseLNRDate(cleanDate, rawTime), time: rawTime.replace('h', ':') };

      if (!parsed.date) {
        log(`LNH: could not parse date from: "${rawDatetime}"`);
      }

      // Teams
      const teamLogos = block.find('.team-logo');
      const homeTeam = teamLogos.eq(0).find('.team-name').text().trim();
      const awayTeam = teamLogos.eq(1).find('.team-name').text().trim();
      if (!homeTeam || !awayTeam) return;

      // Logos
      const homeLogo = teamLogos.eq(0).find('img').attr('src');
      const awayLogo = teamLogos.eq(1).find('img').attr('src');
      const broadcasterLogo = block.find('.tv-icon img').attr('src');

      matches.push({
        competition: 'LNH',
        homeTeam,
        awayTeam,
        date: parsed.date,
        time: parsed.time,
        homeTeamLogo: homeLogo || undefined,
        awayTeamLogo: awayLogo || undefined,
        broadcasterLogo: broadcasterLogo || undefined,
      });
    });

    if (matches.length === 0) {
      logError('LNH: 0 matches scraped — seasons_id or key may be expired. Check LNH endpoint params.');
    }
    const unparsed = matches.filter(m => !m.date);
    if (unparsed.length > 0) {
      logError(`LNH: ${unparsed.length} matches with unparseable dates (dropped)`);
    }
    const filtered = matches.filter(m => m.date && isInCurrentWeek(m.date));
    log(`LNH: ${filtered.length} matches in current week (out of ${matches.length} total)`);
    return filtered;
  } catch (err) {
    logError('LNH scraping failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

function parseFrenchDatetime(raw: string): { date: string; time: string } {
  if (!raw) return { date: '', time: '' };

  // Try ISO format first
  const isoDate = new Date(raw);
  if (!isNaN(isoDate.getTime()) && raw.includes('-')) {
    return {
      date: isoDate.toISOString(),
      time: `${String(isoDate.getHours()).padStart(2, '0')}:${String(isoDate.getMinutes()).padStart(2, '0')}`,
    };
  }

  // Try dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
  const numericMatch = raw.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1], 10);
    const month = parseInt(numericMatch[2], 10) - 1;
    let year = parseInt(numericMatch[3], 10);
    if (year < 100) year += 2000;

    const timeMatch = raw.match(/(\d{1,2})[h:](\d{2})/);
    const hours = timeMatch ? parseInt(timeMatch[1], 10) : 0;
    const minutes = timeMatch ? parseInt(timeMatch[2], 10) : 0;

    const d = new Date(year, month, day, hours, minutes);
    return {
      date: d.toISOString(),
      time: timeMatch ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : '',
    };
  }

  // Try French text: "samedi 12 janvier 2025" or "12 janv. 2025"
  const frenchMatch = raw.toLowerCase().match(
    /(\d{1,2})\s+([a-zéûô]+)\.?\s+(\d{4})/
  );
  if (frenchMatch) {
    const day = parseInt(frenchMatch[1], 10);
    const monthStr = frenchMatch[2].replace('.', '');
    const year = parseInt(frenchMatch[3], 10);
    const month = FRENCH_MONTHS[monthStr];

    if (month !== undefined) {
      const timeMatch = raw.match(/(\d{1,2})[h:](\d{2})/);
      const hours = timeMatch ? parseInt(timeMatch[1], 10) : 0;
      const minutes = timeMatch ? parseInt(timeMatch[2], 10) : 0;

      const d = new Date(year, month, day, hours, minutes);
      return {
        date: d.toISOString(),
        time: timeMatch ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : '',
      };
    }
  }

  return { date: '', time: '' };
}

// ─── EPCR Scraper (Nuxt SSR payload) ────────────────────────────────────────

// French clubs competing in the Champions Cup — names as returned by the EPCR API
const FRENCH_EPCR_CLUBS = [
  'Toulouse', 'Stade Toulousain',
  'La Rochelle', 'Stade Rochelais',
  'Bordeaux', // matches 'Bordeaux-Begles' and variants
  'Toulon', 'RC Toulon',
  'Clermont', 'Clermont Auvergne', 'ASM Clermont',
  'Bayonne', 'Aviron Bayonnais',
  'Castres', 'Castres Olympique',
  'Pau', 'Section Paloise',
  'Racing', 'Stade Français', 'Lyon', 'LOU Rugby',
  'Montpellier', 'Perpignan', 'USAP',
];

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isFrenchClub(name: string): boolean {
  const n = normalize(name);
  return FRENCH_EPCR_CLUBS.some(c => n.includes(normalize(c)) || normalize(c).includes(n));
}

/**
 * Scrapes an EPCR competition (Champions Cup or Challenge Cup) from the Nuxt SSR payload.
 * Only returns matches where the home team is a French club.
 */
async function scrapeEPCRCompetition(
  url: string,
  competition: 'EPCR' | 'EPCR_CHALLENGE'
): Promise<Match[]> {
  const client = createClient();
  try {
    const resp = await client.get(url);
    const $ = cheerio.load(resp.data as string);

    let arr: unknown[] | null = null;
    $('script').each((_, el) => {
      const content = $(el).html() || '';
      if (content.startsWith('[') && content.includes('ShallowReactive')) {
        try { arr = JSON.parse(content); } catch { /* skip */ }
      }
    });
    if (!arr) return [];

    // arr[5] = array of match indices; each index points to a match object in arr
    const matchIndices = arr[5];
    if (!Array.isArray(matchIndices)) return [];

    function val(v: unknown): unknown {
      return typeof v === 'number' && v >= 0 && (v as number) < (arr as unknown[]).length
        ? (arr as unknown[])[v as number]
        : v;
    }

    const matches: Match[] = [];
    for (const idx of matchIndices as number[]) {
      const m = arr[idx] as Record<string, unknown> | undefined;
      if (!m) continue;

      const dateStr = val(m.date);
      if (typeof dateStr !== 'string' || !dateStr) continue;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) continue;

      const home = val(m.homeTeam) as Record<string, unknown>;
      const away = val(m.awayTeam) as Record<string, unknown>;
      const homeTeam = val(home?.name);
      const awayTeam = val(away?.name);
      if (typeof homeTeam !== 'string' || typeof awayTeam !== 'string') continue;
      if (!homeTeam || !awayTeam) continue;

      const homeLogo = val(home?.imageUrl);
      const awayLogo = val(away?.imageUrl);

      matches.push({
        competition,
        homeTeam,
        awayTeam,
        date: d.toISOString(),
        time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }),
        homeTeamLogo: typeof homeLogo === 'string' ? homeLogo : undefined,
        awayTeamLogo: typeof awayLogo === 'string' ? awayLogo : undefined,
      });
    }

    const filtered = matches.filter(m => isInCurrentWeek(m.date) && (isFrenchClub(m.homeTeam) || isFrenchClub(m.awayTeam)));
    log(`${competition}: ${filtered.length} matches this week with French club (out of ${matches.length} total)`);
    return filtered;
  } catch (err) {
    logError(`${competition} scraping failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Super League — Catalans Dragons home fixtures ───────────────────────────

const ENGLISH_MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parses Super League date strings into an ISO date string.
 * Handles ordinal suffixes ("13th Feb", "18th Apr") and optional day names
 * ("Saturday 18 Apr", "Sat 18th Apr", plain "18 Apr").
 * Infers year: current year, or next year if date is >4 months in the past.
 */
function parseSuperLeagueDate(rawDate: string, rawTime: string): string {
  // Strip optional ordinal suffix: "13th" → "13", "18th" → "18"
  const m = rawDate.toLowerCase().match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})/);
  if (!m) return '';

  const day = parseInt(m[1], 10);
  const month = ENGLISH_MONTHS[m[2]];
  if (month === undefined) return '';

  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month, day);
  if (candidate.getTime() < now.getTime() - 4 * 30 * 24 * 60 * 60 * 1000) year++;

  const timeMatch = rawTime.match(/(\d{1,2}):(\d{2})/);
  const hours   = timeMatch ? parseInt(timeMatch[1], 10) : 0;
  const minutes = timeMatch ? parseInt(timeMatch[2], 10) : 0;

  return new Date(year, month, day, hours, minutes).toISOString();
}

/**
 * Static fallback: known Catalans Dragons home fixtures for the 2026 season.
 * Used when the live scraper fails.
 */
function superLeagueStaticFallback(): Match[] {
  const fixtures: Array<{ date: string; time: string; opponent: string }> = [
    { date: '2026-02-13', time: '',      opponent: 'Huddersfield Giants' },
    { date: '2026-02-28', time: '',      opponent: 'St Helens' },
    { date: '2026-03-21', time: '',      opponent: 'Hull KR' },
    { date: '2026-04-04', time: '',      opponent: 'Toulouse Olympique' },
    { date: '2026-04-18', time: '19:00', opponent: 'Warrington Wolves' },
    { date: '2026-05-02', time: '19:00', opponent: 'Leigh Leopards' },
    { date: '2026-06-06', time: '19:30', opponent: 'Wigan Warriors' },
    { date: '2026-06-13', time: '19:00', opponent: 'Castleford Tigers' },
    { date: '2026-06-20', time: '19:00', opponent: 'Bradford Bulls' },
    { date: '2026-07-11', time: '21:00', opponent: 'Leeds Rhinos' },
  ];
  const CATALANS_LOGO = 'https://www.superleague.co.uk/addons/rugbyleague/frontend/_img/49006_full.png';
  return fixtures
    .map(({ date, time, opponent }) => {
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutes] = time ? time.split(':').map(Number) : [0, 0];
      return {
        competition: 'SUPER_LEAGUE' as const,
        homeTeam: 'Catalans Dragons',
        awayTeam: opponent,
        date: new Date(year, month - 1, day, hours, minutes).toISOString(),
        time,
        homeTeamLogo: CATALANS_LOGO,
      };
    })
    .filter(m => isInCurrentWeek(m.date));
}

/**
 * Scrapes Catalans Dragons home fixtures from superleague.co.uk.
 * The page is partly SSR — fixture cards are embedded as <a> elements linking
 * to /match-centre/preview/[id]. Home matches are identified by venue text
 * containing "Brutus" (Stade Gilbert Brutus) or "Bouin" (Stade Jean Bouin).
 * Falls back to static data if the scrape fails or returns nothing.
 */
async function scrapeSuperLeagueCatalans(): Promise<Match[]> {
  const client = createClient();

  try {
    const resp = await client.get(
      'https://www.superleague.co.uk/team/4/catalans-dragons?teamView=4',
      { headers: { Referer: 'https://www.superleague.co.uk/' } }
    );
    const $ = cheerio.load(resp.data as string);
    const matches: Match[] = [];

    const SL_BASE = 'https://www.superleague.co.uk';
    const toAbsolute = (src?: string) =>
      src ? (src.startsWith('/') ? `${SL_BASE}${src}` : src) : undefined;

    $('a[href*="/match-centre/preview/"]').each((_, el) => {
      const aEl = $(el);
      const raw = aEl.text().replace(/\s+/g, ' ').trim();

      // Home matches only
      if (!raw.includes('Brutus') && !raw.includes('Bouin')) return;

      // Time: from <p class="ko"> e.g. "20:00", fallback to regex on raw text
      const koText = aEl.find('.ko').text().trim();
      const time = koText || (raw.match(/\b(\d{2}):(\d{2})\b/)?.[0] ?? '');

      // Date: "Saturday 18 Apr", "13th Feb", "Sat 18th Apr" — day name optional, ordinal optional
      const dateRaw = raw.match(
        /(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3})/i
      );
      if (!dateRaw) return;
      const date = parseSuperLeagueDate(dateRaw[1], time);
      if (!date) return;

      // Logos — use dedicated CSS classes confirmed in the actual HTML:
      //   .home-logo img  → home team badge
      //   .away-logo img  → away team badge
      const CATALANS_LOGO = `${SL_BASE}/addons/rugbyleague/frontend/_img/49006_full.png`;
      const homeTeamLogo =
        toAbsolute(aEl.find('.home-logo img').attr('src')) ?? CATALANS_LOGO;
      const awayTeamLogo =
        toAbsolute(aEl.find('.away-logo img').attr('src'));

      // Away team: remove date, Catalans name, time, venue, broadcaster refs
      const awayTeam = raw
        .replace(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\d{1,2}\s+[A-Za-z]+/gi, '')
        .replace(/Catalans\s+Dragons/gi, '')
        .replace(/\b\d{2}:\d{2}\b/g, '')
        .replace(/Stade\s+Gilbert\s+Brutus/gi, '')
        .replace(/Stade\s+Jean\s+Bouin/gi, '')
        .replace(/sky\s*hd/gi, '')
        .replace(/superleague\+?/gi, '')
        .replace(/betfred/gi, '')
        .replace(/bbc/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (!awayTeam || awayTeam.length < 3) return;

      matches.push({
        competition: 'SUPER_LEAGUE',
        homeTeam: 'Catalans Dragons',
        awayTeam,
        date,
        time,
        homeTeamLogo,
        awayTeamLogo,
      });
    });

    log(`SUPER_LEAGUE: scraped ${matches.length} home fixtures from site`);

    const filtered = matches.filter(m => isInCurrentWeek(m.date));
    if (filtered.length > 0) {
      log(`SUPER_LEAGUE: ${filtered.length} matches this week (live)`);
      return filtered;
    }

    // Scraper found future matches but none this week, or found nothing —
    // fall back to static data which covers past matches still in current week.
    log('SUPER_LEAGUE: no matches this week from scraper, using static fallback');
    return superLeagueStaticFallback();
  } catch (err) {
    logError('SUPER_LEAGUE scraping failed:', err instanceof Error ? err.message : err);
    return superLeagueStaticFallback();
  }
}

// ─── Ligue 1 — AS Monaco home matches (scraper) ──────────────────────────────

/**
 * Scrapes AS Monaco's official fixtures page (SSR) and returns Ligue 1 home
 * matches only (venue = Stade Louis-II).
 *
 * Page structure (verified via WebFetch):
 *   Month containers: [id^="group-"] e.g. id="group-202604"
 *   Each match: <li> containing French date, competition, venue, time, teams
 *   Home matches: text contains "Louis" (Stade Louis-II)
 */
async function scrapeMonacoLigue1(): Promise<Match[]> {
  const client = createClient();
  const matches: Match[] = [];

  try {
    const resp = await client.get('https://www.asmonaco.com/fr/pros/calendrier', {
      headers: {
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Referer': 'https://www.asmonaco.com/',
      },
    });
    const $ = cheerio.load(resp.data as string);

    $('li').each((_, el) => {
      const liEl = $(el);
      const liText = liEl.text().replace(/\s+/g, ' ').trim();

      // Home matches only (Stade Louis-II)
      if (!liText.includes('Louis')) return;
      // Ligue 1 only
      if (!liText.includes('Ligue 1')) return;

      // Extract date: "05 avril 2026" or "5 avril 2026"
      const { date, time: parsedTime } = parseFrenchDatetime(liText);
      if (!date) return;

      // Extract time: "20:45" pattern (HH:MM)
      const timeMatch = liText.match(/\b(\d{2}):(\d{2})\b/);
      const time = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : parsedTime;

      // Logos — imgs inside the <li>, relative paths prefixed with ASM base URL
      const ASM_BASE = 'https://www.asmonaco.com';
      const toAsmAbsolute = (src?: string) =>
        src ? (src.startsWith('/') ? `${ASM_BASE}${src}` : src) : undefined;
      const imgs = liEl.find('img');
      const getImgSrc = (i: number) =>
        toAsmAbsolute(imgs.eq(i).attr('data-src') || imgs.eq(i).attr('src'));
      const homeTeamLogo = getImgSrc(0);
      const awayTeamLogo = getImgSrc(1);

      // Extract opponent name from the match page URL slug — reliable, no regex fragility.
      // e.g. href="/fr/pros/calendrier/as-monaco-o-marseille" → "O. Marseille"
      //      href="/fr/pros/calendrier/as-monaco-aj-auxerre"  → "Aj Auxerre"
      const matchHref = liEl.find('a[href*="/pros/calendrier/"]').first().attr('href') ?? '';
      const slug = matchHref.split('/').pop() ?? '';
      const opponentSlug = slug
        .replace(/^as-monaco-/, '')
        .replace(/-as-monaco$/, '');

      // Convert slug to display name: "o-marseille" → "O Marseille"
      const awayTeam = opponentSlug
        .split('-')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
        .trim();

      if (!awayTeam || awayTeam.length < 2) return;

      matches.push({
        competition: 'LIGUE1',
        homeTeam: 'AS Monaco',
        awayTeam,
        date,
        time,
        homeTeamLogo,
        awayTeamLogo,
      });
    });

    const filtered = matches.filter(m => m.date && isInCurrentWeek(m.date));
    log(`LIGUE1: ${filtered.length} Monaco home matches this week (out of ${matches.length} total)`);
    return filtered;
  } catch (err) {
    logError('LIGUE1 scraping failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── ELMS (European Le Mans Series) ────────────────────────────────────────

interface ElmsSubEvent {
  name: string;
  startDate: string;
}

interface ElmsJsonLd {
  '@type'?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  location?: { name?: string };
  subEvent?: ElmsSubEvent[];
}

/**
 * Extract local time "HH:mm" from an ISO 8601 date string with explicit offset.
 * e.g. "2026-07-05T12:00:00+02:00" → "12:00"
 * Falls back to Date-based UTC extraction if no offset pattern found.
 */
function extractLocalTime(isoStr: string): string {
  // Match the time portion before the offset: T(HH:mm:ss)
  const m = isoStr.match(/T(\d{2}):(\d{2})/);
  if (m) return `${m[1]}:${m[2]}`;
  // Fallback
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(11, 16);
}

const ELMS_COUNTRY_BY_SLUG: Record<string, string> = {
  barcelona:    'ES',
  castellet:    'FR',
  imola:        'IT',
  spa:          'BE',
  silverstone:  'GB',
  portimao:     'PT',
  portimão:     'PT',
};

function getElmsCountry(slug: string): string | undefined {
  const lower = slug.toLowerCase();
  for (const [keyword, code] of Object.entries(ELMS_COUNTRY_BY_SLUG)) {
    if (lower.includes(keyword)) return code;
  }
  return undefined;
}

function extractQualifyingClass(sessionName: string): string {
  // "Qualifying session LMGT3" → "LMGT3"
  let m = sessionName.match(/^Qualifying session\s+(.+)$/i);
  if (m) return m[1].trim();
  // "Qualifying - LMGT3 - 4 Hours of ..." → "LMGT3"
  m = sessionName.match(/^Qualifying\s+-\s+([^-]+)/i);
  if (m) return m[1].trim();
  return 'Qualifying';
}

async function scrapeELMS(): Promise<Match[]> {
  const client = createClient();
  const seasonUrl = 'https://www.europeanlemansseries.com/en/season/2026';

  try {
    // Step 1: Fetch season page and extract race slugs
    const seasonResp = await client.get(seasonUrl);
    const $season = cheerio.load(seasonResp.data as string);
    const slugSet = new Set<string>();

    $season('a[href*="/en/race/"]').each((_i, el) => {
      const href = $season(el).attr('href') || '';
      const slugMatch = href.match(/\/en\/race\/([^/]+)/);
      if (slugMatch) {
        slugSet.add(slugMatch[1]);
      }
    });

    const slugs = Array.from(slugSet).filter(s => !s.includes('official-test'));
    log(`ELMS: found ${slugs.length} race slugs`);

    if (slugs.length === 0) return [];

    // Step 2: Fetch each race page in parallel
    const raceResults = await Promise.allSettled(
      slugs.map(async (slug) => {
        const raceUrl = `https://www.europeanlemansseries.com/en/race/${slug}`;
        const raceResp = await client.get(raceUrl);
        const $race = cheerio.load(raceResp.data as string);

        // Extract JSON-LD
        let jsonLd: ElmsJsonLd | null = null;
        $race('script[type="application/ld+json"]').each((_i, el) => {
          try {
            const parsed = JSON.parse($race(el).html() || '{}') as ElmsJsonLd;
            if (parsed['@type'] === 'SportsEvent' && parsed.subEvent) {
              jsonLd = parsed;
            }
          } catch {
            // Ignore malformed JSON-LD blocks
          }
        });

        if (!jsonLd) {
          log(`ELMS: no valid JSON-LD found for slug "${slug}"`);
          return [];
        }

        const ld = jsonLd as ElmsJsonLd;
        const eventName = ld.name || slug;
        const locationName = ld.location?.name;
        const subEvents = ld.subEvent || [];

        const matches: Match[] = [];

        // Find Race sessions ("Race" or "Race - ..." or "Race– ...")
        const raceSessions = subEvents.filter((se) =>
          se.name === 'Race' || se.name.toLowerCase().startsWith('race -') || se.name.toLowerCase().startsWith('race–')
        );
        for (const session of raceSessions) {
          matches.push({
            competition: 'ELMS',
            homeTeam: eventName,
            awayTeam: 'Race',
            date: session.startDate,
            time: extractLocalTime(session.startDate),
            venue: locationName,
            country: getElmsCountry(slug),
            homeTeamLogo: 'https://www.europeanlemansseries.com/favicon.ico',
          });
        }

        // Toutes les sessions qualifying (chaque classe = une ligne)
        const qualSessions = subEvents
          .filter((se) => /^qualifying/i.test(se.name))
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

        for (const session of qualSessions) {
          const className = extractQualifyingClass(session.name);
          matches.push({
            competition: 'ELMS',
            homeTeam: eventName,
            awayTeam: `Qualif. ${className}`,
            date: session.startDate,
            time: extractLocalTime(session.startDate),
            venue: locationName,
            country: getElmsCountry(slug),
            homeTeamLogo: 'https://www.europeanlemansseries.com/favicon.ico',
          });
        }

        return matches;
      })
    );

    // Collect results, ignoring failed fetches
    const allMatches: Match[] = [];
    for (let i = 0; i < raceResults.length; i++) {
      const result = raceResults[i];
      if (result.status === 'fulfilled') {
        allMatches.push(...result.value);
      } else {
        logError(`ELMS: failed to scrape slug "${slugs[i]}":`, result.reason);
      }
    }

    // Filter to current ISO week
    const filtered = allMatches.filter((m) => isInCurrentWeek(m.date));
    log(`ELMS: ${allMatches.length} total sessions, ${filtered.length} in current week`);
    return filtered;
  } catch (err) {
    logError('ELMS scraping failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function fetchAllMatches(): Promise<{ data: Match[]; lastUpdated: string }> {
  const sources: Array<{
    key: string;
    fetch: () => Promise<Match[]>;
  }> = [
    {
      key: 'PRO_D2',
      fetch: () => scrapeLNR('https://prod2.lnr.fr/calendrier-et-resultats', 'PRO_D2'),
    },
    {
      key: 'TOP14',
      fetch: () => scrapeLNR('https://top14.lnr.fr/calendrier-et-resultats', 'TOP14'),
    },
    {
      key: 'LNH',
      fetch: scrapeLNH,
    },
    {
      key: 'EPCR',
      fetch: () => scrapeEPCRCompetition('https://www.epcrugby.com/fr/champions-cup/matchs', 'EPCR'),
    },
    {
      key: 'EPCR_CHALLENGE',
      fetch: () => scrapeEPCRCompetition('https://www.epcrugby.com/fr/challenge-cup/matchs', 'EPCR_CHALLENGE'),
    },
    {
      key: 'SUPER_LEAGUE',
      fetch: scrapeSuperLeagueCatalans,
    },
    {
      key: 'LIGUE1',
      fetch: scrapeMonacoLigue1,
    },
    {
      key: 'ELMS',
      fetch: scrapeELMS,
    },
  ];

  const allMatches: Match[] = [];

  // Fetch all sources in parallel, using cache when available
  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const cached = getCached(source.key);
      if (cached !== null) {
        log(`${source.key}: using cached data (${cached.length} matches)`);
        return cached;
      }

      const data = await source.fetch();
      setCache(source.key, data);
      return data;
    })
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      allMatches.push(...result.value);
    } else {
      logError(`${sources[i].key} failed:`, result.reason);
    }
  }

  // Sort by date
  allMatches.sort((a, b) => {
    const da = new Date(a.date).getTime() || 0;
    const db = new Date(b.date).getTime() || 0;
    return da - db;
  });

  return {
    data: allMatches,
    lastUpdated: getLastUpdated(),
  };
}
