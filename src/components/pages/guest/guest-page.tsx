'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Check, CheckCircle2, Clock, CookingPot, Loader2, QrCode, RotateCw, Send, UserRound, UtensilsCrossed, WifiOff, X, XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Dialog, FormError, Textarea } from '@/components/ui';
import { requestIcon } from '@/constants/requests';
import type { GuestContext, GuestRequest, GuestRequestType } from '@/contracts';
import { cn } from '@/lib/utils';
import { guestApi } from '@/services/api/guest';
import { errorMessage, toHttpError } from '@/services/http';
import { formatMoney } from '@/utils/money';
import { formatTime } from '@/utils/time';
import { cartLines, useCart } from './cart';
import { CartBar, GuestOrderLines, MenuView, OrderScreen } from './guest-menu';
import { guestRequestsKey, upsert, useGuestRequests } from './use-guest-requests';
import { useGuestSession } from './use-guest-session';

const NOTE_MAX = 280;
const ACTIVE = ['pending', 'assigned', 'accepted', 'in_progress'];

export function GuestPage({ code }: { code: string }) {
  const { state, retry, markClosed, refresh } = useGuestSession(code);

  if (state.phase === 'loading') {
    return (
      <Screen>
        <Loader2 className="size-6 animate-spin text-ink-3" aria-hidden />
        <p className="text-sm text-ink-2">Connexion à votre table…</p>
      </Screen>
    );
  }
  if (state.phase === 'closed') {
    return (
      <Screen>
        <QrCode className="size-8 text-ink-3" aria-hidden />
        <h1 className="text-lg font-semibold text-ink">Session terminée</h1>
        <p className="max-w-xs text-sm text-ink-2">Scannez à nouveau le QR code de votre table pour faire une demande.</p>
        <Button onClick={retry} size="lg" className="mt-2">
          <RotateCw className="size-5" aria-hidden />
          Rouvrir une session
        </Button>
      </Screen>
    );
  }
  if (state.phase === 'error') {
    return (
      <Screen>
        {state.kind === 'network' ? <WifiOff className="size-8 text-ink-3" aria-hidden /> : <QrCode className="size-8 text-ink-3" aria-hidden />}
        <h1 className="text-lg font-semibold text-ink">{state.kind === 'invalid' ? 'QR code non valide' : 'Un instant…'}</h1>
        <p role="alert" className="max-w-xs text-sm text-ink-2">
          {state.message}
        </p>
        {state.kind !== 'invalid' && (
          <Button onClick={retry} size="lg" className="mt-2">
            <RotateCw className="size-5" aria-hidden />
            Réessayer
          </Button>
        )}
      </Screen>
    );
  }
  return <GuestTable token={state.token} context={state.context} onSessionClosed={markClosed} onContextStale={refresh} />;
}

function Screen({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">{children}</main>;
}

type GuestTab = 'requests' | 'menu';

interface GuestTableProps {
  token: string;
  context: GuestContext;
  onSessionClosed: () => void;
  onContextStale: () => void;
}

function GuestTable({ token, context, onSessionClosed, onContextStale }: GuestTableProps) {
  const { data: requests = [], live, isError, isPending } = useGuestRequests(token, onSessionClosed);
  const [selected, setSelected] = useState<GuestRequestType | null>(null);
  const [tab, setTab] = useState<GuestTab>('requests');
  const [cartOpen, setCartOpen] = useState(false);
  const { cart, setQuantity, clear } = useCart(token);
  const hasMenu = context.menu.length > 0;
  const currency = context.establishment.currency;
  const summary = cartLines(cart, context.menu);

  const active = useMemo(() => requests.filter((r) => ACTIVE.includes(r.status)), [requests]);
  const finished = useMemo(() => requests.filter((r) => !ACTIVE.includes(r.status)).slice(0, 3), [requests]);
  const activeTypeIds = new Set(active.map((r) => r.type.id));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-6 pb-10">
      <header>
        <p className="text-sm text-ink-2">{context.establishment.name}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">
          Table {context.table.label}
          <span className="ml-2 text-base font-normal text-ink-3">{context.table.area}</span>
        </h1>
      </header>

      {!live && !isPending && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-lg bg-wait px-3 py-2 text-[13px] text-wait-ink">
          <WifiOff className="size-3.5 shrink-0" aria-hidden />
          {isError ? 'Connexion perdue. Nouvelle tentative en cours…' : 'Mise à jour automatique toutes les 5 secondes.'}
        </p>
      )}

      {hasMenu && (
        <GuestTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'requests', label: 'Demandes', icon: Bell, count: active.length },
            { value: 'menu', label: 'Carte', icon: UtensilsCrossed, count: summary.count },
          ]}
        />
      )}

      {tab === 'menu' && hasMenu ? (
        <div className={cn('mt-6', context.orderingEnabled && summary.count > 0 && 'pb-20')}>
          <MenuView context={context} cart={cart} onQuantity={setQuantity} />
        </div>
      ) : (
        <>
      {active.length > 0 && (
        <section aria-label="Vos demandes en cours" className="mt-6 flex flex-col gap-3">
          {active.map((request) => (
            <Tracking key={request.id} request={request} token={token} currency={currency} />
          ))}
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold text-ink">{active.length > 0 ? 'Autre chose ?' : 'De quoi avez-vous besoin ?'}</h2>
        {context.requestTypes.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">Aucune demande n’est disponible pour le moment. Adressez-vous au personnel.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {context.requestTypes.map((type) => {
              const Icon = requestIcon(type.icon);
              const pending = activeTypeIds.has(type.id);
              return (
                <button
                  key={type.id}
                  type="button"
                  disabled={pending}
                  onClick={() => setSelected(type)}
                  className={cn(
                    'flex min-h-28 flex-col justify-between rounded-2xl p-4 text-left ring-1 ring-inset transition-colors',
                    pending ? 'bg-sunken text-ink-3 ring-transparent' : 'bg-surface text-ink ring-line active:bg-sunken',
                  )}
                >
                  <Icon className="size-6" aria-hidden />
                  <span className="text-[15px] leading-tight font-medium">
                    {type.label}
                    {pending && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs font-normal">
                        <Clock className="size-3.5" aria-hidden />
                        Déjà demandé
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {finished.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[13px] font-medium text-ink-3">Terminées</h2>
          <ul className="mt-2 divide-y divide-line">
            {finished.map((request) => (
              <li key={request.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink-2">
                  {request.type.label}
                  {request.totalMinor !== null && <span className="tabular text-ink-3"> · {formatMoney(request.totalMinor, currency)}</span>}
                </span>
                <span className={cn('flex items-center gap-1.5', request.status === 'resolved' ? 'text-done' : 'text-ink-3')}>
                  {request.status === 'resolved' ? <CheckCircle2 className="size-5" aria-hidden /> : <XCircle className="size-5" aria-hidden />}
                  {request.status === 'resolved' ? 'Traitée' : 'Annulée'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

        </>
      )}

      <p className={cn('mt-auto pt-10 text-center text-xs text-ink-3', tab === 'menu' && summary.count > 0 && 'pb-20')}>Service assuré avec TABILO</p>

      {context.orderingEnabled && (summary.count > 0 || summary.hasInvalid) && !cartOpen && (
        <CartBar count={summary.count} totalMinor={summary.totalMinor} currency={currency} onOpen={() => setCartOpen(true)} />
      )}
      {cartOpen && (
        <OrderScreen
          token={token}
          context={context}
          cart={cart}
          onQuantity={setQuantity}
          onClose={() => setCartOpen(false)}
          onOrdered={() => {
            clear();
            setCartOpen(false);
            setTab('requests');
          }}
          onContextStale={onContextStale}
          onSessionClosed={onSessionClosed}
        />
      )}

      {selected && <ConfirmRequest key={selected.id} type={selected} token={token} onClose={() => setSelected(null)} onSessionClosed={onSessionClosed} />}
    </main>
  );
}

/** Étapes du suivi en pictogrammes (spec 003, R4) : le même dessin partout pour le même état. */
const STEPS: { label: string; icon: LucideIcon }[] = [
  { label: 'Envoyée', icon: Send },
  { label: 'Prise en charge', icon: UserRound },
  { label: 'En cours', icon: CookingPot },
  { label: 'Terminée', icon: CheckCircle2 },
];

/** Onglets du client : grande icône d'abord, mot ensuite (spec 003). */
function GuestTabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (value: T) => void; tabs: { value: T; label: string; icon: LucideIcon; count: number }[] }) {
  return (
    <div role="tablist" aria-label="Rubriques de la page" className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-sunken p-1.5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const selected = value === tab.value;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative flex h-16 flex-col items-center justify-center gap-1 rounded-xl text-[13px] font-medium transition-colors',
              selected ? 'bg-surface text-ink shadow-sm' : 'text-ink-2',
            )}
          >
            <Icon className="size-6" strokeWidth={selected ? 2.25 : 1.75} aria-hidden />
            {tab.label}
            {tab.count > 0 && (
              <span className="tabular absolute top-1.5 right-[calc(50%-1.75rem)] grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function stepOf(request: GuestRequest): number {
  if (request.status === 'resolved') return 3;
  if (request.status === 'in_progress') return 2;
  if (request.status === 'accepted') return 1;
  return 0;
}

function Tracking({ request, token, currency }: { request: GuestRequest; token: string; currency: string }) {
  const queryClient = useQueryClient();
  const Icon = requestIcon(request.type.icon);
  const step = stepOf(request);
  const cancel = useMutation({
    mutationFn: () => guestApi.cancel(token, request.id),
    onSuccess: (updated) => queryClient.setQueryData<GuestRequest[]>(guestRequestsKey(token), (list = []) => upsert(list, updated)),
    // Trop tard pour annuler (déjà prise en charge) : on réaffiche l'état réel.
    onError: () => queryClient.invalidateQueries({ queryKey: guestRequestsKey(token) }),
  });

  const message =
    step === 0
      ? request.type.kind === 'order'
        ? 'Votre commande est bien reçue. L’équipe est prévenue.'
        : 'Votre demande est bien reçue. L’équipe est prévenue.'
      : step === 1
        ? `${request.handledBy ?? 'Un membre de l’équipe'} s’en occupe.`
        : `${request.handledBy ?? 'Un membre de l’équipe'} est en train de traiter votre demande.`;

  return (
    <article className="rounded-2xl bg-ink p-4 text-white animate-rise">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          <Icon className="size-4" aria-hidden />
          {request.type.label}
        </h3>
        <span className="tabular text-xs text-white/60">{formatTime(request.createdAt)}</span>
      </div>
      <p role="status" className="mt-2 text-sm text-white/80">
        {message}
      </p>
      {request.type.kind === 'order' && <GuestOrderLines items={request.items} totalMinor={request.totalMinor} currency={currency} />}
      <ol className="mt-4 grid grid-cols-4" aria-label="Avancement">
        {STEPS.map(({ label, icon: StepIcon }, index) => (
          <li key={label} aria-current={index === step ? 'step' : undefined} className="relative flex flex-col items-center text-center">
            {index > 0 && (
              <span aria-hidden className={cn('absolute top-[1.125rem] right-1/2 h-0.5 w-full -translate-y-1/2', index <= step ? 'bg-brand' : 'bg-white/20')} />
            )}
            <span
              className={cn(
                'relative grid size-9 place-items-center rounded-full',
                index < step ? 'bg-brand text-white' : index === step ? 'bg-brand text-white ring-4 ring-brand/30' : 'bg-[#3a3632] text-white/45',
              )}
            >
              <StepIcon className="size-[18px]" aria-hidden />
            </span>
            <span className={cn('mt-1.5 block text-[11px] leading-tight', index <= step ? 'text-white' : 'text-white/45')}>{label}</span>
          </li>
        ))}
      </ol>
      {request.status === 'pending' && (
        <button
          type="button"
          onClick={() => cancel.mutate()}
          disabled={cancel.isPending}
          className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-4 text-[13px] font-medium text-white/85 disabled:opacity-50"
        >
          <X className="size-4" aria-hidden />
          {cancel.isPending ? 'Annulation…' : 'Annuler cette demande'}
        </button>
      )}
      {cancel.isError && <p className="mt-2 text-[13px] text-white/80">{errorMessage(cancel.error)}</p>}
    </article>
  );
}

function ConfirmRequest({ type, token, onClose, onSessionClosed }: { type: GuestRequestType; token: string; onClose: () => void; onSessionClosed: () => void }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  // Une clé par intention : un double appui ou une reprise réseau ne crée qu'une demande.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const Icon = requestIcon(type.icon);

  const create = useMutation({
    mutationFn: () => guestApi.create(token, { requestTypeId: type.id, note: note.trim() || undefined }, idempotencyKey),
    onSuccess: ({ request }) => {
      queryClient.setQueryData<GuestRequest[]>(guestRequestsKey(token), (list = []) => upsert(list, request));
      onClose();
    },
    onError: (error) => {
      if (toHttpError(error).status === 401 || toHttpError(error).code === 'TABLE_SESSION_CLOSED') onSessionClosed();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !create.isPending && onClose()} title={type.label} description="Confirmez pour prévenir l’équipe.">
      <div className="flex flex-col gap-4">
        <div className="grid size-12 place-items-center rounded-xl bg-sunken text-ink">
          <Icon className="size-6" aria-hidden />
        </div>
        {type.allowNote && (
          <Textarea
            label="Une précision ? (facultatif)"
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, NOTE_MAX))}
            maxLength={NOTE_MAX}
            rows={2}
            placeholder="Ex. : sans glaçons"
            hint={note.length > NOTE_MAX - 60 ? `${NOTE_MAX - note.length} caractères restants` : undefined}
          />
        )}
        <FormError message={create.isError ? errorMessage(create.error) : null} />
        <Button size="lg" loading={create.isPending} onClick={() => create.mutate()} className="h-14 text-base">
          {!create.isPending && <Check className="size-5" strokeWidth={2.5} aria-hidden />}
          Envoyer la demande
        </Button>
      </div>
    </Dialog>
  );
}
