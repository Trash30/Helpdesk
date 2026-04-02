import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Match {
  competition: 'LNH' | 'PRO_D2' | 'TOP14' | 'EPCR';
  homeTeam: string;
  awayTeam: string;
  date: string;       // ISO date string
  time: string;       // "HH:mm" or "" if unknown
  venue?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  broadcasterLogo?: string;  // URL logo diffuseur TV
}

interface CacheEntry {
  data: Match[];
  fetchedAt: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

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
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
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

function isInCurrentWeek(dateStr: string): boolean {
  const matchDate = new Date(dateStr);
  if (isNaN(matchDate.getTime())) return false;
  const { monday, sunday } = getISOWeekBounds(new Date());
  return matchDate >= monday && matchDate <= sunday;
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
  const dateMatch = rawDate.toLowerCase().match(/(\d{1,2})\s+([a-zéûôàè]+)/);
  if (!dateMatch) return '';

  const day = parseInt(dateMatch[1], 10);
  const monthName = dateMatch[2].normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip accents
  const month = FRENCH_MONTHS[dateMatch[2]] ?? FRENCH_MONTHS[monthName];
  if (month === undefined) return '';

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
      // Format: "Liqui Moly StarLigue - J22 ven. 03 avril 20h00"
      const lnhDateMatch = rawDatetime.match(/[a-z]{2,3}\.\s+(\d{1,2})\s+([a-zéùûôàèîïœæ]+)\.?\s+(\d{1,2}h\d{2})/i);
      const rawTime = lnhDateMatch ? lnhDateMatch[3] : '';
      const cleanDate = lnhDateMatch ? `${lnhDateMatch[1]} ${lnhDateMatch[2]}` : rawDatetime;
      const parsed = { date: parseLNRDate(cleanDate, rawTime), time: rawTime.replace('h', ':') };

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

    const filtered = matches.filter(m => m.date && isInCurrentWeek(m.date));
    log(`LNH: ${filtered.length} matches in current week (out of ${matches.length} total)`);
    return filtered;
  } catch (err) {
    logError('LNH scraping failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Date parsing helpers ───────────────────────────────────────────────────

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 0, fevrier: 1, 'f\u00e9vrier': 1, mars: 2, avril: 3,
  mai: 4, juin: 5, juillet: 6, aout: 7, 'ao\u00fbt': 7,
  septembre: 8, octobre: 9, novembre: 10, decembre: 11, 'd\u00e9cembre': 11,
  jan: 0, fev: 1, 'f\u00e9v': 1, mar: 2, avr: 3,
  jui: 5, juil: 6, jul: 6, aou: 7, 'ao\u00fb': 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11, 'd\u00e9c': 11,
};

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

// French clubs currently competing in the Champions Cup (2025-2026)
const FRENCH_EPCR_CLUBS = [
  'Stade Toulousain', 'Toulouse',
  'Stade Rochelais', 'La Rochelle',
  'Bordeaux-Bègles', 'Union Bordeaux-Bègles',
  'Stade Français', 'Stade Français Paris',
  'Clermont', 'Clermont Auvergne', 'ASM Clermont',
  'Bayonne', 'Aviron Bayonnais',
  'Castres', 'Castres Olympique',
  'Racing 92', 'Racing',
  'Lyon', 'LOU Rugby',
];

function isFrenchClub(name: string): boolean {
  return FRENCH_EPCR_CLUBS.some(c => name.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(name.toLowerCase()));
}

/**
 * Scrapes EPCR Champions Cup from the Nuxt SSR payload embedded in the HTML.
 * Only returns matches where the home team is a French club.
 */
async function scrapeEPCR(): Promise<Match[]> {
  const client = createClient();
  try {
    const resp = await client.get('https://www.epcrugby.com/fr/champions-cup/matchs');
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
        competition: 'EPCR',
        homeTeam,
        awayTeam,
        date: d.toISOString(),
        time: `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`,
        homeTeamLogo: typeof homeLogo === 'string' ? homeLogo : undefined,
        awayTeamLogo: typeof awayLogo === 'string' ? awayLogo : undefined,
      });
    }

    const filtered = matches.filter(m => isInCurrentWeek(m.date) && isFrenchClub(m.homeTeam));
    log(`EPCR: ${filtered.length} matches this week with French home team (out of ${matches.length} total)`);
    return filtered;
  } catch (err) {
    logError('EPCR scraping failed:', err instanceof Error ? err.message : err);
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
      fetch: scrapeEPCR,
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
