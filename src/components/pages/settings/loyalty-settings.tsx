'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, Lock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Checkbox, FormError, Input, Select } from '@/components/ui';
import { useFeature } from '@/hooks/use-account';
import { useCurrency } from '@/hooks/use-currency';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { loyaltyApi, menuApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { toast } from '@/stores/toast.store';
import { parseMoney, toMajorInput } from '@/utils/money';

/** Spec 043, P1 : nombre de tampons, montant minimum d'une visite, plat offert. */
export function LoyaltySettings() {
  const establishmentId = useEstablishmentId();
  const currency = useCurrency();
  const allowed = useFeature('loyalty');
  const queryClient = useQueryClient();
  const key = estKey(establishmentId, 'loyalty');
  const program = useQuery({ queryKey: key, queryFn: () => loyaltyApi.get(establishmentId), enabled: allowed });
  const menu = useQuery({ queryKey: estKey(establishmentId, 'menu'), queryFn: () => menuApi.overview(establishmentId), enabled: allowed });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Parameters<typeof loyaltyApi.save>[1]) => loyaltyApi.save(establishmentId, body),
    onSuccess: (saved) => {
      queryClient.setQueryData(key, saved);
      toast.success('Carte de fidélité enregistrée');
    },
    onError: (failure) => setError(errorMessage(failure)),
  });

  if (!allowed) {
    return (
      <section className="max-w-xl">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <Gift className="size-4" aria-hidden />
          Carte de fidélité
        </h2>
        <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-ink-3">
          <Lock className="size-3.5" aria-hidden />
          Comprise dans la formule Pro.
        </p>
      </section>
    );
  }
  if (program.isPending || menu.isPending) return null;
  const current = program.data;
  const dishes = (menu.data ?? []).flatMap((category) => category.items.filter((item) => !item.isBundle));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const stampsRequired = Number(form.get('stampsRequired'));
    const minOrderMinor = parseMoney(String(form.get('minOrder') ?? '0') || '0', currency);
    if (!Number.isInteger(stampsRequired) || stampsRequired < 5 || stampsRequired > 20) return setError('De 5 à 20 tampons.');
    if (minOrderMinor === null) return setError('Montant minimum invalide.');
    setError(null);
    save.mutate({ stampsRequired, minOrderMinor, rewardItemId: String(form.get('rewardItemId')), isActive: form.get('isActive') === 'on' });
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <Gift className="size-4" aria-hidden />
          Carte de fidélité
        </h2>
        <p className="mt-1 text-[13px] text-ink-2">Un tampon par visite réglée ; la carte pleine offre un plat. Sans compte : la carte reste dans le téléphone du client.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Tampons pour la récompense" name="stampsRequired" type="number" min={5} max={20} defaultValue={current?.stampsRequired ?? 10} />
        <Input label={`Montant minimum d’une visite (${currency})`} name="minOrder" inputMode="decimal" defaultValue={current ? toMajorInput(current.minOrderMinor, currency) : '0'} />
      </div>
      <Select label="Plat offert" name="rewardItemId" defaultValue={current?.rewardItemId ?? dishes[0]?.id}>
        {dishes.map((dish) => (
          <option key={dish.id} value={dish.id}>
            {dish.name}
          </option>
        ))}
      </Select>
      <Checkbox label="Carte active" name="isActive" defaultChecked={current?.isActive ?? true} />
      <FormError message={error} />
      <div>
        <Button type="submit" loading={save.isPending} disabled={dishes.length === 0}>
          Enregistrer la carte
        </Button>
      </div>
    </form>
  );
}
