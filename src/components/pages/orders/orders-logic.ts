import type { MenuCategory, ServiceRequest } from '@/contracts';
import type { RequestAction } from '@/services/api';
import type { Viewer } from '@/components/pages/requests/capabilities';

/** Spec 007 : étapes d'une commande en cours. « Prêtes » n'existe qu'avec une cuisine séparée. */
export type OrderColumn = 'todo' | 'preparing' | 'ready';

export const COLUMN_LABELS: Record<OrderColumn, string> = {
  todo: 'À préparer',
  preparing: 'En préparation',
  ready: 'Prêtes',
};

export function columnsFor(separateKitchen: boolean): OrderColumn[] {
  return separateKitchen ? ['todo', 'preparing', 'ready'] : ['todo', 'preparing'];
}

/** Spec 007, R2 : seulement les commandes passées depuis la carte, pas les appels. */
export function isOrder(request: Pick<ServiceRequest, 'type'>): boolean {
  return request.type.kind === 'order';
}

export function columnOf(request: Pick<ServiceRequest, 'status'>): OrderColumn | null {
  switch (request.status) {
    case 'pending':
    case 'assigned':
    case 'accepted':
      return 'todo';
    case 'in_progress':
      return 'preparing';
    case 'ready':
      return 'ready';
    default:
      return null;
  }
}

/** Commandes actives rangées par étape, la plus ancienne en premier : sert aux compteurs du filtre « État ». */
export function groupOrders(requests: ServiceRequest[], separateKitchen: boolean): Record<OrderColumn, ServiceRequest[]> {
  const groups: Record<OrderColumn, ServiceRequest[]> = { todo: [], preparing: [], ready: [] };
  requests
    .filter(isOrder)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((request) => {
      const column = columnOf(request);
      // Réglage désactivé après coup : une commande déjà prête reste visible, avec « Servie ».
      if (column === 'ready' && !separateKitchen) groups.preparing.push(request);
      else if (column) groups[column].push(request);
    });
  return groups;
}

/** Spec 007, R5 : la couleur suit l'état de la commande (rouge à préparer, orange en préparation, vert prête). */
export type StepTone = 'red' | 'orange' | 'violet' | 'green';

export interface OrderStep {
  action: RequestAction;
  label: 'Préparer' | 'Prête' | 'Servie';
  tone: StepTone;
}

export function nextStep(request: ServiceRequest, separateKitchen: boolean, viewer: Viewer): OrderStep | null {
  if (!viewer.can('requests.handle')) return null;
  const mine = request.assignee?.id === viewer.id;
  const supervise = viewer.can('requests.assign');
  switch (request.status) {
    case 'pending':
      return { action: 'prepare', label: 'Préparer', tone: 'red' };
    case 'assigned':
    case 'accepted':
      // Déjà prise par un autre : le serveur répondrait « Déjà prise par … ».
      return mine ? { action: 'prepare', label: 'Préparer', tone: 'red' } : null;
    case 'in_progress':
      if (!mine && !supervise) return null;
      return separateKitchen ? { action: 'ready', label: 'Prête', tone: 'orange' } : { action: 'resolve', label: 'Servie', tone: 'orange' };
    case 'ready':
      // Le serveur qui sert n'est pas forcément celui qui a préparé.
      return { action: 'resolve', label: 'Servie', tone: 'green' };
    default:
      return null;
  }
}

/** Image d'un plat : sa photo, sinon l'image de sa rubrique (photo ou pictogramme). */
export interface DishImage {
  imageId: string | null;
  icon: string;
}

export function dishImages(menu: MenuCategory[] | undefined): Map<string, DishImage> {
  const map = new Map<string, DishImage>();
  (menu ?? []).forEach((category) =>
    category.items.forEach((item) => map.set(item.id, { imageId: item.imageId ?? category.imageId, icon: category.icon })),
  );
  return map;
}

/** Minuit, heure de l'appareil : début de l'onglet « Servies » (R10). */
export function startOfToday(now: number): string {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/** Pastille d'état de la carte (R4), même couleur que le bouton d'étape (R5). */
/** Spec 023, Q2 : « Prête » en violet ; le vert reste au bouton « Servie », qui mène à l'état « Servie ». */
export const COLUMN_TONE: Record<OrderColumn, StepTone> = { todo: 'red', preparing: 'orange', ready: 'violet' };
export const STATUS_PILL: Record<OrderColumn, string> = { todo: 'À préparer', preparing: 'En préparation', ready: 'Prête' };

/** Spec 007, R11 : recherche et filtres de l'écran « Commandes ». */
export type WhoFilter = 'all' | 'mine' | 'nobody';

export interface OrderFilters {
  query: string;
  /** Filtre « État » (R11), pour les commandes en cours seulement. */
  status: OrderColumn | 'all';
  areaId: string | 'all';
  who: WhoFilter;
}

export const NO_FILTERS: OrderFilters = { query: '', status: 'all', areaId: 'all', who: 'all' };

const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export function hasFilters(filters: OrderFilters): boolean {
  return filters.query.trim() !== '' || filters.status !== 'all' || filters.areaId !== 'all' || filters.who !== 'all';
}

/** Recherche sur la table, les plats et la note ; zone et « qui » se combinent avec elle. */
export function filterOrders<T extends Pick<ServiceRequest, 'table' | 'area' | 'items' | 'note' | 'assignee'>>(
  requests: T[],
  filters: OrderFilters,
  viewerId: string,
): T[] {
  const needle = fold(filters.query);
  return requests.filter((request) => {
    if (filters.areaId !== 'all' && request.area.id !== filters.areaId) return false;
    if (filters.who === 'mine' && request.assignee?.id !== viewerId) return false;
    if (filters.who === 'nobody' && request.assignee) return false;
    if (!needle) return true;
    const haystack = fold([request.table.label, ...request.items.map((line) => line.name), request.note ?? ''].join(' '));
    return haystack.includes(needle);
  });
}

/**
 * Spec 007, R3 : une seule grille, toutes étapes mêlées, la plus ancienne en premier.
 * Le filtre « État » garde seulement l'étape choisie.
 */
export function liveGrid(groups: Record<OrderColumn, ServiceRequest[]>, status: OrderColumn | 'all'): ServiceRequest[] {
  if (status !== 'all') return groups[status];
  return [...groups.todo, ...groups.preparing, ...groups.ready].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
