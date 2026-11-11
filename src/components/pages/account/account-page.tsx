'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, FormError, Input, PageHeader } from '@/components/ui';
import { changePasswordSchema, fieldErrors, PASSWORD_MIN_LENGTH } from '@/contracts';
import { authApi } from '@/services/api';
import { restoreSession } from '@/services/auth/session';
import { errorMessage } from '@/services/http';
import { useAuthStore, useMembership } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';

export function AccountPage() {
  const router = useRouter();
  const me = useAuthStore((state) => state.me);
  const membership = useMembership();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const forced = me?.mustChangePassword ?? false;
  const change = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: async () => {
      toast.success('Mot de passe modifié', 'Vos autres sessions ont été déconnectées.');
      await restoreSession();
      if (forced) router.replace('/app');
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = changePasswordSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    change.mutate(parsed.data, { onSuccess: () => form.reset() });
  }

  if (!me) return null;
  return (
    <>
      <PageHeader title="Mon compte" description={`${me.firstName} ${me.lastName} · ${me.email}${membership ? ` · ${membership.role.name}` : ''}`} />
      <section className="max-w-sm">
        <h2 className="text-[15px] font-semibold text-ink">{forced ? 'Choisissez votre mot de passe' : 'Changer de mot de passe'}</h2>
        {forced && (
          <p role="status" className="mt-2 rounded-lg bg-wait px-3 py-2 text-sm text-wait-ink">
            Votre mot de passe a été défini par un responsable. Remplacez-le pour accéder à votre espace.
          </p>
        )}
        <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
          <Input label="Mot de passe actuel" name="currentPassword" type="password" autoComplete="current-password" error={errors.currentPassword} />
          <Input label="Nouveau mot de passe" name="newPassword" type="password" autoComplete="new-password" error={errors.newPassword} hint={`${PASSWORD_MIN_LENGTH} caractères au minimum.`} />
          <FormError message={change.isError ? errorMessage(change.error) : null} />
          <div>
            <Button type="submit" loading={change.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </section>
    </>
  );
}
