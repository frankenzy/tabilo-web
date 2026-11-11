'use client';

import * as Menu from '@radix-ui/react-dropdown-menu';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, MoreHorizontal, Plus, Printer, QrCode as QrIcon, Smartphone, Users } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useFloor } from '@/components/pages/requests/use-requests';
import { Button, ConfirmDialog, Dialog, DialogActions, EmptyState, ErrorState, FormError, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { areaSchema, fieldErrors, tableSchema, type Area, type Table } from '@/contracts';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { cn } from '@/lib/utils';
import { floorApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { useCan } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import { downloadPng, downloadSvg, svgDataUrl } from '@/utils/qr';

type FloorDialog =
  | { kind: 'area'; area?: Area }
  | { kind: 'table'; table?: Table; areaId?: string }
  | { kind: 'qr'; table: Table }
  | { kind: 'archive-area'; area: Area }
  | { kind: 'archive-table'; table: Table }
  | { kind: 'close-sessions'; table: Table }
  | null;

const MENU = 'z-50 min-w-48 rounded-xl bg-surface p-1 shadow-pop ring-1 ring-line animate-rise';
const ITEM = 'cursor-pointer rounded-lg px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-sunken';

function useInvalidateFloor() {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'floor') });
    void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'qr-codes') });
  };
}

export function FloorPage() {
  const { data: areas, isPending, isError, error, refetch } = useFloor();
  const canManage = useCan('floor.manage');
  const canQr = useCan('qr.manage');
  const canSessions = useCan('sessions.manage');
  const [dialog, setDialog] = useState<FloorDialog>(null);
  const close = () => setDialog(null);
  const hasTables = (areas ?? []).some((area) => area.tables.length > 0);

  return (
    <>
      <PageHeader
        title="Salle"
        description="Zones, tables et QR codes de l’établissement."
        actions={
          <>
            {canQr && hasTables && (
              <Link href="/app/salle/qr" className="inline-flex h-10 items-center gap-2 rounded-lg bg-surface px-4 text-sm font-medium text-ink ring-1 ring-line ring-inset hover:bg-sunken">
                <Printer className="size-4" aria-hidden />
                Imprimer les QR codes
              </Link>
            )}
            {canManage && (
              <>
                <Button variant="secondary" onClick={() => setDialog({ kind: 'area' })}>
                  Nouvelle zone
                </Button>
                <Button onClick={() => setDialog({ kind: 'table' })} disabled={!areas || areas.length === 0}>
                  <Plus className="size-4" aria-hidden />
                  Nouvelle table
                </Button>
              </>
            )}
          </>
        }
      />

      {isPending ? (
        <Spinner />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : areas.length === 0 ? (
        <EmptyState
          icon={<QrIcon className="size-6" aria-hidden />}
          title="Commencez par créer une zone"
          description="Une zone regroupe des tables : salle, terrasse, étage… Chaque table reçoit ensuite son QR code."
          action={canManage && <Button onClick={() => setDialog({ kind: 'area' })}>Créer une zone</Button>}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {areas.map((area) => (
            <section key={area.id} aria-labelledby={`area-${area.id}`}>
              <div className="flex items-center justify-between gap-2">
                <h2 id={`area-${area.id}`} className="text-[15px] font-semibold text-ink">
                  {area.name}
                  <span className="ml-2 text-[13px] font-normal text-ink-3">
                    {area.tables.length} table{area.tables.length > 1 ? 's' : ''}
                  </span>
                </h2>
                {canManage && (
                  <Menu.Root>
                    <Menu.Trigger className="rounded-lg p-2 text-ink-3 hover:bg-sunken hover:text-ink" aria-label={`Actions sur la zone ${area.name}`}>
                      <MoreHorizontal className="size-4" aria-hidden />
                    </Menu.Trigger>
                    <Menu.Portal>
                      <Menu.Content align="end" sideOffset={4} className={MENU}>
                        <Menu.Item className={ITEM} onSelect={() => setDialog({ kind: 'table', areaId: area.id })}>
                          Ajouter une table
                        </Menu.Item>
                        <Menu.Item className={ITEM} onSelect={() => setDialog({ kind: 'area', area })}>
                          Renommer
                        </Menu.Item>
                        <Menu.Item className={cn(ITEM, 'text-late')} onSelect={() => setDialog({ kind: 'archive-area', area })}>
                          Supprimer la zone…
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Portal>
                  </Menu.Root>
                )}
              </div>
              {area.tables.length === 0 ? (
                <p className="mt-2 text-sm text-ink-3">Aucune table dans cette zone.</p>
              ) : (
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {area.tables.map((table) => (
                    <li key={table.id} className="flex items-start justify-between rounded-(--radius-card) bg-surface p-3 ring-1 ring-line">
                      <div className="min-w-0">
                        <p className="tabular truncate font-mono text-xl leading-none font-semibold text-ink">{table.label}</p>
                        <p className="mt-2 flex items-center gap-1 text-[13px] text-ink-2">
                          <Users className="size-3.5" aria-hidden />
                          {table.seats} couverts
                        </p>
                        {table.openSessions > 0 && (
                          <p className="mt-1 flex items-center gap-1 text-[13px] text-progress">
                            <Smartphone className="size-3.5" aria-hidden />
                            {table.openSessions} connecté{table.openSessions > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      {(canManage || canQr || canSessions) && (
                        <Menu.Root>
                          <Menu.Trigger className="-mt-1 -mr-1 rounded-lg p-2 text-ink-3 hover:bg-sunken hover:text-ink" aria-label={`Actions sur la table ${table.label}`}>
                            <MoreHorizontal className="size-4" aria-hidden />
                          </Menu.Trigger>
                          <Menu.Portal>
                            <Menu.Content align="end" sideOffset={4} className={MENU}>
                              {canQr && (
                                <Menu.Item className={ITEM} onSelect={() => setDialog({ kind: 'qr', table })}>
                                  QR code
                                </Menu.Item>
                              )}
                              {canSessions && (
                                <Menu.Item className={ITEM} onSelect={() => setDialog({ kind: 'close-sessions', table })}>
                                  Fermer les sessions
                                </Menu.Item>
                              )}
                              {canManage && (
                                <>
                                  <Menu.Item className={ITEM} onSelect={() => setDialog({ kind: 'table', table })}>
                                    Modifier
                                  </Menu.Item>
                                  <Menu.Item className={cn(ITEM, 'text-late')} onSelect={() => setDialog({ kind: 'archive-table', table })}>
                                    Supprimer la table…
                                  </Menu.Item>
                                </>
                              )}
                            </Menu.Content>
                          </Menu.Portal>
                        </Menu.Root>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {dialog?.kind === 'area' && <AreaDialog area={dialog.area} onClose={close} />}
      {dialog?.kind === 'table' && <TableDialog table={dialog.table} areaId={dialog.areaId} areas={areas ?? []} onClose={close} />}
      {dialog?.kind === 'qr' && <QrDialog table={dialog.table} onClose={close} />}
      {dialog?.kind === 'archive-area' && (
        <Confirm
          title={`Supprimer la zone « ${dialog.area.name} » ?`}
          description="La zone doit être vide. L’historique des demandes est conservé."
          confirmLabel="Supprimer"
          success="Zone supprimée"
          run={(e) => floorApi.archiveArea(e, dialog.area.id)}
          onClose={close}
        />
      )}
      {dialog?.kind === 'archive-table' && (
        <Confirm
          title={`Supprimer la table ${dialog.table.label} ?`}
          description="Son QR code cessera de fonctionner. L’historique des demandes est conservé."
          confirmLabel="Supprimer"
          success="Table supprimée"
          run={(e) => floorApi.archiveTable(e, dialog.table.id)}
          onClose={close}
        />
      )}
      {dialog?.kind === 'close-sessions' && (
        <Confirm
          title={`Fermer les sessions de la table ${dialog.table.label} ?`}
          description="Les téléphones connectés ne pourront plus envoyer de demande sans scanner à nouveau le QR code."
          confirmLabel="Fermer les sessions"
          success="Sessions fermées"
          danger={false}
          run={(e) => floorApi.closeSessions(e, dialog.table.id)}
          onClose={close}
        />
      )}
    </>
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

function TableDialog({ table, areaId, areas, onClose }: { table?: Table; areaId?: string; areas: Area[]; onClose: () => void }) {
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

function QrDialog({ table, onClose }: { table: Table; onClose: () => void }) {
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
