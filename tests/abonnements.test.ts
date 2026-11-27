import { describe, expect, it } from 'vitest';
import { accountBanner, daysLeft, hasFeature, whatsappLink } from '@/components/pages/subscription/subscription-logic';
import { visibleNav } from '@/components/layouts/navigation';
import type { AccountInfo } from '@/contracts';

/** Specs 034 et 035 — cadenas, bandeaux d'échéance, accès à la page « Abonnement ». */

const now = Date.parse('2026-12-01T10:00:00Z');
const account = (extra: Partial<AccountInfo> = {}): AccountInfo => ({
  plan: 'pro', planName: 'Pro', state: 'trial', paidUntil: '2026-12-08T10:00:00Z', graceUntil: '2026-12-15T10:00:00Z',
  features: ['bundles', 'promotions', 'yearly_stats', 'custom_roles'], contact: '+225 05 84 77 73 67', ...extra,
});

describe('Specs 034 et 035 — abonnement', () => {
  it('CA-034-04 — un module hors formule est fermé ; sans information, rien n’est fermé', () => {
    expect(hasFeature(account({ plan: 'essentiel', features: [] }), 'bundles')).toBe(false);
    expect(hasFeature(account(), 'bundles')).toBe(true);
    expect(hasFeature(undefined, 'bundles')).toBe(true);
  });

  it('CA-035-02 — bandeau 7 jours avant : dates pour le propriétaire, message générique pour l’équipe', () => {
    expect(daysLeft('2026-12-08T10:00:00Z', now)).toBe(7);
    const owner = accountBanner(account(), true, now);
    expect(owner).toMatchObject({ tone: 'warn' });
    expect(owner?.title).toContain('8 décembre');
    expect(owner?.detail).toContain('+225 05 84 77 73 67');
    expect(accountBanner(account(), false, now)?.title).toBe('Abonnement à renouveler : prévenez le responsable.');
    expect(accountBanner(account({ state: 'active', paidUntil: '2027-01-08T10:00:00Z' }), true, now)).toBeNull();
  });

  it('CA-035-03 — en retard : bandeau rouge avec la date d’arrêt ; suspendu : bandeau rouge', () => {
    expect(accountBanner(account({ state: 'past_due' }), true, now)).toMatchObject({ tone: 'danger' });
    expect(accountBanner(account({ state: 'past_due' }), true, now)?.title).toContain('15 décembre');
    expect(accountBanner(account({ state: 'suspended' }), false, now)).toMatchObject({ tone: 'danger' });
  });

  it('CA-034-06 — « Abonnement » dans le menu du seul propriétaire ; lien WhatsApp', () => {
    expect(visibleNav(['roles.manage']).map((item) => item.label)).toContain('Abonnement');
    expect(visibleNav(['establishment.update', 'analytics.read']).map((item) => item.label)).not.toContain('Abonnement');
    expect(whatsappLink('+225 05 84 77 73 67')).toBe('https://wa.me/2250584777367');
  });
});
