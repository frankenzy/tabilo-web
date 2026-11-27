'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, ImagePlus, Infinity as InfinityIcon, Plus, Trash2 } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Button, FormError, Input, Select } from '@/components/ui';
import type { LoyaltyPrize, MenuCategory } from '@/contracts';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { cn } from '@/lib/utils';
import { loyaltyApi, menuImageUrl } from '@/services/api';
import { errorMessage } from '@/services/http';
import { toast } from '@/stores/toast.store';
import { shrinkImage } from '@/utils/image';
import { chanceShare } from './loyalty-prizes-logic';

/**
 * Spec 046, R2 et R3 : le panier de cadeaux du mode Surprise — image, nom, chance (et sa part),
 * stock du mois. Au moins un cadeau sans limite.
 */
export function PrizeBasket({ menu }: { menu: MenuCategory[] }) {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const key = estKey(establishmentId, 'loyalty', 'prizes');
  const prizes = useQuery({ queryKey: key, queryFn: () => loyaltyApi.prizes(establishmentId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const onError = (failure: unknown) => toast.error('Action impossible', errorMessage(failure));
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; weight?: number; monthlyStock?: number | null } }) => loyaltyApi.updatePrize(establishmentId, id, body),
    onSuccess: refresh,
    onError: (failure) => {
      onError(failure);
      void refresh();
    },
  });
  const archive = useMutation({ mutationFn: (id: string) => loyaltyApi.archivePrize(establishmentId, id), onSuccess: refresh, onError });
  const image = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => loyaltyApi.setPrizeImage(establishmentId, id, await shrinkImage(file)),
    onSuccess: refresh,
    onError,
  });

  const rows = prizes.data ?? [];
  const unlimited = rows.some((prize) => prize.monthlyStock === null);

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-[14px] font-semibold text-ink">Panier de cadeaux</h3>
        <p className="mt-0.5 text-[13px] text-ink-2">Chaque cadeau débloqué est tiré au sort dans ce panier, selon les chances.</p>
      </div>
      {rows.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
          {rows.map((prize) => (
            <PrizeRow
              key={prize.id}
              prize={prize}
              share={chanceShare(prize.weight, rows)}
              onChange={(body) => update.mutate({ id: prize.id, body })}
              onImage={(file) => image.mutate({ id: prize.id, file })}
              imageBusy={image.isPending && image.variables?.id === prize.id}
              onRemove={() => archive.mutate(prize.id)}
            />
          ))}
        </ul>
      )}
      {rows.length > 0 && !unlimited && (
        <p className="rounded-xl bg-late-soft px-3 py-2 text-[13px] text-late">Gardez au moins un cadeau sans limite de stock : chaque cadeau débloqué doit contenir quelque chose.</p>
      )}
      <AddPrize menu={menu} disabled={rows.length >= 20} onAdded={refresh} />
    </section>
  );
}

function PrizeRow({
  prize,
  share,
  onChange,
  onImage,
  imageBusy,
  onRemove,
}: {
  prize: LoyaltyPrize;
  share: number;
  onChange: (body: { name?: string; weight?: number; monthlyStock?: number | null }) => void;
  onImage: (file: File) => void;
  imageBusy: boolean;
  onRemove: () => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <button
        type="button"
        onClick={() => file.current?.click()}
        className={cn('relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-sunken text-ink-3 ring-1 ring-line', imageBusy && 'animate-pulse')}
        aria-label={`Changer l’image de ${prize.name}`}
      >
        {prize.imageId ? (
          // eslint-disable-next-line @next/next/no-img-element -- image servie par l'API, déjà réduite
          <img src={menuImageUrl(prize.imageId)} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-5" aria-hidden />
        )}
      </button>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) onImage(chosen);
          event.target.value = '';
        }}
      />
      <div className="min-w-0 flex-1">
        <input
          defaultValue={prize.name}
          aria-label="Nom du cadeau"
          maxLength={60}
          onBlur={(event) => {
            const name = event.target.value.trim();
            if (name && name !== prize.name) onChange({ name });
          }}
          className="w-full truncate rounded-lg bg-transparent px-1 py-0.5 text-[14px] font-semibold text-ink outline-none focus:bg-sunken"
        />
        <p className="px-1 text-[12px] text-ink-3">{prize.kind === 'menu_item' ? 'Plat de la carte, offert' : 'Lot remis à la main'}</p>
      </div>
      <label className="flex items-center gap-1.5 text-[13px] text-ink-2">
        Chance
        <input
          type="number"
          min={1}
          max={100}
          defaultValue={prize.weight}
          onBlur={(event) => {
            const weight = Number(event.target.value);
            if (Number.isInteger(weight) && weight >= 1 && weight <= 100 && weight !== prize.weight) onChange({ weight });
          }}
          className="w-14 rounded-lg bg-sunken px-2 py-1 text-right tabular-nums text-ink outline-none"
        />
        <span className="w-10 text-right font-semibold tabular-nums text-brand-strong">{share} %</span>
      </label>
      <label className="flex items-center gap-1.5 text-[13px] text-ink-2">
        Stock / mois
        <input
          type="number"
          min={1}
          placeholder="∞"
          defaultValue={prize.monthlyStock ?? ''}
          onBlur={(event) => {
            const raw = event.target.value.trim();
            const monthlyStock = raw === '' ? null : Number(raw);
            if (monthlyStock !== null && (!Number.isInteger(monthlyStock) || monthlyStock < 1)) return;
            if (monthlyStock !== prize.monthlyStock) onChange({ monthlyStock });
          }}
          className="w-16 rounded-lg bg-sunken px-2 py-1 text-right tabular-nums text-ink outline-none"
        />
        <span className="w-14 text-[12px] tabular-nums text-ink-3">
          {prize.monthlyStock === null ? <InfinityIcon className="size-4" aria-label="sans limite" /> : `${prize.drawnThisMonth} tirés`}
        </span>
      </label>
      <button type="button" onClick={onRemove} className="rounded-lg p-2 text-ink-3 hover:bg-sunken hover:text-late" aria-label={`Retirer ${prize.name}`}>
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  );
}

function AddPrize({ menu, disabled, onAdded }: { menu: MenuCategory[]; disabled: boolean; onAdded: () => void }) {
  const establishmentId = useEstablishmentId();
  const [kind, setKind] = useState<'menu_item' | 'free'>('free');
  const [error, setError] = useState<string | null>(null);
  const dishes = menu.flatMap((category) => category.items.filter((item) => !item.isBundle));
  const create = useMutation({
    mutationFn: (body: Parameters<typeof loyaltyApi.createPrize>[1]) => loyaltyApi.createPrize(establishmentId, body),
    onSuccess: (created) => {
      toast.success('Cadeau ajouté', created.name);
      onAdded();
    },
    onError: (failure) => setError(errorMessage(failure)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const weight = Number(form.get('weight'));
    const stockRaw = String(form.get('monthlyStock') ?? '').trim();
    const monthlyStock = stockRaw === '' ? null : Number(stockRaw);
    if (!Number.isInteger(weight) || weight < 1 || weight > 100) return setError('Chance de 1 à 100.');
    if (monthlyStock !== null && (!Number.isInteger(monthlyStock) || monthlyStock < 1)) return setError('Stock : un nombre entier, ou vide pour sans limite.');
    const name = String(form.get('name') ?? '').trim();
    if (kind === 'free' && !name) return setError('Donnez un nom au cadeau (ex. « Bonbons »).');
    setError(null);
    create.mutate({
      kind,
      ...(kind === 'menu_item' ? { menuItemId: String(form.get('menuItemId')) } : { name }),
      weight,
      monthlyStock,
    });
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-2xl bg-sunken/60 p-3">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        <Gift className="size-4 text-brand" aria-hidden />
        Ajouter un cadeau
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Type" value={kind} onChange={(event) => setKind(event.target.value as 'menu_item' | 'free')}>
          <option value="free">Lot libre (bonbons, bon pour un jus…)</option>
          <option value="menu_item">Plat de la carte, offert</option>
        </Select>
        {kind === 'menu_item' ? (
          <Select label="Plat" name="menuItemId" defaultValue={dishes[0]?.id}>
            {dishes.map((dish) => (
              <option key={dish.id} value={dish.id}>
                {dish.name}
              </option>
            ))}
          </Select>
        ) : (
          <Input label="Nom" name="name" maxLength={60} placeholder="Bonbons" />
        )}
        <Input label="Chance (1 à 100)" name="weight" type="number" min={1} max={100} defaultValue={10} />
        <Input label="Stock par mois (vide = sans limite)" name="monthlyStock" type="number" min={1} placeholder="∞" />
      </div>
      <FormError message={error} />
      <div>
        <Button type="submit" size="sm" variant="secondary" loading={create.isPending} disabled={disabled || (kind === 'menu_item' && dishes.length === 0)}>
          <Plus className="size-4" aria-hidden />
          Ajouter au panier
        </Button>
      </div>
      <p className="text-[12px] text-ink-3">L’image se choisit ensuite en touchant la vignette du cadeau. Un plat prend sa photo de la carte.</p>
    </form>
  );
}
