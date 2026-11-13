import { Ban, CheckCircle2, CookingPot, Flame, Send, ShoppingBag, Snowflake, UserRound, type LucideIcon } from 'lucide-react';
import type { GuestRequest } from '@/contracts';

/** Spec 013 : logique pure de la validation de commande (testée sans navigateur). */

/** Spec 013, R2 : précisions à toucher, comprises sans lire grâce au pictogramme. Liste fixe (décision Q2). */
export const PRECISIONS: { key: string; label: string; icon: LucideIcon; crossed?: boolean }[] = [
  { key: 'sans-piment', label: 'Sans piment', icon: Flame, crossed: true },
  { key: 'peu-pimente', label: 'Pas trop pimenté', icon: Flame },
  { key: 'bien-frais', label: 'Bien frais', icon: Snowflake },
  { key: 'sans-glacons', label: 'Sans glaçons', icon: Snowflake, crossed: true },
  { key: 'sans-oignon', label: 'Sans oignon', icon: Ban },
  { key: 'a-emporter', label: 'À emporter', icon: ShoppingBag },
];

/** CA-013-03 : la note envoyée en cuisine : « Sans piment · Bien frais · texte libre ». */
export function composeNote(selected: string[], free: string, max: number): string | undefined {
  const labels = PRECISIONS.filter((p) => selected.includes(p.key)).map((p) => p.label);
  const text = [...labels, free.trim()].filter(Boolean).join(' · ');
  return text ? text.slice(0, max) : undefined;
}

/** Étapes en pictogrammes (spec 003, R4 ; spec 013, R6) : le même dessin partout pour le même état. */
export function trackingSteps(kind: 'order' | 'service'): { label: string; icon: LucideIcon }[] {
  return kind === 'order'
    ? [
        { label: 'Envoyée', icon: Send },
        { label: 'Prise en charge', icon: UserRound },
        { label: 'En préparation', icon: CookingPot },
        { label: 'Servie', icon: CheckCircle2 },
      ]
    : [
        { label: 'Envoyée', icon: Send },
        { label: 'Prise en charge', icon: UserRound },
        { label: 'En cours', icon: CookingPot },
        { label: 'Terminée', icon: CheckCircle2 },
      ];
}

export function stepOf(request: Pick<GuestRequest, 'status'>): number {
  if (request.status === 'resolved') return 3;
  if (request.status === 'in_progress') return 2;
  if (request.status === 'accepted') return 1;
  return 0;
}

