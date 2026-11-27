import { initialOf } from '@/constants/branding';
import { cn } from '@/lib/utils';
import { menuImageUrl } from '@/services/api';

/** Spec 031, R5 : logo (sinon initiale sur la couleur principale) et nom de l'établissement. */
export function EstablishmentLogo({ name, logoImageId, size = 'md' }: { name: string; logoImageId: string | null; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-7 rounded-lg text-[13px]' : 'size-11 rounded-xl text-lg';
  if (logoImageId) {
    // eslint-disable-next-line @next/next/no-img-element -- image servie par l'API, déjà réduite.
    return <img src={menuImageUrl(logoImageId)} alt={name} className={cn(box, 'shrink-0 bg-surface object-cover ring-1 ring-line')} />;
  }
  return (
    <span className={cn(box, 'grid shrink-0 place-items-center bg-brand font-bold text-white')} aria-hidden>
      {initialOf(name)}
    </span>
  );
}
