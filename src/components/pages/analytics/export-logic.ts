/** Spec 040, R1 : périodes d'export, en dates locales AAAA-MM-JJ (du premier au dernier jour inclus). */
export type ExportPreset = 'today' | 'yesterday' | 'week' | 'month' | 'previous_month' | 'custom';

export const EXPORT_PRESETS: { value: ExportPreset; label: string }[] = [
  { value: 'today', label: 'Aujourd’hui' },
  { value: 'yesterday', label: 'Hier' },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'previous_month', label: 'Le mois précédent' },
  { value: 'custom', label: 'Choisir les dates' },
];

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function presetRange(preset: Exclude<ExportPreset, 'custom'>, now: Date): { from: string; to: string } {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'today') return { from: iso(day), to: iso(day) };
  if (preset === 'yesterday') {
    const yesterday = new Date(day);
    yesterday.setDate(day.getDate() - 1);
    return { from: iso(yesterday), to: iso(yesterday) };
  }
  if (preset === 'week') {
    // Semaine du lundi au jour même.
    const monday = new Date(day);
    monday.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    return { from: iso(monday), to: iso(day) };
  }
  if (preset === 'month') return { from: iso(new Date(day.getFullYear(), day.getMonth(), 1)), to: iso(day) };
  return { from: iso(new Date(day.getFullYear(), day.getMonth() - 1, 1)), to: iso(new Date(day.getFullYear(), day.getMonth(), 0)) };
}
