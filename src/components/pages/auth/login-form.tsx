'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, FormError, Input } from '@/components/ui';
import { fieldErrors, loginSchema } from '@/contracts';
import { authApi } from '@/services/api';
import { restoreSession } from '@/services/auth/session';
import { errorMessage } from '@/services/http';

/** N'accepte qu'un chemin interne : pas de redirection ouverte via ?next=. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/app') ? value : '/app';
}

/** Formulaire de connexion de la page d'accueil (/login y renvoie). À envelopper dans <Suspense>. */
export function LoginForm({ autoFocus = true }: { autoFocus?: boolean }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = loginSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      await authApi.login(parsed.data);
      if (!(await restoreSession())) throw new Error('session');
      router.replace(next);
    } catch (error) {
      setFormError(errorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Input label="Adresse e-mail" name="email" type="email" autoComplete="username" inputMode="email" error={errors.email} autoFocus={autoFocus} />
      <Input label="Mot de passe" name="password" type="password" autoComplete="current-password" error={errors.password} />
      <FormError message={formError} />
      <Button type="submit" size="lg" loading={submitting} className="mt-1">
        Se connecter
      </Button>
    </form>
  );
}
