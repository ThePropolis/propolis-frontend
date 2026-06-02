export interface DashboardData {
  longTermRevenue: number;
  longTermRevenueAccrual?: number;
  shortTermRevenue: number;
  totalRevenue: number;
  longTermOccupancyRate: number;
  longTermOccupancyRateProrated?: number;
  shortTermOccupancyRate: number;
  averageOccupancyRate: number;
  averageLeaseTenancy: number;
  timeToLease: number;
  tenantTurnover: number;
  shortTermAverageDailyRate: number;
  revenuePerAvailableRoom: number;
  leaseBalanceOverdue: number;
}
