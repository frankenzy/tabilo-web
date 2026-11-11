'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { Badge, Button, Checkbox, Dialog, DialogActions, FormError, Select, Spinner, Textarea } from '@/components/ui';
import { EVENT_LABELS, STATUS_LABELS, STATUS_TONE } from '@/constants/requests';
import type { ServiceRequest } from '@/contracts';
import { estKey, useEstablishmentId, useTimezone } from '@/hooks/use-establishment';
import { requestsApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { useAuthStore, useCan } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import { formatDateTime, formatDuration } from '@/utils/time';
import { useFloor, useRequestAction, useRequestTypes, useStaff } from './use-requests';
import { OrderLines } from './order-lines';

export type RequestDialog =
  | { kind: 'assign' | 'transfer' | 'release' | 'cancel' | 'detail'; request: ServiceRequest }
  | { kind: 'create' }
  | null;

export function RequestDialogs({ dialog, onClose }: { dialog: RequestDialog; onClose: () => void }) {
  if (!dialog) return null;
  if (dialog.kind === 'create') return <CreateRequestDialog onClose={onClose} />;
  if (dialog.kind === 'detail') return <RequestDetail request={dialog.request} onClose={onClose} />;
  if (dialog.kind === 'assign' || dialog.kind === 'transfer') return <PersonDialog kind={dialog.kind} request={dialog.request} onClose={onClose} />;
  return <ReasonDialog kind={dialog.kind} request={dialog.request} onClose={onClose} />;
}

const subject = (request: ServiceRequest) => `Table ${request.table.label} · ${request.type.label}`;

function PersonDialog({ kind, request, onClose }: { kind: 'assign' | 'transfer'; request: ServiceRequest; onClose: () => void }) {
  const staff = useStaff();
  const action = useRequestAction();
  const [assigneeId, setAssigneeId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Une première affectation n'exige pas de motif ; une réaffectation ou un transfert, si.
  const reasonRequired = request.status !== 'pending';
  const candidates = (staff.data ?? []).filter((m) => m.canHandleRequests && m.status === 'active' && m.id !== request.assignee?.id);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!assigneeId) return setError('Choisissez une personne.');
    if (reasonRequired && reason.trim().length < 3) return setError('Indiquez un motif.');
    action.mutate(
      { id: request.id, action: kind, body: { assigneeId, reason: reason.trim() || undefined } },
      { onSuccess: onClose },
    );
  }

  const title = kind === 'transfer' ? 'Transférer la demande' : request.assignee ? 'Réaffecter la demande' : 'Affecter la demande';
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={title} description={subject(request)}>
      {staff.isPending ? (
        <Spinner />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Select label="Confier à" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Choisir…</option>
            {candidates.map((member) => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.lastName} — {member.role.name}
              </option>
            ))}
          </Select>
          <Textarea
            label={reasonRequired ? 'Motif' : 'Motif (facultatif)'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="Ex. : fin de service"
          />
          <FormError message={error} />
          <DialogActions>
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={action.isPending}>
              Confirmer
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}

function ReasonDialog({ kind, request, onClose }: { kind: 'release' | 'cancel'; request: ServiceRequest; onClose: () => void }) {
  const action = useRequestAction();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const required = kind === 'release';

  function submit(event: FormEvent) {
    event.preventDefault();
    if (required && reason.trim().length < 3) return setError('Indiquez un motif.');
    action.mutate({ id: request.id, action: kind, body: reason.trim() ? { reason: reason.trim() } : {} }, { onSuccess: onClose });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={kind === 'release' ? 'Remettre en attente' : 'Annuler la demande'}
      description={subject(request)}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Textarea
          label={required ? 'Motif' : 'Motif (facultatif)'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          rows={2}
          hint={kind === 'release' ? 'La demande redevient disponible pour toute l’équipe.' : undefined}
        />
        <FormError message={error} />
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            Retour
          </Button>
          <Button type="submit" variant={kind === 'cancel' ? 'danger' : 'primary'} loading={action.isPending}>
            {kind === 'release' ? 'Remettre en attente' : 'Annuler la demande'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** Demande saisie par le personnel : pour un client sans smartphone, ou une demande faite de vive voix. */
function CreateRequestDialog({ onClose }: { onClose: () => void }) {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const floor = useFloor();
  const types = useRequestTypes();
  const canHandle = useCan('requests.handle');
  const [tableId, setTableId] = useState('');
  const [requestTypeId, setRequestTypeId] = useState('');
  const [note, setNote] = useState('');
  const [takeIt, setTakeIt] = useState(canHandle);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => requestsApi.create(establishmentId, { tableId, requestTypeId, note: note.trim() || undefined, takeIt: canHandle && takeIt }),
    onSuccess: () => {
      toast.success('Demande créée');
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'requests') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'live') });
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!tableId || !requestTypeId) return setError('Choisissez une table et un type de demande.');
    setError(null);
    create.mutate();
  }

  // Une commande se passe depuis la carte, par le client : le personnel ne crée que des demandes de service.
  const activeTypes = (types.data ?? []).filter((type) => type.isActive && type.kind === 'service');
  const hasTables = (floor.data ?? []).some((area) => area.tables.length > 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Nouvelle demande" description="Pour un client qui s’adresse directement à vous.">
      {floor.isPending || types.isPending ? (
        <Spinner />
      ) : !hasTables ? (
        <p className="text-sm text-ink-2">Aucune table n’est configurée. Ajoutez-en depuis l’écran Salle.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Select label="Table" value={tableId} onChange={(e) => setTableId(e.target.value)}>
            <option value="">Choisir…</option>
            {(floor.data ?? []).map((area) => (
              <optgroup key={area.id} label={area.name}>
                {area.tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    Table {table.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          <Select label="Demande" value={requestTypeId} onChange={(e) => setRequestTypeId(e.target.value)}>
            <option value="">Choisir…</option>
            {activeTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </Select>
          <Textarea label="Précision (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={2} />
          {canHandle && <Checkbox label="Je m’en occupe" hint="La demande vous est affectée et acceptée." checked={takeIt} onChange={(e) => setTakeIt(e.target.checked)} />}
          <FormError message={error} />
          <DialogActions>
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              Créer la demande
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}

function RequestDetail({ request, onClose }: { request: ServiceRequest; onClose: () => void }) {
  const establishmentId = useEstablishmentId();
  const timezone = useTimezone();
  const detail = useQuery({
    queryKey: estKey(establishmentId, 'requests', 'detail', request.id),
    queryFn: () => requestsApi.get(establishmentId, request.id),
  });
  const current = detail.data ?? request;
  const me = useAuthStore((state) => state.me);

  const durations = useMemo(() => {
    const since = (iso: string | null) => (iso ? (new Date(iso).getTime() - new Date(current.createdAt).getTime()) / 1000 : null);
    return [
      { label: 'Affectation', value: since(current.assignedAt) },
      { label: 'Prise en charge', value: since(current.acceptedAt) },
      { label: 'Début du traitement', value: since(current.startedAt) },
      { label: 'Résolution', value: since(current.resolvedAt) },
    ];
  }, [current]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={subject(current)} description={`${current.area.name} · créée ${formatDateTime(current.createdAt, timezone)}`} variant="sheet">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[current.status]}>{STATUS_LABELS[current.status]}</Badge>
        {current.escalationStatus !== 'none' && <Badge tone="late">{current.escalationStatus === 'escalated' ? 'Escaladée' : 'Escalade acquittée'}</Badge>}
        {current.priority === 'high' && <Badge tone="brand">Prioritaire</Badge>}
        <Badge>{current.source === 'customer' ? 'Par le client' : 'Par le personnel'}</Badge>
      </div>
      {current.type.kind === 'order' && <OrderLines items={current.items} totalMinor={current.totalMinor} />}
      {current.note && <p className="mt-4 rounded-lg bg-sunken px-3 py-2 text-sm text-ink">« {current.note} »</p>}
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-ink-3">Responsable</dt>
          <dd className="text-ink">
            {current.assignee ? `${current.assignee.firstName} ${current.assignee.lastName}${current.assignee.id === me?.id ? ' (vous)' : ''}` : '—'}
          </dd>
        </div>
        {durations.map((item) => (
          <div key={item.label}>
            <dt className="text-ink-3">{item.label}</dt>
            <dd className="tabular text-ink">{item.value === null ? '—' : `après ${formatDuration(item.value)}`}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-7 text-[13px] font-medium text-ink-3">Historique</h3>
      {detail.isPending ? (
        <Spinner />
      ) : detail.isError ? (
        <p role="alert" className="mt-2 text-sm text-late">
          {errorMessage(detail.error)}
        </p>
      ) : (
        <ol className="mt-3 border-l border-line pl-4">
          {detail.data.events.map((event) => {
            const reason = typeof event.payload?.reason === 'string' ? event.payload.reason : null;
            const actor = event.actorType === 'customer' ? 'Client' : event.actorType === 'system' ? 'Système' : (event.actorName ?? 'Personnel');
            return (
              <li key={event.id} className="relative pb-4 last:pb-0">
                <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-ink ring-4 ring-surface" aria-hidden />
                <p className="text-sm font-medium text-ink">{EVENT_LABELS[event.type] ?? event.type}</p>
                <p className="text-[13px] text-ink-2">
                  {actor} · <time dateTime={event.createdAt}>{formatDateTime(event.createdAt, timezone)}</time>
                </p>
                {reason && <p className="mt-0.5 text-[13px] text-ink-2">Motif : {reason}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </Dialog>
  );
}
