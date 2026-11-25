/** Spec 027, R9 : « depuis 20 min », « depuis 1 h 05 ». */
export function sinceLabel(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `depuis ${minutes} min`;
  return `depuis ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}
