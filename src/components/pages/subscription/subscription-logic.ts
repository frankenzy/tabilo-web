import type { AccountInfo, AccountState, PaymentMethod, PlanFeature } from '@/contracts';

/** Specs 034 à 037 : logique pure de l'abonnement côté interface (testée sans navigateur). */

export const STATE_LABELS: Record<AccountState, string> = {
  trial: 'Essai',
  active: 'Actif',
  past_due: 'En retard',
  suspended: 'Suspendu',
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  orange_money: 'Orange Money',
  mtn_momo: 'MTN MoMo',
  moov_money: 'Moov Money',
  wave: 'Wave',
  bank_transfer: 'Virement',
};

const DAY_MS = 86_400_000;

/** Jours restants avant une date (arrondi au-dessus, jamais négatif). */
export function daysLeft(iso: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - now) / DAY_MS));
}

/** Spec 034, R4 et R7 : un module est compris ; sans information d'abonnement (API plus ancienne), rien n'est fermé. */
export function hasFeature(account: AccountInfo | undefined, feature: PlanFeature): boolean {
  return !account || account.features.includes(feature);
}

export type Banner = { tone: 'info' | 'warn' | 'danger'; title: string; detail: string | null } | null;

/**
 * Spec 035, R5 : bandeau de l'espace pro. 7 jours avant l'échéance (ambre), pendant la grâce (rouge), suspendu (rouge).
 * Le propriétaire voit les dates ; l'équipe voit un message générique.
 */
export function accountBanner(account: AccountInfo | undefined, owner: boolean, now: number): Banner {
  if (!account) return null;
  const date = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(iso));
  const generic = 'Abonnement à renouveler : prévenez le responsable.';
  if (account.state === 'suspended') {
    return { tone: 'danger', title: owner ? 'TABILO est suspendu' : 'TABILO est suspendu', detail: owner ? `Réglez votre abonnement pour tout rouvrir. WhatsApp : ${account.contact}` : generic };
  }
  if (account.state === 'past_due') {
    return {
      tone: 'danger',
      title: owner ? `Paiement attendu. Sans paiement, TABILO s’arrête le ${date(account.graceUntil)}.` : generic,
      detail: owner ? `WhatsApp TABILO : ${account.contact}` : null,
    };
  }
  const left = daysLeft(account.paidUntil, now);
  if (left > 7) return null;
  if (!owner) return { tone: 'warn', title: generic, detail: null };
  return {
    tone: 'warn',
    title: account.state === 'trial' ? `Votre essai se termine le ${date(account.paidUntil)}.` : `Votre abonnement se termine le ${date(account.paidUntil)}.`,
    detail: `Contactez TABILO pour continuer. WhatsApp : ${account.contact}`,
  };
}

/** Lien WhatsApp à partir du numéro affiché (+225 05 84 77 73 67 → wa.me/2250584777367). */
export function whatsappLink(contact: string): string {
  return `https://wa.me/${contact.replace(/\D/g, '')}`;
}
