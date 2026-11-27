import { describe, expect, it } from 'vitest';
import { paginate, TEMPLATES } from '@/components/pages/floor/qr-templates';

/** Spec 042 — modèles d'impression sur A4. */
const A4 = { width: 210, height: 297 };
const MARGIN = 6;
const GAP = 4;

describe('Spec 042 — QR imprimables', () => {
  it('R2 et R3 — chaque modèle tient sur une feuille A4, QR de 4 cm au moins', () => {
    for (const [key, spec] of Object.entries(TEMPLATES)) {
      const rows = Math.ceil(spec.perPage / spec.columns);
      // Le chevalet empile deux faces par emplacement.
      const faceRows = key === 'tent' ? rows * 2 : rows;
      const width = spec.columns * spec.width + (spec.columns - 1) * GAP + 2 * MARGIN;
      const height = faceRows * spec.height + (key === 'tent' ? 0 : (rows - 1) * GAP) + 2 * MARGIN;
      expect(width, key).toBeLessThanOrEqual(A4.width);
      expect(height, key).toBeLessThanOrEqual(A4.height);
      expect(spec.qr, key).toBeGreaterThanOrEqual(40);
    }
  });

  it('CA-042-01 — 12 tables en chevalets : 6 pages', () => {
    expect(paginate(Array.from({ length: 12 }, (_, i) => i), TEMPLATES.tent.perPage)).toHaveLength(6);
    expect(paginate(Array.from({ length: 13 }, (_, i) => i), TEMPLATES.sticker.perPage).map((page) => page.length)).toEqual([6, 6, 1]);
  });
});
