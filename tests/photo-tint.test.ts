import { describe, expect, it } from 'vitest';
import { dominantColor } from '@/components/pages/guest/photo-tint';

/** Construit des pixels RVBA : `count` fois chaque couleur. */
function pixels(...colors: [number, number, number, number][]): Uint8ClampedArray {
  return new Uint8ClampedArray(colors.flatMap(([r, g, b, n]) => Array.from({ length: n }, () => [r, g, b, 255]).flat()));
}

describe('Spec 012, R8 — teinte de la fiche tirée de la photo', () => {
  it('une couleur vive l’emporte sur un fond gris plus étendu', () => {
    const color = dominantColor(pixels([128, 128, 128, 60], [220, 60, 30, 40]));
    const [r, , b] = color!.match(/\d+/g)!.map(Number);
    expect(r).toBeGreaterThan(b + 50); // nettement orangé, pas gris
  });

  it('une photo uniforme donne sa propre couleur', () => {
    expect(dominantColor(pixels([40, 120, 200, 10]))).toBe('rgb(40 120 200)');
  });

  it('une photo entièrement transparente ne donne pas de teinte', () => {
    expect(dominantColor(new Uint8ClampedArray([10, 10, 10, 0, 20, 20, 20, 0]))).toBeNull();
  });
});
