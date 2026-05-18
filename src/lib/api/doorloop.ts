import type { DoorloopLeaseTenancyResponse } from '../types/doorloop';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface DoorloopOccupancyResponse {
  occupancy_rate: number;
  occupied_units: number;
  total_units: number;
  date_from: string;
  date_to: string;
  percentage: string;
  occupancy_rate_binary?: number;
  occupancy_rate_prorated?: number;
  occupied_units_binary?: number;
  occupied_units_prorated?: number;
}

export interface DoorloopTenantTurnoverResponse {
  'number of tenants moved': number;
  'number of tenants': number;
  'tenant turnover rate': number;
}

export interface DoorloopBalanceDueResponse {
  totalBalance: number;
}

export interface DoorloopTimeToLeaseResponse {
  time_to_lease_days: number;
  total_days_to_lease: number;
  number_of_leases_signed: number;
  skipped_leases: number;
}

export async function getDoorloopOccupancyRate(
  startDate?: string,
  endDate?: string,
  propertyId?: string
): Promise<DoorloopOccupancyResponse> {
  const url = new URL(`${API_URL}/api/doorloop/occupancy-rate-doorloop`);
  if (startDate) url.searchParams.append('date_from', startDate);
  if (endDate) url.searchParams.append('date_to', endDate);
  if (propertyId) url.searchParams.append('property_id', propertyId);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch Doorloop occupancy rate: ${res.statusText}`);
  return res.json();
}

export async function getDoorloopAverageLeaseTenancy(
  startDate?: string,
  endDate?: string,
  propertyId?: string
): Promise<DoorloopLeaseTenancyResponse> {
  const url = new URL(`${API_URL}/api/doorloop/average-lease-tenancy`);
  if (startDate) url.searchParams.append('date_from', startDate);
  if (endDate) url.searchParams.append('date_to', endDate);
  if (propertyId) url.searchParams.append('property_id', propertyId);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch Doorloop average lease tenancy: ${res.statusText}`);
  return res.json();
}

export async function getDoorloopTenantTurnoverRate(
  startDate?: string,
  endDate?: string,
  propertyId?: string
): Promise<DoorloopTenantTurnoverResponse> {
  const url = new URL(`${API_URL}/api/doorloop/tenant_turnover_rate`);
  if (startDate) url.searchParams.append('date_from', startDate);
  if (endDate) url.searchParams.append('date_to', endDate);
  if (propertyId) url.searchParams.append('property_id', propertyId);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch Doorloop tenant turnover rate: ${res.statusText}`);
  return res.json();
}

export async function getDoorloopBalanceDue(
  startDate?: string,
  endDate?: string,
  propertyId?: string
): Promise<DoorloopBalanceDueResponse> {
  const url = new URL(`${API_URL}/api/doorloop/balance_due`);
  if (startDate) url.searchParams.append('date_from', startDate);
  if (endDate) url.searchParams.append('date_to', endDate);
  if (propertyId) url.searchParams.append('property_id', propertyId);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch Doorloop balance due: ${res.statusText}`);
  return res.json();
}

export async function getDoorloopTimeToLease(
  startDate: string,
  endDate: string,
  propertyId?: string
): Promise<DoorloopTimeToLeaseResponse> {
  const url = new URL(`${API_URL}/api/doorloop/time_to_lease`);
  url.searchParams.append('date_from', startDate);
  url.searchParams.append('date_to', endDate);
  if (propertyId) url.searchParams.append('property_id', propertyId);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch Doorloop time to lease: ${res.statusText}`);
  return res.json();
}
