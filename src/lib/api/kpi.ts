import { PUBLIC_API_URL } from '$env/static/public';
import { get } from 'svelte/store';
import { auth } from './auth';

function headers(): Record<string, string> {
  const token = get(auth).token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchKPI<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${PUBLIC_API_URL}/api/kpi${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `KPI request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Date helpers ──────────────────────────────────────────────────────────

export function thisMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const end = now.toISOString().slice(0, 10);
  return { start, end };
}

export function ytdRange(): { start: string; end: string } {
  const now = new Date();
  return { start: `${now.getFullYear()}-01-01`, end: now.toISOString().slice(0, 10) };
}

export function lastYearRange(): { start: string; end: string } {
  const y = new Date().getFullYear() - 1;
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

// ── KPI endpoints ─────────────────────────────────────────────────────────

export interface RevenueKPI {
  start: string;
  end: string;
  property_name: string | null;
  str_revenue: number;
  ltr_revenue: number;
  cleaning_revenue: number;
  ancillary_revenue: number;
  total_revenue: number;
  revenue_per_unit: number | null;
  revenue_per_room: number | null;
  data_sources: Record<string, string>;
}

export interface FinanceKPI {
  start: string;
  end: string;
  property_name: string | null;
  total_revenue: number;
  goi: number;
  noi: number;
  operating_margin_pct: number;
  net_cash_flow: number;
  expenses?: {
    cleaning: number;
    maintenance: number;
    utilities: number;
    insurance: number;
    software: number;
    management_fees: number;
    supplies: number;
    contractors: number;
    total_operating: number;
  };
}

export interface OccupancyKPI {
  start: string;
  end: string;
  str_occupancy_pct: number | null;
  ltr_occupancy_pct: number | null;
}

export interface CollectionsKPI {
  scheduled_revenue: number;
  collected_revenue: number;
  outstanding_balance: number;
  collection_rate_pct: number | null;
  delinquency_rate_pct: number | null;
  aging_buckets: {
    bucket_0_30: number;
    bucket_31_60: number;
    bucket_61_90: number;
    bucket_90_plus: number;
    integration_status: string;
  };
}

export interface HybridKPI {
  buildings: Array<{
    building_id: string;
    building_name: string;
    building_full_name: string | null;
    str_revenue: number;
    ltr_revenue: number;
    total_revenue: number;
    str_vs_ltr_delta: number;
    winning_model: 'STR' | 'LTR' | 'TIE';
    revenue_opportunity_gap: number;
  }>;
  portfolio_str_revenue: number;
  portfolio_ltr_revenue: number;
  portfolio_total: number;
  portfolio_winning_model: 'STR' | 'LTR';
}

export interface LeasingKPI {
  total_leads: number;
  qualified_leads: number;
  application_starts: number;
  executed_leases: number;
  lead_to_qualified_rate_pct: number | null;
  application_to_lease_rate_pct: number | null;
  lead_to_lease_rate_pct: number | null;
  avg_time_to_lease_days: number | null;
  vacancy_days_to_lease: number | null;
  integration_status: Record<string, string>;
}

export interface MarketingKPI {
  total_leads: number;
  lead_source_breakdown: Array<{ source: string; count: number; pct: number }>;
  cost_per_lead: number | null;
  avg_lead_response_time_hours: number | null;
  integration_status: Record<string, string>;
}

export interface OperationsKPI {
  total_requests: number;
  completed_requests: number;
  open_requests: number;
  avg_response_time_hours: number | null;
  avg_resolution_time_hours: number | null;
  integration_status: string;
  integration_note: string;
}

export interface LaborHoursKPI {
  total_clocked_hours: number;
  total_task_hours?: number;
  utilization_rate_pct: number | null;
  integration_status: string;
  integration_note: string;
}

export interface RevenueDensityKPI {
  buildings: Array<{
    building_id: string;
    building_name: string;
    total_revenue: number;
    unit_count: number;
    room_count: number;
    total_sqft: number;
    revenue_per_unit: number | null;
    revenue_per_room: number | null;
    revenue_per_sqft: number | null;
  }>;
}

export interface LeaseAnalyticsKPI {
  average_rent_by_lease_length: Record<string, number | null>;
  lease_length_distribution: Record<string, number>;
  weighted_average_rent: number | null;
  total_leases_analyzed: number;
  integration_status: string;
}

// ── Operations types ──────────────────────────────────────────────────────

export interface Task {
  id: string;
  task_type: 'maintenance' | 'cleaning' | 'turnover' | string;
  task_category: string | null;
  property_id: string | null;
  unit_id: string | null;
  room_id: string | null;
  assigned_staff: string | null;
  priority: 'urgent' | 'high' | 'normal' | 'low' | string;
  task_status: 'open' | 'in_progress' | 'completed' | 'cancelled' | string;
  created_at: string | null;
  first_response_at: string | null;
  completed_at: string | null;
  ready_timestamp: string | null;
  tracked_minutes: number;
  notes: string | null;
  property_name: string | null;
  unit_name: string | null;
}

export interface TaskStats {
  total_requests: number;
  completed_requests: number;
  open_requests: number;
  avg_response_time_hours: number | null;
  avg_resolution_time_hours: number | null;
  max_resolution_time_hours: number | null;
  avg_turnover_hours: number | null;
  total_task_hours: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
  integration_status: string;
}

export interface ClockEvent {
  id: string;
  employee_id: string;
  employee_name: string | null;
  clock_in: string;
  clock_out: string | null;
  shift_type: string;
  pay_rate: number | null;
}

export interface LaborStats {
  total_clocked_hours: number;
  total_labor_cost: number;
  total_events: number;
  by_shift_type: Record<string, { hours: number; cost: number }>;
  by_employee: Record<string, { hours: number; cost: number }>;
  integration_status: string;
}

async function fetchOps<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const url = `${PUBLIC_API_URL}/api/operations${path}`;
  const res = await fetch(url, {
    method,
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `Operations request failed: ${res.status}`);
  }
  if (method === 'DELETE') return undefined as T;
  return res.json() as Promise<T>;
}

export const ops = {
  // Tasks
  listTasks: (params: Record<string, string | undefined> = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    return fetchOps<{ tasks: Task[]; total: number }>(`/tasks?${q}`);
  },
  createTask: (body: Partial<Task> & { task_type: string }) =>
    fetchOps<Task>('/tasks', 'POST', body),
  updateTask: (id: string, body: Partial<Task>) =>
    fetchOps<Task>(`/tasks/${id}`, 'PATCH', body),
  deleteTask: (id: string) =>
    fetchOps<void>(`/tasks/${id}`, 'DELETE'),
  taskStats: (params: Record<string, string | undefined> = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    return fetchOps<TaskStats>(`/tasks/stats?${q}`);
  },

  // Clock events
  listClockEvents: (params: Record<string, string | undefined> = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    return fetchOps<{ events: ClockEvent[]; total: number }>(`/clock-events?${q}`);
  },
  createClockEvent: (body: Omit<ClockEvent, 'id'>) =>
    fetchOps<ClockEvent>('/clock-events', 'POST', body),
  updateClockEvent: (id: string, body: Partial<ClockEvent>) =>
    fetchOps<ClockEvent>(`/clock-events/${id}`, 'PATCH', body),
  deleteClockEvent: (id: string) =>
    fetchOps<void>(`/clock-events/${id}`, 'DELETE'),
  laborStats: (params: Record<string, string | undefined> = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    return fetchOps<LaborStats>(`/clock-events/stats?${q}`);
  },

  // Reference
  staff: () => fetchOps<{ staff: string[] }>('/staff'),
  properties: () => fetchOps<{ properties: Array<{ id: string; name: string; full_name: string | null }> }>('/properties'),
};

// API call wrappers

export const kpi = {
  revenue: (start: string, end: string, opts: { building_id?: string; property_name?: string } = {}) =>
    fetchKPI<RevenueKPI>('/revenue', { start, end, ...opts }),

  finance: (start: string, end: string, opts: { building_id?: string } = {}) =>
    fetchKPI<FinanceKPI>('/finance', { start, end, ...opts }),

  occupancy: (start: string, end: string, opts: { building_id?: string } = {}) =>
    fetchKPI<OccupancyKPI>('/occupancy', { start, end, ...opts }),

  collections: (start: string, end: string, opts: { building_id?: string } = {}) =>
    fetchKPI<CollectionsKPI>('/collections', { start, end, ...opts }),

  hybrid: (start: string, end: string) =>
    fetchKPI<HybridKPI>('/hybrid', { start, end }),

  leasing: (start: string, end: string, opts: { building_id?: string } = {}) =>
    fetchKPI<LeasingKPI>('/leasing', { start, end, ...opts }),

  marketing: (start: string, end: string) =>
    fetchKPI<MarketingKPI>('/marketing', { start, end }),

  maintenance: (start: string, end: string, opts: { building_id?: string } = {}) =>
    fetchKPI<OperationsKPI>('/operations/maintenance', { start, end, ...opts }),

  housekeeping: (start: string, end: string, opts: { building_id?: string } = {}) =>
    fetchKPI<OperationsKPI>('/operations/housekeeping', { start, end, ...opts }),

  turnover: (start: string, end: string, opts: { building_id?: string } = {}) =>
    fetchKPI<OperationsKPI>('/operations/turnover', { start, end, ...opts }),

  clockedHours: (start: string, end: string) =>
    fetchKPI<LaborHoursKPI>('/labor/clocked-hours', { start, end }),

  taskHours: (start: string, end: string) =>
    fetchKPI<LaborHoursKPI & { total_task_hours: number; by_category: Record<string, number> }>('/labor/task-hours', { start, end }),

  laborUtilization: (start: string, end: string) =>
    fetchKPI<LaborHoursKPI & { clocked_labor_hours: number; task_labor_hours: number }>('/labor/utilization', { start, end }),

  laborCost: (start: string, end: string, category?: string) =>
    fetchKPI<{ total_labor_cost: number; maintenance_labor_cost: number; housekeeping_labor_cost: number; turnover_labor_cost: number; integration_status: string; integration_note: string }>('/labor/cost', { start, end, category }),

  revenueDensity: (start: string, end: string, opts: { building_id?: string } = {}) =>
    fetchKPI<RevenueDensityKPI>('/revenue-density', { start, end, ...opts }),

  leaseAnalytics: (start: string, end: string, opts: { building_id?: string } = {}) =>
    fetchKPI<LeaseAnalyticsKPI>('/lease-analytics', { start, end, ...opts }),
};
