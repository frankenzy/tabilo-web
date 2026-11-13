import { Ban, CheckCircle2, Flame, Send, ShoppingBag, Snowflake, UserRound, UtensilsCrossed, type LucideIcon } from 'lucide-react';
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

/**
 * Étapes en pictogrammes (spec 003, R4 ; spec 015) : trois étapes, le même dessin partout pour le même état.
 * Envoyée → Prise en charge → Bon appétit (commande) ou Terminée (demande de service).
 */
export function trackingSteps(kind: 'order' | 'service'): { label: string; icon: LucideIcon }[] {
  return [
    { label: 'Envoyée', icon: Send },
    { label: 'Prise en charge', icon: UserRound },
    kind === 'order' ? { label: 'Bon appétit', icon: UtensilsCrossed } : { label: 'Terminée', icon: CheckCircle2 },
  ];
}

/** Spec 015, R1 : acceptée, en préparation et prête se regroupent sous « Prise en charge ». */
export function stepOf(request: Pick<GuestRequest, 'status'>): number {
  if (request.status === 'resolved') return 2;
  if (request.status === 'accepted' || request.status === 'in_progress' || request.status === 'ready') return 1;
  return 0;
}

/** Dernière étape de la frise. */
export const LAST_STEP = 2;


// ------------------------------------------------------------- spec 018 : commande servie

/** Spec 018, R1 : durée du moment « Bon appétit » dans le suivi. */
export const SERVED_SPOTLIGHT_MS = 60_000;

/**
 * Début du moment « Bon appétit » (R1), en heure du téléphone.
 * Vu passer au service pendant que la page est ouverte : maintenant (l'horloge du téléphone peut différer de celle du serveur).
 * Déjà servie au chargement : l'heure de service, pour que recharger ne relance pas la minute.
 */
export function spotlightStart(previousStatus: string | undefined, request: Pick<GuestRequest, 'status' | 'resolvedAt'>, now: number): number | null {
  if (request.status !== 'resolved') return null;
  if (previousStatus !== undefined && previousStatus !== 'resolved') return now;
  return request.resolvedAt ? Date.parse(request.resolvedAt) : null;
}

/** R1 : la carte reste dans le suivi tant que la minute n'est pas écoulée. */
export function inSpotlight(start: number | null | undefined, now: number): boolean {
  return start !== null && start !== undefined && now - start < SERVED_SPOTLIGHT_MS;
}

/** R5 : total des commandes servies ; ni les annulées ni celles en cours. */
export function servedTotal(requests: Pick<GuestRequest, 'status' | 'totalMinor' | 'type'>[]): number {
  return requests.reduce((sum, r) => (r.type.kind === 'order' && r.status === 'resolved' ? sum + (r.totalMinor ?? 0) : sum), 0);
}

/** R4 : ce que « Recommander » ajoute au panier — les plats encore disponibles, avec leur quantité. */
export function reorderLines(
  request: Pick<GuestRequest, 'items'>,
  menu: { items: { id: string; isAvailable: boolean }[] }[],
): { itemId: string; quantity: number }[] {
  const available = new Set(menu.flatMap((category) => category.items).filter((item) => item.isAvailable).map((item) => item.id));
  const lines = new Map<string, number>();
  for (const line of request.items) {
    if (line.menuItemId && available.has(line.menuItemId)) lines.set(line.menuItemId, (lines.get(line.menuItemId) ?? 0) + line.quantity);
  }
  return [...lines].map(([itemId, quantity]) => ({ itemId, quantity }));
}

/** R4 : le panier après « Recommander » — les quantités s'ajoutent à ce qui s'y trouve déjà. */
export function mergeIntoCart(cart: Record<string, number>, lines: { itemId: string; quantity: number }[]): Record<string, number> {
  const next = { ...cart };
  for (const { itemId, quantity } of lines) next[itemId] = (next[itemId] ?? 0) + quantity;
  return next;
}
