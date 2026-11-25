'use client';

import { Check, MapPin, Store, UtensilsCrossed } from 'lucide-react';
import { Button, Dialog } from '@/components/ui';
import { SessionMarker } from '@/components/ui/session-marker';
import { continueAfterExplanation, useLocationExplanation } from './use-order-location';

/**
 * Spec 027, R4 : toutes les commandes du client sont servies et réglées.
 * Lisible sans lire : grande coche verte, le repère du client, puis un seul bouton.
 */
export function SettledScreen({ marker, onOrderAgain }: { marker: number; onOrderAgain: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
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
      <Button onClick={onOrderAgain} size="lg" className="mt-2 min-w-56">
        <UtensilsCrossed className="size-5" aria-hidden />
        Commander encore
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
