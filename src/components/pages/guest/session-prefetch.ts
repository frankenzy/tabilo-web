/**
 * Ouverture anticipée de la session de table.
 *
 * Sur un téléphone en 4G, le JavaScript de la page client met plus de 2 s à arriver ; la session n'était
 * demandée qu'ensuite. Un petit script en ligne, envoyé avec le HTML, lance la même requête dès la lecture
 * de la page (reprise du jeton mémorisé, sinon ouverture d'une session). `useGuestSession` reprend ensuite
 * la réponse au lieu de refaire l'appel. Toute réponse inattendue retombe sur le chemin habituel.
 */

/** Réponse brute de la requête anticipée : le schéma est vérifié par `useGuestSession`, comme d'habitude. */
export interface PrefetchedSession {
  /** Jeton mémorisé repris (GET /guest/session), ou null si une session a été ouverte (POST /guest/sessions). */
  stored: string | null;
  status: number;
  body: unknown;
}

interface PrefetchSlot {
  code: string;
  promise: Promise<PrefetchedSession>;
}

declare global {
  interface Window {
    __tabiloGuest?: PrefetchSlot;
  }
}

/** Codes de QR acceptés : rien d'autre n'est écrit dans le script. */
const CODE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Source du script en ligne. Même résolution d'adresse que `resolveApiUrl` (services/http) et même clé de
 * stockage que `readStoredToken` (services/api/guest) : les deux doivent rester alignés.
 */
export function prefetchScript(code: string, configuredApiUrl: string): string | null {
  if (!CODE_PATTERN.test(code)) return null;
  const json = (value: string) => JSON.stringify(value).replace(/</g, '\\u003c');
  return `(function(){try{
var code=${json(code)},api=new URL(${json(configuredApiUrl.replace(/\/$/, ''))}),host=location.hostname;
if((api.hostname==='localhost'||api.hostname==='127.0.0.1')&&host!==api.hostname)api.hostname=host;
var base=api.toString().replace(/\\/$/,'')+'/api/v1/guest',stored=null;
try{stored=localStorage.getItem('tabilo.table.'+code)}catch(e){}
var request=stored?fetch(base+'/session',{headers:{'x-table-session':stored}})
:fetch(base+'/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code})});
window.__tabiloGuest={code:code,promise:request.then(function(r){return r.json().catch(function(){return null}).then(function(body){return{stored:stored,status:r.status,body:body}})},function(){return{stored:stored,status:0,body:null}})};
}catch(e){}})();`;
}

/** Réponse anticipée pour ce code, s'il y en a une. Plusieurs appels reçoivent la même (double rendu en développement). */
export function takePrefetchedSession(code: string): Promise<PrefetchedSession> | null {
  if (typeof window === 'undefined') return null;
  const slot = window.__tabiloGuest;
  return slot && slot.code === code ? slot.promise : null;
}

/** Après usage ou sur « Réessayer » : on repart d'une vraie requête. */
export function forgetPrefetchedSession(): void {
  if (typeof window !== 'undefined') delete window.__tabiloGuest;
}
