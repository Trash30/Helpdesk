/**
 * SCRIPT JETABLE — extraction du calendrier complet de la saison 2026-2027.
 *
 * Reprend la logique de parsing de server/src/services/sportsScraper.ts MAIS
 * sans le filtre `isInCurrentWeek()` : on veut TOUTE la saison, jour par jour,
 * pour reconstruire docs/CALENDRIER_CHARGE_2026_2027.html avec des dates exactes.
 *
 * Ce script ne fait PARTIE d'aucun build : il est autonome, en JS pur, et
 * réutilise axios/cheerio depuis server/node_modules. La duplication de logique
 * avec sportsScraper.ts est assumée (script one-off).
 *
 * Usage :
 *   node docs/scrape-season-calendar.js
 *
 * Sortie :
 *   docs/calendrier-charge-2026-2027-dates.json
 *     [{ date: "2026-09-05", competition: "TOP14", precision: "exact" }, ...]
 *
 *   `precision` indique la fiabilité de la date, telle que publiée par la source :
 *     - "exact"       : jour confirmé par la source.
 *     - "range"       : la source n'annonce qu'une PLAGE pour la journée
 *                       (ex. LNR : "samedi 23 janvier – dimanche 24 janvier").
 *                       Tous les jours de la plage sont émis — pour une
 *                       estimation de charge c'est le bon comportement, le
 *                       week-end complet étant effectivement mobilisé.
 *     - "provisional" : jour annoncé mais explicitement marqué non définitif
 *                       par la source (AS Monaco "Date et horaire non
 *                       définitifs", LNH "(provisoire)").
 */

const path = require('path');
const fs = require('fs');

const SERVER_MODULES = path.join(__dirname, '..', 'server', 'node_modules');
const axios = require(path.join(SERVER_MODULES, 'axios'));
const cheerio = require(path.join(SERVER_MODULES, 'cheerio'));

// ─── Fenêtre saison ─────────────────────────────────────────────────────────

const WINDOW_START = '2026-07-28';
const WINDOW_END = '2027-07-01';

/** Année de départ de la saison (juil. 2026 → juin 2027). */
const SEASON_START_YEAR = 2026;
/**
 * Mois pivot pour deviner l'année quand la source ne la publie pas (LNR, LNH
 * n'affichent que "samedi 23 janvier"). Août..déc → 2026, janv..juil → 2027.
 */
const SEASON_PIVOT_MONTH = 7; // 0=janvier … 7=août

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const OUTPUT_PATH = path.join(__dirname, 'calendrier-charge-2026-2027-dates.json');

// ─── Utilitaires ────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Délai de courtoisie entre requêtes vers une même source publique. */
const POLITE_DELAY_MS = 400;

function log(...args) {
  console.log(...args);
}

function createClient() {
  return axios.create({
    timeout: 20_000,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
    },
  });
}

const FRENCH_MONTHS = {
  janvier: 0, fevrier: 1, 'février': 1, mars: 2, avril: 3,
  mai: 4, juin: 5, juillet: 6, aout: 7, 'août': 7,
  septembre: 8, octobre: 9, novembre: 10, decembre: 11, 'décembre': 11,
  jan: 0, fev: 1, 'fév': 1, mar: 2, avr: 3,
  jui: 5, juil: 6, jul: 6, aou: 7, 'aoû': 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11, 'déc': 11,
  // Abréviations 4 lettres utilisées par la LNH ("ven. 05 févr. 20h00").
  // Sans elles, tous les matchs de février étaient jetés (bug connu en prod).
  janv: 0, fevr: 1, 'févr': 1, juill: 6,
};

/** Noms de mois complets, pour la résolution par préfixe. */
const FULL_MONTHS = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
];

/**
 * Résout un mois français, y compris les abréviations non listées, via une
 * correspondance par préfixe non ambiguë ("févr" → "fevrier").
 */
function resolveMonth(token) {
  if (!token) return undefined;
  const raw = token.toLowerCase();
  if (FRENCH_MONTHS[raw] !== undefined) return FRENCH_MONTHS[raw];
  const stripped = raw.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (FRENCH_MONTHS[stripped] !== undefined) return FRENCH_MONTHS[stripped];
  if (stripped.length < 3) return undefined;
  const hits = FULL_MONTHS
    .map((name, idx) => ({ name, idx }))
    .filter(({ name }) => name.startsWith(stripped));
  return hits.length === 1 ? hits[0].idx : undefined;
}

/** "YYYY-MM-DD" à partir de composantes locales. */
function ymd(year, month /* 0-11 */, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" à partir d'une Date, en composantes LOCALES. */
function ymdFromDate(d) {
  return ymd(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Parse "samedi 23 janvier" (sans année) en "YYYY-MM-DD", en déduisant l'année
 * depuis la saison (et non depuis `now` comme le fait parseLNRDate en prod :
 * ce dernier renverrait juin 2026 au lieu de juin 2027 pour la finale).
 */
function parseSeasonDayMonth(raw) {
  if (!raw) return '';
  const m = raw.toLowerCase().match(/(\d{1,2})\s+([a-zà-ÿ]+)/);
  if (!m) return '';
  const day = parseInt(m[1], 10);
  const month = resolveMonth(m[2]);
  if (month === undefined) return '';
  const year = month >= SEASON_PIVOT_MONTH ? SEASON_START_YEAR : SEASON_START_YEAR + 1;
  return ymd(year, month, day);
}

const FRENCH_WEEKDAYS = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  dim: 0, lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6,
};

/**
 * Vérifie que le jour de semaine annoncé par la source correspond bien à la
 * date calculée. Indispensable ici : on force l'année depuis le mois, donc une
 * source qui renverrait la MAUVAISE saison passerait inaperçue (c'est
 * exactement ce qui arrive à LNH avec un seasons_id périmé).
 * Retourne true (concordant), false (incohérent) ou null (indéterminable).
 */
function checkWeekday(rawLabel, ymdStr) {
  if (!rawLabel || !ymdStr) return null;
  const m = rawLabel.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .match(/\b(dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi|dim|lun|mar|mer|jeu|ven|sam)\.?\s+\d{1,2}\b/);
  if (!m) return null;
  const expected = FRENCH_WEEKDAYS[m[1]];
  if (expected === undefined) return null;
  const [y, mo, d] = ymdStr.split('-').map(Number);
  return new Date(y, mo - 1, d).getDay() === expected;
}

/** Tous les jours "YYYY-MM-DD" entre start et end inclus. */
function expandDays(startYmd, endYmd) {
  if (!startYmd) return [];
  if (!endYmd || endYmd === startYmd) return [startYmd];
  const [sy, sm, sd] = startYmd.split('-').map(Number);
  const [ey, em, ed] = endYmd.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  if (end < start) return [startYmd];
  // Garde-fou : une "journée" LNR ne s'étale jamais sur plus d'une semaine.
  const days = [];
  const cur = new Date(start);
  while (cur <= end && days.length < 8) {
    days.push(ymdFromDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function inWindow(d) {
  return d >= WINDOW_START && d <= WINDOW_END;
}

// ─── LNR (TOP14 / PRO_D2) ───────────────────────────────────────────────────

/**
 * Parse les match-lines d'une page LNR.
 * Le header `.calendar-results__fixture-date` est soit une date unique
 * ("samedi 05 septembre"), soit une PLAGE ("samedi 23 janvier – dimanche 24
 * janvier") quand la LNR n'a pas encore programmé la journée au jour près.
 * Retourne { days: string[], precision, homeTeam, awayTeam }.
 */
function parseLNRMatches($, competition) {
  const out = [];
  let currentDays = [];
  let currentPrecision = 'exact';

  $('.calendar-results__fixture-date, .match-line').each((_i, el) => {
    const tagEl = $(el);

    if (tagEl.hasClass('calendar-results__fixture-date')) {
      const raw = tagEl.text().replace(/\s+/g, ' ').trim();
      // Séparateur de plage : en-dash, em-dash ou tiret entouré d'espaces
      const parts = raw.split(/\s[–—-]\s/).map((s) => s.trim()).filter(Boolean);
      const startD = parseSeasonDayMonth(parts[0] || '');
      const endD = parts.length > 1 ? parseSeasonDayMonth(parts[1]) : startD;
      currentDays = expandDays(startD, endD);
      currentPrecision = currentDays.length > 1 ? 'range' : 'exact';
      if (!startD) log(`  [WARN] ${competition}: header de date non parsé : "${raw}"`);
      // Garde-fou saison (l'année est déduite du mois, pas publiée par la LNR)
      if (checkWeekday(parts[0] || '', startD) === false) {
        log(`  [WARN] ${competition}: jour de semaine incohérent pour "${raw}" → ${startD}`);
      }
      return;
    }

    const homeClub = tagEl.find('.club-line--reversed');
    const awayClub = tagEl.find('.club-line').not('.club-line--reversed').first();
    const homeTeam = homeClub.find('.club-line__name').first().text().trim();
    const awayTeam = awayClub.find('.club-line__name').first().text().trim();
    if (!homeTeam || !awayTeam) return;
    if (currentDays.length === 0) return;

    out.push({
      competition,
      homeTeam,
      awayTeam,
      days: currentDays.slice(),
      precision: currentPrecision,
    });
  });

  return out;
}

/**
 * Scrape TOUTE la saison LNR : la page de base ne montre qu'une journée, il
 * faut paginer sur tous les slugs de `:filter-list` pour la saison courante.
 */
async function scrapeLNRSeason(url, competition) {
  const client = createClient();
  const resp = await client.get(url);
  const $ = cheerio.load(resp.data);

  const ff = $('filters-fixtures');
  const currentSeasonRaw = ff.attr(':current-season');
  const filterListRaw = ff.attr(':filter-list');
  if (!currentSeasonRaw || !filterListRaw) {
    throw new Error('attributs :current-season / :filter-list introuvables sur <filters-fixtures>');
  }

  const currentSeason = JSON.parse(currentSeasonRaw);
  const filterList = JSON.parse(filterListRaw);
  const seasonWeeks = (filterList.weeks && filterList.weeks[String(currentSeason.id)]) || [];
  if (seasonWeeks.length === 0) {
    throw new Error(`aucune journée pour la saison ${currentSeason.id} (${currentSeason.name})`);
  }

  const slugs = seasonWeeks
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((w) => w.slug);

  log(`  ${competition}: saison ${currentSeason.name} (id ${currentSeason.id}) — ${slugs.length} journées : ${slugs.join(', ')}`);

  const all = [];
  for (const slug of slugs) {
    const roundUrl = `${url}/${currentSeason.name}/${slug}`;
    try {
      const roundResp = await client.get(roundUrl);
      const $round = cheerio.load(roundResp.data);
      const roundMatches = parseLNRMatches($round, competition);
      all.push(...roundMatches);
      const est = roundMatches.filter((m) => m.precision === 'range').length;
      log(`    ${competition} ${slug}: ${roundMatches.length} matchs${est ? ` (${est} sur plage de dates)` : ''}`);
    } catch (err) {
      log(`    [ERREUR] ${competition} ${slug}: ${err.message}`);
    }
    await sleep(POLITE_DELAY_MS);
  }

  return all;
}

// ─── LNH (Starligue) ────────────────────────────────────────────────────────

/**
 * ATTENTION — le scraper de prod code en dur seasons_id=39 / key=608423208.
 * Ces valeurs sont PÉRIMÉES : seasons_id 39 = saison 2025/2026. La saison
 * 2026/2027 porte seasons_id=40 et la clé du formulaire a changé
 * (594259290), la compétition ayant en outre été rebaptisée
 * "Daikin StarLigue" (ex "Liqui Moly StarLigue").
 *
 * On découvre donc les paramètres dynamiquement depuis le formulaire de la page
 * calendrier (input[name=key], input[name=univers], select[name=seasons_id]
 * option[selected]) plutôt que de les figer.
 */
async function scrapeLNHSeason() {
  const client = createClient();
  const LNH_BASE = 'https://www.lnh.fr';
  const CALENDAR_URL = `${LNH_BASE}/daikin-starligue/calendrier`;

  const page = await client.get(CALENDAR_URL);
  const $page = cheerio.load(page.data);
  const form = $page('select[name=seasons_id]').closest('form');
  if (form.length === 0) throw new Error('formulaire calendrier LNH introuvable');

  const key = form.find('input[name=key]').attr('value');
  const univers = form.find('input[name=univers]').attr('value');
  const seasonOpt = $page('select[name=seasons_id] option[selected]').first();
  const seasonsId = seasonOpt.attr('value');
  const seasonLabel = seasonOpt.text().trim();
  if (!key || !univers || !seasonsId) {
    throw new Error(`paramètres LNH introuvables (key=${key}, univers=${univers}, seasons_id=${seasonsId})`);
  }
  log(`  LNH: seasons_id=${seasonsId} ("${seasonLabel}"), univers=${univers}, key=${key}`);

  const params = new URLSearchParams({
    seasons_id: seasonsId,
    days_id: 'all',
    teams_id: 'all',
    univers,
    key,
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
      Referer: CALENDAR_URL,
    },
  });

  const $ = cheerio.load(resp.data);
  const out = [];
  let unparsed = 0;
  let weekdayMismatch = 0;
  let provisional = 0;

  $('.calendars-listing-item').each((_i, el) => {
    const block = $(el);
    const colComp = block.find('.col-competitions');
    const rawDatetime = (colComp.html() || '')
      .replace(/<[^>]+>/g, '\n')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' ');

    const m = rawDatetime.match(/[a-zéè]{2,8}\.?\s+(\d{1,2})\s+([a-zà-ÿ]+)\.?\s+(\d{1,2}h\d{2})/i);
    const cleanDate = m ? `${m[1]} ${m[2]}` : rawDatetime;
    const day = parseSeasonDayMonth(cleanDate);

    const teamLogos = block.find('.team-logo');
    const homeTeam = teamLogos.eq(0).find('.team-name').text().trim();
    const awayTeam = teamLogos.eq(1).find('.team-name').text().trim();
    if (!homeTeam || !awayTeam) return;

    if (!day) {
      unparsed++;
      log(`  [WARN] LNH: date non parsée : "${rawDatetime}"`);
      return;
    }

    // Garde-fou saison : le jour de semaine annoncé doit coller à la date déduite
    if (checkWeekday(rawDatetime, day) === false) weekdayMismatch++;

    // La LNH suffixe "(provisoire)" les journées pas encore figées
    const isProvisional = /\(provisoire\)/i.test(rawDatetime);
    if (isProvisional) provisional++;

    out.push({
      competition: 'LNH',
      homeTeam,
      awayTeam,
      days: [day],
      precision: isProvisional ? 'provisional' : 'exact',
    });
  });

  if (out.length === 0) {
    throw new Error(
      `0 match retourné pour seasons_id=${seasonsId} — paramètres invalides. ` +
        `Inspecter ${CALENDAR_URL} (DevTools > Network > ajaxpost1).`
    );
  }
  if (unparsed > 0) log(`  [WARN] LNH: ${unparsed} matchs à date illisible (ignorés)`);
  if (weekdayMismatch > 0) {
    throw new Error(
      `${weekdayMismatch}/${out.length} matchs ont un jour de semaine incohérent avec la saison ` +
        `${SEASON_START_YEAR}-${SEASON_START_YEAR + 1} → l'endpoint renvoie probablement une autre saison ` +
        `(seasons_id=${seasonsId} / "${seasonLabel}").`
    );
  }
  log(`  LNH: ${out.length} matchs (dont ${provisional} provisoires), jours de semaine cohérents avec la saison`);
  return out;
}

// ─── EPCR (Champions Cup / Challenge Cup) ───────────────────────────────────

const FRENCH_EPCR_CLUBS = [
  'Toulouse', 'Stade Toulousain',
  'La Rochelle', 'Stade Rochelais',
  'Bordeaux',
  'Toulon', 'RC Toulon',
  'Clermont', 'Clermont Auvergne', 'ASM Clermont',
  'Bayonne', 'Aviron Bayonnais',
  'Castres', 'Castres Olympique',
  'Pau', 'Section Paloise',
  'Racing', 'Stade Français', 'Lyon', 'LOU Rugby',
  'Montpellier', 'Perpignan', 'USAP',
];

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function isFrenchClub(name) {
  const n = normalize(name);
  return FRENCH_EPCR_CLUBS.some((c) => n.includes(normalize(c)) || normalize(c).includes(n));
}

async function scrapeEPCRSeason(url, competition) {
  const client = createClient();
  const resp = await client.get(url);
  const $ = cheerio.load(resp.data);

  let arr = null;
  $('script').each((_, el) => {
    const content = $(el).html() || '';
    if (content.startsWith('[') && content.includes('ShallowReactive')) {
      try { arr = JSON.parse(content); } catch { /* skip */ }
    }
  });
  if (!arr) throw new Error('payload Nuxt SSR (ShallowReactive) introuvable dans la page');

  const matchIndices = arr[5];
  if (!Array.isArray(matchIndices)) throw new Error('arr[5] n\'est pas un tableau d\'indices de matchs');

  const val = (v) => (typeof v === 'number' && v >= 0 && v < arr.length ? arr[v] : v);

  const out = [];
  let total = 0;
  for (const idx of matchIndices) {
    const m = arr[idx];
    if (!m) continue;
    const dateStr = val(m.date);
    if (typeof dateStr !== 'string' || !dateStr) continue;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) continue;

    const home = val(m.homeTeam);
    const away = val(m.awayTeam);
    const homeTeam = val(home && home.name);
    const awayTeam = val(away && away.name);
    if (typeof homeTeam !== 'string' || typeof awayTeam !== 'string') continue;
    if (!homeTeam || !awayTeam) continue;
    total++;

    // Filtre club français conservé (le support ne couvre que les matchs à domicile FR)
    if (!isFrenchClub(homeTeam)) continue;

    out.push({
      competition,
      homeTeam,
      awayTeam,
      days: [ymdFromDate(d)],
      precision: 'exact',
    });
  }
  log(`  ${competition}: ${total} matchs dans le payload → ${out.length} avec club français à domicile`);
  return out;
}

// ─── LIGUE1 — AS Monaco (matchs à domicile) ─────────────────────────────────

function parseFrenchDatetimeToYmd(raw) {
  if (!raw) return '';
  const numericMatch = raw.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1], 10);
    const month = parseInt(numericMatch[2], 10) - 1;
    let year = parseInt(numericMatch[3], 10);
    if (year < 100) year += 2000;
    return ymd(year, month, day);
  }
  const frenchMatch = raw.toLowerCase().match(/(\d{1,2})\s+([a-zà-ÿ]+)\.?\s+(\d{4})/);
  if (frenchMatch) {
    const day = parseInt(frenchMatch[1], 10);
    const year = parseInt(frenchMatch[3], 10);
    const month = resolveMonth(frenchMatch[2].replace('.', ''));
    if (month !== undefined) return ymd(year, month, day);
  }
  return '';
}

/**
 * ATTENTION — le DOM asmonaco.com a changé par rapport à ce que suppose
 * scrapeMonacoLigue1() en prod : il n'y a PLUS de lien
 * `a[href*="/pros/calendrier/"]` par match, donc le scraper de prod extrait un
 * `awayTeam` vide et jette TOUS les matchs (LIGUE1 = 0 match).
 *
 * Structure actuelle (vérifiée) :
 *   div[data-component="MatchPresentationCard"]
 *     data-competition="L1"                  → Ligue 1 (absent pour amicaux/UCL)
 *     time[datetime="2026-09-19 20:00:00.000+02:00"]
 *     p                                      → "Ligue 1 … - Journée 5<br>Stade Louis-II"
 *     span.matchPresCardMetaWarn             → "Date et horaire non définitifs"
 *     span.matchPresCardTeamName × 2         → "AS MONACO", "RC LENS"
 *
 * NB : l'attribut `data-away` vaut "true" sur les matchs à Louis-II (sémantique
 * inversée/trompeuse) → on garde le test sur le stade, comme la prod.
 */
async function scrapeMonacoSeason() {
  const client = createClient();
  const resp = await client.get('https://www.asmonaco.com/fr/pros/calendrier', {
    headers: { 'Accept-Language': 'fr-FR,fr;q=0.9', Referer: 'https://www.asmonaco.com/' },
  });
  const $ = cheerio.load(resp.data);

  // Diagnostic : combien de mois sont rendus côté serveur ?
  const groups = [];
  $('[id^="group-"]').each((_, el) => groups.push($(el).attr('id')));
  log(`  LIGUE1: ${groups.length} conteneurs mensuels SSR : ${groups.join(', ') || '(aucun)'}`);

  const cards = $('[data-component="MatchPresentationCard"]');
  log(`  LIGUE1: ${cards.length} cartes de match au total`);

  const out = [];
  const seen = new Set();
  let provisional = 0;

  cards.each((_, el) => {
    const card = $(el);
    if (card.attr('data-competition') !== 'L1') return; // Ligue 1 uniquement

    const text = card.text().replace(/\s+/g, ' ').trim();
    if (!text.includes('Louis')) return; // domicile (Stade Louis-II)

    // Date fiable : attribut datetime ISO local ("2026-09-19 20:00:00.000+02:00")
    const dtAttr = card.find('time').first().attr('datetime') || '';
    let day = ymdFromIsoLiteral(dtAttr);
    if (!day) day = parseFrenchDatetimeToYmd(text); // repli sur le texte français
    if (!day) return;

    const names = card.find('.matchPresCardTeamName');
    const homeTeam = names.eq(0).text().trim() || 'AS MONACO';
    const awayTeam = names.eq(1).text().trim();
    if (!awayTeam) return;

    // "Date et horaire non définitifs" → jour encore susceptible de bouger
    const isProvisional = card.find('.matchPresCardMetaWarn').text().toLowerCase().includes('non défin');
    if (isProvisional) provisional++;

    const key = `${day}|${awayTeam}`;
    if (seen.has(key)) return;
    seen.add(key);

    out.push({
      competition: 'LIGUE1',
      homeTeam,
      awayTeam,
      days: [day],
      precision: isProvisional ? 'provisional' : 'exact',
    });
  });

  log(`  LIGUE1: ${out.length} matchs à domicile en Ligue 1 (dont ${provisional} à date non définitive)`);
  return out;
}

// ─── ELMS ───────────────────────────────────────────────────────────────────

/** Jour local de l'événement, lu littéralement dans l'ISO (offset explicite). */
function ymdFromIsoLiteral(iso) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function extractQualifyingClass(sessionName) {
  let m = sessionName.match(/^Qualifying session\s+(.+)$/i);
  if (m) return m[1].trim();
  m = sessionName.match(/^Qualifying\s+-\s+([^-]+)/i);
  if (m) return m[1].trim();
  return 'Qualifying';
}

async function scrapeELMSSeason() {
  const client = createClient();
  const seasonUrl = 'https://www.europeanlemansseries.com/en/season/2026';

  const seasonResp = await client.get(seasonUrl);
  const $season = cheerio.load(seasonResp.data);
  const slugSet = new Set();
  $season('a[href*="/en/race/"]').each((_i, el) => {
    const href = $season(el).attr('href') || '';
    const m = href.match(/\/en\/race\/([^/]+)/);
    // Certains href ont un espace de fin → trim, sinon on requête 2× chaque course
    if (m) slugSet.add(m[1].trim());
  });
  const slugs = Array.from(slugSet).filter((s) => s && !s.includes('official-test'));
  log(`  ELMS: ${slugs.length} slugs de course : ${slugs.join(', ')}`);
  if (slugs.length === 0) throw new Error('aucun slug de course trouvé sur la page saison 2026');

  const out = [];
  for (const slug of slugs) {
    try {
      const raceResp = await client.get(`https://www.europeanlemansseries.com/en/race/${slug}`);
      const $race = cheerio.load(raceResp.data);

      let jsonLd = null;
      $race('script[type="application/ld+json"]').each((_i, el) => {
        try {
          const parsed = JSON.parse($race(el).html() || '{}');
          if (parsed['@type'] === 'SportsEvent' && parsed.subEvent) jsonLd = parsed;
        } catch { /* ignore */ }
      });
      if (!jsonLd) { log(`    [WARN] ELMS ${slug}: pas de JSON-LD SportsEvent`); await sleep(POLITE_DELAY_MS); continue; }

      const eventName = jsonLd.name || slug;
      const subEvents = jsonLd.subEvent || [];

      const raceSessions = subEvents.filter(
        (se) => se.name === 'Race' || se.name.toLowerCase().startsWith('race -') || se.name.toLowerCase().startsWith('race–')
      );
      const qualSessions = subEvents.filter((se) => /^qualifying/i.test(se.name));

      for (const s of raceSessions) {
        out.push({ competition: 'ELMS', homeTeam: eventName, awayTeam: 'Race', days: [ymdFromIsoLiteral(s.startDate)], precision: 'exact' });
      }
      for (const s of qualSessions) {
        out.push({ competition: 'ELMS', homeTeam: eventName, awayTeam: `Qualif. ${extractQualifyingClass(s.name)}`, days: [ymdFromIsoLiteral(s.startDate)], precision: 'exact' });
      }
      log(`    ELMS ${slug}: ${raceSessions.length} course(s) + ${qualSessions.length} qualif(s)`);
    } catch (err) {
      log(`    [ERREUR] ELMS ${slug}: ${err.message}`);
    }
    await sleep(POLITE_DELAY_MS);
  }
  return out.filter((m) => m.days[0]);
}

// ─── ESTONIE (Premium Liiga, iCal jalgpall.ee) ──────────────────────────────

async function scrapeEstonieSeason() {
  const url = 'https://jalgpall.ee/voistlused/download.php?type=calendar.download&action=download&league_id=52';
  const client = createClient();
  const resp = await client.get(url, { responseType: 'arraybuffer' });
  const ical = Buffer.from(resp.data).toString('utf-8');

  const blocks = ical.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
  log(`  ESTONIE: ${blocks.length} VEVENT dans le flux`);
  const out = [];

  for (const block of blocks) {
    const summaryMatch = block.match(/SUMMARY:(.+)/);
    if (!summaryMatch) continue;
    const teams = summaryMatch[1].trim().split(' vs ');
    if (teams.length < 2) continue;

    const dt = block.match(/DTSTART[^:]*:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
    if (!dt) continue;
    const year = +dt[1], month = +dt[2], day = +dt[3];

    // Le jour local Tallinn est directement celui du flux (pas de conversion :
    // on veut la date de l'événement, pas un instant UTC).
    out.push({
      competition: 'ESTONIE',
      homeTeam: teams[0].trim(),
      awayTeam: teams[1].trim(),
      days: [ymd(year, month - 1, day)],
      precision: 'exact',
    });
  }
  return out;
}

// ─── FIS (flux iCal data.fis-ski.com) ───────────────────────────────────────

function getFisSeasonCode(ref = new Date()) {
  const year = ref.getFullYear();
  return String(ref.getMonth() >= 6 ? year + 1 : year);
}

async function scrapeFisIcalFeed({ url, competition }) {
  const client = createClient();
  const resp = await client.get(url, { responseType: 'arraybuffer' });
  const ical = Buffer.from(resp.data).toString('utf-8');

  const blocks = ical.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
  log(`  ${competition}: ${blocks.length} VEVENT dans le flux`);
  if (blocks.length === 0) {
    throw new Error(`flux iCal vide (0 VEVENT) — vérifier seasoncode/disciplinecode : ${url}`);
  }

  const out = [];
  for (const block of blocks) {
    const dt = block.match(/DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})/);
    if (!dt) continue;
    const day = ymd(+dt[1], +dt[2] - 1, +dt[3]);

    const summaryMatch = block.match(/SUMMARY:(.+)/);
    if (!summaryMatch) continue;
    const venueMatch = summaryMatch[1].trim().match(/^(.*?)\s*\(([A-Z]{3})\)/);
    if (!venueMatch) continue;
    const city = venueMatch[1].trim();

    const descMatch = block.match(/DESCRIPTION:(.+)/);
    const description = descMatch ? descMatch[1] : '';
    const eventMatch = description.match(/Event:\s*([^\\]*)/);
    const eventLabel = eventMatch ? eventMatch[1].trim() : '';
    const isQualification = /CATEGORIES:[^\r\n]*QUA/.test(block);

    out.push({
      competition,
      homeTeam: city,
      awayTeam: `${eventLabel || 'Épreuve'} — ${isQualification ? 'Qualification' : 'Finale'}`,
      days: [day],
      precision: 'exact',
    });
  }
  return out;
}

const FIS_BASE = 'https://data.fis-ski.com/services/public/icalendar-feed-fis-events.html';

async function scrapeSkiCrossSeason() {
  const seasonCode = getFisSeasonCode();
  log(`  SKI_CROSS: seasoncode=${seasonCode}`);
  return scrapeFisIcalFeed({
    url: `${FIS_BASE}?seasoncode=${seasonCode}&sectorcode=FS&categorycode=WC&disciplinecode=SX,SXT`,
    competition: 'SKI_CROSS',
  });
}

async function scrapeSnowboardSeason() {
  const seasonCode = getFisSeasonCode();
  log(`  SNOWBOARD: seasoncode=${seasonCode}`);
  return scrapeFisIcalFeed({
    url: `${FIS_BASE}?seasoncode=${seasonCode}&sectorcode=SB&categorycode=WC&disciplinecode=SBX,BXT,PGS,PSL,GS,PRT`,
    competition: 'SNOWBOARD',
  });
}

async function scrapeFreestyleECSeason() {
  const seasonCode = getFisSeasonCode();
  log(`  FREESTYLE_EC: seasoncode=${seasonCode}`);
  return scrapeFisIcalFeed({
    url: `${FIS_BASE}?seasoncode=${seasonCode}&sectorcode=FS&categorycode=EC&disciplinecode=MO,AE`,
    competition: 'FREESTYLE_EC',
  });
}

// ─── Orchestration ──────────────────────────────────────────────────────────

const SOURCES = [
  { key: 'TOP14', fetch: () => scrapeLNRSeason('https://top14.lnr.fr/calendrier-et-resultats', 'TOP14') },
  { key: 'PRO_D2', fetch: () => scrapeLNRSeason('https://prod2.lnr.fr/calendrier-et-resultats', 'PRO_D2') },
  { key: 'LNH', fetch: scrapeLNHSeason },
  { key: 'EPCR', fetch: () => scrapeEPCRSeason('https://www.epcrugby.com/fr/champions-cup/matchs', 'EPCR') },
  { key: 'EPCR_CHALLENGE', fetch: () => scrapeEPCRSeason('https://www.epcrugby.com/fr/challenge-cup/matchs', 'EPCR_CHALLENGE') },
  { key: 'LIGUE1', fetch: scrapeMonacoSeason },
  { key: 'ELMS', fetch: scrapeELMSSeason },
  { key: 'ESTONIE', fetch: scrapeEstonieSeason },
  { key: 'SKI_CROSS', fetch: scrapeSkiCrossSeason },
  { key: 'SNOWBOARD', fetch: scrapeSnowboardSeason },
  { key: 'FREESTYLE_EC', fetch: scrapeFreestyleECSeason },
];

(async () => {
  log(`=== Scraping saison ${WINDOW_START} → ${WINDOW_END} ===\n`);

  const results = await Promise.allSettled(
    SOURCES.map(async (s) => {
      log(`--- ${s.key} ---`);
      const data = await s.fetch();
      return data;
    })
  );

  /**
   * Fiabilité décroissante. Quand deux matchs tombent le même jour pour la même
   * compétition, l'entrée agrégée retient la MEILLEURE précision disponible :
   * un jour où un match est confirmé est un jour confirmé, même si un autre
   * match de la même journée reste annoncé sur une plage.
   */
  const PRECISION_RANK = { exact: 0, provisional: 1, range: 2 };
  const rank = (p) => (PRECISION_RANK[p] === undefined ? 2 : PRECISION_RANK[p]);

  const summary = [];
  const entries = new Map(); // "day|competition" → { date, competition, precision }

  for (let i = 0; i < results.length; i++) {
    const key = SOURCES[i].key;
    const result = results[i];

    if (result.status === 'rejected') {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      summary.push({ competition: key, status: 'ECHEC', raw: 0, days: 0, reason });
      continue;
    }

    const matches = result.value;
    const daySet = new Set();

    for (const m of matches) {
      const precision = m.precision || 'exact';
      for (const d of m.days) {
        if (!inWindow(d)) continue;
        daySet.add(d);
        const mapKey = `${d}|${key}`;
        const existing = entries.get(mapKey);
        if (!existing) {
          entries.set(mapKey, { date: d, competition: key, precision });
        } else if (rank(precision) < rank(existing.precision)) {
          existing.precision = precision;
        }
      }
    }

    // Répartition par précision, après arbitrage des doublons
    const byPrecision = { exact: 0, range: 0, provisional: 0 };
    for (const d of daySet) {
      const e = entries.get(`${d}|${key}`);
      if (e) byPrecision[e.precision] = (byPrecision[e.precision] || 0) + 1;
    }

    summary.push({
      competition: key,
      status: 'OK',
      raw: matches.length,
      days: daySet.size,
      byPrecision,
      reason: null,
    });
  }

  const output = [...entries.values()].sort(
    (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.competition.localeCompare(b.competition))
  );

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  const allDays = new Set(output.map((e) => e.date));

  log('\n=== RESUME ===');
  log(`Fenetre : ${WINDOW_START} -> ${WINDOW_END}`);
  log(`Fichier : ${OUTPUT_PATH}`);
  log(`Entrees (date, competition) distinctes : ${output.length}`);
  log(`Jours mobilises (toutes competitions confondues) : ${allDays.size}`);
  log('');
  for (const s of summary) {
    if (s.status === 'OK') {
      const nuance = [];
      if (s.byPrecision.range) nuance.push(`${s.byPrecision.range} sur plage`);
      if (s.byPrecision.provisional) nuance.push(`${s.byPrecision.provisional} provisoires`);
      log(
        `  ${s.competition.padEnd(16)} OK     bruts=${String(s.raw).padStart(4)}  jours distincts=${String(s.days).padStart(3)}` +
          (nuance.length ? `  (dont ${nuance.join(', ')})` : '')
      );
    } else {
      log(`  ${s.competition.padEnd(16)} ECHEC  ${s.reason}`);
    }
  }
})().catch((err) => {
  console.error('ERREUR BLOQUANTE :', err);
  process.exit(1);
});
