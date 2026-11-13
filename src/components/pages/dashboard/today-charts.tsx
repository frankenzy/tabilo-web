"use client";

import { ChartKindPicker, SeriesChart, useChartKind, type ChartKind } from "@/components/ui/charts/series-chart";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState, type CSSProperties } from "react";
import {
  BarChart3,
  ChevronDown,
  Minus,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { CategoryImage } from "@/components/pages/menu/category-image";
import { dishImages } from "@/components/pages/orders/orders-logic";
import {
  Card,
  ErrorState,
  Spinner,
  useSlidingIndicator,
} from "@/components/ui";
import type {
  TimelineBucket,
  TimelinePoint,
  TimelineQuery,
  TimelineSummary,
  TodayTopItem,
} from "@/contracts";
import {
  estKey,
  useEstablishmentId,
  useLiveRefetchInterval,
  useTimezone,
} from "@/hooks/use-establishment";
import { cn } from "@/lib/utils";
import { analyticsApi, menuApi } from "@/services/api";
import { errorMessage } from "@/services/http";
import { formatDuration } from "@/utils/time";
import {
  BUCKETS,
  clampDay,
  daysInMonth,
  HOUR_SERIES,
  hourTotal,
  lateShare,
  MONTH_NAMES,
  periodLabel,
  RANK_COLORS,
  summaryTitle,
  todayIn,
  trendHint,
  trendOf,
  type Trend,
} from "./today-logic";

/**
 * Spec 008 : sous les indicateurs du tableau de bord, deux tiers « Demandes par heure »,
 * un tiers « Top 3 du jour ». Mis à jour par le temps réel (invalidation de la clé « today »).
 */
export function TodaySection() {
  const establishmentId = useEstablishmentId();
  const refetchInterval = useLiveRefetchInterval();
  const today = useQuery({
    queryKey: estKey(establishmentId, "today"),
    queryFn: () => analyticsApi.today(establishmentId),
    refetchInterval: Math.min(refetchInterval, 30_000),
  });

  // Spec 008, R7 : découpage et filtres de date, sur la date du jour par défaut (fuseau de l'établissement).
  const timeZone = useTimezone();
  const [query, setQuery] = useState<TimelineQuery>(() => ({
    bucket: "hour",
    ...todayIn(timeZone),
  }));
  // Clé sous « today » : le temps réel, qui invalide « today », rafraîchit aussi le graphique (R6).
  const timeline = useQuery({
    queryKey: estKey(establishmentId, "today", "timeline", query),
    queryFn: () => analyticsApi.timeline(establishmentId, query),
    refetchInterval: Math.min(refetchInterval, 30_000),
    placeholderData: keepPreviousData,
  });
  const current = BUCKETS.find((option) => option.value === query.bucket)!;
  const segments = useSlidingIndicator(query.bucket);
  const currentYear = todayIn(timeZone).year;
  const firstYear = Math.min(
    timeline.data?.firstYear ?? currentYear,
    query.year,
  );
  const years = Array.from(
    { length: currentYear - firstYear + 1 },
    (_, i) => currentYear - i,
  );
  const [chartKind, setChartKind] = useChartKind("dashboard-demandes");
  const update = (patch: Partial<TimelineQuery>) =>
    setQuery((previous) => {
      const next = { ...previous, ...patch };
      return { ...next, day: clampDay(next.year, next.month, next.day) };
    });

  return (
    <>
      <section
        aria-label="Aujourd’hui"
        className="mt-6 grid gap-4 lg:grid-cols-3"
      >
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">
              {current.title}
            </h2>
            {/* Spec 008, R7 : découpage puis filtres de date, en haut à droite ; spec 011 : type de graphique. */}
            <div className="flex flex-wrap items-center gap-2">
              <ChartKindPicker value={chartKind} onChange={setChartKind} />
              <div
                ref={segments.container}
                role="tablist"
                aria-label="Découpage du graphique"
                className="relative flex gap-1 rounded-lg bg-sunken p-1"
              >
                {segments.indicator}
                {BUCKETS.map((option) => (
                  <button
                    key={option.value}
                    ref={segments.register(option.value)}
                    type="button"
                    role="tab"
                    aria-selected={query.bucket === option.value}
                    onClick={() => update({ bucket: option.value })}
                    className={cn(
                      "relative rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-300",
                      query.bucket === option.value
                        ? "text-ink"
                        : "text-ink-3 hover:text-ink",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {current.filters.includes("day") && (
                <DateSelect
                  label="Jour"
                  value={query.day}
                  onChange={(day) => update({ day })}
                >
                  {Array.from(
                    { length: daysInMonth(query.year, query.month) },
                    (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ),
                  )}
                </DateSelect>
              )}
              {current.filters.includes("month") && (
                <DateSelect
                  label="Mois"
                  value={query.month}
                  onChange={(month) => update({ month })}
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </DateSelect>
              )}
              <DateSelect
                label="Année"
                value={query.year}
                onChange={(year) => update({ year })}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </DateSelect>
            </div>
          </div>
          {timeline.isPending ? (
            <Spinner />
          ) : timeline.isError ? (
            <ErrorState
              message={errorMessage(timeline.error)}
              onRetry={() => void timeline.refetch()}
            />
          ) : (
            // Pendant le chargement d'une autre période, l'ancien graphique reste visible, atténué.
            <div
              className={cn(
                "transition-opacity duration-300 ease-apple",
                timeline.isPlaceholderData && "opacity-50",
              )}
            >
              <TimelineChart
                points={timeline.data.points}
                bucket={query.bucket}
                title={current.title}
                kind={chartKind}
              />
            </div>
          )}
        </Card>
        <Card className="p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold text-ink">Top 3 du jour</h2>
          {today.isPending ? (
            <Spinner />
          ) : today.isError ? (
            <ErrorState
              message={errorMessage(today.error)}
              onRetry={() => void today.refetch()}
            />
          ) : (
            <TopItems items={today.data.topItems} />
          )}
        </Card>
      </section>
      {timeline.data && (
        <PeriodSummary
          title={summaryTitle(query)}
          summary={timeline.data.summary}
          dimmed={timeline.isPlaceholderData}
        />
      )}
    </>
  );
}

/** Spec 008, R8 : les quatre indicateurs de la page « Rapport », sur la période du graphique. */
function PeriodSummary({
  title,
  summary,
  dimmed,
}: {
  title: string;
  summary: TimelineSummary;
  dimmed: boolean;
}) {
  const inProgress = summary.total - summary.resolved - summary.cancelled;
  const share = lateShare(summary.late, summary.total);
  const cards: {
    label: string;
    value: string;
    hint: string;
    late?: boolean;
  }[] = [
    {
      label: "Demandes",
      value: String(summary.total),
      hint: `${summary.resolved} résolue${summary.resolved > 1 ? "s" : ""} · ${summary.cancelled} annulée${summary.cancelled > 1 ? "s" : ""} · ${inProgress} en cours`,
    },
    {
      label: "Prise en charge médiane",
      value: formatDuration(summary.medianAcceptSeconds),
      hint: `moyenne : ${formatDuration(summary.averageAcceptSeconds)}`,
    },
    {
      label: "Résolution médiane",
      value: formatDuration(summary.medianResolveSeconds),
      hint: `moyenne : ${formatDuration(summary.averageResolveSeconds)}`,
    },
    {
      label: "En retard",
      value: `${share} %`,
      hint: `${summary.late} demande${summary.late > 1 ? "s" : ""} · ${summary.escalated} escaladée${summary.escalated > 1 ? "s" : ""}`,
      late: summary.late > 0,
    },
  ];
  return (
    <section aria-label={title} className="mt-6">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <dl
        className={cn(
          "mt-3 grid grid-cols-2 gap-3 transition-opacity duration-300 ease-apple lg:grid-cols-4",
          dimmed && "opacity-50",
        )}
      >
        {cards.map((card, index) => (
          <div
            key={card.label}
            className="stagger flex animate-item-in flex-col justify-between gap-3 rounded-(--radius-card) bg-surface p-4 ring-1 ring-line sm:p-5"
            style={{ "--i": index } as CSSProperties}
          >
            <dt className="text-[15px] font-medium text-ink">{card.label}</dt>
            <div>
              <dd
                className={cn(
                  "tabular overflow-hidden text-3xl leading-none font-semibold tracking-tight",
                  card.late ? "text-late" : "text-ink",
                )}
              >
                <span
                  key={card.value}
                  className="inline-block animate-number-in"
                >
                  {card.value}
                </span>
              </dd>
              <dd className="mt-1.5 text-xs text-ink-3">{card.hint}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TimelineChart({
  points,
  bucket,
  title,
  kind,
}: {
  points: TimelinePoint[];
  bucket: TimelineBucket;
  title: string;
  kind: ChartKind;
}) {
  if (points.every((point) => hourTotal(point) === 0)) {
    return (
      <p className="mt-6 flex flex-col items-center gap-2 py-10 text-center text-sm text-ink-3">
        <BarChart3 className="size-6" aria-hidden />
        Aucune demande sur cette période
      </p>
    );
  }
  const total = points.reduce((sum, point) => sum + hourTotal(point), 0);
  const data = points.map((point) => ({
    ...point,
    label: periodLabel(point.period, bucket),
  }));
  return (
    <>
      <ul
        className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2"
        aria-label="Légende"
      >
        {[...HOUR_SERIES].reverse().map((series) => (
          <li key={series.key} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: series.color }}
              aria-hidden
            />
            {series.label}
          </li>
        ))}
      </ul>
      {/* Spec 011 : cinq types de graphique sur les mêmes données. */}
      <div className="mt-3">
        <SeriesChart
          kind={kind}
          rows={data}
          series={HOUR_SERIES}
          ariaLabel={`${title} : ${total} au total, réparties par état actuel`}
        />
      </div>
    </>
  );
}

const ROW = 76; // hauteur d'une ligne du top 3, en px : sert au glissement d'un rang à l'autre.

const TREND: Record<
  Trend,
  { icon: typeof TrendingUp; className: string; label: string }
> = {
  up: { icon: TrendingUp, className: "text-done", label: "En hausse" },
  new: { icon: TrendingUp, className: "text-done", label: "Nouveau" },
  down: { icon: TrendingDown, className: "text-late", label: "En baisse" },
  same: { icon: Minus, className: "text-ink-3", label: "Stable" },
};

function TopItems({ items }: { items: TodayTopItem[] }) {
  const establishmentId = useEstablishmentId();
  const menu = useQuery({
    queryKey: estKey(establishmentId, "menu"),
    queryFn: () => menuApi.overview(establishmentId),
  });
  const images = dishImages(menu.data);
  if (items.length === 0) {
    return (
      <p className="mt-6 flex flex-col items-center gap-2 py-10 text-center text-sm text-ink-3">
        <ShoppingBag className="size-6" aria-hidden />
        Aucune commande aujourd’hui
      </p>
    );
  }
  return (
    // Spec 008, R6 : chaque ligne est placée à « rang × hauteur » ; quand le rang change, elle glisse.
    <ol
      className="relative mt-3"
      style={{ height: items.length * ROW }}
      aria-label="Produits les plus commandés aujourd’hui"
    >
      {items.map((item) => {
        const color = RANK_COLORS[item.rank];
        const trend = trendOf(item.rank, item.previousRank);
        const Trend = TREND[trend];
        const image = images.get(item.menuItemId);
        return (
          <li
            key={item.menuItemId}
            className="absolute inset-x-0 top-0 transition-transform duration-[600ms] ease-spring motion-reduce:transition-none"
            style={{
              transform: `translateY(${(item.rank - 1) * ROW}px)`,
              height: ROW - 8,
            }}
            data-testid={`top-${item.rank}`}
          >
            <div className="relative flex h-full animate-item-in items-center gap-2.5 overflow-hidden rounded-xl bg-sunken/60 pr-3 pl-4">
              <span
                className={cn("absolute inset-y-0 left-0 w-1.5", color.edge)}
                aria-hidden
              />
              <span
                className={cn(
                  "tabular grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold",
                  color.badge,
                )}
                aria-label={`${item.rank}${item.rank === 1 ? "er" : "e"} (${color.name})`}
              >
                {item.rank}
              </span>
              <CategoryImage
                icon={image?.icon ?? "utensils"}
                imageId={image?.imageId ?? null}
                name=""
                className="size-11 shrink-0 rounded-lg"
              />
              <span className="line-clamp-2 min-w-0 flex-1 text-[14px] leading-tight font-medium text-ink sm:text-[15px]">
                {item.name}
              </span>
              <span className="tabular shrink-0 overflow-hidden text-lg font-bold text-ink">
                <span
                  key={item.quantity}
                  className="inline-block animate-number-in"
                >
                  ×{item.quantity}
                </span>
              </span>
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1 text-[11px] font-semibold",
                  Trend.className,
                )}
                title={trendHint(item.previousRank)}
              >
                <Trend.icon className="size-5" aria-hidden />
                {trend === "new" && <span>Nouveau</span>}
                <span className="sr-only">
                  {Trend.label}, {trendHint(item.previousRank)}
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function DateSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 appearance-none rounded-lg bg-surface pr-8 pl-3 text-[13px] font-medium text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand"
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-ink-2"
        aria-hidden
      />
    </label>
  );
}
