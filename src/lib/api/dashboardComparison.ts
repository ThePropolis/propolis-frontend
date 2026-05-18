import type { DashboardData } from '../types/dashboard';
import {
  getDoorloopOccupancyRate,
  getDoorloopAverageLeaseTenancy,
  getDoorloopTenantTurnoverRate,
  getDoorloopBalanceDue,
  getDoorloopTimeToLease
} from './doorloop';
import { getDoorloopProfitLoss, getJurnyShortTermKPIs, extractLongTermRevenue } from './revenue';

const PROPERTY_NAME_MAP: Record<string, string> = {
  'Aerie Apartments': 'Aerie Apartments',
  'Plum Apartments': 'Plum Apartments',
  'Saffron': 'Saffron Apartments',
  'Olive Apartments': 'Olive Apartments',
  'Pastel Apartments': 'Pastel Apartments'
};

function mapPropertyNameForJurny(name?: string): string | undefined {
  if (!name) return undefined;
  return PROPERTY_NAME_MAP[name] ?? name;
}

export async function fetchDashboardDataForComparison(
  dateRange: { startDate: string; endDate: string },
  property?: { id: string; name: string } | null
): Promise<DashboardData> {
  const isJurnyOnly = property?.id?.startsWith('jurny-');
  const doorloopPropertyId = isJurnyOnly ? undefined : property?.id;
  const mappedPropertyName = mapPropertyNameForJurny(property?.name);

  const [occupancy, profitLoss, leaseTenancy, tenantTurnover, balanceDue, timeToLease, jurnyKPIs] =
    await Promise.allSettled([
      getDoorloopOccupancyRate(dateRange.startDate, dateRange.endDate, doorloopPropertyId),
      getDoorloopProfitLoss('cash', dateRange.startDate, dateRange.endDate, doorloopPropertyId),
      getDoorloopAverageLeaseTenancy(dateRange.startDate, dateRange.endDate, doorloopPropertyId),
      getDoorloopTenantTurnoverRate(dateRange.startDate, dateRange.endDate, doorloopPropertyId),
      getDoorloopBalanceDue(dateRange.startDate, dateRange.endDate, doorloopPropertyId),
      getDoorloopTimeToLease(dateRange.startDate, dateRange.endDate, doorloopPropertyId),
      getJurnyShortTermKPIs(dateRange.startDate, dateRange.endDate, mappedPropertyName)
    ]);

  const occupancyData = occupancy.status === 'fulfilled' ? occupancy.value : null;
  const profitLossData = profitLoss.status === 'fulfilled' ? profitLoss.value : null;
  const leaseTenancyData = leaseTenancy.status === 'fulfilled' ? leaseTenancy.value : null;
  const tenantTurnoverData = tenantTurnover.status === 'fulfilled' ? tenantTurnover.value : null;
  const balanceDueData = balanceDue.status === 'fulfilled' ? balanceDue.value : null;
  const timeToLeaseData = timeToLease.status === 'fulfilled' ? timeToLease.value : null;
  const jurnyData = jurnyKPIs.status === 'fulfilled' ? jurnyKPIs.value : null;

  const longTermRevenue = isJurnyOnly ? 0 : extractLongTermRevenue(profitLossData);
  const shortTermRevenue = jurnyData?.revenue ? parseFloat(jurnyData.revenue) : 0;

  const doorloopRate = isJurnyOnly ? 0 : (occupancyData?.occupancy_rate || 0);
  const doorloopRateProrated = isJurnyOnly ? 0 : (occupancyData?.occupancy_rate_prorated ?? occupancyData?.occupancy_rate ?? 0);
  const shortTermRate = jurnyData?.occupancy || 0;

  return {
    longTermRevenue,
    shortTermRevenue,
    totalRevenue: longTermRevenue + shortTermRevenue,
    longTermOccupancyRate: doorloopRate,
    longTermOccupancyRateProrated: doorloopRateProrated,
    shortTermOccupancyRate: shortTermRate,
    averageOccupancyRate: isJurnyOnly ? shortTermRate : (doorloopRate + shortTermRate) / 2,
    averageLeaseTenancy: isJurnyOnly ? 0 : (leaseTenancyData?.average_lease_duration || 0),
    timeToLease: isJurnyOnly ? 0 : (timeToLeaseData?.time_to_lease_days || 0),
    tenantTurnover: isJurnyOnly ? 0 : (tenantTurnoverData?.['tenant turnover rate'] || 0),
    shortTermAverageDailyRate: jurnyData?.adr ? parseFloat(jurnyData.adr) : 0,
    revenuePerAvailableRoom: jurnyData?.revpar ? parseFloat(jurnyData.revpar) : 0,
    leaseBalanceOverdue: isJurnyOnly ? 0 : (balanceDueData?.totalBalance || 0)
  };
}
