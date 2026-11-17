/**
 * Régénère server/src/data/seasonCalendar.ts (widget « Projection de la saison »)
 * à partir de docs/calendrier-charge-2026-2027-dates.json + événements ponctuels saisis à la main.
 *
 * Workflow d'actualisation :
 *   1. node docs/scrape-season-calendar.js      (met à jour le JSON depuis les sources officielles)
 *   2. node scripts/gen-season-calendar.js      (régénère le fichier TS servi par l'API)
 *
 * ⚠️ Une source qui ne publie plus que les matchs à venir (ou dont la saison est finie, ex. Estonie)
 *    renvoie 0 : vérifier le JSON avant de régénérer pour ne pas perdre les dates passées.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'docs', 'calendrier-charge-2026-2027-dates.json');
const OUT_PATH = path.join(ROOT, 'server', 'src', 'data', 'seasonCalendar.ts');

const PRECISION = { exact: 'e', range: 'r', provisional: 'p' };

// Événements ponctuels non couverts par le script de saison : [code, début, fin, lieu]
const MANUAL_EVENTS = [
  ['TROPHEE_CHAMPIONS_LNH', '2026-08-29', '2026-08-29', 'Trophée des Champions LNH'],
  ['SUPER7', '2026-08-21', '2026-08-22', 'Biarritz'],
  ['SUPER7', '2026-08-28', '2026-08-29', 'Pau'],
  ['BEACH_WRESTLING', '2026-08-28', '2026-08-29', 'Baku (Azerbaïdjan)'],
  ['BEACH_WRESTLING', '2026-09-26', '2026-09-27', 'Katerini (Grèce)'],
  ['DIAMOND_LEAGUE', '2026-08-26', '2026-08-27', 'Weltklasse Zürich'],
];

const scraped = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')).map((x) => [x.date, x.competition, PRECISION[x.precision] || 'r']);

const manual = [];
for (const [code, start, end, place] of MANUAL_EVENTS) {
  for (let d = new Date(start + 'T00:00:00Z'); d <= new Date(end + 'T00:00:00Z'); d = new Date(d.getTime() + 86400000)) {
    manual.push([d.toISOString().slice(0, 10), code, 'e', place]);
  }
}

const all = [...scraped, ...manual].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
const today = new Date().toISOString().slice(0, 10);

const ts = `/**
 * Calendrier de la saison 2026-2027 — instantané statique (vue « projection » du dashboard).
 * GÉNÉRÉ par scripts/gen-season-calendar.js à partir de docs/calendrier-charge-2026-2027-dates.json
 * (docs/scrape-season-calendar.js) + événements ponctuels saisis à la main. Ne pas éditer à la main.
 * Format : [date YYYY-MM-DD, code compétition, précision, lieu?]
 * précision : 'e' confirmée · 'r' probable (plage/week-end) · 'p' provisoire
 * Ne remplace PAS le scraper hebdomadaire (sportsScraper.ts).
 */
export type SeasonPrecision = 'e' | 'r' | 'p';
export type SeasonDay = [date: string, competition: string, precision: SeasonPrecision, place?: string];

export const SEASON_CALENDAR = {
  generatedAt: '${today}',
  windowStart: '2026-07-28',
  windowEnd: '2027-07-01',
  days: ${JSON.stringify(all).replace(/\],\[/g, '],\n    [')} as SeasonDay[],
};
`;
fs.writeFileSync(OUT_PATH, ts);
console.log(`${all.length} entrées (${scraped.length} scrapées + ${manual.length} manuelles) -> ${path.relative(ROOT, OUT_PATH)}`);
