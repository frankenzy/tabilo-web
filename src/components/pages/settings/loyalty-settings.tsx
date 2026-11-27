'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, Lock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Checkbox, FormError, Input, Select, Tabs } from '@/components/ui';
import { useFeature } from '@/hooks/use-account';
import { useCurrency } from '@/hooks/use-currency';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { loyaltyApi, menuApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { toast } from '@/stores/toast.store';
import { parseMoney, toMajorInput } from '@/utils/money';
import { PrizeBasket } from './loyalty-prizes';

/**
 * Spec 043, P1 : nombre de tampons, montant minimum d'une visite, plat offert (mode Classique).
 * Spec 046, P1 : mode Surprise — un cadeau toutes les X à Y commandes, validité, panier de cadeaux.
 */
export function LoyaltySettings() {
  const establishmentId = useEstablishmentId();
  const currency = useCurrency();
  const allowed = useFeature('loyalty');
  const queryClient = useQueryClient();
  const key = estKey(establishmentId, 'loyalty');
  const program = useQuery({ queryKey: key, queryFn: () => loyaltyApi.get(establishmentId), enabled: allowed });
  const menu = useQuery({ queryKey: estKey(establishmentId, 'menu'), queryFn: () => menuApi.overview(establishmentId), enabled: allowed });
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'classic' | 'surprise' | null>(null);
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
  const activeMode = mode ?? current?.mode ?? 'classic';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const minOrderMinor = parseMoney(String(form.get('minOrder') ?? '0') || '0', currency);
    if (minOrderMinor === null) return setError('Montant minimum invalide.');
    const isActive = form.get('isActive') === 'on';
    if (activeMode === 'surprise') {
      const surpriseMin = Number(form.get('surpriseMin'));
      const surpriseMax = Number(form.get('surpriseMax'));
      const giftValidityDays = Number(form.get('giftValidityDays'));
      const inRange = (value: number) => Number.isInteger(value) && value >= 1 && value <= 20;
      if (!inRange(surpriseMin) || !inRange(surpriseMax)) return setError('De 1 à 20 commandes.');
      if (surpriseMin > surpriseMax) return setError('Le minimum de commandes doit être inférieur ou égal au maximum.');
      if (!Number.isInteger(giftValidityDays) || giftValidityDays < 1 || giftValidityDays > 365) return setError('Validité : de 1 à 365 jours.');
      setError(null);
      return save.mutate({ mode: 'surprise', minOrderMinor, surpriseMin, surpriseMax, giftValidityDays, isActive });
    }
    const stampsRequired = Number(form.get('stampsRequired'));
    if (!Number.isInteger(stampsRequired) || stampsRequired < 5 || stampsRequired > 20) return setError('De 5 à 20 tampons.');
    setError(null);
    save.mutate({ mode: 'classic', stampsRequired, minOrderMinor, rewardItemId: String(form.get('rewardItemId')), isActive });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Gift className="size-4" aria-hidden />
            Carte de fidélité
          </h2>
          <p className="mt-1 text-[13px] text-ink-2">
            {activeMode === 'surprise'
              ? 'Un cadeau surprise, tiré au sort dans votre panier, après un nombre de visites réglées lui aussi tiré au sort. Le client le déballe sur son téléphone.'
              : 'Un tampon par visite réglée ; la carte pleine offre un plat. Sans compte : la carte reste dans le téléphone du client.'}
          </p>
        </div>
        <Tabs
          label="Mode de la carte"
          value={activeMode}
          onChange={(value) => {
            setMode(value);
            setError(null);
          }}
          tabs={[
            { value: 'classic', label: 'Classique' },
            { value: 'surprise', label: 'Surprise' },
          ]}
        />
        {activeMode === 'surprise' ? (
          <div key="surprise" className="grid gap-4 sm:grid-cols-2">
            <Input label="Un cadeau après au moins… (commandes)" name="surpriseMin" type="number" min={1} max={20} defaultValue={current?.surpriseMin ?? 2} />
            <Input label="… et au plus (commandes)" name="surpriseMax" type="number" min={1} max={20} defaultValue={current?.surpriseMax ?? 5} />
            <Input label={`Montant minimum d’une visite (${currency})`} name="minOrder" inputMode="decimal" defaultValue={current ? toMajorInput(current.minOrderMinor, currency) : '0'} />
            <Input label="Validité d’un cadeau (jours)" name="giftValidityDays" type="number" min={1} max={365} defaultValue={current?.giftValidityDays ?? 30} />
          </div>
        ) : (
          <div key="classic" className="flex flex-col gap-4">
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
          </div>
        )}
        <Checkbox label="Carte active" name="isActive" defaultChecked={current?.isActive ?? true} />
        <FormError message={error} />
        <div>
          <Button type="submit" loading={save.isPending} disabled={activeMode === 'classic' && dishes.length === 0}>
            Enregistrer la carte
          </Button>
        </div>
      </form>
      {/* Spec 046, R2 : le panier se règle à part (ses propres formulaires). */}
      {activeMode === 'surprise' && <PrizeBasket menu={menu.data ?? []} />}
    </div>
  );
}
