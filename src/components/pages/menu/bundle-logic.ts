/** Spec 032, R1 : une rubrique de formule en cours d'édition. */
export interface BundleGroupDraft {
  key: string;
  name: string;
  choiceIds: string[];
}

export const MAX_GROUPS = 4;
export const MAX_CHOICES = 12;

/** Erreur à afficher, ou null si les rubriques sont valides (1 à 4, un nom, 1 à 12 plats chacune). */
export function bundleGroupsError(groups: BundleGroupDraft[]): string | null {
  if (groups.length === 0 || groups.length > MAX_GROUPS) return 'Une formule a de 1 à 4 rubriques.';
  const unnamed = groups.find((group) => !group.name.trim());
  if (unnamed) return 'Donnez un nom à chaque rubrique (ex. : Plat, Boisson).';
  const empty = groups.find((group) => group.choiceIds.length === 0);
  if (empty) return `Choisissez au moins un plat pour « ${empty.name.trim()} ».`;
  if (groups.some((group) => group.choiceIds.length > MAX_CHOICES)) return '12 plats au plus par rubrique.';
  return null;
}
