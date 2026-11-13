'use client';

import { ChartArea, ChartColumnStacked, ChartLine, ChartSpline, Grid3x3, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSlidingIndicator } from '@/components/ui';
import { cn } from '@/lib/utils';
import { CHART_KINDS, cumulate, heatIntensity, isChartKind, maxValue, TOTAL_KEY, type ChartKind, type ChartRow, type SeriesDef } from './chart-logic';

export type { ChartKind, ChartRow, SeriesDef };

const ICONS: Record<ChartKind, LucideIcon> = {
  bar: ChartColumnStacked,
  line: ChartLine,
  heatmap: Grid3x3,
  area: ChartArea,
  cumulative: ChartSpline,
};

/**
 * Spec 011, R4 : type de graphique retenu pour chaque graphique sur cet appareil.
 * Stockage local facultatif : en navigation privée, on reste simplement sur « Barres ».
 */
export function useChartKind(storageId: string): [ChartKind, (kind: ChartKind) => void] {
  const key = `tabilo.chart.${storageId}`;
  const [kind, setKind] = useState<ChartKind>('bar');
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (isChartKind(saved)) setKind(saved);
    } catch {
      /* stockage indisponible */
    }
  }, [key]);
  const update = (next: ChartKind) => {
    setKind(next);
    try {
      window.localStorage.setItem(key, next);
    } catch {
      /* stockage indisponible */
    }
  };
  return [kind, update];
}

/** Spec 011, R2 : rangée d'icônes, le fond de l'icône active glisse (R5). */
export function ChartKindPicker({ value, onChange, label = 'Type de graphique' }: { value: ChartKind; onChange: (kind: ChartKind) => void; label?: string }) {
  const { container, register, indicator } = useSlidingIndicator(value);
  return (
    <div ref={container} role="radiogroup" aria-label={label} className="relative flex gap-0.5 rounded-lg bg-sunken p-1">
      {indicator}
      {CHART_KINDS.map((kind) => {
        const Icon = ICONS[kind.value];
        const active = kind.value === value;
        return (
          <button
            key={kind.value}
            ref={register(kind.value)}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={kind.label}
            title={kind.label}
            onClick={() => onChange(kind.value)}
            className={cn('relative grid size-7 place-items-center rounded-md transition-colors duration-300', active ? 'text-ink' : 'text-ink-3 hover:text-ink')}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

const AXIS_TICK = { fontSize: 12, fill: 'var(--color-ink-2)' };
const TOOLTIP = {
  contentStyle: { borderRadius: 10, border: '1px solid var(--color-line)', fontSize: 13, background: 'var(--color-surface)', boxShadow: '0 12px 40px -12px rgb(27 25 23 / 0.25)' },
  labelStyle: { color: 'var(--color-ink)', fontWeight: 600 },
  itemStyle: { color: 'var(--color-ink-2)' },
};
const MOTION = { isAnimationActive: true, animationDuration: 650, animationEasing: 'ease-out' as const };

interface SeriesChartProps {
  kind: ChartKind;
  rows: ChartRow[];
  series: SeriesDef[];
  /** Hauteur en px (graphique et carte thermique). */
  height?: number;
  /** Valeur affichée dans les info-bulles (montants, durées…). */
  format?: (value: number) => string;
  /** Graduations de l'axe vertical. */
  axisFormat?: (value: number) => string;
  ariaLabel: string;
}

/** Spec 011 : un même jeu de données, cinq façons de le lire. */
export function SeriesChart({ kind, rows, series, height = 256, format = String, axisFormat, ariaLabel }: SeriesChartProps) {
  const tooltipFormatter = (value: unknown) => format(Number(value));
  const yAxis = (
    <YAxis
      allowDecimals={false}
      tickLine={false}
      axisLine={false}
      tick={{ fontSize: 12, fill: 'var(--color-ink-3)' }}
      width={axisFormat ? 64 : 44}
      tickFormatter={axisFormat}
    />
  );
  const xAxis = <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} tick={AXIS_TICK} interval="preserveStartEnd" minTickGap={12} />;
  const grid = <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="2 4" />;
  const margin = { top: 8, right: 8, left: axisFormat ? 4 : -16, bottom: 0 };

  return (
    // La clé relance le fondu à chaque changement de type (R5).
    <div key={kind} className="animate-fade-in" role="img" aria-label={`${ariaLabel} (${CHART_KINDS.find((k) => k.value === kind)!.label.toLowerCase()})`}>
      {kind === 'heatmap' ? (
        <Heatmap rows={rows} series={series} format={format} height={height} />
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {kind === 'bar' ? (
              <BarChart data={rows} margin={margin} barCategoryGap="28%">
                {grid}
                {xAxis}
                {yAxis}
                <Tooltip cursor={{ fill: 'var(--color-sunken)' }} formatter={tooltipFormatter} {...TOOLTIP} />
                {series.map((s, index) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stackId="stack"
                    fill={s.color}
                    stroke="var(--color-surface)"
                    strokeWidth={1.5}
                    radius={index === series.length - 1 ? [4, 4, 0, 0] : undefined}
                    maxBarSize={36}
                    {...MOTION}
                  />
                ))}
              </BarChart>
            ) : kind === 'area' ? (
              <AreaChart data={rows} margin={margin}>
                {grid}
                {xAxis}
                {yAxis}
                <Tooltip formatter={tooltipFormatter} {...TOOLTIP} />
                {series.map((s) => (
                  <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stackId="stack" stroke={s.color} strokeWidth={2} fill={s.color} fillOpacity={0.28} {...MOTION} />
                ))}
              </AreaChart>
            ) : kind === 'cumulative' ? (
              <LineChart data={cumulate(rows, series)} margin={margin}>
                {grid}
                {xAxis}
                {yAxis}
                <Tooltip formatter={tooltipFormatter} {...TOOLTIP} />
                {series.length > 1 &&
                  series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={`${s.label} (cumul)`} stroke={s.color} strokeWidth={1.75} dot={false} {...MOTION} />)}
                <Line type="monotone" dataKey={TOTAL_KEY} name="Total cumulé" stroke="var(--color-ink)" strokeWidth={2.75} dot={false} {...MOTION} />
              </LineChart>
            ) : (
              <LineChart data={rows} margin={margin}>
                {grid}
                {xAxis}
                {yAxis}
                <Tooltip formatter={tooltipFormatter} {...TOOLTIP} />
                {series.map((s) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.25} dot={{ r: 2.5, strokeWidth: 0, fill: s.color }} activeDot={{ r: 5 }} {...MOTION} />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {kind === 'cumulative' && (
        <p className="mt-2 flex items-center gap-2 text-[12px] text-ink-3">
          <span className="h-[3px] w-5 rounded-full bg-ink" aria-hidden />
          Total cumulé{series.length > 1 ? ' · les traits fins : cumul de chaque série' : ''}
        </p>
      )}
    </div>
  );
}

/** Carte thermique : une ligne par série, une case par période ; plus la case est foncée, plus la valeur est forte. */
function Heatmap({ rows, series, format, height }: { rows: ChartRow[]; series: SeriesDef[]; format: (value: number) => string; height: number }) {
  const max = maxValue(rows, series);
  const step = Math.max(1, Math.ceil(rows.length / 12)); // une étiquette sur `step` pour rester lisible
  return (
    <div className="overflow-x-auto" style={{ minHeight: Math.min(height, 72 + series.length * 40) }}>
      <div className="grid min-w-[480px] gap-1" style={{ gridTemplateColumns: `7rem repeat(${rows.length}, minmax(0, 1fr))` }}>
        {series.map((s) => (
          <div key={s.key} className="contents">
            <span className="flex items-center gap-1.5 truncate pr-2 text-[12px] text-ink-2">
              <span className="size-2 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
              <span className="truncate">{s.label}</span>
            </span>
            {rows.map((row, index) => {
              const value = Number(row[s.key] ?? 0);
              const intensity = heatIntensity(value, max);
              return (
                <span
                  key={row.label}
                  title={`${row.label} · ${s.label} : ${format(value)}`}
                  className="stagger aspect-square min-h-6 animate-pop-in rounded-[5px] ring-1 ring-line/60 ring-inset transition-transform duration-200 ease-apple hover:scale-110"
                  style={{
                    '--i': Math.min(index, 24),
                    background: intensity === 0 ? 'var(--color-sunken)' : `color-mix(in srgb, ${s.color} ${Math.round(18 + intensity * 82)}%, var(--color-surface))`,
                  } as React.CSSProperties}
                />
              );
            })}
          </div>
        ))}
        <span aria-hidden />
        {rows.map((row, index) => (
          <span key={row.label} className="truncate pt-1 text-center text-[11px] text-ink-3">
            {index % step === 0 ? row.label : ''}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-ink-3" aria-hidden>
        Moins
        <span className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(90deg, var(--color-sunken), var(--color-ink-2))' }} />
        Plus
      </div>
    </div>
  );
}
