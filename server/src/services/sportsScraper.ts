import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Match {
  competition: 'LNH' | 'PRO_D2' | 'TOP14' | 'EPCR' | 'EPCR_CHALLENGE' | 'LIGUE1' | 'ELMS' | 'ESTONIE' | 'SKI_CROSS' | 'SNOWBOARD' | 'FREESTYLE_EC';
  homeTeam: string;
  awayTeam: string;
  date: string;       // ISO date string
  time: string;       // "HH:mm" or "" if unknown
  venue?: string;
  country?: string;        // code ISO 2 lettres, ex: "FR", "ES"
  // Disciplines FIS :
  //  - ski cross  : SX (individuel), SXT (par équipe)
  //  - snowboard  : SBX (border cross), BXT (border cross équipe),
  //                 PGS (slalom géant parallèle), PSL (slalom parallèle),
  //                 GS (slalom géant), PRT (parallèle par équipe)
  //  - freestyle  : MO (bosses, y compris bosses en parallèle),
  //                 AE (ski acrobatique / sauts)
  discipline?: 'SX' | 'SXT' | 'SBX' | 'BXT' | 'PGS' | 'PSL' | 'GS' | 'PRT' | 'MO' | 'AE';
  gender?: 'M' | 'W';         // épreuves FIS : hommes / femmes
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

export function clearCache(): void {
  Object.keys(cache).forEach((key) => delete cache[key]);
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
/**
 * Parses match lines from a loaded cheerio instance for LNR pages.
 */
function parseLNRMatches(
  $: ReturnType<typeof cheerio.load>,
  competition: 'PRO_D2' | 'TOP14'
): Match[] {
  const matches: Match[] = [];
  let currentDate = '';

  $('.calendar-results__fixture-date, .match-line').each((_i, el) => {
    const tagEl = $(el);

    if (tagEl.hasClass('calendar-results__fixture-date')) {
      currentDate = tagEl.text().trim();
      return;
    }

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

  return matches;
}

async function scrapeLNR(
  url: string,
  competition: 'PRO_D2' | 'TOP14'
): Promise<Match[]> {
  const client = createClient();

  try {
    const resp = await client.get(url);
    const $ = cheerio.load(resp.data as string);

    const matches = parseLNRMatches($, competition);
    log(`${competition}: scraped ${matches.length} total matches from ${url}`);

    const filtered = matches.filter((m) => m.date && isInCurrentWeek(m.date));

    // In the playoffs, multiple rounds can fall in the same ISO week on separate
    // URLs (e.g. "barrage" + "access-top-14" both on the same weekend).
    // We therefore ALWAYS fetch all rounds from `:filter-list` whose number is
    // >= currentWeek.number and aggregate their matches, regardless of whether
    // the default page already returned some results.
    try {
      const currentWeekRaw = $('filters-fixtures').attr(':current-week');
      const currentSeasonRaw = $('filters-fixtures').attr(':current-season');
      const filterListRaw = $('filters-fixtures').attr(':filter-list');

      if (currentWeekRaw && currentSeasonRaw && filterListRaw) {
        const currentWeek = JSON.parse(currentWeekRaw) as { number: number; slug: string };
        const currentSeason = JSON.parse(currentSeasonRaw) as { id: number; name: string };

        let extraSlugs: string[] = [];
        try {
          const filterList = JSON.parse(filterListRaw) as {
            weeks?: Record<string, Array<{ slug: string; number: number }>>;
          };
          const seasonWeeks = filterList.weeks?.[String(currentSeason.id)] ?? [];
          // All rounds at/after current, excluding the one already shown on the
          // default page (currentWeek.slug) to avoid a redundant HTTP request.
          extraSlugs = seasonWeeks
            .filter((w) => w.number >= currentWeek.number && w.slug !== currentWeek.slug)
            .map((w) => w.slug);
        } catch (parseErr) {
          logError(`${competition} :filter-list parse failed:`, parseErr instanceof Error ? parseErr.message : parseErr);
        }

        // If filter-list was unreadable and the default page returned nothing,
        // fall back to a minimal hardcoded list of common end-of-season slugs.
        if (extraSlugs.length === 0 && filtered.length === 0) {
          extraSlugs = ['barrage', 'access-top-14', 'access-prod-d2', 'demi-finale', 'finale',
            `j${currentWeek.number + 1}`];
        }

        if (extraSlugs.length > 0) {
          log(`${competition}: checking ${extraSlugs.length} additional rounds: ${extraSlugs.join(', ')}`);
        }

        const aggregated = [...filtered];

        for (const slug of extraSlugs) {
          const roundUrl = `${url}/${currentSeason.name}/${slug}`;
          try {
            const roundResp = await client.get(roundUrl);
            const $round = cheerio.load(roundResp.data as string);
            const roundMatches = parseLNRMatches($round, competition);
            const roundFiltered = roundMatches.filter((m) => m.date && isInCurrentWeek(m.date));
            log(`${competition}: ${roundFiltered.length} matches in current week (${slug})`);
            aggregated.push(...roundFiltered);
          } catch (slugErr) {
            logError(`${competition} round ${slug} failed:`, slugErr instanceof Error ? slugErr.message : slugErr);
          }
        }

        // Deduplicate by (date|homeTeam|awayTeam)
        const seen = new Set<string>();
        const deduped = aggregated.filter((m) => {
          const key = `${m.date}|${m.homeTeam}|${m.awayTeam}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        log(`${competition}: ${deduped.length} total matches in current week (after dedup)`);
        return deduped;
      }
    } catch (err) {
      logError(`${competition} multi-round aggregation failed:`, err instanceof Error ? err.message : err);
    }

    log(`${competition}: ${filtered.length} matches in current week`);
    return filtered;
  } catch (err) {
    logError(`${competition} scraping failed:`, err instanceof Error ? err.message : err);
    return [];
  }
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
    // network requests on https://www.lnh.fr/daikin-starligue/calendrier
    // (season 2026-2027: competition renamed from "Liqui Moly StarLigue" to
    // "Daikin StarLigue", seasons_id 39 -> 40, key changed accordingly — see #25)
    const params = new URLSearchParams({
      seasons_id: '40',
      days_id: 'all',
      teams_id: 'all',
      univers: 'd1-26623',
      key: '594259290',
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
        'Referer': `${LNH_BASE}/daikin-starligue/calendrier`,
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

    const filtered = matches.filter(m => isInCurrentWeek(m.date) && isFrenchClub(m.homeTeam));
    log(`${competition}: ${filtered.length} home matches this week with French club (out of ${matches.length} total)`);
    return filtered;
  } catch (err) {
    logError(`${competition} scraping failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Ligue 1 — AS Monaco home matches (scraper) ──────────────────────────────

/**
 * Scrapes AS Monaco's official fixtures page (SSR) and returns Ligue 1 home
 * matches only (venue = Stade Louis-II).
 *
 * Page structure (verified live, 2026-08 — see #25, the previous selector
 * `a[href*="/pros/calendrier/"]` no longer exists and silently dropped every match):
 *   Each match: div[data-component="MatchPresentationCard"]
 *     data-competition="L1"        → Ligue 1 filter (empty for friendlies/other comps)
 *     time[datetime]                → "2026-08-06 20:00:00.000+02:00" (exact kickoff)
 *     .matchPresCardTeamName (x2)   → team names, in home → away order
 *     .matchPresCardMeta p          → contains the venue text (e.g. "Stade Louis-II")
 *   NOTE: data-away="true" is present on Monaco's HOME matches (inverted naming) —
 *   don't rely on it, use the venue text / team order instead.
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

    $('[data-component="MatchPresentationCard"]').each((_, el) => {
      const card = $(el);

      // Ligue 1 only
      if (card.attr('data-competition') !== 'L1') return;

      // Home matches only (Stade Louis-II)
      const metaText = card.find('.matchPresCardMeta p').first().text();
      if (!metaText.includes('Louis')) return;

      // Exact kickoff datetime, e.g. "2026-08-06 20:00:00.000+02:00"
      const dtAttr = card.find('time').attr('datetime');
      if (!dtAttr) return;
      const parsedDate = new Date(dtAttr.replace(' ', 'T'));
      if (isNaN(parsedDate.getTime())) return;
      const date = parsedDate.toISOString();
      const timeMatch = dtAttr.match(/(\d{2}):(\d{2}):\d{2}/);
      const time = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '';

      const teamNames = card
        .find('.matchPresCardTeamName')
        .map((_i, t) => $(t).text().trim())
        .get();
      const homeTeam = teamNames[0];
      const awayTeam = teamNames[1];
      if (!homeTeam || !awayTeam) return;

      // Logos — relative paths prefixed with ASM base URL
      const ASM_BASE = 'https://www.asmonaco.com';
      const toAsmAbsolute = (src?: string) =>
        src ? (src.startsWith('/') ? `${ASM_BASE}${src}` : src) : undefined;
      const logos = card.find('.matchPresCardTeamLogo img');
      const homeTeamLogo = toAsmAbsolute(logos.eq(0).attr('data-src') || logos.eq(0).attr('src'));
      const awayTeamLogo = toAsmAbsolute(logos.eq(1).attr('data-src') || logos.eq(1).attr('src'));

      matches.push({
        competition: 'LIGUE1',
        homeTeam,
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

    // Deduplicate by (date + awayTeam) — safety net against duplicate slugs or JSON-LD entries
    const seen = new Set<string>();
    const deduped = allMatches.filter((m) => {
      const key = `${m.date}|${m.awayTeam}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Filter to current ISO week
    const filtered = deduped.filter((m) => isInCurrentWeek(m.date));
    log(`ELMS: ${allMatches.length} total sessions → ${deduped.length} after dedup → ${filtered.length} in current week`);
    return filtered;
  } catch (err) {
    logError('ELMS scraping failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Estonie (Premium Liiga) — iCal jalgpall.ee ──────────────────────────────

/**
 * Scrapes the Estonian Premium Liiga fixtures from the official iCal feed.
 * The feed is parsed manually (no external iCal library): each VEVENT block is
 * extracted, then SUMMARY / DTSTART / LOCATION are read via regex.
 *
 * Timezone handling: DTSTART is in Europe/Tallinn local time. Estonia uses
 * EEST (UTC+3) in summer (months 4–9) and EET (UTC+2) in winter, so we subtract
 * the offset from the local components to build a correct UTC Date.
 */
async function scrapeEstonie(): Promise<Match[]> {
  const url =
    'https://jalgpall.ee/voistlused/download.php?type=calendar.download&action=download&league_id=52';
  try {
    const client = createClient();
    const resp = await client.get(url, { responseType: 'arraybuffer' });
    // Force UTF-8 decoding to preserve Estonian characters (ä, ü, õ, ö)
    const ical = Buffer.from(resp.data as ArrayBuffer).toString('utf-8');

    const matches: Match[] = [];
    const eventBlocks = ical.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

    for (const block of eventBlocks) {
      const summaryMatch = block.match(/SUMMARY:(.+)/);
      if (!summaryMatch) continue;
      const summary = summaryMatch[1].trim();
      const teams = summary.split(' vs ');
      if (teams.length < 2) continue;
      const homeTeam = teams[0].trim();
      const awayTeam = teams[1].trim();

      const dtMatch = block.match(
        /DTSTART[^:]*:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/
      );
      if (!dtMatch) continue;
      const year = parseInt(dtMatch[1], 10);
      const month = parseInt(dtMatch[2], 10); // 1-12
      const day = parseInt(dtMatch[3], 10);
      const hour = parseInt(dtMatch[4], 10);
      const minute = parseInt(dtMatch[5], 10);
      const second = parseInt(dtMatch[6], 10);

      // Estonia: EEST (UTC+3) months 4–9, EET (UTC+2) otherwise
      const offset = month >= 4 && month <= 9 ? 3 : 2;
      const date = new Date(
        Date.UTC(year, month - 1, day, hour - offset, minute, second)
      );

      if (!isInCurrentWeek(date.toISOString())) continue;

      const locationMatch = block.match(/LOCATION:([^\r\n,]+)/);
      const venue = locationMatch ? locationMatch[1].trim() : undefined;

      // Display time in Tallinn local time (as given in the feed)
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

      matches.push({
        competition: 'ESTONIE',
        homeTeam,
        awayTeam,
        date: date.toISOString(),
        time,
        venue,
        country: 'EE',
      });
    }

    log(`ESTONIE: ${eventBlocks.length} events → ${matches.length} in current week`);
    return matches;
  } catch (err) {
    logError('ESTONIE scraping failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── FIS (Coupe du Monde) — flux iCal data.fis-ski.com ───────────────────────

/**
 * Codes pays FIS (3 lettres, type CIO) → ISO 3166-1 alpha-2.
 * Couvre les nations habituelles des circuits FIS ski et snowboard (Coupe du
 * Monde et Coupe d'Europe).
 * Un code absent de cette table laisse `country` undefined (le drapeau n'est
 * simplement pas affiché côté client).
 */
const IOC3_TO_ISO2: Record<string, string> = {
  FRA: 'FR', SUI: 'CH', ITA: 'IT', AUT: 'AT', BIH: 'BA',
  SRB: 'RS', SWE: 'SE', CAN: 'CA', USA: 'US', GER: 'DE',
  NOR: 'NO', SLO: 'SI', CZE: 'CZ', POL: 'PL', FIN: 'FI',
  ESP: 'ES', AND: 'AD', NZL: 'NZ', JPN: 'JP', CHN: 'CN',
  KOR: 'KR', GBR: 'GB', NED: 'NL', BEL: 'BE', AUS: 'AU',
  RUS: 'RU', UKR: 'UA', BUL: 'BG', CRO: 'HR', SVK: 'SK',
  TUR: 'TR',
};

/**
 * Calcule le code saison FIS courant.
 * Une saison FIS est nommée d'après son année de fin : la saison 2026-2027
 * (décembre 2026 → mars 2027) porte le code "2027". On bascule sur la saison
 * suivante à partir de juillet, bien avant les premières épreuves de décembre.
 *
 * WARNING: ce calcul repose sur la convention actuelle de la FIS (bascule à
 * mi-année). Si la FIS change ses dates de saison ou son nommage, ce seuil
 * devra être ajusté — vérifier alors le paramètre `seasoncode` d'une URL de
 * résultats sur https://www.fis-ski.com/DB/general/results.html
 */
function getFisSeasonCode(ref: Date = new Date()): string {
  const year = ref.getFullYear();
  // getMonth(): 0=janvier … 6=juillet
  return String(ref.getMonth() >= 6 ? year + 1 : year);
}

interface FisIcalScrapeOptions {
  /** URL complète du flux iCal (seasoncode/sectorcode/disciplinecode inclus). */
  url: string;
  /** Compétition portée par les `Match` produits. */
  competition: Match['competition'];
  /** Code saison FIS, uniquement utilisé pour enrichir les logs. */
  seasonCode: string;
  /**
   * Déduit la discipline à partir du libellé "Event:" du flux.
   * Retourner `undefined` si le libellé n'est pas reconnu (aucun badge ne sera
   * alors affiché côté client).
   */
  classifyDiscipline: (eventLabel: string) => Match['discipline'];
}

/**
 * Scrape générique d'un flux iCal Coupe du Monde FIS (data.fis-ski.com).
 * Le flux est parsé manuellement (pas de librairie iCal externe), comme
 * scrapeEstonie(). Le format est identique d'un secteur à l'autre (ski
 * freestyle, snowboard…), seuls l'URL et le mapping des disciplines changent.
 *
 * Particularités du flux FIS :
 *  - DTSTART;VALUE=DATE:YYYYMMDD → date pure, sans heure (épreuve "toute la
 *    journée", les horaires dépendent de la météo) → `time` reste vide.
 *  - SUMMARY : "{Ville} ({PAYS_3}) - {Secteur} World Cup".
 *  - DESCRIPTION : contient "Gender: Men|Women" et "Event: {libellé}". Le
 *    libellé est le seul marqueur fiable pour identifier la discipline (la FIS
 *    ne renvoie pas le code discipline brut) → d'où `classifyDiscipline`.
 *  - CATEGORIES : "…-QUA" pour une qualification, "…-WC" pour une finale.
 */
async function scrapeFisIcalFeed(opts: FisIcalScrapeOptions): Promise<Match[]> {
  try {
    const client = createClient();
    const resp = await client.get(opts.url, { responseType: 'arraybuffer' });
    // Force UTF-8 decoding to preserve accented venue names (ex: "Gällivare")
    const ical = Buffer.from(resp.data as ArrayBuffer).toString('utf-8');

    const matches: Match[] = [];
    const eventBlocks = ical.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

    for (const block of eventBlocks) {
      // Date pure : DTSTART;VALUE=DATE:20261208
      const dtMatch = block.match(/DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})/);
      if (!dtMatch) continue;
      const year = parseInt(dtMatch[1], 10);
      const month = parseInt(dtMatch[2], 10); // 1-12
      const day = parseInt(dtMatch[3], 10);
      // Minuit local : l'épreuve n'a pas d'horaire publié
      const date = new Date(year, month - 1, day);
      if (isNaN(date.getTime())) continue;

      const isoDate = date.toISOString();
      if (!isInCurrentWeek(isoDate)) continue;

      // "Val Thorens (FRA) - Freestyle World Cup" → ville + code pays 3 lettres
      const summaryMatch = block.match(/SUMMARY:(.+)/);
      if (!summaryMatch) continue;
      const summary = summaryMatch[1].trim();
      const venueMatch = summary.match(/^(.*?)\s*\(([A-Z]{3})\)/);
      if (!venueMatch) continue;
      const city = venueMatch[1].trim();
      const country = IOC3_TO_ISO2[venueMatch[2]];

      // La DESCRIPTION est sur une seule ligne : on l'isole avant d'en extraire
      // les champs, sinon "X-MICROSOFT-CDO-ALLDAYEVENT:TRUE" parasiterait la
      // recherche de "Event:".
      const descMatch = block.match(/DESCRIPTION:(.+)/);
      const description = descMatch ? descMatch[1] : '';

      // Les champs sont séparés par des séquences d'échappement iCal ("\n",
      // parfois "\" seul dans ce flux) → on s'arrête au prochain backslash.
      const eventMatch = description.match(/Event:\s*([^\\]*)/);
      const eventLabel = eventMatch ? eventMatch[1].trim() : '';
      const discipline = opts.classifyDiscipline(eventLabel);

      const genderMatch = description.match(/Gender:\s*(Men|Women)/i);
      const gender: 'M' | 'W' | undefined = genderMatch
        ? (genderMatch[1].toLowerCase() === 'women' ? 'W' : 'M')
        : undefined;

      const isQualification = /CATEGORIES:[^\r\n]*QUA/.test(block);

      matches.push({
        competition: opts.competition,
        homeTeam: city,
        awayTeam: isQualification ? 'Qualification' : 'Finale',
        date: isoDate,
        time: '',
        venue: city,
        country,
        discipline,
        gender,
      });
    }

    log(`${opts.competition}: season ${opts.seasonCode}, ${eventBlocks.length} events → ${matches.length} in current week`);
    return matches;
  } catch (err) {
    logError(`${opts.competition} scraping failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Coupe du Monde FIS de Ski Cross (secteur FS = freestyle).
 * Disciplines : SX = individuel, SXT = par équipe. La FIS ne publiant pas le
 * code brut, la présence du mot "Team" dans le libellé suffit à trancher.
 */
async function scrapeSkiCross(): Promise<Match[]> {
  const seasonCode = getFisSeasonCode();
  return scrapeFisIcalFeed({
    url:
      'https://data.fis-ski.com/services/public/icalendar-feed-fis-events.html' +
      `?seasoncode=${seasonCode}&sectorcode=FS&categorycode=WC&disciplinecode=SX,SXT`,
    competition: 'SKI_CROSS',
    seasonCode,
    classifyDiscipline: (eventLabel) => (/team/i.test(eventLabel) ? 'SXT' : 'SX'),
  });
}

/**
 * Coupe du Monde FIS de Snowboard (secteur SB), même format de flux que le
 * Ski Cross. Libellés "Event:" observés dans le flux réel :
 *   "Snowboard Cross [Team|Qualification]", "Parallel Team [Qualification]",
 *   "Parallel Giant Slalom [Qualification]", "Parallel Slalom [Qualification]".
 *
 * WARNING: l'ordre des tests ci-dessous est significatif — "Parallel Giant
 * Slalom" contient "giant slalom", et "Snowboard Cross Team" contient
 * "snowboard cross" : les libellés les plus spécifiques doivent être testés en
 * premier.
 */
function classifySnowboardDiscipline(eventLabel: string): Match['discipline'] {
  const label = eventLabel.toLowerCase();
  if (label.includes('snowboard cross')) {
    return label.includes('team') ? 'BXT' : 'SBX';
  }
  if (label.includes('parallel team')) return 'PRT';
  if (label.includes('parallel giant slalom')) return 'PGS';
  if (label.includes('parallel slalom')) return 'PSL';
  if (label.includes('giant slalom')) return 'GS';
  return undefined;
}

async function scrapeSnowboard(): Promise<Match[]> {
  const seasonCode = getFisSeasonCode();
  return scrapeFisIcalFeed({
    url:
      'https://data.fis-ski.com/services/public/icalendar-feed-fis-events.html' +
      `?seasoncode=${seasonCode}&sectorcode=SB&categorycode=WC&disciplinecode=SBX,BXT,PGS,PSL,GS,PRT`,
    competition: 'SNOWBOARD',
    seasonCode,
    classifyDiscipline: classifySnowboardDiscipline,
  });
}

/**
 * Coupe d'Europe FIS de Ski Freestyle (secteur FS, categorycode=EC).
 * Même format de flux que les Coupes du Monde ci-dessus : seul le paramètre
 * `categorycode` change (EC au lieu de WC).
 *
 * Libellés "Event:" observés dans le flux réel : "Aerials", "Moguls" et
 * "Dual Moguls" — cette dernière est une variante des bosses, pas une
 * discipline FIS distincte : elle est donc classée MO.
 *
 * NOTE: le champ CATEGORIES de ce flux vaut toujours "FIS-calendar-FS-EC"
 * (pas de suffixe QUA comme en Coupe du Monde) : toutes les épreuves seront
 * donc étiquetées "Finale", ce qui correspond à la réalité de ces épreuves à
 * manche unique.
 */
function classifyFreestyleECDiscipline(eventLabel: string): Match['discipline'] {
  const label = eventLabel.toLowerCase();
  if (label.includes('aerials')) return 'AE';
  if (label.includes('moguls')) return 'MO'; // couvre "Moguls" et "Dual Moguls"
  return undefined;
}

async function scrapeFreestyleEC(): Promise<Match[]> {
  const seasonCode = getFisSeasonCode();
  return scrapeFisIcalFeed({
    url:
      'https://data.fis-ski.com/services/public/icalendar-feed-fis-events.html' +
      `?seasoncode=${seasonCode}&sectorcode=FS&categorycode=EC&disciplinecode=MO,AE`,
    competition: 'FREESTYLE_EC',
    seasonCode,
    classifyDiscipline: classifyFreestyleECDiscipline,
  });
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
      key: 'LIGUE1',
      fetch: scrapeMonacoLigue1,
    },
    {
      key: 'ELMS',
      fetch: scrapeELMS,
    },
    {
      key: 'ESTONIE',
      fetch: scrapeEstonie,
    },
    {
      key: 'SKI_CROSS',
      fetch: scrapeSkiCross,
    },
    {
      key: 'SNOWBOARD',
      fetch: scrapeSnowboard,
    },
    {
      key: 'FREESTYLE_EC',
      fetch: scrapeFreestyleEC,
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
