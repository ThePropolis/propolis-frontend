'use client';

import { useState } from 'react';
import { fetchDashboardDataForComparison } from '@/lib/api/dashboardComparison';
import { useGlobalPropertyFilterStore } from '@/stores/globalPropertyFilterStore';
import type { DashboardData } from '@/lib/types/dashboard';
import { PropertyDropdown } from '@/components/PropertyDropdown';

interface ComparisonResult {
  dateRange: { startDate: string; endDate: string };
  property: { id: string; name: string } | null;
  data: DashboardData;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
}

function formatPercentage(v: number) {
  return `${v.toFixed(1)}%`;
}

function TrendBadge({ a, b, format }: { a: number; b: number; format: (v: number) => string }) {
  const diff = a - b;
  if (diff === 0) return <span className="text-gray-400 text-xs">→ no change</span>;
  const positive = diff > 0;
  return (
    <span className={`text-xs font-medium ${positive ? 'text-green-600' : 'text-red-500'}`}>
      {positive ? '▲' : '▼'} {format(Math.abs(diff))}
    </span>
  );
}

const METRICS: Array<{ key: keyof DashboardData; label: string; format: (v: number) => string }> = [
  { key: 'totalRevenue', label: 'Total Revenue', format: formatCurrency },
  { key: 'longTermRevenue', label: 'Long-term Revenue', format: formatCurrency },
  { key: 'shortTermRevenue', label: 'Short-term Revenue', format: formatCurrency },
  { key: 'averageOccupancyRate', label: 'Avg Occupancy', format: formatPercentage },
  { key: 'longTermOccupancyRate', label: 'Long-term Occupancy', format: formatPercentage },
  { key: 'shortTermOccupancyRate', label: 'Short-term Occupancy', format: formatPercentage },
  { key: 'averageLeaseTenancy', label: 'Avg Lease Tenancy', format: (v) => `${v} days` },
  { key: 'timeToLease', label: 'Time to Lease', format: (v) => `${v} days` },
  { key: 'tenantTurnover', label: 'Tenant Turnover', format: formatPercentage },
  { key: 'shortTermAverageDailyRate', label: 'Avg Daily Rate', format: formatCurrency },
  { key: 'revenuePerAvailableRoom', label: 'RevPAR', format: formatCurrency },
  { key: 'leaseBalanceOverdue', label: 'Balance Overdue', format: formatCurrency }
];

export function DateRangeComparison() {
  const { selectedProperty } = useGlobalPropertyFilterStore();

  const [rangeA, setRangeA] = useState({ startDate: '', endDate: '' });
  const [rangeB, setRangeB] = useState({ startDate: '', endDate: '' });
  const [results, setResults] = useState<[ComparisonResult, ComparisonResult] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compare() {
    if (!rangeA.startDate || !rangeA.endDate || !rangeB.startDate || !rangeB.endDate) {
      setError('Please set both date ranges');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [dataA, dataB] = await Promise.all([
        fetchDashboardDataForComparison(rangeA, selectedProperty),
        fetchDashboardDataForComparison(rangeB, selectedProperty)
      ]);
      setResults([
        { dateRange: rangeA, property: selectedProperty, data: dataA },
        { dateRange: rangeB, property: selectedProperty, data: dataB }
      ]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Comparison failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap gap-6 items-end">
        <div>
          <div className="text-sm font-medium text-gray-700 mb-1">Range A</div>
          <div className="flex gap-2">
            <input type="date" value={rangeA.startDate} onChange={(e) => setRangeA((r) => ({ ...r, startDate: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input type="date" value={rangeA.endDate} onChange={(e) => setRangeA((r) => ({ ...r, endDate: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-700 mb-1">Range B</div>
          <div className="flex gap-2">
            <input type="date" value={rangeB.startDate} onChange={(e) => setRangeB((r) => ({ ...r, startDate: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input type="date" value={rangeB.endDate} onChange={(e) => setRangeB((r) => ({ ...r, endDate: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-700 mb-1">Property</div>
          <PropertyDropdown />
        </div>
        <button
          onClick={compare}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, var(--color-propolis-teal), var(--color-propolis-yellow))' }}
        >
          {loading ? 'Comparing…' : 'Compare'}
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {results && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Metric</th>
                <th className="px-4 py-3">Range A ({results[0].dateRange.startDate} → {results[0].dateRange.endDate})</th>
                <th className="px-4 py-3">Range B ({results[1].dateRange.startDate} → {results[1].dateRange.endDate})</th>
                <th className="px-4 py-3">Difference (A−B)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {METRICS.map(({ key, label, format }) => {
                const a = (results[0].data[key] as number) || 0;
                const b = (results[1].data[key] as number) || 0;
                return (
                  <tr key={key} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-700">{label}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-propolis-teal)' }}>{format(a)}</td>
                    <td className="px-4 py-3 text-gray-600">{format(b)}</td>
                    <td className="px-4 py-3"><TrendBadge a={a} b={b} format={format} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
