'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui';
import type { SalesSummary } from '@/contracts';
import { formatMoney } from '@/utils/money';

const dateFr = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T12:00:00`));

/** Spec 040, R4 : récapitulatif imprimable (A4) d'une période — mêmes chiffres que le CSV et le tableau de bord (R5). */
export function SummaryView({ summary }: { summary: SalesSummary }) {
  const money = (minor: number) => formatMoney(minor, summary.currency);
  const period = summary.from === summary.to ? dateFr(summary.from) : `du ${dateFr(summary.from)} au ${dateFr(summary.to)}`;
  const figures: [string, string][] = [
    ['Total vendu', money(summary.totalMinor)],
    ['Total encaissé', money(summary.paidMinor)],
    ['Reste à encaisser', money(summary.outstandingMinor)],
    ['Commandes', String(summary.orders)],
    ['Panier moyen', summary.averageMinor === null ? '—' : money(summary.averageMinor)],
    ['Offert', money(summary.offeredMinor)],
    ['Remises de promotion', money(summary.discountMinor)],
    ['Partis sans payer', money(summary.writtenOffMinor)],
  ];
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="no-print mb-4 flex justify-end">
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          Imprimer ou enregistrer en PDF
        </Button>
      </div>
      <article className="rounded-2xl bg-surface p-8 ring-1 ring-line print:rounded-none print:p-0 print:ring-0">
        <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <h1 className="text-xl font-semibold text-ink">{summary.establishment}</h1>
            <p className="text-[14px] text-ink-2">Récapitulatif des ventes · {period}</p>
          </div>
          <p className="text-right text-[12px] text-ink-3">Édité le {new Date(summary.editedAt).toLocaleString('fr-FR')}</p>
        </header>
        <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2.5 text-[14px] sm:grid-cols-4">
          {figures.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[12px] text-ink-2">{label}</dt>
              <dd className="tabular text-[17px] font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <section>
            <h2 className="mb-2 text-[14px] font-semibold text-ink">Top 10 des produits</h2>
            <table className="w-full text-[13px]">
              <tbody>
                {summary.topProducts.map((product) => (
                  <tr key={product.name} className="border-t border-line">
                    <td className="py-1.5">{product.name}</td>
                    <td className="tabular py-1.5 text-right text-ink-2">×{product.quantity}</td>
                    <td className="tabular py-1.5 text-right font-medium">{money(product.amountMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section>
            <h2 className="mb-2 text-[14px] font-semibold text-ink">Par serveur</h2>
            <table className="w-full text-[13px]">
              <tbody>
                {summary.servers.map((server) => (
                  <tr key={server.name} className="border-t border-line">
                    <td className="py-1.5">{server.name}</td>
                    <td className="tabular py-1.5 text-right text-ink-2">{server.orders} cmd</td>
                    <td className="tabular py-1.5 text-right font-medium">{money(server.amountMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </article>
    </div>
  );
}
