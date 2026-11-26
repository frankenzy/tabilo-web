'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui';
import type { AccountState } from '@/contracts';
import { platformApi } from '@/services/api/platform';
import { errorMessage } from '@/services/http';
import { STATE_LABELS } from '@/components/pages/subscription/subscription-logic';

export const STATE_TONE: Record<AccountState, 'progress' | 'done' | 'wait' | 'late'> = { trial: 'progress', active: 'done', past_due: 'wait', suspended: 'late' };
const FILTERS: { value: AccountState | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'trial', label: 'Essai' },
  { value: 'active', label: 'Actifs' },
  { value: 'past_due', label: 'En retard' },
  { value: 'suspended', label: 'Suspendus' },
];
export const dateFr = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

/** Spec 036, P1 : les comptes clients, leur état et leur activité, d'un coup d'œil. */
export function TenantsPage() {
  const [state, setState] = useState<AccountState | 'all'>('all');
  const [q, setQ] = useState('');
  const query = useQuery({
    queryKey: ['platform', 'tenants', state, q],
    queryFn: () => platformApi.tenants({ state: state === 'all' ? undefined : state, q: q.trim() || undefined }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Comptes clients" description="Formule, état, échéance et activité de chaque restaurant." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-sunken p-1" role="tablist" aria-label="État">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={state === filter.value}
              onClick={() => setState(filter.value)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${state === filter.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink'}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label className="relative ml-auto">
          <span className="sr-only">Rechercher un compte</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Nom du compte"
            className="h-9 w-56 rounded-lg border border-line bg-surface pr-3 pl-8 text-[14px] outline-none focus:border-ink-3"
          />
        </label>
      </div>
      {query.isPending ? (
        <Spinner />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState title="Aucun compte" description="Aucun compte ne correspond à ce filtre." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[14px]">
            <thead className="text-[12px] text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-medium">Compte</th>
                <th className="px-4 py-2.5 font-medium">Formule</th>
                <th className="px-4 py-2.5 font-medium">État</th>
                <th className="px-4 py-2.5 font-medium">Échéance</th>
                <th className="px-4 py-2.5 text-right font-medium">Étab.</th>
                <th className="px-4 py-2.5 text-right font-medium">Tables</th>
                <th className="px-4 py-2.5 text-right font-medium">Commandes 30 j</th>
                <th className="px-4 py-2.5 font-medium">Dernière activité</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0 hover:bg-sunken/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/plateforme/comptes/${row.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{row.planName}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATE_TONE[row.accountState]}>{STATE_LABELS[row.accountState]}</Badge>
                  </td>
                  <td className="tabular px-4 py-2.5">{dateFr(row.paidUntil)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{row.establishments}</td>
                  <td className="tabular px-4 py-2.5 text-right">{row.tables}</td>
                  <td className="tabular px-4 py-2.5 text-right">{row.orders30d}</td>
                  <td className="px-4 py-2.5 text-ink-2">{row.lastActivity ? dateFr(row.lastActivity) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
