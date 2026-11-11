import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="font-mono text-sm text-ink-3">404</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">Page introuvable</h1>
        <p className="mt-1 text-sm text-ink-2">Cette adresse n’existe pas ou plus.</p>
        <Link href="/" className="mt-5 inline-block text-sm font-medium text-ink underline underline-offset-4">
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
