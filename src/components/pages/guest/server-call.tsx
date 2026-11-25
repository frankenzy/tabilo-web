'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Check, Footprints, MessageCircle, Phone, PhoneOff, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SessionMarker } from '@/components/ui/session-marker';
import type { GuestContext, GuestRequest, GuestRequestType } from '@/contracts';
import { useNow } from '@/hooks/use-now';
import { cn, randomId } from '@/lib/utils';
import { guestApi } from '@/services/api/guest';
import { errorMessage, toHttpError } from '@/services/http';
import { formatClock, secondsSince } from '@/utils/time';
import { haptic } from './fly-to-cart';
import { OPTIMISTIC_CALL, serverTypes } from './server-logic';
import { guestRequestsKey, upsert } from './use-guest-requests';

const NOTE_MAX = 280;
const ACTIVE = ['pending', 'assigned', 'accepted', 'in_progress'];
function optimisticCall(type: GuestRequestType): GuestRequest {
  return {
    id: OPTIMISTIC_CALL,
    status: 'pending',
    type: { id: type.id, label: type.label, icon: type.icon, kind: 'call' },
    items: [],
    totalMinor: null,
    quantity: null,
    handledBy: null,
    createdAt: new Date().toISOString(),
    acceptedAt: null,
    startedAt: null,
    resolvedAt: null,
    cancelledAt: null,
    paidAt: null,
    note: null,
  };
}

interface ServerCallProps {
  token: string;
  context: GuestContext;
  requests: GuestRequest[];
  onSessionClosed: () => void;
}

/** Spec 029 : envoi de l'appel (affiché tout de suite) et des messages. */
export function useServerCall({ token, context, onSessionClosed }: Omit<ServerCallProps, 'requests'>) {
  const queryClient = useQueryClient();
  const { call: callType, message: messageType } = serverTypes(context.requestTypes);
  const key = guestRequestsKey(token);
  const [callKey, setCallKey] = useState(() => randomId());
  const onError = (error: unknown) => {
    const http = toHttpError(error);
    if (http.status === 401 || http.code === 'TABLE_SESSION_CLOSED') onSessionClosed();
  };

  const call = useMutation({
    mutationFn: () => guestApi.create(token, { requestTypeId: callType!.id }, callKey),
    // R3 : la carte « Un serveur vient vers vous » s'affiche avant la réponse.
    onMutate: () => queryClient.setQueryData<GuestRequest[]>(key, (list = []) => [optimisticCall(callType!), ...list]),
    onSuccess: ({ request }) => {
      queryClient.setQueryData<GuestRequest[]>(key, (list = []) => upsert(list.filter((r) => r.id !== OPTIMISTIC_CALL), request));
      setCallKey(randomId());
    },
    onError: (error) => {
      queryClient.setQueryData<GuestRequest[]>(key, (list = []) => list.filter((r) => r.id !== OPTIMISTIC_CALL));
      onError(error);
    },
  });

  const send = useMutation({
    mutationFn: (note: string) => guestApi.create(token, { requestTypeId: messageType!.id, note }, randomId()),
    onSuccess: ({ request }) => queryClient.setQueryData<GuestRequest[]>(key, (list = []) => upsert(list, request)),
    onError,
  });

  return {
    callType,
    messageType,
    call: () => {
      if (callType && !call.isPending) call.mutate();
    },
    callError: call.isError ? errorMessage(call.error) : null,
    send,
  };
}

/**
 * Spec 029, R2 et R5 : le panneau du bouton « Serveur » — deux grands ronds, téléphone et message.
 * Le téléphone appelle d'un toucher et referme le panneau ; la bulle ouvre la saisie.
 */
export function ServerSheet({
  open,
  onOpenChange,
  token,
  context,
  requests,
  onSessionClosed,
  startWriting = false,
}: ServerCallProps & { open: boolean; onOpenChange: (open: boolean) => void; startWriting?: boolean }) {
  const { callType, messageType, call, send } = useServerCall({ token, context, onSessionClosed });
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const messages = requests
    .filter((request) => request.type.kind === 'message' && ACTIVE.includes(request.status) && request.note)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  useEffect(() => {
    if (open) setWriting(startWriting);
    else send.reset();
    // send.reset est stable ; on ne réagit qu'à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, startWriting]);
  useEffect(() => {
    if (writing) field.current?.focus();
  }, [writing]);

  const submit = () => {
    const note = text.trim();
    if (!note || send.isPending) return;
    haptic(10);
    send.mutate(note, { onSuccess: () => setText('') });
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 animate-fade-in bg-ink/40 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-md animate-sheet-up flex-col rounded-t-[28px] bg-surface px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-pop focus:outline-none sm:bottom-6 sm:rounded-[28px]"
        >
          <DialogPrimitive.Title className="sr-only">{writing ? 'Message au serveur' : 'Appeler le serveur'}</DialogPrimitive.Title>
          <div className="flex items-center justify-between">
            <span className="size-11" aria-hidden />
            <span className="h-1.5 w-10 rounded-full bg-line" aria-hidden />
            {/* Retour au menu à tout moment. */}
            <DialogPrimitive.Close aria-label="Revenir au menu" className="grid size-11 place-items-center">
              <span className="grid size-8 place-items-center rounded-full bg-sunken text-ink-2 active:scale-90">
                <X className="size-4" aria-hidden />
              </span>
            </DialogPrimitive.Close>
          </div>

          {!writing ? (
            <ServerRounds
              className="pt-4 pb-6"
              onCall={
                callType
                  ? () => {
                      call();
                      onOpenChange(false);
                    }
                  : undefined
              }
              onWrite={messageType ? () => setWriting(true) : undefined}
            />
          ) : (
            <div className="flex min-h-0 flex-col gap-3 pt-2">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-full bg-message-soft text-message" aria-hidden>
                  <MessageCircle className="size-[18px]" />
                </span>
                <span className="text-[15px] font-semibold text-ink">Message</span>
              </div>
              {messages.length > 0 && (
                <ul className="flex max-h-[40dvh] flex-col items-end gap-2 overflow-y-auto" aria-label="Vos messages">
                  {messages.map((message) => (
                    <li key={message.id} className="max-w-[80%] animate-pop-in rounded-[20px] rounded-br-md bg-message px-4 py-2.5 text-[15px] leading-snug text-white">
                      {message.note}
                    </li>
                  ))}
                  <li className="flex items-center gap-1 text-[12px] font-semibold text-done">
                    <Check className="size-3.5" strokeWidth={2.6} aria-hidden />
                    Reçu par l’équipe
                  </li>
                </ul>
              )}
              <form
                className="flex items-end gap-2.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
              >
                <label htmlFor="server-message" className="sr-only">
                  Votre message
                </label>
                <textarea
                  id="server-message"
                  ref={field}
                  rows={1}
                  maxLength={NOTE_MAX}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  placeholder="Votre message…"
                  className="max-h-32 min-h-[52px] flex-1 resize-none rounded-[26px] bg-sunken px-[18px] py-[14px] text-[16px] text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-message/30"
                />
                <button
                  type="submit"
                  aria-label="Envoyer"
                  disabled={!text.trim() || send.isPending}
                  className="grid size-[52px] shrink-0 place-items-center rounded-full bg-message text-white shadow-[0_10px_22px_-10px_rgb(59_63_184/0.8)] transition-[transform,opacity] duration-300 ease-spring active:scale-90 disabled:opacity-40"
                >
                  <ArrowUp className="size-[22px]" strokeWidth={2.4} aria-hidden />
                </button>
              </form>
              {send.isError && (
                <p role="alert" className="text-[13px] text-late">
                  {errorMessage(send.error)}
                </p>
              )}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Spec 029, R4 et R5 : la carte d'un appel ou d'un message, en tête du menu.
 * Ondes tant que personne ne l'a pris ; « Raccrocher » / annuler à ce moment-là seulement ; « Fatou arrive » ensuite.
 */
export function ServerCallCard({ request, token, marker, tableLabel }: { request: GuestRequest; token: string; marker?: number; tableLabel?: string }) {
  const queryClient = useQueryClient();
  const now = useNow();
  const isCall = request.type.kind === 'call';
  const waiting = request.status === 'pending' || request.status === 'assigned';
  const optimistic = request.id === OPTIMISTIC_CALL;
  const hangUp = useMutation({
    mutationFn: () => guestApi.cancel(token, request.id),
    onSuccess: (updated) => queryClient.setQueryData<GuestRequest[]>(guestRequestsKey(token), (list = []) => upsert(list, updated)),
    // Déjà pris : l'état réel revient, le bouton disparaît.
    onError: () => queryClient.invalidateQueries({ queryKey: guestRequestsKey(token) }),
  });
  const title = waiting ? (isCall ? 'Un serveur vient vers vous' : 'Message envoyé') : `${request.handledBy ?? 'Un serveur'} arrive`;
  const hangUpNow = () => {
    haptic(10);
    hangUp.mutate();
  };

  if (isCall) {
    // Maquette « Client 2 » : grande carte sombre, ondes autour du serveur qui marche, durée, repère de la table.
    return (
      <article
        role="status"
        aria-label={title}
        className="flex animate-rise flex-col items-center gap-4 rounded-[28px] bg-ink px-6 pt-7 pb-6 text-center text-white shadow-[0_24px_48px_-20px_rgb(27_25_23/0.7)]"
      >
        <span className="relative grid size-24 place-items-center" aria-hidden>
          {waiting && (
            <>
              <span className="absolute inset-0 rounded-full bg-call motion-safe:animate-call-wave" />
              <span className="absolute inset-0 rounded-full bg-call [animation-delay:700ms] motion-safe:animate-call-wave" />
            </>
          )}
          <span className={cn('relative grid size-24 place-items-center rounded-full', waiting ? 'bg-call text-ink' : 'bg-done text-white')}>
            {waiting ? <Footprints className="size-11 motion-safe:animate-call-walk" strokeWidth={1.9} /> : <Check className="size-11" strokeWidth={2.6} />}
          </span>
        </span>
        <div>
          <p className="text-[21px] leading-tight font-bold tracking-tight">{title}</p>
          <p className="tabular mt-1.5 text-[14px] text-white/65">
            {waiting ? <span className="font-mono">{formatClock(secondsSince(request.createdAt, now))}</span> : 'En route vers votre table'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {(marker !== undefined || tableLabel) && (
            <span className="flex h-9 items-center gap-2 rounded-full bg-white/10 pr-3.5 pl-1.5">
              {marker !== undefined && <SessionMarker index={marker} size="sm" decorative />}
              {tableLabel && <span className="text-[13px] font-semibold">Table {tableLabel}</span>}
            </span>
          )}
          {/* R4 : raccrocher tant que personne n'a pris l'appel ; petit, pour ne pas voler la vedette. */}
          {waiting && !optimistic && (
            <button
              type="button"
              onClick={hangUpNow}
              disabled={hangUp.isPending}
              aria-label="Raccrocher"
              className="flex h-9 items-center gap-1.5 rounded-full bg-late px-3.5 text-[13px] font-semibold text-white transition-transform duration-300 ease-spring active:scale-95 disabled:opacity-50"
            >
              <PhoneOff className="size-4" aria-hidden />
              Raccrocher
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <article role="status" aria-label={title} className="flex animate-rise items-center gap-3.5 rounded-[22px] bg-ink px-3.5 py-3 text-white">
      <span className="relative grid size-14 shrink-0 place-items-center" aria-hidden>
        {waiting && (
          <>
            <span className="absolute inset-0 rounded-full bg-message motion-safe:animate-call-wave" />
            <span className="absolute inset-0 rounded-full bg-message [animation-delay:600ms] motion-safe:animate-call-wave" />
          </>
        )}
        <span className={cn('relative grid size-14 place-items-center rounded-full', waiting ? 'bg-message text-white' : 'bg-done text-white')}>
          {waiting ? <MessageCircle className="size-6" aria-hidden /> : <Footprints className="size-6" aria-hidden />}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold tracking-tight">{title}</p>
        <p className="mt-0.5 truncate text-[13px] text-white/60">
          {request.note ? `« ${request.note} »` : <span className="tabular font-mono">{formatClock(secondsSince(request.createdAt, now))}</span>}
        </p>
      </div>
      {waiting && !optimistic && (
        <button
          type="button"
          onClick={hangUpNow}
          disabled={hangUp.isPending}
          aria-label="Annuler le message"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-late text-white transition-transform duration-300 ease-spring active:scale-90 disabled:opacity-50"
        >
          <X className="size-5" aria-hidden />
        </button>
      )}
    </article>
  );
}

/** Spec 029, R2 : les deux grands ronds — téléphone (appeler d'un toucher) et bulle (écrire). */
export function ServerRounds({ onCall, onWrite, className }: { onCall?: () => void; onWrite?: () => void; className?: string }) {
  return (
    <div className={cn('flex justify-center gap-12', className)}>
      {onCall && (
        <button
          type="button"
          aria-label="Appeler un serveur"
          onClick={() => {
            haptic([12, 40, 12]);
            onCall();
          }}
          className="group flex flex-col items-center gap-3"
        >
          <span className="grid size-[104px] place-items-center rounded-full bg-ink text-white shadow-[0_18px_36px_-16px_rgb(27_25_23/0.7)] transition-transform duration-300 ease-spring group-active:scale-90">
            <Phone className="size-11" strokeWidth={1.7} aria-hidden />
          </span>
          <span className="text-[15px] font-semibold text-ink">Serveur</span>
        </button>
      )}
      {onWrite && (
        <button type="button" aria-label="Écrire un message" onClick={onWrite} className="group flex flex-col items-center gap-3">
          <span className="grid size-[104px] place-items-center rounded-full bg-message-soft text-message ring-1 ring-message/15 transition-transform duration-300 ease-spring group-active:scale-90">
            <MessageCircle className="size-11" strokeWidth={1.7} aria-hidden />
          </span>
          <span className="text-[15px] font-semibold text-ink">Message</span>
        </button>
      )}
    </div>
  );
}
