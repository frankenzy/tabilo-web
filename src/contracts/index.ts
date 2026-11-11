import { z } from 'zod';

/**
 * Contrats échangés avec l'API TABILO (voir /docs côté API pour la référence OpenAPI).
 * Le frontend ne dépend d'aucun type interne du backend : ces définitions lui appartiennent.
 * Les réponses du parcours client, qui arrivent d'un réseau non maîtrisé, sont validées par Zod.
 */

export const REQUEST_STATUSES = ['pending', 'assigned', 'accepted', 'in_progress', 'resolved', 'cancelled'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type EscalationStatus = 'none' | 'escalated' | 'acknowledged';

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
  memberships: {
    establishment: { id: string; name: string; timezone: string };
    role: { key: string; name: string };
    permissions: string[];
  }[];
}

/** Ligne d'une commande : nom et prix figés au moment de la commande. */
export interface OrderLine {
  name: string;
  quantity: number;
  unitPriceMinor: number;
}

export type RequestKind = 'service' | 'order';

export interface ServiceRequest {
  id: string;
  status: RequestStatus;
  escalationStatus: EscalationStatus;
  priority: 'normal' | 'high';
  source: 'customer' | 'staff';
  note: string | null;
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
  resolvedAt: string | null;
  cancelledAt: string | null;
  escalatedAt: string | null;
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

export interface Area {
  id: string;
  name: string;
  position: number;
  tables: Table[];
}

export interface QrCode {
  tableId: string;
  tableLabel: string;
  areaName: string;
  url: string;
  svg: string;
  createdAt: string;
}

export interface RequestType {
  id: string;
  label: string;
  /** `order` : le type « Commande », unique, utilisé par la carte. Il ne se supprime pas. */
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

const menuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priceMinor: z.number().int(),
  imageId: z.string().nullable(),
  isAvailable: z.boolean(),
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

const guestTypeSchema = z.object({ id: z.string(), label: z.string(), icon: z.string(), allowNote: z.boolean() });

export const guestContextSchema = z.object({
  establishment: z.object({ name: z.string(), currency: z.string() }),
  table: z.object({ label: z.string(), area: z.string() }),
  requestTypes: z.array(guestTypeSchema),
  menu: z.array(menuCategorySchema),
  /** La commande est ouverte : type « Commande » actif et carte non vide. */
  orderingEnabled: z.boolean(),
});
export const guestSessionSchema = guestContextSchema.extend({ token: z.string().min(32), expiresAt: z.string() });

export const guestRequestSchema = z.object({
  id: z.string(),
  status: z.enum(REQUEST_STATUSES),
  type: z.object({ id: z.string(), label: z.string(), icon: z.string(), kind: z.enum(['service', 'order']) }),
  items: z.array(z.object({ name: z.string(), quantity: z.number().int(), unitPriceMinor: z.number().int() })),
  totalMinor: z.number().int().nullable(),
  handledBy: z.string().nullable(),
  createdAt: z.string(),
  acceptedAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
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
