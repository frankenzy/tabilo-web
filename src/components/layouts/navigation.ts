import {
  Armchair, BarChart3, BookOpen, ConciergeBell, CookingPot, History, LayoutDashboard, ScrollText, Settings, Users, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Affiché si l'utilisateur détient au moins une de ces permissions. */
  anyOf: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/app/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, anyOf: ['analytics.read'] },
  { href: '/app/tables', label: 'Tables', icon: Armchair, anyOf: ['analytics.read'] },
  { href: '/app/commandes', label: 'Commandes', icon: CookingPot, anyOf: ['requests.handle'] },
  { href: '/app/carte', label: 'Menus', icon: BookOpen, anyOf: ['requests.read'] },
  { href: '/app/service', label: 'Service', icon: ConciergeBell, anyOf: ['requests.read'] },
  { href: '/app/equipe', label: 'Employés', icon: Users, anyOf: ['staff.manage'] },
  { href: '/app/statistiques', label: 'Rapport', icon: BarChart3, anyOf: ['analytics.read'] },
  { href: '/app/parametres', label: 'Paramètres', icon: Settings, anyOf: ['establishment.update', 'request_types.manage', 'escalation.manage'] },
  { href: '/app/demandes', label: 'Historique', icon: History, anyOf: ['requests.read'] },
  { href: '/app/journal', label: 'Journal', icon: ScrollText, anyOf: ['audit.read'] },
];

export function visibleNav(permissions: string[]): NavItem[] {
  return NAV_ITEMS.filter((item) => item.anyOf.some((permission) => permissions.includes(permission)));
}
