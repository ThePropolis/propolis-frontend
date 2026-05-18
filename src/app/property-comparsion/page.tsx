'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, X, TrendingUp, TrendingDown, Building2, BarChart2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { usePropertyStore } from '@/stores/propertyStore';
import { Spinner } from '@/components/ui/Spinner';

type Bucket = 'week' | 'month' | 'year';
type NameType = 'building' | 'unit';

function groupByBucket(data: { guesty_created_at: Date; total_paid: number }[], bucket: Bucket) {
  const map: Record<string, number> = {};
  data.forEach((r) => {
    const d = new Date(r.guesty_created_at);
    let key: string;
    if (bucket === 'week') {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      key = start.toISOString().slice(0, 10);
    } else if (bucket === 'month') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else {
      key = `${d.getFullYear()}`;
    }
    map[key] = (map[key] || 0) + Number(r.total_paid || 0);
  });
  return map;
}

function fmtMoney(v: number) {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export default function PropertyComparisonPage() {
  const { token } = useAuthStore();
  const { listingNames, listingData, loading, error, namesLoaded, loadListingNames, getDataFor, clearProperties } = usePropertyStore();

  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [selectedNameTypes, setSelectedNameTypes] = useState<Record<string, NameType>>({});
  const [bucket, setBucket] = useState<Bucket>('month');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (token && !namesLoaded) loadListingNames(token);
  }, [token, namesLoaded, loadListingNames]);

  const allNames = useMemo(() => {
    const units = listingNames.property_names.map((n) => ({ name: n, type: 'unit' as NameType }));
    const buildings = listingNames.building_names
      .filter((n) => !listingNames.property_names.includes(n))
      .map((n) => ({ name: n, type: 'building' as NameType }));
    return [...buildings, ...units];
  }, [listingNames]);

  const filteredNames = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return allNames.filter((n) => !q || n.name.toLowerCase().includes(q));
  }, [allNames, searchQuery]);

  function toggleSelection(name: string, type: NameType) {
    if (selectedNames.includes(name)) {
      setSelectedNames((p) => p.filter((n) => n !== name));
      setSelectedNameTypes((p) => { const next = { ...p }; delete next[name]; return next; });
      clearProperties([name]);
    } else {
      const newNames = [...selectedNames, name];
      const newTypes = { ...selectedNameTypes, [name]: type };
      setSelectedNames(newNames);
      setSelectedNameTypes(newTypes);

      const unitNames = newNames.filter((n) => newTypes[n] === 'unit').filter((n) => !selectedNames.includes(n));
      const buildingNames = newNames.filter((n) => newTypes[n] === 'building').filter((n) => !selectedNames.includes(n));
      if (token) {
        getDataFor(token, unitNames.length ? unitNames : undefined, buildingNames.length ? buildingNames : undefined, dateStart || undefined, dateEnd || undefined);
      }
    }
  }

  function applyFilters() {
    if (!selectedNames.length || !token) return;
    const unitNames = selectedNames.filter((n) => selectedNameTypes[n] === 'unit');
    const buildingNames = selectedNames.filter((n) => selectedNameTypes[n] === 'building');
    getDataFor(token, unitNames.length ? unitNames : undefined, buildingNames.length ? buildingNames : undefined, dateStart || undefined, dateEnd || undefined);
  }

  const allPeriods = useMemo(() => {
    const periodSet = new Set<string>();
    Object.values(listingData).forEach((entries) => {
      const grouped = groupByBucket(entries, bucket);
      Object.keys(grouped).forEach((k) => periodSet.add(k));
    });
    return Array.from(periodSet).sort();
  }, [listingData, bucket]);

  const tableData = useMemo(() => {
    return selectedNames.map((name) => {
      const entries = listingData[name] || [];
      const grouped = groupByBucket(entries, bucket);
      const total = Object.values(grouped).reduce((a, b) => a + b, 0);
      return { name, grouped, total };
    });
  }, [selectedNames, listingData, bucket]);

  const maxTotal = useMemo(() => Math.max(...tableData.map((r) => r.total), 1), [tableData]);

  const colors = ['bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-emerald-500'];
  const textColors = ['text-teal-700', 'text-blue-700', 'text-purple-700', 'text-orange-700', 'text-pink-700', 'text-emerald-700'];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Property Comparison</h1>
        <p className="text-sm text-gray-500 mt-1">Compare reservation revenue across properties and buildings.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        {/* Left panel: property selector */}
        <div className="lg:col-span-1 space-y-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Select Properties</h2>
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search…" className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-8 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {loading && !namesLoaded ? (
              <div className="flex items-center justify-center py-6"><Spinner size="sm" /></div>
            ) : filteredNames.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-500">No properties found</p>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-1">
                {filteredNames.map(({ name, type }, idx) => {
                  const sel = selectedNames.includes(name);
                  const selIdx = selectedNames.indexOf(name);
                  return (
                    <button key={name} onClick={() => toggleSelection(name, type)}
                      className={`w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${sel ? 'bg-teal-50 text-teal-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                      <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${sel ? colors[selIdx % colors.length] : 'bg-gray-200'}`} />
                      <span className="truncate flex-1">{name}</span>
                      <span className={`shrink-0 rounded text-[10px] px-1 py-0.5 ${type === 'building' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{type}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Filters</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bucket</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                {(['week', 'month', 'year'] as Bucket[]).map((b) => (
                  <button key={b} onClick={() => setBucket(b)}
                    className={`flex-1 py-1.5 capitalize transition ${bucket === b ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date range</label>
              <div className="flex flex-col gap-1.5">
                <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-teal-500 focus:outline-none" />
                <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-teal-500 focus:outline-none" />
              </div>
            </div>
            <button onClick={applyFilters} disabled={!selectedNames.length || loading}
              className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
              Apply Filters
            </button>
          </div>
        </div>

        {/* Right panel: chart / table */}
        <div className="lg:col-span-3 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          )}

          {selectedNames.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-gray-300 bg-white p-16 text-center">
              <BarChart2 className="h-12 w-12 text-gray-300" />
              <p className="text-base font-medium text-gray-700">Select one or more properties to compare</p>
              <p className="text-sm text-gray-500">Choose properties or buildings from the left panel to view their reservation revenue side by side.</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-20 rounded-lg border border-gray-200 bg-white">
              <Spinner size="lg" />
              <span className="ml-3 text-gray-600">Loading reservation data…</span>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {tableData.map(({ name, total }, idx) => {
                  const barWidth = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
                  return (
                    <div key={name} className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${colors[idx % colors.length]}`} />
                          <span className="text-xs font-medium text-gray-700 truncate max-w-[140px]">{name}</span>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${selectedNameTypes[name] === 'building' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                          {selectedNameTypes[name]}
                        </span>
                      </div>
                      <div className={`text-2xl font-bold ${textColors[idx % textColors.length]}`}>{fmtMoney(total)}</div>
                      <div className="text-xs text-gray-500 mb-2">total revenue ({listingData[name]?.length || 0} reservations)</div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100">
                        <div className={`h-1.5 rounded-full ${colors[idx % colors.length]}`} style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Period breakdown table */}
              {allPeriods.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-800">Revenue by {bucket}</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Period</th>
                        {tableData.map(({ name }, idx) => (
                          <th key={name} className="px-4 py-3 text-right">
                            <span className="flex items-center justify-end gap-1.5">
                              <span className={`inline-block h-2 w-2 rounded-full ${colors[idx % colors.length]}`} />
                              <span className="truncate max-w-[100px]">{name}</span>
                            </span>
                          </th>
                        ))}
                        {tableData.length > 1 && <th className="px-4 py-3 text-right">Leader</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allPeriods.slice(-24).map((period) => {
                        const values = tableData.map(({ name, grouped }) => ({ name, value: grouped[period] || 0 }));
                        const max = Math.max(...values.map((v) => v.value));
                        const leader = max > 0 ? values.find((v) => v.value === max) : null;
                        return (
                          <tr key={period} className="hover:bg-gray-50/50">
                            <td className="px-4 py-2.5 font-medium text-gray-900">{period}</td>
                            {values.map(({ name, value }, idx) => (
                              <td key={name} className={`px-4 py-2.5 text-right tabular-nums ${value === max && max > 0 ? textColors[idx % textColors.length] + ' font-semibold' : 'text-gray-600'}`}>
                                {value > 0 ? fmtMoney(value) : '—'}
                              </td>
                            ))}
                            {tableData.length > 1 && (
                              <td className="px-4 py-2.5 text-right">
                                {leader && max > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                                    <TrendingUp className="h-3 w-3" />
                                    <span className="truncate max-w-[80px]">{leader.name}</span>
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                      <tr>
                        <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Total</td>
                        {tableData.map(({ name, total }, idx) => (
                          <td key={name} className={`px-4 py-3 text-right font-bold tabular-nums ${textColors[idx % textColors.length]}`}>
                            {fmtMoney(total)}
                          </td>
                        ))}
                        {tableData.length > 1 && (
                          <td className="px-4 py-3 text-right">
                            {(() => {
                              const winner = tableData.reduce((a, b) => a.total >= b.total ? a : b);
                              const loser = tableData.reduce((a, b) => a.total <= b.total ? a : b);
                              const diff = winner.total - loser.total;
                              return diff > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                  <TrendingUp className="h-3 w-3" /> +{fmtMoney(diff)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                  <TrendingDown className="h-3 w-3" /> tied
                                </span>
                              );
                            })()}
                          </td>
                        )}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {allPeriods.length === 0 && !loading && (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 bg-white p-10 text-center">
                  <Building2 className="h-8 w-8 text-gray-300" />
                  <p className="text-sm text-gray-500">No reservation data found for the selected properties and date range.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
