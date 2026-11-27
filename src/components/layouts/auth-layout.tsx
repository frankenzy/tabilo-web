import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthShowcase } from './auth-showcase';
import { Brand } from './brand';

/** Classes des liens du pied de carte (« Créer mon établissement », « Se connecter »…). */
export const authLinkClass = 'font-medium text-brand-strong underline underline-offset-4';

/**
 * Mise en page commune de l'accueil (connexion), de l'inscription et du nouveau mot de passe :
 * carte du formulaire sur le tiers gauche, panneau de présentation sur les deux tiers droits.
 */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="grid min-h-dvh w-full gap-4 bg-surface p-4 lg:grid-cols-3">
      {/* Formulaire : 1/3 à gauche */}
      <section aria-labelledby="auth-title" className="flex items-center justify-center py-8 lg:col-span-1">
        <div className="w-full max-w-md rounded-2xl bg-surface p-8 ring-1 ring-line sm:p-9">
          <div className="flex justify-center">
            <Link href="/" aria-label="Accueil TABILO">
              <Brand className="text-xl [&>span]:size-9 [&>span]:text-base" />
            </Link>
          </div>
          <h2 id="auth-title" className="mt-5 text-center text-3xl font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {subtitle && <p className="mt-2 text-center text-sm text-ink-2">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          <p className="mt-6 text-center text-sm text-ink-2">{footer}</p>
        </div>
      </section>

      {/* Présentation animée : 2/3 à droite */}
      <AuthShowcase />
    </main>
  );
}
