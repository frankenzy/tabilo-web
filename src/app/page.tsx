import Link from 'next/link';
import { Suspense } from 'react';
import { AuthLayout, authLinkClass } from '@/components/layouts/auth-layout';
import { LoginForm } from '@/components/pages/auth/login-form';

export default function HomePage() {
  return (
    <AuthLayout
      title="Connexion"
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link href="/inscription" className={authLinkClass}>
            Créer mon établissement
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm autoFocus={false} />
      </Suspense>
    </AuthLayout>
  );
}
