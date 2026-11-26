'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, FileText, Lock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Card } from '@/components/ui';
import { useFeature } from '@/hooks/use-account';
import { useCurrency } from '@/hooks/use-currency';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { analyticsApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { toast } from '@/stores/toast.store';
import { formatMoney } from '@/utils/money';
import { EXPORT_PRESETS, presetRange, type ExportPreset } from './export-logic';

/** Télécharge un fichier reçu de l'API (le navigateur garde le nom proposé). */
function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Spec 040, P1 et P2 : export CSV des commandes et récapitulatif imprimable d'une période.
 * Spec 038, R8 bis : ventes par option, sur la même période.
 */
export function ExportPanel() {
  const establishmentId = useEstablishmentId();
  const currency = useCurrency();
  const exportsAllowed = useFeature('exports');
  const optionsAllowed = useFeature('options');
  const [preset, setPreset] = useState<ExportPreset>('today');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const range = preset === 'custom' ? custom : presetRange(preset, new Date());
  const ready = Boolean(range.from && range.to);

  const csv = useMutation({
    mutationFn: () => analyticsApi.exportCsv(establishmentId, range.from, range.to),
    onSuccess: (blob) => save(blob, `ventes-${range.from}-${range.to}.csv`),
    onError: (error) => toast.error('Export impossible', errorMessage(error)),
  });
  const options = useQuery({
    queryKey: estKey(establishmentId, 'report', 'options', range),
    queryFn: () => analyticsApi.options(establishmentId, range.from, range.to),
    enabled: optionsAllowed && ready,
  });

  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Exporter les ventes</h2>
          <p className="text-[13px] text-ink-2">Pour le comptable (CSV) ou pour garder une trace (récapitulatif imprimable).</p>
        </div>
        <label className="ml-auto flex flex-col gap-1 text-[12px] text-ink-2">
          Période
          <select value={preset} onChange={(event) => setPreset(event.target.value as ExportPreset)} className="h-9 rounded-lg border border-line bg-surface px-2 text-[14px] text-ink">
            {EXPORT_PRESETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {preset === 'custom' && (
          <>
            <label className="flex flex-col gap-1 text-[12px] text-ink-2">
              Du
              <input type="date" value={custom.from} onChange={(event) => setCustom({ ...custom, from: event.target.value })} className="h-9 rounded-lg border border-line bg-surface px-2 text-[14px]" />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-2">
              Au
              <input type="date" value={custom.to} onChange={(event) => setCustom({ ...custom, to: event.target.value })} className="h-9 rounded-lg border border-line bg-surface px-2 text-[14px]" />
            </label>
          </>
        )}
      </div>
      {exportsAllowed ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!ready} loading={csv.isPending} onClick={() => csv.mutate()}>
            <Download className="size-4" aria-hidden />
            Télécharger (CSV)
          </Button>
          <Link
            href={ready ? `/app/statistiques/recapitulatif?du=${range.from}&au=${range.to}` : '#'}
            aria-disabled={!ready}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3.5 text-[14px] font-medium text-ink ring-1 ring-line hover:bg-sunken"
          >
            <FileText className="size-4" aria-hidden />
            Récapitulatif (PDF)
          </Link>
        </div>
      ) : (
        <p className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-ink-3">
          <Lock className="size-3.5" aria-hidden />
          L’export des ventes est compris dans la formule Pro.
        </p>
      )}
      {optionsAllowed && options.data && options.data.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[14px] font-semibold text-ink">Ventes par option</h3>
          <table className="mt-2 w-full text-left text-[14px]">
            <thead className="text-[12px] text-ink-3">
              <tr>
                <th className="py-1.5 font-medium">Plat</th>
                <th className="py-1.5 font-medium">Option</th>
                <th className="py-1.5 text-right font-medium">Vendues</th>
                <th className="py-1.5 text-right font-medium">Suppléments</th>
              </tr>
            </thead>
            <tbody>
              {options.data.map((row) => (
                <tr key={`${row.menuItemId}-${row.group}-${row.option}`} className="border-t border-line">
                  <td className="py-1.5 text-ink-2">{row.item}</td>
                  <td className="py-1.5 text-ink">
                    {row.option} <span className="text-[12px] text-ink-3">· {row.group}</span>
                  </td>
                  <td className="tabular py-1.5 text-right font-semibold">×{row.quantity}</td>
                  <td className="tabular py-1.5 text-right">{formatMoney(row.amountMinor, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
