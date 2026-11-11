'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFloor, useStaff } from '@/components/pages/requests/use-requests';
import { Card, EmptyState, ErrorState, FilterSelect, PageHeader, Spinner } from '@/components/ui';
import type { Breakdown, Report } from '@/contracts';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { analyticsApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { currencyDigits, formatMoney } from '@/utils/money';
import { formatDuration } from '@/utils/time';

const PERIODS = [
  { value: 'today', label: 'Aujourd’hui', days: 0 },
  { value: '7d', label: '7 derniers jours', days: 6 },
  { value: '30d', label: '30 derniers jours', days: 29 },
  { value: '90d', label: '90 derniers jours', days: 89 },
];

// Couleurs des séries, validées (contraste, daltonisme) : dans les délais / en retard.
const ON_TIME = '#2f5fd0';
const LATE = '#d92d20';
// Montant servi : série unique, teinte distincte des délais (palette validée ; contraste < 3:1, d'où le tableau de données).
const AMOUNT = '#1baf7a';

function range(period: string): { from: string; to: string } {
  const days = PERIODS.find((p) => p.value === period)?.days ?? 0;
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - days);
  const to = new Date();
  to.setHours(24, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function bucketLabel(bucket: string, kind: Report['period']['bucket']): string {
  const date = new Date(bucket);
  return kind === 'hour'
    ? `${String(date.getHours()).padStart(2, '0')} h`
    : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(date);
}

export function AnalyticsPage() {
  const establishmentId = useEstablishmentId();
  const floor = useFloor();
  const staff = useStaff();
  const [period, setPeriod] = useState('7d');
  const [areaId, setAreaId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  // Bornes figées par période : la clé de cache reste stable entre deux rendus.
  const bounds = useMemo(() => range(period), [period]);
  const params = { ...bounds, areaId: areaId || undefined, assigneeId: assigneeId || undefined };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: estKey(establishmentId, 'report', params),
    queryFn: () => analyticsApi.report(establishmentId, params),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Statistiques" description="Indicateurs calculés à partir des demandes réelles de l’établissement." />
      <div className="flex flex-wrap gap-2">
        <FilterSelect label="Période" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Zone" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">Toutes les zones</option>
          {(floor.data ?? []).map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Membre" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Toute l’équipe</option>
          {(staff.data ?? []).filter((m) => m.canHandleRequests).map((member) => (
            <option key={member.id} value={member.id}>
              {member.firstName} {member.lastName}
            </option>
          ))}
        </FilterSelect>
      </div>

      <div className="mt-6">
        {isPending ? (
          <Spinner />
        ) : isError ? (
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : data.totals.total === 0 ? (
          <EmptyState icon={<BarChart3 className="size-6" aria-hidden />} title="Aucune demande sur cette période" description="Les indicateurs apparaîtront dès les premières demandes." />
        ) : (
          <ReportView report={data} />
        )}
      </div>
    </>
  );
}

function ReportView({ report }: { report: Report }) {
  const { totals } = report;
  const handled = totals.resolved + totals.cancelled;
  const lateShare = totals.total > 0 ? Math.round((totals.late / totals.total) * 100) : 0;
  // Colonne « Montant » seulement s'il y a eu des commandes servies.
  const amountCurrency = report.sales.orders > 0 ? report.sales.currency : null;
  const series = report.series.map((point) => ({
    label: bucketLabel(point.bucket, report.period.bucket),
    onTime: point.total - point.late,
    late: point.late,
    total: point.total,
  }));

  return (
    <div className="flex flex-col gap-10">
      <SalesSection report={report} />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
        <Figure label="Demandes" value={totals.total} hint={`${totals.resolved} résolues · ${totals.cancelled} annulées · ${totals.total - handled} en cours`} />
        <Figure label="Prise en charge médiane" value={formatDuration(totals.medianAcceptSeconds)} hint={`moyenne : ${formatDuration(totals.averageAcceptSeconds)}`} />
        <Figure label="Résolution médiane" value={formatDuration(totals.medianResolveSeconds)} hint={`moyenne : ${formatDuration(totals.averageResolveSeconds)}`} />
        <Figure label="En retard" value={`${lateShare} %`} hint={`${totals.late} demande${totals.late > 1 ? 's' : ''} · ${totals.escalated} escaladée${totals.escalated > 1 ? 's' : ''}`} tone={totals.late > 0 ? 'late' : undefined} />
      </dl>

      <section aria-labelledby="steps-title">
        <h2 id="steps-title" className="text-[15px] font-semibold text-ink">
          Délais médians par étape
        </h2>
        <p className="mt-1 text-[13px] text-ink-2">Temps écoulé depuis la création de la demande.</p>
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-(--radius-card) bg-line ring-1 ring-line sm:grid-cols-4">
          {[
            ['Affectation', totals.medianAssignSeconds],
            ['Acceptation', totals.medianAcceptSeconds],
            ['Début du traitement', totals.medianStartSeconds],
            ['Résolution', totals.medianResolveSeconds],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-surface px-4 py-3">
              <dt className="text-[13px] text-ink-2">{label}</dt>
              <dd className="tabular mt-1 text-lg font-semibold text-ink">{formatDuration(value as number | null)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="series-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="series-title" className="text-[15px] font-semibold text-ink">
            Demandes par {report.period.bucket === 'hour' ? 'heure' : 'jour'}
          </h2>
          <ul className="flex gap-4 text-xs text-ink-2" aria-label="Légende">
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: ON_TIME }} aria-hidden />
              Dans les délais
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: LATE }} aria-hidden />
              En retard
            </li>
          </ul>
        </div>
        <Card className="mt-3 p-4">
          <div className="h-64" role="img" aria-label={`Histogramme des demandes par ${report.period.bucket === 'hour' ? 'heure' : 'jour'} ; le détail figure dans le tableau ci-dessous.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="#e4dfd6" strokeDasharray="2 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#e4dfd6' }} tick={{ fontSize: 12, fill: '#57524c' }} interval="preserveStartEnd" minTickGap={16} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#8c867e' }} width={44} />
                <Tooltip
                  cursor={{ fill: '#efece6' }}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e4dfd6', fontSize: 13, boxShadow: '0 12px 40px -12px rgb(27 25 23 / 0.25)' }}
                  labelStyle={{ color: '#1b1917', fontWeight: 600 }}
                  itemStyle={{ color: '#57524c' }}
                />
                <Bar dataKey="onTime" name="Dans les délais" stackId="requests" fill={ON_TIME} stroke="#ffffff" strokeWidth={2} maxBarSize={36} isAnimationActive={false} />
                <Bar dataKey="late" name="En retard" stackId="requests" fill={LATE} stroke="#ffffff" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-[13px] font-medium text-ink-2 hover:text-ink">Voir les données</summary>
            <div className="mt-2 max-h-64 overflow-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="text-ink-3">
                  <tr>
                    <th scope="col" className="py-1.5 font-medium">{report.period.bucket === 'hour' ? 'Heure' : 'Jour'}</th>
                    <th scope="col" className="py-1.5 text-right font-medium">Demandes</th>
                    <th scope="col" className="py-1.5 text-right font-medium">En retard</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {series.map((point) => (
                    <tr key={point.label}>
                      <td className="py-1.5 text-ink">{point.label}</td>
                      <td className="tabular py-1.5 text-right text-ink">{point.total}</td>
                      <td className="tabular py-1.5 text-right text-ink-2">{point.late}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Card>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <BreakdownTable title="Par type de demande" heading="Type" rows={report.byType} currency={amountCurrency} />
        <BreakdownTable title="Par zone" heading="Zone" rows={report.byArea} currency={amountCurrency} />
        <BreakdownTable title="Tables les plus sollicitées" heading="Table" rows={report.byTable} currency={amountCurrency} />
        <BreakdownTable title="Par membre de l’équipe" heading="Membre" rows={report.byStaff} currency={amountCurrency} empty="Aucune demande prise en charge sur la période." />
      </div>
    </div>
  );
}

function Figure({ label, value, hint, tone }: { label: string; value: number | string; hint: string; tone?: 'late' }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className={`tabular mt-1 text-3xl leading-none font-semibold tracking-tight ${tone === 'late' ? 'text-late' : 'text-ink'}`}>{value}</dd>
      <dd className="mt-1.5 text-xs text-ink-3">{hint}</dd>
    </div>
  );
}

function BreakdownTable({ title, heading, rows, empty, currency }: { title: string; heading: string; rows: Breakdown[]; empty?: string; currency: string | null }) {
  const max = Math.max(1, ...rows.map((row) => row.total));
  return (
    <section>
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-2">{empty ?? 'Aucune donnée sur la période.'}</p>
      ) : (
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="text-[13px] text-ink-3">
              <tr className="border-b border-line">
                <th scope="col" className="px-4 py-2.5 font-medium">{heading}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Demandes</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">En retard</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium whitespace-nowrap">Prise en charge (méd.)</th>
                {currency && <th scope="col" className="px-4 py-2.5 text-right font-medium">Montant</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="px-4 py-2.5 font-normal text-ink">
                    {row.label}
                    <span className="mt-1.5 block h-1 rounded-full bg-sunken" aria-hidden>
                      <span className="block h-1 rounded-full bg-ink" style={{ width: `${(row.total / max) * 100}%` }} />
                    </span>
                  </th>
                  <td className="tabular px-3 py-2.5 text-right text-ink">{row.total}</td>
                  <td className={`tabular px-3 py-2.5 text-right ${row.late > 0 ? 'font-medium text-late' : 'text-ink-3'}`}>{row.late}</td>
                  <td className="tabular px-4 py-2.5 text-right text-ink-2">{formatDuration(row.medianAcceptSeconds)}</td>
                  {currency && <td className="tabular px-4 py-2.5 text-right whitespace-nowrap text-ink">{row.amountMinor > 0 ? formatMoney(row.amountMinor, currency) : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}

/** Ventes (spec 001, R15) : montant des commandes servies, jamais un encaissement. */
function SalesSection({ report }: { report: Report }) {
  const { sales } = report;
  const unit = report.period.bucket === 'hour' ? 'heure' : 'jour';
  if (sales.orders === 0) {
    return (
      <section aria-labelledby="sales-title">
        <h2 id="sales-title" className="text-[15px] font-semibold text-ink">
          Ventes
        </h2>
        <p className="mt-2 text-sm text-ink-2">Aucune commande servie sur la période.</p>
      </section>
    );
  }
  const money = (minor: number) => formatMoney(minor, sales.currency);
  const points = report.series.map((point) => ({ label: bucketLabel(point.bucket, report.period.bucket), amountMinor: point.amountMinor }));

  return (
    <section aria-labelledby="sales-title" className="flex flex-col gap-6">
      <div>
        <h2 id="sales-title" className="text-[15px] font-semibold text-ink">
          Ventes
        </h2>
        <p className="mt-1 text-[13px] text-ink-2">Commandes passées depuis la carte et servies. Montant déclaratif, hors encaissement.</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
        <Figure label="Montant des commandes servies" value={money(sales.amountMinor)} hint={`${sales.orders} commande${sales.orders > 1 ? 's' : ''} servie${sales.orders > 1 ? 's' : ''}`} />
        <Figure label="Panier moyen" value={sales.averageMinor === null ? '—' : money(sales.averageMinor)} hint="par commande servie" />
      </dl>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Montant servi par {unit}</h3>
          <Card className="mt-3 p-4">
            <div className="h-56" role="img" aria-label={`Histogramme du montant servi par ${unit} ; le détail figure dans le tableau ci-dessous.`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="#e4dfd6" strokeDasharray="2 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#e4dfd6' }} tick={{ fontSize: 12, fill: '#57524c' }} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: '#8c867e' }}
                    width={72}
                    tickFormatter={(value: number) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(value / 10 ** currencyDigits(sales.currency))}
                  />
                  <Tooltip
                    cursor={{ fill: '#efece6' }}
                    formatter={(value) => [money(Number(value)), 'Montant servi']}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e4dfd6', fontSize: 13, boxShadow: '0 12px 40px -12px rgb(27 25 23 / 0.25)' }}
                    labelStyle={{ color: '#1b1917', fontWeight: 600 }}
                    itemStyle={{ color: '#57524c' }}
                  />
                  <Bar dataKey="amountMinor" name="Montant servi" fill={AMOUNT} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-[13px] font-medium text-ink-2 hover:text-ink">Voir les données</summary>
              <div className="mt-2 max-h-64 overflow-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="text-ink-3">
                    <tr>
                      <th scope="col" className="py-1.5 font-medium">{unit === 'heure' ? 'Heure' : 'Jour'}</th>
                      <th scope="col" className="py-1.5 text-right font-medium">Montant servi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {points.map((point) => (
                      <tr key={point.label}>
                        <td className="py-1.5 text-ink">{point.label}</td>
                        <td className="tabular py-1.5 text-right text-ink">{money(point.amountMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Card>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Articles les plus vendus</h3>
          <Card className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[13px] text-ink-3">
                <tr className="border-b border-line">
                  <th scope="col" className="px-4 py-2.5 font-medium">Article</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Quantité</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sales.topItems.map((item) => (
                  <tr key={item.menuItemId}>
                    <th scope="row" className="px-4 py-2.5 font-normal text-ink">{item.name}</th>
                    <td className="tabular px-3 py-2.5 text-right text-ink">{item.quantity}</td>
                    <td className="tabular px-4 py-2.5 text-right whitespace-nowrap text-ink">{money(item.amountMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </section>
  );
}
