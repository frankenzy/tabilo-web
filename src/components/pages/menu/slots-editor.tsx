'use client';

import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DAY_LABELS, type Slot } from '@/utils/slots';

const QUARTERS = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`);

/** Spec 039, R1 : 1 à 3 créneaux — jours de la semaine, début et fin au quart d'heure (une fin avant le début passe minuit). */
export function SlotsEditor({ label, slots, onChange }: { label: string; slots: Slot[]; onChange: (slots: Slot[]) => void }) {
  const update = (index: number, change: Partial<Slot>) => onChange(slots.map((slot, i) => (i === index ? { ...slot, ...change } : slot)));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] font-medium text-ink-2">{label}</p>
      {slots.map((slot, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg bg-sunken/60 p-2">
          <div className="flex gap-1" role="group" aria-label="Jours">
            {DAY_LABELS.map((day, dayIndex) => {
              const value = dayIndex + 1;
              const on = slot.days.includes(value);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update(index, { days: on ? slot.days.filter((d) => d !== value) : [...slot.days, value].sort() })}
                  className={cn('h-8 w-9 rounded-md text-[12px] font-medium ring-1', on ? 'bg-ink text-white ring-ink' : 'bg-surface text-ink-2 ring-line')}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <select value={slot.start} onChange={(event) => update(index, { start: event.target.value })} aria-label="Début" className="h-8 rounded-md border border-line bg-surface px-1.5 text-[13px]">
            {QUARTERS.map((time) => (
              <option key={time}>{time}</option>
            ))}
          </select>
          <span className="text-[13px] text-ink-3">→</span>
          <select value={slot.end} onChange={(event) => update(index, { end: event.target.value })} aria-label="Fin" className="h-8 rounded-md border border-line bg-surface px-1.5 text-[13px]">
            {QUARTERS.map((time) => (
              <option key={time}>{time}</option>
            ))}
          </select>
          <button type="button" onClick={() => onChange(slots.filter((_, i) => i !== index))} aria-label="Retirer le créneau" className="grid size-8 place-items-center text-ink-3 hover:text-late">
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}
      {slots.length < 3 && (
        <button
          type="button"
          onClick={() => onChange([...slots, { days: [1, 2, 3, 4, 5, 6, 7], start: '17:00', end: '19:00' }])}
          className="inline-flex items-center gap-1 self-start text-[13px] font-medium text-ink"
        >
          <Plus className="size-4" aria-hidden />
          Ajouter un créneau
        </button>
      )}
    </div>
  );
}

/** Erreur à afficher, ou null (même règle que l'API : au moins un jour, début ≠ fin). */
export function slotsDraftError(slots: Slot[]): string | null {
  if (slots.some((slot) => slot.days.length === 0)) return 'Chaque créneau a au moins un jour.';
  if (slots.some((slot) => slot.start === slot.end)) return 'Le début et la fin d’un créneau doivent différer.';
  return null;
}
