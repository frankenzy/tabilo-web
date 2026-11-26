'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ErrorState, Spinner } from '@/components/ui';
import { SummaryView } from '@/components/pages/analytics/summary-view';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { analyticsApi } from '@/services/api';
import { errorMessage } from '@/services/http';

/** Spec 040, P2 : récapitulatif d'une période (?du=AAAA-MM-JJ&au=AAAA-MM-JJ). */
function Summary() {
  const params = useSearchParams();
  const from = params.get('du') ?? '';
  const to = params.get('au') ?? '';
  const establishmentId = useEstablishmentId();
  const query = useQuery({
    queryKey: estKey(establishmentId, 'report', 'summary', from, to),
    queryFn: () => analyticsApi.summary(establishmentId, from, to),
    enabled: Boolean(from && to),
  });
  if (query.isPending) return <Spinner />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  return <SummaryView summary={query.data} />;
}

export default function Page() {
  return (
    <Suspense>
      <Summary />
    </Suspense>
  );
}
