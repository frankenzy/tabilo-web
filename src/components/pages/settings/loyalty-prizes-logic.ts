import type { LoyaltyPrize } from '@/contracts';

/** Spec 046, R2 : part de chance d'un lot, en pourcentage arrondi du total des chances. */
export function chanceShare(weight: number, prizes: Pick<LoyaltyPrize, 'weight'>[]): number {
  const total = prizes.reduce((sum, prize) => sum + prize.weight, 0);
  return total === 0 ? 0 : Math.round((weight / total) * 100);
}

export interface ProgramDraft {
  mode: 'classic' | 'surprise';
  surpriseMin: number;
  surpriseMax: number;
  stampsRequired: number;
  /** null : montant illisible. */
  minOrderMinor: number | null;
}

/**
 * Spec 046, R17 : le réglage en une phrase, qui suit la saisie.
 * « Un cadeau toutes les 2 à 5 visites d'au moins 2 000 F » ; null tant que la saisie est incomplète.
 */
export function programSentence(draft: ProgramDraft, format: (minor: number) => string): string | null {
  if (draft.minOrderMinor === null || draft.minOrderMinor < 0) return null;
  const visits = (count: string) => `${count} visites${draft.minOrderMinor ? ` d’au moins ${format(draft.minOrderMinor as number)}` : ''}`;
  const valid = (value: number, low: number, high: number) => Number.isInteger(value) && value >= low && value <= high;
  if (draft.mode === 'surprise') {
    if (!valid(draft.surpriseMin, 1, 20) || !valid(draft.surpriseMax, 1, 20) || draft.surpriseMin > draft.surpriseMax) return null;
    if (draft.surpriseMax === 1) return `Un cadeau à chaque visite${draft.minOrderMinor ? ` d’au moins ${format(draft.minOrderMinor)}` : ''}`;
    const range = draft.surpriseMin === draft.surpriseMax ? `${draft.surpriseMin}` : `${draft.surpriseMin} à ${draft.surpriseMax}`;
    return `Un cadeau toutes les ${visits(range)}`;
  }
  if (!valid(draft.stampsRequired, 5, 20)) return null;
  return `Un plat offert toutes les ${visits(String(draft.stampsRequired))}`;
}
