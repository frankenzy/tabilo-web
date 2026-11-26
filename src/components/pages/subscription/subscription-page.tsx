'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Download, Lock, MessageCircle, Receipt as ReceiptIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge, Button, Card, ErrorState, PageHeader, Spinner } from '@/components/ui';
import type { SubscriptionOverview } from '@/contracts';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { cn } from '@/lib/utils';
import { privacyApi, subscriptionApi } from '@/services/api';
import { toast } from '@/stores/toast.store';
import { errorMessage, toHttpError } from '@/services/http';
import { formatMoney } from '@/utils/money';
import { METHOD_LABELS, STATE_LABELS, whatsappLink } from './subscription-logic';

const dateFr = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
const limit = (max: number | null) => (max === null ? 'illimité' : String(max));

/** Specs 034 (R8), 035 et 037 (R6) : la page « Abonnement », réservée au propriétaire. */
export function SubscriptionPage() {
  const establishmentId = useEstablishmentId();
  const query = useQuery({ queryKey: estKey(establishmentId, 'subscription'), queryFn: () => subscriptionApi.overview(establishmentId) });

  if (query.isPending) return <Spinner />;
  if (query.isError) {
    if (toHttpError(query.error).status === 403) {
      return (
        <>
          <PageHeader title="Abonnement" />
          <Card className="p-5 text-sm text-ink-2">Seul le propriétaire du compte consulte l’abonnement. Prévenez-le si un bandeau vous le demande.</Card>
        </>
      );
    }
    return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  }
  const data = query.data;
  return (
    <>
      <PageHeader title="Abonnement" description="Votre formule, ce que vous utilisez et vos paiements." />
      <div className="grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5">
          <CurrentPlan data={data} />
          <Catalog data={data} />
        </div>
        <div className="flex flex-col gap-5">
          <Payments data={data} />
          <DataExport />
        </div>
      </div>
    </>
  );
}

function CurrentPlan({ data }: { data: SubscriptionOverview }) {
  const tone = data.state === 'active' ? 'done' : data.state === 'trial' ? 'progress' : 'late';
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] text-ink-2">Formule</p>
          <p className="text-2xl font-semibold tracking-tight text-ink">{data.planName}</p>
        </div>
        <div className="text-right">
          <Badge tone={tone}>{STATE_LABELS[data.state]}</Badge>
          <p className="mt-1 text-[13px] text-ink-2">
            {data.state === 'past_due' || data.state === 'suspended' ? `Échéance passée le ${dateFr(data.paidUntil)}` : `Jusqu’au ${dateFr(data.paidUntil)}`}
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {(
          [
            ['Établissements', data.usage.establishments],
            ['Tables', data.usage.tables],
            ['Équipe', data.usage.staff],
          ] as const
        ).map(([label, usage]) => {
          const full = usage.max !== null && usage.used >= usage.max;
          return (
            <div key={label} className="rounded-xl bg-sunken/60 p-3">
              <p className="text-[12px] text-ink-2">{label}</p>
              <p className={cn('tabular text-lg font-semibold', full ? 'text-late' : 'text-ink')}>
                {usage.used} <span className="text-[13px] font-normal text-ink-3">/ {limit(usage.max)}</span>
              </p>
              {usage.max !== null && (
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                  <span className={cn('block h-full rounded-full', full ? 'bg-late' : 'bg-ink')} style={{ width: `${Math.min(100, (usage.used / usage.max) * 100)}%` }} />
                </span>
              )}
            </div>
          );
        })}
      </div>
      <ul className="mt-5 flex flex-col gap-2">
        {data.features.map((feature) => (
          <li key={feature.key} className="flex items-center gap-2 text-[14px]">
            {feature.included ? <Check className="size-4 text-done" aria-hidden /> : <Lock className="size-4 text-ink-3" aria-hidden />}
            <span className={feature.included ? 'text-ink' : 'text-ink-3'}>{feature.label}</span>
            {!feature.included && feature.availableIn && <Badge tone="muted">Avec {feature.availableIn}</Badge>}
          </li>
        ))}
      </ul>
      <a
        href={whatsappLink(data.contact)}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-done px-4 text-[14px] font-semibold text-white"
      >
        <MessageCircle className="size-4" aria-hidden />
        Payer ou changer de formule · {data.contact}
      </a>
    </Card>
  );
}

function Catalog({ data }: { data: SubscriptionOverview }) {
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold text-ink">Les formules</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {data.catalog.map((plan) => (
          <div key={plan.key} className={cn('rounded-xl p-4 ring-1', plan.current ? 'bg-ink text-white ring-ink' : 'bg-surface ring-line')}>
            <p className="text-[15px] font-semibold">{plan.name}</p>
            <p className="tabular mt-1 text-xl font-semibold">
              {formatMoney(plan.monthlyPriceMinor, 'XOF')}
              <span className={cn('text-[12px] font-normal', plan.current ? 'text-white/70' : 'text-ink-3')}> / mois</span>
            </p>
            <ul className={cn('mt-3 flex flex-col gap-1 text-[13px]', plan.current ? 'text-white/85' : 'text-ink-2')}>
              <li>{limit(plan.limits.establishments)} établissement{plan.limits.establishments === 1 ? '' : 's'}</li>
              <li>{limit(plan.limits.tablesPerEstablishment)} tables</li>
              <li>{limit(plan.limits.staffPerEstablishment)} membres d’équipe</li>
              {plan.features.length > 0 && <li>Formules, promotions, statistiques, rôles</li>}
            </ul>
            {plan.current && <p className="mt-3 text-[12px] font-semibold">Votre formule</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Spec 041, R3 : toutes les données du compte, en ZIP. */
function DataExport() {
  const establishmentId = useEstablishmentId();
  const download = useMutation({
    mutationFn: () => privacyApi.exportData(establishmentId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tabilo-donnees-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    onError: (error) => toast.error('Téléchargement impossible', errorMessage(error)),
  });
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold text-ink">Vos données</h2>
      <p className="mt-1 text-[13px] text-ink-2">Carte et photos, tables, équipe, commandes et paiements, en CSV et JSON. Une fois par heure au plus.</p>
      <Button variant="secondary" className="mt-3" loading={download.isPending} onClick={() => download.mutate()}>
        <Download className="size-4" aria-hidden />
        Télécharger toutes mes données
      </Button>
      <p className="mt-3 text-[12px] text-ink-3">
        <Link href="/confidentialite" className="underline underline-offset-4">
          Politique de confidentialité
        </Link>{' '}
        ·{' '}
        <Link href="/cgu" className="underline underline-offset-4">
          Conditions d’utilisation
        </Link>
      </p>
    </Card>
  );
}

function Payments({ data }: { data: SubscriptionOverview }) {
  return (
    <Card className="self-start p-5">
      <h2 className="text-[15px] font-semibold text-ink">Paiements</h2>
      {data.payments.length === 0 ? (
        <p className="mt-2 text-[13px] text-ink-2">Aucun paiement pour l’instant.</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {data.payments.map((payment) => (
            <li key={payment.id} className="border-b border-line last:border-0">
              <Link href={`/app/abonnement/recu/${payment.id}`} className="flex items-center gap-3 py-2.5 hover:bg-sunken/50">
                <ReceiptIcon className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[14px] font-medium', payment.cancelledAt ? 'text-ink-3 line-through' : 'text-ink')}>
                    N° {payment.number} · {formatMoney(payment.amountMinor, 'XOF')}
                  </span>
                  <span className="block text-[12px] text-ink-3">
                    {METHOD_LABELS[payment.method]} · {payment.months} mois · {dateFr(payment.createdAt)}
                  </span>
                </span>
                {payment.cancelledAt && <Badge tone="late">Annulé</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
