/**
 * Spec 027, R2 : catalogue des 16 repères de session (même ordre que l'API, `markerIndex`).
 * Formes géométriques sobres, couleurs pleines ; deux repères voisins diffèrent par la forme ET la couleur,
 * et chaque forme existe en deux couleurs (index i et i + 8) : reconnaissable sans lire, et sans voir les couleurs.
 */
export const MARKER_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'hexagon', 'star', 'pentagon', 'octagon'] as const;
export type MarkerShape = (typeof MARKER_SHAPES)[number];

/** Couleurs assez foncées pour une forme blanche lisible (contraste ≥ 4,5:1), en clair comme en sombre. */
export const MARKER_COLORS = [
  { name: 'vert', hex: '#1f7a4d' },
  { name: 'bleu', hex: '#2459d6' },
  { name: 'orange', hex: '#c2410c' },
  { name: 'violet', hex: '#6d28d9' },
  { name: 'rose', hex: '#be185d' },
  { name: 'turquoise', hex: '#0f766e' },
  { name: 'ocre', hex: '#9a5b00' },
  { name: 'ardoise', hex: '#475569' },
] as const;

const SHAPE_NAMES: Record<MarkerShape, string> = {
  circle: 'cercle',
  square: 'carré',
  triangle: 'triangle',
  diamond: 'losange',
  hexagon: 'hexagone',
  star: 'étoile',
  pentagon: 'pentagone',
  octagon: 'octogone',
};

export const MARKER_COUNT = 16;

export interface SessionMarkerInfo {
  index: number;
  shape: MarkerShape;
  color: string;
  /** « cercle vert » : nom accessible, et libellé pour le personnel. */
  name: string;
}

export function markerInfo(index: number): SessionMarkerInfo {
  const i = ((index % MARKER_COUNT) + MARKER_COUNT) % MARKER_COUNT;
  const shapeIndex = i % MARKER_SHAPES.length;
  const colorIndex = (shapeIndex + (i >= MARKER_SHAPES.length ? 3 : 0)) % MARKER_COLORS.length;
  const shape = MARKER_SHAPES[shapeIndex];
  const color = MARKER_COLORS[colorIndex];
  return { index: i, shape, color: color.hex, name: `${SHAPE_NAMES[shape]} ${color.name}` };
}
