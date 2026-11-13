import { redirect } from 'next/navigation';

/**
 * L'ancienne page de connexion renvoie vers l'accueil, qui porte le formulaire de connexion.
 * La destination demandée (?next=/app/…) est conservée : après connexion, on y arrive.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = (await searchParams).next;
  const target = typeof next === 'string' && next.startsWith('/app') ? `/?next=${encodeURIComponent(next)}` : '/';
  redirect(target);
}
