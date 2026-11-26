'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { Button, Dialog, FormError } from '@/components/ui';
import { useAccount } from '@/hooks/use-account';
import { privacyApi } from '@/services/api';
import { restoreSession } from '@/services/auth/session';
import { errorMessage } from '@/services/http';
import { useMembership } from '@/stores/auth.store';

/** Spec 041, R2 : une nouvelle version des textes s'affiche une fois au propriétaire, qui l'accepte pour continuer. */
export function TermsGate() {
  const account = useAccount();
  const owner = useMembership()?.role.key === 'owner';
  const accept = useMutation({ mutationFn: privacyApi.acceptTerms, onSuccess: () => void restoreSession() });
  if (!owner || !account?.legalVersion || account.termsVersion === account.legalVersion) return null;
  return (
    <Dialog open onOpenChange={() => undefined} title="Nos conditions évoluent">
      <p className="text-[14px] text-ink-2">
        Pour continuer à utiliser TABILO, merci de relire et d’accepter la nouvelle version des{' '}
        <Link href="/cgu" target="_blank" className="font-medium text-ink underline underline-offset-4">
          conditions d’utilisation
        </Link>{' '}
        et de la{' '}
        <Link href="/confidentialite" target="_blank" className="font-medium text-ink underline underline-offset-4">
          politique de confidentialité
        </Link>
        .
      </p>
      <FormError message={accept.isError ? errorMessage(accept.error) : null} />
      <div className="mt-5 flex justify-end">
        <Button loading={accept.isPending} onClick={() => accept.mutate()}>
          J’accepte
        </Button>
      </div>
    </Dialog>
  );
}
