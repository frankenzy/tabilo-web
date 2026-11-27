/**
 * Spec 039 : créneaux horaires, même règle que l'API (backend/src/commons/utils/slots.ts).
 * Jours ISO (1 = lundi … 7 = dimanche), heures « HH:MM » au fuseau de l'établissement ; une fin avant le début passe minuit.
 * L'API seule décide du prix et de la disponibilité (R4) : ici, on affiche.
 */
export interface Slot {
  days: number[];
  start: string;
  end: string;
}

export const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const minutes = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export function localTime(date: Date, timeZone: string): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return { day: WEEKDAYS[get('weekday')] ?? 1, minute: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** Le créneau en cours, ou null. */
export function currentSlot(slots: Slot[] | null | undefined, date: Date, timeZone: string): Slot | null {
  if (!slots || slots.length === 0) return null;
  const { day, minute } = localTime(date, timeZone);
  const previous = day === 1 ? 7 : day - 1;
  return (
    slots.find((slot) => {
      const start = minutes(slot.start);
      const end = minutes(slot.end);
      if (start < end) return slot.days.includes(day) && minute >= start && minute < end;
      return (slot.days.includes(day) && minute >= start) || (slot.days.includes(previous) && minute < end);
    }) ?? null
  );
}

/** Ouvert maintenant : sans créneau, toujours. */
export function isOpen(slots: Slot[] | null | undefined, date: Date, timeZone: string): boolean {
  return !slots || slots.length === 0 || currentSlot(slots, date, timeZone) !== null;
}

/** Prochaine ouverture, en « HH:MM » (aujourd'hui) ou « Jour HH:MM » (sur 7 jours). */
export function nextOpening(slots: Slot[] | null | undefined, date: Date, timeZone: string): string | null {
  if (!slots || slots.length === 0) return null;
  const { day, minute } = localTime(date, timeZone);
  for (let offset = 0; offset < 8; offset += 1) {
    const d = ((day - 1 + offset) % 7) + 1;
    const starts = slots
      .filter((slot) => slot.days.includes(d))
      .map((slot) => slot.start)
      .filter((start) => offset > 0 || minutes(start) > minute)
      .sort();
    if (starts.length > 0) return offset === 0 ? starts[0].replace(':', ' h ').replace(' h 00', ' h') : `${DAY_LABELS[d - 1]} ${starts[0].replace(':', ' h ').replace(' h 00', ' h')}`;
  }
  return null;
}

/** « 19 h » ou « 19 h 30 ». */
export function hourLabel(time: string): string {
  return time.replace(':', ' h ').replace(' h 00', ' h');
}
