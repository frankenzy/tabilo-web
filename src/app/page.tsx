import { BellRing, Clock3, LayoutGrid, QrCode, Timer, Users } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Brand } from '@/components/layouts/brand';
import { LoginForm } from '@/components/pages/auth/login-form';

/** Demandes fictives affichées dans l'aperçu du tableau de bord. */
const PREVIEW_REQUESTS = [
  { table: 'Table 4', zone: 'Terrasse', label: 'Appel serveur', age: '6 min', tone: 'bg-late-soft text-late', status: 'En retard' },
  { table: 'Table 12', zone: 'Salle', label: 'Addition', age: '2 min', tone: 'bg-wait text-wait-ink', status: 'En attente' },
  { table: 'Table 7', zone: 'Salle', label: 'De l’eau ×2', age: '1 min', tone: 'bg-progress-soft text-progress', status: 'Pris en charge' },
  { table: 'Table 2', zone: 'Terrasse', label: 'Commande', age: '4 min', tone: 'bg-done-soft text-done', status: 'Servie' },
];

const PREVIEW_STATS = [
  { icon: BellRing, label: 'Demandes ouvertes', value: '8' },
  { icon: Timer, label: 'Délai moyen', value: '1 min 40' },
  { icon: Users, label: 'Serveurs en salle', value: '3' },
];

/** Aperçu décoratif de l'espace gérant, incliné dans le panneau de présentation. */
function DashboardPreview() {
  return (
    <div aria-hidden className="pointer-events-none flex w-[760px] overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-line select-none">
      <aside className="w-44 shrink-0 border-r border-line p-4">
        <Brand className="text-[13px]" />
        <ul className="mt-6 flex flex-col gap-1 text-[11px] text-ink-2">
          {[
            { icon: LayoutGrid, label: 'Tableau de bord', active: true },
            { icon: BellRing, label: 'Demandes' },
            { icon: QrCode, label: 'Tables & QR codes' },
            { icon: Users, label: 'Équipe' },
            { icon: Clock3, label: 'Historique' },
          ].map((item) => (
            <li key={item.label} className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${item.active ? 'bg-brand-soft font-medium text-brand-strong' : ''}`}>
              <item.icon className="size-3.5" />
              {item.label}
            </li>
          ))}
        </ul>
      </aside>
      <div className="flex-1 p-5">
        <p className="text-[13px] font-semibold text-ink">Bonjour, bon service !</p>
        <p className="text-[10px] text-ink-3">Ce qui se passe en salle en ce moment</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {PREVIEW_STATS.map((stat) => (
            <div key={stat.label} className="rounded-xl p-3 ring-1 ring-line">
              <stat.icon className="size-3.5 text-brand" />
              <p className="mt-2 text-[10px] text-ink-3">{stat.label}</p>
              <p className="tabular text-base font-semibold text-ink">{stat.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-[11px] font-semibold text-ink">Demandes en cours</p>
        <ul className="mt-2 divide-y divide-line rounded-xl ring-1 ring-line">
          {PREVIEW_REQUESTS.map((request) => (
            <li key={request.table} className="flex items-center gap-3 px-3 py-2.5 text-[11px]">
              <span className="w-16 font-medium text-ink">{request.table}</span>
              <span className="w-16 text-ink-3">{request.zone}</span>
              <span className="flex-1 text-ink-2">{request.label}</span>
              <span className="tabular w-12 text-ink-3">{request.age}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${request.tone}`}>{request.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="grid min-h-dvh w-full gap-4 bg-surface p-4 lg:grid-cols-3">
      {/* Connexion : 1/3 à gauche */}
      <section aria-labelledby="login-title" className="flex items-center justify-center py-8 lg:col-span-1">
        <div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-sm ring-1 ring-line sm:p-9">
          <div className="flex justify-center">
            <Brand className="text-xl [&>span]:size-9 [&>span]:text-base" />
          </div>
          <h2 id="login-title" className="mt-5 text-center text-3xl font-semibold tracking-tight text-ink">
            Connexion
          </h2>
          <div className="mt-8">
            <Suspense>
              <LoginForm autoFocus={false} />
            </Suspense>
          </div>
          <p className="mt-6 text-center text-sm text-ink-2">
            Pas encore de compte ?{' '}
            <Link href="/inscription" className="font-medium text-brand-strong underline underline-offset-4">
              Créer mon établissement
            </Link>
          </p>
        </div>
      </section>

      {/* Présentation : 2/3 à droite */}
      <section className="relative isolate flex flex-col overflow-hidden rounded-3xl bg-brand-soft px-8 pt-16 pb-10 lg:col-span-2 lg:min-h-[560px] lg:px-12 lg:pt-[18vh]">
        {/* Grande vague décorative */}
        <svg aria-hidden viewBox="0 0 800 600" preserveAspectRatio="none" className="absolute inset-0 -z-10 size-full text-brand/10">
          <path d="M0 470 C 180 330, 330 300, 480 230 S 720 90, 800 40 L 800 210 C 690 260, 560 330, 430 420 S 170 600, 0 600 Z" fill="currentColor" />
        </svg>

        <p className="text-sm font-medium text-brand-strong">Restaurants · cafés · glaciers</p>
        <h1 className="mt-3 max-w-2xl text-4xl leading-[1.05] font-semibold tracking-tight text-ink sm:text-5xl">
          Plus aucune demande oubliée en salle.
        </h1>
        <p className="mt-5 max-w-xl text-base text-ink-2">
          TABILO relie chaque table à votre équipe : le client demande depuis son téléphone, le serveur prend en charge,
          le gérant supervise les délais.
        </p>

        <div className="absolute -right-24 -bottom-16 hidden origin-bottom-right -rotate-6 lg:block xl:-right-10 2xl:scale-125">
          <DashboardPreview />
        </div>
      </section>
    </main>
  );
}
