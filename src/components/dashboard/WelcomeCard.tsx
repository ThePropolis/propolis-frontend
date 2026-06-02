'use client';

import { useState, useEffect } from 'react';
import { Filter, Sparkles } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboardStore';
import { PropertyDropdown } from '@/components/PropertyDropdown';
import { UnitsDropdown } from '@/components/UnitsDropdown';

export function WelcomeCard() {
  const [day, setDay] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { dateRange, updateDateRange, fetchDashboardData } = useDashboardStore();

  useEffect(() => {
    const now = new Date();
    setDay(String(now.getDate()));
    setDayOfWeek(now.toLocaleDateString('en-US', { weekday: 'long' }));
    setMonth(now.toLocaleDateString('en-US', { month: 'long' }));
    setYear(now.toLocaleDateString('en-US', { year: 'numeric' }));
    setStartDate(dateRange.startDate);
    setEndDate(dateRange.endDate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilters() {
    if (startDate && endDate) {
      updateDateRange({ startDate, endDate });
    } else {
      fetchDashboardData();
    }
  }

  function setQuickRange(days: number) {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }

  function setCurrentMonth() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(startOfMonth.toISOString().split('T')[0]);
    setEndDate(endOfMonth.toISOString().split('T')[0]);
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between w-full gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border border-gray-200">
            <div className="text-4xl font-semibold">{day}</div>
          </div>
          <div>
            <div className="text-xl font-medium text-gray-600">{dayOfWeek},</div>
            <div className="text-2xl font-bold text-gray-800">{month} {year}</div>
          </div>
        </div>

        <div className="flex items-end gap-6 flex-wrap">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium text-slate-700">Date Range</div>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium text-slate-700">Property Filter</div>
            <PropertyDropdown />
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium text-slate-700">Units Filter</div>
            <UnitsDropdown />
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium text-slate-700 opacity-0">Apply</div>
            <button
              onClick={applyFilters}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--color-propolis-teal)' }}
            >
              <Filter className="w-4 h-4" />
              Apply Filters
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium text-slate-700 opacity-0">AI</div>
            <button className="relative cursor-pointer hover:scale-105 transition-transform duration-200">
              <div
                className="absolute inset-0 rounded-2xl animate-pulse"
                style={{ background: 'linear-gradient(135deg, var(--color-propolis-teal), var(--color-propolis-yellow))' }}
              />
              <div
                className="relative flex items-center justify-center w-10 h-10 rounded-2xl shadow-lg"
                style={{ background: 'linear-gradient(135deg, var(--color-propolis-teal), var(--color-propolis-yellow))' }}
              >
                <Sparkles className="w-5 h-5 text-white animate-bounce" />
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mt-3">
        {[7, 30].map((d) => (
          <button
            key={d}
            onClick={() => setQuickRange(d)}
            className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded transition-colors"
          >
            {d} Days
          </button>
        ))}
        <button
          onClick={setCurrentMonth}
          className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded transition-colors"
        >
          This Month
        </button>
      </div>
    </div>
  );
}
