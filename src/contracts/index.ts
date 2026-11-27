import { z } from 'zod';

/**
 * Contrats échangés avec l'API TABILO (voir /docs côté API pour la référence OpenAPI).
 * Le frontend ne dépend d'aucun type interne du backend : ces définitions lui appartiennent.
 * Les réponses du parcours client, qui arrivent d'un réseau non maîtrisé, sont validées par Zod.
 */

/** Spec 030 : `awaiting_payment` = commande à encaisser avant la préparation (« Caisse d'abord »). */
export const REQUEST_STATUSES = ['awaiting_payment', 'pending', 'assigned', 'accepted', 'in_progress', 'ready', 'resolved', 'cancelled'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type EscalationStatus = 'none' | 'escalated' | 'acknowledged';

/** Spec 030, R1 : façon de servir d'un établissement. */
export const SERVICE_MODES = ['serve_then_pay', 'pay_anytime', 'pay_first'] as const;
export type ServiceMode = (typeof SERVICE_MODES)[number];

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  mustChangePassword: boolean;
  tenant: { id: string; name: string };
  /** Specs 034 et 035 : abonnement du compte (cadenas, bandeaux). Absent d'une API plus ancienne. */
  account?: AccountInfo;
  memberships: {
    /** Spec 031, R8 : logo affiché dans le sélecteur d'établissement. */
    establishment: { id: string; name: string; timezone: string; logoImageId?: string | null };
    role: { key: string; name: string };
    permissions: string[];
  }[];
}

// ------------------------------------------------------------ abonnement (specs 034 à 037)

export type PlanKey = 'essentiel' | 'pro' | 'premium';
export type AccountState = 'trial' | 'active' | 'past_due' | 'suspended';
export type PlanFeature = 'bundles' | 'promotions' | 'yearly_stats' | 'custom_roles' | 'options' | 'exports' | 'loyalty';
export type PaymentMethod = 'cash' | 'orange_money' | 'mtn_momo' | 'moov_money' | 'wave' | 'bank_transfer';

export interface AccountInfo {
  plan: PlanKey;
  planName: string;
  state: AccountState;
  paidUntil: string;
  graceUntil: string;
  features: PlanFeature[];
  /** WhatsApp de TABILO. */
  contact: string;
  /** Spec 041, R2 : version acceptée par le compte et version en vigueur. */
  termsVersion?: string | null;
  legalVersion?: string;
}

export interface Receipt {
  id: string;
  number: string;
  amountMinor: number;
  method: PaymentMethod;
  reference: string | null;
  months: number;
  plan: PlanKey;
  planName: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  tenantName: string;
}

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  monthlyPriceMinor: number;
  limits: { establishments: number | null; tablesPerEstablishment: number | null; staffPerEstablishment: number | null };
  features: PlanFeature[];
  current: boolean;
}

export interface SubscriptionOverview {
  plan: PlanKey;
  planName: string;
  state: AccountState;
  paidUntil: string;
  graceUntil: string;
  contact: string;
  usage: Record<'establishments' | 'tables' | 'staff', { used: number; max: number | null }>;
  features: { key: PlanFeature; label: string; included: boolean; availableIn: string | null }[];
  catalog: PlanDefinition[];
  payments: Receipt[];
}

export interface PlatformTenantRow {
  id: string;
  name: string;
  plan: PlanKey;
  planName: string;
  accountState: AccountState;
  paidUntil: string;
  manuallySuspended: boolean;
  createdAt: string;
  establishments: number;
  tables: number;
  orders30d: number;
  lastActivity: string | null;
  /** Spec 041 : compte fermé, date d'effacement, effacé. */
  closedAt?: string | null;
  deleteAfter?: string | null;
  erasedAt?: string | null;
}

export interface PlatformTenantDetail extends PlatformTenantRow {
  establishmentsList: { id: string; name: string; phone: string | null; address: string | null }[];
  owners: { id: string; firstName: string; lastName: string; email: string; status: string }[];
  payments: Receipt[];
  log: { id: string; action: string; reason: string | null; adminName: string | null; createdAt: string }[];
}

/** Ligne d'une commande : nom et prix figés au moment de la commande. */
export interface OrderLine {
  /** Spec 007 : sert à afficher la photo du plat. */
  menuItemId?: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  /** Spec 032 : choix d'une formule, figés à la commande ; null pour un plat. */
  choices?: BundleChoice[] | null;
  /** Spec 038 : options choisies. */
  options?: LineOption[] | null;
  /** Spec 033 : identifiant de la ligne, prix de la carte si promotion, ligne offerte. */
  id?: string;
  listPriceMinor?: number | null;
  offeredAt?: string | null;
}

/** Spec 028 : `bill` est « L'addition », demande de facture d'un client (une par établissement). */
/** Spec 029 : `call` (appel d'un toucher) et `message` (texte du client). */
export type RequestKind = 'service' | 'order' | 'bill' | 'call' | 'message';

export interface ServiceRequest {
  id: string;
  status: RequestStatus;
  escalationStatus: EscalationStatus;
  priority: 'normal' | 'high';
  source: 'customer' | 'staff';
  note: string | null;
  /** Quantité demandée (ex. 2 bouteilles d'eau), sinon null. */
  quantity: number | null;
  table: { id: string; label: string };
  area: { id: string; name: string };
  type: { id: string; label: string; icon: string; kind: RequestKind };
  /** Lignes d'une commande ; vide pour une demande de service. */
  items: OrderLine[];
  /** Total d'une commande en unité mineure de la devise ; null pour une demande de service. */
  totalMinor: number | null;
  assignee: { id: string; firstName: string; lastName: string } | null;
  version: number;
  createdAt: string;
  dueAt: string;
  assignedAt: string | null;
  acceptedAt: string | null;
  startedAt: string | null;
  /** Spec 007 : commande signalée prête par la cuisine. */
  readyAt?: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
  escalatedAt: string | null;
  /** Spec 026 : commande servie réglée ; null = à régler (ou pas encore servie). */
  paidAt?: string | null;
  /** Spec 027, R2 : repère de la session du client ; null pour une demande créée par le personnel. */
  marker?: number | null;
  /** Spec 027, R8 : signalement de zone ; null sans zone. */
  zone?: ZoneSignal | null;
  /** Spec 027, R9 : marquée « Parti sans payer ». */
  writtenOffAt?: string | null;
  /** Spec 028, R5 : demande d'addition — montant dû du client et commandes pas encore comptées ; null sinon. */
  bill?: BillSummary | null;
}

/** Spec 028, R5 : ce que la carte « Demande d'addition » montre au personnel. */
export interface BillSummary {
  dueMinor: number;
  pendingOrders: number;
}

/** Spec 027, R8 : position du client par rapport à la zone de l'établissement, au moment de commander. */
export interface ZoneSignal {
  status: 'inside' | 'outside' | 'imprecise' | 'denied';
  distanceM: number | null;
}

export interface RequestEvent {
  id: string;
  type: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus | null;
  actorType: 'customer' | 'staff' | 'system';
  actorName: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export type ServiceRequestDetail = ServiceRequest & { events: RequestEvent[] };

export interface RequestChangedEvent {
  eventId: string;
  type: string;
  occurredAt: string;
  actorId: string | null;
  request: ServiceRequest;
}

export interface Table {
  id: string;
  label: string;
  seats: number;
  areaId: string;
  openSessions: number;
  hasActiveQr: boolean;
}

/** Vue « Tables » du gérant et du propriétaire (spec 006). */
export type TableStatus = 'occupied' | 'free';

export interface TableStatusView {
  id: string;
  label: string;
  seats: number;
  areaId: string;
  areaName: string;
  status: TableStatus;
  /** Commandes non annulées depuis l'arrivée des clients, en unité mineure. NULL si la table est libre. */
  amountMinor: number | null;
  /** Spec 026 : commandes servies non réglées de l'occupation. NULL si la table est libre. */
  unpaidMinor?: number | null;
}

/** Spec 020 : une commande de l'occupation en cours. */
export interface OccupationOrder {
  id: string;
  status: RequestStatus;
  createdAt: string;
  resolvedAt: string | null;
  /** Spec 026 : commande servie réglée, sinon null. */
  paidAt?: string | null;
  totalMinor: number;
  note: string | null;
  items: {
    id?: string;
    menuItemId: string;
    name: string;
    quantity: number;
    unitPriceMinor: number;
    imageId: string | null;
    choices?: BundleChoice[] | null;
    /** Spec 033. */
    listPriceMinor?: number | null;
    /** Spec 038. */
    options?: LineOption[] | null;
    offeredAt?: string | null;
  }[];
  /** Spec 027 : session du client ; null pour une commande saisie par le personnel. */
  sessionId?: string | null;
  /** Spec 027, R9 : marquée « Parti sans payer ». */
  writtenOffAt?: string | null;
}

/** Spec 027, R3 : un client de la table, avec son repère et ce qu'il reste à régler. */
export interface OccupationSession {
  id: string;
  marker: number;
  status: 'open' | 'settled' | 'closed' | 'expired';
  unpaidMinor: number;
}

/** Spec 020, R2 et R4 : occupation d'une table pour sa fiche. */
export interface TableOccupation {
  tableId: string;
  currency: string;
  occupiedSince: string | null;
  openSessions: number;
  amountMinor: number | null;
  /** Spec 026, R4 : servi et non réglé pendant l'occupation. */
  unpaidMinor?: number | null;
  lastOccupiedAt: string | null;
  orders: OccupationOrder[];
  /** Spec 027, R3 : clients de l'occupation, dans l'ordre d'arrivée. */
  sessions?: OccupationSession[];
}

export interface TablesOverview {
  currency: string;
  ordersToday: number;
  tables: TableStatusView[];
}

export interface Area {
  id: string;
  name: string;
  position: number;
  tables: Table[];
}

export interface QrCode {
  tableId: string;
  tableLabel: string;
  /** Spec 042 : zone (filtre) et dernière impression (null = à imprimer). */
  areaId?: string;
  printedAt?: string | null;
  areaName: string;
  url: string;
  svg: string;
  createdAt: string;
}

export interface RequestType {
  id: string;
  label: string;
  /** `order` : le type « Commande », unique, utilisé par la carte ; `bill` : « L'addition » (spec 028). Ni l'un ni l'autre ne se supprime. */
  kind: RequestKind;
  icon: string;
  priority: 'normal' | 'high';
  slaSeconds: number;
  allowNote: boolean;
  isActive: boolean;
  position: number;
}

export interface StaffMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'disabled';
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  role: { id: string; key: string; name: string };
  /** Spec 010 : permissions du rôle (bornes de l'ajustement). */
  rolePermissions: string[];
  /** Permissions effectives : rôle moins retraits. */
  permissions: string[];
  /** Permissions retirées à cet employé ; vide = rôle complet. */
  revokedPermissions: string[];
  canHandleRequests: boolean;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
  members: number;
}

export interface EscalationRule {
  id: string;
  name: string;
  trigger: 'not_accepted' | 'not_resolved';
  afterSeconds: number;
  requestTypeId: string | null;
  isActive: boolean;
}

export interface Establishment {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  address: string | null;
  phone: string | null;
  sessionTtlMinutes: number;
  maxActiveRequestsPerTable: number;
  maxRequestsPerSession: number;
  requestCooldownSeconds: number;
  /** Spec 007 : cuisine séparée, étape « Prête » des commandes. */
  separateKitchen: boolean;
  /** Spec 012, R7 : « Souvent pris avec » dans la fiche d'un plat. */
  pairingsEnabled: boolean;
  /** Spec 027, R12 : centre de la zone ; null = pas de zone. */
  zoneLatitude?: number | null;
  zoneLongitude?: number | null;
  /** Rayon de la zone, en mètres (50 à 500). */
  zoneRadiusM?: number;
  /** Délai avant l'alerte de départ sans payer, en minutes (10 à 60). */
  unpaidAlertMinutes?: number;
  /** Spec 030, R1 : façon de servir. */
  serviceMode?: ServiceMode;
  /** Spec 030, R9 : lancer la préparation dès l'envoi. */
  autoStartOrders?: boolean;
  /** Spec 031 : logo, couleur principale (clé de la palette) et mot d'accueil. */
  logoImageId?: string | null;
  brandColor?: string;
  welcomeText?: string | null;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  requestId: string | null;
  createdAt: string;
  readAt: string | null;
}

/** Spec 008 : blocs du tableau de bord pour aujourd'hui. */
export interface TodayHour {
  hour: string;
  waiting: number;
  progress: number;
  ready: number;
  resolved: number;
  cancelled: number;
}

export interface TodayTopItem {
  menuItemId: string;
  name: string;
  quantity: number;
  rank: number;
  /** Rang hier à la même heure ; null si pas commandé. */
  previousRank: number | null;
}

/** Spec 008, R7 : découpage du graphique du tableau de bord. */
export type TimelineBucket = 'month' | 'day' | 'hour';

export interface TimelinePoint {
  /** Début de la période, heure locale de l'établissement : « 2026-11-13T14:00 ». */
  period: string;
  waiting: number;
  progress: number;
  ready: number;
  resolved: number;
  cancelled: number;
}

export interface TimelineSummary {
  total: number;
  resolved: number;
  cancelled: number;
  late: number;
  escalated: number;
  medianAcceptSeconds: number | null;
  averageAcceptSeconds: number | null;
  medianResolveSeconds: number | null;
  averageResolveSeconds: number | null;
}

export interface Timeline {
  points: TimelinePoint[];
  /** Spec 008, R8 : indicateurs de toute la période choisie. */
  summary: TimelineSummary;
  /** Première année avec une demande : borne basse du filtre Année. */
  firstYear: number;
  /** Date du jour dans le fuseau de l'établissement, « 2026-11-13 ». */
  today: string;
}

export interface TimelineQuery {
  bucket: TimelineBucket;
  year: number;
  month: number;
  day: number;
}

/** Spec 009 : ventes du mois ou de l'année en cours. */
export type SalesPeriod = 'month' | 'year';

export interface SalesFigures {
  totalMinor: number;
  orders: number;
  passages: number;
  averageMinor: number | null;
  /** Spec 026, R7 : réglé pendant la période. */
  paidMinor: number;
  paidOrders: number;
  /** Spec 027, R13 : marqué « Parti sans payer » pendant la période. */
  writtenOffMinor?: number;
  writtenOffCustomers?: number;
  /** Spec 033, R7 : offert et remises de promotion, hors du total. */
  offeredMinor?: number;
  discountMinor?: number;
}

/** Spec 046, R12 : états d'un cadeau. */
export const giftStateSchema = z.enum(['wrapped', 'won', 'requested', 'used', 'expired']);
export type GiftState = z.infer<typeof giftStateSchema>;

/** Spec 046 : un cadeau du client ; le lot n'est connu qu'une fois le cadeau déballé (R9). */
export const loyaltyGiftSchema = z.object({
  id: z.string(),
  state: giftStateSchema,
  revealed: z.boolean(),
  atStamp: z.number().int(),
  unlockedAt: z.string(),
  expiresAt: z.string(),
  celebrate: z.boolean(),
  prize: z.object({ name: z.string(), imageId: z.string().nullable(), kind: z.enum(['menu_item', 'free']) }).nullable(),
});
export type LoyaltyGift = z.infer<typeof loyaltyGiftSchema>;

/** Spec 043 : carte de fidélité du client (téléphone) ; spec 046 : mode Surprise. */
export const loyaltyCardSchema = z
  .object({
    token: z.string().optional(),
    mode: z.enum(['classic', 'surprise']).default('classic'),
    stamps: z.number().int(),
    stampsRequired: z.number().int(),
    minOrderMinor: z.number().int(),
    rewardItemId: z.string().nullable(),
    surprise: z.object({ giftsReceived: z.number().int(), gifts: z.array(loyaltyGiftSchema) }).nullable().default(null),
    redemption: z.object({ id: z.string(), validated: z.boolean() }).nullable(),
  })
  .nullable();
export type LoyaltyCard = z.infer<typeof loyaltyCardSchema>;

/** Spec 043, R1 et spec 046, R1 : réglage de la carte de fidélité. */
export interface LoyaltyProgram {
  mode?: 'classic' | 'surprise';
  stampsRequired?: number;
  minOrderMinor: number;
  rewardItemId?: string | null;
  surpriseMin?: number;
  surpriseMax?: number;
  giftValidityDays?: number;
  isActive: boolean;
}

/** Spec 046, R2 : un lot du panier de cadeaux. */
export interface LoyaltyPrize {
  id: string;
  kind: 'menu_item' | 'free';
  menuItemId: string | null;
  name: string;
  imageId: string | null;
  weight: number;
  monthlyStock: number | null;
  drawnThisMonth: number;
  position: number;
}

/** Spec 043, R4 : récompense à valider ; spec 046, R10 : cadeau demandé. */
export interface LoyaltyRedemption {
  id: string;
  kind?: 'reward' | 'gift';
  prizeKind?: 'menu_item' | 'free';
  tableId: string;
  sessionId: string;
  reward: { id: string; name: string; imageId: string | null } | null;
  createdAt: string;
}

/** Spec 040, R4 : récapitulatif d'une période. */
export interface SalesSummary {
  establishment: string;
  currency: string;
  from: string;
  to: string;
  editedAt: string;
  totalMinor: number;
  orders: number;
  averageMinor: number | null;
  paidMinor: number;
  outstandingMinor: number;
  offeredMinor: number;
  discountMinor: number;
  writtenOffMinor: number;
  topProducts: { name: string; quantity: number; amountMinor: number }[];
  servers: { name: string; orders: number; amountMinor: number }[];
}

/** Spec 038, R8 bis : ventes d'une option sur la période. */
export interface OptionSale {
  menuItemId: string;
  item: string;
  group: string;
  option: string;
  quantity: number;
  amountMinor: number;
}

/** Spec 027, R9 : alerte de départ sans payer. */
export interface UnpaidAlert {
  id: string;
  table: { id: string; label: string };
  sessionId: string;
  marker: number;
  amountMinor: number;
  reason: 'inactivity' | 'released' | 'expired';
  createdAt: string;
  lastActivityAt: string;
}

export type UnpaidAlertResolution = 'paid' | 'still_here' | 'walked_out';

/** Spec 027, R13 : un client parti sans payer. */
export interface WrittenOff {
  sessionId: string | null;
  table: { id: string; label: string };
  marker: number | null;
  amountMinor: number;
  writtenOffAt: string;
  writtenOffBy: string | null;
}

export interface SalesOverview {
  currency: string;
  period: SalesPeriod;
  from: string;
  current: SalesFigures;
  previous: SalesFigures;
  /** Spec 026, R7 : servi et non réglé, toutes dates. */
  outstanding: { amountMinor: number; orders: number; tables: number };
}

export interface TodayOverview {
  hours: TodayHour[];
  topItems: TodayTopItem[];
}

export interface LiveOverview {
  pending: number;
  assigned: number;
  accepted: number;
  inProgress: number;
  late: number;
  escalated: number;
  oldestPendingSeconds: number | null;
  today: { total: number; resolved: number; medianAcceptSeconds: number | null; medianResolveSeconds: number | null };
  staff: { id: string; firstName: string; lastName: string; assigned: number; accepted: number; inProgress: number }[];
  generatedAt: string;
}

export interface Breakdown {
  id: string;
  label: string;
  total: number;
  resolved: number;
  late: number;
  medianAcceptSeconds: number | null;
  medianResolveSeconds: number | null;
  /** Montant des commandes servies (résolues), en unité mineure. */
  amountMinor: number;
}

export interface SalesSummary {
  currency: string;
  orders: number;
  amountMinor: number;
  averageMinor: number | null;
  topItems: { menuItemId: string; name: string; quantity: number; amountMinor: number }[];
}

export interface Report {
  period: { from: string; to: string; bucket: 'hour' | 'day' };
  totals: {
    total: number; pending: number; active: number; resolved: number; cancelled: number; late: number; escalated: number;
    medianAssignSeconds: number | null; medianAcceptSeconds: number | null; medianStartSeconds: number | null;
    medianResolveSeconds: number | null; averageAcceptSeconds: number | null; averageResolveSeconds: number | null;
  };
  byType: Breakdown[];
  byArea: Breakdown[];
  byTable: Breakdown[];
  byStaff: Breakdown[];
  series: { bucket: string; total: number; resolved: number; late: number; amountMinor: number }[];
  sales: SalesSummary;
}

// ------------------------------------------------------------------- carte

/** Devises proposées (liste fermée côté API). */
export const CURRENCIES = ['XOF', 'XAF', 'EUR', 'USD', 'MAD', 'GNF', 'NGN', 'GHS', 'CDF', 'TND', 'DZD', 'CAD', 'CHF', 'GBP'] as const;

/** Spec 039 : un créneau. */
const slotSchema = z.object({ days: z.array(z.number().int()), start: z.string(), end: z.string() });

/** Spec 038, R5 : une option choisie, figée sur la ligne de commande. */
export const lineOptionSchema = z.object({ group: z.string(), optionId: z.string(), name: z.string(), priceMinor: z.number().int() });
export type LineOption = z.infer<typeof lineOptionSchema>;

/** Spec 032, R5 : un choix de formule, figé sur la ligne de commande. */
export const bundleChoiceSchema = z.object({ group: z.string(), menuItemId: z.string(), name: z.string() });
export type BundleChoice = z.infer<typeof bundleChoiceSchema>;

const menuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priceMinor: z.number().int(),
  imageId: z.string().nullable(),
  isAvailable: z.boolean(),
  /** Spec 032 : formule à prix unique, un plat par rubrique. */
  isBundle: z.boolean().default(false),
  groups: z.array(z.object({ id: z.string(), name: z.string(), choiceIds: z.array(z.string()) })).default([]),
  /** Spec 033 : prix promotionnel en cours, sinon null. */
  promoPriceMinor: z.number().int().nullable().default(null),
  /** Spec 039 : créneaux de la promotion et de disponibilité (null = permanent), nom de la promotion. */
  promoSlots: z.array(slotSchema).nullable().default(null),
  promoName: z.string().nullable().default(null),
  availabilitySlots: z.array(slotSchema).nullable().default(null),
  /** Spec 038 : groupes d'options. */
  optionGroups: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        multiple: z.boolean(),
        required: z.boolean(),
        options: z.array(z.object({ id: z.string(), name: z.string(), priceMinor: z.number().int(), icon: z.string().nullable(), isAvailable: z.boolean() })),
      }),
    )
    .default([]),
});
const menuCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Pictogramme (spec 003) ; remplacé par la photo de rubrique si `imageId` existe. */
  icon: z.string(),
  imageId: z.string().nullable(),
  items: z.array(menuItemSchema),
});

export type MenuItem = z.infer<typeof menuItemSchema>;
export type MenuCategory = z.infer<typeof menuCategorySchema>;

export interface AuditEntry {
  id: string;
  action: string;
  actorName: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ------------------------------------------------------------ parcours client

const guestTypeSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string(),
  allowNote: z.boolean(),
  /** Spec 028 : « L'addition » (`bill`) se demande en glissant, depuis « Ma note ». */
  kind: z.enum(['service', 'bill', 'call', 'message']).default('service'),
});

export const guestContextSchema = z.object({
  establishment: z.object({
    /** Spec 043 : clé de rangement de la carte de fidélité (dérivée, sans identifiant interne). */
    key: z.string().default(''),
    name: z.string(),
    currency: z.string(),
    /** Spec 031 : apparence de l'établissement. */
    logoImageId: z.string().nullable().default(null),
    brandColor: z.string().default('orange'),
    welcomeText: z.string().nullable().default(null),
    /** Spec 039 : fuseau de l'établissement (créneaux). */
    timezone: z.string().default('Africa/Abidjan'),
  }),
  table: z.object({ label: z.string(), area: z.string() }),
  requestTypes: z.array(guestTypeSchema),
  menu: z.array(menuCategorySchema),
  /** La commande est ouverte : type « Commande » actif et carte non vide. */
  orderingEnabled: z.boolean(),
  /** Spec 012, R7 : rangée « Souvent pris avec » dans la fiche d'un plat. */
  pairingsEnabled: z.boolean().default(false),
  /** Spec 027, R2 : repère de la session. */
  marker: z.number().int().min(0).default(0),
  /** Spec 027, R8 : une zone existe, le téléphone donne sa position au moment de commander. */
  zone: z.boolean().default(false),
  /** Spec 030 : façon de servir (addition, « Payez à la caisse »). */
  serviceMode: z.enum(SERVICE_MODES).default('serve_then_pay'),
});
export const guestSessionSchema = guestContextSchema.extend({ token: z.string().min(32), expiresAt: z.string() });

export const guestRequestSchema = z.object({
  id: z.string(),
  status: z.enum(REQUEST_STATUSES),
  type: z.object({ id: z.string(), label: z.string(), icon: z.string(), kind: z.enum(['service', 'order', 'bill', 'call', 'message']) }),
  items: z.array(
    z.object({
      menuItemId: z.string().optional(),
      name: z.string(),
      quantity: z.number().int(),
      unitPriceMinor: z.number().int(),
      /** Spec 032 : choix d'une formule. */
      choices: z.array(bundleChoiceSchema).nullable().optional(),
      /** Spec 038 : options choisies. */
      options: z.array(lineOptionSchema).nullable().optional(),
      /** Spec 033 : ligne offerte, prix de la carte si promotion. */
      offeredAt: z.string().nullable().optional(),
      listPriceMinor: z.number().int().nullable().optional(),
    }),
  ),
  totalMinor: z.number().int().nullable(),
  quantity: z.number().int().nullable(),
  handledBy: z.string().nullable(),
  createdAt: z.string(),
  acceptedAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  /** Spec 026, R8 : commande réglée. */
  paidAt: z.string().nullable().optional(),
  /** Spec 029, R5 : le texte d'un message, rendu à son seul auteur. */
  note: z.string().nullable().optional(),
});
export const guestRequestListSchema = z.array(guestRequestSchema);
export const guestCreateResultSchema = z.object({ request: guestRequestSchema, deduplicated: z.boolean() });

export type GuestContext = z.infer<typeof guestContextSchema>;
export type GuestRequestType = z.infer<typeof guestTypeSchema>;
export type GuestRequest = z.infer<typeof guestRequestSchema>;

// ----------------------------------------------------------------- formulaires

export const PASSWORD_MIN_LENGTH = 10;
const password = z.string().min(PASSWORD_MIN_LENGTH, `Au moins ${PASSWORD_MIN_LENGTH} caractères.`).max(128);
const name = (label: string) => z.string().trim().min(1, `${label} requis.`).max(60);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.'),
  password: z.string().min(1, 'Mot de passe requis.'),
});

export const registerSchema = z.object({
  organizationName: z.string().trim().min(2, "Nom de l'entreprise requis.").max(80),
  establishmentName: z.string().trim().min(2, "Nom de l'établissement requis.").max(80),
  firstName: name('Prénom'),
  lastName: name('Nom'),
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.'),
  password,
});

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Mot de passe actuel requis.'), newPassword: password })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: "Le nouveau mot de passe doit être différent de l'ancien.",
  });

export const staffSchema = z.object({
  firstName: name('Prénom'),
  lastName: name('Nom'),
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.'),
  roleId: z.string().uuid('Choisissez un rôle.'),
  password,
});

export const tableSchema = z.object({
  label: z.string().trim().min(1, 'Nom de table requis.').max(12, '12 caractères au plus.'),
  seats: z.coerce.number().int().min(1, 'Au moins 1 couvert.').max(50),
  areaId: z.string().uuid('Choisissez une zone.'),
});

export const areaSchema = z.object({ name: z.string().trim().min(1, 'Nom de zone requis.').max(40) });

export const requestTypeSchema = z.object({
  label: z.string().trim().min(2, 'Libellé requis.').max(40),
  icon: z.string().min(1),
  priority: z.enum(['normal', 'high']),
  slaMinutes: z.coerce.number().min(0.5, 'Au moins 30 secondes.').max(60, '60 minutes au plus.'),
  allowNote: z.boolean(),
  isActive: z.boolean(),
});

export const escalationRuleSchema = z.object({
  name: z.string().trim().min(2, 'Nom requis.').max(60),
  trigger: z.enum(['not_accepted', 'not_resolved']),
  afterMinutes: z.coerce.number().min(0.5, 'Au moins 30 secondes.').max(120, '120 minutes au plus.'),
  requestTypeId: z.string().uuid().nullable(),
  isActive: z.boolean(),
});

export const establishmentSchema = z.object({
  name: z.string().trim().min(2, 'Nom requis.').max(80),
  timezone: z.string().min(1),
  currency: z.enum(CURRENCIES),
  address: z.string().trim().max(160),
  phone: z.string().trim().max(30),
  sessionTtlMinutes: z.coerce.number().int().min(15).max(720),
  maxActiveRequestsPerTable: z.coerce.number().int().min(1).max(20),
  maxRequestsPerSession: z.coerce.number().int().min(1).max(200),
  requestCooldownSeconds: z.coerce.number().int().min(0).max(300),
  separateKitchen: z.boolean(),
  pairingsEnabled: z.boolean(),
});

export const menuCategoryFormSchema = z.object({ name: z.string().trim().min(1, 'Nom de rubrique requis.').max(40, '40 caractères au plus.') });

export const menuItemFormSchema = z.object({
  categoryId: z.string().uuid('Choisissez une rubrique.'),
  name: z.string().trim().min(1, 'Nom requis.').max(60, '60 caractères au plus.'),
  description: z.string().trim().max(200, '200 caractères au plus.'),
  price: z.string().trim().min(1, 'Prix requis.'),
  isAvailable: z.boolean(),
});

/** Erreurs par champ, à partir d'un résultat Zod. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
