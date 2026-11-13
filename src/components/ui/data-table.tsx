'use client';

import { ChevronRight } from 'lucide-react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Tableaux de l'espace pro, façon Apple :
 * - en-tête sur fond doux, libellés courts en petites capitales, collé en haut au défilement ;
 * - colonnes bien distinctes (séparateurs fins), une ligne sur deux légèrement teintée ;
 * - chiffres alignés à droite en chiffres tabulaires ;
 * - lignes cliquables : survol, focus clavier (Entrée), chevron qui glisse, ouverture d'une fenêtre ;
 * - apparition des lignes en cascade.
 */

type Align = 'left' | 'right' | 'center';
const ALIGN: Record<Align, string> = { left: 'text-left', right: 'text-right', center: 'text-center' };

export function DataTable({ children, minWidth = 640, label, className }: { children: ReactNode; minWidth?: number; label: string; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-(--radius-card) bg-surface ring-1 ring-line', className)}>
      <div className="max-h-[70vh] overflow-auto">
        <table aria-label={label} className="w-full border-separate border-spacing-0 text-sm" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10">
      <tr className="bg-sunken/85 backdrop-blur">{children}</tr>
    </thead>
  );
}

export function Th({ children, align = 'left', className }: { children?: ReactNode; align?: Align; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-line px-4 py-2.5 text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-ink-3 uppercase',
        '[&:not(:first-child)]:border-l [&:not(:first-child)]:border-l-line/70',
        ALIGN[align],
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="[&>tr:nth-child(even)>*]:bg-paper/60 [&>tr:last-child>*]:border-b-0">{children}</tbody>;
}

/** Ligne de tableau ; cliquable si `onOpen` est fourni (souris, Entrée ou Espace). */
export function TRow({ children, onOpen, index = 0, label }: { children: ReactNode; onOpen?: () => void; index?: number; label?: string }) {
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (onOpen && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onOpen();
    }
  };
  return (
    <tr
      onClick={onOpen}
      onKeyDown={onKeyDown}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={label}
      className={cn(
        'group stagger animate-item-in outline-none',
        onOpen &&
          'cursor-pointer [&>*]:transition-colors [&>*]:duration-200 [&>*]:ease-apple hover:[&>*]:bg-sunken/70 focus-visible:[&>*]:bg-sunken/70 active:[&>*]:bg-line/60',
      )}
      style={{ '--i': Math.min(index, 15) } as CSSProperties}
    >
      {children}
    </tr>
  );
}

export function Td({
  children, align = 'left', numeric = false, className, header = false,
}: { children?: ReactNode; align?: Align; numeric?: boolean; className?: string; header?: boolean }) {
  const Cell = header ? 'th' : 'td';
  return (
    <Cell
      scope={header ? 'row' : undefined}
      className={cn(
        'border-b border-line/70 px-4 py-3 align-middle font-normal',
        '[&:not(:first-child)]:border-l [&:not(:first-child)]:border-l-line/50',
        numeric && 'tabular whitespace-nowrap',
        ALIGN[align],
        className,
      )}
    >
      {children}
    </Cell>
  );
}

/** Dernière colonne d'une ligne cliquable : chevron qui glisse au survol. */
export function ChevronCell() {
  return (
    <td className="w-10 border-b border-line/70 pr-3 pl-0 text-right align-middle">
      <ChevronRight className="ml-auto size-4 text-ink-3 transition-transform duration-300 ease-apple group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
    </td>
  );
}

/** Pastille d'initiales, pour une personne. */
export function Avatar({ firstName, lastName, className }: { firstName: string; lastName: string; className?: string }) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  return (
    <span
      aria-hidden
      className={cn('grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sunken to-line text-[12px] font-semibold text-ink-2', className)}
    >
      {initials}
    </span>
  );
}

/** Deux lignes dans une cellule : l'information principale, puis le détail en plus discret. */
export function CellStack({ primary, secondary, className }: { primary: ReactNode; secondary?: ReactNode; className?: string }) {
  return (
    <span className={cn('flex min-w-0 flex-col', className)}>
      <span className="truncate font-medium text-ink">{primary}</span>
      {secondary && <span className="truncate text-[13px] text-ink-3">{secondary}</span>}
    </span>
  );
}
