'use client';

import { useEffect, useState } from 'react';

/** Horloge partagée par les chronomètres : une valeur `now` rafraîchie à intervalle fixe. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
