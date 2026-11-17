import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Vue « projection » de la saison : indépendante de la vue hebdomadaire (SportsMatchesWidget).

type Precision = 'e' | 'r' | 'p';
type SeasonDay = [string, string, Precision, string?];
interface SeasonCalendar { generatedAt: string; windowStart: string; windowEnd: string; days: SeasonDay[] }

type Family = 'rugby' | 'hand' | 'foot' | 'endur' | 'winter' | 'wrestling' | 'athletics';

const FAMILY_COLOR: Record<Family, string> = {
  rugby: '#185FA5', hand: '#0E8A7C', foot: '#4C8A3B', endur: '#C06A1E',
  winter: '#6A4FB0', wrestling: '#C23B5A', athletics: '#A3790A',
};
const FAMILY_LABEL: Record<Family, string> = {
  rugby: 'Rugby', hand: 'Handball', foot: 'Football', endur: 'Endurance auto',
  winter: 'FIS Hiver', wrestling: 'Beach Wrestling', athletics: 'Athlétisme',
};

const COMP: Record<string, { family: Family; label: string; short: string }> = {
  TOP14: { family: 'rugby', label: 'Top 14', short: 'TOP 14' },
  PRO_D2: { family: 'rugby', label: 'Pro D2', short: 'Pro D2' },
  EPCR: { family: 'rugby', label: 'Champions Cup', short: 'Champions Cup' },
  EPCR_CHALLENGE: { family: 'rugby', label: 'Challenge Cup', short: 'Challenge Cup' },
  SUPER7: { family: 'rugby', label: 'SuperSevens (Rugby à 7)', short: 'SuperSevens' },
  LNH: { family: 'hand', label: 'Daikin Starligue', short: 'LNH' },
  TROPHEE_CHAMPIONS_LNH: { family: 'hand', label: 'Trophée des Champions (Hand)', short: 'Trophée LNH' },
  LIGUE1: { family: 'foot', label: 'Ligue 1 (Monaco)', short: 'Ligue 1' },
  CONFERENCE_LEAGUE: { family: 'foot', label: 'UEFA Conference League', short: 'Conf. League' },
  ESTONIE: { family: 'foot', label: 'Premium Liiga (Estonie)', short: 'Estonie' },
  ELMS: { family: 'endur', label: 'ELMS', short: 'ELMS' },
  ALMS: { family: 'endur', label: 'ALMS', short: 'ALMS' },
  SKI_CROSS: { family: 'winter', label: 'Ski Cross', short: 'Ski Cross' },
  SNOWBOARD: { family: 'winter', label: 'Snowboard', short: 'Snowboard' },
  FREESTYLE_EC: { family: 'winter', label: "Freestyle (Coupe d'Europe)", short: 'Freestyle' },
  BEACH_WRESTLING: { family: 'wrestling', label: 'Beach Wrestling', short: 'Beach Wr.' },
  DIAMOND_LEAGUE: { family: 'athletics', label: 'Diamond League (Zürich)', short: 'Diamond L.' },
};
const compInfo = (code: string) => COMP[code] ?? { family: 'rugby' as Family, label: code, short: code };

const PRECISION_LABEL: Record<Precision, string> = { e: 'confirmée', r: 'probable', p: 'provisoire' };
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthIdx = (dateStr: string) => Number(dateStr.slice(0, 4)) * 12 + (Number(dateStr.slice(5, 7)) - 1);

interface DayEvent { code: string; precision: Precision; place?: string }

export function SeasonCalendarWidget() {
  const { t } = useTranslation('dashboard');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sports-season-calendar'],
    queryFn: async () => (await api.get('/sports/season-calendar')).data.data as SeasonCalendar,
    staleTime: 1000 * 60 * 60,
  });

  const [hiddenFamilies, setHiddenFamilies] = useState<Set<Family>>(new Set());
  const [monthOverride, setMonthOverride] = useState<number | null>(null);
  const [selected, setSelected] = useState<string>(() => ymd(new Date()));

  const byDate = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    for (const [date, code, precision, place] of data?.days ?? []) {
      if (hiddenFamilies.has(compInfo(code).family)) continue;
      const list = map.get(date) ?? [];
      list.push({ code, precision, place });
      map.set(date, list);
    }
    return map;
  }, [data, hiddenFamilies]);

  const todayKey = ymd(new Date());
  const minM = monthIdx(data?.windowStart ?? todayKey);
  const maxM = monthIdx(data?.windowEnd ?? todayKey);
  const defaultM = Math.min(Math.max(monthIdx(todayKey), minM), maxM);
  const curM = monthOverride ?? defaultM;

  const maxDayCount = useMemo(
    () => Math.max(1, ...Array.from(byDate.values(), (v) => v.length)),
    [byDate],
  );

  const year = Math.floor(curM / 12);
  const month = curM % 12;

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const end = new Date(last);
    end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));
    const out: Date[] = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) out.push(new Date(d));
    return out;
  }, [year, month]);

  const stats = useMemo(() => {
    const comps = new Set<string>();
    let peak = 0;
    for (const evs of byDate.values()) {
      evs.forEach((e) => comps.add(e.code));
      peak = Math.max(peak, evs.length);
    }
    return { activeDays: byDate.size, comps: comps.size, peak };
  }, [byDate]);

  const toggleFamily = (f: Family) =>
    setHiddenFamilies((s) => {
      const next = new Set(s);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  const selectedEvents = byDate.get(selected) ?? [];
  const selDate = new Date(selected + 'T00:00:00');
  const selLabel = `${DAYS[(selDate.getDay() + 6) % 7]} ${selDate.getDate()} ${MONTHS[selDate.getMonth()]} ${selDate.getFullYear()}`;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarRange size={16} className="text-primary" />
            {t('season.title')}
          </CardTitle>
          {data && (
            <span className="text-xs text-muted-foreground">
              {t('season.stats', { days: stats.activeDays, comps: stats.comps, peak: stats.peak })}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t('season.subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Skeleton className="h-72 w-full" />}
        {isError && <p className="text-sm text-destructive">{t('season.error')}</p>}
        {data && (
          <>
            {/* Légende / filtres par famille */}
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {(Object.keys(FAMILY_COLOR) as Family[]).map((f) => {
                const hidden = hiddenFamilies.has(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFamily(f)}
                    aria-pressed={!hidden}
                    className={`inline-flex items-center gap-1.5 text-xs transition-opacity ${hidden ? 'opacity-40 line-through' : ''}`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FAMILY_COLOR[f] }} />
                    {FAMILY_LABEL[f]}
                  </button>
                );
              })}
            </div>

            {/* Navigation mois / année */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMonthOverride(curM - 1)}
                disabled={curM <= minM}
                aria-label={t('season.prev')}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-2">
                <select
                  value={curM}
                  onChange={(e) => setMonthOverride(Number(e.target.value))}
                  aria-label={t('season.jump')}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm font-semibold uppercase tracking-wide"
                >
                  {Array.from({ length: maxM - minM + 1 }, (_, i) => minM + i).map((m) => (
                    <option key={m} value={m}>{MONTHS[m % 12]} {Math.floor(m / 12)}</option>
                  ))}
                </select>
                {curM !== defaultM && (
                  <button
                    type="button"
                    onClick={() => setMonthOverride(null)}
                    className="text-xs text-primary hover:underline"
                  >
                    {t('season.today')}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMonthOverride(curM + 1)}
                disabled={curM >= maxM}
                aria-label={t('season.next')}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Grille */}
            <div>
              <div className="grid grid-cols-7 gap-1.5 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground text-center">
                {DAYS.map((d) => <span key={d}>{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((d) => {
                  const key = ymd(d);
                  const evs = byDate.get(key) ?? [];
                  const outside = d.getMonth() !== month;
                  const heat = Math.round((evs.length / maxDayCount) * 78);
                  const strong = heat >= 45;
                  const families = [...new Set(evs.map((e) => compInfo(e.code).family))];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelected(key)}
                      title={evs.length ? t('season.cellTitle', { count: evs.length }) : t('season.cellEmpty')}
                      className={`relative min-h-[52px] sm:min-h-[92px] rounded-md border p-1.5 text-left flex flex-col gap-1 overflow-hidden transition hover:brightness-95
                        ${outside ? 'opacity-35' : ''}
                        ${key === todayKey ? 'ring-2 ring-primary ring-inset' : ''}
                        ${key === selected ? 'outline outline-2 outline-foreground -outline-offset-2' : ''}
                        ${strong ? 'text-white' : ''}`}
                      style={{ backgroundColor: heat ? `color-mix(in srgb, #185FA5 ${heat}%, transparent)` : undefined }}
                    >
                      <span className="text-xs font-bold tabular-nums">{d.getDate()}</span>
                      <span className="hidden sm:flex flex-col gap-0.5 min-w-0">
                        {evs.map((e, i) => {
                          const c = compInfo(e.code);
                          return (
                            <span
                              key={i}
                              className={`flex items-center gap-1 text-[9.5px] font-extrabold uppercase leading-tight truncate ${e.precision !== 'e' ? 'opacity-75 underline decoration-dotted' : ''}`}
                            >
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-sm"
                                style={{ backgroundColor: FAMILY_COLOR[c.family], boxShadow: strong ? '0 0 0 1px rgba(255,255,255,.7)' : undefined }}
                              />
                              {c.short}
                            </span>
                          );
                        })}
                      </span>
                      <span className="flex sm:hidden flex-wrap gap-0.5">
                        {families.map((f) => (
                          <span key={f} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: FAMILY_COLOR[f] }} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Détail du jour */}
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-semibold mb-2">{selLabel}</p>
              {selectedEvents.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">{t('season.noEvent')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedEvents.map((e, i) => {
                    const c = compInfo(e.code);
                    return (
                      <span
                        key={i}
                        className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: `color-mix(in srgb, ${FAMILY_COLOR[c.family]} 16%, transparent)`, color: FAMILY_COLOR[c.family] }}
                      >
                        {c.label}{e.place ? ` — ${e.place}` : ''}
                        {e.precision !== 'e' && <em className="font-normal"> ({PRECISION_LABEL[e.precision]})</em>}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              {t('season.footer', { date: new Date(data.generatedAt).toLocaleDateString('fr-FR') })}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
