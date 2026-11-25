'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LocateFixed, MapPin, MapPinOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, FormError, Input } from '@/components/ui';
import type { Establishment } from '@/contracts';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { establishmentApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { toast } from '@/stores/toast.store';
import { ALERT_MINUTES, validateSessionSecurity, ZONE_RADIUS } from './session-security-logic';


/**
 * Spec 027, R12 : section « Sessions et sécurité » — zone de l'établissement (position enregistrée sur place
 * par le gérant), rayon, et délai avant l'alerte de départ sans payer.
 */
export function SessionSecuritySettings({ data }: { data: Establishment }) {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [locating, setLocating] = useState(false);
  const hasZone = data.zoneLatitude != null && data.zoneLongitude != null;
  const save = useMutation({
    mutationFn: (body: Partial<Omit<Establishment, 'id'>>) => establishmentApi.update(establishmentId, body),
    onSuccess: (updated, body) => {
      queryClient.setQueryData(estKey(establishmentId, 'establishment'), updated);
      if ('zoneLatitude' in body) toast.success(body.zoneLatitude === null ? 'Zone retirée' : 'Position enregistrée');
      else toast.success('Paramètres enregistrés');
    },
  });

  function recordPosition() {
    if (!navigator.geolocation) return toast.error('Position indisponible', 'Ce navigateur ne donne pas sa position.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        save.mutate({ zoneLatitude: position.coords.latitude, zoneLongitude: position.coords.longitude });
      },
      (error) => {
        setLocating(false);
        toast.error('Position indisponible', error.code === error.PERMISSION_DENIED ? 'Autorisez la position pour ce site, puis réessayez.' : 'Réessayez à l’intérieur de l’établissement.');
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const radius = Number(form.get('zoneRadiusM'));
    const minutes = Number(form.get('unpaidAlertMinutes'));
    const found = validateSessionSecurity(radius, minutes);
    setErrors(found);
    if (Object.keys(found).length === 0) save.mutate({ zoneRadiusM: radius, unpaidAlertMinutes: minutes });
  }

  return (
    <form onSubmit={submit} noValidate className="mt-10 flex max-w-xl flex-col gap-4 border-t border-line pt-8">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">Sessions et sécurité</h2>
        <p className="mt-1 text-[13px] text-ink-2">
          Une commande passée loin de l’établissement est signalée au serveur. Un client servi qui ne règle pas déclenche une alerte au tableau de bord.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-(--radius-card) bg-sunken/60 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-sm" aria-hidden>
            {hasZone ? <MapPin className="size-5 text-done" /> : <MapPinOff className="size-5 text-ink-3" />}
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink">{hasZone ? 'Zone enregistrée' : 'Aucune zone'}</p>
            <p className="text-[13px] text-ink-2">
              {hasZone
                ? 'La position des clients est vérifiée au moment de commander. Elle n’est jamais enregistrée.'
                : 'Enregistrez la position depuis l’établissement, sur ce téléphone ou cet ordinateur.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={recordPosition} loading={locating || (save.isPending && save.variables && 'zoneLatitude' in save.variables)}>
            <LocateFixed className="size-4" aria-hidden />
            Enregistrer la position ici
          </Button>
          {hasZone && (
            <Button type="button" variant="ghost" onClick={() => save.mutate({ zoneLatitude: null, zoneLongitude: null })}>
              Retirer la zone
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Rayon de la zone (mètres)"
          name="zoneRadiusM"
          type="number"
          min={ZONE_RADIUS.min}
          max={ZONE_RADIUS.max}
          step={10}
          defaultValue={data.zoneRadiusM ?? ZONE_RADIUS.default}
          error={errors.zoneRadiusM}
          hint={`De ${ZONE_RADIUS.min} à ${ZONE_RADIUS.max} m.`}
        />
        <Input
          label="Alerte de départ sans payer (minutes)"
          name="unpaidAlertMinutes"
          type="number"
          min={ALERT_MINUTES.min}
          max={ALERT_MINUTES.max}
          defaultValue={data.unpaidAlertMinutes ?? ALERT_MINUTES.default}
          error={errors.unpaidAlertMinutes}
          hint="Sans activité d’un client servi et non réglé."
        />
      </div>
      <FormError message={save.isError ? errorMessage(save.error) : null} />
      <div>
        <Button type="submit" loading={save.isPending && !(save.variables && 'zoneLatitude' in save.variables)}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
