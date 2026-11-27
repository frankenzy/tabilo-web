'use client';

import { type ReactNode, useEffect, useState } from 'react';
import type { GuestContext } from '@/contracts';
import { cn } from '@/lib/utils';
import { EstablishmentLogo } from '@/components/ui/establishment-logo';

/** Spec 031, R6 : le mot d'accueil se lit une fois, puis s'efface sans jamais gêner. */
const WELCOME_MS = 8_000;

export function EstablishmentHeader({ establishment, token, action }: {
  establishment: GuestContext['establishment'];
  token: string;
  /** Spec 043, R8 : à droite du nom (l'icône cadeau de la fidélité). */
  action?: ReactNode;
}) {
  const welcome = establishment.welcomeText;
  const storageKey = `tabilo:welcome:${token.slice(0, 12)}`;
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!welcome) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(storageKey) === '1';
      sessionStorage.setItem(storageKey, '1');
    } catch {
      // stockage indisponible : on l'affiche, c'est sans conséquence
    }
    if (seen) return;
    setShowWelcome(true);
    const timer = window.setTimeout(() => setShowWelcome(false), WELCOME_MS);
    return () => window.clearTimeout(timer);
  }, [welcome, storageKey]);

  return (
    <div className="mb-3">
      <div className="flex items-center gap-3">
        <EstablishmentLogo name={establishment.name} logoImageId={establishment.logoImageId} />
        <p className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight text-ink">{establishment.name}</p>
        {action}
      </div>
      {welcome && (
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-500 ease-apple',
            showWelcome ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
          aria-hidden={!showWelcome}
        >
          <p className="min-h-0 overflow-hidden">
            <span className="mt-2 block rounded-xl bg-brand-soft px-3 py-2 text-[14px] font-medium text-brand-strong">{welcome}</span>
          </p>
        </div>
      )}
    </div>
  );
}
