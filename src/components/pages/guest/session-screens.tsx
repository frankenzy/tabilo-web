'use client';

import { Armchair, ArrowRight, Check, Gift, Hand, Loader2, LogOut, MapPin, Store, UtensilsCrossed, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button, Dialog } from '@/components/ui';
import { SessionMarker } from '@/components/ui/session-marker';
import { continueAfterExplanation, useLocationExplanation } from './use-order-location';
import { usePendingGifts } from './loyalty-card';

const reminderDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

/**
 * Spec 027, R4 : toutes les commandes du client sont servies et réglées.
 * Lisible sans lire : grande coche verte, le repère du client.
 * Spec 046, R7 : `gift` montre le cadeau débloqué par ce règlement (feux d'artifice, déballage).
 * Spec 047, R3 à R5 : la croix ramène à la carte ; « Commander encore » et « Libérer la table », côte à côte.
 */
export function SettledScreen({
  marker,
  tableLabel,
  token,
  onOrderAgain,
  onClose,
  onLeave,
  gift,
}: {
  marker: number;
  tableLabel: string | null;
  token: string | null;
  onOrderAgain: () => void;
  onClose: () => void;
  onLeave: () => Promise<void>;
  gift?: ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = usePendingGifts(token);
  const leave = () => {
    setLeaving(true);
    setFailed(false);
    onLeave().catch(() => {
      setLeaving(false);
      setFailed(true);
    });
  };
  return (
    <main className="flex min-h-dvh flex-col px-6 pt-5 pb-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer et revenir à la carte"
          className="grid size-11 place-items-center rounded-full bg-surface text-ink-2 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_-4px_rgba(0,0,0,0.12)] ring-1 ring-line active:scale-90"
        >
          <X className="size-5" strokeWidth={2.2} aria-hidden />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6 text-center">
        <div className="relative">
          <span className="grid size-24 animate-pop-in place-items-center rounded-full bg-done text-white shadow-pop">
            <Check className="size-12" strokeWidth={3} aria-hidden />
          </span>
          <SessionMarker index={marker} size="md" className="absolute -right-1 -bottom-1 ring-4 ring-paper" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Réglé · Merci</h1>
          <p className="mt-1 text-sm text-ink-2">Votre note est réglée. À bientôt !</p>
        </div>
        {gift}
      </div>
      <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onOrderAgain}
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-ink px-2.5 text-[15px] font-semibold whitespace-nowrap text-white active:scale-[0.97]"
        >
          <UtensilsCrossed className="size-[18px]" aria-hidden />
          Commander encore
        </button>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-brand px-2.5 text-[15px] font-semibold whitespace-nowrap text-white shadow-[0_10px_22px_-10px_var(--color-brand)] active:scale-[0.97]"
        >
          <LogOut className="size-[18px]" aria-hidden />
          Libérer la table
        </button>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm} title="Vous partez ?">
        <div className="flex flex-col items-center gap-4 pb-1 text-center">
          <div className="flex items-center gap-3" aria-hidden>
            <span className="grid size-16 place-items-center rounded-2xl bg-sunken text-ink-2">
              <Armchair className="size-8" />
            </span>
            <ArrowRight className="size-6 text-ink-3" />
            <span className="grid size-16 place-items-center rounded-2xl bg-done-soft text-done">
              <Check className="size-8" strokeWidth={2.6} />
            </span>
          </div>
          <p className="text-[15px] leading-snug text-ink-2">
            {tableLabel ? `La table ${tableLabel}` : 'La table'} sera libérée pour d’autres clients. Votre carte de fidélité et vos cadeaux restent dans votre téléphone.
          </p>
          {pending && (
            <p className="flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-[13px] font-semibold text-brand-strong">
              <Gift className="size-4" aria-hidden />
              {pending.count > 1 ? `${pending.count} cadeaux` : '1 cadeau'} à utiliser avant le {reminderDate.format(pending.until)}
            </p>
          )}
          <div className="mt-1 flex w-full flex-col gap-2">
            <button
              type="button"
              disabled={leaving}
              onClick={leave}
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-ink text-[16px] font-semibold text-white active:scale-[0.98] disabled:opacity-60"
            >
              {leaving ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <LogOut className="size-5" aria-hidden />}
              Oui, libérer la table
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="h-12 rounded-full text-[15px] font-semibold text-ink-2">
              Je reste
            </button>
            {failed && <p className="text-[13px] text-late">Réseau indisponible. Réessayez.</p>}
          </div>
        </div>
      </Dialog>
    </main>
  );
}

/** Spec 047, R5 : la table est libérée ; on peut revenir en rescannant le QR. */
export function LeftScreen({ onBack }: { onBack: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="grid size-24 animate-pop-in place-items-center rounded-full bg-brand-soft text-brand" aria-hidden>
        <Hand className="size-12" strokeWidth={1.8} />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">À bientôt !</h1>
        <p className="mt-1 text-sm text-ink-2">La table est libérée. Merci de votre visite.</p>
      </div>
      <Button onClick={onBack} size="lg" variant="secondary" className="mt-2 min-w-56">
        <UtensilsCrossed className="size-5" aria-hidden />
        Revoir la carte
      </Button>
    </main>
  );
}

/**
 * Spec 027, R8 : avant la demande d'autorisation du navigateur, une image explique pourquoi
 * la position est demandée — le téléphone (épingle) dans l'établissement (boutique).
 */
export function LocationExplanation() {
  const open = useLocationExplanation();
  return (
    <Dialog open={open} onOpenChange={(next) => !next && continueAfterExplanation()} title="Vous êtes sur place ?">
      <div className="flex flex-col items-center gap-4 pb-2 text-center">
        <div className="flex items-center gap-3" aria-hidden>
          <span className="grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand">
            <MapPin className="size-8" />
          </span>
          <span className="h-0.5 w-6 rounded-full bg-line" />
          <span className="grid size-16 place-items-center rounded-2xl bg-done-soft text-done">
            <Store className="size-8" />
          </span>
        </div>
        <p className="max-w-xs text-sm text-ink-2">
          Votre position confirme au serveur que la commande vient bien de l’établissement. Elle n’est pas enregistrée.
        </p>
        <Button size="lg" className="w-full" onClick={continueAfterExplanation}>
          <Check className="size-5" aria-hidden />
          Continuer
        </Button>
      </div>
    </Dialog>
  );
}
