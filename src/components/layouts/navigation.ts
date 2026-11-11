import {
  BarChart3, BookOpen, ConciergeBell, History, LayoutDashboard, ScrollText, Settings, Users, Utensils, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Affiché si l'utilisateur détient au moins une de ces permissions. */
  anyOf: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/app/service', label: 'Service', icon: ConciergeBell, anyOf: ['requests.read'] },
  { href: '/app/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, anyOf: ['analytics.read'] },
  { href: '/app/demandes', label: 'Historique', icon: History, anyOf: ['requests.read'] },
  { href: '/app/salle', label: 'Salle', icon: Utensils, anyOf: ['floor.read'] },
  { href: '/app/carte', label: 'Carte', icon: BookOpen, anyOf: ['requests.read'] },
  { href: '/app/equipe', label: 'Équipe', icon: Users, anyOf: ['staff.manage'] },
  { href: '/app/statistiques', label: 'Statistiques', icon: BarChart3, anyOf: ['analytics.read'] },
  { href: '/app/parametres', label: 'Paramètres', icon: Settings, anyOf: ['establishment.update', 'request_types.manage', 'escalation.manage'] },
  { href: '/app/journal', label: 'Journal', icon: ScrollText, anyOf: ['audit.read'] },
];

export function visibleNav(permissions: string[]): NavItem[] {
  return NAV_ITEMS.filter((item) => item.anyOf.some((permission) => permissions.includes(permission)));
}
