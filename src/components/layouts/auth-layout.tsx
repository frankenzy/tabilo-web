import Link from 'next/link';
import type { ReactNode } from 'react';
import { Brand } from './brand';

/** Mise en page des écrans de connexion et d'inscription. */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <Link href="/" aria-label="Accueil TABILO">
        <Brand />
      </Link>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-1.5 text-sm text-ink-2">{subtitle}</p>
      <div className="mt-7">{children}</div>
      <p className="mt-6 text-sm text-ink-2">{footer}</p>
    </main>
  );
}
