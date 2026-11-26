'use client';

import { Plus, Trash2 } from 'lucide-react';
import { cn, randomId } from '@/lib/utils';

/** Spec 038, R1 : un groupe d'options en cours d'édition. Les montants sont saisis en F (unités majeures). */
export interface OptionDraft {
  key: string;
  id?: string;
  name: string;
  price: string;
  isAvailable: boolean;
}

export interface OptionGroupDraft {
  key: string;
  name: string;
  multiple: boolean;
  required: boolean;
  options: OptionDraft[];
}

export const newOption = (): OptionDraft => ({ key: randomId(), name: '', price: '0', isAvailable: true });
export const newGroup = (): OptionGroupDraft => ({ key: randomId(), name: '', multiple: false, required: true, options: [newOption(), newOption()] });

const field = 'h-9 rounded-lg border border-line bg-surface px-2.5 text-[14px] text-ink outline-none focus:border-ink-3';

/** Spec 038, P1 : groupes (nom, un ou plusieurs choix, obligatoire), options (nom, supplément, disponible). */
export function OptionGroupsEditor({ groups, currency, onChange }: { groups: OptionGroupDraft[]; currency: string; onChange: (groups: OptionGroupDraft[]) => void }) {
  const update = (key: string, change: Partial<OptionGroupDraft>) => onChange(groups.map((group) => (group.key === key ? { ...group, ...change } : group)));
  const updateOption = (group: OptionGroupDraft, key: string, change: Partial<OptionDraft>) =>
    update(group.key, { options: group.options.map((option) => (option.key === key ? { ...option, ...change } : option)) });

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-[13px] font-medium text-ink">Options et suppléments (facultatif)</legend>
      {groups.map((group) => (
        <div key={group.key} className="rounded-xl bg-sunken/60 p-3 ring-1 ring-line">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={group.name}
              onChange={(event) => update(group.key, { name: event.target.value })}
              placeholder="Ex. : Taille"
              maxLength={40}
              aria-label="Nom du groupe"
              className={cn(field, 'min-w-0 flex-1')}
            />
            <label className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
              <input type="checkbox" checked={group.required} onChange={(event) => update(group.key, { required: event.target.checked })} />
              Obligatoire
            </label>
            <label className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
              <input type="checkbox" checked={group.multiple} onChange={(event) => update(group.key, { multiple: event.target.checked })} />
              Plusieurs choix
            </label>
            <button
              type="button"
              onClick={() => onChange(groups.filter((other) => other.key !== group.key))}
              aria-label={`Retirer le groupe ${group.name}`}
              className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-surface hover:text-late"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {group.options.map((option) => (
              <li key={option.key} className="flex items-center gap-2">
                <input
                  value={option.name}
                  onChange={(event) => updateOption(group, option.key, { name: event.target.value })}
                  placeholder="Ex. : Moyen"
                  maxLength={40}
                  aria-label="Nom de l’option"
                  className={cn(field, 'min-w-0 flex-1')}
                />
                <span className="text-[13px] text-ink-3">+</span>
                <input
                  value={option.price}
                  onChange={(event) => updateOption(group, option.key, { price: event.target.value })}
                  inputMode="decimal"
                  aria-label={`Supplément (${currency})`}
                  className={cn(field, 'w-24 text-right')}
                />
                <label className="inline-flex items-center gap-1 text-[12px] text-ink-2" title="Décochez si l’option manque aujourd’hui">
                  <input type="checkbox" checked={option.isAvailable} onChange={(event) => updateOption(group, option.key, { isAvailable: event.target.checked })} />
                  Dispo
                </label>
                {group.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => update(group.key, { options: group.options.filter((other) => other.key !== option.key) })}
                    aria-label={`Retirer l’option ${option.name}`}
                    className="grid size-8 place-items-center rounded-lg text-ink-3 hover:text-late"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {group.options.length < 10 && (
            <button type="button" onClick={() => update(group.key, { options: [...group.options, newOption()] })} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-ink">
              <Plus className="size-4" aria-hidden />
              Ajouter une option
            </button>
          )}
        </div>
      ))}
      {groups.length < 4 && (
        <button
          type="button"
          onClick={() => onChange([...groups, newGroup()])}
          className="inline-flex h-9 items-center gap-1.5 self-start rounded-lg px-3 text-[13px] font-medium text-ink ring-1 ring-line hover:bg-sunken"
        >
          <Plus className="size-4" aria-hidden />
          Ajouter un groupe d’options
        </button>
      )}
    </fieldset>
  );
}
