'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Brand } from '@/components/layouts/brand';
import { Button, FormError, Input, Spinner } from '@/components/ui';
import { platformApi } from '@/services/api/platform';
import { errorMessage, toHttpError } from '@/services/http';

export const PLATFORM_ME = ['platform', 'me'] as const;

/**
 * Spec 036 : la console de la plateforme. Sans session valide, l'API répond 404 (R2) : on affiche la connexion.
 * La session vit dans un cookie HttpOnly ; aucun jeton n'est gardé par le navigateur.
 */
export function PlatformShell({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: PLATFORM_ME, queryFn: platformApi.me, retry: false });
  const logout = useMutation({
    mutationFn: platformApi.logout,
    onSettled: () => queryClient.clear(),
  });

  if (me.isPending) return <Spinner />;
  if (me.isError) {
    const status = toHttpError(me.error).status;
    return status === 404 || status === 401 ? <PlatformLogin /> : <p className="p-6 text-sm text-late">{errorMessage(me.error)}</p>;
  }
  return (
    <div className="min-h-dvh bg-paper">
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:px-8">
        <Link href="/plateforme" className="flex items-center gap-2">
          <Brand />
          <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">
            <ShieldCheck className="size-3.5" aria-hidden />
            Plateforme
          </span>
        </Link>
        <div className="flex items-center gap-3 text-[13px] text-ink-2">
          <span className="hidden sm:inline">{me.data.name}</span>
          <Button variant="ghost" size="sm" onClick={() => logout.mutate()} loading={logout.isPending}>
            <LogOut className="size-4" aria-hidden />
            Sortir
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 lg:px-8">{children}</main>
    </div>
  );
}

function PlatformLogin() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const login = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => platformApi.login(email, password),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PLATFORM_ME }),
    onError: (failure) => setError(errorMessage(failure)),
  });
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    login.mutate({ email: String(form.get('email') ?? ''), password: String(form.get('password') ?? '') });
  }
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <Brand />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">Console de la plateforme</h1>
      <p className="mt-1.5 text-sm text-ink-2">Réservée à l’équipe TABILO.</p>
      <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col gap-4">
        <Input label="Adresse e-mail" name="email" type="email" autoComplete="username" autoFocus />
        <Input label="Mot de passe" name="password" type="password" autoComplete="current-password" />
        <FormError message={error} />
        <Button type="submit" size="lg" loading={login.isPending}>
          Se connecter
        </Button>
      </form>
    </main>
  );
}
