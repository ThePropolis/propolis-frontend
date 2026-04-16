import { PUBLIC_API_URL } from '$env/static/public';
import type { DoorloopLeaseTenancyResponse } from '../types/doorloop';

export interface DoorloopOccupancyResponse {
  occupancy_rate: number;
  occupied_units: number;
  total_units: number;
  date_from: string;
  date_to: string;
  percentage: string;
  // Both calculation methods exposed for dashboards that show them side-by-side.
  // binary = any lease overlap in the period counts as 100% occupied (matches DoorLoop UI)
  // prorated = days-of-coverage / total-days (more accurate for partial months)
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

/**
 * Fetch Doorloop occupancy rate for long-term rentals
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Promise<DoorloopOccupancyResponse>
 */
export async function getDoorloopOccupancyRate(
  startDate?: string,
  endDate?: string,
  propertyId?: string,
): Promise<DoorloopOccupancyResponse> {
  const url = new URL(`${PUBLIC_API_URL}/api/doorloop/occupancy-rate-doorloop`);
  
  if (startDate) {
    url.searchParams.append('date_from', startDate);
  }
  
  if (endDate) {
    url.searchParams.append('date_to', endDate);
  }

  if (propertyId) {
    url.searchParams.append('property_id', propertyId);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Doorloop occupancy rate: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch Doorloop average lease tenancy data
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param propertyId - Optional property ID to filter by
 * @returns Promise<DoorloopLeaseTenancyResponse>
 */
export async function getDoorloopAverageLeaseTenancy(
  startDate?: string,
  endDate?: string,
  propertyId?: string,
): Promise<DoorloopLeaseTenancyResponse> {
  const url = new URL(`${PUBLIC_API_URL}/api/doorloop/average-lease-tenancy`);
  
  if (startDate) {
    url.searchParams.append('date_from', startDate);
  }
  
  if (endDate) {
    url.searchParams.append('date_to', endDate);
  }

  if (propertyId) {
    url.searchParams.append('property_id', propertyId);
  }

  console.log('🔍 Lease Tenancy API Call:', {
    url: url.toString(),
    startDate,
    endDate,
    propertyId
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Doorloop average lease tenancy: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('🔍 Lease Tenancy API Response:', data);
  
  return data;
}

/**
 * Fetch Doorloop tenant turnover rate data
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param propertyId - Optional property ID to filter by
 * @returns Promise<DoorloopTenantTurnoverResponse>
 */
export async function getDoorloopTenantTurnoverRate(
  startDate?: string,
  endDate?: string,
  propertyId?: string,
): Promise<DoorloopTenantTurnoverResponse> {
  const url = new URL(`${PUBLIC_API_URL}/api/doorloop/tenant_turnover_rate`);
  
  if (startDate) {
    url.searchParams.append('date_from', startDate);
  }
  
  if (endDate) {
    url.searchParams.append('date_to', endDate);
  }

  if (propertyId) {
    url.searchParams.append('property_id', propertyId);
  }

  console.log('🔍 Tenant Turnover API Call:', {
    url: url.toString(),
    startDate,
    endDate,
    propertyId
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Doorloop tenant turnover rate: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('🔍 Tenant Turnover API Response:', data);
  
  return data;
}

/**
 * Fetch Doorloop balance due data
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param propertyId - Optional property ID to filter by
 * @returns Promise<DoorloopBalanceDueResponse>
 */
export async function getDoorloopBalanceDue(
  startDate?: string,
  endDate?: string,
  propertyId?: string,
): Promise<DoorloopBalanceDueResponse> {
  const url = new URL(`${PUBLIC_API_URL}/api/doorloop/balance_due`);
  
  if (startDate) {
    url.searchParams.append('date_from', startDate);
  }
  
  if (endDate) {
    url.searchParams.append('date_to', endDate);
  }

  if (propertyId) {
    url.searchParams.append('property_id', propertyId);
  }

  console.log('🔍 Balance Due API Call:', {
    url: url.toString(),
    startDate,
    endDate,
    propertyId
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Doorloop balance due: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('🔍 Balance Due API Response:', data);
  console.log('🔍 Balance Due API Response - totalBalance:', data?.totalBalance);
  console.log('🔍 Balance Due API Response - full object:', JSON.stringify(data, null, 2));
  
  return data;
}

/**
 * Fetch Doorloop time to lease data
 * @param startDate - Start date in YYYY-MM-DD format (required)
 * @param endDate - End date in YYYY-MM-DD format (required)
 * @param propertyId - Optional property ID to filter by
 * @returns Promise<DoorloopTimeToLeaseResponse>
 */
export async function getDoorloopTimeToLease(
  startDate: string,
  endDate: string,
  propertyId?: string,
): Promise<DoorloopTimeToLeaseResponse> {
  const url = new URL(`${PUBLIC_API_URL}/api/doorloop/time_to_lease`);
  
  url.searchParams.append('date_from', startDate);
  url.searchParams.append('date_to', endDate);

  if (propertyId) {
    url.searchParams.append('property_id', propertyId);
  }

  console.log('🔍 Time to Lease API Call:', {
    url: url.toString(),
    startDate,
    endDate,
    propertyId
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Doorloop time to lease: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('🔍 Time to Lease API Response:', data);
  
  return data;
}

