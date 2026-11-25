import { LocateOff, MapPinOff, MapPinned } from 'lucide-react';
import { SessionMarker } from '@/components/ui/session-marker';
import type { ServiceRequest, ZoneSignal } from '@/contracts';
import { cn } from '@/lib/utils';
import { zoneLabel } from './zone-logic';

export { formatDistance, zoneLabel } from './zone-logic';

const ZONE_STYLE: Record<Exclude<ZoneSignal['status'], 'inside'>, { className: string; Icon: typeof MapPinOff }> = {
  outside: { className: 'bg-late-soft text-late', Icon: MapPinOff },
  imprecise: { className: 'bg-wait text-wait-ink', Icon: MapPinned },
  denied: { className: 'bg-sunken text-ink-2', Icon: LocateOff },
};

/** Spec 027, R8 : pastille sur la carte d'une commande, à vérifier avant d'« Accepter ». */
export function ZoneFlag({ zone, className }: { zone: ZoneSignal | null | undefined; className?: string }) {
  const label = zoneLabel(zone);
  if (!label || !zone || zone.status === 'inside') return null;
  const { className: look, Icon } = ZONE_STYLE[zone.status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] leading-tight font-semibold whitespace-nowrap', look, className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

/** Spec 027, R2 : repère du client qui a passé la demande ; rien pour une demande saisie par le personnel. */
export function RequestMarker({ request, size = 'xs', className }: { request: Pick<ServiceRequest, 'marker'>; size?: 'xs' | 'sm' | 'md'; className?: string }) {
  if (request.marker === null || request.marker === undefined) return null;
  return <SessionMarker index={request.marker} size={size} className={className} />;
}
