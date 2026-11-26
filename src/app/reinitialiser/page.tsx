'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { Button, FormError, Input } from '@/components/ui';
import { PASSWORD_MIN_LENGTH } from '@/contracts';
import { authApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { toast } from '@/stores/toast.store';

/** Spec 036, R5 : nouveau mot de passe avec le lien donné par TABILO (une seule fois, 24 heures). */
function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('jeton') ?? '';
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    if (password.length < PASSWORD_MIN_LENGTH) return setError(`${PASSWORD_MIN_LENGTH} caractères au minimum.`);
    if (password !== form.get('confirm')) return setError('Les deux mots de passe sont différents.');
    setError(null);
    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, password });
      toast.success('Mot de passe changé', 'Connectez-vous avec le nouveau mot de passe.');
      router.replace('/');
    } catch (failure) {
      setError(errorMessage(failure));
      setSubmitting(false);
    }
  }

  if (token.length < 32) {
    return <FormError message="Ce lien est incomplet. Demandez un nouveau lien à TABILO." />;
  }
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Input label="Nouveau mot de passe" name="password" type="password" autoComplete="new-password" hint={`${PASSWORD_MIN_LENGTH} caractères au minimum.`} autoFocus />
      <Input label="Confirmer" name="confirm" type="password" autoComplete="new-password" />
      <FormError message={error} />
      <Button type="submit" size="lg" loading={submitting}>
        Enregistrer
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Nouveau mot de passe"
      subtitle="Choisissez votre nouveau mot de passe. Ce lien ne sert qu’une fois."
      footer={
        <Link href="/" className="font-medium text-ink underline underline-offset-4">
          Retour à la connexion
        </Link>
      }
    >
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthLayout>
  );
}
