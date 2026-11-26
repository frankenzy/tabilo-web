'use client';

import { Check, Plus, Trash2 } from 'lucide-react';
import type { MenuCategory } from '@/contracts';
import { cn, randomId } from '@/lib/utils';

import { bundleGroupsError, MAX_CHOICES, MAX_GROUPS, type BundleGroupDraft } from './bundle-logic';

export { bundleGroupsError, type BundleGroupDraft };

/**
 * Spec 032, P1 : les rubriques d'une formule. Chaque rubrique a un nom et des plats cochés parmi la carte
 * (les formules ne se composent pas d'autres formules).
 */
export function BundleGroupsEditor({
  groups,
  categories,
  excludeId,
  onChange,
}: {
  groups: BundleGroupDraft[];
  categories: MenuCategory[];
  excludeId?: string;
  onChange: (groups: BundleGroupDraft[]) => void;
}) {
  const sections = categories
    .map((category) => ({ ...category, items: category.items.filter((item) => !item.isBundle && item.id !== excludeId) }))
    .filter((category) => category.items.length > 0);
  const update = (key: string, change: Partial<BundleGroupDraft>) => onChange(groups.map((group) => (group.key === key ? { ...group, ...change } : group)));

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-[13px] font-medium text-ink">Rubriques de la formule</legend>
      {groups.map((group, index) => (
        <div key={group.key} className="rounded-xl bg-sunken/60 p-3 ring-1 ring-line">
          <div className="flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-semibold text-white" aria-hidden>
              {index + 1}
            </span>
            <input
              value={group.name}
              onChange={(event) => update(group.key, { name: event.target.value })}
              maxLength={40}
              placeholder={index === 0 ? 'Plat' : index === 1 ? 'Boisson' : 'Dessert'}
              aria-label={`Nom de la rubrique ${index + 1}`}
              className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[14px] text-ink outline-none focus:border-ink-3"
            />
            <span className="tabular shrink-0 text-[12px] text-ink-3">{group.choiceIds.length} plat{group.choiceIds.length > 1 ? 's' : ''}</span>
            {groups.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(groups.filter((other) => other.key !== group.key))}
                aria-label={`Retirer la rubrique ${group.name || index + 1}`}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface hover:text-late"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <div className="mt-2.5 flex max-h-44 flex-col gap-2 overflow-y-auto pr-1">
            {sections.map((category) => (
              <div key={category.id}>
                <p className="mb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{category.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {category.items.map((item) => {
                    const checked = group.choiceIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={checked}
                        disabled={!checked && group.choiceIds.length >= MAX_CHOICES}
                        onClick={() =>
                          update(group.key, { choiceIds: checked ? group.choiceIds.filter((id) => id !== item.id) : [...group.choiceIds, item.id] })
                        }
                        className={cn(
                          'inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium ring-1 transition-colors disabled:opacity-40',
                          checked ? 'bg-ink text-white ring-ink' : 'bg-surface text-ink-2 ring-line hover:text-ink',
                        )}
                      >
                        {checked && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {groups.length < MAX_GROUPS && (
        <button
          type="button"
          onClick={() => onChange([...groups, { key: randomId(), name: '', choiceIds: [] }])}
          className="inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-lg px-3 text-[13px] font-medium text-ink ring-1 ring-line hover:bg-sunken"
        >
          <Plus className="size-4" aria-hidden />
          Ajouter une rubrique
        </button>
      )}
    </fieldset>
  );
}
