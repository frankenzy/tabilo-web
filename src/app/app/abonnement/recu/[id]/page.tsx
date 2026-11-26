'use client';

import { useQuery } from '@tanstack/react-query';
import { use } from 'react';
import { ErrorState, Spinner } from '@/components/ui';
import { ReceiptView } from '@/components/pages/subscription/receipt-view';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { subscriptionApi } from '@/services/api';
import { errorMessage } from '@/services/http';

/** Spec 037, P2 : un reçu, imprimable depuis le navigateur. */
export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const establishmentId = useEstablishmentId();
  const query = useQuery({ queryKey: estKey(establishmentId, 'subscription', 'receipt', id), queryFn: () => subscriptionApi.receipt(establishmentId, id) });
  if (query.isPending) return <Spinner />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  return <ReceiptView receipt={query.data} />;
}
