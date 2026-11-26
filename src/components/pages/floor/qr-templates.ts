/**
 * Spec 042, R2 : modèles d'impression sur A4 (210 × 297 mm). Dimensions en millimètres, pour la feuille imprimée.
 */
export type QrTemplate = 'tent' | 'card' | 'sticker';

export interface TemplateSpec {
  label: string;
  perPage: number;
  columns: number;
  /** Taille d'une face (mm), marges d'impression comprises : 2 × 138 mm (hauteur) et 2 × 96 mm (largeur), avec marges et espacement, tiennent sur 210 × 297 mm. Le chevalet a deux faces, la seconde retournée pour le pliage. */
  width: number;
  height: number;
  /** Côté du QR (mm) : 40 mm au moins (R3). */
  qr: number;
}

export const TEMPLATES: Record<QrTemplate, TemplateSpec> = {
  tent: { label: 'Chevalet plié (2 par page)', perPage: 2, columns: 2, width: 96, height: 138, qr: 56 },
  card: { label: 'Carte A6 à plat (4 par page)', perPage: 4, columns: 2, width: 96, height: 138, qr: 56 },
  sticker: { label: 'Autocollant 8 cm (6 par page)', perPage: 6, columns: 2, width: 80, height: 80, qr: 42 },
};

/** Découpe en pages de `perPage` éléments. */
export function paginate<T>(items: T[], perPage: number): T[][] {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += perPage) pages.push(items.slice(index, index + perPage));
  return pages;
}
