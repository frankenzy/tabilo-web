import { BellRing, QrCode, Timer } from 'lucide-react';
import Link from 'next/link';
import { Brand } from '@/components/layouts/brand';

const STEPS = [
  { icon: QrCode, title: 'Un QR code par table', text: 'Le client scanne, sans compte ni application à installer.' },
  { icon: BellRing, title: 'La demande arrive en salle', text: 'Votre équipe la voit aussitôt, avec la table, la zone et son ancienneté.' },
  { icon: Timer, title: 'Vous pilotez les délais', text: 'Demandes en retard, qui traite quoi, temps de prise en charge : tout est tracé.' },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-6">
      <header className="flex items-center justify-between">
        <Brand />
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-sunken hover:text-ink">
          Connexion
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center py-14">
        <p className="text-sm font-medium text-brand-strong">Restaurants · cafés · glaciers</p>
        <h1 className="mt-3 text-4xl leading-[1.1] font-semibold tracking-tight text-ink sm:text-5xl">
          Plus aucune demande oubliée en salle.
        </h1>
        <p className="mt-4 max-w-xl text-base text-ink-2">
          TABILO relie chaque table à votre équipe : le client demande depuis son téléphone, le serveur prend en
          charge, le gérant supervise les délais.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/inscription" className="inline-flex h-12 items-center rounded-lg bg-ink px-5 text-[15px] font-medium text-white hover:bg-black">
            Créer mon établissement
          </Link>
          <Link href="/login" className="inline-flex h-12 items-center rounded-lg px-5 text-[15px] font-medium text-ink ring-1 ring-line ring-inset hover:bg-sunken">
            J’ai déjà un compte
          </Link>
        </div>

        <ol className="mt-14 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <div className="flex items-center gap-2 text-ink-3">
                <span className="tabular font-mono text-xs">0{index + 1}</span>
                <step.icon className="size-4" aria-hidden />
              </div>
              <h2 className="mt-2 text-[15px] font-semibold text-ink">{step.title}</h2>
              <p className="mt-1 text-sm text-ink-2">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
