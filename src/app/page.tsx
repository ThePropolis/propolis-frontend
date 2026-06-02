'use client';

import { useEffect, useState } from 'react';
import { useDashboardStore } from '@/stores/dashboardStore';
import { DashboardSummary } from '@/components/DashboardSummary';
import { DateRangeComparison } from '@/components/dashboard/DateRangeComparison';

type ViewMode = 'dashboard' | 'comparison';

export default function DashboardPage() {
  const { data, loading, error, fetchDashboardData } = useDashboardStore();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

  useEffect(() => {
    if (viewMode === 'dashboard') fetchDashboardData();
  }, [viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeStyle = {
    background: 'linear-gradient(135deg, var(--color-propolis-teal), var(--color-propolis-yellow))'
  };

  return (
    <div className="space-y-0">
      <div className="mb-4 flex gap-2 justify-end px-4 pt-4">
        <button
          onClick={() => { setViewMode('dashboard'); fetchDashboardData(); }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${viewMode === 'dashboard' ? 'text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          style={viewMode === 'dashboard' ? activeStyle : undefined}
        >
          Dashboard
        </button>
        <button
          onClick={() => setViewMode('comparison')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${viewMode === 'comparison' ? 'text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          style={viewMode === 'comparison' ? activeStyle : undefined}
        >
          Comparison
        </button>
      </div>

      {viewMode === 'comparison' ? (
        <DateRangeComparison />
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Loading dashboard data…</span>
        </div>
      ) : error && !data ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-medium">Error loading dashboard data</div>
          <div className="text-red-600 text-sm mt-1">{error}</div>
          <button onClick={() => fetchDashboardData()} className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
            Retry
          </button>
        </div>
      ) : data ? (
        <DashboardSummary dashboardData={data} />
      ) : null}
    </div>
  );
}
