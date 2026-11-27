'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthLayout, authLinkClass } from '@/components/layouts/auth-layout';
import { Button, FormError, Input } from '@/components/ui';
import { fieldErrors, PASSWORD_MIN_LENGTH, registerSchema } from '@/contracts';
import { authApi } from '@/services/api';
import { restoreSession } from '@/services/auth/session';
import { errorMessage } from '@/services/http';

export default function RegisterPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = registerSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    // Spec 041, R2 : conditions et politique acceptées.
    if (form.get('acceptTerms') !== 'on') return setErrors({ acceptTerms: 'Acceptez les conditions pour créer votre compte.' });
    setErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      // Fuseau du navigateur : celui de l'établissement dans la quasi-totalité des cas, modifiable ensuite.
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await authApi.register({ ...parsed.data, timezone, acceptTerms: true });
      if (!(await restoreSession())) throw new Error('session');
      // Spec 006, R12 : le nouveau propriétaire crée sa salle depuis « Tables ».
      router.replace('/app/tables');
    } catch (error) {
      setFormError(errorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Créer mon établissement"
      subtitle="Quelques informations, puis vous ajoutez vos tables."
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link href="/" className={authLinkClass}>
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input label="Entreprise" name="organizationName" autoComplete="organization" error={errors.organizationName} autoFocus />
        <Input label="Nom de l’établissement" name="establishmentName" error={errors.establishmentName} hint="Affiché à vos clients après le scan." />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom" name="firstName" autoComplete="given-name" error={errors.firstName} />
          <Input label="Nom" name="lastName" autoComplete="family-name" error={errors.lastName} />
        </div>
        <Input label="Adresse e-mail" name="email" type="email" autoComplete="username" inputMode="email" error={errors.email} />
        <Input
          label="Mot de passe"
          name="password"
          type="password"
          autoComplete="new-password"
          error={errors.password}
          hint={`${PASSWORD_MIN_LENGTH} caractères au minimum.`}
        />
        <label className="flex items-start gap-2.5 text-[14px] text-ink-2">
          <input type="checkbox" name="acceptTerms" className="mt-1 size-4" />
          <span>
            J’accepte les{' '}
            <Link href="/cgu" target="_blank" className="font-medium text-ink underline underline-offset-4">
              conditions d’utilisation
            </Link>{' '}
            et la{' '}
            <Link href="/confidentialite" target="_blank" className="font-medium text-ink underline underline-offset-4">
              politique de confidentialité
            </Link>
            .
          </span>
        </label>
        {errors.acceptTerms && (
          <p role="alert" className="-mt-2 text-[13px] text-late">
            {errors.acceptTerms}
          </p>
        )}
        <FormError message={formError} />
        <Button type="submit" size="lg" loading={submitting} className="mt-1">
          Créer mon compte
        </Button>
      </form>
    </AuthLayout>
  );
}
