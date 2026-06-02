import {
  Home,
  Building,
  Book,
  Users,
  Eye,
  Wrench,
  UserCog,
  Boxes,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  type LucideIcon
} from 'lucide-react';

export type Role = 'owner' | 'investor' | 'operator';

export interface AppRoute {
  id: string;
  path: string;
  name: string;
  icon: LucideIcon;
  description: string;
  allowedRoles: Role[];
}

export const routes: AppRoute[] = [
  {
    id: 'dashboard',
    path: '/',
    name: 'Dashboard',
    icon: Home,
    description: 'Main dashboard overview',
    allowedRoles: ['owner', 'investor']
  },
  {
    id: 'properties',
    path: '/properties',
    name: 'Properties',
    icon: Building,
    description: 'Short and long term properties overview',
    allowedRoles: ['owner']
  },
  {
    id: 'portfolio',
    path: '/portfolio',
    name: 'New Properties Page',
    icon: LayoutGrid,
    description: 'Unified buildings, units, rooms, financials',
    allowedRoles: ['owner', 'investor', 'operator']
  },
  {
    id: 'publishing',
    path: '/publishing',
    name: 'Publishing',
    icon: Megaphone,
    description: 'Curate and publish listings from inventory',
    allowedRoles: ['owner']
  },
  {
    id: 'messages',
    path: '/messages',
    name: 'Mass Messaging',
    icon: MessageCircle,
    description: 'Message the properties',
    allowedRoles: ['owner']
  },
  {
    id: 'admin-users',
    path: '/admin/users',
    name: 'Admin',
    icon: UserCog,
    description: 'Manage users and roles',
    allowedRoles: ['owner']
  }
];

export const hiddenRoutes: AppRoute[] = [
  {
    id: 'property-comparison',
    path: '/property-comparsion',
    name: 'Property Comparison',
    icon: Book,
    description: 'Compare properties and units',
    allowedRoles: ['owner']
  },
  {
    id: 'facilities',
    path: '/facilities',
    name: 'Facilities',
    icon: Wrench,
    description: 'Unit amenities and facilities',
    allowedRoles: ['owner', 'operator']
  },
  {
    id: 'inventory',
    path: '/inventory',
    name: 'Inventory',
    icon: Boxes,
    description: 'Legacy — canonical buildings, units, and rooms',
    allowedRoles: ['owner']
  },
  {
    id: 'profile',
    path: '/profile',
    name: 'Profile',
    icon: Users,
    description: 'Your profile',
    allowedRoles: ['owner', 'investor', 'operator']
  },
  {
    id: 'login',
    path: '/login',
    name: 'Login',
    icon: Users,
    description: 'Login into the app',
    allowedRoles: ['owner', 'investor', 'operator']
  },
  {
    id: 'building-detail',
    path: '/properties/buildings',
    name: 'Building Overview',
    icon: Building,
    description: 'Detailed view of building properties',
    allowedRoles: ['owner']
  },
  {
    id: 'property-detail',
    path: '/properties/listings',
    name: 'Property Details',
    icon: Eye,
    description: 'Detailed view of individual property',
    allowedRoles: ['owner']
  }
];

export const roleLandingPage: Record<Role, string> = {
  owner: '/',
  investor: '/',
  operator: '/portfolio'
};

export function isRouteAllowed(path: string, role: Role | null | undefined): boolean {
  if (!role) return false;
  if (path === '/login') return true;

  const allRoutes = [...routes, ...hiddenRoutes];
  const match =
    allRoutes.find((r) => r.path === path) ||
    allRoutes.find((r) => r.path !== '/' && path.startsWith(r.path + '/')) ||
    allRoutes.find((r) => r.path !== '/' && path === r.path);

  if (!match) return false;
  return match.allowedRoles.includes(role as Role);
}

export function getRouteByPath(path: string): AppRoute | undefined {
  if (path === '/') return routes.find((r) => r.path === '/');
  const allRoutes = [...routes, ...hiddenRoutes];
  return (
    allRoutes.find((r) => r.path === path) ||
    allRoutes.find((r) => r.path !== '/' && path.startsWith(r.path))
  );
}

export function isActiveRoute(currentPath: string, routePath: string): boolean {
  if (routePath === '/') return currentPath === '/';
  return currentPath.startsWith(routePath);
}
