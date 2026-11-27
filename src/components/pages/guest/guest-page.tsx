'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BellRing, Check, Droplet, Minus, Plus, Clock, Clock3, Loader2, QrCode, RotateCw, WifiOff,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Dialog, FormError, Textarea } from '@/components/ui';
import { requestIcon } from '@/constants/requests';
import type { GuestContext, GuestRequest, GuestRequestType } from '@/contracts';
import { cn, randomId } from '@/lib/utils';
import { menuImageUrl } from '@/services/api';
import { guestApi } from '@/services/api/guest';
import { errorMessage, toHttpError } from '@/services/http';
import { cartLines, useCart, useOrderDetails } from './cart';
import { flyToCart, haptic } from './fly-to-cart';
import { CartBar, MenuView, OrderPanel, OrderScreen, useSendOrder } from './guest-menu';
import { HistoryButton, useServedSpotlight } from './note';
import { TableBadge } from './order-flow';
import { mergeIntoCart, reorderLines } from './order-logic';
import { TrackingPager } from './tracking-card';
import { useBill } from './use-bill';
import { ServerCallCard, ServerRounds, ServerSheet, useServerCall } from './server-call';
import { hasServerButton, isServerRequest } from './server-logic';
import { useLandscape } from './use-layout';
import { guestRequestsKey, upsert, useGuestRequests } from './use-guest-requests';
import { useGuestSession } from './use-guest-session';
import { useBranding } from './use-branding';
import { EstablishmentHeader } from './establishment-header';
import { LoyaltyButton, SettledGift } from './loyalty-card';
import { LocationExplanation, SettledScreen } from './session-screens';
import { SessionMarker } from '@/components/ui/session-marker';

const NOTE_MAX = 280;
const ACTIVE = ['awaiting_payment', 'pending', 'assigned', 'accepted', 'in_progress'];

export function GuestPage({ code }: { code: string }) {
  const { state, retry, markClosed, markSettled, refresh } = useGuestSession(code);

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
  if (state.phase === 'settled') {
    return (
      <SettledScreen
        marker={state.marker}
        onOrderAgain={retry}
        gift={state.token && state.context ? <SettledGift token={state.token} context={state.context} /> : null}
      />
    );
  }
  // Spec 035, R6 : compte suspendu — une horloge, compris sans lire ; on peut réessayer plus tard.
  if (state.phase === 'error' && state.kind === 'suspended') {
    return (
      <Screen>
        <span className="grid size-24 place-items-center rounded-full bg-sunken text-ink-3" aria-hidden>
          <Clock3 className="size-12" />
        </span>
        <h1 className="text-lg font-semibold text-ink">Service momentanément indisponible</h1>
        <p className="max-w-xs text-sm text-ink-2">Adressez-vous au personnel.</p>
        <Button onClick={retry} size="lg" variant="secondary" className="mt-2">
          <RotateCw className="size-5" aria-hidden />
          Réessayer
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
  return <GuestTable token={state.token} context={state.context} onSessionClosed={markClosed} onSettled={markSettled} onContextStale={refresh} />;
}

function Screen({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">{children}</main>;
}

interface GuestTableProps {
  token: string;
  context: GuestContext;
  onSessionClosed: () => void;
  /** Spec 027, R4 : toutes les commandes du client sont servies et réglées. */
  onSettled: () => void;
  onContextStale: () => void;
}

/**
 * Page de table (spec 004) : la carte occupe l'écran, la commande passe par la barre du bas,
 * l'appel au personnel par le bouton « Serveur » en haut. Sans carte, les demandes restent à l'écran.
 */
function GuestTable({ token, context, onSessionClosed, onSettled, onContextStale }: GuestTableProps) {
  const { data: requests = [], live, isError, isPending } = useGuestRequests(token, onSessionClosed, onSettled);
  const [selected, setSelected] = useState<GuestRequestType | null>(null);
  const [serverOpen, setServerOpen] = useState(false);
  // Spec 029, R2 : sans carte, la bulle ouvre directement la saisie du message.
  const [writeFirst, setWriteFirst] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  // Spec 028 : « Ma note » s'ouvre aussi depuis la carte servie et la tuile « L'addition ».
  const [noteOpen, setNoteOpen] = useState(false);
  const { cart, setQuantity, clear } = useCart(token);
  const { details, updateDetails, clearDetails } = useOrderDetails(token);
  // Spec 031, R3 et R7 : couleur et nom de l'établissement, avant le premier affichage.
  useBranding(context.establishment.brandColor, context.establishment.name);
  const hasMenu = context.menu.length > 0;
  const currency = context.establishment.currency;
  const summary = cartLines(cart, context.menu, new Date(), context.establishment.timezone);
  // Spec 019, R4 : à l'horizontale, la commande est dans le panneau de droite ; ni barre ni feuille.
  const landscape = useLandscape() && hasMenu;
  const [round, setRound] = useState(0);
  // Spec 021, R2 : commande envoyée depuis la barre → la feuille s'ouvre directement sur « C'est parti ! ».
  const [barSent, setBarSent] = useState<GuestRequest | null>(null);
  const { send: barSend, renew: renewBarKey } = useSendOrder({
    token,
    context,
    cart,
    details,
    onContextStale,
    onSessionClosed,
    onSuccess: (request) => {
      clear();
      clearDetails();
      renewBarKey();
      setBarSent(request);
      setCartOpen(true);
    },
  });
  const precisionCount = details.precisions.length + (details.note.trim() ? 1 : 0);
  const showBar = context.orderingEnabled && (summary.count > 0 || summary.hasInvalid) && !landscape;

  const active = useMemo(() => requests.filter((r) => ACTIVE.includes(r.status)), [requests]);
  // Spec 018, R6 : les commandes terminées de ce téléphone vont dans l'historique « Ma note ».
  const pastOrders = useMemo(() => requests.filter((r) => r.type.kind === 'order' && !ACTIVE.includes(r.status)), [requests]);
  // Spec 028 : la tuile « L'addition » reste touchable une fois demandée — elle rouvre la facture.
  const activeTypeIds = new Set(active.filter((r) => r.type.kind !== 'bill').map((r) => r.type.id));
  // Spec 018, R1 : une demande servie reste une minute dans le suivi (« Bon appétit »).
  const { spotlight, dismiss } = useServedSpotlight(requests, token);
  // Spec 028, R3 : l'addition demandée s'affiche dans « Ma note », pas dans le suivi des demandes.
  const tracked = requests.filter((r) => r.type.kind !== 'bill' && !isServerRequest(r) && (ACTIVE.includes(r.status) || spotlight.has(r.id)));
  // Spec 029, R4 : l'appel et les messages en cours, chacun sa carte en tête du menu.
  const serverCards = requests.filter((r) => isServerRequest(r) && ACTIVE.includes(r.status));
  const server = useServerCall({ token, context, onSessionClosed });
  const serverButton = hasServerButton(context.requestTypes);
  const bill = useBill(token, context, requests, onSessionClosed);
  // Spec 028, R2 : la tuile « L'addition » n'apparaît que s'il y a quelque chose à régler, et ouvre la note.
  // Spec 029, R1 : hors appel et message, seule « De l'eau » reste proposée au téléphone.
  const tileTypes = context.requestTypes.filter((type) =>
    type.kind === 'bill' ? bill.state.status !== 'none' : type.kind === 'service' && type.icon === 'droplet',
  );
  const selectTile = (type: GuestRequestType) => (type.kind === 'bill' ? setNoteOpen(true) : setSelected(type));

  // R4 : les mêmes plats rejoignent le panier ; rien ne part en cuisine sans « Glisser pour commander ».
  const reorder = (request: GuestRequest, from: DOMRect | null) => {
    const lines = reorderLines(request, context.menu);
    const next = mergeIntoCart(cart, lines);
    for (const { itemId } of lines) setQuantity(itemId, next[itemId]);
    haptic(10);
    const first = context.menu.flatMap((category) => category.items).find((item) => item.id === lines[0]?.itemId);
    // La barre « Voir la commande » apparaît au rendu suivant : la vignette part ensuite, pour savoir où atterrir.
    window.setTimeout(() => flyToCart(from, first?.imageId ? menuImageUrl(first.imageId) : null), 60);
  };

  const pager = (stacked: boolean) => (
    <TrackingPager
      active={tracked}
      token={token}
      currency={currency}
      menu={context.menu}
      spotlight={spotlight}
      onDismiss={dismiss}
      onReorder={reorder}
      stacked={stacked}
      bill={bill}
      onBillAsked={() => setNoteOpen(true)}
    />
  );
  const callCards = serverCards.length > 0 && (
    <div className="mt-4 flex flex-col gap-2">
      {serverCards.map((request) => (
        <ServerCallCard key={request.id} request={request} token={token} marker={context.marker} tableLabel={context.table.label} />
      ))}
    </div>
  );
  // À l'horizontale, le suivi passe dans le panneau (R4).
  const banner =
    (tracked.length > 0 || serverCards.length > 0) && !landscape ? (
      <>
        {callCards}
        {tracked.length > 0 && pager(false)}
      </>
    ) : undefined;
  const openServer = (write = false) => {
    setWriteFirst(write);
    setServerOpen(true);
  };
  // Demande d'eau : le type de service à l'icône « goutte » (spec 005, R6).
  const waterType = context.requestTypes.find((type) => type.icon === 'droplet');

  return (
    // Spec 019 : colonne de 720 px à la verticale (R3) ; à l'horizontale, la carte laisse 380 px au panneau « Ma table » (R4).
    <main
      className={cn(
        'mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-6 md:max-w-[720px] md:px-6 lg:mr-[380px] lg:ml-0 lg:w-auto lg:max-w-none lg:px-8',
        showBar ? 'pb-44' : 'pb-10',
      )}
    >
      <header>
        {/* Spec 031, R5 et R6 : logo et nom de l'établissement, puis son mot d'accueil.
            Spec 043, R8 : la carte de fidélité derrière le cadeau, à droite du nom. */}
        <EstablishmentHeader
          establishment={context.establishment}
          token={token}
          action={<LoyaltyButton token={token} context={context} />}
        />
        {hasMenu ? (
          // Repères discrets : l'en-tête de la carte (recherche, tuiles, cloche) prend le haut de l'écran (spec 005).
          <h1 className="flex items-center gap-2 text-[13px] text-ink-2">
            {/* Spec 027, R2 : le repère du client, celui que le serveur voit sur ses commandes. */}
            <SessionMarker index={context.marker} size="sm" />
            <span className="truncate">
              <span className="font-semibold text-ink">Table {context.table.label}</span> · {context.table.area}
            </span>
          </h1>
        ) : (
          <>
            <h1 className="mt-0.5 flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
              <SessionMarker index={context.marker} size="md" />
              Table {context.table.label}
              <span className="ml-2 text-base font-normal text-ink-3">{context.table.area}</span>
            </h1>
          </>
        )}
      </header>

      {!live && !isPending && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-lg bg-wait px-3 py-2 text-[13px] text-wait-ink">
          <WifiOff className="size-3.5 shrink-0" aria-hidden />
          {isError ? 'Connexion perdue. Nouvelle tentative en cours…' : 'Mise à jour automatique toutes les 5 secondes.'}
        </p>
      )}

      {hasMenu ? (
        <div className="mt-1">
          <MenuView
            token={token}
            context={context}
            cart={cart}
            onQuantity={setQuantity}
            action={
              serverButton ? (
                // Cloche toujours visible : elle est dans l'en-tête fixe de la carte (spec 005, R4).
                <button
                  type="button"
                  onClick={() => openServer()}
                  aria-label="Serveur"
                  title="Appeler le serveur"
                  className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-white shadow-pop active:scale-95"
                >
                  <BellRing className="size-5" aria-hidden />
                </button>
              ) : undefined
            }
            banner={banner}
            leadingTile={waterType ? <WaterTile pending={activeTypeIds.has(waterType.id)} onCall={() => setSelected(waterType)} /> : undefined}
            trailingTile={serverButton ? <WaiterTile onCall={() => openServer()} /> : undefined}
          />
        </div>
      ) : (
        <>
          {banner}
        <section className="mt-8">
          <h2 className="sr-only">Appeler le serveur</h2>
          {/* Spec 029, R2 : sans carte, les deux ronds sont sur la page ; l'eau et l'addition dessous. */}
          <ServerRounds
            className="py-4"
            onCall={server.callType ? server.call : undefined}
            onWrite={server.messageType ? () => openServer(true) : undefined}
          />
          {server.callError && (
            <p role="alert" className="text-center text-[13px] text-late">
              {server.callError}
            </p>
          )}
          {tileTypes.length > 0 && <RequestTiles types={tileTypes} activeTypeIds={activeTypeIds} onSelect={selectTile} />}
        </section>
        </>
      )}


      <p className="mt-auto pt-10 text-center text-xs text-ink-3">
        Service assuré avec TABILO ·{' '}
        {/* Spec 041, R1 : la politique de confidentialité, depuis le pied de page. */}
        <a href="/confidentialite" target="_blank" className="underline underline-offset-2">
          Confidentialité
        </a>
      </p>

      {pastOrders.length > 0 && !cartOpen && (
        // Spec 018, R5 : le bouton historique prend la place du bouton flottant « Serveur » ; le serveur reste à la cloche et à la tuile.
        <div
          className={cn(
            'pointer-events-none fixed inset-x-0 z-30 mx-auto flex max-w-md justify-end px-4 md:max-w-[720px] md:px-6 lg:right-[380px] lg:mx-0 lg:max-w-none lg:px-8',
            showBar ? 'bottom-[10rem]' : 'bottom-[max(1rem,env(safe-area-inset-bottom))]',
          )}
        >
          <HistoryButton
            orders={pastOrders}
            currency={currency}
            menu={context.menu}
            open={noteOpen}
            onOpenChange={setNoteOpen}
            bill={bill}
            marker={context.marker}
            onReorder={reorder}
          />
        </div>
      )}
      {showBar && !cartOpen && (
        <CartBar
          token={token}
          context={context}
          cart={cart}
          precisionCount={precisionCount}
          onOpen={() => {
            barSend.reset();
            setCartOpen(true);
          }}
          onAdd={(itemId) => setQuantity(itemId, (cart[itemId] ?? 0) + 1)}
          sending={barSend.isPending}
          error={barSend.isError ? errorMessage(barSend.error) : null}
          onConfirm={() => barSend.mutate()}
        />
      )}
      {landscape && (
        // Spec 019, R4 : panneau « Ma table » — le suivi, puis la commande en cours et le geste pour commander.
        <aside aria-label="Ma table" className="fixed inset-y-0 right-0 z-30 flex w-[380px] flex-col border-l border-line bg-surface">
          <div className="shrink-0 px-4 pt-5">
            <TableBadge label={context.table.label} area={context.table.area} />
          </div>
          {(tracked.length > 0 || serverCards.length > 0) && (
            <div className="max-h-[45%] shrink-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-1">
              {serverCards.length > 0 && <div className="-mt-4 mb-3">{callCards}</div>}
              {tracked.length > 0 && pager(true)}
            </div>
          )}
          {context.orderingEnabled ? (
            <OrderPanel
              key={round}
              token={token}
              context={context}
              cart={cart}
              onQuantity={setQuantity}
              details={details}
              onDetails={updateDetails}
              onSent={() => {
                clear();
                clearDetails();
              }}
              // Confirmation terminée : une commande neuve, avec une nouvelle clé d'envoi.
              onOrdered={() => setRound((n) => n + 1)}
              onContextStale={onContextStale}
              onSessionClosed={onSessionClosed}
            />
          ) : (
            <p className="m-4 rounded-xl bg-sunken px-3 py-2.5 text-[13px] text-ink-2">La commande en ligne est suspendue.</p>
          )}
        </aside>
      )}
      {cartOpen && (
        <OrderScreen
          initialSent={barSent}
          landscape={landscape}
          token={token}
          context={context}
          cart={cart}
          onQuantity={setQuantity}
          onClose={() => {
            setCartOpen(false);
            setBarSent(null);
          }}
          details={details}
          onDetails={updateDetails}
          onSent={() => {
            clear();
            clearDetails();
          }}
          onOrdered={() => {
            setCartOpen(false);
            setBarSent(null);
            // Retour en haut, sur le suivi de la commande (R4).
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onContextStale={onContextStale}
          onSessionClosed={onSessionClosed}
        />
      )}

      <ServerSheet
        open={serverOpen}
        onOpenChange={setServerOpen}
        startWriting={writeFirst}
        token={token}
        context={context}
        requests={requests}
        onSessionClosed={onSessionClosed}
      />
      {selected && <ConfirmRequest key={selected.id} type={selected} token={token} onClose={() => setSelected(null)} onSessionClosed={onSessionClosed} />}
      {/* Spec 027, R8 : explication avant la première demande de position. */}
      {context.zone && <LocationExplanation />}
    </main>
  );
}

/** Tuile spéciale « Eau » (spec 005, R6) : un geste pour demander de l'eau, sans lire ni passer par la cloche. */
/** Tuile « Serveur » en bout de rangée (spec 005, R9) : la photo du serveur, comprise sans lire. */
function WaiterTile({ onCall }: { onCall: () => void }) {
  return (
    <button type="button" onClick={onCall} aria-label="Serveur, appeler le serveur" title="Appeler le serveur" className="group flex w-16 shrink-0 flex-col items-center gap-1">
      <span className="relative size-12 rounded-xl shadow-sm ring-1 ring-line transition-transform duration-300 ease-spring group-hover:-translate-y-0.5 group-active:scale-95">
        {/* eslint-disable-next-line @next/next/no-img-element -- image statique de l'interface */}
        <img src="/images/serveur.jpg" alt="" draggable={false} className="size-full rounded-xl object-cover" />
        <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-ink text-white ring-2 ring-paper">
          <BellRing className="size-3" aria-hidden />
        </span>
      </span>
      <span className="w-full truncate text-center text-[11px] leading-tight font-semibold text-ink">Serveur</span>
    </button>
  );
}

function WaterTile({ pending, onCall }: { pending: boolean; onCall: () => void }) {
  return (
    <button
      type="button"
      onClick={onCall}
      disabled={pending}
      aria-label={pending ? 'De l’eau, déjà demandé' : 'De l’eau, appeler le serveur'}
      className="mr-1 flex w-16 shrink-0 flex-col items-center gap-1"
    >
      <span
        className={cn(
          'relative grid size-12 place-items-center rounded-xl shadow-sm',
          pending ? 'bg-sunken text-ink-3 ring-1 ring-line' : 'bg-progress text-white',
        )}
      >
        <Droplet className="size-6" fill="currentColor" fillOpacity={pending ? 0 : 0.25} aria-hidden />
        {pending && (
          <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-surface text-ink-2 shadow-sm ring-1 ring-line">
            <Clock className="size-3" aria-hidden />
          </span>
        )}
      </span>
      <span className={cn('w-full truncate text-center text-[11px] leading-tight font-semibold', pending ? 'text-ink-3' : 'text-progress')}>
        {pending ? 'Demandée' : 'Eau'}
      </span>
    </button>
  );
}

/** Tuiles des demandes de service : une grande icône par demande (spec 003). */
function RequestTiles({ types, activeTypeIds, onSelect }: { types: GuestRequestType[]; activeTypeIds: Set<string>; onSelect: (type: GuestRequestType) => void }) {
  if (types.length === 0) {
    return <p className="mt-3 text-sm text-ink-2">Aucune demande n’est disponible pour le moment. Adressez-vous au personnel.</p>;
  }
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      {types.map((type) => {
        const Icon = requestIcon(type.icon);
        const pending = activeTypeIds.has(type.id);
        return (
          <button
            key={type.id}
            type="button"
            disabled={pending}
            onClick={() => onSelect(type)}
            className={cn(
              'flex min-h-28 flex-col justify-between rounded-2xl p-4 text-left ring-1 ring-inset transition-colors',
              pending ? 'bg-sunken text-ink-3 ring-transparent' : 'bg-surface text-ink ring-line active:bg-sunken',
            )}
          >
            <Icon className="size-7" aria-hidden />
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
  );
}

function ConfirmRequest({ type, token, onClose, onSessionClosed }: { type: GuestRequestType; token: string; onClose: () => void; onSessionClosed: () => void }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  // Demande d'eau (spec 005, R7) : la bouteille et la quantité, sans précision à écrire.
  const isWater = type.icon === 'droplet';
  const [quantity, setQuantity] = useState(1);
  // Une clé par intention : un double appui ou une reprise réseau ne crée qu'une demande.
  const [idempotencyKey] = useState(() => randomId());
  const Icon = requestIcon(type.icon);

  const create = useMutation({
    mutationFn: () =>
      guestApi.create(token, isWater ? { requestTypeId: type.id, quantity } : { requestTypeId: type.id, note: note.trim() || undefined }, idempotencyKey),
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
        {isWater ? (
          <div className="flex items-center justify-between gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- image statique de l'interface */}
            <img src="/images/eau-bouteille.jpg" alt="Bouteille d’eau" className="size-28 rounded-2xl object-cover" />
            <div className="inline-flex items-center rounded-full bg-sunken text-ink" role="group" aria-label="Nombre de bouteilles">
              <button type="button" className="grid size-12 place-items-center rounded-full disabled:opacity-35" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)} aria-label="Une bouteille de moins">
                <Minus className="size-5" aria-hidden />
              </button>
              <span className="tabular min-w-8 text-center text-xl font-semibold" aria-live="polite" aria-label={`${quantity} bouteille${quantity > 1 ? 's' : ''}`}>
                {quantity}
              </span>
              <button type="button" className="grid size-12 place-items-center rounded-full disabled:opacity-35" disabled={quantity >= 10} onClick={() => setQuantity(quantity + 1)} aria-label="Une bouteille de plus">
                <Plus className="size-5" aria-hidden />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid size-12 place-items-center rounded-xl bg-sunken text-ink">
            <Icon className="size-6" aria-hidden />
          </div>
        )}
        {!isWater && type.allowNote && (
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
