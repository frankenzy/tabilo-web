'use client';

import type { OrderLine } from '@/contracts';
import { useCurrency } from '@/hooks/use-currency';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/money';

/** Contenu d'une commande (spec 001, CA-001-22) : quantité × article, puis le total. */
export function OrderLines({ items, totalMinor, compact = false }: { items: OrderLine[]; totalMinor: number | null; compact?: boolean }) {
  const currency = useCurrency();
  if (items.length === 0) return null;
  return (
    <div className={cn('rounded-lg bg-sunken px-3 py-2', compact ? 'mt-1.5' : 'mt-4')}>
      <ul className="flex flex-col gap-0.5 text-sm text-ink">
        {items.map((line, index) => (
          <li key={`${line.name}-${index}`} className="flex justify-between gap-3">
            <span className="min-w-0">
              <span className="tabular font-semibold">{line.quantity} ×</span> {line.name}
              {/* Spec 032 : les choix de la formule. */}
              {((line.choices?.length ?? 0) > 0 || (line.options?.length ?? 0) > 0) && (
                <span className="block pl-5 text-[13px] text-ink-2">{[...(line.choices ?? []), ...(line.options ?? [])].map((part) => part.name).join(' · ')}</span>
              )}
            </span>
            {!compact && <span className="tabular shrink-0 text-ink-2">{formatMoney(line.unitPriceMinor * line.quantity, currency)}</span>}
          </li>
        ))}
      </ul>
      {totalMinor !== null && (
        <p className="mt-1 flex justify-between border-t border-line pt-1 text-[13px] text-ink-2">
          <span>Total</span>
          <span className="tabular font-semibold text-ink">{formatMoney(totalMinor, currency)}</span>
        </p>
      )}
    </div>
  );
}
