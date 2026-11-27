import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRAND_COLORS, BRAND_PALETTE, brandOf, brandVariables, initialOf } from '@/constants/branding';
import { guestContextSchema } from '@/contracts';

/** Spec 031 — apparence de l'établissement : palette, variables et valeurs par défaut. */

const hex = (value: string) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
const luminance = (value: string) => {
  const [r, g, b] = hex(value).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hue = (value: string) => {
  const [r, g, b] = hex(value);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const hueGap = (a: string, b: string) => Math.abs(((hue(a) - hue(b) + 540) % 360) - 180);

/** Couleurs d'état lues dans le thème : la palette doit s'en distinguer (R2, R4). */
const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const STATES = ['late', 'progress', 'done', 'ready', 'pay', 'call', 'message'].map((name) => {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`couleur d'état introuvable : ${name}`);
  return { name, value: match[1] };
});

describe('Spec 031 — apparence', () => {
  it('CA-031-01 — par défaut : orange TABILO, sans logo ni mot d’accueil, initiale du nom', () => {
    const context = guestContextSchema.parse({
      establishment: { name: 'chez Awa', currency: 'XOF' },
      table: { label: '4', area: 'Salle' },
      requestTypes: [],
      menu: [],
      orderingEnabled: false,
    });
    expect(context.establishment).toMatchObject({ brandColor: 'orange', logoImageId: null, welcomeText: null });
    expect(brandOf(undefined).brand).toBe('#d9480f');
    expect(brandOf('inconnue').brand).toBe('#d9480f');
    expect(initialOf('chez Awa')).toBe('C');
  });

  it('R2 — huit couleurs, contraste 4,5:1 avec le blanc (l’orange TABILO fait exception)', () => {
    expect(BRAND_COLORS).toHaveLength(8);
    for (const key of BRAND_COLORS) {
      if (key === 'orange') continue;
      expect(contrast(BRAND_PALETTE[key].brand, '#ffffff'), key).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('CA-031-04 — chaque couleur de la palette reste distincte des couleurs d’état', () => {
    for (const key of BRAND_COLORS) {
      if (key === 'orange') continue;
      for (const state of STATES) {
        const distinct = hueGap(BRAND_PALETTE[key].brand, state.value) >= 25 || contrast(BRAND_PALETTE[key].brand, state.value) >= 1.8;
        expect(distinct, `${key} / ${state.name}`).toBe(true);
      }
    }
  });

  it('CA-031-04 — seules les variables de la couleur principale changent', () => {
    expect(Object.keys(brandVariables('foret')).sort()).toEqual(['--color-brand', '--color-brand-soft', '--color-brand-strong']);
    expect(brandVariables('foret')['--color-brand']).toBe('#2d5a27');
  });
});
