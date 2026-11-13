'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { RequestDialogs, type RequestDialog } from '@/components/pages/requests/request-dialogs';
import { useFloor, useRequestTypes, useStaff } from '@/components/pages/requests/use-requests';
import { Badge, EmptyState, ErrorState, FilterSelect, PageHeader, Pagination, Spinner } from '@/components/ui';
import { Avatar, CellStack, ChevronCell, DataTable, TBody, Td, Th, THead, TRow } from '@/components/ui/data-table';
import { requestIcon, STATUS_LABELS, STATUS_TONE } from '@/constants/requests';
import { cn } from '@/lib/utils';
import { REQUEST_STATUSES } from '@/contracts';
import { estKey, useEstablishmentId, useTimezone } from '@/hooks/use-establishment';
import { requestsApi, type RequestFilters } from '@/services/api';
import { errorMessage } from '@/services/http';
import { useCan } from '@/stores/auth.store';
import { formatDuration } from '@/utils/time';

/** « 14:32 » : l'heure, information principale de la colonne « Créée ». */
function formatTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso));
}

/** « jeu. 13 nov. » : le jour, en dessous, plus discret. */
function formatDay(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone }).format(new Date(iso));
}

const PERIODS = [
  { value: 'today', label: 'Aujourd’hui', days: 0 },
  { value: '7d', label: '7 derniers jours', days: 7 },
  { value: '30d', label: '30 derniers jours', days: 30 },
  { value: 'all', label: 'Toute la période', days: null },
] as const;

function periodStart(value: string): string | undefined {
  const period = PERIODS.find((p) => p.value === value);
  if (!period || period.days === null) return undefined;
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - period.days);
  return date.toISOString();
}

export function HistoryPage() {
  const establishmentId = useEstablishmentId();
  const timezone = useTimezone();
  const canSeeStaff = useCan('staff.read');
  const floor = useFloor();
  const types = useRequestTypes();
  const staff = useStaff(canSeeStaff);
  const [period, setPeriod] = useState('today');
  const [filters, setFilters] = useState<RequestFilters>({ scope: 'all', page: 1, pageSize: 25 });
  const [dialog, setDialog] = useState<RequestDialog>(null);

  const query = { ...filters, from: periodStart(period) };
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: estKey(establishmentId, 'requests', 'history', query),
    queryFn: () => requestsApi.list(establishmentId, query),
    placeholderData: keepPreviousData,
  });
  const set = (patch: RequestFilters) => setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));

  return (
    <>
      <PageHeader title="Historique" description="Toutes les demandes, avec leurs délais et leur déroulé." />

      <div className="flex flex-wrap gap-2">
        <FilterSelect label="Période" value={period} onChange={(e) => { setPeriod(e.target.value); set({}); }}>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Statut" value={filters.status ?? ''} onChange={(e) => set({ status: e.target.value || undefined })}>
          <option value="">Tous les statuts</option>
          {REQUEST_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Zone" value={filters.areaId ?? ''} onChange={(e) => set({ areaId: e.target.value || undefined })}>
          <option value="">Toutes les zones</option>
          {(floor.data ?? []).map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Type de demande" value={filters.requestTypeId ?? ''} onChange={(e) => set({ requestTypeId: e.target.value || undefined })}>
          <option value="">Tous les types</option>
          {(types.data ?? []).map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </FilterSelect>
        {canSeeStaff && (
          <FilterSelect label="Membre" value={filters.assigneeId ?? ''} onChange={(e) => set({ assigneeId: e.target.value || undefined })}>
            <option value="">Toute l’équipe</option>
            {(staff.data ?? []).map((member) => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.lastName}
              </option>
            ))}
          </FilterSelect>
        )}
        <FilterSelect
          label="Alerte"
          value={filters.escalated ? 'escalated' : ''}
          onChange={(e) => set({ escalated: e.target.value === 'escalated' || undefined })}
        >
          <option value="">Avec ou sans escalade</option>
          <option value="escalated">Escaladées</option>
        </FilterSelect>
      </div>

      <div className="mt-4">
        {isPending ? (
          <Spinner />
        ) : isError ? (
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={<Inbox className="size-6" aria-hidden />} title="Aucune demande" description="Aucune demande ne correspond à ces filtres." />
        ) : (
          <div className={cn('transition-opacity duration-300 ease-apple', isFetching && 'opacity-60')}>
            <DataTable label="Historique des demandes" minWidth={860}>
              <THead>
                <Th className="w-20">Table</Th>
                <Th>Demande</Th>
                <Th>Créée</Th>
                <Th>Statut</Th>
                <Th>Responsable</Th>
                <Th align="right">Prise en charge</Th>
                <Th align="right">Résolution</Th>
                <th className="w-10 border-b border-line bg-sunken/85" aria-hidden />
              </THead>
              <TBody>
                {data.items.map((request, index) => {
                  const delta = (iso: string | null) =>
                    iso ? formatDuration((new Date(iso).getTime() - new Date(request.createdAt).getTime()) / 1000) : '—';
                  const lateAccept = request.acceptedAt ? request.acceptedAt > request.dueAt : false;
                  const Icon = requestIcon(request.type.icon);
                  const open = () => setDialog({ kind: 'detail', request });
                  return (
                    <TRow key={request.id} index={index} onOpen={open} label={`Table ${request.table.label}, ${request.type.label}, ${STATUS_LABELS[request.status]}${request.assignee ? `, ${request.assignee.firstName} ${request.assignee.lastName}` : ''}, créée à ${formatTime(request.createdAt, timezone)}`}>
                      <Td>
                        <span className="tabular grid h-9 min-w-9 place-items-center rounded-lg bg-sunken px-2 font-mono text-[15px] font-semibold text-ink">
                          {request.table.label}
                        </span>
                      </Td>
                      <Td>
                        <span className="flex items-center gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-strong">
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <CellStack
                            primary={
                              <>
                                {request.type.label}
                                {request.quantity !== null && <span className="tabular text-ink-2"> × {request.quantity}</span>}
                              </>
                            }
                            secondary={request.area.name}
                          />
                        </span>
                      </Td>
                      <Td>
                        <CellStack primary={<span className="tabular">{formatTime(request.createdAt, timezone)}</span>} secondary={formatDay(request.createdAt, timezone)} />
                      </Td>
                      <Td>
                        <span className="flex flex-wrap gap-1">
                          <Badge tone={STATUS_TONE[request.status]}>
                            <span className="size-1.5 rounded-full bg-current" aria-hidden />
                            {STATUS_LABELS[request.status]}
                          </Badge>
                          {request.escalatedAt && <Badge tone="late">Escaladée</Badge>}
                        </span>
                      </Td>
                      <Td>
                        {request.assignee ? (
                          <span className="flex items-center gap-2">
                            <Avatar firstName={request.assignee.firstName} lastName={request.assignee.lastName} className="size-7 text-[11px]" />
                            <span className="truncate text-ink">
                              {request.assignee.firstName} {request.assignee.lastName}
                            </span>
                          </span>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </Td>
                      <Td align="right" numeric className={lateAccept ? 'font-semibold text-late' : 'text-ink'}>
                        {delta(request.acceptedAt)}
                      </Td>
                      <Td align="right" numeric className="text-ink-2">
                        {delta(request.resolvedAt)}
                      </Td>
                      <ChevronCell />
                    </TRow>
                  );
                })}
              </TBody>
            </DataTable>
          </div>
        )}
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(page) => set({ page })} />}
      </div>

      <RequestDialogs dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
