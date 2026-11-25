import { describe, expect, it } from 'vitest';
import { sinceLabel } from '@/components/pages/dashboard/alerts-logic';
import { formatDistance, zoneLabel } from '@/components/pages/requests/zone-logic';
import { validateSessionSecurity } from '@/components/pages/settings/session-security-logic';
import { tableLook, TONE_BADGE, TONE_CARD, TONE_LEGEND } from '@/components/pages/tables/tables-logic';
import { MARKER_COUNT, markerInfo } from '@/contracts/session-markers';

describe('Spec 027 — une session par client', () => {
  it('CA-027-02 — 16 repères tous différents (forme + couleur), deux voisins diffèrent par la forme et la couleur', () => {
    const markers = Array.from({ length: MARKER_COUNT }, (_, index) => markerInfo(index));
    expect(new Set(markers.map((m) => `${m.shape}-${m.color}`)).size).toBe(MARKER_COUNT);
    expect(new Set(markers.map((m) => m.name)).size).toBe(MARKER_COUNT);
    for (let i = 0; i + 1 < MARKER_COUNT; i += 1) {
      expect(markers[i].shape).not.toBe(markers[i + 1].shape);
      expect(markers[i].color).not.toBe(markers[i + 1].color);
    }
  });

  it('CA-027-03 — le repère se lit aussi par son nom (lecteur d’écran, personnel)', () => {
    expect(markerInfo(0).name).toBe('cercle vert');
    expect(markerInfo(1).name).toBe('carré bleu');
    // Un index hors catalogue (reprise de données) retombe dans le catalogue.
    expect(markerInfo(16)).toEqual(markerInfo(0));
  });

  it('CA-027-09 — table servie non réglée : « À régler », distincte de « Servie » et de « Libre »', () => {
    expect(tableLook('occupied', [], Date.now(), true, true)).toMatchObject({ tone: 'toSettle', label: 'À régler' });
    expect(tableLook('occupied', [], Date.now(), true, false).tone).toBe('served');
    expect(tableLook('free', [], Date.now(), false, false).tone).toBe('free');
    expect(TONE_CARD.toSettle).not.toBe(TONE_CARD.served);
    expect(TONE_BADGE.toSettle).not.toBe(TONE_BADGE.progress);
    expect(TONE_LEGEND.map((entry) => entry.label)).toContain('À régler');
  });

  it('CA-027-10 à 12 — signalement de zone côté personnel', () => {
    expect(zoneLabel({ status: 'outside', distanceM: 2000 })).toBe('Hors zone · 2 km');
    expect(zoneLabel({ status: 'outside', distanceM: 230 })).toBe('Hors zone · 230 m');
    expect(zoneLabel({ status: 'imprecise', distanceM: null })).toBe('Position imprécise');
    expect(zoneLabel({ status: 'denied', distanceM: null })).toBe('Position refusée');
    expect(zoneLabel({ status: 'inside', distanceM: null })).toBeNull();
    expect(zoneLabel(null)).toBeNull();
    expect(formatDistance(2300)).toBe('2,3 km');
  });

  it('CA-027-15 — durée sans règlement de l’alerte', () => {
    const now = Date.parse('2026-11-25T19:30:00Z');
    expect(sinceLabel('2026-11-25T19:10:00Z', now)).toBe('depuis 20 min');
    expect(sinceLabel('2026-11-25T18:25:00Z', now)).toBe('depuis 1 h 05');
  });

  it('CA-027-25 — bornes du rayon et du délai', () => {
    expect(validateSessionSecurity(150, 20)).toEqual({});
    expect(Object.keys(validateSessionSecurity(20, 90)).sort()).toEqual(['unpaidAlertMinutes', 'zoneRadiusM']);
    expect(validateSessionSecurity(500, 60)).toEqual({});
  });
});
