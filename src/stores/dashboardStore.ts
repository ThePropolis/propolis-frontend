'use client';

import { create } from 'zustand';
import type { DashboardData } from '../lib/types/dashboard';
import {
  getDoorloopOccupancyRate,
  getDoorloopAverageLeaseTenancy,
  getDoorloopTenantTurnoverRate,
  getDoorloopBalanceDue,
  getDoorloopTimeToLease
} from '../lib/api/doorloop';
import {
  getDoorloopProfitLoss,
  getJurnyShortTermKPIs,
  extractLongTermRevenue
} from '../lib/api/revenue';
import { useGlobalPropertyFilterStore } from './globalPropertyFilterStore';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface UnitFilteringData {
  data: Record<string, unknown>[];
  count: number;
  filters_applied: {
    property: string;
    unit: string;
    type?: 'long-term' | 'short-term';
  };
}

function getCurrentMonthRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
}

const PROPERTY_NAME_MAP: Record<string, string> = {
  'Aerie Apartments': 'Aerie Apartments',
  'Plum Apartments': 'Plum Apartments',
  'Saffron': 'Saffron Apartments',
  'Olive Apartments': 'Olive Apartments',
  'Pastel Apartments': 'Pastel Apartments'
};

function mapPropertyNameForJurny(name: string | undefined): string | undefined {
  if (!name) return undefined;
  if (PROPERTY_NAME_MAP[name]) return PROPERTY_NAME_MAP[name];
  const lower = name.toLowerCase().trim();
  const lowerMap: Record<string, string> = {
    'aerie apartments': 'Aerie Apartments',
    'plum apartments': 'Plum Apartments',
    'saffron': 'Saffron Apartments',
    'olive apartments': 'Olive Apartments',
    'pastel apartments': 'Pastel Apartments'
  };
  return lowerMap[lower] ?? name;
}

interface DashboardState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  dateRange: DateRange;
  unitFilteringData: UnitFilteringData | null;
  fetchDashboardData: (dateRange?: DateRange) => Promise<void>;
  updateDateRange: (dateRange: DateRange) => void;
  updateUnitFilteringData: (data: UnitFilteringData) => void;
  clearUnitFilteringData: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  dateRange: getCurrentMonthRange(),
  unitFilteringData: null,

  fetchDashboardData: async (overrideRange?: DateRange) => {
    const range = overrideRange ?? get().dateRange;
    const { selectedProperty } = useGlobalPropertyFilterStore.getState();
    const selectedPropertyId = selectedProperty?.id;
    const selectedPropertyName = selectedProperty?.name;
    const mappedPropertyName = mapPropertyNameForJurny(selectedPropertyName);
    const isJurnyOnly = selectedPropertyId?.startsWith('jurny-');
    const doorloopPropertyId = isJurnyOnly ? undefined : selectedPropertyId;

    set({ loading: true, error: null });

    try {
      const [
        doorloopOccupancy,
        doorloopProfitLoss,
        doorloopProfitLossAccrual,
        doorloopLeaseTenancy,
        doorloopTenantTurnover,
        doorloopBalanceDue,
        doorloopTimeToLease,
        jurnyKPIs
      ] = await Promise.allSettled([
        getDoorloopOccupancyRate(range.startDate, range.endDate, doorloopPropertyId),
        getDoorloopProfitLoss('cash', range.startDate, range.endDate, doorloopPropertyId),
        getDoorloopProfitLoss('accrual', range.startDate, range.endDate, doorloopPropertyId),
        getDoorloopAverageLeaseTenancy(range.startDate, range.endDate, doorloopPropertyId),
        getDoorloopTenantTurnoverRate(range.startDate, range.endDate, doorloopPropertyId),
        getDoorloopBalanceDue(range.startDate, range.endDate, doorloopPropertyId),
        getDoorloopTimeToLease(range.startDate, range.endDate, doorloopPropertyId),
        getJurnyShortTermKPIs(range.startDate, range.endDate, mappedPropertyName)
      ]);

      const occupancyData = doorloopOccupancy.status === 'fulfilled' ? doorloopOccupancy.value : null;
      const profitLossData = doorloopProfitLoss.status === 'fulfilled' ? doorloopProfitLoss.value : null;
      const profitLossAccrualData = doorloopProfitLossAccrual.status === 'fulfilled' ? doorloopProfitLossAccrual.value : null;
      const leaseTenancyData = doorloopLeaseTenancy.status === 'fulfilled' ? doorloopLeaseTenancy.value : null;
      const tenantTurnoverData = doorloopTenantTurnover.status === 'fulfilled' ? doorloopTenantTurnover.value : null;
      const balanceDueData = doorloopBalanceDue.status === 'fulfilled' ? doorloopBalanceDue.value : null;
      const timeToLeaseData = doorloopTimeToLease.status === 'fulfilled' ? doorloopTimeToLease.value : null;
      const jurnyData = jurnyKPIs.status === 'fulfilled' ? jurnyKPIs.value : null;

      const longTermRevenue = isJurnyOnly ? 0 : extractLongTermRevenue(profitLossData);
      const longTermRevenueAccrual = isJurnyOnly ? 0 : extractLongTermRevenue(profitLossAccrualData);
      const shortTermRevenue = jurnyData?.revenue ? parseFloat(jurnyData.revenue) : 0;
      const totalRevenue = longTermRevenue + shortTermRevenue;

      const doorloopRate = isJurnyOnly ? 0 : (occupancyData?.occupancy_rate || 0);
      const doorloopRateProrated = isJurnyOnly ? 0 : (occupancyData?.occupancy_rate_prorated ?? occupancyData?.occupancy_rate ?? 0);
      const shortTermRate = jurnyData?.occupancy || 0;
      const averageOccupancyRate = isJurnyOnly ? shortTermRate : (doorloopRate + shortTermRate) / 2;

      const newData: DashboardData = {
        longTermRevenue,
        longTermRevenueAccrual,
        shortTermRevenue,
        totalRevenue,
        longTermOccupancyRate: doorloopRate,
        longTermOccupancyRateProrated: doorloopRateProrated,
        shortTermOccupancyRate: shortTermRate,
        averageOccupancyRate,
        averageLeaseTenancy: isJurnyOnly ? 0 : (leaseTenancyData?.average_lease_duration || 0),
        timeToLease: isJurnyOnly ? 0 : (timeToLeaseData?.time_to_lease_days || 0),
        tenantTurnover: isJurnyOnly ? 0 : (tenantTurnoverData?.['tenant turnover rate'] || 0),
        shortTermAverageDailyRate: jurnyData?.adr ? parseFloat(jurnyData.adr) : 0,
        revenuePerAvailableRoom: jurnyData?.revpar ? parseFloat(jurnyData.revpar) : 0,
        leaseBalanceOverdue: isJurnyOnly ? 0 : (balanceDueData?.totalBalance || 0)
      };

      set({ data: newData, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load dashboard data',
        loading: false,
        data: {
          longTermRevenue: 24314.53,
          shortTermRevenue: 22312.23,
          totalRevenue: 46626.76,
          longTermOccupancyRate: 71.59,
          shortTermOccupancyRate: 31.41,
          averageOccupancyRate: 51.23,
          averageLeaseTenancy: 100,
          timeToLease: 0,
          tenantTurnover: 0,
          shortTermAverageDailyRate: 100,
          revenuePerAvailableRoom: 100,
          leaseBalanceOverdue: 100
        }
      });
    }
  },

  updateDateRange: (dateRange) => {
    set({ dateRange });
    get().fetchDashboardData(dateRange);
  },

  updateUnitFilteringData: (data) => set({ unitFilteringData: data }),
  clearUnitFilteringData: () => set({ unitFilteringData: null })
}));
