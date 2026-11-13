'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import {
  forwardRef, useId, useLayoutEffect, useRef, useState,
  type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/toast.store';

// ------------------------------------------------------------------ Button

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-white hover:bg-black disabled:bg-ink-3',
  secondary: 'bg-surface text-ink ring-1 ring-inset ring-line hover:bg-sunken disabled:text-ink-3',
  ghost: 'text-ink-2 hover:bg-sunken hover:text-ink disabled:text-ink-3',
  danger: 'bg-late text-white hover:bg-[#b42318] disabled:opacity-60',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-[15px] gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-[color,background-color,box-shadow,transform] duration-200 ease-apple select-none enabled:active:scale-[0.97]',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

// ------------------------------------------------------------------- Fields

const CONTROL =
  'w-full rounded-lg bg-surface px-3 text-sm text-ink ring-1 ring-inset ring-line placeholder:text-ink-3 ' +
  'focus:outline-none focus:ring-2 focus:ring-ink disabled:bg-sunken disabled:text-ink-3 aria-[invalid=true]:ring-late';

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  children: (ids: { id: string; describedBy?: string }) => ReactNode;
}

function FieldShell({ label, error, hint, children }: FieldShellProps) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children({ id, describedBy: error || hint ? messageId : undefined })}
      {error ? (
        <p id={messageId} role="alert" className="text-[13px] text-late">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-[13px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(function Input(
  { label, error, hint, className, ...props },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ id, describedBy }) => (
        <input ref={ref} id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={cn(CONTROL, 'h-10', className)} {...props} />
      )}
    </FieldShell>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  function Textarea({ label, error, hint, className, ...props }, ref) {
    return (
      <FieldShell label={label} error={error} hint={hint}>
        {({ id, describedBy }) => (
          <textarea ref={ref} id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={cn(CONTROL, 'min-h-20 py-2', className)} {...props} />
        )}
      </FieldShell>
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(function Select(
  { label, error, hint, className, children, ...props },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ id, describedBy }) => (
        <select ref={ref} id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={cn(CONTROL, 'h-10 pr-8', className)} {...props}>
          {children}
        </select>
      )}
    </FieldShell>
  );
});

/** Sélecteur compact pour les barres de filtres : libellé accessible, non affiché. */
export function FilterSelect({ label, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <select aria-label={label} className={cn(CONTROL, 'h-9 w-auto pr-8 text-[13px]', className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, hint, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-ink" {...props} />
      <label htmlFor={id} className="text-sm text-ink">
        {label}
        {hint && <span className="block text-[13px] text-ink-3">{hint}</span>}
      </label>
    </div>
  );
}

// -------------------------------------------------------------------- Badge

type BadgeTone = 'neutral' | 'wait' | 'late' | 'progress' | 'done' | 'muted' | 'brand';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-sunken text-ink-2',
  wait: 'bg-wait text-wait-ink',
  late: 'bg-late-soft text-late',
  progress: 'bg-progress-soft text-progress',
  done: 'bg-done-soft text-done',
  muted: 'bg-sunken text-ink-3',
  brand: 'bg-brand-soft text-brand-strong',
};

/** Interrupteur façon iOS : la pastille glisse avec un léger rebond. */
export function Switch({
  checked, onChange, disabled, label,
}: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full transition-colors duration-300 ease-apple disabled:cursor-not-allowed disabled:opacity-45',
        checked ? 'bg-done' : 'bg-line',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-[3px] size-5 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2)] transition-transform duration-[380ms] ease-spring',
          checked && 'translate-x-[18px]',
        )}
      />
    </button>
  );
}

export function Badge({ tone = 'neutral', className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', BADGE_TONES[tone], className)}>
      {children}
    </span>
  );
}

// ------------------------------------------------------------------- Dialog

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** `sheet` : panneau latéral (détail) ; `modal` : boîte centrée, plein bas d'écran sur mobile. */
  variant?: 'modal' | 'sheet';
}

export function Dialog({ open, onOpenChange, title, description, children, variant = 'modal' }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            'fixed z-50 flex flex-col bg-surface shadow-pop focus:outline-none',
            variant === 'modal'
              ? 'inset-x-0 bottom-0 max-h-[92dvh] animate-sheet-up rounded-t-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:animate-pop-in sm:rounded-2xl'
              : 'inset-y-0 right-0 w-full max-w-lg animate-slide-in-right',
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold text-ink">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm text-ink-2">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="-mt-1 -mr-1 rounded-lg p-2 text-ink-3 hover:bg-sunken hover:text-ink" aria-label="Fermer">
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <div className="overflow-y-auto px-5 pb-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>;
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  danger?: boolean;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, loading, danger }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <DialogActions>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Annuler
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ------------------------------------------------------------------- States

/** Indicateur d'activité façon iOS : 8 rayons qui s'estompent tour à tour. */
export function ActivityIndicator({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-5 text-ink-3', className)} aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <rect
          key={i}
          x="11"
          y="2"
          width="2"
          height="6"
          rx="1"
          fill="currentColor"
          transform={`rotate(${i * 45} 12 12)`}
          style={{ animation: `spoke 0.8s linear ${(i - 8) * 0.1}s infinite` }}
        />
      ))}
    </svg>
  );
}

export function Spinner({ label = 'Chargement…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn('delayed-show flex flex-col items-center justify-center gap-2 py-10 text-[13px] text-ink-3', className)}>
      <ActivityIndicator className="size-6" />
      {label}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-(--radius-card) border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-1 text-ink-3">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-(--radius-card) bg-late-soft px-6 py-10 text-center">
      <AlertTriangle className="size-5 text-late" aria-hidden />
      <p className="text-sm text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-late-soft px-3 py-2 text-sm text-late">
      {message}
    </p>
  );
}

// -------------------------------------------------------------- Page layout

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ className, children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <section className={cn('rounded-(--radius-card) bg-surface ring-1 ring-line', className)} style={style}>
      {children}
    </section>
  );
}

interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: string; count?: number }[];
  label: string;
}

/**
 * Fond d'un contrôle segmenté qui glisse jusqu'au segment actif (mouvement façon iOS).
 * Le conteneur doit être `relative` ; chaque segment est enregistré avec `register(valeur)`.
 */
export function useSlidingIndicator<T extends string | number>(value: T) {
  const container = useRef<HTMLDivElement>(null);
  const items = useRef(new Map<T, HTMLElement>());
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const element = items.current.get(value);
      if (element) setBox({ left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [value]);
  const register = (key: T) => (element: HTMLElement | null) => {
    if (element) items.current.set(key, element);
    else items.current.delete(key);
  };
  const indicator = box && (
    <span
      aria-hidden
      className="pointer-events-none absolute rounded-lg bg-surface shadow-sm transition-[left,top,width,height] duration-[380ms] ease-apple"
      style={box}
    />
  );
  return { container, register, indicator };
}

export function Tabs<T extends string>({ value, onChange, tabs, label }: TabsProps<T>) {
  const { container, register, indicator } = useSlidingIndicator(value);
  return (
    <div ref={container} role="tablist" aria-label={label} className="relative flex gap-1 overflow-x-auto rounded-xl bg-sunken p-1">
      {indicator}
      {tabs.map((tab) => (
        <button
          key={tab.value}
          ref={register(tab.value)}
          role="tab"
          type="button"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-300',
            value === tab.value ? 'text-ink' : 'text-ink-2 hover:text-ink',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn('tabular rounded-full px-1.5 text-xs', value === tab.value ? 'bg-ink text-white' : 'bg-line text-ink-2')}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-ink-2">
      <span className="tabular">
        Page {page} sur {pages} · {total} résultats
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Précédent
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Suivant
        </Button>
      </div>
    </nav>
  );
}

// ------------------------------------------------------------------- Toasts

const TOAST_ICONS = {
  success: <CheckCircle2 className="size-4 text-done" aria-hidden />,
  error: <AlertTriangle className="size-4 text-late" aria-hidden />,
  alert: <AlertTriangle className="size-4 text-late" aria-hidden />,
  info: <Info className="size-4 text-progress" aria-hidden />,
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div aria-live="polite" className="no-print pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === 'error' || toast.tone === 'alert' ? 'alert' : 'status'}
          className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-surface/95 p-3 shadow-pop ring-1 ring-line backdrop-blur animate-toast-in"
        >
          <span className="mt-0.5">{TOAST_ICONS[toast.tone]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{toast.title}</p>
            {toast.description && <p className="text-[13px] text-ink-2">{toast.description}</p>}
          </div>
          <button type="button" onClick={() => dismiss(toast.id)} className="rounded p-1 text-ink-3 hover:text-ink" aria-label="Fermer la notification">
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
