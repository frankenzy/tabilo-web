'use client';

import * as Menu from '@radix-ui/react-dropdown-menu';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronsUpDown, LogOut, MoreHorizontal, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { estKey, useEstablishmentId, useTimezone } from '@/hooks/use-establishment';
import { cn } from '@/lib/utils';
import { notificationsApi } from '@/services/api';
import { signOut } from '@/services/auth/session';
import { useStaffRealtime } from '@/services/realtime/use-staff-realtime';
import { useAuthStore, useMembership } from '@/stores/auth.store';
import { useRealtimeStore } from '@/stores/realtime.store';
import { formatDateTime } from '@/utils/time';
import { IncomingCalls } from '@/components/pages/requests/incoming-calls';
import { EstablishmentLogo } from '@/components/ui/establishment-logo';
import { AccountBanner } from './account-banner';
import { TermsGate } from './terms-gate';
import { Brand } from './brand';
import { visibleNav, type NavItem } from './navigation';

const MENU = 'z-50 rounded-xl bg-surface p-1 shadow-pop ring-1 ring-line animate-rise';
const MENU_ITEM = 'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-sunken';

export function AppShell({ children }: { children: ReactNode }) {
  const establishmentId = useEstablishmentId();
  useStaffRealtime(establishmentId);
  const pathname = usePathname();
  const membership = useMembership();
  const items = visibleNav(membership?.permissions ?? []);
  const primary = items.slice(0, 4);
  const overflow = items.slice(4);
  const isActive = (item: NavItem) => pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <div className="min-h-dvh lg:pl-60">
      <aside className="no-print fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
        <Link href="/app" className="px-2">
          <Brand />
        </Link>
        <div className="mt-5">
          <EstablishmentSwitcher />
        </div>
        <nav aria-label="Navigation principale" className="mt-4 flex flex-1 flex-col gap-0.5">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                isActive(item) ? 'bg-ink text-white' : 'text-ink-2 hover:bg-sunken hover:text-ink',
              )}
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
        <UserMenu side="top" />
      </aside>

      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line bg-paper/90 px-4 backdrop-blur lg:px-8">
        <div className="min-w-0 lg:hidden">
          <EstablishmentSwitcher compact />
        </div>
        <div className="hidden lg:block" />
        <div className="flex items-center gap-1">
          <ConnectionStatus />
          <Notifications />
          <div className="lg:hidden">
            <UserMenu side="bottom" compact />
          </div>
        </div>
      </header>

      {/* Spec 035 : échéance de l'abonnement ; spec 041 : nouvelle version des conditions. */}
      <AccountBanner />
      <TermsGate />

      <div key={pathname} className="w-full animate-page-in px-4 pt-6 pb-28 lg:px-8 lg:pb-12">
        {children}
      </div>

      {/* Spec 029, R6 : appels et messages en bas de l'écran, sur toutes les pages. */}
      {establishmentId && <IncomingCalls />}

      <nav aria-label="Navigation principale" className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {primary.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item) ? 'page' : undefined}
            className={cn('flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive(item) ? 'text-ink' : 'text-ink-3')}
          >
            <item.icon className="size-5" aria-hidden />
            {item.label}
          </Link>
        ))}
        {overflow.length > 0 && (
          <Menu.Root>
            <Menu.Trigger
              className={cn('flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium', overflow.some(isActive) ? 'text-ink' : 'text-ink-3')}
            >
              <MoreHorizontal className="size-5" aria-hidden />
              Plus
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content side="top" align="end" sideOffset={8} className={cn(MENU, 'min-w-52')}>
                {overflow.map((item) => (
                  <Menu.Item key={item.href} asChild>
                    <Link href={item.href} className={MENU_ITEM}>
                      <item.icon className="size-4 text-ink-3" aria-hidden />
                      {item.label}
                    </Link>
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        )}
      </nav>
    </div>
  );
}

function EstablishmentSwitcher({ compact }: { compact?: boolean }) {
  const me = useAuthStore((state) => state.me);
  const select = useAuthStore((state) => state.selectEstablishment);
  const membership = useMembership();
  const queryClient = useQueryClient();
  if (!me || !membership) return null;
  // Spec 031, R8 : le logo de l'établissement sélectionné, à côté de son nom.
  const label = (
    <span className="flex min-w-0 items-center gap-2.5 text-left">
      <EstablishmentLogo name={membership.establishment.name} logoImageId={membership.establishment.logoImageId ?? null} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{membership.establishment.name}</span>
        {!compact && <span className="block truncate text-xs text-ink-3">{membership.role.name}</span>}
      </span>
    </span>
  );
  if (me.memberships.length < 2) return <div className="px-2">{label}</div>;
  return (
    <Menu.Root>
      <Menu.Trigger className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-sunken" aria-label="Changer d’établissement">
        {label}
        <ChevronsUpDown className="size-4 shrink-0 text-ink-3" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="start" sideOffset={6} className={cn(MENU, 'min-w-56')}>
          {me.memberships.map((m) => (
            <Menu.Item
              key={m.establishment.id}
              className={MENU_ITEM}
              onSelect={() => {
                select(m.establishment.id);
                queryClient.clear();
              }}
            >
              {m.establishment.name}
              <span className="ml-auto text-xs text-ink-3">{m.role.name}</span>
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ConnectionStatus() {
  const status = useRealtimeStore((state) => state.status);
  const label = status === 'live' ? 'En direct' : status === 'connecting' ? 'Connexion…' : 'Hors ligne · actualisation toutes les 5 s';
  return (
    <span role="status" className="mr-1 flex items-center gap-1.5 text-xs text-ink-2" title={label}>
      <span className={cn('size-2 rounded-full', status === 'live' ? 'bg-done' : status === 'connecting' ? 'bg-wait-ink' : 'bg-late')} aria-hidden />
      <span className={cn(status === 'live' && 'hidden sm:inline')}>{status === 'offline' ? 'Hors ligne' : label}</span>
    </span>
  );
}

function Notifications() {
  const establishmentId = useEstablishmentId();
  const timezone = useTimezone();
  const queryClient = useQueryClient();
  const key = estKey(establishmentId, 'notifications');
  const { data } = useQuery({ queryKey: key, queryFn: () => notificationsApi.list(establishmentId), refetchInterval: 60_000 });
  const readAll = useMutation({
    mutationFn: () => notificationsApi.readAll(establishmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const unread = data?.unread ?? 0;

  return (
    <Menu.Root onOpenChange={(open) => !open && unread > 0 && readAll.mutate()}>
      <Menu.Trigger className="relative rounded-lg p-2 text-ink-2 hover:bg-sunken hover:text-ink" aria-label={unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'}>
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="tabular absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] leading-4 font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} className={cn(MENU, 'max-h-[70dvh] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto')}>
          <Menu.Label className="px-3 py-2 text-[13px] font-medium text-ink-3">Notifications</Menu.Label>
          {!data || data.items.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-ink-2">Aucune notification.</p>
          ) : (
            data.items.map((notification) => (
              <div key={notification.id} className="flex gap-2.5 rounded-lg px-3 py-2">
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', notification.readAt ? 'bg-transparent' : 'bg-brand')} aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{notification.title}</p>
                  <p className="truncate text-[13px] text-ink-2">{notification.body}</p>
                  <p className="text-xs text-ink-3">{formatDateTime(notification.createdAt, timezone)}</p>
                </div>
              </div>
            ))
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

function UserMenu({ side, compact }: { side: 'top' | 'bottom'; compact?: boolean }) {
  const me = useAuthStore((state) => state.me);
  const router = useRouter();
  const queryClient = useQueryClient();
  if (!me) return null;
  const initials = `${me.firstName[0] ?? ''}${me.lastName[0] ?? ''}`.toUpperCase();

  async function logout() {
    await signOut();
    queryClient.clear();
    router.replace('/');
  }

  return (
    <Menu.Root>
      <Menu.Trigger className={cn('flex items-center gap-2.5 rounded-lg text-left hover:bg-sunken', compact ? 'p-1' : 'w-full p-2')} aria-label="Mon compte">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-xs font-semibold text-ink">{initials}</span>
        {!compact && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">
              {me.firstName} {me.lastName}
            </span>
            <span className="block truncate text-xs text-ink-3">{me.email}</span>
          </span>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content side={side} align="end" sideOffset={6} className={cn(MENU, 'min-w-52')}>
          <Menu.Item asChild>
            <Link href="/app/compte" className={MENU_ITEM}>
              <UserRound className="size-4 text-ink-3" aria-hidden />
              Mon compte
            </Link>
          </Menu.Item>
          <Menu.Item className={MENU_ITEM} onSelect={() => void logout()}>
            <LogOut className="size-4 text-ink-3" aria-hidden />
            Se déconnecter
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
