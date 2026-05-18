'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Boxes, Building2, ChevronDown, ChevronRight, Plus, Pencil, Trash2,
  MoreHorizontal, Save, X, RefreshCw, Bed, Bath, Layers, ArrowUpDown,
  DollarSign, Calendar, TrendingUp, Accessibility, Search, ListFilter, Eye
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { Spinner } from '@/components/ui/Spinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const inp = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500';

type Length = 'LTR' | 'STR';
type Strategy = 'Coliving' | 'Entire Apt';

type Room = {
  id: string; unit_id: string; name: string;
  length: Length | null; strategy: Strategy | null;
  bed_size: string | null; bathroom: string | null;
  ceiling_height: string | null; balcony: string | null;
  room_type_name: string | null; amenities: string[];
  notes: string | null; base_rent: number | null;
  market_rent: number | null; actual_rent: number | null;
  revenue_year: number | null; revenue_month: number | null;
  is_ada: boolean | null; extras: string | null;
  adjustment?: number | null; actual_rent_with_util?: number | null;
  pessimistic_rent?: number | null; concession_rent?: number | null;
  concession_rent_with_util?: number | null; stake_5_cashback?: number | null;
  stake_8_cashback?: number | null; revenue_per_apartment?: number | null;
  unit_type?: string | null; listing_date?: string | null;
};
type Unit = { id: string; building_id: string; name: string; notes: string | null; rooms: Room[] };
type Building = {
  id: string; name: string; full_name: string | null; address: string | null;
  owner_llc: string | null; units_count: number | null; beds_count: number | null;
  floors: number | null; has_elevator: boolean | null; notes: string | null; units: Unit[];
};
type MonthlyPerf = {
  id: string; building_id: string; period_year: number; period_month: number;
  occupancy_pct: number | null; adr: number | null; revpar: number | null;
  revenue: number | null; notes: string | null;
};

function fmtMoney(v: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (v == null || isNaN(v as number)) return '—';
  const n = Number(v);
  if (opts.compact && Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(v: number | null | undefined): string {
  if (v == null || isNaN(v as number)) return '—';
  return `${Number(v).toFixed(1)}%`;
}
function rentOf(r: Room): number { return Number(r.actual_rent ?? r.base_rent ?? 0) || 0; }

function chipCls(active: boolean) {
  return `rounded-md border px-2 py-1 text-xs font-medium transition cursor-pointer ${active ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`;
}
function lenCls(l: Length | null) {
  if (l === 'LTR') return 'border-teal-300 bg-teal-50 text-teal-800';
  if (l === 'STR') return 'border-orange-300 bg-orange-50 text-orange-800';
  return 'border-gray-200 text-gray-500';
}

function ActionMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50" aria-label="Actions">
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[160px] rounded-lg border border-gray-200 bg-white shadow-lg" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
function MI({ onClick, red, children }: { onClick: () => void; red?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${red ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}>
      {children}
    </button>
  );
}
function MDivider() { return <div className="my-1 border-t border-gray-100" />; }

function ConfirmModal({ title, body, onConfirm, onCancel }: { title: string; body: React.ReactNode; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50"><Trash2 className="h-5 w-5 text-red-600" /></div>
            <div><h3 className="text-base font-semibold text-gray-900">{title}</h3><div className="mt-1 text-sm text-gray-600">{body}</div></div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
          <button onClick={onCancel} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={onConfirm} className="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const { token, user } = useAuthStore();
  const isOwner = (user as { role?: string } | null)?.role === 'owner';

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [allAmenities, setAllAmenities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(new Set<string>());
  const [expandedBuildings, setExpandedBuildings] = useState(new Set<string>());
  const [expandedUnits, setExpandedUnits] = useState(new Set<string>());
  const [financialsBuildingId, setFinancialsBuildingId] = useState<string | null>(null);
  const [detailsRoomId, setDetailsRoomId] = useState<string | null>(null);
  const [monthlyByBuilding, setMonthlyByBuilding] = useState<Record<string, MonthlyPerf[]>>({});
  const [loadingPerf, setLoadingPerf] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [lengthFilter, setLengthFilter] = useState<'all' | 'LTR' | 'STR' | 'unset'>('all');
  const [strategyFilter, setStrategyFilter] = useState<'all' | 'Coliving' | 'Entire Apt' | 'unset'>('all');
  const [bathroomFilter, setBathroomFilter] = useState<'all' | 'Private' | 'Shared'>('all');
  const [bedSizeFilter, setBedSizeFilter] = useState(new Set<string>());
  const [amenityFilter, setAmenityFilter] = useState(new Set<string>());
  const [buildingFilter, setBuildingFilter] = useState(new Set<string>());
  const [adaOnly, setAdaOnly] = useState(false);
  const [withRentOnly, setWithRentOnly] = useState(false);
  const [rentMin, setRentMin] = useState<number | ''>('');
  const [rentMax, setRentMax] = useState<number | ''>('');
  const [sortKey, setSortKey] = useState<'name' | 'rent_desc' | 'rent_asc' | 'revenue_desc'>('name');
  const [showFilters, setShowFilters] = useState(true);

  // Building modal
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [buildingDraft, setBuildingDraft] = useState<Partial<Building>>({});
  const [buildingSaving, setBuildingSaving] = useState(false);
  const [confirmDeleteBuilding, setConfirmDeleteBuilding] = useState<Building | null>(null);

  // Unit modal
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [unitDraft, setUnitDraft] = useState<Partial<Unit & { building_id: string }>>({});
  const [unitSaving, setUnitSaving] = useState(false);
  const [confirmDeleteUnit, setConfirmDeleteUnit] = useState<{ building: Building; unit: Unit } | null>(null);

  // Room modal
  const [showRoomModal, setShowRoomModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [roomDraft, setRoomDraft] = useState<Record<string, any>>({});
  const [roomDraftAmenities, setRoomDraftAmenities] = useState(new Set<string>());
  const [roomCustomAmenity, setRoomCustomAmenity] = useState('');
  const [roomSaving, setRoomSaving] = useState(false);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<{ unit: Unit; room: Room } | null>(null);

  // Monthly perf modal
  const [showPerfModal, setShowPerfModal] = useState(false);
  const [perfDraft, setPerfDraft] = useState<Partial<MonthlyPerf> & { building_id?: string }>({});
  const [perfSaving, setPerfSaving] = useState(false);
  const [confirmDeletePerf, setConfirmDeletePerf] = useState<MonthlyPerf | null>(null);

  const ah = () => ({ Authorization: `Bearer ${token}` });

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/inventory`, { headers: ah() });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      const blds: Building[] = data.buildings || [];
      setBuildings(blds);
      setAllAmenities(data.all_amenities || []);
      if (!silent) setExpandedBuildings(new Set(blds.map(b => b.id)));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [token]);

  function toggleBuilding(id: string) {
    setExpandedBuildings(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleUnit(id: string) {
    setExpandedUnits(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function clearFilters() {
    setSearch(''); setLengthFilter('all'); setStrategyFilter('all'); setBathroomFilter('all');
    setBedSizeFilter(new Set()); setAmenityFilter(new Set()); setBuildingFilter(new Set());
    setAdaOnly(false); setWithRentOnly(false); setRentMin(''); setRentMax(''); setSortKey('name');
  }
  function toggleSetFilter<T>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, v: T) {
    setter(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });
  }

  // ── Building CRUD ──────────────────────────────────────────────────
  function openCreateBuilding() { setBuildingDraft({ name: '', full_name: '', address: '', owner_llc: '', notes: '' }); setShowBuildingModal(true); }
  function openEditBuilding(b: Building) { setBuildingDraft({ ...b }); setShowBuildingModal(true); }

  async function saveBuilding() {
    if (!buildingDraft.name?.trim()) { toast.error('Name is required'); return; }
    setBuildingSaving(true);
    try {
      const isEdit = !!buildingDraft.id;
      const url = isEdit ? `${API_URL}/api/inventory/buildings/${buildingDraft.id}` : `${API_URL}/api/inventory/buildings`;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { ...ah(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: buildingDraft.name.trim(), full_name: buildingDraft.full_name || null,
          address: buildingDraft.address || null, owner_llc: buildingDraft.owner_llc || null,
          floors: buildingDraft.floors ?? null, has_elevator: buildingDraft.has_elevator ?? null,
          notes: buildingDraft.notes || null
        })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Save failed (${res.status})`); }
      toast.success(isEdit ? 'Building updated' : 'Building created');
      setShowBuildingModal(false);
      await load(true);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBuildingSaving(false); }
  }

  async function deleteBuilding() {
    if (!confirmDeleteBuilding) return;
    const b = confirmDeleteBuilding;
    setBusyIds(prev => new Set(prev).add(b.id));
    try {
      const res = await fetch(`${API_URL}/api/inventory/buildings/${b.id}`, { method: 'DELETE', headers: ah() });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Delete failed (${res.status})`); }
      toast.success(`${b.name} deleted`); setConfirmDeleteBuilding(null); await load(true);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setBusyIds(prev => { const n = new Set(prev); n.delete(b.id); return n; }); }
  }

  // ── Unit CRUD ──────────────────────────────────────────────────────
  function openCreateUnit(b: Building) { setUnitDraft({ building_id: b.id, name: '', notes: '' }); setShowUnitModal(true); }
  function openEditUnit(u: Unit) { setUnitDraft({ ...u }); setShowUnitModal(true); }

  async function saveUnit() {
    if (!unitDraft.name?.trim()) { toast.error('Name is required'); return; }
    setUnitSaving(true);
    try {
      const isEdit = !!unitDraft.id;
      const url = isEdit ? `${API_URL}/api/inventory/units/${unitDraft.id}` : `${API_URL}/api/inventory/units`;
      const body: Record<string, unknown> = { name: unitDraft.name.trim(), notes: unitDraft.notes || null };
      if (!isEdit) body.building_id = unitDraft.building_id;
      const res = await fetch(url, { method: isEdit ? 'PATCH' : 'POST', headers: { ...ah(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Save failed (${res.status})`); }
      toast.success(isEdit ? 'Unit updated' : 'Unit created'); setShowUnitModal(false); await load(true);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Save failed'); }
    finally { setUnitSaving(false); }
  }

  async function deleteUnit() {
    if (!confirmDeleteUnit) return;
    const { unit } = confirmDeleteUnit;
    setBusyIds(prev => new Set(prev).add(unit.id));
    try {
      const res = await fetch(`${API_URL}/api/inventory/units/${unit.id}`, { method: 'DELETE', headers: ah() });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Delete failed (${res.status})`); }
      toast.success(`Unit ${unit.name} deleted`); setConfirmDeleteUnit(null); await load(true);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setBusyIds(prev => { const n = new Set(prev); n.delete(unit.id); return n; }); }
  }

  // ── Room CRUD ──────────────────────────────────────────────────────
  function openCreateRoom(u: Unit) {
    setRoomDraft({ unit_id: u.id, name: '', length: null, strategy: null, bed_size: '', bathroom: '', ceiling_height: '', balcony: '', room_type_name: '', notes: '', actual_rent: null, base_rent: null, market_rent: null, revenue_year: null, revenue_month: null, is_ada: null, extras: '' });
    setRoomDraftAmenities(new Set()); setRoomCustomAmenity(''); setShowRoomModal(true);
  }
  function openEditRoom(r: Room) { setRoomDraft({ ...r }); setRoomDraftAmenities(new Set(r.amenities || [])); setRoomCustomAmenity(''); setShowRoomModal(true); }

  function addRoomCustomAmenity() {
    const name = roomCustomAmenity.trim();
    if (!name) return;
    const existing = allAmenities.find(a => a.toLowerCase() === name.toLowerCase());
    const value = existing ?? name;
    if (!allAmenities.includes(value)) setAllAmenities(prev => [...prev, value].sort());
    setRoomDraftAmenities(prev => new Set(prev).add(value));
    setRoomCustomAmenity('');
  }

  async function saveRoom() {
    if (!roomDraft.name?.trim()) { toast.error('Name is required'); return; }
    setRoomSaving(true);
    try {
      const isEdit = !!roomDraft.id;
      const url = isEdit ? `${API_URL}/api/inventory/rooms/${roomDraft.id}` : `${API_URL}/api/inventory/rooms`;
      const body: Record<string, unknown> = {
        name: roomDraft.name.trim(), length: roomDraft.length || null, strategy: roomDraft.strategy || null,
        bed_size: roomDraft.bed_size || null, bathroom: roomDraft.bathroom || null,
        ceiling_height: roomDraft.ceiling_height || null, balcony: roomDraft.balcony || null,
        room_type_name: roomDraft.room_type_name || null, amenities: Array.from(roomDraftAmenities).sort(),
        notes: roomDraft.notes || null, actual_rent: roomDraft.actual_rent ?? null,
        base_rent: roomDraft.base_rent ?? null, market_rent: roomDraft.market_rent ?? null,
        revenue_year: roomDraft.revenue_year ?? null, revenue_month: roomDraft.revenue_month ?? null,
        is_ada: roomDraft.is_ada ?? null, extras: roomDraft.extras || null
      };
      if (!isEdit) body.unit_id = roomDraft.unit_id;
      const res = await fetch(url, { method: isEdit ? 'PATCH' : 'POST', headers: { ...ah(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Save failed (${res.status})`); }
      toast.success(isEdit ? 'Room updated' : 'Room created'); setShowRoomModal(false); await load(true);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Save failed'); }
    finally { setRoomSaving(false); }
  }

  async function deleteRoom() {
    if (!confirmDeleteRoom) return;
    const { room } = confirmDeleteRoom;
    setBusyIds(prev => new Set(prev).add(room.id));
    try {
      const res = await fetch(`${API_URL}/api/inventory/rooms/${room.id}`, { method: 'DELETE', headers: ah() });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Delete failed (${res.status})`); }
      toast.success(`Room ${room.name} deleted`); setConfirmDeleteRoom(null); await load(true);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setBusyIds(prev => { const n = new Set(prev); n.delete(room.id); return n; }); }
  }

  async function flipLength(room: Room) {
    const next: Length = room.length === 'STR' ? 'LTR' : 'STR';
    setBusyIds(prev => new Set(prev).add(room.id));
    try {
      const res = await fetch(`${API_URL}/api/inventory/rooms/${room.id}`, {
        method: 'PATCH', headers: { ...ah(), 'Content-Type': 'application/json' }, body: JSON.stringify({ length: next })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Save failed (${res.status})`); }
      setBuildings(prev => prev.map(b => ({ ...b, units: b.units.map(u => ({ ...u, rooms: u.rooms.map(r => r.id === room.id ? { ...r, length: next } : r) })) })));
      toast.success(`${room.name} is now ${next}`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Flip failed'); }
    finally { setBusyIds(prev => { const n = new Set(prev); n.delete(room.id); return n; }); }
  }

  // ── Monthly performance ─────────────────────────────────────────────
  async function loadMonthly(buildingId: string) {
    setLoadingPerf(true);
    try {
      const res = await fetch(`${API_URL}/api/inventory/monthly-performance?building_id=${buildingId}`, { headers: ah() });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const d = await res.json();
      setMonthlyByBuilding(prev => ({ ...prev, [buildingId]: d.rows || [] }));
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Load failed'); }
    finally { setLoadingPerf(false); }
  }

  function toggleFinancials(b: Building) {
    if (financialsBuildingId === b.id) { setFinancialsBuildingId(null); }
    else { setFinancialsBuildingId(b.id); if (!monthlyByBuilding[b.id]) loadMonthly(b.id); }
  }

  function openAddPerf(b: Building) {
    const now = new Date();
    setPerfDraft({ building_id: b.id, period_year: now.getFullYear(), period_month: now.getMonth() + 1, notes: '' });
    setShowPerfModal(true);
  }
  function openEditPerf(row: MonthlyPerf) { setPerfDraft({ ...row }); setShowPerfModal(true); }

  async function savePerf() {
    if (!perfDraft.period_year || !perfDraft.period_month) { toast.error('Year and month are required'); return; }
    setPerfSaving(true);
    try {
      const isEdit = !!perfDraft.id;
      const url = isEdit ? `${API_URL}/api/inventory/monthly-performance/${perfDraft.id}` : `${API_URL}/api/inventory/monthly-performance`;
      const body: Record<string, unknown> = { occupancy_pct: perfDraft.occupancy_pct ?? null, adr: perfDraft.adr ?? null, revpar: perfDraft.revpar ?? null, revenue: perfDraft.revenue ?? null, notes: perfDraft.notes || null };
      if (!isEdit) { body.building_id = perfDraft.building_id; body.period_year = perfDraft.period_year; body.period_month = perfDraft.period_month; }
      const res = await fetch(url, { method: isEdit ? 'PATCH' : 'POST', headers: { ...ah(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Save failed (${res.status})`); }
      toast.success(isEdit ? 'Updated' : 'Added'); setShowPerfModal(false);
      if (perfDraft.building_id) await loadMonthly(perfDraft.building_id);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Save failed'); }
    finally { setPerfSaving(false); }
  }

  async function deletePerf() {
    if (!confirmDeletePerf) return;
    const row = confirmDeletePerf;
    try {
      const res = await fetch(`${API_URL}/api/inventory/monthly-performance/${row.id}`, { method: 'DELETE', headers: ah() });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Delete failed (${res.status})`); }
      setConfirmDeletePerf(null); toast.success('Deleted'); await loadMonthly(row.building_id);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Delete failed'); }
  }

  // ── Derived ────────────────────────────────────────────────────────
  function roomMatches(r: Room): boolean {
    if (lengthFilter !== 'all') { if (lengthFilter === 'unset') { if (r.length) return false; } else if (r.length !== lengthFilter) return false; }
    if (strategyFilter !== 'all') { if (strategyFilter === 'unset') { if (r.strategy) return false; } else if (r.strategy !== strategyFilter) return false; }
    if (bathroomFilter !== 'all' && r.bathroom !== bathroomFilter) return false;
    if (bedSizeFilter.size > 0 && (!r.bed_size || !bedSizeFilter.has(r.bed_size))) return false;
    if (amenityFilter.size > 0) { for (const a of amenityFilter) if (!r.amenities.includes(a)) return false; }
    if (adaOnly && !r.is_ada) return false;
    const rent = rentOf(r);
    if (withRentOnly && rent <= 0) return false;
    const minN = rentMin === '' ? null : Number(rentMin);
    const maxN = rentMax === '' ? null : Number(rentMax);
    if (minN != null && !isNaN(minN) && rent < minN) return false;
    if (maxN != null && !isNaN(maxN) && rent > maxN) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const blob = [r.name, r.room_type_name, r.extras, r.bed_size, r.bathroom, r.balcony, ...(r.amenities || [])].filter(Boolean).join(' ').toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  }
  function buildingMatchesByName(b: Building): boolean {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return b.name.toLowerCase().includes(q) || (b.full_name || '').toLowerCase().includes(q) || (b.address || '').toLowerCase().includes(q);
  }

  const bedSizeOptions = Array.from(new Set(buildings.flatMap(b => b.units.flatMap(u => u.rooms.map(r => r.bed_size).filter((x): x is string => x != null))))).sort();
  const hasAnyFilter = !!search.trim() || lengthFilter !== 'all' || strategyFilter !== 'all' || bathroomFilter !== 'all' || bedSizeFilter.size > 0 || amenityFilter.size > 0 || buildingFilter.size > 0 || adaOnly || withRentOnly || rentMin !== '' || rentMax !== '';

  const filteredBuildings = buildings
    .filter(b => buildingFilter.size === 0 || buildingFilter.has(b.id))
    .map(b => {
      const sb = buildingMatchesByName(b);
      return { ...b, units: b.units.map(u => ({ ...u, rooms: [...u.rooms].filter(roomMatches).sort((a, c) => { if (sortKey === 'rent_desc') return rentOf(c) - rentOf(a); if (sortKey === 'rent_asc') return rentOf(a) - rentOf(c); if (sortKey === 'revenue_desc') return Number(c.revenue_year || 0) - Number(a.revenue_year || 0); return (a.name || '').localeCompare(c.name || ''); }) })).filter(u => sb || u.rooms.length > 0) };
    })
    .filter(b => { if (hasAnyFilter) { if (b.units.some(u => u.rooms.length > 0)) return true; return buildingMatchesByName(b); } return true; });

  function unitMonthlyRent(u: Unit) { return u.rooms.reduce((a, r) => a + rentOf(r), 0); }
  function buildingMonthlyRent(b: Building) { return b.units.reduce((a, u) => a + unitMonthlyRent(u), 0); }
  function buildingAnnualRevenue(b: Building) { return b.units.reduce((a, u) => a + u.rooms.reduce((aa, r) => aa + (Number(r.revenue_year) || 0), 0), 0); }

  const totals = {
    buildings: filteredBuildings.length,
    units: filteredBuildings.reduce((acc, b) => acc + b.units.length, 0),
    rooms: filteredBuildings.reduce((acc, b) => acc + b.units.reduce((a2, u) => a2 + u.rooms.length, 0), 0),
    ltr: filteredBuildings.reduce((acc, b) => acc + b.units.reduce((a2, u) => a2 + u.rooms.filter(r => r.length === 'LTR').length, 0), 0),
    str: filteredBuildings.reduce((acc, b) => acc + b.units.reduce((a2, u) => a2 + u.rooms.filter(r => r.length === 'STR').length, 0), 0),
    monthlyRent: filteredBuildings.reduce((acc, b) => acc + b.units.reduce((a2, u) => a2 + u.rooms.reduce((aa, r) => aa + rentOf(r), 0), 0), 0),
    annualRevenue: filteredBuildings.reduce((acc, b) => acc + b.units.reduce((a2, u) => a2 + u.rooms.reduce((aa, r) => aa + (Number(r.revenue_year) || 0), 0), 0), 0)
  };
  const totalRooms = buildings.reduce((a, b) => a + b.units.reduce((aa, u) => aa + u.rooms.length, 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50">
            <Boxes className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>
            <p className="text-sm text-gray-500">Buildings, units, and rooms — the canonical record.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {isOwner && (
            <button onClick={openCreateBuilding} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-700">
              <Plus className="h-4 w-4" /> Add building
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {([
          { label: 'Buildings', value: totals.buildings, Icon: Building2, tint: 'bg-blue-50 text-blue-700', fmt: 'n' },
          { label: 'Units', value: totals.units, Icon: Layers, tint: 'bg-purple-50 text-purple-700', fmt: 'n' },
          { label: 'Rooms', value: totals.rooms, Icon: Bed, tint: 'bg-amber-50 text-amber-700', fmt: 'n' },
          { label: 'LTR rooms', value: totals.ltr, Icon: ArrowUpDown, tint: 'bg-teal-50 text-teal-700', fmt: 'n' },
          { label: 'STR rooms', value: totals.str, Icon: ArrowUpDown, tint: 'bg-orange-50 text-orange-700', fmt: 'n' },
          { label: 'Monthly rent', value: totals.monthlyRent, Icon: DollarSign, tint: 'bg-emerald-50 text-emerald-700', fmt: '$' },
          { label: 'Last yr revenue', value: totals.annualRevenue, Icon: TrendingUp, tint: 'bg-indigo-50 text-indigo-700', fmt: '$' },
        ] as { label: string; value: number; Icon: React.ElementType; tint: string; fmt: string }[]).map(({ label, value, Icon, tint, fmt }) => (
          <div key={label} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tint}`}><Icon className="h-5 w-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
              {loading ? <div className="mt-0.5 h-6 w-10 animate-pulse rounded bg-gray-200" /> :
                <div className="text-xl font-semibold text-gray-900">{fmt === '$' ? fmtMoney(value, { compact: true }) : value}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <section className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search building, unit, room, amenity, type…" className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>}
          </div>
          <button onClick={() => setShowFilters(v => !v)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <ListFilter className="h-4 w-4" /> {showFilters ? 'Hide' : 'Show'} filters
            {hasAnyFilter && <span className="ml-1 rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-medium text-white">on</span>}
          </button>
          <select value={sortKey} onChange={e => setSortKey(e.target.value as typeof sortKey)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <option value="name">Sort: Name (A→Z)</option>
            <option value="rent_desc">Sort: Rent (high → low)</option>
            <option value="rent_asc">Sort: Rent (low → high)</option>
            <option value="revenue_desc">Sort: Revenue (high → low)</option>
          </select>
          {hasAnyFilter && <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"><X className="h-3.5 w-3.5" /> Clear all</button>}
        </div>
        {showFilters && (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Length</div>
              <div className="flex flex-wrap gap-1">
                {(['all', 'LTR', 'STR', 'unset'] as const).map(v => (
                  <button key={v} onClick={() => setLengthFilter(v)} className={chipCls(lengthFilter === v)}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Strategy</div>
              <div className="flex flex-wrap gap-1">
                {(['all', 'Coliving', 'Entire Apt', 'unset'] as const).map(v => (
                  <button key={v} onClick={() => setStrategyFilter(v)} className={chipCls(strategyFilter === v)}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Bathroom</div>
              <div className="flex flex-wrap gap-1">
                {(['all', 'Private', 'Shared'] as const).map(v => (
                  <button key={v} onClick={() => setBathroomFilter(v)} className={chipCls(bathroomFilter === v)}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Quick toggles</div>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={adaOnly} onChange={e => setAdaOnly(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  <span className="text-gray-700">ADA only</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={withRentOnly} onChange={e => setWithRentOnly(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  <span className="text-gray-700">Has rent</span>
                </label>
              </div>
            </div>
            {bedSizeOptions.length > 0 && (
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Bed size</div>
                <div className="flex flex-wrap gap-1">
                  {bedSizeOptions.map(bs => <button key={bs} onClick={() => toggleSetFilter(setBedSizeFilter, bs)} className={chipCls(bedSizeFilter.has(bs))}>{bs}</button>)}
                </div>
              </div>
            )}
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Rent range ($/mo)</div>
              <div className="flex items-center gap-2">
                <input type="number" min={0} step={50} value={rentMin} onChange={e => setRentMin(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Min" className="w-24 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
                <span className="text-gray-400">—</span>
                <input type="number" min={0} step={50} value={rentMax} onChange={e => setRentMax(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Max" className="w-24 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
              </div>
            </div>
            {buildings.length > 1 && (
              <div className="md:col-span-2 lg:col-span-3">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Buildings</div>
                <div className="flex flex-wrap gap-1">
                  {buildings.map(b => <button key={b.id} onClick={() => toggleSetFilter(setBuildingFilter, b.id)} className={chipCls(buildingFilter.has(b.id))}>{b.name}</button>)}
                </div>
              </div>
            )}
            {allAmenities.length > 0 && (
              <div className="md:col-span-2 lg:col-span-4">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Has amenities (all)</div>
                <div className="flex flex-wrap gap-1">
                  {allAmenities.map(a => <button key={a} onClick={() => toggleSetFilter(setAmenityFilter, a)} className={chipCls(amenityFilter.has(a))}>{a}</button>)}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Filter results counter */}
      {!loading && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div>
            {hasAnyFilter
              ? <><span className="font-medium text-gray-700">{totals.rooms}</span> of <span className="font-medium text-gray-700">{totalRooms}</span> rooms match · {totals.buildings} of {buildings.length} buildings</>
              : <>Showing all {totals.rooms} rooms across {totals.buildings} buildings</>}
          </div>
          {hasAnyFilter && <button onClick={clearFilters} className="font-medium text-teal-600 hover:text-teal-700">Clear filters</button>}
        </div>
      )}

      {/* Tree */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <section key={i} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3"><div className="h-5 w-56 animate-pulse rounded bg-gray-200" /></div>
              <div className="space-y-3 p-4">{[1,2,3].map(j => <div key={j} className="h-8 animate-pulse rounded bg-gray-100" />)}</div>
            </section>
          ))}
        </div>
      ) : buildings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <Boxes className="h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-700">No inventory yet</p>
          <p className="max-w-md text-sm text-gray-500">Add a building manually to get started.</p>
          {isOwner && (
            <button onClick={openCreateBuilding} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
              <Plus className="h-4 w-4" /> Add building
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBuildings.map(b => (
            <section key={b.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:shadow-sm">
              {/* Building header */}
              <div className="flex items-stretch border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <button onClick={() => toggleBuilding(b.id)} className="flex flex-1 items-center justify-between px-4 py-3 text-left">
                  <div className="flex items-center gap-3">
                    {expandedBuildings.has(b.id) ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    <Building2 className="h-5 w-5 text-teal-600" />
                    <div>
                      <h2 className="font-semibold text-gray-900">{b.name}</h2>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                        {b.address && <span>{b.address}</span>}
                        {b.owner_llc && <span>· {b.owner_llc}</span>}
                        {b.floors != null && <span>· {b.floors} floor{b.floors === 1 ? '' : 's'}</span>}
                        {b.has_elevator != null && <span>· Elevator: {b.has_elevator ? 'Yes' : 'No'}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{b.units.length} unit{b.units.length === 1 ? '' : 's'}</span>
                    {buildingMonthlyRent(b) > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        <DollarSign className="h-3 w-3" /> {fmtMoney(buildingMonthlyRent(b), { compact: true })}/mo
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex items-center pr-2">
                  <button
                    onClick={() => toggleFinancials(b)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition ${financialsBuildingId === b.id ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700'}`}
                  >
                    <TrendingUp className="h-3.5 w-3.5" /> Financials
                  </button>
                </div>
                {isOwner && (
                  <div className="flex items-center pr-3">
                    <ActionMenu>
                      <MI onClick={() => openCreateUnit(b)}><Plus className="h-4 w-4 text-gray-400" /> Add unit</MI>
                      <MI onClick={() => openEditBuilding(b)}><Pencil className="h-4 w-4 text-gray-400" /> Edit building</MI>
                      <MDivider />
                      <MI onClick={() => setConfirmDeleteBuilding(b)} red><Trash2 className="h-4 w-4" /> Delete building</MI>
                    </ActionMenu>
                  </div>
                )}
              </div>

              {/* Financials panel */}
              {financialsBuildingId === b.id && (
                <div className="border-b border-gray-100 bg-gradient-to-br from-emerald-50/40 to-white p-4">
                  <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {[
                      { label: 'Monthly rent', val: fmtMoney(buildingMonthlyRent(b)), color: 'text-emerald-700' },
                      { label: 'Annualized rent', val: fmtMoney(buildingMonthlyRent(b) * 12), color: 'text-emerald-700' },
                      { label: 'Last-yr revenue', val: fmtMoney(buildingAnnualRevenue(b)), color: 'text-indigo-700' },
                      { label: 'Avg / room', val: b.units.reduce((a, u) => a + u.rooms.length, 0) > 0 ? fmtMoney(buildingMonthlyRent(b) / b.units.reduce((a, u) => a + u.rooms.length, 0)) : '—', color: 'text-gray-800' }
                    ].map(({ label, val, color }) => (
                      <div key={label} className="rounded-md border border-gray-200 bg-white p-2.5">
                        <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
                        <div className={`text-lg font-semibold ${color}`}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-md border border-gray-200 bg-white">
                    <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-800"><Calendar className="h-4 w-4 text-gray-400" /> Monthly performance</div>
                      {isOwner && <button onClick={() => openAddPerf(b)} className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"><Plus className="h-3.5 w-3.5" /> Add month</button>}
                    </div>
                    {loadingPerf && !monthlyByBuilding[b.id] ? (
                      <div className="p-3"><div className="h-8 animate-pulse rounded bg-gray-100" /></div>
                    ) : (monthlyByBuilding[b.id] || []).length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-gray-500">No monthly data yet.{isOwner && ' Click Add month.'}</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
                            <tr>
                              <th className="px-3 py-1.5">Period</th>
                              <th className="px-3 py-1.5 text-right">Occupancy</th>
                              <th className="px-3 py-1.5 text-right">ADR</th>
                              <th className="px-3 py-1.5 text-right">RevPAR</th>
                              <th className="px-3 py-1.5 text-right">Revenue</th>
                              <th className="px-3 py-1.5" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(monthlyByBuilding[b.id] || []).map(row => (
                              <tr key={row.id}>
                                <td className="px-3 py-1.5 font-medium text-gray-800">{MONTH_NAMES[row.period_month - 1]} {row.period_year}</td>
                                <td className="px-3 py-1.5 text-right">{fmtPct(row.occupancy_pct)}</td>
                                <td className="px-3 py-1.5 text-right">{row.adr != null ? fmtMoney(row.adr) : '—'}</td>
                                <td className="px-3 py-1.5 text-right">{row.revpar != null ? fmtMoney(row.revpar) : '—'}</td>
                                <td className="px-3 py-1.5 text-right">{row.revenue != null ? fmtMoney(row.revenue) : '—'}</td>
                                <td className="px-3 py-1.5 text-right">
                                  {isOwner && (
                                    <ActionMenu>
                                      <MI onClick={() => openEditPerf(row)}><Pencil className="h-4 w-4 text-gray-400" /> Edit</MI>
                                      <MI onClick={() => setConfirmDeletePerf(row)} red><Trash2 className="h-4 w-4" /> Delete</MI>
                                    </ActionMenu>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Units */}
              {expandedBuildings.has(b.id) && (
                <div className="divide-y divide-gray-100">
                  {b.units.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-gray-500">
                      <p>No units in this building yet.</p>
                      {isOwner && <button onClick={() => openCreateUnit(b)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-teal-700 hover:bg-teal-50"><Plus className="h-3.5 w-3.5" /> Add first unit</button>}
                    </div>
                  ) : b.units.map(u => (
                    <div key={u.id}>
                      <div className="flex items-stretch">
                        <button onClick={() => toggleUnit(u.id)} className="flex flex-1 items-center justify-between px-6 py-2.5 text-left hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            {expandedUnits.has(u.id) ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                            <Layers className="h-4 w-4 text-purple-500" />
                            <span className="font-medium text-gray-800">Apartment {u.name}</span>
                            <span className="text-xs text-gray-500">{u.rooms.length} room{u.rooms.length === 1 ? '' : 's'}</span>
                            {unitMonthlyRent(u) > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{fmtMoney(unitMonthlyRent(u))}/mo</span>
                            )}
                          </div>
                        </button>
                        {isOwner && (
                          <div className="flex items-center pr-4">
                            <ActionMenu>
                              <MI onClick={() => openCreateRoom(u)}><Plus className="h-4 w-4 text-gray-400" /> Add room</MI>
                              <MI onClick={() => openEditUnit(u)}><Pencil className="h-4 w-4 text-gray-400" /> Rename unit</MI>
                              <MDivider />
                              <MI onClick={() => setConfirmDeleteUnit({ building: b, unit: u })} red><Trash2 className="h-4 w-4" /> Delete unit</MI>
                            </ActionMenu>
                          </div>
                        )}
                      </div>

                      {expandedUnits.has(u.id) && (
                        <div className="bg-gray-50/40">
                          {u.rooms.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 px-4 py-4 text-center text-xs text-gray-500">
                              <p>No rooms yet.</p>
                              {isOwner && <button onClick={() => openCreateRoom(u)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-teal-700 hover:bg-teal-50"><Plus className="h-3.5 w-3.5" /> Add first room</button>}
                            </div>
                          ) : u.rooms.map(r => (
                            <div key={r.id}>
                              <div className="group flex flex-col gap-2 border-t border-gray-100 px-10 py-2 md:flex-row md:items-center">
                                <div className="flex w-32 shrink-0 items-center gap-2">
                                  <Bed className="h-3.5 w-3.5 text-gray-400" />
                                  <span className="font-medium text-gray-800">{r.name}</span>
                                </div>
                                <div className="flex flex-1 flex-wrap items-center gap-1.5 text-xs">
                                  {isOwner ? (
                                    <button onClick={() => flipLength(r)} disabled={busyIds.has(r.id)} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium transition disabled:opacity-60 ${lenCls(r.length)}`} title="Click to flip">
                                      {r.length || '—'} <ArrowUpDown className="h-3 w-3 opacity-60" />
                                    </button>
                                  ) : (
                                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${lenCls(r.length)}`}>{r.length || '—'}</span>
                                  )}
                                  {r.strategy && <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-gray-700">{r.strategy}</span>}
                                  {r.bed_size && <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-gray-700">{r.bed_size}</span>}
                                  {r.bathroom && <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-gray-700"><Bath className="h-3 w-3" /> {r.bathroom}</span>}
                                  {r.balcony && r.balcony.toLowerCase() !== 'no balcony' && <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-gray-700">{r.balcony}</span>}
                                  {r.room_type_name && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-800">{r.room_type_name}</span>}
                                  {(r.actual_rent || r.base_rent) ? <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700"><DollarSign className="h-3 w-3" />{fmtMoney(rentOf(r))}/mo</span> : null}
                                  {r.revenue_year ? <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">{fmtMoney(r.revenue_year, { compact: true })}/yr</span> : null}
                                  {r.is_ada && <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700"><Accessibility className="h-3 w-3" /> ADA</span>}
                                  {(r.amenities || []).map(a => <span key={a} className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{a}</span>)}
                                </div>
                                <button onClick={() => setDetailsRoomId(detailsRoomId === r.id ? null : r.id)} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50" title="Details">
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                {isOwner && (
                                  <div className="shrink-0 md:opacity-0 md:transition md:group-hover:opacity-100">
                                    <ActionMenu>
                                      <MI onClick={() => openEditRoom(r)}><Pencil className="h-4 w-4 text-gray-400" /> Edit room</MI>
                                      <MDivider />
                                      <MI onClick={() => setConfirmDeleteRoom({ unit: u, room: r })} red><Trash2 className="h-4 w-4" /> Delete room</MI>
                                    </ActionMenu>
                                  </div>
                                )}
                              </div>
                              {detailsRoomId === r.id && (
                                <div className="border-t border-gray-100 bg-white px-10 py-3 text-xs">
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                                    {([
                                      ['Listing date', r.listing_date], ['Unit type', r.unit_type], ['Length', r.length], ['Strategy', r.strategy],
                                      ['Bed size', r.bed_size], ['Bathroom', r.bathroom], ['Ceiling', r.ceiling_height], ['Balcony', r.balcony],
                                      ['Room type', r.room_type_name], ['ADA', r.is_ada == null ? null : (r.is_ada ? 'Yes' : 'No')], ['Extras', r.extras]
                                    ] as [string, string | boolean | null | undefined][]).filter(([, v]) => v != null && v !== '').map(([label, val]) => (
                                      <div key={label}>
                                        <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
                                        <div className="text-gray-800">{String(val)}</div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-emerald-100 bg-emerald-50/40 p-2 sm:grid-cols-3 lg:grid-cols-4">
                                    {([
                                      ['Actual rent / mo', r.actual_rent], ['Base rent / mo', r.base_rent], ['Market rent / mo', r.market_rent],
                                      ['Actual rent + util', r.actual_rent_with_util], ['Pessimistic + util', r.pessimistic_rent],
                                      ['Concession (13mo)', r.concession_rent], ['Concession + util', r.concession_rent_with_util],
                                      ['Adjustment', r.adjustment], ['Stake 5% cashback', r.stake_5_cashback], ['Stake 8% cashback', r.stake_8_cashback],
                                      ['Revenue / mo', r.revenue_month], ['Revenue / year', r.revenue_year], ['Rev / apartment', r.revenue_per_apartment]
                                    ] as [string, number | null | undefined][]).filter(([, v]) => v != null).map(([label, val]) => (
                                      <div key={label}>
                                        <div className="text-[10px] uppercase tracking-wide text-emerald-700/80">{label}</div>
                                        <div className="font-medium text-gray-900">{fmtMoney(val)}</div>
                                      </div>
                                    ))}
                                  </div>
                                  {r.notes && (
                                    <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-2 text-gray-700">
                                      <div className="text-[10px] uppercase tracking-wide text-gray-500">Notes</div>
                                      <div>{r.notes}</div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}

      {/* Building modal */}
      {isOwner && showBuildingModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setShowBuildingModal(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50"><Building2 className="h-4 w-4 text-teal-600" /></div>
                <h3 className="text-lg font-semibold text-gray-900">{buildingDraft.id ? 'Edit building' : 'Add building'}</h3>
              </div>
              <button onClick={() => setShowBuildingModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </header>
            <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Name</span>
                <input value={buildingDraft.name || ''} onChange={e => setBuildingDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Aerie" className={inp} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Full name</span>
                <input value={buildingDraft.full_name || ''} onChange={e => setBuildingDraft(d => ({ ...d, full_name: e.target.value }))} placeholder="e.g. Aerie Apartments" className={inp} />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-gray-700">Address</span>
                <input value={buildingDraft.address || ''} onChange={e => setBuildingDraft(d => ({ ...d, address: e.target.value }))} className={inp} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Owner LLC</span>
                <input value={buildingDraft.owner_llc || ''} onChange={e => setBuildingDraft(d => ({ ...d, owner_llc: e.target.value }))} placeholder="e.g. NW 121 LLC" className={inp} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Floors</span>
                <input type="number" min={0} max={50} value={buildingDraft.floors ?? ''} onChange={e => setBuildingDraft(d => ({ ...d, floors: e.target.value === '' ? undefined : Number(e.target.value) }))} className={inp} />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={!!buildingDraft.has_elevator} onChange={e => setBuildingDraft(d => ({ ...d, has_elevator: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                <span className="text-gray-700">Has elevator</span>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-gray-700">Notes</span>
                <textarea value={buildingDraft.notes || ''} onChange={e => setBuildingDraft(d => ({ ...d, notes: e.target.value }))} rows={2} className={inp} />
              </label>
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button onClick={() => setShowBuildingModal(false)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={saveBuilding} disabled={buildingSaving} className="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
                {buildingSaving ? <><Spinner size="sm" /> Saving…</> : <><Save className="h-4 w-4" /> Save</>}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Unit modal */}
      {isOwner && showUnitModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setShowUnitModal(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50"><Layers className="h-4 w-4 text-teal-600" /></div>
                <h3 className="text-lg font-semibold text-gray-900">{unitDraft.id ? 'Rename unit' : 'Add unit'}</h3>
              </div>
              <button onClick={() => setShowUnitModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </header>
            <div className="space-y-3 px-5 py-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Apartment number</span>
                <input value={unitDraft.name || ''} onChange={e => setUnitDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. 11" className={inp} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Notes</span>
                <textarea value={unitDraft.notes || ''} onChange={e => setUnitDraft(d => ({ ...d, notes: e.target.value }))} rows={2} className={inp} />
              </label>
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button onClick={() => setShowUnitModal(false)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={saveUnit} disabled={unitSaving} className="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
                {unitSaving ? <><Spinner size="sm" /> Saving…</> : <><Save className="h-4 w-4" /> Save</>}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Room modal */}
      {isOwner && showRoomModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setShowRoomModal(false)}>
          <div onClick={e => e.stopPropagation()} className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50"><Bed className="h-4 w-4 text-teal-600" /></div>
                <h3 className="text-lg font-semibold text-gray-900">{roomDraft.id ? 'Edit room' : 'Add room'}</h3>
              </div>
              <button onClick={() => setShowRoomModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </header>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Room name</span>
                  <input value={roomDraft.name || ''} onChange={e => setRoomDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. 11A" className={inp} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Room type name</span>
                  <input value={roomDraft.room_type_name || ''} onChange={e => setRoomDraft(d => ({ ...d, room_type_name: e.target.value }))} placeholder="e.g. Standard, Deluxe" className={inp} />
                </label>
                <div>
                  <span className="mb-1 block text-sm font-medium text-gray-700">Length</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['LTR', 'STR'] as const).map((v, i) => (
                      <button key={v} type="button" onClick={() => setRoomDraft(d => ({ ...d, length: v }))} className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${roomDraft.length === v ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600'}`}>{['Long term', 'Short term'][i]}</button>
                    ))}
                    <button type="button" onClick={() => setRoomDraft(d => ({ ...d, length: null }))} className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${!roomDraft.length ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600'}`}>Unset</button>
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-sm font-medium text-gray-700">Strategy</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['Coliving', 'Entire Apt'] as const).map(v => (
                      <button key={v} type="button" onClick={() => setRoomDraft(d => ({ ...d, strategy: v }))} className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${roomDraft.strategy === v ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600'}`}>{v}</button>
                    ))}
                    <button type="button" onClick={() => setRoomDraft(d => ({ ...d, strategy: null }))} className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${!roomDraft.strategy ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600'}`}>Unset</button>
                  </div>
                </div>
                {([['bed_size', 'Bed size', 'Queen, Full, Twin, Studio'], ['bathroom', 'Bathroom', 'Private, Shared'], ['ceiling_height', 'Ceiling height', 'Average, Extra High'], ['balcony', 'Balcony', 'No Balcony, Personal Balcony, Shared']] as const).map(([field, label, placeholder]) => (
                  <label key={field} className="block text-sm">
                    <span className="mb-1 block font-medium text-gray-700">{label}</span>
                    <input value={roomDraft[field] || ''} onChange={e => setRoomDraft(d => ({ ...d, [field]: e.target.value }))} placeholder={placeholder} className={inp} />
                  </label>
                ))}
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-900"><DollarSign className="h-4 w-4" /> Financials</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {([['actual_rent', 'Actual rent / mo'], ['base_rent', 'Base rent / mo'], ['market_rent', 'Market rent / mo'], ['revenue_month', 'Revenue / mo'], ['revenue_year', 'Revenue / year (last)']] as const).map(([field, label]) => (
                    <label key={field} className={`block text-sm ${field === 'revenue_year' ? 'sm:col-span-2' : ''}`}>
                      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
                      <input type="number" min={0} step={1} value={roomDraft[field] ?? ''} onChange={e => setRoomDraft(d => ({ ...d, [field]: e.target.value === '' ? null : Number(e.target.value) }))} className={inp} />
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!roomDraft.is_ada} onChange={e => setRoomDraft(d => ({ ...d, is_ada: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                    <span className="text-gray-700">ADA accessible</span>
                  </label>
                </div>
                <label className="mt-2 block text-sm">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Extras</span>
                  <input value={roomDraft.extras || ''} onChange={e => setRoomDraft(d => ({ ...d, extras: e.target.value }))} placeholder="e.g. Shared Backyard" className={inp} />
                </label>
              </div>
              <div>
                <span className="mb-1 block text-sm font-medium text-gray-700">Amenities</span>
                {allAmenities.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {allAmenities.map(a => (
                      <label key={a} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition ${roomDraftAmenities.has(a) ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                        <input type="checkbox" checked={roomDraftAmenities.has(a)} onChange={() => setRoomDraftAmenities(prev => { const n = new Set(prev); n.has(a) ? n.delete(a) : n.add(a); return n; })} className="h-3.5 w-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                        <span className="truncate">{a}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <input type="text" value={roomCustomAmenity} onChange={e => setRoomCustomAmenity(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRoomCustomAmenity())} placeholder="Add custom amenity (e.g. Hot tub)" className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
                  <button type="button" onClick={addRoomCustomAmenity} disabled={!roomCustomAmenity.trim()} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Notes</span>
                <textarea value={roomDraft.notes || ''} onChange={e => setRoomDraft(d => ({ ...d, notes: e.target.value }))} rows={2} className={inp} />
              </label>
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button onClick={() => setShowRoomModal(false)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={saveRoom} disabled={roomSaving} className="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
                {roomSaving ? <><Spinner size="sm" /> Saving…</> : <><Save className="h-4 w-4" /> Save</>}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Monthly perf modal */}
      {isOwner && showPerfModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setShowPerfModal(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50"><Calendar className="h-4 w-4 text-teal-600" /></div>
                <h3 className="text-lg font-semibold text-gray-900">{perfDraft.id ? 'Edit month' : 'Add month'}</h3>
              </div>
              <button onClick={() => setShowPerfModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </header>
            <div className="grid grid-cols-2 gap-3 px-5 py-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-600">Year</span>
                <input type="number" min={2000} max={2100} value={perfDraft.period_year ?? ''} onChange={e => setPerfDraft(d => ({ ...d, period_year: Number(e.target.value) }))} disabled={!!perfDraft.id} className={`${inp} disabled:bg-gray-50`} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-600">Month</span>
                <select value={perfDraft.period_month ?? 1} onChange={e => setPerfDraft(d => ({ ...d, period_month: Number(e.target.value) }))} disabled={!!perfDraft.id} className={`${inp} disabled:bg-gray-50`}>
                  {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                </select>
              </label>
              {([['occupancy_pct', 'Occupancy %', 0, 100, 0.1], ['adr', 'ADR ($)', 0, undefined, 0.01], ['revpar', 'RevPAR ($)', 0, undefined, 0.01], ['revenue', 'Revenue ($)', 0, undefined, 0.01]] as [string, string, number, number | undefined, number][]).map(([field, label, min, max, step]) => (
                <label key={field} className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
                  <input type="number" min={min} max={max} step={step} value={(perfDraft as Record<string, number | undefined>)[field] ?? ''} onChange={e => setPerfDraft(d => ({ ...d, [field]: e.target.value === '' ? undefined : Number(e.target.value) }))} className={inp} />
                </label>
              ))}
              <label className="col-span-2 block text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-600">Notes</span>
                <textarea value={perfDraft.notes || ''} onChange={e => setPerfDraft(d => ({ ...d, notes: e.target.value }))} rows={2} className={inp} />
              </label>
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button onClick={() => setShowPerfModal(false)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={savePerf} disabled={perfSaving} className="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
                {perfSaving ? <><Spinner size="sm" /> Saving…</> : <><Save className="h-4 w-4" /> Save</>}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Confirm deletes */}
      {confirmDeleteBuilding && (
        <ConfirmModal
          title="Delete building?"
          body={<><span className="font-medium text-gray-800">{confirmDeleteBuilding.name}</span> and all {confirmDeleteBuilding.units.length} unit{confirmDeleteBuilding.units.length === 1 ? '' : 's'} (and their rooms) will be removed. This cannot be undone.</>}
          onConfirm={deleteBuilding}
          onCancel={() => setConfirmDeleteBuilding(null)}
        />
      )}
      {confirmDeleteUnit && (
        <ConfirmModal
          title="Delete unit?"
          body={<>Apartment <span className="font-medium text-gray-800">{confirmDeleteUnit.unit.name}</span> in <span className="font-medium text-gray-800">{confirmDeleteUnit.building.name}</span> and all {confirmDeleteUnit.unit.rooms.length} room{confirmDeleteUnit.unit.rooms.length === 1 ? '' : 's'} inside will be removed.</>}
          onConfirm={deleteUnit}
          onCancel={() => setConfirmDeleteUnit(null)}
        />
      )}
      {confirmDeleteRoom && (
        <ConfirmModal
          title="Delete room?"
          body={<>Room <span className="font-medium text-gray-800">{confirmDeleteRoom.room.name}</span> will be removed.</>}
          onConfirm={deleteRoom}
          onCancel={() => setConfirmDeleteRoom(null)}
        />
      )}
      {confirmDeletePerf && (
        <ConfirmModal
          title="Delete this month?"
          body={<>{MONTH_NAMES[confirmDeletePerf.period_month - 1]} {confirmDeletePerf.period_year} will be removed.</>}
          onConfirm={deletePerf}
          onCancel={() => setConfirmDeletePerf(null)}
        />
      )}
    </div>
  );
}
