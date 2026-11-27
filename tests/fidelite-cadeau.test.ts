import { describe, expect, it } from 'vitest';
import { loyaltyNeedsAttention, loyaltyStatus } from '@/components/pages/guest/loyalty-logic';
import type { LoyaltyCard } from '@/contracts';

/** Spec 043, R8 — la carte de fidélité derrière l'icône cadeau, à droite du nom. */

const card = (extra: Partial<NonNullable<LoyaltyCard>> = {}): LoyaltyCard => ({
  mode: 'classic', stamps: 3, stampsRequired: 10, minOrderMinor: 2000, rewardItemId: 'poulet', surprise: null, redemption: null, ...extra,
});

describe('Spec 043 — le cadeau à côté du nom', () => {
  it('CA-043-06 — sans carte de fidélité, aucune icône', () => {
    expect(loyaltyStatus(null)).toBe('none');
    expect(loyaltyStatus(undefined)).toBe('none');
  });

  it('CA-043-06 — carte en cours : icône sans pastille', () => {
    expect(loyaltyStatus(card())).toBe('progress');
    expect(loyaltyNeedsAttention('progress')).toBe(false);
  });

  it('CA-043-06 — carte pleine : icône avec pastille', () => {
    expect(loyaltyStatus(card({ stamps: 10 }))).toBe('ready');
    expect(loyaltyNeedsAttention('ready')).toBe(true);
  });

  it('CA-043-06 — récompense demandée : pastille jusqu’à la validation du serveur', () => {
    expect(loyaltyStatus(card({ stamps: 10, redemption: { id: 'r', validated: false } }))).toBe('pending');
    expect(loyaltyNeedsAttention('pending')).toBe(true);
    expect(loyaltyStatus(card({ stamps: 0, redemption: { id: 'r', validated: true } }))).toBe('validated');
    expect(loyaltyNeedsAttention('validated')).toBe(false);
  });
});
