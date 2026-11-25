import { Circle, Diamond, Hexagon, Octagon, Pentagon, Square, Star, Triangle, type LucideIcon } from 'lucide-react';
import { markerInfo, type MarkerShape } from '@/contracts/session-markers';
import { cn } from '@/lib/utils';

const ICONS: Record<MarkerShape, LucideIcon> = {
  circle: Circle,
  square: Square,
  triangle: Triangle,
  diamond: Diamond,
  hexagon: Hexagon,
  star: Star,
  pentagon: Pentagon,
  octagon: Octagon,
};

const SIZES = {
  xs: { box: 'size-5', icon: 'size-2.5' },
  sm: { box: 'size-6', icon: 'size-3' },
  md: { box: 'size-8', icon: 'size-4' },
  lg: { box: 'size-14', icon: 'size-7' },
} as const;

/**
 * Spec 027, R2 : repère d'un client — forme blanche pleine dans une pastille ronde de couleur.
 * Le même dessin sur le téléphone du client et partout où le personnel voit ses commandes.
 */
export function SessionMarker({
  index,
  size = 'sm',
  className,
  decorative = false,
}: {
  index: number;
  size?: keyof typeof SIZES;
  className?: string;
  /** true quand le nom est déjà dit à côté (évite une double lecture). */
  decorative?: boolean;
}) {
  const info = markerInfo(index);
  const Icon = ICONS[info.shape];
  const look = SIZES[size];
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `Repère : ${info.name}`}
      title={info.name}
      className={cn('inline-grid shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]', look.box, className)}
      style={{ backgroundColor: info.color }}
    >
      <Icon className={cn(look.icon, 'fill-white text-white')} strokeWidth={1.5} aria-hidden />
    </span>
  );
}
