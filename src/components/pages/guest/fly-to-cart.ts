/**
 * Spec 012, R5 : retours au toucher côté client.
 * - haptic() : brève vibration quand le téléphone le permet (Android ; ignoré ailleurs).
 * - flyToCart() : une vignette du plat vole de l'endroit touché jusqu'à la barre « Voir la commande »,
 *   qui rebondit une fois à l'arrivée (événement CART_BUMP).
 * Rien ne bouge si le téléphone demande moins d'animations : la barre est seulement prévenue.
 */

export const CART_BUMP = 'tabilo:cart-bump';
export const CART_TARGET_ATTR = 'data-cart-target';

export function haptic(pattern: number | number[] = 10): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* vibration indisponible */
  }
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function bump(): void {
  window.dispatchEvent(new Event(CART_BUMP));
}

/** Point d'arrivée : l'élément donné, sinon l'icône de la barre « Voir la commande », sinon le bas de l'écran. */
function targetPoint(to?: Element | null): { x: number; y: number } {
  const target = to ?? document.querySelector(`[${CART_TARGET_ATTR}]`);
  if (target) {
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight - 40 };
}

/** `to` : point d'arrivée (spec 014 : la liste de la commande, dans la feuille). */
export function flyToCart(from: DOMRect | null, imageSrc: string | null, to?: Element | null): void {
  if (typeof window === 'undefined') return;
  if (!from || reducedMotion() || typeof document.body.animate !== 'function') {
    window.setTimeout(bump, 120);
    return;
  }
  const size = 56;
  const start = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
  const ghost = document.createElement('div');
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${start.x - size / 2}px`,
    top: `${start.y - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '9999px',
    overflow: 'hidden',
    zIndex: '70',
    pointerEvents: 'none',
    boxShadow: '0 10px 24px -8px rgb(27 25 23 / 0.45)',
    border: '3px solid #fff',
    background: imageSrc ? `center / cover no-repeat url("${imageSrc}")` : 'var(--color-brand)',
  });
  document.body.appendChild(ghost);
  // Deux images d'affichage : la barre « Voir la commande » peut apparaître avec ce premier ajout.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const end = targetPoint(to);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lift = Math.min(160, Math.abs(dy) * 0.35 + 60); // trajectoire en arc, comme un objet lancé
      const animation = ghost.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - lift}px) scale(0.85)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0.6 },
        ],
        { duration: 700, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards' },
      );
      animation.onfinish = () => {
        ghost.remove();
        bump();
      };
      animation.oncancel = () => ghost.remove();
    }),
  );
}
