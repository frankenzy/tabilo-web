import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomId } from '@/lib/utils';

const real = globalThis.crypto;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('donne un UUID v4 même sans crypto.randomUUID (page ouverte en HTTP sur le réseau local)', () => {
    const getRandomValues = vi.fn(<T extends ArrayBufferView>(array: T) => real.getRandomValues(array));
    vi.stubGlobal('crypto', { getRandomValues });
    const first = randomId();
    expect(first).toMatch(UUID_V4);
    expect(randomId()).not.toBe(first);
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it('utilise crypto.randomUUID quand il existe', () => {
    expect(randomId()).toMatch(UUID_V4);
  });
});
