import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Match {
  competition: 'LNH' | 'PRO_D2' | 'TOP14';
  homeTeam: string;
  awayTeam: string;
  date: string;       // ISO date string
  time: string;       // "HH:mm" or "" if unknown
  venue?: string;
  homeTeamLogo?: string;   // URL absolue du logo de l'équipe domicile
  awayTeamLogo?: string;   // URL absolue du logo de l'équipe extérieure
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

// ─── LNH Scraper (Puppeteer — SPA) ─────────────────────────────────────────

/**
 * Scrapes the LNH Starligue calendar using Puppeteer (headless Chromium).
 * The site is a client-side SPA: match data is rendered via JavaScript and
 * is not available in the raw HTML source. Puppeteer waits for the DOM to
 * be populated, then extracts match information via page.evaluate().
 */
async function scrapeLNH(): Promise<Match[]> {
  const LNH_URL = 'https://www.lnh.fr/liquimoly-starligue/calendrier';
  const LNH_BASE = 'https://www.lnh.fr';

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    await page.goto(LNH_URL, {
      waitUntil: 'networkidle2',
      timeout: 30_000,
    });

    // Try several possible selectors — the SPA DOM structure is unknown a priori
    const CANDIDATE_SELECTORS = [
      '.match',
      '.matchs',
      '.rencontre',
      '[class*="match"]',
      '[class*="fixture"]',
      '[class*="game-card"]',
      '[class*="calendar"] [class*="row"]',
    ];

    let matchSelector: string | null = null;
    for (const selector of CANDIDATE_SELECTORS) {
      try {
        await page.waitForSelector(selector, { timeout: 15_000 });
        const count = await page.$$eval(selector, (els) => els.length);
        if (count > 0) {
          matchSelector = selector;
          log(`LNH: found ${count} elements with selector "${selector}"`);
          break;
        }
      } catch {
        // Selector not found within timeout, try next
      }
    }

    if (!matchSelector) {
      log('LNH: no match elements found with any candidate selector');
      return [];
    }

    // Extract match data from the DOM via page.evaluate.
    // The JS string is evaluated in the browser context (Chromium) where DOM
    // globals exist. We pass it as a string to avoid TS errors since the Node
    // tsconfig does not include the 'dom' lib.
    interface RawLNHMatch {
      homeTeam: string;
      awayTeam: string;
      dateText: string;
      timeText: string;
      homeLogo: string;
      awayLogo: string;
    }

    const extractScript = `
      (function(selector, baseUrl) {
        var elements = document.querySelectorAll(selector);
        var results = [];

        elements.forEach(function(el) {
          var teamEls = el.querySelectorAll(
            '[class*="team"], [class*="equipe"], [class*="club"], [class*="nom"]'
          );
          var imgEls = el.querySelectorAll('img');

          var homeTeam = '';
          var awayTeam = '';
          var homeLogo = '';
          var awayLogo = '';

          if (teamEls.length >= 2) {
            homeTeam = (teamEls[0].textContent || '').trim();
            awayTeam = (teamEls[1].textContent || '').trim();
          } else {
            var spans = el.querySelectorAll('span, a, div, p');
            var teamTexts = [];
            spans.forEach(function(s) {
              var text = (s.textContent || '').trim();
              if (text.length >= 2 && text.length <= 50 && !/^\\d+$/.test(text)) {
                teamTexts.push(text);
              }
            });
            if (teamTexts.length >= 2) {
              homeTeam = teamTexts[0];
              awayTeam = teamTexts[1];
            }
          }

          if (imgEls.length >= 2) {
            var src0 = imgEls[0].getAttribute('src') || '';
            var src1 = imgEls[1].getAttribute('src') || '';
            homeLogo = src0.startsWith('http') ? src0 : src0 ? baseUrl + src0 : '';
            awayLogo = src1.startsWith('http') ? src1 : src1 ? baseUrl + src1 : '';
          }

          var dateEl = el.querySelector('[class*="date"], time, [datetime]');
          var timeEl = el.querySelector('[class*="time"], [class*="heure"], [class*="hour"]');

          var dateText = '';
          var timeText = '';

          if (dateEl) {
            dateText = dateEl.getAttribute('datetime') || (dateEl.textContent || '').trim();
          }
          if (timeEl) {
            timeText = (timeEl.textContent || '').trim();
          }

          if (!timeText && dateText) {
            var tMatch = dateText.match(/(\\d{1,2})[h:](\\d{2})/);
            if (tMatch) {
              timeText = tMatch[1] + 'h' + tMatch[2];
            }
          }

          if (!dateText) {
            var parent = el.closest('[class*="day"], [class*="jour"], [class*="round"]');
            if (parent) {
              var parentDateEl = parent.querySelector('[class*="date"], time, [datetime]');
              if (parentDateEl) {
                dateText = parentDateEl.getAttribute('datetime') || (parentDateEl.textContent || '').trim();
              }
            }
          }

          if (homeTeam && awayTeam) {
            results.push({
              homeTeam: homeTeam,
              awayTeam: awayTeam,
              dateText: dateText,
              timeText: timeText,
              homeLogo: homeLogo,
              awayLogo: awayLogo
            });
          }
        });

        return results;
      })('${matchSelector.replace(/'/g, "\\'")}', '${LNH_BASE}')
    `;

    const rawMatches = await page.evaluate(extractScript) as RawLNHMatch[];

    log(`LNH: extracted ${rawMatches.length} raw matches from DOM`);

    // Parse extracted data into Match objects
    const matches: Match[] = rawMatches.map((raw) => {
      const parsed = parseFrenchDatetime(
        raw.timeText ? `${raw.dateText} ${raw.timeText}` : raw.dateText
      );

      return {
        competition: 'LNH' as const,
        homeTeam: raw.homeTeam,
        awayTeam: raw.awayTeam,
        date: parsed.date,
        time: parsed.time || raw.timeText.replace('h', ':') || '',
        homeTeamLogo: raw.homeLogo || undefined,
        awayTeamLogo: raw.awayLogo || undefined,
      };
    });

    const filtered = matches.filter((m) => m.date && isInCurrentWeek(m.date));
    log(`LNH: ${filtered.length} matches in current week (out of ${matches.length} total)`);
    return filtered;
  } catch (err) {
    logError('LNH Puppeteer scraping failed:', err instanceof Error ? err.message : err);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
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
