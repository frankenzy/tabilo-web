'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import { Button, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { floorApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { useMembership } from '@/stores/auth.store';
import { svgDataUrl } from '@/utils/qr';

/** Planche de QR codes à imprimer : un chevalet par table. */
export function QrSheetPage() {
  const establishmentId = useEstablishmentId();
  const establishment = useMembership()?.establishment.name;
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: estKey(establishmentId, 'qr-codes'),
    queryFn: () => floorApi.qrCodes(establishmentId),
  });

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/tables" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          Retour aux tables
        </Link>
        <Button onClick={() => window.print()} disabled={!data || data.length === 0}>
          <Printer className="size-4" aria-hidden />
          Imprimer
        </Button>
      </div>
      {isPending ? (
        <Spinner />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState title="Aucun QR code" description="Créez des tables pour obtenir leurs QR codes." />
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 print:grid-cols-2 print:gap-6">
          {data.map((qr) => (
            <li key={qr.tableId} className="flex break-inside-avoid flex-col items-center rounded-2xl bg-white p-5 text-center ring-1 ring-line">
              <p className="text-[13px] font-medium text-ink-2">{establishment}</p>
              <p className="tabular mt-1 font-mono text-3xl font-semibold text-ink">Table {qr.tableLabel}</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- image générée, encodée en URL data */}
              <img src={svgDataUrl(qr.svg)} alt={`QR code de la table ${qr.tableLabel}`} className="mt-3 aspect-square w-full max-w-52" />
              <p className="mt-3 text-sm font-medium text-ink">Scannez pour appeler le service</p>
              <p className="text-xs text-ink-3">Sans application · {qr.areaName}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
