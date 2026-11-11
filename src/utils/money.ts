/**
 * Montants : l'API les échange en entiers dans l'unité mineure de la devise
 * (1 500 F CFA = 1500 ; 8,50 € = 850). Jamais de nombre à virgule pour de l'argent.
 * Le nombre de décimales vient de la devise elle-même (0 pour XOF, 2 pour EUR).
 */

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string): Intl.NumberFormat {
  let format = formatters.get(currency);
  if (!format) {
    format = new Intl.NumberFormat('fr-FR', { style: 'currency', currency });
    formatters.set(currency, format);
  }
  return format;
}

/** Nombre de décimales d'une devise (0 pour XOF, 2 pour EUR). */
export function currencyDigits(currency: string): number {
  return formatter(currency).resolvedOptions().maximumFractionDigits ?? 2;
}

/** 1500, 'XOF' → « 1 500 F CFA » ; 850, 'EUR' → « 8,50 € ». */
export function formatMoney(minor: number, currency: string): string {
  return formatter(currency).format(minor / 10 ** currencyDigits(currency));
}

/** Valeur à afficher dans un champ de saisie, sans symbole : 850, 'EUR' → « 8,50 ». */
export function toMajorInput(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  return (minor / 10 ** digits).toFixed(digits).replace('.', ',');
}

/**
 * Lit un prix saisi en unité majeure (« 8,50 », « 8.5 », « 1 500 ») et le convertit en entier mineur.
 * Renvoie null si la saisie n'est pas un montant positif valide pour la devise.
 */
export function parseMoney(input: string, currency: string): number | null {
  const digits = currencyDigits(currency);
  const normalized = input.replace(/[\s  ]/g, '').replace(',', '.');
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${digits}})?$`);
  if (!pattern.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0') || 0);
  return Number.isSafeInteger(minor) && minor <= 100_000_000 ? minor : null;
}
