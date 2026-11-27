'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState, type CSSProperties } from 'react';
import { Button, FormError } from '@/components/ui';
import { EstablishmentLogo } from '@/components/ui/establishment-logo';
import { BRAND_COLORS, BRAND_PALETTE, brandVariables, DEFAULT_BRAND, WELCOME_MAX } from '@/constants/branding';
import type { Establishment } from '@/contracts';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { cn } from '@/lib/utils';
import { establishmentApi } from '@/services/api';
import { restoreSession } from '@/services/auth/session';
import { errorMessage } from '@/services/http';
import { toast } from '@/stores/toast.store';
import { ImageError, shrinkLogo } from '@/utils/image';

/**
 * Spec 031, P1 : logo, couleur de la palette et mot d'accueil, avec un aperçu du téléphone du client.
 * La couleur et le mot d'accueil ne changent la page client qu'à l'enregistrement (CA-031-07) ; le logo s'enregistre à l'envoi.
 */
export function BrandingSettings({ data }: { data: Establishment }) {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const key = estKey(establishmentId, 'establishment');
  const savedColor = data.brandColor ?? DEFAULT_BRAND;
  const savedWelcome = data.welcomeText ?? '';
  const [color, setColor] = useState(savedColor);
  const [welcome, setWelcome] = useState(savedWelcome);
  const [logoError, setLogoError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const dirty = color !== savedColor || welcome.trim() !== savedWelcome;

  const onSaved = (updated: Establishment, message: string) => {
    queryClient.setQueryData(key, updated);
    toast.success(message);
  };
  const save = useMutation({
    mutationFn: () => establishmentApi.update(establishmentId, { brandColor: color, welcomeText: welcome.trim() || null }),
    onSuccess: (updated) => {
      onSaved(updated, 'Apparence enregistrée');
      setWelcome(updated.welcomeText ?? '');
    },
  });
  const upload = useMutation({
    mutationFn: async (file: File) => establishmentApi.setLogo(establishmentId, await shrinkLogo(file)),
    onSuccess: (updated) => {
      setLogoError(null);
      onSaved(updated, 'Logo enregistré');
      void restoreSession(); // le sélecteur d'établissement affiche le logo
    },
    onError: (error) => setLogoError(error instanceof ImageError ? error.message : errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: () => establishmentApi.removeLogo(establishmentId),
    onSuccess: (updated) => {
      onSaved(updated, 'Logo retiré');
      void restoreSession();
    },
  });

  return (
    <section aria-labelledby="branding-title" className="grid max-w-4xl gap-8 md:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex flex-col gap-6">
        <div>
          <h2 id="branding-title" className="text-[15px] font-semibold text-ink">
            Apparence
          </h2>
          <p className="mt-1 text-[13px] text-ink-2">Ce que vos clients voient en scannant le QR de leur table.</p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">Logo</span>
          <div className="flex flex-wrap items-center gap-3">
            <EstablishmentLogo name={data.name} logoImageId={data.logoImageId ?? null} />
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) upload.mutate(file);
              }}
            />
            <Button type="button" variant="secondary" loading={upload.isPending} onClick={() => input.current?.click()}>
              <ImagePlus className="size-4" aria-hidden />
              {data.logoImageId ? 'Changer le logo' : 'Ajouter un logo'}
            </Button>
            {data.logoImageId && (
              <Button type="button" variant="ghost" loading={remove.isPending} onClick={() => remove.mutate()}>
                <Trash2 className="size-4" aria-hidden />
                Retirer
              </Button>
            )}
          </div>
          <p className="text-[12px] text-ink-3">Recadré au carré. Sans logo, l’initiale du nom s’affiche.</p>
          <FormError message={logoError ?? (remove.isError ? errorMessage(remove.error) : null)} />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px] font-medium text-ink">Couleur principale</legend>
          <div role="radiogroup" aria-label="Couleur principale" className="flex flex-wrap gap-2.5">
            {BRAND_COLORS.map((option) => {
              const selected = option === color;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={BRAND_PALETTE[option].label}
                  title={BRAND_PALETTE[option].label}
                  onClick={() => setColor(option)}
                  className={cn(
                    'grid size-11 place-items-center rounded-full text-white ring-offset-2 ring-offset-paper transition-transform duration-200 active:scale-90',
                    selected && 'ring-2 ring-ink',
                  )}
                  style={{ backgroundColor: BRAND_PALETTE[option].brand }}
                >
                  {selected && <Check className="size-5" aria-hidden />}
                </button>
              );
            })}
          </div>
          <p className="text-[12px] text-ink-3">
            {BRAND_PALETTE[color as keyof typeof BRAND_PALETTE]?.label}. Les couleurs des états (retard, prête, à régler, appel) ne changent pas.
          </p>
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">Mot d’accueil</span>
          <input
            value={welcome}
            maxLength={WELCOME_MAX}
            onChange={(event) => setWelcome(event.target.value)}
            placeholder="Bienvenue chez nous !"
            className="h-11 rounded-xl border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-ink-3"
          />
          <span className="text-[12px] text-ink-3">
            Facultatif · {welcome.trim().length}/{WELCOME_MAX} caractères. Affiché une fois, sous le nom.
          </span>
        </label>

        <FormError message={save.isError ? errorMessage(save.error) : null} />
        <div>
          <Button type="button" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
            Enregistrer l’apparence
          </Button>
        </div>
      </div>

      <PhonePreview name={data.name} logoImageId={data.logoImageId ?? null} color={color} welcome={welcome.trim()} />
    </section>
  );
}

/** Spec 031, CA-031-07 : aperçu immédiat, sans toucher à la page client. */
function PhonePreview({ name, logoImageId, color, welcome }: { name: string; logoImageId: string | null; color: string; welcome: string }) {
  return (
    <div aria-label="Aperçu du téléphone du client" className="self-start rounded-[32px] border-[6px] border-ink bg-paper p-4 shadow-lg" style={brandVariables(color) as CSSProperties}>
      <div className="flex items-center gap-2.5">
        <EstablishmentLogo name={name} logoImageId={logoImageId} />
        <p className="min-w-0 truncate text-[15px] font-semibold text-ink">{name}</p>
      </div>
      {welcome && <p className="mt-2 rounded-xl bg-brand-soft px-3 py-2 text-[13px] font-medium text-brand-strong">{welcome}</p>}
      <p className="mt-3 text-[12px] text-ink-2">
        <span className="font-semibold text-ink">Table 4</span> · Terrasse
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2" aria-hidden>
        {['Plats', 'Boissons'].map((label) => (
          <div key={label} className="flex h-16 items-end rounded-xl bg-sunken p-2 text-[12px] font-semibold text-ink">
            {label}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface p-2.5 ring-1 ring-line" aria-hidden>
        <span className="text-[13px] font-medium text-ink">Garba</span>
        <span className="grid size-8 place-items-center rounded-full bg-brand text-lg leading-none font-semibold text-white">+</span>
      </div>
      <div className="mt-4 flex h-12 items-center justify-center rounded-full bg-brand text-[14px] font-semibold text-white" aria-hidden>
        Glisser pour commander
      </div>
      <p className="mt-4 text-center text-[10px] text-ink-3">Service assuré avec TABILO</p>
    </div>
  );
}
