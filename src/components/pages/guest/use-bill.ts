'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { GuestContext, GuestRequest } from '@/contracts';
import { randomId } from '@/lib/utils';
import { guestApi } from '@/services/api/guest';
import { errorMessage, toHttpError } from '@/services/http';
import { billState, type BillState } from './order-logic';
import { guestRequestsKey, upsert } from './use-guest-requests';

export interface Bill {
  state: BillState;
  /** Spec 028, R2 : la barre a été glissée. */
  ask: () => void;
  error: string | null;
}

/** Spec 028 : demande d'addition du client — état affiché tout de suite, demande envoyée une seule fois. */
export function useBill(token: string, context: GuestContext, requests: GuestRequest[], onSessionClosed: () => void): Bill {
  const queryClient = useQueryClient();
  const billType = context.requestTypes.find((type) => type.kind === 'bill');
  // Une clé par intention : un double glissement ou une reprise réseau ne crée qu'une demande.
  const [key, setKey] = useState(() => randomId());

  const send = useMutation({
    mutationFn: () => guestApi.create(token, { requestTypeId: billType!.id }, key),
    onSuccess: ({ request }) => {
      queryClient.setQueryData<GuestRequest[]>(guestRequestsKey(token), (list = []) => upsert(list, request));
      setKey(randomId());
    },
    onError: (error) => {
      if (toHttpError(error).status === 401 || toHttpError(error).code === 'TABLE_SESSION_CLOSED') onSessionClosed();
    },
  });

  return {
    state: billState(requests, billType !== undefined, send.isPending, context.serviceMode),
    ask: () => {
      if (billType && !send.isPending) send.mutate();
    },
    error: send.isError ? errorMessage(send.error) : null,
  };
}
