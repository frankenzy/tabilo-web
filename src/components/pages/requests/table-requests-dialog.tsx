'use client';

import { useFeature } from '@/hooks/use-account';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Clock, Coffee, Footprints, Gift, HandCoins, MessageCircle, Pencil, Phone, Power, QrCode, Receipt, Smartphone, Timer, X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button, ConfirmDialog } from '@/components/ui';
import { SessionMarker } from '@/components/ui/session-marker';
import { SlideToConfirm } from '@/components/ui/slide-to-confirm';
import { occupiedFor, orderStateLabel, orderSummary, tableLook, tableSize, TONE_BADGE, TONE_PLATE, TONE_TINT } from '@/components/pages/tables/tables-logic';
import type { OccupationOrder, OccupationSession, ServiceRequest, TableStatus } from '@/contracts';
import { markerInfo } from '@/contracts/session-markers';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/utils';
import { PrecisionBanner, PrecisionFlags } from './precisions';
import { clientSlide, freeGesture, tableSheet, type ServerGroup } from './table-bill';
import { floorApi, loyaltyApi, menuImageUrl, requestsApi } from '@/services/api';
import { errorMessage, toHttpError } from '@/services/http';
import { useAuthStore, useMembership } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import { formatMoney } from '@/utils/money';
import { formatClock, formatTime, secondsSince } from '@/utils/time';

interface Props {
  table: { id: string; label: string; seats: number };
  /** Zone de la table, rappelée sous le titre. */
  areaName?: string;
  /** Spec 006, R2 : occupée (session ouverte ou demande en cours) ou libre. */
  status: TableStatus;
  requests: ServiceRequest[];
  canClose: boolean;
  /** Spec 026, R4 : régler la table (droit `requests.handle`). */
  canSettle?: boolean;
  onClose: () => void;
  /** Rendu d'une demande (carte avec ses actions), fourni par la page appelante. */
  children: (request: ServiceRequest) => ReactNode;
  /** Spec 020, R6 : configuration de la table, en retrait (selon les droits ; absent = pas de bouton). */
  onQr?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Fiche d'une table (spec 020) : identité et état, chiffres clés, demandes en cours, commandes de l'occupation,
 * fermeture des sessions, puis configuration en retrait.
 * Partagée par le plan de salle du tableau de bord et la vue « Tables » (spec 006, R9 ; spec 020, R8).
 */
export function TableRequestsDialog({ table, areaName, status, requests, canClose, canSettle = false, onClose, children, onQr, onEdit, onDelete }: Props) {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const now = useNow();
  const occupation = useQuery({
    queryKey: estKey(establishmentId, 'table-occupation', table.id),
    queryFn: () => floorApi.occupation(establishmentId, table.id),
    refetchInterval: 15_000,
  });
  // Une demande qui arrive ou change d'état : les chiffres et les commandes suivent aussitôt (spec 006, R7).
  const signature = requests.map((request) => `${request.id}:${request.status}`).join(',');
  // Spec 028, R10 : l'addition en tête de fiche ; après un règlement, la carte verte « Réglé » jusqu'à la fermeture.
  const [settled, setSettled] = useState<Settled | null>(null);
  const sheet = tableSheet(requests, settled !== null);
  const refetch = occupation.refetch;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void refetch();
  }, [signature, refetch]);

  const [confirmFree, setConfirmFree] = useState(false);
  const close = useMutation({
    mutationFn: () => floorApi.closeSessions(establishmentId, table.id),
    onSuccess: ({ closed }) => {
      setConfirmFree(false);
      setSettled(null);
      toast.success(closed > 0 ? `Table ${table.label} libérée` : 'Aucun téléphone connecté');
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'floor') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'tables-overview') });
      void refetch();
    },
    onError: (error) => toast.error('Libération impossible', errorMessage(error)),
  });
  // Spec 026, R4 : régler toutes les commandes servies non réglées de l'occupation.
  const settle = useMutation({
    mutationFn: () => requestsApi.settleTable(establishmentId, table.id),
    onSuccess: ({ amountMinor }) => {
      setSettled({ amountMinor, marker: null, at: new Date().toISOString() });
      toast.success(`Table ${table.label} réglée`, formatMoney(amountMinor, currency));
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'requests') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'tables-overview') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'today') });
      void refetch();
    },
    onError: (error) => {
      toast.error('Règlement impossible', errorMessage(error));
      void refetch();
    },
  });

  // Spec 027, R3 : régler un client de la table.
  const settleClient = useMutation({
    mutationFn: (session: OccupationSession) => requestsApi.settleSession(establishmentId, session.id),
    onSuccess: ({ amountMinor }, session) => {
      setSettled({ amountMinor, marker: session.marker, at: new Date().toISOString() });
      toast.success(`Client ${markerInfo(session.marker).name} réglé`, formatMoney(amountMinor, currency));
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'requests') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'tables-overview') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'today') });
      void refetch();
    },
    onError: (error) => {
      toast.error('Règlement impossible', errorMessage(error));
      void refetch();
    },
  });

  // Spec 028, R10 : « Glisser pour régler » de la carte d'addition règle le client qui l'a demandée.
  const settleBill = useMutation({
    mutationFn: (request: ServiceRequest) => requestsApi.act(establishmentId, request.id, 'settle-bill'),
    onSuccess: (_, request) => {
      setSettled({ amountMinor: request.bill?.dueMinor ?? 0, marker: request.marker ?? null, at: new Date().toISOString() });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'requests') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'tables-overview') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'today') });
      void refetch();
    },
    onError: (error) => {
      // CA-028-09 : déjà réglé ailleurs, rien de bloquant.
      if (toHttpError(error).code !== 'NOTHING_TO_SETTLE') toast.error('Règlement impossible', errorMessage(error));
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'requests') });
      void refetch();
    },
  });

  // Spec 029, R7 : « J'y vais » prend l'appel ou les messages du client, « Fait » les termine.
  const meId = useAuthStore((state) => state.me?.id ?? null);
  const serve = useMutation({
    mutationFn: async (group: ServerGroup) => {
      const waiting = group.requests.filter((request) => ['pending', 'assigned', 'accepted'].includes(request.status));
      if (waiting.length > 0) await Promise.all(waiting.map((request) => requestsApi.act(establishmentId, request.id, 'prepare')));
      else await Promise.all(group.requests.map((request) => requestsApi.act(establishmentId, request.id, 'resolve')));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'requests') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'live') });
    },
    onError: (error) => toast.error('Action impossible', errorMessage(error)),
  });

  const data = occupation.data;
  const currency = data?.currency ?? 'XOF';
  // Spec 027, R3 : les clients qui ont commandé, avec leur repère ; leurs commandes portent le même repère.
  const sessions = (data?.sessions ?? []).filter((session) => data?.orders.some((order) => order.sessionId === session.id));
  const markers = new Map((data?.sessions ?? []).map((session) => [session.id, session.marker]));
  const owing = sessions.filter((session) => session.unpaidMinor > 0);
  const unpaid = data?.unpaidMinor ?? 0;
  // R5 : libérer avec un reste demande confirmation.
  const free = () => (unpaid > 0 ? setConfirmFree(true) : close.mutate());
  const occupied = status === 'occupied' || (data?.occupiedSince ?? null) !== null;
  // Spec 023, R3 : une commande de l'occupation déjà servie.
  const look = tableLook(status, requests, now, (data?.orders ?? []).some((order) => order.status === 'resolved'), (data?.unpaidMinor ?? 0) > 0);
  const tint = TONE_TINT[look.tone];
  const details = [areaName, tableSize(table.seats), `${table.seats} couvert${table.seats > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
  // Cascade d'entrée (R7) : chaque bloc arrive 40 ms après le précédent.
  let step = 0;
  const next = () => ({ '--i': step++ }) as CSSProperties;

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 animate-fade-in bg-ink/40 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] animate-slide-in-right flex-col bg-surface shadow-pop focus:outline-none"
        >
          {/* R1 : bandeau teinté de la couleur de l'état ; la teinte change en fondu. */}
          <header
            className="relative shrink-0 px-6 pt-6 pb-5 transition-[background] duration-700 ease-apple"
            style={{ background: `linear-gradient(to bottom, color-mix(in srgb, ${tint} 16%, var(--color-surface)), var(--color-surface))` }}
          >
            <DialogPrimitive.Close
              className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-surface/70 text-ink-2 ring-1 ring-line/70 backdrop-blur transition-transform duration-200 ease-apple hover:text-ink active:scale-90"
              aria-label="Fermer"
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
            <div className="stagger flex animate-item-in items-center gap-4 pr-10" style={next()}>
              <div
                className={cn(
                  'grid size-16 shrink-0 place-items-center rounded-2xl font-mono text-xl font-semibold shadow-sm ring-1 ring-black/5 transition-colors duration-700',
                  TONE_PLATE[look.tone],
                )}
                aria-hidden
              >
                <span className="max-w-14 truncate">{table.label}</span>
              </div>
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="truncate text-[22px] leading-tight font-semibold tracking-tight text-ink">Table {table.label}</DialogPrimitive.Title>
                <p className="mt-1 truncate text-[13px] text-ink-2">{details}</p>
              </div>
            </div>
            <div className="stagger mt-4 flex animate-item-in items-center gap-2" style={next()}>
              <span
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold transition-colors duration-700',
                  TONE_BADGE[look.tone],
                  (look.tone === 'late' || look.escalated) && 'animate-attention',
                )}
              >
                <span className="size-1.5 rounded-full bg-current" aria-hidden />
                {look.label}
                {look.oldestCreatedAt && <span className="tabular font-mono text-[12px] font-medium opacity-80">{formatClock(secondsSince(look.oldestCreatedAt, now))}</span>}
              </span>
              {look.escalated && <span className="text-[12px] font-medium text-late">Escaladée</span>}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-1 pb-6">
            {/* R2 : chiffres clés. */}
            <div className="stagger animate-item-in" style={next()}>
              {sheet.compact ? (
                <div className="flex flex-col gap-4">
                  {/* R10 : les chiffres en pastilles. */}
                  <ul className="flex flex-wrap gap-2" aria-label="Chiffres de la table">
                    {data?.occupiedSince && (
                      <Chip icon={<Timer className="size-3.5" aria-hidden />}>Ouverte depuis {formatTime(data.occupiedSince)}</Chip>
                    )}
                    {data && (
                      <Chip icon={<Smartphone className="size-3.5" aria-hidden />}>
                        {data.openSessions} téléphone{data.openSessions > 1 ? 's' : ''}
                      </Chip>
                    )}
                    {owing.length > 1 && <Chip icon={<HandCoins className="size-3.5" aria-hidden />}>Table · {formatMoney(unpaid, currency)} à régler</Chip>}
                  </ul>
                  {sheet.calls.map((group) => (
                    <ServerCard
                      key={group.key}
                      group={group}
                      now={now}
                      meId={meId}
                      canHandle={canSettle}
                      busy={serve.isPending && serve.variables?.key === group.key}
                      onSlide={() => serve.mutate(group)}
                    />
                  ))}
                  {settled && <SettledCard settled={settled} currency={currency} />}
                  {sheet.bills.map((request) => (
                    <BillCard
                      key={request.id}
                      request={request}
                      currency={currency}
                      now={now}
                      canSettle={canSettle}
                      busy={settleBill.isPending && settleBill.variables?.id === request.id}
                      onSettle={() => settleBill.mutate(request)}
                    />
                  ))}
                </div>
              ) : occupied ? (
                <dl className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  <Tile
                    icon={<Receipt className="size-4" aria-hidden />}
                    value={data?.amountMinor ?? null}
                    format={(value) => formatMoney(value, currency)}
                    label="commandés"
                    accent
                  />
                  {/* Spec 026, R4 : servi et pas encore réglé. */}
                  <Tile
                    icon={<HandCoins className="size-4" aria-hidden />}
                    value={data ? unpaid : null}
                    format={(value) => formatMoney(value, currency)}
                    label="à régler"
                    alert={unpaid > 0}
                  />
                  <Tile
                    icon={<Timer className="size-4" aria-hidden />}
                    text={data?.occupiedSince ? occupiedFor(data.occupiedSince, now) : '—'}
                    label={data?.occupiedSince ? `depuis ${formatTime(data.occupiedSince)}` : 'occupée'}
                  />
                  <Tile
                    icon={<Smartphone className="size-4" aria-hidden />}
                    value={data ? data.openSessions : null}
                    format={(value) => String(value)}
                    label={`téléphone${(data?.openSessions ?? 0) > 1 ? 's' : ''} connecté${(data?.openSessions ?? 0) > 1 ? 's' : ''}`}
                  />
                </dl>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl bg-done-soft px-4 py-3.5 text-done">
                  <span className="grid size-10 place-items-center rounded-full bg-surface/70" aria-hidden>
                    <Coffee className="size-5" />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold">Libre</p>
                    <p className="text-[12px] opacity-80">
                      {data?.lastOccupiedAt ? `Dernière occupation terminée à ${formatTime(data.lastOccupiedAt)}` : 'Prête à accueillir des clients'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* R3 : en cours. */}
            {/* Spec 028, R10 : sans autre demande, « En cours » s'efface derrière la carte d'addition. */}
            {!(sheet.compact && sheet.others.length === 0) && (
              <section aria-labelledby="table-active-title" className="stagger mt-7 animate-item-in" style={next()}>
                <SectionTitle id="table-active-title" count={sheet.others.length}>
                  En cours
                </SectionTitle>
                {sheet.others.length === 0 ? (
                  <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-6 text-center">
                    <span className="grid size-11 place-items-center rounded-full bg-sunken text-ink-3" aria-hidden>
                      <Coffee className="size-5" />
                    </span>
                    <p className="text-[14px] font-medium text-ink">Tout est calme à cette table</p>
                    <p className="text-[12px] text-ink-3">Les demandes et commandes apparaîtront ici en direct.</p>
                  </div>
                ) : (
                  <ul className="mt-3 flex flex-col gap-3">
                    {sheet.others.map((request) => (
                      <li key={request.id} className="animate-item-in">
                        {children(request)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* R4 : commandes de l'occupation. */}
            {/* Spec 043, R4 : récompense de fidélité demandée à cette table, à valider. */}
            <LoyaltyRewards tableId={table.id} onValidated={() => void refetch()} />
            {occupied && data && data.orders.length > 0 && (
              <section aria-labelledby="table-orders-title" className="stagger mt-7 animate-item-in" style={next()}>
                <div className="flex items-baseline justify-between gap-2">
                  <SectionTitle id="table-orders-title" count={data.orders.length}>
                    Commandes de la table
                  </SectionTitle>
                  {data.amountMinor !== null && <span className="tabular text-[15px] font-semibold text-brand">{formatMoney(data.amountMinor, currency)}</span>}
                </div>
                <ul className="mt-2 flex flex-col">
                  {data.orders.map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      currency={currency}
                      marker={order.sessionId ? markers.get(order.sessionId) : undefined}
                      onChanged={() => {
                        void refetch();
                        void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'requests') });
                      }}
                    />
                  ))}
                </ul>
              </section>
            )}

            {/* Spec 027, R3 : chaque client règle sa part. */}
            {occupied && sessions.length > 0 && (
              <section aria-labelledby="table-clients-title" className="stagger mt-7 animate-item-in" style={next()}>
                <SectionTitle id="table-clients-title" count={sessions.length}>
                  Clients
                </SectionTitle>
                <ul className="mt-2 flex flex-col gap-2">
                  {sessions.map((session) => (
                    <ClientRow
                      key={session.id}
                      session={session}
                      currency={currency}
                      slide={clientSlide(session, sheet.billMarkers, canSettle)}
                      billAsked={sheet.billMarkers.has(session.marker)}
                      busy={settleClient.isPending && settleClient.variables?.id === session.id}
                      onSettle={() => settleClient.mutate(session)}
                    />
                  ))}
                </ul>
              </section>
            )}

            {/* Spec 026, R4 : régler toute la table à l'addition — utile quand plusieurs clients doivent encore. */}
            {canSettle && occupied && unpaid > 0 && owing.length !== 1 && (
              <div className="stagger mt-7 animate-item-in rounded-2xl bg-sunken/70 p-4" style={next()}>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-white shadow-sm" aria-hidden>
                    <HandCoins className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-ink">Régler la table</p>
                    <p className="mt-0.5 text-[13px] text-ink-2">Toutes les commandes servies et non réglées, de tous les clients.</p>
                  </div>
                </div>
                <SlideToConfirm
                  className="mt-3"
                  size="md"
                  tone="ink"
                  label={`Glisser pour régler · ${formatMoney(unpaid, currency)}`}
                  ariaLabel={`Régler la table ${table.label}, ${formatMoney(unpaid, currency)}`}
                  busyLabel="Règlement…"
                  busy={settle.isPending}
                  onConfirm={() => settle.mutate()}
                />
              </div>
            )}

            {/* R5 : action de service. */}
            {canClose && occupied && freeGesture(data !== undefined, unpaid) === 'slide' && (
              <div className="stagger mt-7 animate-item-in rounded-2xl bg-sunken/70 p-4" style={next()}>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-sm" aria-hidden>
                    <Power className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-ink">Plus rien à régler</p>
                    <p className="mt-0.5 text-[13px] text-ink-2">Les clients sont partis ? Leurs téléphones ne pourront plus envoyer de demande.</p>
                  </div>
                </div>
                <SlideToConfirm
                  className="mt-3"
                  size="md"
                  tone="ink"
                  label="Glisser pour libérer la table"
                  ariaLabel={`Libérer la table ${table.label}`}
                  busyLabel="Libération…"
                  busy={close.isPending}
                  onConfirm={() => close.mutate()}
                />
              </div>
            )}
            {canClose && occupied && freeGesture(data !== undefined, unpaid) === 'button' && (
              <div className="stagger mt-7 flex animate-item-in items-start gap-3 rounded-2xl bg-sunken/70 p-4" style={next()}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-sm" aria-hidden>
                  <Power className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-ink">Les clients sont partis ?</p>
                  <p className="mt-0.5 text-[13px] text-ink-2">Libérez la table : leurs téléphones ne pourront plus envoyer de demande, et la table redevient libre.</p>
                  <Button variant="secondary" size="sm" className="mt-3" loading={close.isPending && !confirmFree} onClick={free}>
                    Libérer la table
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* R6 : configuration en retrait. */}
          {(onQr || onEdit || onDelete) && (
            <footer className="flex shrink-0 items-center gap-2 border-t border-line bg-surface px-6 py-3.5">
              {onQr && (
                <Button variant="secondary" size="sm" onClick={onQr}>
                  <QrCode className="size-4" aria-hidden />
                  QR code
                </Button>
              )}
              {onEdit && (
                <Button variant="secondary" size="sm" onClick={onEdit}>
                  <Pencil className="size-4" aria-hidden />
                  Modifier
                </Button>
              )}
              {onDelete && (
                <button type="button" onClick={onDelete} className="ml-auto rounded-lg px-2 py-1.5 text-[13px] font-medium text-late transition-colors hover:bg-late-soft">
                  Supprimer…
                </button>
              )}
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
      {/* Spec 026, R5 : il reste à régler. */}
      <ConfirmDialog
        open={confirmFree}
        onOpenChange={setConfirmFree}
        title={`Libérer la table ${table.label} ?`}
        description={`${formatMoney(unpaid, currency)} ne sont pas réglés. Libérer quand même ? Ils resteront dans « Reste à encaisser ».`}
        confirmLabel="Libérer quand même"
        danger
        loading={close.isPending}
        onConfirm={() => close.mutate()}
      />
    </DialogPrimitive.Root>
  );
}

interface Settled {
  amountMinor: number;
  marker: number | null;
  at: string;
}

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="tabular inline-flex h-8 items-center gap-1.5 rounded-full bg-sunken px-3 text-[13px] text-ink-2">
      {icon}
      {children}
    </li>
  );
}

/** Spec 028, R10 : la carte d'addition — qui, depuis quand, combien, et le geste pour régler. */
function BillCard({
  request, currency, now, canSettle, busy, onSettle,
}: { request: ServiceRequest; currency: string; now: number; canSettle: boolean; busy: boolean; onSettle: () => void }) {
  const bill = request.bill ?? { dueMinor: 0, pendingOrders: 0 };
  const marker = request.marker ?? null;
  const name = marker === null ? null : markerInfo(marker).name;
  const amount = formatMoney(bill.dueMinor, currency);
  return (
    <section
      aria-label={`Addition demandée${name ? ` par ${name}` : ''}, ${amount}`}
      className="animate-item-in rounded-3xl bg-pay-soft p-5 shadow-[0_14px_32px_-20px_rgb(14_116_144/0.6)] ring-1 ring-pay/15"
    >
      <div className="flex items-center gap-3">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-pay text-white" aria-hidden>
          <span className="absolute inset-0 rounded-full bg-pay opacity-40 motion-safe:animate-ping" />
          <Receipt className="relative size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] leading-tight font-semibold text-ink">Addition demandée</p>
          <p className="tabular mt-0.5 text-[13px] text-pay">
            {formatTime(request.createdAt)} · <span className="font-mono">{formatClock(secondsSince(request.createdAt, now))}</span>
          </p>
        </div>
        {marker !== null && (
          <span className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-surface pr-3 pl-1.5 shadow-sm">
            <SessionMarker index={marker} size="sm" decorative />
            <span className="max-w-24 truncate text-[13px] font-semibold text-ink capitalize">{name}</span>
          </span>
        )}
      </div>
      <p className="tabular mt-5 text-[38px] leading-none font-bold tracking-tight text-ink">{amount}</p>
      <p className="mt-2.5 flex items-center gap-1.5 text-[14px] text-ink-2">
        {bill.pendingOrders > 0 ? (
          <>
            <Clock className="size-4 text-progress" aria-hidden />
            {bill.pendingOrders} commande{bill.pendingOrders > 1 ? 's' : ''} pas encore servie{bill.pendingOrders > 1 ? 's' : ''}
          </>
        ) : (
          <>
            <Check className="size-4 text-done" strokeWidth={2.6} aria-hidden />
            Tout est servi
          </>
        )}
      </p>
      {canSettle && bill.dueMinor > 0 && (
        <SlideToConfirm
          className="mt-5"
          size="lg"
          tone="ink"
          label="Glisser pour régler"
          ariaLabel={`Régler ${name ?? 'le client'}, ${amount}`}
          busyLabel="Règlement…"
          busy={busy}
          onConfirm={onSettle}
        />
      )}
    </section>
  );
}

/** Spec 029, R7 : un appel (orange, téléphone animé) ou les messages d'un client (bleu, texte en grand). */
function ServerCard({
  group, now, meId, canHandle, busy, onSlide,
}: { group: ServerGroup; now: number; meId: string | null; canHandle: boolean; busy: boolean; onSlide: () => void }) {
  const call = group.kind === 'call';
  const first = group.requests[0];
  const name = group.marker === null ? null : markerInfo(group.marker).name;
  const taker = group.requests.find((request) => request.assignee)?.assignee ?? null;
  const mineToFinish = !group.waiting && taker?.id === meId;
  const notes = group.requests.flatMap((request) => (request.note ? [request.note] : []));
  const title = call ? 'Appel du serveur' : notes.length > 1 ? 'Messages' : 'Message';
  return (
    <section
      aria-label={`${title}${name ? `, ${name}` : ''}`}
      className={cn(
        'animate-item-in rounded-3xl p-5 ring-1',
        call ? 'bg-call-soft shadow-[0_14px_32px_-20px_rgb(194_65_12/0.6)] ring-call/25' : 'bg-message-soft shadow-[0_14px_32px_-20px_rgb(59_63_184/0.6)] ring-message/15',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="relative grid size-12 shrink-0 place-items-center" aria-hidden>
          {group.waiting && <span className={cn('absolute inset-0 rounded-full motion-safe:animate-call-wave', call ? 'bg-call' : 'bg-message')} />}
          <span className={cn('relative grid size-12 place-items-center rounded-full', call ? 'bg-call text-ink' : 'bg-message text-white')}>
            {call ? <Phone className={cn('size-6', group.waiting && 'motion-safe:animate-call-ring')} /> : <MessageCircle className="size-6" />}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] leading-tight font-semibold text-ink">{title}</p>
          <p className={cn('tabular mt-0.5 text-[13px]', call ? 'text-call-ink' : 'text-message')}>
            {formatTime(first.createdAt)} · <span className="font-mono">{formatClock(secondsSince(first.createdAt, now))}</span>
          </p>
        </div>
        {group.marker !== null && (
          <span className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-surface pr-3 pl-1.5 shadow-sm">
            <SessionMarker index={group.marker} size="sm" decorative />
            <span className="max-w-24 truncate text-[13px] font-semibold text-ink capitalize">{name}</span>
          </span>
        )}
      </div>
      {notes.length > 0 && (
        <ul className="mt-4 flex flex-col items-start gap-2">
          {notes.map((note, index) => (
            <li
              key={`${index}-${note}`}
              className={cn('rounded-[22px] rounded-tl-md bg-surface px-4 py-3 leading-snug text-ink', index === 0 ? 'text-[19px] font-semibold tracking-tight' : 'text-[15px] font-medium')}
            >
              {note}
            </li>
          ))}
        </ul>
      )}
      {!group.waiting && taker && (
        <p className="mt-4 flex items-center gap-2 text-[14px] font-medium text-ink-2">
          <Footprints className="size-4 text-done" aria-hidden />
          {taker.id === meId ? 'Vous y allez' : `${taker.firstName} y va`}
        </p>
      )}
      {canHandle && (group.waiting || mineToFinish) && (
        <SlideToConfirm
          className="mt-4"
          size="lg"
          tone={group.waiting ? 'ink' : 'done'}
          label={group.waiting ? 'Glisser · J’y vais' : 'Glisser · Fait'}
          ariaLabel={group.waiting ? `J’y vais, ${title}` : `Fait, ${title}`}
          busyLabel={group.waiting ? 'C’est noté…' : 'Terminé…'}
          busy={busy}
          onConfirm={onSlide}
        />
      )}
    </section>
  );
}

/** Spec 028, R10 : le règlement vient d'avoir lieu. */
function SettledCard({ settled, currency }: { settled: Settled; currency: string }) {
  return (
    <section aria-label={`Réglé, ${formatMoney(settled.amountMinor, currency)}`} className="flex animate-pop-in flex-col items-center gap-2 rounded-3xl bg-done-soft px-5 py-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-done text-white" aria-hidden>
        <Check className="size-7" strokeWidth={2.6} />
      </span>
      <p className="text-[17px] font-semibold text-done">Réglé</p>
      <p className="tabular text-[30px] leading-none font-bold tracking-tight text-ink">{formatMoney(settled.amountMinor, currency)}</p>
      <p className="flex items-center gap-1.5 text-[13px] text-ink-2">
        {settled.marker !== null && <SessionMarker index={settled.marker} size="xs" decorative />}
        {settled.marker !== null && <span className="capitalize">{markerInfo(settled.marker).name} ·</span>}
        <span className="tabular">{formatTime(settled.at)}</span>
      </p>
    </section>
  );
}

function SectionTitle({ id, count, children }: { id: string; count: number; children: ReactNode }) {
  return (
    <h3 id={id} className="flex items-center gap-2 text-[15px] font-semibold text-ink">
      {children}
      {count > 0 && (
        <span key={count} className="tabular grid h-5 min-w-5 animate-pop-in place-items-center rounded-full bg-ink px-1.5 text-[11px] font-bold text-white">
          {count}
        </span>
      )}
    </h3>
  );
}

/** R2 : une tuile — pictogramme, chiffre en grand (compté à l'ouverture), libellé court. */
function Tile({
  icon, value, format, text, label, accent = false, alert = false,
}: { icon: ReactNode; value?: number | null; format?: (value: number) => string; text?: string; label: string; accent?: boolean; alert?: boolean }) {
  const counted = useCountUp(value ?? null);
  const shown = text ?? (value === null || value === undefined || counted === null ? '—' : format ? format(counted) : String(counted));
  return (
    <div className={cn('flex min-w-0 flex-col gap-2 rounded-2xl p-3 ring-1', accent ? 'bg-brand-soft/70 ring-brand/15' : 'bg-surface ring-line')}>
      <span className={cn('grid size-7 place-items-center rounded-full', accent ? 'bg-brand text-white' : 'bg-sunken text-ink-2')} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <dd className={cn('tabular truncate text-[17px] leading-tight font-semibold tracking-tight sm:text-[19px]', accent ? 'text-brand-strong' : alert ? 'text-late' : 'text-ink')}>{shown}</dd>
        <dt className="mt-0.5 line-clamp-2 text-[12px] leading-tight text-ink-3">{label}</dt>
      </div>
    </div>
  );
}

/** R2 : le chiffre monte jusqu'à sa valeur (environ 600 ms), puis suit les changements ; immédiat si moins d'animations. */
function useCountUp(target: number | null, duration = 600): number | null {
  const [value, setValue] = useState<number | null>(null);
  const from = useRef(0);
  useEffect(() => {
    if (target === null) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = from.current;
    if (reduce || start === target) {
      from.current = target;
      setValue(target);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (time: number) => {
      const progress = Math.min(1, (time - began) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (target - start) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = target;
    };
  }, [target, duration]);
  return value;
}

/** Spec 027, R3 : un client de la table — repère, ce qu'il doit, et son geste « Glisser pour régler ». */
function ClientRow({
  session,
  currency,
  slide,
  billAsked,
  busy,
  onSettle,
}: {
  session: OccupationSession;
  currency: string;
  /** Spec 028, R10 : sa barre, sauf s'il se règle depuis la carte d'addition. */
  slide: boolean;
  /** Spec 028, R5 : ce client a demandé l'addition (même geste que la carte « Demande d'addition »). */
  billAsked: boolean;
  busy: boolean;
  onSettle: () => void;
}) {
  const name = markerInfo(session.marker).name;
  const owes = session.unpaidMinor > 0;
  return (
    <li className="rounded-2xl bg-sunken/60 p-3">
      <div className="flex items-center gap-3">
        <SessionMarker index={session.marker} size="md" decorative />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-ink capitalize">{name}</span>
          <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
            {owes ? 'À régler' : session.status === 'settled' ? 'Réglé' : 'Rien à régler'}
            {billAsked && owes && (
              <span className="inline-flex items-center gap-1 rounded-full bg-pay px-1.5 py-px text-[11px] font-semibold text-white">
                <Receipt className="size-3" aria-hidden />
                Addition demandée
              </span>
            )}
          </span>
        </span>
        <span className={cn('tabular shrink-0 text-[15px] font-semibold', owes ? 'text-pay' : 'text-ink-3')}>{formatMoney(session.unpaidMinor, currency)}</span>
      </div>
      {slide && (
        <SlideToConfirm
          className="mt-3"
          size="md"
          tone="ink"
          label={`Glisser pour régler · ${formatMoney(session.unpaidMinor, currency)}`}
          ariaLabel={`Régler le client ${name}, ${formatMoney(session.unpaidMinor, currency)}`}
          busyLabel="Règlement…"
          busy={busy}
          onConfirm={onSettle}
        />
      )}
    </li>
  );
}

/**
 * Spec 043, R4 : la récompense devient une commande offerte, validée d'un toucher par un serveur.
 * Spec 046, R10 : un cadeau surprise demandé — « Valider » (plat offert) ou « Remis » (lot libre).
 */
function LoyaltyRewards({ tableId, onValidated }: { tableId: string; onValidated: () => void }) {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const permissions = useMembership()?.permissions ?? [];
  const key = estKey(establishmentId, 'loyalty', 'pending');
  const pending = useQuery({ queryKey: key, queryFn: () => loyaltyApi.pending(establishmentId), refetchInterval: 15_000, enabled: permissions.includes('requests.read') });
  const validate = useMutation({
    mutationFn: ({ id, gift }: { id: string; gift: boolean }) => (gift ? loyaltyApi.validateGift(establishmentId, id) : loyaltyApi.validate(establishmentId, id)),
    onSuccess: (_, { gift }) => {
      toast.success(gift ? 'Cadeau remis' : 'Récompense offerte');
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'requests') });
      onValidated();
    },
    onError: (error) => toast.error('Validation impossible', errorMessage(error)),
  });
  const rewards = (pending.data ?? []).filter((reward) => reward.tableId === tableId);
  if (rewards.length === 0) return null;
  return (
    <ul className="mt-5 flex flex-col gap-2">
      {rewards.map((reward) => {
        const gift = reward.kind === 'gift';
        const free = gift && reward.prizeKind === 'free';
        return (
          <li key={reward.id} className="flex items-center gap-3 rounded-2xl bg-brand-soft p-3 ring-1 ring-brand">
            <span className="relative shrink-0">
              {reward.reward?.imageId ? (
                <Thumb imageId={reward.reward.imageId} name={reward.reward.name} />
              ) : (
                <span className="grid size-10 place-items-center rounded-full bg-brand text-white" aria-hidden>
                  <Gift className="size-5" />
                </span>
              )}
              {reward.reward?.imageId && (
                <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-brand text-white ring-2 ring-surface" aria-hidden>
                  <Gift className="size-3" />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1 text-[14px]">
              <span className="block font-semibold text-ink">{gift ? 'Cadeau surprise' : 'Carte de fidélité pleine'}</span>
              <span className="block truncate text-ink-2">
                {reward.reward?.name ?? 'Récompense'}
                {free ? ' à remettre' : ' offert'}
              </span>
            </span>
            {permissions.includes('requests.handle') && (
              <Button size="sm" loading={validate.isPending && validate.variables?.id === reward.id} onClick={() => validate.mutate({ id: reward.id, gift })}>
                {free ? 'Remis' : 'Valider'}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** R4 : une commande — vignettes, plats et articles, heure, état, montant ; le détail se déplie. */
function OrderRow({ order, currency, marker, onChanged }: { order: OccupationOrder; currency: string; marker?: number; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const establishmentId = useEstablishmentId();
  // Spec 033, R4 et R6 : offrir une ligne d'une commande non réglée, avec la permission « orders.offer ».
  // Spec 034, R4 : « Offert » fait partie des promotions de la formule.
  const promotions = useFeature('promotions');
  const permissions = useMembership()?.permissions ?? [];
  const canOffer = promotions && permissions.includes('orders.offer') && !order.paidAt && !order.writtenOffAt && order.status !== 'cancelled';
  const offer = useMutation({
    mutationFn: ({ itemId, offered }: { itemId: string; offered: boolean }) => requestsApi.offerLine(establishmentId, order.id, itemId, offered),
    onSuccess: (_, { offered }) => {
      toast.success(offered ? 'Ligne offerte' : 'Cadeau retiré');
      onChanged();
    },
    onError: (error) => toast.error('Action impossible', errorMessage(error)),
  });
  const { dishes, articles } = orderSummary(order.items);
  const state = orderStateLabel(order.status);
  const cancelled = state.tone === 'cancelled';
  const photos = order.items.slice(0, 2);
  return (
    <li className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn('flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left transition-colors hover:bg-sunken/50', cancelled && 'opacity-55')}
      >
        <span className="flex shrink-0 items-center" aria-hidden>
          {photos.map((item, index) => (
            <span key={item.menuItemId} className={cn('rounded-full ring-2 ring-surface', index > 0 && '-ml-3')} style={{ zIndex: 2 - index }}>
              <Thumb imageId={item.imageId} name={item.name} />
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[14px] font-medium text-ink">
            <span className="truncate">
              {dishes} plat{dishes > 1 ? 's' : ''} <span className="font-normal text-ink-3">· ×{articles}</span>
            </span>
            {/* Spec 022, R5 : la commande porte une précision. */}
            <PrecisionFlags notes={[order.note]} size="sm" />
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            {/* Spec 027, R3 : le client qui a commandé. */}
            {marker !== undefined && <SessionMarker index={marker} size="xs" />}
            <span className="tabular text-[12px] text-ink-3">{formatTime(order.createdAt)}</span>
            <StatePill state={state} />
            {/* Spec 026, R4 : une commande servie est réglée ou à régler ; spec 027, R9 : ou partie sans payer. */}
            {/* Spec 030 : réglée avant d'être servie (« Régler quand on veut », « Caisse d'abord »). */}
            {order.status !== 'resolved' && order.paidAt && <span className="rounded-full bg-done-soft px-1.5 py-px text-[11px] font-semibold text-done">Réglée</span>}
            {order.status === 'resolved' && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[11px] font-semibold',
                  order.writtenOffAt ? 'bg-late-soft text-late' : order.paidAt ? 'bg-done-soft text-done' : 'bg-pay text-white',
                )}
              >
                {order.writtenOffAt ? 'Impayée' : order.paidAt ? 'Réglée' : 'À régler'}
              </span>
            )}
          </span>
        </span>
        <span className={cn('tabular shrink-0 text-right text-[14px] font-semibold', cancelled ? 'text-ink-3 line-through' : 'text-ink')}>
          {formatMoney(order.totalMinor, currency)}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-ink-3 transition-transform duration-300 ease-apple', open && 'rotate-180')} aria-hidden />
      </button>
      <div inert={!open} className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-apple', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="min-h-0 overflow-hidden">
          <PrecisionBanner note={order.note} className="mb-2" />
          <ul className="mb-3 flex flex-col rounded-xl bg-sunken/60 px-3">
            {order.items.map((item, index) => (
              <li key={`${item.menuItemId}-${index}`} className="flex min-h-11 items-center gap-3 border-b border-line py-1 last:border-0">
                <Thumb imageId={item.imageId} name={item.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{item.name}</span>
                  {/* Spec 032 : les choix de la formule. */}
                  {((item.choices?.length ?? 0) > 0 || (item.options?.length ?? 0) > 0) && (
                    <span className="block truncate text-[12px] text-ink-2">{[...(item.choices ?? []), ...(item.options ?? [])].map((part) => part.name).join(' · ')}</span>
                  )}
                </span>
                {item.offeredAt ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[13px]">
                    <s className="tabular text-ink-3">{formatMoney(item.unitPriceMinor * item.quantity, currency)}</s>
                    <span className="inline-flex items-center gap-1 rounded-full bg-done-soft px-2 py-0.5 font-semibold text-done">
                      <Gift className="size-3.5" aria-hidden />
                      Offert
                    </span>
                  </span>
                ) : (
                  <span className="tabular shrink-0 text-[13px]">
                    <span className="font-semibold text-ink">{item.quantity}</span>
                    <span className="px-1 text-ink-3">×</span>
                    <span className="text-ink-2">{formatMoney(item.unitPriceMinor, currency)}</span>
                  </span>
                )}
                {canOffer && item.id && (
                  <button
                    type="button"
                    disabled={offer.isPending}
                    onClick={() => offer.mutate({ itemId: item.id!, offered: !item.offeredAt })}
                    aria-label={item.offeredAt ? `Retirer le cadeau sur ${item.name}` : `Offrir ${item.name}`}
                    title={item.offeredAt ? 'Retirer le cadeau' : 'Offrir'}
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-full ring-1 transition-colors disabled:opacity-40',
                      item.offeredAt ? 'bg-done text-white ring-done' : 'text-ink-2 ring-line hover:text-done',
                    )}
                  >
                    <Gift className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}

function StatePill({ state }: { state: ReturnType<typeof orderStateLabel> }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-px text-[11px] font-semibold',
        state.tone === 'done' && 'bg-done-soft text-done',
        state.tone === 'progress' && 'bg-progress-soft text-progress',
        state.tone === 'waiting' && 'bg-wait text-wait-ink',
        state.tone === 'cancelled' && 'bg-sunken text-ink-3',
      )}
    >
      {state.label}
    </span>
  );
}

function Thumb({ imageId, name, size = 'md' }: { imageId: string | null; name: string; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-7 rounded-lg' : 'size-9 rounded-full';
  if (imageId) {
    // eslint-disable-next-line @next/next/no-img-element -- photo servie par l'API, déjà réduite
    return <img src={menuImageUrl(imageId)} alt="" loading="lazy" className={cn('bg-sunken object-cover', box)} />;
  }
  return <span className={cn('grid place-items-center bg-sunken text-[11px] font-semibold text-ink-3', box)}>{name.charAt(0).toUpperCase()}</span>;
}
