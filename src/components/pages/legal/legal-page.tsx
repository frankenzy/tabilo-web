import Link from 'next/link';
import type { ReactNode } from 'react';
import { Brand } from '@/components/layouts/brand';
import { LEGAL_CONTACT, LEGAL_VERSION } from '@/constants/legal';

/** Spec 041, R1 : page publique d'un texte juridique, versionné. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const version = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${LEGAL_VERSION}T12:00:00`));
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Link href="/" aria-label="Accueil TABILO">
        <Brand />
      </Link>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-1 text-[13px] text-ink-3">Version du {version}</p>
      <div className="mt-6 flex flex-col gap-4 text-[15px] leading-relaxed text-ink-2 [&_h2]:mt-4 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
      <p className="mt-10 text-[13px] text-ink-3">
        Questions : WhatsApp {LEGAL_CONTACT} ·{' '}
        <Link href="/cgu" className="underline underline-offset-4">
          Conditions d’utilisation
        </Link>{' '}
        ·{' '}
        <Link href="/confidentialite" className="underline underline-offset-4">
          Confidentialité
        </Link>
      </p>
    </main>
  );
}
