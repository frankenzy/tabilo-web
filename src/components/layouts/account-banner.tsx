'use client';

import { AlertTriangle, Clock } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { accountBanner, whatsappLink } from '@/components/pages/subscription/subscription-logic';
import { useAccount } from '@/hooks/use-account';
import { cn } from '@/lib/utils';
import { useMembership } from '@/stores/auth.store';

/** Pages encore ouvertes quand le compte est suspendu (spec 035, R6). */
const OPEN_WHEN_SUSPENDED = ['/app/abonnement', '/app/compte'];

/**
 * Spec 035, R5 et R6 : bandeau d'échéance en tête de l'espace pro, et, compte suspendu,
 * retour à la page « Abonnement ».
 */
export function AccountBanner() {
  const account = useAccount();
  const owner = useMembership()?.role.key === 'owner';
  const pathname = usePathname();
  const router = useRouter();
  const suspended = account?.state === 'suspended';

  useEffect(() => {
    if (suspended && !OPEN_WHEN_SUSPENDED.some((path) => pathname.startsWith(path))) router.replace('/app/abonnement');
  }, [suspended, pathname, router]);

  const banner = accountBanner(account, owner, Date.now());
  if (!banner || !account) return null;
  const Icon = banner.tone === 'danger' ? AlertTriangle : Clock;
  return (
    <div
      role="status"
      className={cn(
        'no-print flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px] lg:px-8',
        banner.tone === 'danger' ? 'bg-late text-white' : 'bg-wait text-wait-ink',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="font-semibold">{banner.title}</span>
      {owner && (
        <>
          <a href={whatsappLink(account.contact)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            WhatsApp {account.contact}
          </a>
          {!pathname.startsWith('/app/abonnement') && (
            <Link href="/app/abonnement" className="underline underline-offset-4">
              Voir mon abonnement
            </Link>
          )}
        </>
      )}
    </div>
  );
}
