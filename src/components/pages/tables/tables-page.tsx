"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ChevronDown,
  Layers,
  Plus,
  Printer,
  Search,
  Utensils,
} from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
} from "@/components/ui";
import {
  FloorDialogs,
  type FloorDialog,
} from "@/components/pages/floor/floor-dialogs";
import {
  RequestCard,
  type Viewer,
} from "@/components/pages/requests/request-card";
import {
  RequestDialogs,
  type RequestDialog,
} from "@/components/pages/requests/request-dialogs";
import { TableRequestsDialog } from "@/components/pages/requests/table-requests-dialog";
import { PrecisionFlags, precisionLabel } from "@/components/pages/requests/precisions";
import {
  useActiveRequests,
  useFloor,
  useRequestAction,
} from "@/components/pages/requests/use-requests";
import type { ServiceRequest, TableStatusView } from "@/contracts";
import {
  estKey,
  useEstablishmentId,
  useLiveRefetchInterval,
} from "@/hooks/use-establishment";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";
import { floorApi } from "@/services/api";
import { errorMessage } from "@/services/http";
import { useAuthStore, useCan, useMembership } from "@/stores/auth.store";
import { formatMoney } from "@/utils/money";
import { formatClock, secondsSince } from "@/utils/time";
import {
  areasOf,
  filterTables,
  tableCounts,
  CARD_BADGE,
  CARD_PLATE,
  isServed,
  tableLook,
  TONE_CARD,
  tableSize,
  TONE_LEGEND,
  type TableFilters,
} from "./tables-logic";

/**
 * Spec 006, R7 : les demandes viennent de la même requête que le tableau de bord (temps réel + repli HTTP).
 * L'occupation n'a pas d'événement temps réel : on la relit au moins toutes les 10 secondes,
 * et aussitôt qu'une demande change (voir use-staff-realtime).
 */
const OCCUPANCY_REFRESH_MS = 10_000;

export function TablesPage() {
  const establishmentId = useEstablishmentId();
  const liveInterval = useLiveRefetchInterval();
  const now = useNow();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: estKey(establishmentId, "tables-overview"),
    queryFn: () => floorApi.tablesOverview(establishmentId),
    refetchInterval: Math.min(liveInterval, OCCUPANCY_REFRESH_MS),
  });
  const active = useActiveRequests();
  const byTable = useMemo(() => {
    const map = new Map<string, ServiceRequest[]>();
    (active.data?.items ?? []).forEach((r) =>
      map.set(r.table.id, [...(map.get(r.table.id) ?? []), r]),
    );
    return map;
  }, [active.data]);
  const me = useAuthStore((state) => state.me);
  const membership = useMembership();
  const viewer: Viewer = useMemo(
    () => ({
      id: me?.id ?? "",
      can: (permission) =>
        membership?.permissions.includes(permission) ?? false,
    }),
    [me, membership],
  );
  const action = useRequestAction();
  const [dialog, setDialog] = useState<RequestDialog>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  // Spec 006, R12 : la configuration de la salle (ancienne page « Salle ») se fait ici.
  const [floorDialog, setFloorDialog] = useState<FloorDialog>(null);
  const floor = useFloor();
  const floorAreas = floor.data ?? [];
  const canManage = useCan("floor.manage");
  const canQr = useCan("qr.manage");
  const [filters, setFilters] = useState<TableFilters>({
    query: "",
    status: "all",
    areaId: "all",
  });
  const tables = useMemo(() => data?.tables ?? [], [data]);
  const visible = useMemo(
    () => filterTables(tables, filters),
    [tables, filters],
  );
  const areas = useMemo(() => areasOf(tables), [tables]);
  const counts = tableCounts(tables);
  const selected = tables.find((table) => table.id === tableId) ?? null;
  /** Ferme la fenêtre de la table et ouvre la fenêtre de configuration demandée. */
  const openFloor = (next: FloorDialog) => {
    setTableId(null);
    setFloorDialog(next);
  };

  return (
    <>
      <PageHeader
        title="Tables"
        description="État de chaque table en temps réel : occupation, taille et montant commandé."
        actions={
          <>
            {canManage && (
              <Button
                variant="secondary"
                onClick={() => setFloorDialog({ kind: "zones" })}
              >
                <Layers className="size-4" aria-hidden />
                Zones
              </Button>
            )}
            {canQr && tables.length > 0 && (
              <Link
                href="/app/tables/qr"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-surface px-4 text-sm font-medium text-ink ring-1 ring-line ring-inset hover:bg-sunken"
              >
                <Printer className="size-4" aria-hidden />
                Imprimer les QR codes
              </Link>
            )}
            {canManage && (
              <Button
                onClick={() => setFloorDialog({ kind: "table" })}
                disabled={floorAreas.length === 0}
                title={
                  floorAreas.length === 0 ? "Créez d’abord une zone" : undefined
                }
              >
                <Plus className="size-4" aria-hidden />
                Nouvelle table
              </Button>
            )}
          </>
        }
      />

      {isPending ? (
        <Spinner />
      ) : isError ? (
        <ErrorState
          message={errorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <section
            aria-label="Compteurs"
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            <div className="flex flex-col justify-between gap-4 rounded-(--radius-card) bg-gradient-to-br from-brand to-brand-strong p-4 text-white shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[15px] font-medium sm:text-[17px]">
                  Commandes du jour
                </p>
                <TableIcon className="size-7 shrink-0 opacity-90 sm:size-8" />
              </div>
              <p
                className="tabular text-3xl font-semibold"
                data-testid="orders-today"
              >
                {data.ordersToday}
              </p>
            </div>
            <Counter
              label="Occupées"
              value={counts.occupied}
              className="text-brand"
            />
            <Counter label="Libres" value={counts.free} className="text-done" />
            <Counter
              label="Total tables"
              value={counts.total}
              className="text-ink"
            />
          </section>

          <section
            aria-label="Recherche et filtres"
            className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem]"
          >
            <label className="relative col-span-2 md:col-span-1">
              <span className="sr-only">Rechercher une table</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
                aria-hidden
              />
              <input
                type="search"
                value={filters.query}
                onChange={(event) =>
                  setFilters((f) => ({ ...f, query: event.target.value }))
                }
                placeholder="Rechercher une table…"
                className="h-11 w-full rounded-(--radius-card) bg-surface pr-3 pl-9 text-sm text-ink ring-1 ring-line outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-brand"
              />
            </label>
            <FilterSelect
              label="État"
              value={filters.status}
              onChange={(status) =>
                setFilters((f) => ({
                  ...f,
                  status: status as TableFilters["status"],
                }))
              }
            >
              <option value="all">Tous les états</option>
              <option value="occupied">Occupées</option>
              <option value="free">Libres</option>
            </FilterSelect>
            <FilterSelect
              label="Zone"
              value={filters.areaId}
              onChange={(areaId) => setFilters((f) => ({ ...f, areaId }))}
            >
              <option value="all">Toutes les zones</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </FilterSelect>
          </section>

          {tables.length === 0 ? (
            <EmptyState
              icon={<Utensils className="size-6" aria-hidden />}
              title={
                floorAreas.length === 0
                  ? "Commencez par créer une zone"
                  : "Aucune table"
              }
              description={
                floorAreas.length === 0
                  ? "Une zone regroupe des tables : salle, terrasse, étage… Chaque table reçoit ensuite son QR code."
                  : "Ajoutez vos tables : chacune reçoit son QR code à poser dessus."
              }
              action={
                canManage &&
                (floorAreas.length === 0 ? (
                  <Button onClick={() => setFloorDialog({ kind: "area" })}>
                    Créer une zone
                  </Button>
                ) : (
                  <Button onClick={() => setFloorDialog({ kind: "table" })}>
                    Créer une table
                  </Button>
                ))
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Search className="size-6" aria-hidden />}
              title="Aucune table trouvée"
            />
          ) : (
            <>
              <Legend />
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {visible.map((table, index) => (
                  <TableCard
                    index={index}
                    key={table.id}
                    table={table}
                    requests={byTable.get(table.id) ?? []}
                    now={now}
                    currency={data.currency}
                    onOpen={() => setTableId(table.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {selected && data && (
        <TableRequestsDialog
          table={selected}
          areaName={selected.areaName}
          status={selected.status}
          requests={byTable.get(selected.id) ?? []}
          canClose={viewer.can("sessions.manage")}
          canSettle={viewer.can("requests.handle")}
          onClose={() => setTableId(null)}
          onQr={canQr ? () => openFloor({ kind: "qr", table: selected }) : undefined}
          onEdit={canManage ? () => openFloor({ kind: "table", table: selected }) : undefined}
          onDelete={canManage ? () => openFloor({ kind: "archive-table", table: selected }) : undefined}
        >
          {(request) => (
            <RequestCard
              request={request}
              now={now}
              viewer={viewer}
              busy={action.isPending && action.variables?.id === request.id}
              onAction={(name) =>
                action.mutate({ id: request.id, action: name })
              }
              onDialog={setDialog}
            />
          )}
        </TableRequestsDialog>
      )}
      <RequestDialogs dialog={dialog} onClose={() => setDialog(null)} />
      <FloorDialogs
        dialog={floorDialog}
        areas={floorAreas}
        onChange={setFloorDialog}
        onClose={() => setFloorDialog(null)}
      />
    </>
  );
}

function Counter({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-(--radius-card) bg-surface p-4 ring-1 ring-line sm:p-5">
      <p className="text-[15px] font-medium text-ink sm:text-[17px]">{label}</p>
      <p
        className={cn(
          "tabular overflow-hidden text-3xl font-semibold",
          className,
        )}
      >
        <span key={value} className="inline-block animate-number-in">
          {value}
        </span>
      </p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none truncate rounded-(--radius-card) bg-surface pr-9 pl-3 text-sm font-medium text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand"
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-2"
        aria-hidden
      />
    </label>
  );
}

function Legend() {
  return (
    <ul
      className="-mb-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2"
      aria-label="Légende"
    >
      {TONE_LEGEND.map((item) => (
        <li key={item.tone} className="flex items-center gap-1.5">
          <span
            className={cn("size-2.5 rounded-sm", item.swatch)}
            aria-hidden
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function TableCard({
  index,
  table,
  requests,
  now,
  currency,
  onOpen,
}: {
  index: number;
  table: TableStatusView;
  requests: ServiceRequest[];
  now: number;
  currency: string;
  onOpen: () => void;
}) {
  const look = tableLook(table.status, requests, now, isServed(table, requests.length));
  return (
    <li
      className="stagger animate-item-in"
      style={{ "--i": Math.min(index, 12) } as CSSProperties}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex h-full w-full flex-col justify-between gap-6 rounded-(--radius-card) p-4 text-left transition-[transform,box-shadow,background-color] duration-300 ease-apple hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98]",
          // Spec 023, R1 : toute la carte prend la couleur de l'état.
          TONE_CARD[look.tone],
          look.escalated && "animate-attention",
        )}
        data-testid={`table-${table.label}`}
        data-tone={look.tone}
        aria-label={`Table ${table.label}, ${look.label.toLowerCase()}${requests.length ? `, ${requests.length} demande${requests.length > 1 ? "s" : ""} en cours` : ""}${precisionLabel(requests.map((request) => request.note).filter(Boolean).join(" · ") || null)}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="flex items-center gap-2">
            <TableDrawing label={table.label} plate={CARD_PLATE[look.tone]} />
            {/* Spec 022, R5 : une demande en cours porte une précision (à emporter, piment). */}
            <PrecisionFlags notes={requests.map((request) => request.note)} />
          </span>
          <span
            className={cn(
              "flex shrink-0 flex-col items-end rounded-2xl px-3 py-1 text-[13px] font-semibold",
              CARD_BADGE[look.tone],
            )}
          >
            {look.label}
            {look.oldestCreatedAt && (
              <span className="tabular font-mono text-[11px] opacity-80">
                {formatClock(secondsSince(look.oldestCreatedAt, now))}
              </span>
            )}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="opacity-75">{tableSize(table.seats)}</span>
          <span className="opacity-75">
            {table.seats} couvert{table.seats > 1 ? "s" : ""}
          </span>
          {/* Spec 023, R4 : le montant prend la couleur du texte de la carte (lisible sur tous les fonds). */}
          <span
            className={cn(
              "tabular font-semibold",
              table.amountMinor === null && "opacity-50",
            )}
            data-testid="table-amount"
          >
            {table.amountMinor === null
              ? "—"
              : formatMoney(table.amountMinor, currency)}
          </span>
        </div>
      </button>
    </li>
  );
}

/** Dessin de la table vue de dessus : plateau avec son nom, une chaise par couvert (spec 006, R3). */
function TableDrawing({ label, plate }: { label: string; plate: string }) {
  return (
    <div
      className={cn(
        "flex h-10 min-w-10 items-center justify-center rounded-md px-2 font-mono text-sm font-semibold",
        plate,
      )}
      aria-hidden
    >
      <span className="max-w-24 truncate">{label}</span>
    </div>
  );
}

/** Pictogramme « table ronde sur pied » du bloc Commandes du jour, comme sur la maquette. */
function TableIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <ellipse cx="16" cy="9" rx="12" ry="4" />
      <path d="M16 13v12M11 27h10" />
    </svg>
  );
}
