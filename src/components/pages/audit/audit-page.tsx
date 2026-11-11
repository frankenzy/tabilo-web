'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import { Badge, Card, EmptyState, ErrorState, FilterSelect, PageHeader, Pagination, Spinner } from '@/components/ui';
import { AUDIT_LABELS } from '@/constants/requests';
import { estKey, useEstablishmentId, useTimezone } from '@/hooks/use-establishment';
import { auditApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { formatDateTime } from '@/utils/time';

const CATEGORIES = [
  { value: '', label: 'Toutes les actions' },
  { value: 'security.', label: 'Sécurité' },
  { value: 'staff.', label: 'Équipe' },
  { value: 'role.', label: 'Rôles' },
  { value: 'table.', label: 'Tables' },
  { value: 'area.', label: 'Zones' },
  { value: 'qr.', label: 'QR codes' },
  { value: 'sessions.', label: 'Sessions de table' },
  { value: 'request_type.', label: 'Types de demande' },
  { value: 'escalation_rule.', label: 'Escalade' },
  { value: 'establishment.', label: 'Établissement' },
];

export function AuditPage() {
  const establishmentId = useEstablishmentId();
  const timezone = useTimezone();
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: estKey(establishmentId, 'audit', action, page),
    queryFn: () => auditApi.list(establishmentId, { page, action: action || undefined }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Journal" description="Actions d’administration et événements de sécurité. Ce journal ne peut être ni modifié ni effacé." />
      <FilterSelect label="Catégorie" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
        {CATEGORIES.map((category) => (
          <option key={category.value} value={category.value}>
            {category.label}
          </option>
        ))}
      </FilterSelect>
      <div className="mt-4">
        {isPending ? (
          <Spinner />
        ) : isError ? (
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={<ScrollText className="size-6" aria-hidden />} title="Aucune entrée" description="Aucune action ne correspond à ce filtre." />
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {data.items.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
                    <span className="font-medium">{AUDIT_LABELS[entry.action] ?? entry.action}</span>
                    {entry.action.startsWith('security.') && <Badge tone="late">Sécurité</Badge>}
                    <span className="text-ink-2">{entry.actorName ?? 'Système'}</span>
                  </p>
                  <time dateTime={entry.createdAt} className="tabular text-[13px] text-ink-3">
                    {formatDateTime(entry.createdAt, timezone)}
                  </time>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
      </div>
    </>
  );
}
