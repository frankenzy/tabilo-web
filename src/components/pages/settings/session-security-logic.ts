/** Spec 027, R12 : bornes, identiques à l'API. */
export const ZONE_RADIUS = { min: 50, max: 500, default: 150 } as const;
export const ALERT_MINUTES = { min: 10, max: 60, default: 20 } as const;

/** Valide le rayon et le délai saisis ; renvoie les erreurs par champ. */
export function validateSessionSecurity(radius: number, minutes: number): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!Number.isInteger(radius) || radius < ZONE_RADIUS.min || radius > ZONE_RADIUS.max) errors.zoneRadiusM = `Entre ${ZONE_RADIUS.min} et ${ZONE_RADIUS.max} m.`;
  if (!Number.isInteger(minutes) || minutes < ALERT_MINUTES.min || minutes > ALERT_MINUTES.max) errors.unpaidAlertMinutes = `Entre ${ALERT_MINUTES.min} et ${ALERT_MINUTES.max} minutes.`;
  return errors;
}
