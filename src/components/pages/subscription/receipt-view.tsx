'use client';

import { Printer } from 'lucide-react';
import { Brand } from '@/components/layouts/brand';
import { Button } from '@/components/ui';
import type { Receipt } from '@/contracts';
import { formatMoney } from '@/utils/money';
import { METHOD_LABELS } from './subscription-logic';

const dateFr = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

/**
 * Spec 037, R4 : le reçu d'un paiement d'abonnement. S'imprime en A4 comme en ticket de 80 mm :
 * une seule colonne étroite, sans couleur indispensable.
 */
export function ReceiptView({ receipt }: { receipt: Receipt }) {
  const rows: [string, string][] = [
    ['Compte', receipt.tenantName],
    ['Formule', receipt.planName],
    ['Période', `du ${dateFr(receipt.periodStart)} au ${dateFr(receipt.periodEnd)} (${receipt.months} mois)`],
    ['Moyen de paiement', METHOD_LABELS[receipt.method]],
    ...(receipt.reference ? ([['Référence', receipt.reference]] as [string, string][]) : []),
    ['Date', dateFr(receipt.createdAt)],
  ];
  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div className="no-print mb-4 flex justify-end">
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          Imprimer ou enregistrer en PDF
        </Button>
      </div>
      <article className="rounded-2xl bg-surface p-6 ring-1 ring-line print:rounded-none print:p-0 print:ring-0">
        <div className="flex items-center justify-between">
          <Brand />
          <p className="text-right text-[12px] text-ink-2">
            Reçu
            <br />
            <span className="tabular text-[15px] font-semibold text-ink">N° {receipt.number}</span>
          </p>
        </div>
        {receipt.cancelledAt && (
          <p className="mt-4 rounded-lg border-2 border-late px-3 py-2 text-center text-[14px] font-bold tracking-wide text-late uppercase">
            Annulé — {receipt.cancelReason}
          </p>
        )}
        <dl className="mt-5 flex flex-col gap-2 text-[14px]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-dashed border-line pb-2">
              <dt className="text-ink-2">{label}</dt>
              <dd className="text-right font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 flex items-baseline justify-between">
          <span className="text-[14px] text-ink-2">Montant réglé</span>
          <span className="tabular text-2xl font-semibold text-ink">{formatMoney(receipt.amountMinor, 'XOF')}</span>
        </p>
        <p className="mt-6 text-center text-[12px] text-ink-3">Merci de votre confiance · TABILO</p>
      </article>
    </div>
  );
}
