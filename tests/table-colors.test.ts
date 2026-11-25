import { describe, expect, it } from 'vitest';
import {
  CARD_BADGE,
  isActionTone,
  isServed,
  tableLook,
  TONE_CARD,
  TONE_LEGEND,
  type TableTone,
} from '@/components/pages/tables/tables-logic';
import { URGENCY_TILE } from '@/utils/urgency';

const T0 = Date.parse('2026-11-14T12:00:00Z');
const request = (status: string, ageSeconds: number) =>
  ({
    status,
    createdAt: new Date(T0 - ageSeconds * 1000).toISOString(),
    dueAt: new Date(T0 - ageSeconds * 1000 + 180_000).toISOString(),
    escalationStatus: 'none',
  }) as Parameters<typeof tableLook>[1][number];

const lookOf = (status: 'occupied' | 'free', amountMinor: number | null, requests: Parameters<typeof tableLook>[1]) =>
  tableLook(status, requests, T0, isServed({ status, amountMinor }, requests.length));

describe('Spec 023 — cartes des tables colorées selon leur état', () => {
  it('CA-023-01 — une table libre a un fond blanc et la pastille « Libre »', () => {
    const look = lookOf('free', null, []);
    expect(look).toMatchObject({ tone: 'free', label: 'Libre' });
    expect(TONE_CARD[look.tone]).toContain('bg-surface');
  });

  it('CA-023-02 — une table occupée sans commande a un fond orange pâle', () => {
    const look = lookOf('occupied', 0, []);
    expect(look).toMatchObject({ tone: 'occupied', label: 'Occupée' });
    expect(TONE_CARD[look.tone]).toContain('bg-brand-soft');
  });

  it('CA-023-03 — une commande prise en charge donne un fond bleu pâle', () => {
    const look = lookOf('occupied', 4500, [request('accepted', 60)]);
    expect(look).toMatchObject({ tone: 'progress', label: 'Prise en charge' });
    expect(TONE_CARD[look.tone]).toContain('bg-progress-soft');
  });

  it('CA-023-04 — une table dont la commande est servie a un fond vert pâle et la pastille « Servie »', () => {
    const look = lookOf('occupied', 12_000, []);
    expect(look).toMatchObject({ tone: 'served', label: 'Servie' });
    expect(TONE_CARD[look.tone]).toContain('bg-done-soft');
  });

  it('CA-023-05 — une nouvelle commande après le service fait repasser la table à « Nouvelle »', () => {
    expect(lookOf('occupied', 12_000, [request('pending', 10)])).toMatchObject({ tone: 'calm', label: 'Nouvelle' });
  });

  it('CA-023-06 — les tables à traiter ont un fond plein, texte blanc pour le retard et le plat prêt', () => {
    const late = lookOf('occupied', 5000, [request('pending', 240)]);
    const ready = lookOf('occupied', 5000, [request('ready', 60)]);
    expect(TONE_CARD[late.tone]).toBe('bg-late text-white');
    expect(TONE_CARD[ready.tone]).toBe('bg-ready text-white');
    expect(URGENCY_TILE.ready).toBe('bg-ready text-white');
    expect(URGENCY_TILE.calm).toBe('bg-ink-2 text-white');
  });

  it('CA-023-06 — fond plein seulement quand il faut agir ; aucun autre état n’utilise le vert de « Servie »', () => {
    const tones: TableTone[] = ['free', 'occupied', 'progress', 'served', 'calm', 'waiting', 'late', 'ready'];
    expect(tones.filter(isActionTone)).toEqual(['calm', 'waiting', 'late', 'ready']);
    tones
      .filter((tone) => tone !== 'served')
      .forEach((tone) => {
        expect(TONE_CARD[tone]).not.toContain('bg-done');
        expect(CARD_BADGE[tone]).not.toContain('bg-done');
      });
  });

  it('CA-023-07 — le montant n’est pas écrit en orange sur une carte colorée', () => {
    Object.values(TONE_CARD).forEach((classes) => expect(classes).not.toContain('text-brand'));
  });

  // Spec 027, R7 : « À régler » rejoint les états sans action, après « Servie ».
  it('CA-023-08 — la légende reprend les états, sans action puis à traiter', () => {
    expect(TONE_LEGEND.map((item) => item.label)).toEqual([
      'Libre',
      'Occupée',
      'Prise en charge',
      'Servie',
      'À régler',
      'Nouvelle',
      'En attente',
      'En retard',
      'Prête',
    ]);
  });

  it('une commande annulée seule ne rend pas la table « Servie »', () => {
    expect(isServed({ status: 'occupied', amountMinor: 0 }, 0)).toBe(false);
    expect(isServed({ status: 'free', amountMinor: null }, 0)).toBe(false);
    expect(isServed({ status: 'occupied', amountMinor: 3000 }, 1)).toBe(false);
  });
});
