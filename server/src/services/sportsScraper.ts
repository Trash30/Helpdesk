import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Match {
  competition: 'LNH' | 'PRO_D2' | 'TOP14';
  homeTeam: string;
  awayTeam: string;
  date: string;       // ISO date string
  time: string;       // "HH:mm" or "" if unknown
  venue?: string;
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

// ─── LNR Scraper (Pro D2 & Top 14) ─────────────────────────────────────────

/**
 * Scrapes the LNR calendar pages (same DOM structure for Pro D2 and Top 14).
 * The pages use SSR with match blocks containing team names, dates and times.
 */
async function scrapeLNR(
  url: string,
  competition: 'PRO_D2' | 'TOP14'
): Promise<Match[]> {
  const client = createClient();
  const matches: Match[] = [];

  try {
    const resp = await client.get(url);
    const html: string = resp.data;
    const $ = cheerio.load(html);

    // LNR sites structure: match cards within calendar sections
    // Try multiple selectors to be resilient to minor DOM changes

    // Pattern 1: .match-card or .matchCard elements
    $('[class*="match"], [class*="Match"], .rencontre, .game').each((_i, el) => {
      const block = $(el);
      const text = block.text();

      // Try to extract teams - look for team name elements
      const teamEls = block.find('[class*="team"], [class*="equipe"], [class*="club"]');
      let homeTeam = '';
      let awayTeam = '';

      if (teamEls.length >= 2) {
        homeTeam = teamEls.eq(0).text().trim();
        awayTeam = teamEls.eq(1).text().trim();
      }

      // Try to extract date/time
      const dateEl = block.find('[class*="date"], time, [datetime]');
      let dateStr = '';
      let timeStr = '';

      if (dateEl.length > 0) {
        const datetime = dateEl.attr('datetime') || dateEl.text().trim();
        const parsed = parseFrenchDatetime(datetime);
        dateStr = parsed.date;
        timeStr = parsed.time;
      }

      // Fallback: try to parse from the raw text
      if (!dateStr) {
        const parsed = extractDateFromText(text);
        dateStr = parsed.date;
        timeStr = parsed.time || timeStr;
      }

      if (homeTeam && awayTeam) {
        matches.push({
          competition,
          homeTeam,
          awayTeam,
          date: dateStr,
          time: timeStr,
        });
      }
    });

    // Pattern 2: table-based layout (common in LNR)
    if (matches.length === 0) {
      $('table tbody tr, .calendar-row, .fixture-row').each((_i, el) => {
        const row = $(el);
        const cells = row.find('td, .cell, .col');

        if (cells.length >= 2) {
          const texts = cells.map((_j, cell) => $(cell).text().trim()).get();
          const teamPattern = texts.filter((t) => t.length > 2 && !t.match(/^\d/));
          const datePattern = texts.find((t) => t.match(/\d{2}[/.-]\d{2}[/.-]\d{2,4}/));

          if (teamPattern.length >= 2 && datePattern) {
            const parsed = parseFrenchDatetime(datePattern);
            matches.push({
              competition,
              homeTeam: teamPattern[0],
              awayTeam: teamPattern[1],
              date: parsed.date,
              time: parsed.time,
            });
          }
        }
      });
    }

    // Pattern 3: structured data in JSON-LD or script tags
    if (matches.length === 0) {
      $('script[type="application/ld+json"]').each((_i, el) => {
        try {
          const json = JSON.parse($(el).html() || '');
          const events = Array.isArray(json) ? json : [json];
          for (const event of events) {
            if (event['@type'] === 'SportsEvent' && event.homeTeam && event.awayTeam) {
              const startDate = event.startDate || '';
              const d = new Date(startDate);
              matches.push({
                competition,
                homeTeam: event.homeTeam.name || event.homeTeam,
                awayTeam: event.awayTeam.name || event.awayTeam,
                date: isNaN(d.getTime()) ? '' : d.toISOString(),
                time: isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
                venue: event.location?.name,
              });
            }
          }
        } catch {
          // Invalid JSON, skip
        }
      });
    }

    log(`${competition}: scraped ${matches.length} total matches from ${url}`);
  } catch (err) {
    logError(`${competition} scraping failed:`, err instanceof Error ? err.message : err);
    return [];
  }

  // Filter to current week
  const filtered = matches.filter((m) => m.date && isInCurrentWeek(m.date));
  log(`${competition}: ${filtered.length} matches in current week`);
  return filtered;
}

// ─── LNH Scraper ────────────────────────────────────────────────────────────

/**
 * The LNH site uses AJAX to load calendar data.
 * We attempt the known AJAX endpoint with various parameter combinations.
 */
async function scrapeLNH(): Promise<Match[]> {
  const client = createClient();
  const matches: Match[] = [];
  const ajaxUrl = 'https://www.lnh.fr/ajax';

  const paramSets = [
    { controller: 'sportsCalendars', action: 'index_ajax' },
    { controller: 'sportsCalendars', action: 'index_ajax', competition: 'liquimoly-starligue' },
    { controller: 'sportsCalendars', action: 'index_ajax', type: 'week' },
  ];

  for (const params of paramSets) {
    try {
      // Try GET first
      const getResp = await client.get(ajaxUrl, { params });
      if (getResp.status === 200 && getResp.data) {
        const parsed = parseLNHResponse(getResp.data);
        if (parsed.length > 0) {
          matches.push(...parsed);
          break;
        }
      }
    } catch {
      // GET failed, try POST
      try {
        const filteredParams: Record<string, string> = {};
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined) filteredParams[k] = v;
        }
        const postResp = await client.post(ajaxUrl, new URLSearchParams(filteredParams).toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });
        if (postResp.status === 200 && postResp.data) {
          const parsed = parseLNHResponse(postResp.data);
          if (parsed.length > 0) {
            matches.push(...parsed);
            break;
          }
        }
      } catch {
        // This param set failed entirely, try next
      }
    }
  }

  // Fallback: try to scrape the main page HTML directly
  if (matches.length === 0) {
    try {
      const resp = await client.get('https://www.lnh.fr/liquimoly-starligue/calendrier');
      const html: string = resp.data;
      const $ = cheerio.load(html);

      $('[class*="match"], [class*="game"], [class*="fixture"], .rencontre').each((_i, el) => {
        const block = $(el);
        const teamEls = block.find('[class*="team"], [class*="equipe"], [class*="club"]');
        let homeTeam = '';
        let awayTeam = '';

        if (teamEls.length >= 2) {
          homeTeam = teamEls.eq(0).text().trim();
          awayTeam = teamEls.eq(1).text().trim();
        }

        const dateEl = block.find('[class*="date"], time, [datetime]');
        let dateStr = '';
        let timeStr = '';

        if (dateEl.length > 0) {
          const datetime = dateEl.attr('datetime') || dateEl.text().trim();
          const parsed = parseFrenchDatetime(datetime);
          dateStr = parsed.date;
          timeStr = parsed.time;
        }

        if (homeTeam && awayTeam) {
          matches.push({
            competition: 'LNH',
            homeTeam,
            awayTeam,
            date: dateStr,
            time: timeStr,
          });
        }
      });
    } catch (err) {
      logError('LNH HTML fallback failed:', err instanceof Error ? err.message : err);
    }
  }

  log(`LNH: scraped ${matches.length} total matches`);

  const filtered = matches.filter((m) => m.date && isInCurrentWeek(m.date));
  log(`LNH: ${filtered.length} matches in current week`);
  return filtered;
}

/**
 * Parse the LNH AJAX response which may be JSON or HTML.
 */
function parseLNHResponse(data: unknown): Match[] {
  const matches: Match[] = [];

  if (typeof data === 'string') {
    // Might be HTML fragment
    const $ = cheerio.load(data);
    $('[class*="match"], [class*="game"], tr, .rencontre').each((_i, el) => {
      const block = $(el);
      const teamEls = block.find('[class*="team"], [class*="equipe"], td');
      if (teamEls.length >= 2) {
        const homeTeam = teamEls.eq(0).text().trim();
        const awayTeam = teamEls.eq(1).text().trim();
        if (homeTeam && awayTeam && homeTeam.length < 60 && awayTeam.length < 60) {
          const dateEl = block.find('[class*="date"], time, [datetime]');
          const datetime = dateEl.attr('datetime') || dateEl.text().trim();
          const parsed = parseFrenchDatetime(datetime);
          matches.push({
            competition: 'LNH',
            homeTeam,
            awayTeam,
            date: parsed.date,
            time: parsed.time,
          });
        }
      }
    });
  } else if (typeof data === 'object' && data !== null) {
    // JSON response - try to find match data in various structures
    const obj = data as Record<string, unknown>;
    const items = Array.isArray(obj.data) ? obj.data :
                  Array.isArray(obj.matches) ? obj.matches :
                  Array.isArray(obj.events) ? obj.events :
                  Array.isArray(obj.results) ? obj.results :
                  Array.isArray(data) ? data as unknown[] : [];

    for (const item of items) {
      if (typeof item === 'object' && item !== null) {
        const m = item as Record<string, unknown>;
        const homeTeam = String(m.homeTeam || m.home_team || m.team_home || m.domicile || '');
        const awayTeam = String(m.awayTeam || m.away_team || m.team_away || m.exterieur || '');
        const dateVal = String(m.date || m.startDate || m.start_date || m.datetime || '');

        if (homeTeam && awayTeam) {
          const d = new Date(dateVal);
          matches.push({
            competition: 'LNH',
            homeTeam,
            awayTeam,
            date: isNaN(d.getTime()) ? dateVal : d.toISOString(),
            time: isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
            venue: m.venue ? String(m.venue) : undefined,
          });
        }
      }
    }
  }

  return matches;
}

// ─── Date parsing helpers ───────────────────────────────────────────────────

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 0, fevrier: 1, 'f\u00e9vrier': 1, mars: 2, avril: 3,
  mai: 4, juin: 5, juillet: 6, aout: 7, 'ao\u00fbt': 7,
  septembre: 8, octobre: 9, novembre: 10, decembre: 11, 'd\u00e9cembre': 11,
  jan: 0, fev: 1, 'f\u00e9v': 1, mar: 2, avr: 3,
  jui: 5, jul: 6, aou: 7, 'ao\u00fb': 7, sep: 8, oct: 9, nov: 10, dec: 11, 'd\u00e9c': 11,
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

function extractDateFromText(text: string): { date: string; time: string } {
  // Try to find any date-like pattern in text
  const patterns = [
    /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/,
    /(\d{1,2})\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)\s+(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseFrenchDatetime(match[0]);
    }
  }

  return { date: '', time: '' };
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
