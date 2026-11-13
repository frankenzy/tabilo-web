'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, ConfirmDialog, Dialog, DialogActions, ErrorState, FormError, Input, Select, Spinner } from '@/components/ui';
import { areaSchema, fieldErrors, tableSchema, type Area } from '@/contracts';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { floorApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { toast } from '@/stores/toast.store';
import { downloadPng, downloadSvg, svgDataUrl } from '@/utils/qr';

/**
 * Fenêtres de configuration de la salle : zones, tables, QR codes.
 * Ouvertes depuis la vue « Tables » (spec 006, R12), qui remplace l'ancienne page « Salle ».
 */

/** Ce qu'il faut d'une table pour la modifier ou voir son QR code. */
export interface FloorTable {
  id: string;
  label: string;
  seats: number;
  areaId: string;
}

export type FloorDialog =
  | { kind: 'zones' }
  /** `fromZones` : revenir à la liste des zones à la fermeture. */
  | { kind: 'area'; area?: Area; fromZones?: boolean }
  | { kind: 'table'; table?: FloorTable; areaId?: string }
  | { kind: 'qr'; table: FloorTable }
  | { kind: 'archive-area'; area: Area }
  | { kind: 'archive-table'; table: FloorTable }
  | null;

function useInvalidateFloor() {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'floor') });
    void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'qr-codes') });
    void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'tables-overview') });
  };
}

export function FloorDialogs({
  dialog, areas, onChange, onClose,
}: { dialog: FloorDialog; areas: Area[]; onChange: (dialog: FloorDialog) => void; onClose: () => void }) {
  if (!dialog) return null;
  switch (dialog.kind) {
    case 'zones':
      return <ZonesDialog areas={areas} onChange={onChange} onClose={onClose} />;
    case 'area':
      return <AreaDialog area={dialog.area} onClose={() => (dialog.fromZones ? onChange({ kind: 'zones' }) : onClose())} />;
    case 'table':
      return <TableDialog table={dialog.table} areaId={dialog.areaId} areas={areas} onClose={onClose} />;
    case 'qr':
      return <QrDialog table={dialog.table} onClose={onClose} />;
    case 'archive-area':
      return (
        <Confirm
          title={`Supprimer la zone « ${dialog.area.name} » ?`}
          description="La zone doit être vide. L’historique des demandes est conservé."
          confirmLabel="Supprimer"
          success="Zone supprimée"
          run={(e) => floorApi.archiveArea(e, dialog.area.id)}
          onClose={() => onChange({ kind: 'zones' })}
        />
      );
    case 'archive-table':
      return (
        <Confirm
          title={`Supprimer la table ${dialog.table.label} ?`}
          description="Son QR code cessera de fonctionner. L’historique des demandes est conservé."
          confirmLabel="Supprimer"
          success="Table supprimée"
          run={(e) => floorApi.archiveTable(e, dialog.table.id)}
          onClose={onClose}
        />
      );
  }
}

/** Liste des zones : créer, renommer, supprimer (une zone doit être vide pour être supprimée). */
function ZonesDialog({ areas, onChange, onClose }: { areas: Area[]; onChange: (dialog: FloorDialog) => void; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Zones" description="Une zone regroupe des tables : salle, terrasse, étage…">
      {areas.length === 0 ? (
        <p className="text-sm text-ink-2">Aucune zone pour l’instant.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-(--radius-card) ring-1 ring-line">
          {areas.map((area) => (
            <li key={area.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{area.name}</span>
                <span className="text-[13px] text-ink-3">
                  {area.tables.length} table{area.tables.length > 1 ? 's' : ''}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onChange({ kind: 'area', area, fromZones: true })}
                className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-sunken hover:text-ink"
                aria-label={`Renommer la zone ${area.name}`}
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onChange({ kind: 'archive-area', area })}
                disabled={area.tables.length > 0}
                title={area.tables.length > 0 ? 'Déplacez ou supprimez d’abord ses tables' : undefined}
                className="grid size-9 place-items-center rounded-lg text-late hover:bg-late-soft disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent"
                aria-label={`Supprimer la zone ${area.name}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>
          Fermer
        </Button>
        <Button onClick={() => onChange({ kind: 'area', fromZones: true })}>
          <Plus className="size-4" aria-hidden />
          Nouvelle zone
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Confirm({
  title, description, confirmLabel, success, run, onClose, danger = true,
}: { title: string; description: string; confirmLabel: string; success: string; run: (establishmentId: string) => Promise<unknown>; onClose: () => void; danger?: boolean }) {
  const establishmentId = useEstablishmentId();
  const invalidate = useInvalidateFloor();
  const mutation = useMutation({
    mutationFn: () => run(establishmentId),
    onSuccess: () => {
      toast.success(success);
      invalidate();
      onClose();
    },
    onError: (error) => {
      toast.error('Action impossible', errorMessage(error));
      onClose();
    },
  });
  return (
    <ConfirmDialog open onOpenChange={(open) => !open && onClose()} title={title} description={description} confirmLabel={confirmLabel} danger={danger} loading={mutation.isPending} onConfirm={() => mutation.mutate()} />
  );
}

function AreaDialog({ area, onClose }: { area?: Area; onClose: () => void }) {
  const establishmentId = useEstablishmentId();
  const invalidate = useInvalidateFloor();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (body: { name: string }) => (area ? floorApi.updateArea(establishmentId, area.id, body) : floorApi.createArea(establishmentId, body)),
    onSuccess: () => {
      toast.success(area ? 'Zone renommée' : 'Zone créée');
      invalidate();
      onClose();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = areaSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    save.mutate(parsed.data);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={area ? 'Renommer la zone' : 'Nouvelle zone'}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input label="Nom de la zone" name="name" defaultValue={area?.name} placeholder="Ex. : Terrasse" error={errors.name} autoFocus />
        <FormError message={save.isError ? errorMessage(save.error) : null} />
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={save.isPending}>
            {area ? 'Enregistrer' : 'Créer la zone'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function TableDialog({ table, areaId, areas, onClose }: { table?: FloorTable; areaId?: string; areas: Area[]; onClose: () => void }) {
  const establishmentId = useEstablishmentId();
  const invalidate = useInvalidateFloor();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (body: { areaId: string; label: string; seats: number }) =>
      table ? floorApi.updateTable(establishmentId, table.id, body) : floorApi.createTable(establishmentId, body),
    onSuccess: () => {
      toast.success(table ? 'Table modifiée' : 'Table créée', table ? undefined : 'Son QR code est prêt.');
      invalidate();
      onClose();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = tableSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    save.mutate(parsed.data);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={table ? `Modifier la table ${table.label}` : 'Nouvelle table'}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Select label="Zone" name="areaId" defaultValue={table?.areaId ?? areaId ?? areas[0]?.id} error={errors.areaId}>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nom ou numéro" name="label" defaultValue={table?.label} placeholder="Ex. : 12" error={errors.label} autoFocus />
          <Input label="Couverts" name="seats" type="number" inputMode="numeric" min={1} max={50} defaultValue={table?.seats ?? 2} error={errors.seats} />
        </div>
        <FormError message={save.isError ? errorMessage(save.error) : null} />
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={save.isPending}>
            {table ? 'Enregistrer' : 'Créer la table'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function QrDialog({ table, onClose }: { table: FloorTable; onClose: () => void }) {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const key = estKey(establishmentId, 'qr-codes');
  const codes = useQuery({ queryKey: key, queryFn: () => floorApi.qrCodes(establishmentId) });
  const [confirming, setConfirming] = useState(false);
  const regenerate = useMutation({
    mutationFn: () => floorApi.regenerateQr(establishmentId, table.id),
    onSuccess: () => {
      toast.success('Nouveau QR code généré', 'L’ancien ne fonctionne plus : pensez à le remplacer sur la table.');
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'floor') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'tables-overview') });
    },
    onError: (error) => toast.error('Régénération impossible', errorMessage(error)),
  });
  const qr = codes.data?.find((code) => code.tableId === table.id);
  const filename = `tabilo-table-${table.label}`;

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié');
    } catch {
      toast.error('Copie impossible', url);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={`QR code · Table ${table.label}`} description="À imprimer et à poser sur la table.">
      {codes.isPending ? (
        <Spinner />
      ) : codes.isError ? (
        <ErrorState message={errorMessage(codes.error)} onRetry={() => void codes.refetch()} />
      ) : !qr ? (
        <p className="text-sm text-ink-2">Cette table n’a pas de QR code actif.</p>
      ) : confirming ? (
        <div>
          <p className="text-sm text-ink">
            Le QR code actuel cessera de fonctionner immédiatement et les sessions ouvertes seront fermées. À utiliser si
            le code a été photographié ou détourné.
          </p>
          <DialogActions>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Retour
            </Button>
            <Button variant="danger" loading={regenerate.isPending} onClick={() => regenerate.mutate()}>
              Remplacer le QR code
            </Button>
          </DialogActions>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- image générée, encodée en URL data */}
          <img src={svgDataUrl(qr.svg)} alt={`QR code de la table ${table.label}`} className="size-56 rounded-xl ring-1 ring-line" />
          <button type="button" onClick={() => void copy(qr.url)} className="flex max-w-full items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
            <Copy className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{qr.url}</span>
          </button>
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => void downloadPng(qr.svg, filename).catch(() => toast.error('Export PNG impossible'))}>
              <Download className="size-4" aria-hidden />
              PNG
            </Button>
            <Button variant="secondary" onClick={() => downloadSvg(qr.svg, filename)}>
              <Download className="size-4" aria-hidden />
              SVG
            </Button>
          </div>
          <button type="button" onClick={() => setConfirming(true)} className="text-[13px] font-medium text-late underline underline-offset-4">
            Remplacer ce QR code…
          </button>
        </div>
      )}
    </Dialog>
  );
}
