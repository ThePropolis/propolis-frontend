import {
  Home, Building, Book, Users, Eye, Wrench, UserCog, Boxes, LayoutGrid,
  Megaphone, MessageCircle, UserSearch, BarChart3, TrendingUp, Wallet,
  HardHat, Clock, Target, Megaphone as MegaphoneIcon, ChartNoAxesColumn
} from 'lucide-svelte';

export type Role =
  | 'owner'       // legacy → same as executive
  | 'investor'
  | 'operator'    // legacy → same as manager
  | 'executive'
  | 'director'
  | 'manager'
  | 'operations'
  | 'finance'
  | 'leasing';

export interface AppRoute {
  id: string;
  path: string;
  name: string;
  icon: any;
  description: string;
  allowedRoles: Role[];
  group?: string;
}

const EXEC_ROLES: Role[] = ['owner', 'executive', 'director'];
const ALL_ROLES: Role[] = ['owner', 'investor', 'operator', 'executive', 'director', 'manager', 'operations', 'finance', 'leasing'];
const NON_INVESTOR: Role[] = ['owner', 'executive', 'director', 'manager', 'operations', 'finance', 'leasing', 'operator'];
const FINANCIAL_ROLES: Role[] = ['owner', 'executive', 'director', 'finance', 'investor'];
const OPERATIONAL_ROLES: Role[] = ['owner', 'executive', 'director', 'manager', 'operations', 'operator'];
const LEASING_ROLES: Role[] = ['owner', 'executive', 'director', 'leasing'];

// Main navigation routes
export const routes: AppRoute[] = [
  // ── Overview ──────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    path: '/',
    name: 'Dashboard',
    icon: Home,
    description: 'Portfolio overview — revenue, NOI, occupancy, hybrid analysis',
    allowedRoles: ['owner', 'investor', 'executive', 'director'],
    group: 'Overview',
  },

  // ── KPI Dashboards ────────────────────────────────────────────────────
  {
    id: 'kpi-executive',
    path: '/kpi/executive',
    name: 'Executive KPIs',
    icon: ChartNoAxesColumn,
    description: 'Full KPI suite — revenue, profitability, STR vs LTR, trends',
    allowedRoles: [...EXEC_ROLES],
    group: 'KPI Dashboards',
  },
  {
    id: 'kpi-finance',
    path: '/kpi/finance',
    name: 'Finance KPIs',
    icon: Wallet,
    description: 'NOI, GOI, margins, cash flow, collections, delinquency',
    allowedRoles: ['owner', 'executive', 'director', 'finance'],
    group: 'KPI Dashboards',
  },
  {
    id: 'kpi-investor',
    path: '/kpi/investor',
    name: 'Investor View',
    icon: TrendingUp,
    description: 'Revenue, occupancy, NOI, cash flow, asset performance',
    allowedRoles: ['investor'],
    group: 'KPI Dashboards',
  },
  {
    id: 'kpi-operations',
    path: '/kpi/operations',
    name: 'Operations KPIs',
    icon: HardHat,
    description: 'Maintenance, housekeeping, turnover performance',
    allowedRoles: [...OPERATIONAL_ROLES],
    group: 'KPI Dashboards',
  },
  {
    id: 'kpi-labor',
    path: '/kpi/labor',
    name: 'Labor KPIs',
    icon: Clock,
    description: 'Clocked hours, task hours, utilization, labor costs',
    allowedRoles: ['owner', 'executive', 'director', 'manager', 'finance', 'operator'],
    group: 'KPI Dashboards',
  },
  {
    id: 'kpi-leasing',
    path: '/kpi/leasing',
    name: 'Leasing KPIs',
    icon: Target,
    description: 'Lead funnel, conversion rates, time to lease, vacancy days',
    allowedRoles: [...LEASING_ROLES],
    group: 'KPI Dashboards',
  },
  {
    id: 'kpi-marketing',
    path: '/kpi/marketing',
    name: 'Marketing KPIs',
    icon: MegaphoneIcon,
    description: 'Lead sources, cost per lead, campaign performance',
    allowedRoles: [...LEASING_ROLES],
    group: 'KPI Dashboards',
  },

  // ── Portfolio & Operations ─────────────────────────────────────────────
  {
    id: 'portfolio',
    path: '/portfolio',
    name: 'Portfolio',
    icon: LayoutGrid,
    description: 'Buildings, units, rooms — inventory and financials',
    allowedRoles: [...NON_INVESTOR, 'investor'],
    group: 'Portfolio',
  },
  {
    id: 'leads',
    path: '/leads',
    name: 'Leads & CRM',
    icon: UserSearch,
    description: 'CRM pipeline — source-tracked, deduplicated leads',
    allowedRoles: [...LEASING_ROLES, 'manager', 'operator'],
    group: 'Portfolio',
  },
  {
    id: 'publishing',
    path: '/publishing',
    name: 'Publishing',
    icon: Megaphone,
    description: 'Curate and publish listings from inventory',
    allowedRoles: [...EXEC_ROLES, 'leasing'],
    group: 'Portfolio',
  },
  {
    id: 'properties',
    path: '/properties',
    name: 'Properties',
    icon: Building,
    description: 'Short and long term properties overview',
    allowedRoles: [...EXEC_ROLES, 'operator', 'manager'],
    group: 'Portfolio',
  },
  {
    id: 'messages',
    path: '/messages',
    name: 'Messaging',
    icon: MessageCircle,
    description: 'Mass messaging to properties',
    allowedRoles: [...EXEC_ROLES, 'leasing', 'manager', 'operator'],
    group: 'Portfolio',
  },

  // ── Admin ─────────────────────────────────────────────────────────────
  {
    id: 'admin-users',
    path: '/admin/users',
    name: 'Admin',
    icon: UserCog,
    description: 'Manage users and roles',
    allowedRoles: [...EXEC_ROLES],
    group: 'Admin',
  },
];

export const hiddenRoutes: AppRoute[] = [
  {
    id: 'property-comparison',
    path: '/property-comparsion',
    name: 'Property Comparison',
    icon: Book,
    description: 'Compare properties and units',
    allowedRoles: [...EXEC_ROLES, 'operator', 'manager']
  },
  {
    id: 'facilities',
    path: '/facilities',
    name: 'Facilities',
    icon: Wrench,
    description: 'Unit amenities and facilities',
    allowedRoles: [...NON_INVESTOR]
  },
  {
    id: 'inventory',
    path: '/inventory',
    name: 'Inventory',
    icon: Boxes,
    description: 'Canonical buildings, units, and rooms',
    allowedRoles: [...EXEC_ROLES, 'manager', 'operator']
  },
  {
    id: 'profile',
    path: '/profile',
    name: 'Profile',
    icon: Users,
    description: 'Your profile',
    allowedRoles: ALL_ROLES
  },
  {
    id: 'login',
    path: '/login',
    name: 'Login',
    icon: Users,
    description: 'Login into the app',
    allowedRoles: ALL_ROLES
  },
  {
    id: 'building-detail',
    path: '/properties/buildings',
    name: 'Building Overview',
    icon: Building,
    description: 'Detailed view of building properties',
    allowedRoles: [...EXEC_ROLES, 'manager', 'operator']
  },
  {
    id: 'property-detail',
    path: '/properties/listings',
    name: 'Property Details',
    icon: Eye,
    description: 'Detailed view of individual property',
    allowedRoles: [...EXEC_ROLES, 'manager', 'operator']
  },
];

// Landing page for each role after login
export const roleLandingPage: Record<Role, string> = {
  owner: '/',
  executive: '/',
  director: '/kpi/executive',
  manager: '/kpi/operations',
  operations: '/kpi/operations',
  finance: '/kpi/finance',
  investor: '/kpi/investor',
  leasing: '/kpi/leasing',
  operator: '/portfolio',
};

export function isRouteAllowed(path: string, role: Role | null | undefined): boolean {
  if (!role) return false;
  if (path === '/login') return true;

  const allRoutes = [...routes, ...hiddenRoutes];
  const match =
    allRoutes.find(r => r.path === path) ||
    allRoutes.find(r => r.path !== '/' && path.startsWith(r.path + '/')) ||
    allRoutes.find(r => r.path !== '/' && path === r.path);

  if (!match) return false;
  return match.allowedRoles.includes(role as Role);
}

export function getRouteByPath(path: string) {
  if (path === '/') {
    return routes.find(route => route.path === '/');
  }
  const allRoutes = [...routes, ...hiddenRoutes];
  let route = allRoutes.find(r => r.path === path);
  if (!route) {
    route = allRoutes.find(r => r.path !== '/' && path.startsWith(r.path));
  }
  return route || {
    name: 'Not Found',
    description: 'Page not found',
    path: '/404',
    icon: null,
    allowedRoles: [] as Role[]
  };
}

export function isActiveRoute(currentPath: string, routePath: string) {
  if (routePath === '/') return currentPath === '/';
  return currentPath.startsWith(routePath);
}
