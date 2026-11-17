import {
  Accessibility, Baby, Bell, Coffee, Droplet, Flame, IceCreamCone, LifeBuoy, MessageCircle, Receipt,
  ShoppingBag, Sparkles, Utensils, Wine, type LucideIcon,
} from 'lucide-react';
import type { RequestStatus } from '@/contracts';

/** Icônes des types de demande. Les clés sont celles acceptées par l'API. */
export const REQUEST_ICONS: Record<string, LucideIcon> = {
  bell: Bell,
  droplet: Droplet,
  receipt: Receipt,
  'life-buoy': LifeBuoy,
  'message-circle': MessageCircle,
  utensils: Utensils,
  coffee: Coffee,
  'ice-cream': IceCreamCone,
  wine: Wine,
  sparkles: Sparkles,
  baby: Baby,
  accessibility: Accessibility,
  flame: Flame,
  'shopping-bag': ShoppingBag,
};

export const ICON_LABELS: Record<string, string> = {
  bell: 'Cloche', droplet: 'Eau', receipt: 'Addition', 'life-buoy': 'Assistance', 'message-circle': 'Message',
  utensils: 'Couverts', coffee: 'Café', 'ice-cream': 'Glace', wine: 'Vin', sparkles: 'Nettoyage', baby: 'Enfant',
  accessibility: 'Accessibilité', flame: 'Urgent', 'shopping-bag': 'À emporter',
};

export function requestIcon(key: string): LucideIcon {
  return REQUEST_ICONS[key] ?? Bell;
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'En attente',
  assigned: 'Affectée',
  accepted: 'Acceptée',
  in_progress: 'En cours',
  ready: 'Prête',
  resolved: 'Résolue',
  cancelled: 'Annulée',
};

export const STATUS_TONE: Record<RequestStatus, 'neutral' | 'wait' | 'progress' | 'done' | 'muted'> = {
  pending: 'wait',
  assigned: 'wait',
  accepted: 'progress',
  in_progress: 'progress',
  ready: 'done',
  resolved: 'done',
  cancelled: 'muted',
};

export const EVENT_LABELS: Record<string, string> = {
  'request.created': 'Demande créée',
  'request.assigned': 'Affectée',
  'request.accepted': 'Acceptée',
  'request.started': 'Traitement commencé',
  'request.ready': 'Commande prête',
  'request.resolved': 'Résolue',
  'request.cancelled': 'Annulée',
  'request.transferred': 'Transférée',
  'request.released': 'Remise en attente',
  'request.escalated': 'Escaladée',
  'request.escalation_acknowledged': 'Escalade acquittée',
  // Spec 026 : commande servie réglée.
  'request.paid': 'Réglée',
};

export const AUDIT_LABELS: Record<string, string> = {
  'tenant.registered': 'Compte créé',
  'auth.login': 'Connexion',
  'auth.password_changed': 'Mot de passe modifié',
  'security.login_failed': 'Échec de connexion',
  'security.login_locked': 'Connexion sur compte verrouillé',
  'security.account_locked': 'Compte verrouillé',
  'security.refresh_token_reuse': 'Session compromise révoquée',
  'security.permission_denied': 'Accès refusé',
  'establishment.created': 'Établissement créé',
  'establishment.updated': 'Établissement modifié',
  'area.created': 'Zone créée',
  'area.updated': 'Zone modifiée',
  'area.archived': 'Zone archivée',
  'table.created': 'Table créée',
  'table.updated': 'Table modifiée',
  'table.archived': 'Table archivée',
  'qr.regenerated': 'QR code régénéré',
  'sessions.closed': 'Sessions de table fermées',
  'request_type.created': 'Type de demande créé',
  'request_type.updated': 'Type de demande modifié',
  'request_type.archived': 'Type de demande archivé',
  'staff.created': 'Membre ajouté',
  'staff.updated': 'Membre modifié',
  'role.created': 'Rôle créé',
  'role.updated': 'Rôle modifié',
  'role.deleted': 'Rôle supprimé',
  'escalation_rule.created': "Règle d'escalade créée",
  'escalation_rule.updated': "Règle d'escalade modifiée",
  'escalation_rule.archived': "Règle d'escalade archivée",
};
