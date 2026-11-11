import { cn } from '@/lib/utils';

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink', className)}>
      <span className="relative grid size-7 place-items-center rounded-lg bg-ink text-[13px] font-bold text-white" aria-hidden>
        T<span className="absolute right-1 bottom-1 size-1.5 rounded-full bg-brand" />
      </span>
      TABILO
    </span>
  );
}
