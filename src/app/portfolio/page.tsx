'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  LayoutGrid, Building2, Layers, Bed, DollarSign, TrendingUp, ArrowUpDown,
  Search, X, Plus, Pencil, Trash2, MoreHorizontal, ChevronDown, ChevronRight,
  RefreshCw, ListFilter, Columns, Save, Accessibility
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { EChart } from '@/components/ui/EChart';
import { Spinner } from '@/components/ui/Spinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────
type Length = 'LTR' | 'STR';
type Strategy = 'Coliving' | 'Entire Apt';
type Mode = 'owner' | 'investor' | 'operator';

type Amenity = { id: string; name: string; category: string | null };
type Financials = {
  actual_rent: number | null; base_rent: number | null; market_rent: number | null;
  actual_rent_with_util: number | null; pessimistic_rent: number | null;
  concession_rent: number | null; concession_rent_with_util: number | null;
  adjustment: number | null; stake_5_cashback: number | null; stake_8_cashback: number | null;
  revenue_month: number | null; revenue_year: number | null;
  revenue_per_apartment: number | null; extras: string | null;
};
type Room = {
  id: string; unit_id: string; name: string; length: Length | null; strategy: Strategy | null;
  beds: number | null; baths: number | null; bed_size: string | null; bathroom: string | null;
  ceiling_height: string | null; balcony: string | null; room_type_name: string | null;
  sqft: number | null; is_ada: boolean | null; listing_date: string | null;
  amenity_ids: string[]; notes: string | null; financials: Financials | null;
};
type Unit = {
  id: string; building_id: string; name: string; unit_type: string | null;
  amenity_ids: string[]; notes: string | null; rooms: Room[];
};
type Building = {
  id: string; name: string; full_name: string | null; address: string | null;
  owner_llc: string | null; floors: number | null; has_elevator: boolean | null;
  units_count: number | null; beds_count: number | null; description: string | null;
  photos: string[]; amenity_ids: string[]; notes: string | null; units: Unit[];
};
type MonthlyPerf = {
  id: string; building_id: string; period_year: number; period_month: number;
  occupancy_pct: number | null; adr: number | null; revpar: number | null;
  revenue: number | null; notes: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtMoney(v: number | null | undefined, compact = false): string {
  if (v == null || isNaN(Number(v))) return '—';
  const n = Number(v);
  if (compact) {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(Math.abs(n) >= 10_000 ? 0 : 1)}k`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function rentOf(r: Room): number {
  const f = r.financials;
  if (!f) return 0;
  return Number(f.actual_rent ?? f.base_rent ?? 0) || 0;
}
function toggleSet<T>(s: Set<T>, v: T): Set<T> {
  const n = new Set(s);
  n.has(v) ? n.delete(v) : n.add(v);
  return n;
}

// ─── Filter chip row ─────────────────────────────────────────────────────
function ChipGroup<T extends string | number>({
  label, options, active, onToggle, color = 'teal'
}: {
  label: string; options: T[]; active: Set<T>; onToggle: (v: T) => void; color?: 'teal' | 'amber';
}) {
  if (options.length === 0) return null;
  const on = color === 'teal'
    ? 'border-teal-500 bg-teal-100 text-teal-800'
    : 'border-amber-500 bg-amber-100 text-amber-800';
  const off = 'border-gray-200 text-gray-600';
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((v) => (
          <button key={String(v)} onClick={() => onToggle(v)}
            className={`rounded border px-1.5 py-0.5 text-[11px] font-medium transition ${active.has(v) ? on : off}`}>
            {String(v) === 'unset' ? '—' : String(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

function RadioGroup<T extends string>({
  label, options, value, onChange, color = 'teal'
}: {
  label: string; options: T[]; value: T; onChange: (v: T) => void; color?: 'teal' | 'amber';
}) {
  const on = color === 'teal'
    ? 'border-teal-500 bg-teal-100 text-teal-800'
    : 'border-amber-500 bg-amber-100 text-amber-800';
  const off = 'border-gray-200 text-gray-600';
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((v) => (
          <button key={v} onClick={() => onChange(v)}
            className={`rounded border px-1.5 py-0.5 text-[11px] transition ${value === v ? on : off}`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel, loading }: {
  message: string; onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
        <p className="text-gray-800 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-60 flex items-center gap-2">
            {loading && <Spinner size="sm" />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const { token, user } = useAuthStore();
  const userRole = (user as { role?: string } | null)?.role;
  const isOwner = userRole === 'owner' || userRole === 'operator';

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState(new Set<string>());

  // Mode
  const defaultMode: Mode = userRole === 'operator' ? 'owner' : ((userRole as Mode) || 'investor');
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [modeChosen, setModeChosen] = useState(false);
  const effectiveMode = modeChosen ? mode : defaultMode;

  // Tree expansion
  const [expandedBuildings, setExpandedBuildings] = useState(new Set<string>());
  const [expandedUnits, setExpandedUnits] = useState(new Set<string>());
  const [financialsBuildingId, setFinancialsBuildingId] = useState<string | null>(null);
  const [monthlyByBuilding, setMonthlyByBuilding] = useState<Record<string, MonthlyPerf[]>>({});
  const [loadingPerf, setLoadingPerf] = useState(false);

  // Filters Set A
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'name'|'rent_desc'|'rent_asc'|'revenue_desc'>('name');
  const [showFilters, setShowFilters] = useState(false);
  const [lengthFilter, setLengthFilter] = useState(new Set<string>());
  const [strategyFilter, setStrategyFilter] = useState<'all'|'Coliving'|'Entire Apt'|'unset'>('all');
  const [bathroomFilter, setBathroomFilter] = useState<'all'|'Private'|'Shared'>('all');
  const [bedsFilter, setBedsFilter] = useState(new Set<number>());
  const [bathsFilter, setBathsFilter] = useState(new Set<number>());
  const [bedSizeFilter, setBedSizeFilter] = useState(new Set<string>());
  const [roomTypeFilter, setRoomTypeFilter] = useState(new Set<string>());
  const [unitTypeFilter, setUnitTypeFilter] = useState(new Set<string>());
  const [amenityFilter, setAmenityFilter] = useState(new Set<string>());
  const [buildingFilter, setBuildingFilter] = useState(new Set<string>());
  const [adaOnly, setAdaOnly] = useState(false);
  const [withRentOnly, setWithRentOnly] = useState(false);
  const [rentMin, setRentMin] = useState<string>('');
  const [rentMax, setRentMax] = useState<string>('');
  const [elevatorOnly, setElevatorOnly] = useState(false);
  const [ownerLLCFilter, setOwnerLLCFilter] = useState(new Set<string>());

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  // Filters Set B
  const [searchB, setSearchB] = useState('');
  const [lengthFilterB, setLengthFilterB] = useState(new Set<string>());
  const [strategyFilterB, setStrategyFilterB] = useState<'all'|'Coliving'|'Entire Apt'|'unset'>('all');
  const [bathroomFilterB, setBathroomFilterB] = useState<'all'|'Private'|'Shared'>('all');
  const [bedsFilterB, setBedsFilterB] = useState(new Set<number>());
  const [bathsFilterB, setBathsFilterB] = useState(new Set<number>());
  const [bedSizeFilterB, setBedSizeFilterB] = useState(new Set<string>());
  const [roomTypeFilterB, setRoomTypeFilterB] = useState(new Set<string>());
  const [unitTypeFilterB, setUnitTypeFilterB] = useState(new Set<string>());
  const [amenityFilterB, setAmenityFilterB] = useState(new Set<string>());
  const [buildingFilterB, setBuildingFilterB] = useState(new Set<string>());
  const [adaOnlyB, setAdaOnlyB] = useState(false);
  const [withRentOnlyB, setWithRentOnlyB] = useState(false);
  const [rentMinB, setRentMinB] = useState<string>('');
  const [rentMaxB, setRentMaxB] = useState<string>('');

  // Building modal
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [buildingDraft, setBuildingDraft] = useState<Partial<Building & { photosCsv: string }>>({});
  const [buildingAmenitySet, setBuildingAmenitySet] = useState(new Set<string>());
  const [buildingSaving, setBuildingSaving] = useState(false);
  const [confirmDeleteBuilding, setConfirmDeleteBuilding] = useState<Building | null>(null);
  const [deletingBuilding, setDeletingBuilding] = useState(false);

  // Unit modal
  type UnitModal = { kind: 'add'; building: Building } | { kind: 'edit'; building: Building; unit: Unit };
  const [unitModal, setUnitModal] = useState<UnitModal | null>(null);
  const [unitDraft, setUnitDraft] = useState<Partial<Unit>>({});
  const [unitAmenitySet, setUnitAmenitySet] = useState(new Set<string>());
  const [unitSaving, setUnitSaving] = useState(false);
  const [confirmDeleteUnit, setConfirmDeleteUnit] = useState<{ building: Building; unit: Unit } | null>(null);
  const [deletingUnit, setDeletingUnit] = useState(false);

  // Room modal
  type RoomModal = { kind: 'add'; building: Building; unit: Unit } | { kind: 'edit'; building: Building; unit: Unit; room: Room };
  const [roomModal, setRoomModal] = useState<RoomModal | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [roomDraft, setRoomDraft] = useState<Record<string, any>>({});
  const [roomAmenitySet, setRoomAmenitySet] = useState(new Set<string>());
  const [customAmenityDraft, setCustomAmenityDraft] = useState('');
  const [roomSaving, setRoomSaving] = useState(false);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<{ building: Building; unit: Unit; room: Room } | null>(null);
  const [deletingRoom, setDeletingRoom] = useState(false);

  // Perf modal
  const [showPerfModal, setShowPerfModal] = useState(false);
  const [perfDraft, setPerfDraft] = useState<Partial<MonthlyPerf> & { building_id?: string }>({});
  const [perfSaving, setPerfSaving] = useState(false);
  const [confirmDeletePerf, setConfirmDeletePerf] = useState<MonthlyPerf | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────
  const amenitiesById = useMemo(
    () => new Map(amenities.map((a) => [a.id, a])),
    [amenities]
  );

  async function callJSON(url: string, method: string, body?: unknown): Promise<unknown> {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as { detail?: string }).detail || `${method} failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${API_URL}/api/portfolio`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status >= 500) {
          setLoadError("Portfolio tables aren't set up yet. Run migration 008_portfolio_schema.sql then seed_portfolio_from_inventory.py.");
        } else {
          setLoadError(`Load failed (${res.status})`);
        }
        return;
      }
      const d = await res.json();
      setBuildings(d.buildings || []);
      setAmenities((d.amenities || []).sort((a: Amenity, b: Amenity) => a.name.localeCompare(b.name)));
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // ── Filter logic ──────────────────────────────────────────────────────
  const bedsOptions = useMemo(() =>
    [...new Set(buildings.flatMap((b) => b.units.flatMap((u) => u.rooms.map((r) => r.beds).filter((v): v is number => v != null))))].sort((a, b) => a - b),
    [buildings]);
  const bathsOptions = useMemo(() =>
    [...new Set(buildings.flatMap((b) => b.units.flatMap((u) => u.rooms.map((r) => r.baths).filter((v): v is number => v != null))))].sort((a, b) => a - b),
    [buildings]);
  const bedSizeOptions = useMemo(() =>
    [...new Set(buildings.flatMap((b) => b.units.flatMap((u) => u.rooms.map((r) => r.bed_size).filter(Boolean))))].sort() as string[],
    [buildings]);
  const roomTypeOptions = useMemo(() =>
    [...new Set(buildings.flatMap((b) => b.units.flatMap((u) => u.rooms.map((r) => r.room_type_name).filter(Boolean))))].sort() as string[],
    [buildings]);
  const unitTypeOptions = useMemo(() =>
    [...new Set(buildings.flatMap((b) => b.units.map((u) => u.unit_type).filter(Boolean)))].sort() as string[],
    [buildings]);
  const ownerLLCOptions = useMemo(() =>
    [...new Set(buildings.map((b) => b.owner_llc).filter(Boolean))].sort() as string[],
    [buildings]);

  function nameOfAmenity(id: string) { return amenitiesById.get(id)?.name ?? ''; }

  const roomMatches = useCallback((r: Room): boolean => {
    if (lengthFilter.size > 0 && !lengthFilter.has(r.length ?? 'unset')) return false;
    if (roomTypeFilter.size > 0 && !roomTypeFilter.has(r.room_type_name ?? 'unset')) return false;
    if (strategyFilter !== 'all') {
      if (strategyFilter === 'unset') { if (r.strategy) return false; }
      else if (r.strategy !== strategyFilter) return false;
    }
    if (bathroomFilter !== 'all' && r.bathroom !== bathroomFilter) return false;
    if (bedsFilter.size > 0 && (r.beds == null || !bedsFilter.has(r.beds))) return false;
    if (bathsFilter.size > 0 && (r.baths == null || !bathsFilter.has(r.baths))) return false;
    if (bedSizeFilter.size > 0 && (!r.bed_size || !bedSizeFilter.has(r.bed_size))) return false;
    if (amenityFilter.size > 0) { for (const aid of amenityFilter) if (!r.amenity_ids.includes(aid)) return false; }
    if (adaOnly && !r.is_ada) return false;
    const rent = rentOf(r);
    if (withRentOnly && rent <= 0) return false;
    const minN = rentMin !== '' ? Number(rentMin) : null;
    const maxN = rentMax !== '' ? Number(rentMax) : null;
    if (minN != null && !isNaN(minN) && rent < minN) return false;
    if (maxN != null && !isNaN(maxN) && rent > maxN) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const blob = [r.name, r.room_type_name, r.financials?.extras, r.bed_size, r.bathroom, r.balcony,
        ...(r.amenity_ids || []).map(nameOfAmenity)].filter(Boolean).join(' ').toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  }, [lengthFilter, roomTypeFilter, strategyFilter, bathroomFilter, bedsFilter, bathsFilter, bedSizeFilter, amenityFilter, adaOnly, withRentOnly, rentMin, rentMax, search, nameOfAmenity]);

  const roomMatchesB = useCallback((r: Room): boolean => {
    if (lengthFilterB.size > 0 && !lengthFilterB.has(r.length ?? 'unset')) return false;
    if (roomTypeFilterB.size > 0 && !roomTypeFilterB.has(r.room_type_name ?? 'unset')) return false;
    if (strategyFilterB !== 'all') {
      if (strategyFilterB === 'unset') { if (r.strategy) return false; }
      else if (r.strategy !== strategyFilterB) return false;
    }
    if (bathroomFilterB !== 'all' && r.bathroom !== bathroomFilterB) return false;
    if (bedsFilterB.size > 0 && (r.beds == null || !bedsFilterB.has(r.beds))) return false;
    if (bathsFilterB.size > 0 && (r.baths == null || !bathsFilterB.has(r.baths))) return false;
    if (bedSizeFilterB.size > 0 && (!r.bed_size || !bedSizeFilterB.has(r.bed_size))) return false;
    if (amenityFilterB.size > 0) { for (const aid of amenityFilterB) if (!r.amenity_ids.includes(aid)) return false; }
    if (adaOnlyB && !r.is_ada) return false;
    const rent = rentOf(r);
    if (withRentOnlyB && rent <= 0) return false;
    const minN = rentMinB !== '' ? Number(rentMinB) : null;
    const maxN = rentMaxB !== '' ? Number(rentMaxB) : null;
    if (minN != null && !isNaN(minN) && rent < minN) return false;
    if (maxN != null && !isNaN(maxN) && rent > maxN) return false;
    if (searchB.trim()) {
      const q = searchB.trim().toLowerCase();
      const blob = [r.name, r.room_type_name, r.financials?.extras, r.bed_size, r.bathroom, r.balcony,
        ...(r.amenity_ids || []).map(nameOfAmenity)].filter(Boolean).join(' ').toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  }, [lengthFilterB, roomTypeFilterB, strategyFilterB, bathroomFilterB, bedsFilterB, bathsFilterB, bedSizeFilterB, amenityFilterB, adaOnlyB, withRentOnlyB, rentMinB, rentMaxB, searchB, nameOfAmenity]);

  const hasAnyFilter = search.trim() || lengthFilter.size > 0 || strategyFilter !== 'all' || bathroomFilter !== 'all' ||
    bedsFilter.size > 0 || bathsFilter.size > 0 || bedSizeFilter.size > 0 || roomTypeFilter.size > 0 ||
    unitTypeFilter.size > 0 || amenityFilter.size > 0 || buildingFilter.size > 0 ||
    adaOnly || withRentOnly || rentMin !== '' || rentMax !== '' || elevatorOnly || ownerLLCFilter.size > 0;

  const hasAnyFilterB = searchB.trim() || lengthFilterB.size > 0 || strategyFilterB !== 'all' || bathroomFilterB !== 'all' ||
    bedsFilterB.size > 0 || bathsFilterB.size > 0 || bedSizeFilterB.size > 0 || roomTypeFilterB.size > 0 ||
    unitTypeFilterB.size > 0 || amenityFilterB.size > 0 || buildingFilterB.size > 0 ||
    adaOnlyB || withRentOnlyB || rentMinB !== '' || rentMaxB !== '';

  function clearFilters() {
    setSearch(''); setLengthFilter(new Set()); setStrategyFilter('all'); setBathroomFilter('all');
    setBedsFilter(new Set()); setBathsFilter(new Set()); setBedSizeFilter(new Set());
    setRoomTypeFilter(new Set()); setUnitTypeFilter(new Set()); setAmenityFilter(new Set());
    setBuildingFilter(new Set()); setAdaOnly(false); setWithRentOnly(false);
    setRentMin(''); setRentMax(''); setSortKey('name'); setElevatorOnly(false); setOwnerLLCFilter(new Set());
  }
  function clearFiltersB() {
    setSearchB(''); setLengthFilterB(new Set()); setStrategyFilterB('all'); setBathroomFilterB('all');
    setBedsFilterB(new Set()); setBathsFilterB(new Set()); setBedSizeFilterB(new Set());
    setRoomTypeFilterB(new Set()); setUnitTypeFilterB(new Set()); setAmenityFilterB(new Set());
    setBuildingFilterB(new Set()); setAdaOnlyB(false); setWithRentOnlyB(false);
    setRentMinB(''); setRentMaxB('');
  }

  const filteredBuildings = useMemo(() => {
    return buildings
      .filter((b) =>
        (buildingFilter.size === 0 || buildingFilter.has(b.id)) &&
        (!elevatorOnly || b.has_elevator) &&
        (ownerLLCFilter.size === 0 || ownerLLCFilter.has(b.owner_llc ?? ''))
      )
      .map((b) => {
        const bNameMatch = !search.trim() || [b.name, b.full_name, b.address].filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase());
        return {
          ...b,
          units: b.units
            .map((u) => {
              const utA = unitTypeFilter.size === 0 || unitTypeFilter.has(u.unit_type ?? 'unset');
              const utB = unitTypeFilterB.size === 0 || unitTypeFilterB.has(u.unit_type ?? 'unset');
              return {
                ...u,
                rooms: [...u.rooms]
                  .filter((r) => {
                    const mA = utA && roomMatches(r);
                    const mB = utB && roomMatchesB(r);
                    return compareMode ? (mA || mB) : mA;
                  })
                  .sort((a, c) => {
                    if (sortKey === 'rent_desc') return rentOf(c) - rentOf(a);
                    if (sortKey === 'rent_asc') return rentOf(a) - rentOf(c);
                    if (sortKey === 'revenue_desc')
                      return Number(c.financials?.revenue_year || 0) - Number(a.financials?.revenue_year || 0);
                    return (a.name || '').localeCompare(c.name || '');
                  })
              };
            })
            .filter((u) => bNameMatch || u.rooms.length > 0)
        };
      })
      .filter((b) => {
        if (hasAnyFilter || compareMode) {
          if (b.units.some((u) => u.rooms.length > 0)) return true;
          return !search.trim() || [b.name, b.full_name, b.address].filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase());
        }
        return true;
      });
  }, [buildings, buildingFilter, elevatorOnly, ownerLLCFilter, search, unitTypeFilter, unitTypeFilterB, roomMatches, roomMatchesB, compareMode, sortKey, hasAnyFilter]);

  const totals = useMemo(() => ({
    buildings: filteredBuildings.length,
    units: filteredBuildings.reduce((a, b) => a + b.units.length, 0),
    rooms: filteredBuildings.reduce((a, b) => a + b.units.reduce((aa, u) => aa + u.rooms.length, 0), 0),
    ltr: filteredBuildings.reduce((a, b) => a + b.units.reduce((aa, u) => aa + u.rooms.filter((r) => r.length === 'LTR').length, 0), 0),
    str: filteredBuildings.reduce((a, b) => a + b.units.reduce((aa, u) => aa + u.rooms.filter((r) => r.length === 'STR').length, 0), 0),
    monthlyRent: filteredBuildings.reduce((a, b) => a + b.units.reduce((aa, u) => aa + u.rooms.reduce((aaa, r) => aaa + rentOf(r), 0), 0), 0),
    annualRevenue: filteredBuildings.reduce((a, b) => a + b.units.reduce((aa, u) => aa + u.rooms.reduce((aaa, r) => aaa + Number(r.financials?.revenue_year || 0), 0), 0), 0),
  }), [filteredBuildings]);

  // Compare stats + charts
  const compareStats = useMemo(() => {
    if (!compareMode) return null;
    const roomsA = buildings.flatMap((b) => b.units.flatMap((u) => {
      const ok = unitTypeFilter.size === 0 || unitTypeFilter.has(u.unit_type ?? 'unset');
      return ok ? u.rooms.filter(roomMatches) : [];
    }));
    const roomsB = buildings.flatMap((b) => b.units.flatMap((u) => {
      const ok = unitTypeFilterB.size === 0 || unitTypeFilterB.has(u.unit_type ?? 'unset');
      return ok ? u.rooms.filter(roomMatchesB) : [];
    }));
    const stat = (rooms: Room[]) => ({
      rooms: rooms.length,
      ltr: rooms.filter((r) => r.length === 'LTR').length,
      str: rooms.filter((r) => r.length === 'STR').length,
      monthlyRent: rooms.reduce((s, r) => s + rentOf(r), 0),
      annualRevenue: rooms.reduce((s, r) => s + Number(r.financials?.revenue_year || 0), 0),
      avgRent: rooms.length ? rooms.reduce((s, r) => s + rentOf(r), 0) / (rooms.filter((r) => rentOf(r) > 0).length || 1) : 0,
    });
    return { a: stat(roomsA), b: stat(roomsB) };
  }, [compareMode, buildings, roomMatches, roomMatchesB, unitTypeFilter, unitTypeFilterB]);

  const compareRoomsChartOption = useMemo(() => {
    if (!compareStats) return null;
    return {
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e5e7eb', textStyle: { color: '#374151' } },
      legend: { data: ['Set A', 'Set B'], bottom: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
      grid: { left: 8, right: 8, top: 12, bottom: 36, containLabel: true },
      xAxis: { type: 'category', data: ['Total Rooms', 'LTR Rooms', 'STR Rooms'], axisLabel: { color: '#6b7280', fontSize: 11 }, axisLine: { lineStyle: { color: '#e5e7eb' } } },
      yAxis: { type: 'value', minInterval: 1, axisLabel: { color: '#9ca3af', fontSize: 10 }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
      series: [
        { name: 'Set A', type: 'bar', barMaxWidth: 40, data: [compareStats.a.rooms, compareStats.a.ltr, compareStats.a.str], itemStyle: { color: '#0d9488', borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top', fontSize: 11, color: '#0d9488', fontWeight: 600 } },
        { name: 'Set B', type: 'bar', barMaxWidth: 40, data: [compareStats.b.rooms, compareStats.b.ltr, compareStats.b.str], itemStyle: { color: '#d97706', borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top', fontSize: 11, color: '#d97706', fontWeight: 600 } },
      ],
    };
  }, [compareStats]);

  const compareRevenueChartOption = useMemo(() => {
    if (!compareStats) return null;
    return {
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e5e7eb', textStyle: { color: '#374151' } },
      legend: { data: ['Set A', 'Set B'], bottom: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
      grid: { left: 8, right: 8, top: 12, bottom: 36, containLabel: true },
      xAxis: { type: 'category', data: ['Monthly Rent', 'Annual Revenue', 'Avg Rent/Room'], axisLabel: { color: '#6b7280', fontSize: 11 }, axisLine: { lineStyle: { color: '#e5e7eb' } } },
      yAxis: { type: 'value', axisLabel: { color: '#9ca3af', fontSize: 10, formatter: (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}` }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
      series: [
        { name: 'Set A', type: 'bar', barMaxWidth: 40, data: [compareStats.a.monthlyRent, compareStats.a.annualRevenue, compareStats.a.avgRent], itemStyle: { color: '#0d9488', borderRadius: [4, 4, 0, 0] } },
        { name: 'Set B', type: 'bar', barMaxWidth: 40, data: [compareStats.b.monthlyRent, compareStats.b.annualRevenue, compareStats.b.avgRent], itemStyle: { color: '#d97706', borderRadius: [4, 4, 0, 0] } },
      ],
    };
  }, [compareStats]);

  const compareMixChartA = useMemo(() => {
    if (!compareStats || compareStats.a.ltr + compareStats.a.str === 0) return null;
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { show: false },
      series: [{ type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'], data: [{ value: compareStats.a.ltr, name: 'LTR', itemStyle: { color: '#0d9488' } }, { value: compareStats.a.str, name: 'STR', itemStyle: { color: '#5eead4' } }], label: { show: true, formatter: '{b}\n{c}', fontSize: 11, color: '#374151' } }],
    };
  }, [compareStats]);

  const compareMixChartB = useMemo(() => {
    if (!compareStats || compareStats.b.ltr + compareStats.b.str === 0) return null;
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { show: false },
      series: [{ type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'], data: [{ value: compareStats.b.ltr, name: 'LTR', itemStyle: { color: '#d97706' } }, { value: compareStats.b.str, name: 'STR', itemStyle: { color: '#fcd34d' } }], label: { show: true, formatter: '{b}\n{c}', fontSize: 11, color: '#374151' } }],
    };
  }, [compareStats]);

  // ── Room compare tag ──────────────────────────────────────────────────
  const roomCompareTag = useMemo((): Map<string, 'A' | 'B' | 'AB'> => {
    if (!compareMode) return new Map();
    const m = new Map<string, 'A' | 'B' | 'AB'>();
    buildings.forEach((b) => b.units.forEach((u) => {
      const utA = unitTypeFilter.size === 0 || unitTypeFilter.has(u.unit_type ?? 'unset');
      const utB = unitTypeFilterB.size === 0 || unitTypeFilterB.has(u.unit_type ?? 'unset');
      u.rooms.forEach((r) => {
        const mA = utA && roomMatches(r), mB = utB && roomMatchesB(r);
        if (mA || mB) m.set(r.id, mA && mB ? 'AB' : mA ? 'A' : 'B');
      });
    }));
    return m;
  }, [compareMode, buildings, roomMatches, roomMatchesB, unitTypeFilter, unitTypeFilterB]);

  // ── CRUD helpers ──────────────────────────────────────────────────────
  async function flipLength(r: Room) {
    setBusyIds((s) => new Set(s).add(r.id));
    const next: Length = r.length === 'LTR' ? 'STR' : 'LTR';
    try {
      await callJSON(`${API_URL}/api/portfolio/rooms/${r.id}`, 'PATCH', { length: next });
      setBuildings((prev) =>
        prev.map((b) => ({ ...b, units: b.units.map((u) => ({ ...u, rooms: u.rooms.map((rm) => rm.id === r.id ? { ...rm, length: next } : rm) })) }))
      );
      toast.success(`Set to ${next}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusyIds((s) => { const n = new Set(s); n.delete(r.id); return n; });
    }
  }

  async function loadMonthly(buildingId: string) {
    setLoadingPerf(true);
    try {
      const res = await fetch(`${API_URL}/api/portfolio/monthly-performance?building_id=${buildingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const d = await res.json();
      setMonthlyByBuilding((prev) => ({ ...prev, [buildingId]: d.rows || [] }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoadingPerf(false);
    }
  }

  // Building CRUD
  async function saveBuilding() {
    if (!buildingDraft.name?.trim()) { toast.error('Building name required'); return; }
    setBuildingSaving(true);
    const photos = (buildingDraft.photosCsv || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const body = {
      name: buildingDraft.name.trim(), full_name: buildingDraft.full_name || null,
      address: buildingDraft.address || null, owner_llc: buildingDraft.owner_llc || null,
      floors: buildingDraft.floors ?? null, has_elevator: buildingDraft.has_elevator ?? null,
      description: buildingDraft.description || null, photos,
      amenity_ids: Array.from(buildingAmenitySet), notes: buildingDraft.notes || null,
    };
    try {
      if (buildingDraft.id) {
        await callJSON(`${API_URL}/api/portfolio/buildings/${buildingDraft.id}`, 'PATCH', body);
        toast.success(`${body.name} updated`);
      } else {
        await callJSON(`${API_URL}/api/portfolio/buildings`, 'POST', body);
        toast.success(`${body.name} added`);
      }
      setShowBuildingModal(false);
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setBuildingSaving(false);
    }
  }

  async function doDeleteBuilding() {
    if (!confirmDeleteBuilding) return;
    setDeletingBuilding(true);
    try {
      await callJSON(`${API_URL}/api/portfolio/buildings/${confirmDeleteBuilding.id}`, 'DELETE');
      toast.success(`${confirmDeleteBuilding.name} deleted`);
      setConfirmDeleteBuilding(null);
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setDeletingBuilding(false);
    }
  }

  // Unit CRUD
  async function saveUnit() {
    if (!unitModal) return;
    if (!unitDraft.name?.trim()) { toast.error('Apartment name required'); return; }
    setUnitSaving(true);
    try {
      if (unitModal.kind === 'add') {
        await callJSON(`${API_URL}/api/portfolio/units`, 'POST', {
          building_id: unitModal.building.id, name: unitDraft.name.trim(),
          unit_type: unitDraft.unit_type || null, amenity_ids: Array.from(unitAmenitySet),
          notes: unitDraft.notes || null,
        });
        toast.success(`Apartment ${unitDraft.name} added`);
      } else {
        await callJSON(`${API_URL}/api/portfolio/units/${unitModal.unit.id}`, 'PATCH', {
          name: unitDraft.name.trim(), unit_type: unitDraft.unit_type || null,
          amenity_ids: Array.from(unitAmenitySet), notes: unitDraft.notes || null,
        });
        toast.success(`Apartment ${unitDraft.name} updated`);
      }
      setUnitModal(null);
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setUnitSaving(false);
    }
  }

  async function doDeleteUnit() {
    if (!confirmDeleteUnit) return;
    setDeletingUnit(true);
    try {
      await callJSON(`${API_URL}/api/portfolio/units/${confirmDeleteUnit.unit.id}`, 'DELETE');
      toast.success('Apartment deleted');
      setConfirmDeleteUnit(null);
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setDeletingUnit(false);
    }
  }

  // Room CRUD
  async function addCustomAmenity() {
    const n = customAmenityDraft.trim();
    if (!n) return;
    const existing = amenities.find((a) => a.name.toLowerCase() === n.toLowerCase());
    if (existing) {
      setRoomAmenitySet((s) => new Set(s).add(existing.id));
      setCustomAmenityDraft('');
      toast.info(`"${existing.name}" added`);
      return;
    }
    try {
      const created = await callJSON(`${API_URL}/api/portfolio/amenities`, 'POST', { name: n }) as Amenity;
      setAmenities((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setRoomAmenitySet((s) => new Set(s).add(created.id));
      setCustomAmenityDraft('');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  }

  async function saveRoom() {
    if (!roomModal) return;
    if (!roomDraft.name || !String(roomDraft.name).trim()) { toast.error('Room name required'); return; }
    setRoomSaving(true);
    const toNum = (v: unknown) => v != null && v !== '' ? Number(v) : null;
    const body = {
      name: String(roomDraft.name).trim(),
      length: roomDraft.length || null, strategy: roomDraft.strategy || null,
      beds: toNum(roomDraft.beds), baths: toNum(roomDraft.baths),
      bed_size: roomDraft.bed_size || null, bathroom: roomDraft.bathroom || null,
      ceiling_height: roomDraft.ceiling_height || null, balcony: roomDraft.balcony || null,
      room_type_name: roomDraft.room_type_name || null,
      sqft: toNum(roomDraft.sqft), is_ada: roomDraft.is_ada ?? null,
      listing_date: roomDraft.listing_date || null,
      amenity_ids: Array.from(roomAmenitySet), notes: roomDraft.notes || null,
      actual_rent: toNum(roomDraft.actual_rent), base_rent: toNum(roomDraft.base_rent),
      market_rent: toNum(roomDraft.market_rent), actual_rent_with_util: toNum(roomDraft.actual_rent_with_util),
      pessimistic_rent: toNum(roomDraft.pessimistic_rent), concession_rent: toNum(roomDraft.concession_rent),
      concession_rent_with_util: toNum(roomDraft.concession_rent_with_util),
      adjustment: toNum(roomDraft.adjustment), stake_5_cashback: toNum(roomDraft.stake_5_cashback),
      stake_8_cashback: toNum(roomDraft.stake_8_cashback), revenue_month: toNum(roomDraft.revenue_month),
      revenue_year: toNum(roomDraft.revenue_year), revenue_per_apartment: toNum(roomDraft.revenue_per_apartment),
      extras: roomDraft.extras || null,
    };
    try {
      if (roomModal.kind === 'add') {
        await callJSON(`${API_URL}/api/portfolio/rooms`, 'POST', { ...body, unit_id: roomModal.unit.id });
        toast.success(`Room ${body.name} added`);
      } else {
        await callJSON(`${API_URL}/api/portfolio/rooms/${roomModal.room.id}`, 'PATCH', body);
        toast.success(`Room ${body.name} updated`);
      }
      setRoomModal(null);
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setRoomSaving(false);
    }
  }

  async function doDeleteRoom() {
    if (!confirmDeleteRoom) return;
    setDeletingRoom(true);
    try {
      await callJSON(`${API_URL}/api/portfolio/rooms/${confirmDeleteRoom.room.id}`, 'DELETE');
      toast.success('Room deleted');
      setConfirmDeleteRoom(null);
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setDeletingRoom(false);
    }
  }

  // Monthly perf CRUD
  async function savePerf() {
    if (!perfDraft.period_year || !perfDraft.period_month) { toast.error('Year and month required'); return; }
    setPerfSaving(true);
    try {
      const isEdit = !!perfDraft.id;
      const url = isEdit
        ? `${API_URL}/api/portfolio/monthly-performance/${perfDraft.id}`
        : `${API_URL}/api/portfolio/monthly-performance`;
      const body: Record<string, unknown> = {
        occupancy_pct: perfDraft.occupancy_pct ?? null, adr: perfDraft.adr ?? null,
        revpar: perfDraft.revpar ?? null, revenue: perfDraft.revenue ?? null, notes: perfDraft.notes || null,
      };
      if (!isEdit) { body.building_id = perfDraft.building_id; body.period_year = perfDraft.period_year; body.period_month = perfDraft.period_month; }
      await callJSON(url, isEdit ? 'PATCH' : 'POST', body);
      toast.success(isEdit ? 'Updated' : 'Added');
      setShowPerfModal(false);
      if (perfDraft.building_id) await loadMonthly(perfDraft.building_id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setPerfSaving(false);
    }
  }

  async function doDeletePerf() {
    if (!confirmDeletePerf) return;
    try {
      await callJSON(`${API_URL}/api/portfolio/monthly-performance/${confirmDeletePerf.id}`, 'DELETE');
      const bid = confirmDeletePerf.building_id;
      setConfirmDeletePerf(null);
      toast.success('Deleted');
      await loadMonthly(bid);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  }

  // ── Filter panel ──────────────────────────────────────────────────────
  function FilterPanel({ color = 'teal', isB = false }: { color?: 'teal' | 'amber'; isB?: boolean }) {
    const lf = isB ? lengthFilterB : lengthFilter;
    const sf = isB ? strategyFilterB : strategyFilter;
    const bf = isB ? bathroomFilterB : bathroomFilter;
    const bedsF = isB ? bedsFilterB : bedsFilter;
    const bathsF = isB ? bathsFilterB : bathsFilter;
    const bsf = isB ? bedSizeFilterB : bedSizeFilter;
    const rtf = isB ? roomTypeFilterB : roomTypeFilter;
    const utf = isB ? unitTypeFilterB : unitTypeFilter;
    const af = isB ? amenityFilterB : amenityFilter;
    const bldF = isB ? buildingFilterB : buildingFilter;
    const ada = isB ? adaOnlyB : adaOnly;
    const wro = isB ? withRentOnlyB : withRentOnly;
    const rmin = isB ? rentMinB : rentMin;
    const rmax = isB ? rentMaxB : rentMax;

    const setLF = isB ? setLengthFilterB : setLengthFilter;
    const setSF = isB ? (v: 'all'|'Coliving'|'Entire Apt'|'unset') => setStrategyFilterB(v) : (v: 'all'|'Coliving'|'Entire Apt'|'unset') => setStrategyFilter(v);
    const setBF = isB ? (v: 'all'|'Private'|'Shared') => setBathroomFilterB(v) : (v: 'all'|'Private'|'Shared') => setBathroomFilter(v);

    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <ChipGroup label="Length" options={['LTR', 'STR', 'unset']} active={lf} onToggle={(v) => setLF((s) => toggleSet(s, v))} color={color} />
        <RadioGroup label="Strategy" options={['all', 'Coliving', 'Entire Apt', 'unset']} value={sf} onChange={setSF} color={color} />
        <RadioGroup label="Bathroom" options={['all', 'Private', 'Shared']} value={bf} onChange={setBF} color={color} />
        {unitTypeOptions.length > 0 && <div className="col-span-2 sm:col-span-3"><ChipGroup label="Unit type" options={unitTypeOptions} active={utf} onToggle={(v) => (isB ? setUnitTypeFilterB : setUnitTypeFilter)((s) => toggleSet(s, v))} color={color} /></div>}
        {bedsOptions.length > 0 && <ChipGroup label="Beds" options={bedsOptions} active={bedsF} onToggle={(v) => (isB ? setBedsFilterB : setBedsFilter)((s) => toggleSet(s, v))} color={color} />}
        {bathsOptions.length > 0 && <ChipGroup label="Baths" options={bathsOptions} active={bathsF} onToggle={(v) => (isB ? setBathsFilterB : setBathsFilter)((s) => toggleSet(s, v))} color={color} />}
        {bedSizeOptions.length > 0 && <div className="col-span-2 sm:col-span-3"><ChipGroup label="Bed size" options={bedSizeOptions} active={bsf} onToggle={(v) => (isB ? setBedSizeFilterB : setBedSizeFilter)((s) => toggleSet(s, v))} color={color} /></div>}
        {roomTypeOptions.length > 0 && <div className="col-span-2 sm:col-span-3"><ChipGroup label="Room type" options={roomTypeOptions} active={rtf} onToggle={(v) => (isB ? setRoomTypeFilterB : setRoomTypeFilter)((s) => toggleSet(s, v))} color={color} /></div>}
        {buildings.length > 1 && <div className="col-span-2 sm:col-span-3"><ChipGroup label="Buildings" options={buildings.map((b) => b.id)} active={bldF} onToggle={(v) => (isB ? setBuildingFilterB : setBuildingFilter)((s) => toggleSet(s, v))} color={color} /></div>}
        <div className="col-span-2 sm:col-span-3">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Rent ($/mo)</div>
          <div className="flex items-center gap-2">
            <input type="number" min="0" step="50" value={rmin} onChange={(e) => (isB ? setRentMinB : setRentMin)(e.target.value)} placeholder="Min" className="w-20 rounded border border-gray-200 px-2 py-1 text-xs" />
            <span className="text-gray-400">—</span>
            <input type="number" min="0" step="50" value={rmax} onChange={(e) => (isB ? setRentMaxB : setRentMax)(e.target.value)} placeholder="Max" className="w-20 rounded border border-gray-200 px-2 py-1 text-xs" />
          </div>
        </div>
        <div className="col-span-2 sm:col-span-3 flex gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={ada} onChange={(e) => (isB ? setAdaOnlyB : setAdaOnly)(e.target.checked)} className="rounded border-gray-300" />
            <span>ADA only</span>
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={wro} onChange={(e) => (isB ? setWithRentOnlyB : setWithRentOnly)(e.target.checked)} className="rounded border-gray-300" />
            <span>Has rent</span>
          </label>
        </div>
        {!isB && (
          <div className="col-span-2 sm:col-span-3 flex gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={elevatorOnly} onChange={(e) => setElevatorOnly(e.target.checked)} className="rounded border-gray-300" />
              <span>Has elevator</span>
            </label>
            {ownerLLCOptions.length > 0 && <ChipGroup label="Owner LLC" options={ownerLLCOptions} active={ownerLLCFilter} onToggle={(v) => setOwnerLLCFilter((s) => toggleSet(s, v))} color={color} />}
          </div>
        )}
        {amenities.length > 0 && (
          <div className="col-span-2 sm:col-span-3">
            <ChipGroup label="Amenities" options={amenities.map((a) => a.id)} active={af} onToggle={(v) => (isB ? setAmenityFilterB : setAmenityFilter)((s) => toggleSet(s, v))} color={color} />
            <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-gray-400">
              {Array.from(af).map((id) => amenitiesById.get(id)?.name).filter(Boolean).join(', ')}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Room pill ─────────────────────────────────────────────────────────
  function RoomPill({ r, b, u }: { r: Room; b: Building; u: Unit }) {
    const tag = roomCompareTag.get(r.id);
    const tagColor = tag === 'A' ? 'bg-teal-600' : tag === 'B' ? 'bg-amber-500' : tag === 'AB' ? 'bg-gradient-to-r from-teal-600 to-amber-500' : '';
    const rent = rentOf(r);
    const isBusy = busyIds.has(r.id);

    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs hover:border-gray-200 group">
        {compareMode && tag && <span className={`inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold text-white shrink-0 ${tagColor}`}>{tag}</span>}
        <span className="flex-1 font-medium text-gray-800 truncate">{r.name}</span>
        {r.length && (
          <button onClick={() => flipLength(r)} disabled={isBusy}
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium transition ${r.length === 'LTR' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'} disabled:opacity-60`}
            title="Click to toggle LTR/STR">
            {isBusy ? '…' : r.length}
          </button>
        )}
        {r.strategy && <span className="shrink-0 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] text-purple-700">{r.strategy}</span>}
        {r.beds != null && <span className="shrink-0 text-gray-400">{r.beds}bd</span>}
        {r.baths != null && <span className="shrink-0 text-gray-400">{r.baths}ba</span>}
        {rent > 0 && <span className="shrink-0 font-semibold text-emerald-700">{fmtMoney(rent, true)}</span>}
        {r.is_ada && <Accessibility className="h-3 w-3 text-gray-400 shrink-0" />}
        {effectiveMode === 'owner' && isOwner && (
          <div className="hidden group-hover:flex gap-1 shrink-0">
            <button onClick={() => { setRoomModal({ kind: 'edit', building: b, unit: u, room: r }); setRoomDraft({ ...r, ...(r.financials || {}) }); setRoomAmenitySet(new Set(r.amenity_ids || [])); setCustomAmenityDraft(''); }} className="rounded p-0.5 hover:bg-gray-100"><Pencil className="h-3 w-3 text-gray-400" /></button>
            <button onClick={() => setConfirmDeleteRoom({ building: b, unit: u, room: r })} className="rounded p-0.5 hover:bg-gray-100"><Trash2 className="h-3 w-3 text-red-400" /></button>
          </div>
        )}
      </div>
    );
  }

  // ── Input helper ──────────────────────────────────────────────────────
  const inp = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500';

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50">
            <LayoutGrid className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Portfolio</h1>
            <p className="text-sm text-gray-500">Buildings, units, rooms, amenities, and financials.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isOwner && (
            <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs">
              {([['owner','Editor'],['investor','Cards'],['operator','Amenities']] as const).map(([k, label]) => (
                <button key={k} onClick={() => { setMode(k); setModeChosen(true); }}
                  className={`rounded-md px-2 py-1 transition ${effectiveMode === k ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {effectiveMode === 'owner' && (
            <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs">
              <button onClick={() => { setExpandedBuildings(new Set(buildings.map((b) => b.id))); setExpandedUnits(new Set(buildings.flatMap((b) => b.units.map((u) => u.id)))); }} className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-50">Expand all</button>
              <button onClick={() => { setExpandedBuildings(new Set()); setExpandedUnits(new Set()); }} className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-50">Collapse all</button>
            </div>
          )}
          <button onClick={() => { setCompareMode((v) => !v); if (compareMode) clearFiltersB(); }}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${compareMode ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
            <Columns className="h-4 w-4" /> {compareMode ? 'Exit compare' : 'Compare'}
          </button>
          <button onClick={() => load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {effectiveMode === 'owner' && isOwner && (
            <button onClick={() => { setBuildingDraft({ name: '', full_name: '', address: '', owner_llc: '', has_elevator: false, photosCsv: '' }); setBuildingAmenitySet(new Set()); setShowBuildingModal(true); }}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
              <Plus className="h-4 w-4" /> Add building
            </button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {[
          { label: 'Buildings', value: totals.buildings, Icon: Building2, tint: 'bg-blue-50 text-blue-700', fmt: 'n' },
          { label: 'Units', value: totals.units, Icon: Layers, tint: 'bg-purple-50 text-purple-700', fmt: 'n' },
          { label: 'Rooms', value: totals.rooms, Icon: Bed, tint: 'bg-amber-50 text-amber-700', fmt: 'n' },
          { label: 'LTR rooms', value: totals.ltr, Icon: ArrowUpDown, tint: 'bg-teal-50 text-teal-700', fmt: 'n' },
          { label: 'STR rooms', value: totals.str, Icon: ArrowUpDown, tint: 'bg-orange-50 text-orange-700', fmt: 'n' },
          { label: 'Monthly rent', value: totals.monthlyRent, Icon: DollarSign, tint: 'bg-emerald-50 text-emerald-700', fmt: '$' },
          { label: 'Annual rev.', value: totals.annualRevenue, Icon: TrendingUp, tint: 'bg-indigo-50 text-indigo-700', fmt: '$' },
        ].map(({ label, value, Icon, tint, fmt }) => (
          <div key={label} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tint}`}><Icon className="h-5 w-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
              <div className="text-xl font-semibold text-gray-900">{loading ? '…' : fmt === '$' ? fmtMoney(value, true) : value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <section className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search building, unit, room, amenity…"
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-9 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>}
          </div>
          <button onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <ListFilter className="h-4 w-4" /> {showFilters ? 'Hide' : 'Show'} filters
            {hasAnyFilter && <span className="ml-1 rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-medium text-white">on</span>}
          </button>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <option value="name">Sort: Name</option>
            <option value="rent_desc">Sort: Rent ↓</option>
            <option value="rent_asc">Sort: Rent ↑</option>
            <option value="revenue_desc">Sort: Revenue ↓</option>
          </select>
          {hasAnyFilter && <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"><X className="h-3.5 w-3.5" /> Clear</button>}
        </div>

        {showFilters && (
          compareMode ? (
            <div className="mt-3 grid gap-4 border-t border-gray-100 pt-3 lg:grid-cols-2">
              <div className="rounded-lg border-2 border-teal-200 bg-teal-50/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-teal-700"><span className="flex h-5 w-5 items-center justify-center rounded bg-teal-600 text-[10px] font-bold text-white">A</span> Set A</span>
                  {hasAnyFilter && <button onClick={clearFilters} className="text-xs text-teal-600 hover:underline">Clear</button>}
                </div>
                <FilterPanel color="teal" isB={false} />
              </div>
              <div className="rounded-lg border-2 border-amber-200 bg-amber-50/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-amber-700"><span className="flex h-5 w-5 items-center justify-center rounded bg-amber-500 text-[10px] font-bold text-white">B</span> Set B</span>
                  {hasAnyFilterB && <button onClick={clearFiltersB} className="text-xs text-amber-600 hover:underline">Clear</button>}
                </div>
                <FilterPanel color="amber" isB={true} />
              </div>
            </div>
          ) : (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <FilterPanel color="teal" isB={false} />
            </div>
          )
        )}
      </section>

      {/* Compare charts */}
      {compareMode && compareStats && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Room Counts — A vs B</h3>
            {compareRoomsChartOption && <EChart option={compareRoomsChartOption} style={{ height: 220 }} />}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Revenue — A vs B</h3>
            {compareRevenueChartOption && <EChart option={compareRevenueChartOption} style={{ height: 220 }} />}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Set A — LTR / STR Mix</h3>
            {compareMixChartA ? <EChart option={compareMixChartA} style={{ height: 200 }} /> : <p className="text-center text-sm text-gray-400 py-8">No data</p>}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Set B — LTR / STR Mix</h3>
            {compareMixChartB ? <EChart option={compareMixChartB} style={{ height: 200 }} /> : <p className="text-center text-sm text-gray-400 py-8">No data</p>}
          </div>
          {/* Compare table */}
          <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Metric</th>
                  <th className="px-4 py-3 text-right text-teal-700">Set A</th>
                  <th className="px-4 py-3 text-right text-amber-700">Set B</th>
                  <th className="px-4 py-3 text-right">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {([
                  { label: 'Rooms', a: compareStats.a.rooms, b: compareStats.b.rooms, fmt: 'n' },
                  { label: 'LTR Rooms', a: compareStats.a.ltr, b: compareStats.b.ltr, fmt: 'n' },
                  { label: 'STR Rooms', a: compareStats.a.str, b: compareStats.b.str, fmt: 'n' },
                  { label: 'Monthly Rent', a: compareStats.a.monthlyRent, b: compareStats.b.monthlyRent, fmt: '$' },
                  { label: 'Annual Revenue', a: compareStats.a.annualRevenue, b: compareStats.b.annualRevenue, fmt: '$' },
                  { label: 'Avg Rent/Room', a: compareStats.a.avgRent, b: compareStats.b.avgRent, fmt: '$' },
                ] as { label: string; a: number; b: number; fmt: 'n' | '$' }[]).map(({ label, a, b, fmt }) => {
                  const delta = a - b;
                  return (
                    <tr key={label}>
                      <td className="px-4 py-2 text-gray-700">{label}</td>
                      <td className="px-4 py-2 text-right font-medium text-teal-700">{fmt === '$' ? fmtMoney(a) : a}</td>
                      <td className="px-4 py-2 text-right font-medium text-amber-700">{fmt === '$' ? fmtMoney(b) : b}</td>
                      <td className={`px-4 py-2 text-right font-medium ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {delta > 0 ? '+' : ''}{fmt === '$' ? fmtMoney(delta) : delta}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main content */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Spinner size="lg" /><span className="ml-3 text-gray-600">Loading portfolio…</span></div>
      ) : loadError ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{loadError}</div>
      ) : filteredBuildings.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-400">No buildings match filters.</div>
      ) : effectiveMode === 'investor' ? (
        // ── Investor: card grid ───────────────────────────────────────
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBuildings.map((b) => (
            <div key={b.id} className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => { setBuildingDraft({ ...b, photosCsv: (b.photos || []).join(', ') }); setBuildingAmenitySet(new Set(b.amenity_ids || [])); }}>
              {b.photos?.[0] && <img src={b.photos[0]} alt={b.name} className="w-full h-36 object-cover rounded-lg mb-3" loading="lazy" />}
              <h3 className="font-semibold text-gray-900">{b.full_name || b.name}</h3>
              {b.address && <p className="text-xs text-gray-500 mt-0.5">{b.address}</p>}
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">{b.units.length} units</span>
                <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">{b.units.reduce((a, u) => a + u.rooms.length, 0)} rooms</span>
                {b.has_elevator && <span className="px-2 py-1 rounded-full bg-green-50 text-green-700">Elevator</span>}
                {b.owner_llc && <span className="px-2 py-1 rounded-full bg-purple-50 text-purple-700">{b.owner_llc}</span>}
              </div>
              <div className="mt-3 border-t border-gray-100 pt-3 flex justify-between text-xs">
                <span className="text-gray-500">Monthly rent</span>
                <span className="font-semibold text-emerald-700">{fmtMoney(b.units.reduce((a, u) => a + u.rooms.reduce((aa, r) => aa + rentOf(r), 0), 0), true)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : effectiveMode === 'operator' ? (
        // ── Operator: amenity list ────────────────────────────────────
        <div className="space-y-4">
          {filteredBuildings.map((b) => (
            <div key={b.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{b.name}</h3>
                <span className="text-xs text-gray-500">{b.units.reduce((a, u) => a + u.rooms.length, 0)} rooms</span>
              </div>
              <div className="p-4 space-y-3">
                {b.amenity_ids?.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">Building amenities</div>
                    <div className="flex flex-wrap gap-1">{b.amenity_ids.map((id) => <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{nameOfAmenity(id) || id}</span>)}</div>
                  </div>
                )}
                {b.units.map((u) => (
                  <div key={u.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="font-medium text-sm text-gray-800 mb-2">{u.name}</div>
                    {u.amenity_ids?.length > 0 && <div className="flex flex-wrap gap-1 mb-2">{u.amenity_ids.map((id) => <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">{nameOfAmenity(id) || id}</span>)}</div>}
                    {u.rooms.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-xs py-1 border-t border-gray-50">
                        <span className="font-medium text-gray-700 w-24 shrink-0">{r.name}</span>
                        <div className="flex flex-wrap gap-1 flex-1">{r.amenity_ids?.map((id) => <span key={id} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{nameOfAmenity(id) || id}</span>)}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // ── Owner: expandable tree ────────────────────────────────────
        <div className="space-y-3">
          {filteredBuildings.map((b) => {
            const bExpanded = expandedBuildings.has(b.id);
            const bRent = b.units.reduce((a, u) => a + u.rooms.reduce((aa, r) => aa + rentOf(r), 0), 0);
            const bRev = b.units.reduce((a, u) => a + u.rooms.reduce((aa, r) => aa + Number(r.financials?.revenue_year || 0), 0), 0);
            return (
              <div key={b.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                {/* Building header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <button onClick={() => setExpandedBuildings((s) => { const n = new Set(s); n.has(b.id) ? n.delete(b.id) : n.add(b.id); return n; })}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left">
                    {bExpanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                    <Building2 className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="font-semibold text-gray-900 truncate">{b.name}</span>
                    {b.full_name && b.full_name !== b.name && <span className="text-sm text-gray-500 truncate">— {b.full_name}</span>}
                    {b.address && <span className="text-xs text-gray-400 truncate hidden md:block">{b.address}</span>}
                  </button>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500">
                    <span>{b.units.length} units · {b.units.reduce((a, u) => a + u.rooms.length, 0)} rooms</span>
                    {bRent > 0 && <span className="text-emerald-700 font-semibold">{fmtMoney(bRent, true)}/mo</span>}
                    {bRev > 0 && <span className="text-indigo-700">{fmtMoney(bRev, true)}/yr</span>}
                    {b.has_elevator && <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700">Elevator</span>}
                  </div>
                  {isOwner && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setUnitModal({ kind: 'add', building: b }); setUnitDraft({ name: '' }); setUnitAmenitySet(new Set()); }} className="rounded p-1 hover:bg-gray-100 text-teal-600" title="Add unit"><Plus className="h-4 w-4" /></button>
                      <button onClick={() => { setBuildingDraft({ ...b, photosCsv: (b.photos || []).join(', ') }); setBuildingAmenitySet(new Set(b.amenity_ids || [])); setShowBuildingModal(true); }} className="rounded p-1 hover:bg-gray-100"><Pencil className="h-4 w-4 text-gray-400" /></button>
                      <button onClick={() => { setFinancialsBuildingId(financialsBuildingId === b.id ? null : b.id); if (financialsBuildingId !== b.id && !monthlyByBuilding[b.id]) loadMonthly(b.id); }} className="rounded p-1 hover:bg-gray-100" title="Monthly performance"><TrendingUp className={`h-4 w-4 ${financialsBuildingId === b.id ? 'text-teal-600' : 'text-gray-400'}`} /></button>
                      <button onClick={() => setConfirmDeleteBuilding(b)} className="rounded p-1 hover:bg-gray-100"><Trash2 className="h-4 w-4 text-red-400" /></button>
                    </div>
                  )}
                </div>

                {/* Monthly perf panel */}
                {financialsBuildingId === b.id && (
                  <div className="border-b border-gray-200 bg-indigo-50/40 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700">Monthly Performance</h4>
                      {isOwner && <button onClick={() => { setPerfDraft({ building_id: b.id, period_year: new Date().getFullYear(), period_month: new Date().getMonth() + 1 }); setShowPerfModal(true); }} className="inline-flex items-center gap-1 text-xs bg-teal-600 text-white px-2 py-1 rounded hover:bg-teal-700"><Plus className="h-3 w-3" /> Add</button>}
                    </div>
                    {loadingPerf ? <Spinner size="sm" /> : (
                      <div className="overflow-x-auto">
                        <table className="text-xs w-full">
                          <thead><tr className="text-gray-400">{['Month','Occ%','ADR','RevPAR','Revenue',''].map((h) => <th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr></thead>
                          <tbody className="divide-y divide-indigo-100">
                            {(monthlyByBuilding[b.id] || []).map((row) => (
                              <tr key={row.id}>
                                <td className="px-2 py-1 font-medium">{MONTHS[row.period_month - 1]} {row.period_year}</td>
                                <td className="px-2 py-1">{row.occupancy_pct != null ? `${Number(row.occupancy_pct).toFixed(1)}%` : '—'}</td>
                                <td className="px-2 py-1">{fmtMoney(row.adr)}</td>
                                <td className="px-2 py-1">{fmtMoney(row.revpar)}</td>
                                <td className="px-2 py-1">{fmtMoney(row.revenue)}</td>
                                <td className="px-2 py-1">
                                  {isOwner && <div className="flex gap-1">
                                    <button onClick={() => { setPerfDraft({ ...row }); setShowPerfModal(true); }}><Pencil className="h-3 w-3 text-gray-400 hover:text-gray-600" /></button>
                                    <button onClick={() => setConfirmDeletePerf(row)}><Trash2 className="h-3 w-3 text-red-400 hover:text-red-600" /></button>
                                  </div>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {(monthlyByBuilding[b.id] || []).length === 0 && <p className="text-xs text-gray-400 py-2">No performance data yet.</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Units */}
                {bExpanded && (
                  <div className="p-3 space-y-2">
                    {b.units.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No units. {isOwner && 'Add one above.'}</p>
                    ) : b.units.map((u) => {
                      const uExpanded = expandedUnits.has(u.id);
                      const uRent = u.rooms.reduce((a, r) => a + rentOf(r), 0);
                      return (
                        <div key={u.id} className="rounded-lg border border-gray-100 overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/50">
                            <button onClick={() => setExpandedUnits((s) => { const n = new Set(s); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n; })}
                              className="flex items-center gap-2 flex-1 text-left">
                              {uExpanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                              <Layers className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                              <span className="text-sm font-medium text-gray-800">{u.name}</span>
                              {u.unit_type && <span className="text-xs text-gray-400">{u.unit_type}</span>}
                              <span className="text-xs text-gray-400">{u.rooms.length} rooms</span>
                              {uRent > 0 && <span className="text-xs text-emerald-700 font-semibold">{fmtMoney(uRent, true)}/mo</span>}
                            </button>
                            {isOwner && (
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => { setRoomModal({ kind: 'add', building: b, unit: u }); setRoomDraft({ name: '' }); setRoomAmenitySet(new Set()); setCustomAmenityDraft(''); }} className="rounded p-1 hover:bg-gray-100 text-teal-600" title="Add room"><Plus className="h-3.5 w-3.5" /></button>
                                <button onClick={() => { setUnitModal({ kind: 'edit', building: b, unit: u }); setUnitDraft({ ...u }); setUnitAmenitySet(new Set(u.amenity_ids || [])); }} className="rounded p-1 hover:bg-gray-100"><Pencil className="h-3.5 w-3.5 text-gray-400" /></button>
                                <button onClick={() => setConfirmDeleteUnit({ building: b, unit: u })} className="rounded p-1 hover:bg-gray-100"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
                              </div>
                            )}
                          </div>
                          {uExpanded && (
                            <div className="p-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                              {u.rooms.length === 0 ? (
                                <p className="col-span-full text-xs text-gray-400 py-2 text-center">No rooms. {isOwner && 'Add one.'}</p>
                              ) : u.rooms.map((r) => <RoomPill key={r.id} r={r} b={b} u={u} />)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}

      {/* Building modal */}
      {showBuildingModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">{buildingDraft.id ? 'Edit Building' : 'Add Building'}</h2>
              <button onClick={() => setShowBuildingModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Name *</label><input className={inp} value={buildingDraft.name || ''} onChange={(e) => setBuildingDraft((d) => ({ ...d, name: e.target.value }))} /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Full name</label><input className={inp} value={buildingDraft.full_name || ''} onChange={(e) => setBuildingDraft((d) => ({ ...d, full_name: e.target.value }))} /></div>
                <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">Address</label><input className={inp} value={buildingDraft.address || ''} onChange={(e) => setBuildingDraft((d) => ({ ...d, address: e.target.value }))} /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Owner LLC</label><input className={inp} value={buildingDraft.owner_llc || ''} onChange={(e) => setBuildingDraft((d) => ({ ...d, owner_llc: e.target.value }))} /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Floors</label><input type="number" className={inp} value={buildingDraft.floors ?? ''} onChange={(e) => setBuildingDraft((d) => ({ ...d, floors: e.target.value ? Number(e.target.value) : undefined }))} /></div>
                <div className="sm:col-span-2"><label className="inline-flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!buildingDraft.has_elevator} onChange={(e) => setBuildingDraft((d) => ({ ...d, has_elevator: e.target.checked }))} className="rounded" /><span>Has elevator</span></label></div>
                <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">Photo URLs (comma-separated)</label><textarea className={`${inp} h-20 resize-none`} value={buildingDraft.photosCsv || ''} onChange={(e) => setBuildingDraft((d) => ({ ...d, photosCsv: e.target.value }))} /></div>
                <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">Description</label><textarea className={`${inp} h-16 resize-none`} value={buildingDraft.description || ''} onChange={(e) => setBuildingDraft((d) => ({ ...d, description: e.target.value }))} /></div>
                <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">Notes</label><textarea className={`${inp} h-16 resize-none`} value={buildingDraft.notes || ''} onChange={(e) => setBuildingDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
              </div>
              {amenities.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-700 mb-2">Amenities</div>
                  <div className="flex flex-wrap gap-1">
                    {amenities.map((a) => (
                      <button key={a.id} onClick={() => setBuildingAmenitySet((s) => toggleSet(s, a.id))}
                        className={`text-xs px-2 py-0.5 rounded border transition ${buildingAmenitySet.has(a.id) ? 'border-teal-500 bg-teal-100 text-teal-800' : 'border-gray-200 text-gray-600'}`}>
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button onClick={() => setShowBuildingModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={saveBuilding} disabled={buildingSaving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700 disabled:opacity-60">
                {buildingSaving && <Spinner size="sm" />}<Save className="h-4 w-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unit modal */}
      {unitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">{unitModal.kind === 'add' ? 'Add Unit' : 'Edit Unit'}</h2>
              <button onClick={() => setUnitModal(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Apartment Name *</label><input className={inp} value={unitDraft.name || ''} onChange={(e) => setUnitDraft((d) => ({ ...d, name: e.target.value }))} /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Unit Type</label><input className={inp} value={unitDraft.unit_type || ''} onChange={(e) => setUnitDraft((d) => ({ ...d, unit_type: e.target.value }))} /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Notes</label><textarea className={`${inp} h-16 resize-none`} value={unitDraft.notes || ''} onChange={(e) => setUnitDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
              {amenities.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-700 mb-2">Amenities</div>
                  <div className="flex flex-wrap gap-1">
                    {amenities.map((a) => (
                      <button key={a.id} onClick={() => setUnitAmenitySet((s) => toggleSet(s, a.id))}
                        className={`text-xs px-2 py-0.5 rounded border transition ${unitAmenitySet.has(a.id) ? 'border-teal-500 bg-teal-100 text-teal-800' : 'border-gray-200 text-gray-600'}`}>
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button onClick={() => setUnitModal(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={saveUnit} disabled={unitSaving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700 disabled:opacity-60">
                {unitSaving && <Spinner size="sm" />}<Save className="h-4 w-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room modal */}
      {roomModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">{roomModal.kind === 'add' ? 'Add Room' : 'Edit Room'}</h2>
              <button onClick={() => setRoomModal(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Basic fields */}
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ['name','Room Name *'], ['length','Length (LTR/STR)'], ['strategy','Strategy'], ['bathroom','Bathroom (Private/Shared)'],
                  ['beds','Beds'], ['baths','Baths'], ['bed_size','Bed Size'], ['sqft','Sq Ft'], ['ceiling_height','Ceiling Height'],
                  ['balcony','Balcony'], ['room_type_name','Room Type'], ['listing_date','Listing Date (YYYY-MM-DD)'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                    <input className={inp} value={String(roomDraft[key] ?? '')} onChange={(e) => setRoomDraft((d) => ({ ...d, [key]: e.target.value }))} />
                  </div>
                ))}
                <div className="sm:col-span-2"><label className="inline-flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!roomDraft.is_ada} onChange={(e) => setRoomDraft((d) => ({ ...d, is_ada: e.target.checked }))} className="rounded" /><span>ADA accessible</span></label></div>
              </div>

              {/* Financials */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Financials</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {([
                    ['actual_rent','Actual Rent'], ['base_rent','Base Rent'], ['market_rent','Market Rent'],
                    ['actual_rent_with_util','Actual + Util'], ['pessimistic_rent','Pessimistic Rent'], ['concession_rent','Concession Rent'],
                    ['concession_rent_with_util','Concession + Util'], ['adjustment','Adjustment'], ['stake_5_cashback','Stake 5% Cashback'],
                    ['stake_8_cashback','Stake 8% Cashback'], ['revenue_month','Revenue/Month'], ['revenue_year','Revenue/Year'],
                    ['revenue_per_apartment','Revenue/Apt'],
                  ] as const).map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                      <input type="number" step="0.01" className={inp} value={String(roomDraft[key] ?? '')} onChange={(e) => setRoomDraft((d) => ({ ...d, [key]: e.target.value }))} />
                    </div>
                  ))}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Extras (notes)</label>
                    <input className={inp} value={String(roomDraft.extras ?? '')} onChange={(e) => setRoomDraft((d) => ({ ...d, extras: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Amenities</h3>
                <div className="flex flex-wrap gap-1 mb-3">
                  {amenities.map((a) => (
                    <button key={a.id} onClick={() => setRoomAmenitySet((s) => toggleSet(s, a.id))}
                      className={`text-xs px-2 py-0.5 rounded border transition ${roomAmenitySet.has(a.id) ? 'border-teal-500 bg-teal-100 text-teal-800' : 'border-gray-200 text-gray-600'}`}>
                      {a.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input placeholder="Add custom amenity…" value={customAmenityDraft} onChange={(e) => setCustomAmenityDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomAmenity()}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none" />
                  <button onClick={addCustomAmenity} className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs hover:bg-teal-700">Add</button>
                </div>
              </div>

              {/* Notes */}
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Notes</label><textarea className={`${inp} h-16 resize-none`} value={String(roomDraft.notes ?? '')} onChange={(e) => setRoomDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button onClick={() => setRoomModal(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={saveRoom} disabled={roomSaving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700 disabled:opacity-60">
                {roomSaving && <Spinner size="sm" />}<Save className="h-4 w-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly perf modal */}
      {showPerfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">{perfDraft.id ? 'Edit' : 'Add'} Monthly Perf</h2>
              <button onClick={() => setShowPerfModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-3">
              {!perfDraft.id && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Year</label><input type="number" className={inp} value={perfDraft.period_year ?? ''} onChange={(e) => setPerfDraft((d) => ({ ...d, period_year: Number(e.target.value) }))} /></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Month</label><input type="number" min="1" max="12" className={inp} value={perfDraft.period_month ?? ''} onChange={(e) => setPerfDraft((d) => ({ ...d, period_month: Number(e.target.value) }))} /></div>
                </div>
              )}
              {([['occupancy_pct','Occupancy %'],['adr','ADR ($)'],['revpar','RevPAR ($)'],['revenue','Revenue ($)']] as const).map(([k, label]) => (
                <div key={k}><label className="block text-xs font-medium text-gray-700 mb-1">{label}</label><input type="number" step="0.01" className={inp} value={perfDraft[k] ?? ''} onChange={(e) => setPerfDraft((d) => ({ ...d, [k]: e.target.value !== '' ? Number(e.target.value) : null }))} /></div>
              ))}
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Notes</label><textarea className={`${inp} h-12 resize-none`} value={perfDraft.notes || ''} onChange={(e) => setPerfDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button onClick={() => setShowPerfModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={savePerf} disabled={perfSaving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700 disabled:opacity-60">
                {perfSaving && <Spinner size="sm" />}<Save className="h-4 w-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirms */}
      {confirmDeleteBuilding && <ConfirmModal message={`Delete building "${confirmDeleteBuilding.name}"? This will remove all units and rooms.`} onConfirm={doDeleteBuilding} onCancel={() => setConfirmDeleteBuilding(null)} loading={deletingBuilding} />}
      {confirmDeleteUnit && <ConfirmModal message={`Delete apartment "${confirmDeleteUnit.unit.name}"? All rooms will be removed.`} onConfirm={doDeleteUnit} onCancel={() => setConfirmDeleteUnit(null)} loading={deletingUnit} />}
      {confirmDeleteRoom && <ConfirmModal message={`Delete room "${confirmDeleteRoom.room.name}"?`} onConfirm={doDeleteRoom} onCancel={() => setConfirmDeleteRoom(null)} loading={deletingRoom} />}
      {confirmDeletePerf && <ConfirmModal message="Delete this performance record?" onConfirm={doDeletePerf} onCancel={() => setConfirmDeletePerf(null)} />}
    </div>
  );
}
