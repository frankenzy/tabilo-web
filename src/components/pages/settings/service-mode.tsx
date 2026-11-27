'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Banknote, Check, Receipt, Store, UtensilsCrossed, Zap, type LucideIcon } from 'lucide-react';
import type { Establishment, ServiceMode } from '@/contracts';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { cn } from '@/lib/utils';
import { establishmentApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { toast } from '@/stores/toast.store';

/** Spec 030, R1 et R11 : trois façons de servir, illustrées pour se choisir d'un coup d'œil. */
const MODES: { value: ServiceMode; title: string; kind: string; hint: string; icons: LucideIcon[] }[] = [
  {
    value: 'serve_then_pay',
    title: 'Servir puis régler',
    kind: 'Maquis',
    hint: 'Le client commande, il est servi, puis il demande l’addition.',
    icons: [UtensilsCrossed, Banknote],
  },
  {
    value: 'pay_anytime',
    title: 'Régler quand on veut',
    kind: 'Restaurant',
    hint: 'L’addition se demande dès la commande, même si un plat est encore en cuisine.',
    icons: [Receipt, UtensilsCrossed],
  },
  {
    value: 'pay_first',
    title: 'Régler à la caisse d’abord',
    kind: 'Comptoir',
    hint: 'La commande attend d’être encaissée ; « Encaissé » la fait partir en préparation.',
    icons: [Banknote, Store, UtensilsCrossed],
  },
];

/** Spec 030, P1 : la façon de servir s'enregistre d'un toucher ; les nouvelles commandes la suivent aussitôt. */
export function ServiceModeSettings({ data }: { data: Establishment }) {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const mode = data.serviceMode ?? 'serve_then_pay';
  const save = useMutation({
    mutationFn: (body: Pick<Establishment, 'serviceMode' | 'autoStartOrders'>) => establishmentApi.update(establishmentId, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(estKey(establishmentId, 'establishment'), updated);
      toast.success('Façon de servir enregistrée');
    },
    onError: (error) => toast.error('Réglage non enregistré', errorMessage(error)),
  });

  return (
    <section aria-labelledby="service-mode-title" className="flex max-w-3xl flex-col gap-4">
      <div>
        <h2 id="service-mode-title" className="text-[15px] font-semibold text-ink">
          Façon de servir
        </h2>
        <p className="mt-1 text-[13px] text-ink-2">Les commandes déjà envoyées gardent la façon de servir de leur envoi.</p>
      </div>
      <div role="radiogroup" aria-label="Façon de servir" className="grid gap-3 sm:grid-cols-3">
        {MODES.map((option) => {
          const selected = option.value === mode;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={save.isPending}
              onClick={() => !selected && save.mutate({ serviceMode: option.value })}
              className={cn(
                'relative flex flex-col gap-3 rounded-2xl border-2 bg-surface p-4 text-left transition-[border-color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:opacity-70',
                selected ? 'border-brand shadow-sm' : 'border-line hover:border-ink-3',
              )}
            >
              {selected && (
                <span className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-brand text-white" aria-hidden>
                  <Check className="size-4" />
                </span>
              )}
              <span className="flex items-center gap-1.5" aria-hidden>
                {option.icons.map((Icon, index) => (
                  <span key={index} className="flex items-center gap-1.5">
                    {index > 0 && <ArrowRight className="size-3.5 text-ink-3" />}
                    <span className={cn('grid size-10 place-items-center rounded-full', selected ? 'bg-brand-soft text-brand' : 'bg-sunken text-ink-2')}>
                      <Icon className="size-5" />
                    </span>
                  </span>
                ))}
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-ink">{option.title}</span>
                <span className="text-[12px] font-medium tracking-wide text-ink-3 uppercase">{option.kind}</span>
              </span>
              <span className="text-[13px] leading-snug text-ink-2">{option.hint}</span>
            </button>
          );
        })}
      </div>
      {/* R9 et CA-030-13 : sans objet en « Caisse d'abord », où l'encaissement lance la préparation. */}
      {mode !== 'pay_first' && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4">
          <input
            type="checkbox"
            className="mt-0.5 size-5 accent-[var(--color-brand)]"
            checked={data.autoStartOrders ?? false}
            disabled={save.isPending}
            onChange={(event) => save.mutate({ autoStartOrders: event.target.checked })}
          />
          <span>
            <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
              <Zap className="size-4 text-brand" aria-hidden />
              Lancer la préparation tout de suite
            </span>
            <span className="mt-0.5 block text-[13px] text-ink-2">Une commande envoyée part en préparation sans toucher « Accepter ». Le client ne peut plus l’annuler.</span>
          </span>
        </label>
      )}
    </section>
  );
}
