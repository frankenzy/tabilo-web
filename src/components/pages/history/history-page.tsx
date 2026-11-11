'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { RequestDialogs, type RequestDialog } from '@/components/pages/requests/request-dialogs';
import { useFloor, useRequestTypes, useStaff } from '@/components/pages/requests/use-requests';
import { Badge, Card, EmptyState, ErrorState, FilterSelect, PageHeader, Pagination, Spinner } from '@/components/ui';
import { STATUS_LABELS, STATUS_TONE } from '@/constants/requests';
import { REQUEST_STATUSES } from '@/contracts';
import { estKey, useEstablishmentId, useTimezone } from '@/hooks/use-establishment';
import { requestsApi, type RequestFilters } from '@/services/api';
import { errorMessage } from '@/services/http';
import { useCan } from '@/stores/auth.store';
import { formatDateTime, formatDuration } from '@/utils/time';

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
          <Card className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[13px] text-ink-3">
                  <tr className="border-b border-line">
                    {['Table', 'Demande', 'Créée', 'Statut', 'Responsable', 'Prise en charge', 'Résolution'].map((heading) => (
                      <th key={heading} scope="col" className="px-4 py-2.5 font-medium whitespace-nowrap">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((request) => {
                    const delta = (iso: string | null) =>
                      iso ? formatDuration((new Date(iso).getTime() - new Date(request.createdAt).getTime()) / 1000) : '—';
                    const lateAccept = request.acceptedAt ? request.acceptedAt > request.dueAt : false;
                    return (
                      <tr key={request.id} className="cursor-pointer hover:bg-paper" onClick={() => setDialog({ kind: 'detail', request })}>
                        <td className="tabular px-4 py-3 font-mono font-semibold text-ink">{request.table.label}</td>
                        <td className="px-4 py-3">
                          <button type="button" className="text-left font-medium text-ink underline-offset-4 hover:underline" onClick={(e) => { e.stopPropagation(); setDialog({ kind: 'detail', request }); }}>
                            {request.type.label}
                          </button>
                          <span className="block text-[13px] text-ink-3">{request.area.name}</span>
                        </td>
                        <td className="tabular px-4 py-3 whitespace-nowrap text-ink-2">{formatDateTime(request.createdAt, timezone)}</td>
                        <td className="px-4 py-3">
                          <span className="flex flex-wrap gap-1">
                            <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABELS[request.status]}</Badge>
                            {request.escalatedAt && <Badge tone="late">Escaladée</Badge>}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-ink-2">
                          {request.assignee ? `${request.assignee.firstName} ${request.assignee.lastName}` : '—'}
                        </td>
                        <td className={`tabular px-4 py-3 whitespace-nowrap ${lateAccept ? 'font-medium text-late' : 'text-ink-2'}`}>{delta(request.acceptedAt)}</td>
                        <td className="tabular px-4 py-3 whitespace-nowrap text-ink-2">{delta(request.resolvedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(page) => set({ page })} />}
      </div>

      <RequestDialogs dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
