import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefetchScript } from '@/components/pages/guest/session-prefetch';
import { fromPrefetch } from '@/components/pages/guest/use-guest-session';

/** Ouverture anticipée de la session de table : même résultat que le chemin habituel, en partant plus tôt. */

const CODE = 'H7Ql9nU8tmdfFAOJFTxQo116';
const context = {
  establishment: { name: 'Maquis INTERNAT', currency: 'XOF' },
  table: { label: '1', area: 'Terrasse' },
  requestTypes: [],
  menu: [],
  orderingEnabled: true,
  pairingsEnabled: false,
  // Spec 027 : repère de la session et présence d'une zone.
  marker: 3,
  zone: false,
};
const session = { ...context, token: 't'.repeat(43), expiresAt: '2026-11-17T14:00:00.000Z' };

/** Exécute le script en ligne comme le ferait le navigateur, avec un stockage et un réseau simulés. */
function runScript(options: { stored?: string; status: number; body: unknown; pageHost?: string; api?: string }) {
  const window: Record<string, unknown> = {};
  const fetch = vi.fn(async () => ({ status: options.status, json: async () => options.body }));
  vi.stubGlobal('window', window);
  vi.stubGlobal('location', { hostname: options.pageHost ?? 'localhost' });
  vi.stubGlobal('localStorage', { getItem: (key: string) => (key === `tabilo.table.${CODE}` ? (options.stored ?? null) : null) });
  vi.stubGlobal('fetch', fetch);
  new Function(prefetchScript(CODE, options.api ?? 'http://localhost:3090')!)();
  return { window, fetch };
}

describe('Session anticipée — page client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('n’écrit aucun code suspect dans la page', () => {
    expect(prefetchScript('abc"</script><script>alert(1)//', 'http://localhost:3090')).toBeNull();
    expect(prefetchScript('', 'http://localhost:3090')).toBeNull();
    expect(prefetchScript(CODE, 'https://api.example.com/</script>')).not.toContain('</script>');
  });

  it('premier scan : ouvre la session dès le HTML, et la page la reprend sans nouvel appel', async () => {
    const { window, fetch } = runScript({ status: 201, body: session });
    expect(fetch).toHaveBeenCalledWith('http://localhost:3090/api/v1/guest/sessions', expect.objectContaining({ method: 'POST', body: JSON.stringify({ code: CODE }) }));
    expect(await fromPrefetch(CODE)).toEqual({ token: session.token, context, reused: false });
    // Une seule utilisation : « Réessayer » repart d'une vraie requête.
    expect(window.__tabiloGuest).toBeUndefined();
    expect(await fromPrefetch(CODE)).toBeNull();
  });

  it('téléphone du réseau local : l’API est jointe sur l’adresse de la page, comme resolveApiUrl', () => {
    const { fetch } = runScript({ status: 201, body: session, pageHost: '192.168.1.20' });
    expect(fetch).toHaveBeenCalledWith('http://192.168.1.20:3090/api/v1/guest/sessions', expect.anything());
  });

  it('jeton mémorisé encore valide : reprend la session existante', async () => {
    const { fetch } = runScript({ stored: 'stored-token', status: 200, body: context });
    expect(fetch).toHaveBeenCalledWith('http://localhost:3090/api/v1/guest/session', { headers: { 'x-table-session': 'stored-token' } });
    expect(await fromPrefetch(CODE)).toEqual({ token: 'stored-token', context, reused: true });
  });

  it('jeton mémorisé expiré : la page l’oublie et ouvre une nouvelle session', async () => {
    runScript({ stored: 'old-token', status: 401, body: { code: 'UNAUTHORIZED' } });
    expect(await fromPrefetch(CODE)).toBe('expired');
  });

  it('réponse inattendue (QR invalide, serveur en panne, autre table) : chemin habituel', async () => {
    runScript({ status: 404, body: { code: 'NOT_FOUND' } });
    expect(await fromPrefetch(CODE)).toBeNull();
    runScript({ status: 201, body: { token: 'court' } });
    expect(await fromPrefetch(CODE)).toBeNull();
    runScript({ status: 201, body: session });
    expect(await fromPrefetch('autre-code')).toBeNull();
  });
});
