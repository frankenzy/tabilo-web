/**
 * Spec 031, R2 : palette fermée de la couleur principale d'un établissement.
 * Chaque teinte garde au moins 4,5:1 avec le texte blanc des boutons, et reste nettement différente des couleurs
 * d'état : au moins 25° d'écart de teinte, ou 1,8:1 de contraste avec elles. L'orange TABILO, par défaut, fait exception (4,3:1).
 * L'API ne stocke que la clé (`backend/src/resources/establishments/branding.ts`).
 */
export const BRAND_PALETTE = {
  orange: { label: 'Orange TABILO', brand: '#d9480f', strong: '#b83a09', soft: '#fdeee6' },
  bordeaux: { label: 'Bordeaux', brand: '#8a1c3a', strong: '#6e1530', soft: '#f8e8ec' },
  foret: { label: 'Vert forêt', brand: '#2d5a27', strong: '#22461d', soft: '#e9f1e7' },
  chocolat: { label: 'Brun chocolat', brand: '#6b3e26', strong: '#55301d', soft: '#f4ebe5' },
  nuit: { label: 'Bleu nuit', brand: '#172554', strong: '#0f1a3d', soft: '#e7eaf4' },
  framboise: { label: 'Framboise', brand: '#be185d', strong: '#9d174d', soft: '#fbe7f0' },
  olive: { label: 'Vert olive', brand: '#4d5a12', strong: '#3c470d', soft: '#eef0e1' },
  prune: { label: 'Prune', brand: '#701a75', strong: '#58145c', soft: '#f5e8f6' },
} as const;

export type BrandColor = keyof typeof BRAND_PALETTE;
export const BRAND_COLORS = Object.keys(BRAND_PALETTE) as BrandColor[];
export const DEFAULT_BRAND: BrandColor = 'orange';

/** Spec 031, R6. */
export const WELCOME_MAX = 80;

export function brandOf(key: string | null | undefined): (typeof BRAND_PALETTE)[BrandColor] {
  return BRAND_PALETTE[(key ?? DEFAULT_BRAND) as BrandColor] ?? BRAND_PALETTE[DEFAULT_BRAND];
}

/**
 * Spec 031, R3 et R4 : seules les trois variables de la couleur principale changent.
 * Les couleurs d'état, les repères de session et le reste du thème ne sont jamais touchés.
 */
export function brandVariables(key: string | null | undefined): Record<'--color-brand' | '--color-brand-strong' | '--color-brand-soft', string> {
  const color = brandOf(key);
  return { '--color-brand': color.brand, '--color-brand-strong': color.strong, '--color-brand-soft': color.soft };
}

/** Spec 031, R5 : sans logo, l'initiale du nom. */
export function initialOf(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase('fr-FR') || 'T';
}
