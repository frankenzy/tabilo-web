'use client';

import * as Menu from '@radix-ui/react-dropdown-menu';
import { useQuery } from '@tanstack/react-query';
import { Check, CheckCheck, ChevronDown, ClipboardList, CookingPot, Info, MoreHorizontal, Search, X, type LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { CategoryImage } from '@/components/pages/menu/category-image';
import { capabilitiesOf, type Viewer } from '@/components/pages/requests/capabilities';
import { RequestDialogs, type RequestDialog } from '@/components/pages/requests/request-dialogs';
import { useActiveRequests, useFloor, useRequestAction, useRequestTypes, useUnpaidOrders } from '@/components/pages/requests/use-requests';
import { Button, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { SlideToConfirm } from '@/components/ui/slide-to-confirm';
import type { ServiceRequest } from '@/contracts';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/utils';
import { establishmentApi, menuApi, requestsApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { useAuthStore, useMembership } from '@/stores/auth.store';
import { formatClock, secondsSince } from '@/utils/time';
import { URGENCY_LABEL, URGENCY_TILE, urgencyOf } from '@/utils/urgency';
import { PrecisionBanner, PrecisionFlags, precisionLabel } from '@/components/pages/requests/precisions';
import {
  COLUMN_LABELS, COLUMN_TONE, columnOf, columnsFor, dishImages, filterOrders, groupOrders, hasFilters, liveGrid, nextStep, NO_FILTERS, slideTone, startOfToday, STATUS_PILL,
  type DishImage, type OrderFilters, type WhoFilter, type OrderColumn, type OrderStep, type StepTone,
} from './orders-logic';
import { RequestMarker, ZoneFlag, zoneLabel } from '@/components/pages/requests/client-tags';

/** Spec 007 : écran « Commandes », pensé pour une tablette en cuisine ou au comptoir. */

type View = 'live' | 'served';

const STEP_STYLE: Record<StepTone, string> = {
  red: 'bg-late text-white hover:brightness-95',
  orange: 'bg-brand text-white hover:bg-brand-strong',
  violet: 'bg-ready text-white hover:brightness-95',
  green: 'bg-done text-white hover:brightness-95',
  ink: 'bg-ink text-white hover:brightness-110',
};

const PILL_STYLE: Record<StepTone, string> = {
  red: 'bg-late-soft text-late',
  orange: 'bg-brand-soft text-brand-strong',
  violet: 'bg-ready-soft text-ready',
  green: 'bg-done-soft text-done',
  ink: 'bg-ink text-white',
};

const DOT_STYLE: Record<StepTone, string> = { red: 'bg-late', orange: 'bg-brand', violet: 'bg-ready', green: 'bg-done', ink: 'bg-white' };

const STATUS_PILL_SHORT: Record<OrderColumn, string> = { todo: 'À préparer', preparing: 'En cours', ready: 'Prête', unpaid: 'À régler' };

/** Boutons à toucher (spec 025) : « prête » et « servie » se glissent et n'ont pas d'icône. */
const STEP_ICON: Partial<Record<OrderStep['label'], LucideIcon>> = {
  Accepter: Check,
  Préparation: CookingPot,
};

export function OrdersPage() {
  const establishmentId = useEstablishmentId();
  const now = useNow();
  const me = useAuthStore((state) => state.me);
  const membership = useMembership();
  const viewer: Viewer = useMemo(
    () => ({ id: me?.id ?? '', can: (permission) => membership?.permissions.includes(permission) ?? false }),
    [me, membership],
  );
  const active = useActiveRequests();
  // Spec 026, R2 : les commandes servies non réglées restent dans la grille « En cours ».
  const unpaid = useUnpaidOrders();
  const establishment = useQuery({ queryKey: estKey(establishmentId, 'establishment'), queryFn: () => establishmentApi.get(establishmentId) });
  const menu = useQuery({ queryKey: estKey(establishmentId, 'menu'), queryFn: () => menuApi.overview(establishmentId) });
  const action = useRequestAction();
  const [dialog, setDialog] = useState<RequestDialog>(null);
  const [view, setView] = useState<View>('live');
  const [filters, setFilters] = useState<OrderFilters>(NO_FILTERS);
  const floor = useFloor();
  const areas = floor.data ?? [];

  const separateKitchen = establishment.data?.separateKitchen ?? false;
  const columns = columnsFor(separateKitchen);
  // Compteurs du filtre « État » : calculés avec les autres filtres, mais sans lui.
  const groups = useMemo(
    () => groupOrders(filterOrders([...(active.data?.items ?? []), ...(unpaid.data?.items ?? [])], filters, viewer.id), separateKitchen),
    [active.data, unpaid.data, separateKitchen, filters, viewer.id],
  );
  const status = filters.status !== 'all' && !columns.includes(filters.status) ? 'all' : filters.status;
  const grid = useMemo(() => liveGrid(groups, status), [groups, status]);
  const images = useMemo(() => dishImages(menu.data), [menu.data]);

  if (active.isPending || establishment.isPending) return <Spinner />;
  if (active.isError || establishment.isError) {
    return (
      <ErrorState
        message={errorMessage(active.error ?? establishment.error)}
        onRetry={() => {
          void active.refetch();
          void establishment.refetch();
        }}
      />
    );
  }

  const card = (request: ServiceRequest) => (
    <OrderCard
      key={request.id}
      request={request}
      now={now}
      viewer={viewer}
      images={images}
      step={nextStep(request, separateKitchen, viewer)}
      busy={action.isPending && action.variables?.id === request.id}
      onStep={(step) => action.mutate({ id: request.id, action: step.action })}
      onAcknowledge={() => action.mutate({ id: request.id, action: 'acknowledge-escalation' })}
      onDialog={setDialog}
    />
  );
  const liveCount = grid.length;

  return (
    <>
      {/* Titre à gauche, choix de l'affichage en icônes à droite, sur la même ligne. */}
      <header className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Commandes</h1>
          <p className="mt-1 text-sm text-ink-2">
            {view === 'served' ? 'Commandes servies aujourd’hui.' : separateKitchen ? 'Accepter, signaler prête, servir, régler.' : 'Accepter, servir, puis régler.'}
          </p>
        </div>
        <div role="tablist" aria-label="Affichage" className="relative mr-6 flex shrink-0 items-center gap-5 rounded-xl bg-sunken p-2 sm:mr-12 lg:mr-20">
          {/*
            Fond blanc de l'icône active, qui glisse d'une icône à l'autre.
            Décalage = icône (44 px) + écart (20 px) + barre (1 px) + écart (20 px) = 85 px.
          */}
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute top-2 left-2 size-11 rounded-lg bg-surface shadow-sm transition-transform duration-[420ms] ease-spring motion-reduce:transition-none',
              view === 'served' && 'translate-x-[85px]',
            )}
          />
          <ViewIcon active={view === 'live'} onClick={() => setView('live')} label="En cours" icon={CookingPot} count={liveCount} />
          <span className="relative z-10 w-px self-stretch bg-line" aria-hidden />
          <ViewIcon active={view === 'served'} onClick={() => setView('served')} label="Servies aujourd’hui" icon={CheckCheck} />
        </div>
      </header>

      <OrderToolbar
        filters={filters}
        onChange={setFilters}
        areas={areas}
        statuses={view === 'live' ? columns.map((column) => ({ value: column, label: COLUMN_LABELS[column], count: groups[column].length })) : null}
      />

      {view === 'served' ? (
        <ServedToday now={now} images={images} filters={filters} viewerId={viewer.id} onClear={() => setFilters(NO_FILTERS)} />
      ) : liveCount === 0 && hasFilters(filters) ? (
        <NoMatch onClear={() => setFilters(NO_FILTERS)} />
      ) : (
        grid.length === 0 ? (
          <div className="mt-5">
            <EmptyState icon={<CookingPot className="size-6" aria-hidden />} title="Aucune commande en cours" description="Les commandes des clients apparaissent ici dès qu’elles sont passées." />
          </div>
        ) : (
          // Spec 007, R3 : une seule grille, la couleur dit l'étape. 2 cartes sur téléphone, 3 sur tablette, 4 sur ordinateur.
          <ul className="mt-5 grid grid-cols-2 items-start gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
            {grid.map((request, index) => (
              <li key={request.id} className="stagger min-w-0 animate-item-in" style={{ '--i': Math.min(index, 12) } as CSSProperties}>
                {card(request)}
              </li>
            ))}
          </ul>
        )
      )}

      <RequestDialogs dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

interface OrderCardProps {
  request: ServiceRequest;
  now: number;
  viewer: Viewer;
  images: Map<string, DishImage>;
  step: OrderStep | null;
  busy: boolean;
  onStep: (step: OrderStep) => void;
  onAcknowledge: () => void;
  onDialog: (dialog: NonNullable<RequestDialog>) => void;
}

function OrderCard({ request, now, viewer, images, step, busy, onStep, onAcknowledge, onDialog }: OrderCardProps) {
  const urgency = urgencyOf(request, now);
  const caps = capabilitiesOf(request, viewer);
  const escalated = request.escalationStatus === 'escalated';
  const mine = request.assignee?.id === viewer.id;
  const column = columnOf(request) ?? 'todo';
  const tone = COLUMN_TONE[column];
  const StepIcon = step ? STEP_ICON[step.label] : null;
  const hasMenu = caps.cancel || caps.assign || caps.transfer || caps.release || caps.acknowledge;

  return (
    <article
      aria-label={`Table ${request.table.label}, commande, ${STATUS_PILL[column].toLowerCase()}${precisionLabel(request.note)}${zoneLabel(request.zone) ? `, ${zoneLabel(request.zone)}` : ''}`}
      className="flex flex-col overflow-hidden rounded-(--radius-card) bg-surface ring-1 ring-line transition-[transform,box-shadow] duration-300 ease-apple hover:-translate-y-0.5 hover:shadow-lg"
      data-testid={`order-${request.id}`}
      data-column={column}
    >
      {/* En-tête clair (R4) : table colorée par l'urgence, pastille d'état, heure, menu. */}
      <header className="flex items-start gap-2 bg-sunken/70 p-2 sm:gap-3 sm:p-3">
        <span
          className={cn('relative grid size-10 shrink-0 place-items-center rounded-xl sm:size-12', URGENCY_TILE[urgency], escalated && 'animate-attention')}
          title={URGENCY_LABEL[urgency]}
        >
          <span className="tabular max-w-full truncate px-1 font-mono text-xl leading-none font-bold">{request.table.label}</span>
          {/* Spec 027, R2 : repère du client, posé sur le coin de la table. */}
          <RequestMarker request={request} className="absolute -right-1.5 -bottom-1.5 ring-2 ring-surface" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-tight font-semibold whitespace-nowrap sm:gap-1.5 sm:px-2.5 sm:text-[12px]', PILL_STYLE[tone])}>
            <span className={cn('size-1.5 shrink-0 rounded-full', DOT_STYLE[tone])} aria-hidden />
            {/* Sur téléphone, la carte est étroite : libellé court. */}
            <span className="sm:hidden">{STATUS_PILL_SHORT[column]}</span>
            <span className="hidden sm:inline">{STATUS_PILL[column]}</span>
          </span>
          {/* Spec 022, R4 : précision, à emporter, piment — visibles avant d'ouvrir. */}
          <PrecisionFlags notes={[request.note]} className="ml-1.5 align-middle" />
          {/* Spec 027, R8 : signalement de zone, à vérifier avant d'accepter. */}
          <ZoneFlag zone={request.zone} className="mt-1 flex w-fit" />
          <span className="mt-1 flex items-center gap-1 truncate text-[11px] text-ink-3 sm:text-[12px]">
            <span className="font-medium text-ink-2">{new Date(request.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span aria-hidden>·</span>
            <span className={cn('tabular font-mono', urgency === 'late' && 'font-semibold text-late')} aria-label="Ancienneté">
              {formatClock(secondsSince(request.createdAt, now))}
            </span>
            {request.assignee && (
              <span className="hidden truncate sm:inline">
                <span aria-hidden> · </span>
                {mine ? 'Vous' : request.assignee.firstName}
              </span>
            )}
          </span>
        </span>
        {hasMenu && (
          <Menu.Root>
            <Menu.Trigger className="-mr-1 -mt-1 rounded-lg p-1 text-ink-3 hover:bg-surface hover:text-ink sm:p-1.5" aria-label="Autres actions">
              <MoreHorizontal className="size-5" aria-hidden />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-xl bg-surface p-1 shadow-pop ring-1 ring-line animate-rise">
                {caps.acknowledge && <Item onSelect={onAcknowledge}>Acquitter l’escalade</Item>}
                {caps.assign && <Item onSelect={() => onDialog({ kind: 'assign', request })}>{request.assignee ? 'Réaffecter…' : 'Affecter…'}</Item>}
                {caps.transfer && <Item onSelect={() => onDialog({ kind: 'transfer', request })}>Transférer…</Item>}
                {caps.release && <Item onSelect={() => onDialog({ kind: 'release', request })}>Remettre en attente…</Item>}
                {caps.cancel && (
                  <Item danger onSelect={() => onDialog({ kind: 'cancel', request })}>
                    Annuler la commande…
                  </Item>
                )}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        )}
      </header>

      {/* Spec 022, R2 : les précisions en tête, avant les plats. */}
      <PrecisionBanner note={request.note} className="mx-2 mt-2 sm:mx-3" />

      {/* Une ligne par plat (R4) : image, nom, quantité à droite. */}
      <ul className="flex flex-1 flex-col px-2 py-1 sm:px-3">
        {request.items.map((line) => {
          const image = line.menuItemId ? images.get(line.menuItemId) : undefined;
          return (
            <li key={`${line.menuItemId ?? ''}-${line.name}`} className="flex items-center gap-2 py-1.5 sm:gap-3 sm:py-2">
              <CategoryImage icon={image?.icon ?? 'utensils'} imageId={image?.imageId ?? null} name="" className="size-9 shrink-0 rounded-lg sm:size-11" />
              <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-tight font-medium text-ink sm:text-[15px]">{line.name}</span>
              <span className="tabular shrink-0 rounded-md bg-surface px-1.5 py-0.5 text-[13px] font-bold text-ink ring-1 ring-line sm:px-2 sm:py-1 sm:text-[15px]">×{line.quantity}</span>
            </li>
          );
        })}
      </ul>

      {/* Deux boutons côte à côte (R4) : Détail, puis l'étape suivante colorée selon l'état (R5). */}
      <div className="flex gap-1.5 border-t border-line p-2 sm:gap-2 sm:p-3">
        <button
          type="button"
          onClick={() => onDialog({ kind: 'detail', request })}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-sunken text-[15px] font-medium text-ink-2 hover:bg-line/60 sm:h-12 sm:w-auto sm:flex-1"
          aria-label="Détail de la commande"
        >
          <Info className="size-4" aria-hidden />
          <span className="hidden sm:inline">Détail</span>
        </button>
        {step?.gesture === 'slide' ? (
          // Spec 025, R3 à R6 : « prête » et « servie » se glissent.
          <SlideToConfirm
            className="min-w-0 flex-1 sm:flex-[1.4]"
            size="md"
            tone={slideTone(step.action)}
            label={step.label}
            ariaLabel={`${step.label}, table ${request.table.label}`}
            busy={busy}
            onConfirm={() => onStep(step)}
          />
        ) : step && StepIcon ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStep(step)}
            className={cn(
              'inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-60 sm:h-12 sm:flex-[1.4] sm:text-[16px]',
              STEP_STYLE[step.tone],
            )}
          >
            <StepIcon className="hidden size-5 shrink-0 sm:block" aria-hidden />
            {step.label}
          </button>
        ) : (
          <span className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl px-1 text-center text-[12px] leading-tight text-ink-3 ring-1 ring-line ring-inset sm:h-12 sm:flex-[1.4] sm:text-[13px]">
            {request.assignee ? `${request.assignee.firstName} s’en occupe` : 'En attente'}
          </span>
        )}
      </div>
    </article>
  );
}

function Item({ children, onSelect, danger }: { children: React.ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cn('cursor-pointer rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-sunken', danger ? 'text-late' : 'text-ink')}
    >
      {children}
    </Menu.Item>
  );
}

/** Spec 007, R10 : commandes servies depuis minuit, la plus récente en premier, sans action. */
function ServedToday({
  now, images, filters, viewerId, onClear,
}: { now: number; images: Map<string, DishImage>; filters: OrderFilters; viewerId: string; onClear: () => void }) {
  const establishmentId = useEstablishmentId();
  const types = useRequestTypes();
  const orderTypeId = types.data?.find((type) => type.kind === 'order')?.id;
  const from = startOfToday(now);
  const served = useQuery({
    queryKey: estKey(establishmentId, 'requests', 'served', from, orderTypeId),
    queryFn: () => requestsApi.list(establishmentId, { scope: 'closed', status: 'resolved', requestTypeId: orderTypeId, from, pageSize: 100 }),
    enabled: Boolean(orderTypeId),
  });
  if (types.isPending || served.isPending) return <Spinner />;
  if (served.isError) return <ErrorState message={errorMessage(served.error)} onRetry={() => void served.refetch()} />;
  const items = filterOrders(served.data.items, filters, viewerId).sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''));
  if (items.length === 0 && hasFilters(filters)) return <NoMatch onClear={onClear} />;
  if (items.length === 0) {
    return (
      <div className="mt-5">
        <EmptyState icon={<ClipboardList className="size-6" aria-hidden />} title="Aucune commande servie aujourd’hui" />
      </div>
    );
  }
  return (
    <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((request) => (
        <li key={request.id} className="rounded-(--radius-card) bg-surface p-4 ring-1 ring-line">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="tabular font-mono text-2xl font-bold text-ink">{request.table.label}</span>
              <RequestMarker request={request} size="sm" />
            </span>
            <span className="text-[13px] text-ink-3">
              Servie à {request.resolvedAt ? new Date(request.resolvedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
              {request.assignee && ` · ${request.assignee.firstName}`}
            </span>
          </div>
          {/* Spec 026, R2 : réglée ou encore à régler. */}
          <span className={cn('mt-1 inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold', request.paidAt ? 'bg-done-soft text-done' : 'bg-ink text-white')}>
            {request.paidAt ? 'Réglée' : 'À régler'}
          </span>
          <ul className="mt-2 flex flex-col gap-1.5">
            {request.items.map((line) => {
              const image = line.menuItemId ? images.get(line.menuItemId) : undefined;
              return (
                <li key={`${line.menuItemId ?? ''}-${line.name}`} className="flex items-center gap-2 text-sm text-ink">
                  <CategoryImage icon={image?.icon ?? 'utensils'} imageId={image?.imageId ?? null} name="" className="size-7 shrink-0 rounded-md" />
                  <span className="tabular font-semibold">×{line.quantity}</span>
                  <span className="truncate">{line.name}</span>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

const WHO_LABELS: Record<WhoFilter, string> = { all: 'Tout le monde', mine: 'Mes commandes', nobody: 'Sans personne' };

/** Spec 007, R11 : recherche (table, plats, note) et filtres zone / qui. */
function OrderToolbar({
  filters, onChange, areas, statuses,
}: {
  filters: OrderFilters;
  onChange: (filters: OrderFilters) => void;
  areas: { id: string; name: string }[];
  /** Étapes proposées avec leur nombre ; null dans « Servies », où le filtre n'a pas de sens. */
  statuses: { value: OrderColumn; label: string; count: number }[] | null;
}) {
  return (
    <section
      aria-label="Recherche et filtres"
      className={cn(
        'mt-4 grid grid-cols-2 gap-2 sm:gap-3',
        statuses ? 'md:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_12rem_12rem_12rem]' : 'md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_12rem_12rem]',
      )}
    >
      <label className={cn('relative col-span-2 xl:col-span-1', statuses && 'md:col-span-3')}>
        <span className="sr-only">Rechercher une commande</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder="Table, plat ou note…"
          className="h-11 w-full rounded-(--radius-card) bg-surface pr-9 pl-9 text-sm text-ink ring-1 ring-line outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-brand [&::-webkit-search-cancel-button]:hidden"
        />
        {filters.query && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, query: '' })}
            className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
            aria-label="Vider la recherche"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </label>
      {statuses && (
        <FilterSelect label="État" value={filters.status} onChange={(status) => onChange({ ...filters, status: status as OrderFilters['status'] })}>
          <option value="all">Tous les états</option>
          {statuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label} ({status.count})
            </option>
          ))}
        </FilterSelect>
      )}
      <FilterSelect label="Zone" value={filters.areaId} onChange={(areaId) => onChange({ ...filters, areaId })}>
        <option value="all">Toutes les zones</option>
        {areas.map((area) => (
          <option key={area.id} value={area.id}>
            {area.name}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="Qui" value={filters.who} className={statuses ? 'col-span-2 md:col-span-1' : undefined} onChange={(who) => onChange({ ...filters, who: who as WhoFilter })}>
        {(Object.keys(WHO_LABELS) as WhoFilter[]).map((who) => (
          <option key={who} value={who}>
            {WHO_LABELS[who]}
          </option>
        ))}
      </FilterSelect>
    </section>
  );
}

function FilterSelect({
  label, value, onChange, children, className,
}: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; className?: string }) {
  return (
    <label className={cn('relative', className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none truncate rounded-(--radius-card) bg-surface pr-9 pl-3 text-sm font-medium text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-2" aria-hidden />
    </label>
  );
}

function NoMatch({ onClear }: { onClear: () => void }) {
  return (
    <div className="mt-5">
      <EmptyState
        icon={<Search className="size-6" aria-hidden />}
        title="Aucune commande trouvée"
        action={
          <Button variant="secondary" onClick={onClear}>
            Effacer les filtres
          </Button>
        }
      />
    </div>
  );
}

/** Bouton-icône de choix d'affichage (« En cours », « Servies aujourd'hui »), avec pastille de compteur. */
function ViewIcon({ active, onClick, label, icon: Icon, count }: { active: boolean; onClick: () => void; label: string; icon: LucideIcon; count?: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={count !== undefined ? `${label} (${count})` : label}
      title={label}
      onClick={onClick}
      className={cn(
        'relative z-10 grid size-11 place-items-center rounded-lg transition-colors duration-300',
        active ? 'text-ink' : 'text-ink-3 hover:text-ink',
      )}
    >
      <Icon className="size-5" aria-hidden />
      {count !== undefined && count > 0 && (
        <span key={count} className="tabular absolute -top-1 -right-1 grid min-w-5 animate-pop-in place-items-center rounded-full bg-brand px-1 text-[11px] leading-5 font-semibold text-white">
          {count}
        </span>
      )}
    </button>
  );
}
