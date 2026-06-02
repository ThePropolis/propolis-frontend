'use client';

import type { DashboardData } from '@/lib/types/dashboard';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useAuthStore } from '@/stores/authStore';
import { WelcomeCard } from './dashboard/WelcomeCard';
import { CardWidget } from './dashboard/CardWidget';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

interface Props {
  dashboardData: DashboardData;
}

export function DashboardSummary({ dashboardData }: Props) {
  const unitData = useDashboardStore((s) => s.unitFilteringData);
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'owner';

  const ltRevFromUnit =
    unitData?.filters_applied?.type === 'long-term' && unitData.data.length > 0
      ? unitData.data.reduce((sum, item) => sum + ((item as Record<string, number>).Revenue || 0), 0)
      : null;

  const stRevFromUnit =
    unitData?.filters_applied?.type === 'short-term' && unitData.data.length > 0
      ? unitData.data.reduce((sum, item) => sum + ((item as Record<string, number>).Revenue || 0), 0)
      : null;

  return (
    <div className="max-w-[1400px] mx-auto" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <WelcomeCard />
      <p className="text-gray-500 text-lg mb-8">Real-time data from Doorloop (Long-term) and Guesty (Short-term)</p>

      {/* Revenue */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-700 mb-6 flex items-center gap-2">📊 Revenue Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CardWidget info="Formula: longterm revenue + shortterm revenue" title={unitData ? 'Total Revenue (Filtered)' : 'Total Revenue'}>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-propolis-teal)' }}>
              {formatCurrency(
                ltRevFromUnit != null ? ltRevFromUnit : stRevFromUnit != null ? stRevFromUnit : dashboardData.totalRevenue
              )}
            </div>
            {unitData && (
              <div className="text-xs text-gray-500 mt-1">{unitData.filters_applied.property} - {unitData.filters_applied.unit}</div>
            )}
          </CardWidget>

          <CardWidget
            info="Cash basis: counts rent the month the payment was received."
            title={
              unitData?.filters_applied?.type === 'long-term'
                ? 'Long Term Revenue (Filtered)'
                : isOwner
                ? <span>Long Term Revenue <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">Cash</span></span>
                : 'Long Term Revenue'
            }
          >
            <div className="text-2xl font-bold" style={{ color: 'var(--color-propolis-teal)' }}>
              {formatCurrency(
                ltRevFromUnit != null ? ltRevFromUnit : unitData?.filters_applied?.type === 'short-term' ? 0 : dashboardData.longTermRevenue
              )}
            </div>
            {unitData?.filters_applied?.type === 'long-term' && (
              <div className="text-xs text-gray-500 mt-1">{unitData.filters_applied.property} - {unitData.filters_applied.unit}</div>
            )}
          </CardWidget>

          {isOwner && dashboardData.longTermRevenueAccrual != null && !unitData && (
            <CardWidget
              info="Accrual basis: counts rent in the month it was earned."
              title={<span>Long Term Revenue <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">Accrual</span></span>}
            >
              <div className="text-2xl font-bold text-purple-700">
                {formatCurrency(dashboardData.longTermRevenueAccrual)}
              </div>
            </CardWidget>
          )}

          <CardWidget
            info="Formula: Short term gross income"
            title={unitData?.filters_applied?.type === 'short-term' ? 'Short Term Revenue (Filtered)' : 'Short Term Revenue'}
          >
            <div className="text-2xl font-bold" style={{ color: 'var(--color-propolis-teal)' }}>
              {formatCurrency(stRevFromUnit != null ? stRevFromUnit : dashboardData.shortTermRevenue)}
            </div>
            {unitData?.filters_applied?.type === 'short-term' && (
              <div className="text-xs text-gray-500 mt-1">{unitData.filters_applied.property} - {unitData.filters_applied.unit}</div>
            )}
          </CardWidget>
        </div>
      </div>

      {/* Occupancy */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-700 mb-6 flex items-center gap-2">🏠 Occupancy Rates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CardWidget info="Formula: longterm occupancy + shortterm occupancy / 2" title="Average Occupancy">
            <div className="text-2xl font-bold" style={{ color: 'var(--color-propolis-teal)' }}>{formatPercentage(dashboardData.averageOccupancyRate)}</div>
          </CardWidget>
          <CardWidget
            info="Binary: any active lease in the period counts as 100% occupied."
            title={isOwner ? <span>Long-term Occupancy <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">Binary</span></span> : 'Long-term Occupancy'}
          >
            <div className="text-2xl font-bold" style={{ color: 'var(--color-propolis-teal)' }}>{formatPercentage(dashboardData.longTermOccupancyRate)}</div>
          </CardWidget>
          {isOwner && dashboardData.longTermOccupancyRateProrated != null && (
            <CardWidget
              info="Prorated: days of lease coverage ÷ days in period."
              title={<span>Long-term Occupancy <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">Prorated</span></span>}
            >
              <div className="text-2xl font-bold text-purple-700">{formatPercentage(dashboardData.longTermOccupancyRateProrated)}</div>
            </CardWidget>
          )}
          <CardWidget info="Formula: total occupied units / total units" title="Short-term Occupancy">
            <div className="text-2xl font-bold" style={{ color: 'var(--color-propolis-yellow)' }}>{formatPercentage(dashboardData.shortTermOccupancyRate)}</div>
          </CardWidget>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-700 mb-6 flex items-center gap-2">📈 Additional Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CardWidget info="Formula: ( Σ (Lease End Date – Lease Start Date) ) ÷ (Number of Leases)" title="Avg Lease Tenancy">
            <div className="text-2xl font-bold" style={{ color: 'var(--color-propolis-teal)' }}>{dashboardData.averageLeaseTenancy} days</div>
          </CardWidget>
          <CardWidget info="Formula: Σ (Lease Start Date – Vacancy Date) ) ÷ (Number of Leases Signed)" title="Time to Lease">
            <div className="text-2xl font-bold" style={{ color: 'var(--color-propolis-teal)' }}>{dashboardData.timeToLease} days</div>
          </CardWidget>
          <CardWidget info="Formula: (Move-Outs ÷ Active Tenants) × 100" title="Tenant Turnover">
            <div className="text-2xl font-bold" style={{ color: 'var(--color-propolis-yellow)' }}>{formatPercentage(dashboardData.tenantTurnover)}</div>
          </CardWidget>
          <CardWidget info="Formula: Total STR Revenue ÷ Nights Booked" title="Avg Daily Rate">
            <div className="text-2xl font-bold" style={{ color: 'var(--color-propolis-yellow)' }}>{formatCurrency(dashboardData.shortTermAverageDailyRate)}</div>
          </CardWidget>
          <CardWidget info="Formula: Total STR Revenue ÷ Available Nights" title="Revenue per Available Room">
            <div className="text-2xl font-bold" style={{ color: 'var(--color-propolis-teal)' }}>{formatCurrency(dashboardData.revenuePerAvailableRoom)}</div>
          </CardWidget>
          <CardWidget info="Formula: Total Charges - Total Amount Paid" title="Balance Overdue">
            <div className="text-2xl font-bold" style={{ color: 'var(--color-propolis-yellow)' }}>{formatCurrency(dashboardData.leaseBalanceOverdue)}</div>
          </CardWidget>
        </div>
      </div>
    </div>
  );
}
