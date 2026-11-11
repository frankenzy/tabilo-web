import { categoryIcon } from '@/constants/menu-icons';
import { cn } from '@/lib/utils';
import { menuImageUrl } from '@/services/api';

/** Image d'une rubrique (spec 003) : sa photo si elle existe, sinon son pictogramme. Sans `name`, elle est décorative. */
export function CategoryImage({ icon, imageId, name, className, iconClassName }: { icon: string; imageId: string | null; name: string; className?: string; iconClassName?: string }) {
  if (imageId) {
    // eslint-disable-next-line @next/next/no-img-element -- photo servie par l'API, déjà réduite
    return <img src={menuImageUrl(imageId)} alt={name} aria-hidden={name ? undefined : true} loading="lazy" className={cn('bg-sunken object-cover', className)} />;
  }
  const Icon = categoryIcon(icon);
  return (
    <span {...(name ? { role: 'img', 'aria-label': name } : { 'aria-hidden': true })} className={cn('grid place-items-center bg-sunken text-ink', className)}>
      <Icon className={cn('size-1/2', iconClassName)} strokeWidth={1.75} aria-hidden />
    </span>
  );
}
