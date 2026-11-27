'use client';

import { BellRing, Clock3, LayoutGrid, QrCode, Timer, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Brand } from './brand';

type PreviewRequest = { id: number; table: string; zone: string; label: string; age: string; tone: string; status: string };

const LATE = { tone: 'bg-late-soft text-late', status: 'En retard' };
const WAIT = { tone: 'bg-wait text-wait-ink', status: 'En attente' };
const PROGRESS = { tone: 'bg-progress-soft text-progress', status: 'Pris en charge' };
const DONE = { tone: 'bg-done-soft text-done', status: 'Servie' };

/** Demandes fictives affichées au chargement (le plus récent en haut, spec 048). */
const INITIAL_REQUESTS: PreviewRequest[] = [
  { id: -1, table: 'Table 12', zone: 'Salle', label: 'Addition', age: '2 min', ...WAIT },
  { id: -2, table: 'Table 7', zone: 'Salle', label: 'De l’eau ×2', age: '3 min', ...PROGRESS },
  { id: -3, table: 'Table 2', zone: 'Terrasse', label: 'Commande', age: '4 min', ...DONE },
  { id: -4, table: 'Table 4', zone: 'Terrasse', label: 'Appel serveur', age: '6 min', ...LATE },
];

/** Demandes qui « arrivent » tour à tour pendant que la page est ouverte. */
const INCOMING = [
  { table: 'Table 9', zone: 'Terrasse', label: 'Addition' },
  { table: 'Table 3', zone: 'Salle', label: 'Appel serveur' },
  { table: 'Table 15', zone: 'Terrasse', label: 'Deux cafés' },
  { table: 'Table 6', zone: 'Salle', label: 'Commande' },
  { table: 'Table 11', zone: 'Salle', label: 'De l’eau' },
];

const ARRIVAL_EVERY_MS = 3400;
const VISIBLE_ROWS = 4;

/** Fait vivre l'aperçu : une demande arrive en haut, les autres vieillissent et avancent. */
function useLiveRequests() {
  const [{ requests, arrivals }, setState] = useState({ requests: INITIAL_REQUESTS, arrivals: 0 });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setState((current) => ({
        arrivals: current.arrivals + 1,
        requests: [
          { id: current.arrivals + 1, ...INCOMING[current.arrivals % INCOMING.length], age: 'à l’instant', ...WAIT },
          ...current.requests.slice(0, VISIBLE_ROWS - 1).map((request, index) => ({
            ...request,
            age: `${index + 1} min`,
            // La demande précédente est prise en charge, puis servie.
            ...(index === 0 ? PROGRESS : index === 1 ? DONE : {}),
          })),
        ],
      }));
    }, ARRIVAL_EVERY_MS);
    return () => window.clearInterval(timer);
  }, []);

  return { requests, arrivals, latest: arrivals > 0 ? requests[0] : null };
}

/** Aperçu décoratif de l'espace gérant, incliné dans le panneau de présentation. */
function DashboardPreview({ requests, arrivals }: { requests: PreviewRequest[]; arrivals: number }) {
  const stats = [
    { icon: BellRing, label: 'Demandes ouvertes', value: String(8 + (arrivals % 5)), ring: true },
    { icon: Timer, label: 'Délai moyen', value: '1 min 40' },
    { icon: Users, label: 'Serveurs en salle', value: '3' },
  ];
  return (
    <div className="pointer-events-none flex w-[760px] overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-line select-none">
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
            <li key={item.label} className={cn('flex items-center gap-2 rounded-md px-2 py-1.5', item.active && 'bg-brand-soft font-medium text-brand-strong')}>
              <item.icon className="size-3.5" />
              {item.label}
            </li>
          ))}
        </ul>
      </aside>
      <div className="flex-1 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-ink">Bonjour, bon service !</p>
            <p className="text-[10px] text-ink-3">Ce qui se passe en salle en ce moment</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-done-soft px-2 py-0.5 text-[10px] font-medium text-done">
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-done opacity-60" />
              <span className="relative size-1.5 rounded-full bg-done" />
            </span>
            En direct
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl p-3 ring-1 ring-line">
              {/* La cloche sonne à chaque nouvelle demande. */}
              <stat.icon key={stat.ring ? `icon-${arrivals}` : undefined} className={cn('size-3.5 text-brand', stat.ring && arrivals > 0 && 'animate-[call-ring_1.2s_ease-in-out]')} />
              <p className="mt-2 text-[10px] text-ink-3">{stat.label}</p>
              <p key={stat.ring ? `value-${arrivals}` : undefined} className={cn('tabular text-base font-semibold text-ink', stat.ring && arrivals > 0 && 'animate-number-in')}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-[11px] font-semibold text-ink">Demandes en cours</p>
        <ul className="mt-2 divide-y divide-line rounded-xl ring-1 ring-line">
          {requests.map((request, index) => (
            <li
              key={request.id}
              className={cn('flex items-center gap-3 px-3 py-2.5 text-[11px]', index === 0 && arrivals > 0 && 'animate-item-in bg-brand-soft/40')}
            >
              <span className="w-16 font-medium text-ink">{request.table}</span>
              <span className="w-16 text-ink-3">{request.zone}</span>
              <span className="flex-1 text-ink-2">{request.label}</span>
              <span className="tabular w-14 text-ink-3">{request.age}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors duration-500', request.tone, request.status === LATE.status && 'animate-attention')}>
                {request.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Notification flottante qui annonce la dernière demande arrivée. */
function ArrivalToast({ request }: { request: PreviewRequest }) {
  return (
    <div
      key={request.id}
      className="pointer-events-none flex animate-[showcase-toast_3.2s_var(--ease-spring)_both] items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-pop ring-1 ring-line select-none"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-white">
        <BellRing className="size-4 animate-[call-ring_1.2s_ease-in-out_200ms]" />
      </span>
      <span>
        <span className="block text-[13px] font-semibold text-ink">
          {request.table} · {request.label}
        </span>
        <span className="block text-[11px] text-ink-3">{request.zone} · à l’instant</span>
      </span>
    </div>
  );
}

/** Panneau de présentation animé des écrans de connexion, d'inscription et de nouveau mot de passe. */
export function AuthShowcase() {
  const { requests, arrivals, latest } = useLiveRequests();
  return (
    <section className="relative isolate flex flex-col overflow-hidden rounded-3xl bg-brand-soft px-8 pt-16 pb-10 lg:col-span-2 lg:min-h-[560px] lg:px-12 lg:pt-[18vh]">
      {/* Vagues décoratives qui ondulent lentement */}
      <svg aria-hidden viewBox="0 0 800 600" preserveAspectRatio="none" className="absolute inset-0 -z-10 size-full text-brand/10">
        <path
          className="origin-bottom-left animate-[showcase-wave_14s_ease-in-out_infinite]"
          d="M0 470 C 180 330, 330 300, 480 230 S 720 90, 800 40 L 800 210 C 690 260, 560 330, 430 420 S 170 600, 0 600 Z"
          fill="currentColor"
        />
        <path
          className="origin-bottom-right animate-[showcase-wave_18s_ease-in-out_-6s_infinite_reverse]"
          d="M0 560 C 220 470, 420 450, 600 360 S 760 250, 800 230 L 800 600 L 0 600 Z"
          fill="currentColor"
          opacity="0.6"
        />
      </svg>
      {/* Halo lumineux qui se déplace */}
      <div aria-hidden className="absolute -top-24 -left-24 -z-10 size-96 animate-[showcase-glow_16s_ease-in-out_infinite] rounded-full bg-white/50 blur-3xl" />

      <p className="animate-page-in text-sm font-medium text-brand-strong">Restaurants · cafés · glaciers</p>
      <h1 className="mt-3 max-w-2xl animate-page-in text-4xl leading-[1.05] font-semibold tracking-tight text-ink [animation-delay:80ms] sm:text-5xl">
        Plus aucune demande oubliée en salle.
      </h1>
      <p className="mt-5 max-w-xl animate-page-in text-base text-ink-2 [animation-delay:160ms]">
        TABILO relie chaque table à votre équipe : le client demande depuis son téléphone, le serveur prend en charge,
        le gérant supervise les délais.
      </p>

      <div aria-hidden className="absolute -right-24 -bottom-16 hidden origin-bottom-right -rotate-6 lg:block xl:-right-10 2xl:scale-125">
        <div className="animate-[showcase-enter_900ms_var(--ease-apple)_300ms_both]">
          <div className="animate-[showcase-float_7s_ease-in-out_1.2s_infinite]">
            <DashboardPreview requests={requests} arrivals={arrivals} />
          </div>
        </div>
        <div className="absolute -top-20 left-24">{latest && <ArrivalToast key={latest.id} request={latest} />}</div>
      </div>
    </section>
  );
}
