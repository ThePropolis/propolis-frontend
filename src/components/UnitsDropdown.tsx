'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useGlobalPropertyFilterStore } from '@/stores/globalPropertyFilterStore';
import { useDashboardStore, type UnitFilteringData } from '@/stores/dashboardStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type UnitOption = { id: string; name: string; type: 'long-term' | 'short-term' };

export function UnitsDropdown() {
  const selectedProperty = useGlobalPropertyFilterStore((s) => s.selectedProperty);
  const { updateUnitFilteringData, clearUnitFilteringData } = useDashboardStore();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UnitOption | null>(null);
  const [availableUnits, setAvailableUnits] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const lastFetched = useRef<string | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchUnits = useCallback(async (propertyName: string) => {
    if (lastFetched.current === propertyName && availableUnits.length > 0) return;
    setLoading(true);
    setError(null);
    lastFetched.current = propertyName;

    const normalized = propertyName
      .toLowerCase()
      .replace(/\s+(apartments?|complex|building|tower|plaza|court|place)s?$/i, '')
      .trim();

    try {
      let shortTermUnits: UnitOption[] = [];
      let longTermUnits: UnitOption[] = [];

      for (const name of [propertyName, normalized]) {
        if (shortTermUnits.length > 0 && longTermUnits.length > 0) break;
        const [stRes, ltRes] = await Promise.all([
          fetch(`${API_URL}/db/units-for-property?property=${encodeURIComponent(name)}`),
          fetch(`${API_URL}/db/rent-paid-units?property=${encodeURIComponent(name)}`)
        ]);
        if (stRes.ok && shortTermUnits.length === 0) {
          const d = await stRes.json();
          shortTermUnits = [...new Set<string>(d.data?.map((i: Record<string, string>) => i.Unit) || [])]
            .filter((u) => u.trim() !== '')
            .map((u) => ({ id: u, name: u, type: 'short-term' as const }))
            .sort((a, b) => a.name.localeCompare(b.name));
        }
        if (ltRes.ok && longTermUnits.length === 0) {
          const d = await ltRes.json();
          longTermUnits = (d.units || [])
            .filter((u: string) => u.trim() !== '')
            .map((u: string) => ({ id: u, name: u, type: 'long-term' as const }))
            .sort((a: UnitOption, b: UnitOption) => a.name.localeCompare(b.name));
        }
      }
      setAvailableUnits([...shortTermUnits, ...longTermUnits]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch units');
      setAvailableUnits([]);
    } finally {
      setLoading(false);
    }
  }, [availableUnits.length]);

  useEffect(() => {
    if (selectedProperty) {
      fetchUnits(selectedProperty.name);
    } else {
      setAvailableUnits([]);
      setSelectedUnit(null);
      lastFetched.current = null;
    }
  }, [selectedProperty?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  async function selectUnit(unit: UnitOption) {
    setSelectedUnit(unit);
    setIsOpen(false);
    if (!selectedProperty) return;

    if (unit.type === 'long-term') {
      try {
        const url = new URL(`${API_URL}/db/rent-paid-unit-details`);
        url.searchParams.append('property', selectedProperty.name);
        url.searchParams.append('unit', unit.name);
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(res.statusText);
        const d = await res.json();
        updateUnitFilteringData({
          data: [{ Revenue: d.unit_total_paid || 0, Unit: unit.name, Property: selectedProperty.name }],
          count: 1,
          filters_applied: { property: selectedProperty.name, unit: unit.name, type: 'long-term' }
        } as UnitFilteringData);
      } catch { clearUnitFilteringData(); }
    } else {
      try {
        const url = new URL(`${API_URL}/db/unit-filtering`);
        url.searchParams.append('property', selectedProperty.name);
        url.searchParams.append('unit', unit.name);
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(res.statusText);
        const d = await res.json();
        updateUnitFilteringData({
          data: d.data || [],
          count: d.count || 0,
          filters_applied: {
            property: d.filters_applied?.property || selectedProperty.name,
            unit: d.filters_applied?.unit || unit.name,
            type: 'short-term'
          }
        } as UnitFilteringData);
      } catch { clearUnitFilteringData(); }
    }
  }

  function clearUnit() {
    setSelectedUnit(null);
    setIsOpen(false);
    clearUnitFilteringData();
  }

  const buttonText = !selectedProperty
    ? 'Select Property First'
    : selectedUnit
    ? `${selectedUnit.name} (${selectedUnit.type === 'long-term' ? 'Long-term' : 'Short-term'})`
    : loading
    ? 'Loading…'
    : availableUnits.length === 0
    ? 'No Units Available'
    : 'All Units';

  const isDisabled = !selectedProperty || loading;
  const ltUnits = availableUnits.filter((u) => u.type === 'long-term');
  const stUnits = availableUnits.filter((u) => u.type === 'short-term');

  return (
    <div className="relative min-w-[180px]" ref={ref}>
      <button
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-all ${isDisabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200' : selectedUnit ? 'border-teal-500 bg-teal-50/10' : 'bg-white border-gray-300 hover:border-teal-500 text-gray-700'}`}
        onClick={() => !isDisabled && setIsOpen((v) => !v)}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center flex-1 min-w-0 gap-2">
          {selectedUnit && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold shrink-0" style={{ background: 'var(--color-propolis-teal)' }}>✓</span>
          )}
          <span className="flex-1 text-left truncate mr-2">{buttonText}</span>
          {selectedUnit && (
            <span
              className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 cursor-pointer hover:bg-gray-200"
              onClick={(e) => { e.stopPropagation(); clearUnit(); }}
              role="button"
              tabIndex={0}
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-500 italic">Loading units…</div>
          ) : error ? (
            <div className="px-3 py-2 text-sm text-red-600 italic">Error: {error}</div>
          ) : availableUnits.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 italic">No units available for this property</div>
          ) : (
            <>
              <button
                className={`block w-full px-3 py-2.5 text-left text-sm border-b border-gray-100 hover:bg-teal-50/20 ${!selectedUnit ? 'bg-teal-50/20 text-teal-700' : 'text-gray-700'}`}
                onClick={clearUnit}
              >
                All Units
              </button>
              {ltUnits.length > 0 && (
                <>
                  <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">Long-term Units</div>
                  {ltUnits.map((u) => (
                    <button
                      key={`lt-${u.id}`}
                      className={`block w-full px-3 py-2.5 text-left text-sm border-b border-gray-100 last:border-0 hover:bg-teal-50/20 ${selectedUnit?.id === u.id ? 'bg-teal-50/20 text-teal-700 font-semibold' : 'text-gray-700'}`}
                      onClick={() => selectUnit(u)}
                    >
                      {u.name}
                    </button>
                  ))}
                </>
              )}
              {stUnits.length > 0 && (
                <>
                  {ltUnits.length > 0 && <div className="h-px bg-gray-200 my-1" />}
                  <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">Short-term Units</div>
                  {stUnits.map((u) => (
                    <button
                      key={`st-${u.id}`}
                      className={`block w-full px-3 py-2.5 text-left text-sm border-b border-gray-100 last:border-0 hover:bg-teal-50/20 ${selectedUnit?.id === u.id ? 'bg-teal-50/20 text-teal-700 font-semibold' : 'text-gray-700'}`}
                      onClick={() => selectUnit(u)}
                    >
                      {u.name}
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
