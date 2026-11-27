'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Printer, ScanLine } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Button, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { EstablishmentLogo } from '@/components/ui/establishment-logo';
import { brandOf } from '@/constants/branding';
import type { QrCode } from '@/contracts';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { cn } from '@/lib/utils';
import { establishmentApi, floorApi, menuImageUrl } from '@/services/api';
import { useMembership } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import { errorMessage } from '@/services/http';
import { svgDataUrl } from '@/utils/qr';
import { paginate, TEMPLATES, type QrTemplate } from './qr-templates';

/**
 * Spec 042 : planche de QR à imprimer, à l'image de l'établissement — modèle, zone, tables cochées,
 * et filtre « À imprimer » (QR jamais imprimés, dont ceux régénérés depuis la dernière impression, R5).
 */
export function QrSheetPage() {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const name = useMembership()?.establishment.name ?? '';
  const qrs = useQuery({ queryKey: estKey(establishmentId, 'qr-codes'), queryFn: () => floorApi.qrCodes(establishmentId) });
  const establishment = useQuery({ queryKey: estKey(establishmentId, 'establishment'), queryFn: () => establishmentApi.get(establishmentId) });
  const [template, setTemplate] = useState<QrTemplate>('tent');
  const [areaId, setAreaId] = useState('all');
  const [onlyToPrint, setOnlyToPrint] = useState(false);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());

  const areas = useMemo(() => [...new Map((qrs.data ?? []).map((qr) => [qr.areaId ?? qr.areaName, qr.areaName])).entries()], [qrs.data]);
  const shown = (qrs.data ?? []).filter((qr) => (areaId === 'all' || (qr.areaId ?? qr.areaName) === areaId) && (!onlyToPrint || !qr.printedAt));
  const selected = shown.filter((qr) => !unchecked.has(qr.tableId));
  const spec = TEMPLATES[template];
  const color = brandOf(establishment.data?.brandColor).brand;
  const logoImageId = establishment.data?.logoImageId ?? null;

  const printed = useMutation({
    mutationFn: (tableIds: string[]) => floorApi.markQrPrinted(establishmentId, tableIds),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'qr-codes') }),
  });
  // R5 : après l'impression, les QR imprimés sortent du filtre « À imprimer ».
  useEffect(() => {
    const after = () => {
      if (selected.length > 0) printed.mutate(selected.map((qr) => qr.tableId));
    };
    window.addEventListener('afterprint', after);
    return () => window.removeEventListener('afterprint', after);
  });

  const toggle = (tableId: string) =>
    setUnchecked((current) => {
      const next = new Set(current);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });

  return (
    <>
      {/* Spec 042, exigence d'impression : A4 sans marges ajoutées par le navigateur. */}
      <style>{`@media print { @page { size: A4; margin: 0; } body { background: #fff !important; } }`}</style>
      <div className="no-print mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/app/tables" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            Retour aux tables
          </Link>
          <Button
            onClick={() => (selected.length === 0 ? toast.error('Aucune table choisie') : window.print())}
            disabled={qrs.isPending}
          >
            <Printer className="size-4" aria-hidden />
            Imprimer {selected.length > 0 ? `(${selected.length})` : ''}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[12px] text-ink-2">
            Modèle
            <select value={template} onChange={(event) => setTemplate(event.target.value as QrTemplate)} className="h-9 rounded-lg border border-line bg-surface px-2 text-[14px] text-ink">
              {(Object.keys(TEMPLATES) as QrTemplate[]).map((key) => (
                <option key={key} value={key}>
                  {TEMPLATES[key].label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ink-2">
            Zone
            <select value={areaId} onChange={(event) => setAreaId(event.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-[14px] text-ink">
              <option value="all">Toutes les zones</option>
              {areas.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex h-9 items-center gap-2 text-[14px] text-ink">
            <input type="checkbox" checked={onlyToPrint} onChange={(event) => setOnlyToPrint(event.target.checked)} />
            À imprimer seulement (nouveaux et régénérés)
          </label>
        </div>
        {shown.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tables à imprimer">
            {shown.map((qr) => {
              const on = !unchecked.has(qr.tableId);
              return (
                <button
                  key={qr.tableId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(qr.tableId)}
                  className={cn('h-8 rounded-full px-3 text-[13px] font-medium ring-1', on ? 'bg-ink text-white ring-ink' : 'bg-surface text-ink-3 ring-line')}
                >
                  Table {qr.tableLabel}
                  {!qr.printedAt && <span className={cn('ml-1.5 inline-block size-1.5 rounded-full align-middle', on ? 'bg-wait' : 'bg-brand')} aria-label="à imprimer" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {qrs.isPending ? (
        <Spinner />
      ) : qrs.isError ? (
        <ErrorState message={errorMessage(qrs.error)} onRetry={() => void qrs.refetch()} />
      ) : selected.length === 0 ? (
        <EmptyState title="Aucun QR à imprimer" description={onlyToPrint ? 'Tous les QR de cette sélection sont déjà imprimés.' : 'Créez des tables ou cochez-en.'} />
      ) : (
        <div className="flex flex-col items-center gap-6 print:block print:gap-0">
          {paginate(selected, spec.perPage).map((page, index) => (
            // Une feuille A4 ; à l'écran, un aperçu à l'échelle.
            <section
              key={index}
              className="grid break-after-page content-start justify-center gap-[4mm] bg-white p-[6mm] shadow-sm ring-1 ring-line print:shadow-none print:ring-0"
              style={{ width: '210mm', minHeight: '297mm', gridTemplateColumns: `repeat(${spec.columns}, ${spec.width}mm)` } as CSSProperties}
            >
              {page.map((qr) =>
                template === 'tent' ? (
                  // Chevalet : la face du haut est retournée, pour être lisible une fois pliée.
                  <div key={qr.tableId} className="flex flex-col" style={{ width: `${spec.width}mm` }}>
                    <div className="rotate-180">
                      <QrFace qr={qr} name={name} logoImageId={logoImageId} color={color} template={template} />
                    </div>
                    <QrFace qr={qr} name={name} logoImageId={logoImageId} color={color} template={template} />
                  </div>
                ) : (
                  <QrFace key={qr.tableId} qr={qr} name={name} logoImageId={logoImageId} color={color} template={template} />
                ),
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Spec 042, R1 et R3 : une face — bandeau à la couleur, logo (ou initiale), nom, « Table n », QR noir sur blanc
 * (logo au centre seulement s'il existe, correction H), pictogramme et « Scannez pour commander ».
 */
function QrFace({ qr, name, logoImageId, color, template }: { qr: QrCode; name: string; logoImageId: string | null; color: string; template: QrTemplate }) {
  const spec = TEMPLATES[template];
  const compact = template === 'sticker';
  return (
    <article
      className="flex break-inside-avoid flex-col items-center overflow-hidden rounded-[3mm] border-[1.5mm] bg-white text-center"
      style={{ width: `${spec.width}mm`, height: `${spec.height}mm`, borderColor: color }}
    >
      {!compact && (
        <header className="flex w-full items-center justify-center gap-[2mm] py-[3mm] text-white" style={{ backgroundColor: color }}>
          <span className="rounded-[1.5mm] bg-white p-[0.5mm]">
            <EstablishmentLogo name={name} logoImageId={logoImageId} size="sm" />
          </span>
          <span className="max-w-[70mm] truncate text-[4.2mm] font-semibold">{name}</span>
        </header>
      )}
      <p className={cn('tabular font-bold text-black', compact ? 'mt-[1.5mm] text-[5mm]' : 'mt-[3mm] text-[9mm] leading-none')}>Table {qr.tableLabel}</p>
      {!compact && <p className="text-[3.2mm] text-neutral-600">{qr.areaName}</p>}
      <div className="relative mt-[2mm]" style={{ width: `${spec.qr}mm`, height: `${spec.qr}mm` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- QR généré par l'API, en URL data */}
        <img src={svgDataUrl(qr.svg)} alt={`QR code de la table ${qr.tableLabel}`} className="size-full" />
        {logoImageId && (
          // R3 : logo au centre, 18 % du côté, sur fond blanc ; la correction H absorbe la zone masquée.
          <span className="absolute top-1/2 left-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[1mm] bg-white p-[0.6mm]" style={{ width: '18%', height: '18%' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- logo servi par l'API */}
            <img src={menuImageUrl(logoImageId)} alt="" className="size-full rounded-[0.6mm] object-cover" />
          </span>
        )}
      </div>
      <p className={cn('flex items-center gap-[1.5mm] font-semibold text-black', compact ? 'mt-[1mm] text-[3mm]' : 'mt-[3mm] text-[4mm]')}>
        <ScanLine className={compact ? 'size-[3.5mm]' : 'size-[5mm]'} aria-hidden />
        Scannez pour commander
      </p>
    </article>
  );
}
