'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Badge, Button, Card, Dialog, ErrorState, FormError, Input, PageHeader, Select, Spinner } from '@/components/ui';
import type { PaymentMethod, PlanKey, PlatformTenantDetail, Receipt } from '@/contracts';
import { platformApi } from '@/services/api/platform';
import { errorMessage } from '@/services/http';
import { toast } from '@/stores/toast.store';
import { formatMoney } from '@/utils/money';
import { ReceiptView } from '@/components/pages/subscription/receipt-view';
import { METHOD_LABELS, STATE_LABELS } from '@/components/pages/subscription/subscription-logic';
import { dateFr, STATE_TONE } from './tenants-page';

const PLANS: { key: PlanKey; name: string; price: number }[] = [
  { key: 'essentiel', name: 'Essentiel', price: 15_000 },
  { key: 'pro', name: 'Pro', price: 35_000 },
  { key: 'premium', name: 'Premium', price: 75_000 },
];

/** Spec 036, P2 et P3 ; spec 037, P1 : la fiche d'un compte client. */
export function TenantPage({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const key = ['platform', 'tenant', id];
  const query = useQuery({ queryKey: key, queryFn: () => platformApi.tenant(id) });
  const refresh = (detail?: PlatformTenantDetail) => {
    if (detail) queryClient.setQueryData(key, detail);
    else void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
  };

  if (query.isPending) return <Spinner />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  const tenant = query.data;
  return (
    <>
      <Link href="/plateforme" className="mb-3 inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Comptes clients
      </Link>
      <PageHeader
        title={tenant.name}
        description={`Client depuis le ${dateFr(tenant.createdAt)} · ${tenant.establishments} établissement(s) · ${tenant.tables} tables · ${tenant.orders30d} commandes en 30 jours`}
        actions={<Badge tone={STATE_TONE[tenant.accountState]}>{STATE_LABELS[tenant.accountState]}</Badge>}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <Subscription tenant={tenant} onChanged={refresh} />
          <Payments tenant={tenant} onChanged={() => refresh()} />
        </div>
        <div className="flex flex-col gap-5">
          <Owners tenant={tenant} />
          <Closure tenant={tenant} onChanged={refresh} />
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink">Établissements</h2>
            <ul className="mt-2 flex flex-col gap-1.5 text-[14px]">
              {tenant.establishmentsList.map((establishment) => (
                <li key={establishment.id}>
                  <span className="font-medium text-ink">{establishment.name}</span>
                  {establishment.phone && <span className="text-ink-2"> · {establishment.phone}</span>}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink">Journal</h2>
            <ul className="mt-2 flex flex-col gap-2 text-[13px]">
              {tenant.log.length === 0 && <li className="text-ink-3">Aucune action.</li>}
              {tenant.log.map((entry) => (
                <li key={entry.id} className="border-b border-line pb-2 last:border-0">
                  <span className="font-medium text-ink">{entry.action.replace('platform.', '')}</span>
                  <span className="text-ink-3"> · {dateFr(entry.createdAt)} · {entry.adminName ?? '—'}</span>
                  {entry.reason && <span className="block text-ink-2">{entry.reason}</span>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function Subscription({ tenant, onChanged }: { tenant: PlatformTenantDetail; onChanged: (detail: PlatformTenantDetail) => void }) {
  const [plan, setPlan] = useState<PlanKey>(tenant.plan);
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState('');
  const suspended = tenant.manuallySuspended || tenant.accountState === 'suspended';
  const run = useMutation({
    mutationFn: (action: () => Promise<PlatformTenantDetail>) => action(),
    onSuccess: (detail) => {
      onChanged(detail);
      setReason('');
      toast.success('Compte mis à jour');
    },
    onError: (error) => toast.error('Action impossible', errorMessage(error)),
  });
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold text-ink">Abonnement</h2>
      <p className="mt-1 text-[13px] text-ink-2">
        Formule {tenant.planName} · échéance le {dateFr(tenant.paidUntil)}
        {tenant.manuallySuspended && ' · suspendu par l’éditeur'}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex items-end gap-2">
          <Select label="Formule" name="plan" value={plan} onChange={(event) => setPlan(event.target.value as PlanKey)}>
            {PLANS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.name}
              </option>
            ))}
          </Select>
          <Button variant="secondary" disabled={plan === tenant.plan} loading={run.isPending} onClick={() => run.mutate(() => platformApi.changePlan(tenant.id, plan))}>
            Changer
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <Input label="Prolonger de (jours)" name="days" type="number" min={1} max={90} value={days} onChange={(event) => setDays(event.target.value)} />
          <Button
            variant="secondary"
            loading={run.isPending}
            onClick={() => {
              const value = Number(days);
              if (!Number.isInteger(value) || value < 1 || value > 90) return toast.error('De 1 à 90 jours');
              run.mutate(() => platformApi.extend(tenant.id, value));
            }}
          >
            Prolonger
          </Button>
        </div>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <Input label="Motif (obligatoire pour suspendre ou réactiver)" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} />
        <Button
          variant={suspended ? 'primary' : 'danger'}
          loading={run.isPending}
          onClick={() => {
            if (reason.trim().length < 3) return toast.error('Indiquez un motif');
            run.mutate(() => (suspended ? platformApi.reactivate(tenant.id, reason.trim()) : platformApi.suspend(tenant.id, reason.trim())));
          }}
        >
          {suspended ? 'Réactiver' : 'Suspendre'}
        </Button>
      </div>
    </Card>
  );
}

/** Spec 041, P3 : fermer un compte à la demande du client (nom recopié, motif, délai avant effacement), ou le rétablir. */
function Closure({ tenant, onChanged }: { tenant: PlatformTenantDetail; onChanged: (detail: PlatformTenantDetail) => void }) {
  const [confirmName, setConfirmName] = useState('');
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('7');
  const run = useMutation({
    mutationFn: (action: () => Promise<PlatformTenantDetail>) => action(),
    onSuccess: (detail) => {
      onChanged(detail);
      setConfirmName('');
      setReason('');
      toast.success('Compte mis à jour');
    },
    onError: (error) => toast.error('Action impossible', errorMessage(error)),
  });
  if (tenant.erasedAt) {
    return <Card className="p-5 text-[14px] text-ink-2">Compte effacé le {dateFr(tenant.erasedAt)}.</Card>;
  }
  if (tenant.closedAt) {
    return (
      <Card className="p-5">
        <h2 className="text-[15px] font-semibold text-late">Compte fermé</h2>
        <p className="mt-1 text-[13px] text-ink-2">Effacement prévu le {tenant.deleteAfter ? dateFr(tenant.deleteAfter) : '—'}.</p>
        <div className="mt-3 flex items-end gap-2">
          <Input label="Motif" name="restoreReason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} />
          <Button loading={run.isPending} onClick={() => (reason.trim().length < 3 ? toast.error('Indiquez un motif') : run.mutate(() => platformApi.restore(tenant.id, reason.trim())))}>
            Rétablir
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold text-ink">Fermer le compte</h2>
      <p className="mt-1 text-[13px] text-ink-2">À la demande du client. Le compte est fermé aussitôt, puis effacé à la fin du délai ; on peut le rétablir d’ici là.</p>
      <div className="mt-3 flex flex-col gap-3">
        <Input label={`Recopiez le nom : ${tenant.name}`} name="confirmName" value={confirmName} onChange={(event) => setConfirmName(event.target.value)} />
        <Input label="Motif" name="closeReason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} />
        <Input label="Effacement dans (jours)" name="days" type="number" min={1} max={90} value={days} onChange={(event) => setDays(event.target.value)} />
        <Button
          variant="danger"
          loading={run.isPending}
          disabled={confirmName.trim().toLowerCase() !== tenant.name.trim().toLowerCase()}
          onClick={() => {
            const value = Number(days);
            if (reason.trim().length < 3) return toast.error('Indiquez un motif');
            if (!Number.isInteger(value) || value < 1 || value > 90) return toast.error('De 1 à 90 jours');
            run.mutate(() => platformApi.close(tenant.id, { confirmName: confirmName.trim(), reason: reason.trim(), days: value }));
          }}
        >
          Fermer le compte
        </Button>
      </div>
    </Card>
  );
}

function Owners({ tenant }: { tenant: PlatformTenantDetail }) {
  const [link, setLink] = useState<{ url: string; expiresAt: string; email: string } | null>(null);
  const create = useMutation({
    mutationFn: (userId: string) => platformApi.resetLink(tenant.id, userId),
    onSuccess: setLink,
    onError: (error) => toast.error('Lien impossible', errorMessage(error)),
  });
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold text-ink">Propriétaire</h2>
      <ul className="mt-2 flex flex-col gap-3">
        {tenant.owners.map((owner) => (
          <li key={owner.id} className="flex items-center justify-between gap-3 text-[14px]">
            <span className="min-w-0">
              <span className="block font-medium text-ink">
                {owner.firstName} {owner.lastName}
              </span>
              <span className="block truncate text-ink-2">{owner.email}</span>
            </span>
            <Button variant="secondary" size="sm" loading={create.isPending} onClick={() => create.mutate(owner.id)}>
              <KeyRound className="size-4" aria-hidden />
              Lien de réinitialisation
            </Button>
          </li>
        ))}
      </ul>
      {link && (
        // R5 : affiché une seule fois ; à envoyer au propriétaire par WhatsApp.
        <div className="mt-4 rounded-xl bg-wait p-3 text-[13px] text-wait-ink">
          <p className="font-semibold">Lien pour {link.email}, valable jusqu’au {new Date(link.expiresAt).toLocaleString('fr-FR')} :</p>
          <p className="mt-1 break-all font-mono text-[12px]">{link.url}</p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => void navigator.clipboard.writeText(link.url).then(() => toast.success('Lien copié'))}
          >
            <Copy className="size-4" aria-hidden />
            Copier
          </Button>
          <p className="mt-2">Il ne sera plus affiché : copiez-le maintenant.</p>
        </div>
      )}
    </Card>
  );
}

function Payments({ tenant, onChanged }: { tenant: PlatformTenantDetail; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanKey>(tenant.plan);
  const [months, setMonths] = useState(1);
  const [shown, setShown] = useState<Receipt | null>(null);
  const price = PLANS.find((option) => option.key === plan)!.price * months;
  const record = useMutation({
    mutationFn: (body: Parameters<typeof platformApi.recordPayment>[1]) => platformApi.recordPayment(tenant.id, body),
    onSuccess: (receipt) => {
      toast.success(`Reçu ${receipt.number} créé`);
      setShown(receipt);
      onChanged();
    },
    onError: (failure) => setError(errorMessage(failure)),
  });
  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => platformApi.cancelPayment(id, reason),
    onSuccess: () => {
      toast.success('Paiement annulé');
      onChanged();
    },
    onError: (failure) => toast.error('Annulation impossible', errorMessage(failure)),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amountMinor = Number(String(form.get('amount') ?? '').replace(/\s/g, ''));
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) return setError('Montant en F CFA, entier et positif.');
    setError(null);
    record.mutate({
      amountMinor,
      method: form.get('method') as PaymentMethod,
      reference: String(form.get('reference') ?? '').trim() || undefined,
      months,
      plan,
    });
  }

  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold text-ink">Enregistrer un paiement</h2>
      <form onSubmit={onSubmit} noValidate className="mt-3 grid gap-3 sm:grid-cols-2">
        <Select label="Formule payée" name="plan" value={plan} onChange={(event) => setPlan(event.target.value as PlanKey)}>
          {PLANS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.name} · {formatMoney(option.price, 'XOF')} / mois
            </option>
          ))}
        </Select>
        <Select label="Durée" name="months" value={String(months)} onChange={(event) => setMonths(Number(event.target.value))}>
          {[1, 3, 6, 12].map((value) => (
            <option key={value} value={value}>
              {value} mois
            </option>
          ))}
        </Select>
        <Input key={`${plan}-${months}`} label="Montant reçu (F CFA)" name="amount" inputMode="numeric" defaultValue={String(price)} />
        <Select label="Moyen" name="method" defaultValue="wave">
          {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((method) => (
            <option key={method} value={method}>
              {METHOD_LABELS[method]}
            </option>
          ))}
        </Select>
        <Input label="Référence (facultatif)" name="reference" maxLength={80} />
        <div className="flex items-end">
          <Button type="submit" loading={record.isPending} className="w-full">
            Enregistrer et créer le reçu
          </Button>
        </div>
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>

      <h3 className="mt-6 text-[14px] font-semibold text-ink">Historique</h3>
      <ul className="mt-2 flex flex-col">
        {tenant.payments.length === 0 && <li className="text-[13px] text-ink-3">Aucun paiement.</li>}
        {tenant.payments.map((payment) => (
          <li key={payment.id} className="flex flex-wrap items-center gap-2 border-b border-line py-2 text-[14px] last:border-0">
            <button type="button" onClick={() => setShown(payment)} className="font-medium text-ink underline-offset-4 hover:underline">
              N° {payment.number}
            </button>
            <span className="text-ink-2">
              {formatMoney(payment.amountMinor, 'XOF')} · {METHOD_LABELS[payment.method]} · {payment.months} mois · {payment.planName} · {dateFr(payment.createdAt)}
            </span>
            {payment.cancelledAt ? (
              <Badge tone="late">Annulé</Badge>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                loading={cancel.isPending}
                onClick={() => {
                  const reason = window.prompt(`Motif de l’annulation du reçu ${payment.number} ?`)?.trim();
                  if (reason && reason.length >= 3) cancel.mutate({ id: payment.id, reason });
                }}
              >
                Annuler
              </Button>
            )}
          </li>
        ))}
      </ul>
      {shown && (
        <Dialog open onOpenChange={(open) => !open && setShown(null)} title={`Reçu ${shown.number}`}>
          <ReceiptView receipt={shown} />
        </Dialog>
      )}
    </Card>
  );
}
