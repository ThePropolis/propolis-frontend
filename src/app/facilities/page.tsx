'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Search, Wrench, Building2, X, RefreshCw, ChevronDown, ChevronRight,
  LayoutGrid, ListFilter, Bed, Bath, Package, Pencil, Save, Plus,
  MoreHorizontal, Trash2, Download
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { Spinner } from '@/components/ui/Spinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────
type Unit = {
  unit_id: string;
  unit_name: string;
  beds: number | null;
  baths: number | null;
  amenities: string[];
};
type Property = {
  property_id: string;
  property_name: string;
  property_amenities: string[];
  units: Unit[];
};

// ─── Amenity label map (DoorLoop slugs → friendly names) ─────────────────
const AMENITY_LABEL: Record<string, string> = {
  AirConditioner: 'AC',
  WirelessInternet: 'Wi-Fi',
  HighSpeed: 'High-speed Internet',
  SmokeFree: 'Smoke-free',
  OnSiteMaintenance: 'On-site maintenance',
  FurnishedAvailable: 'Furnishing available',
  CeilingFan: 'Ceiling fan',
};
function formatAmenity(a: string): string {
  if (AMENITY_LABEL[a]) return AMENITY_LABEL[a];
  return a.replace(/([A-Z])/g, ' $1').trim();
}

// ─── Confirm / Delete modal ───────────────────────────────────────────────
function ConfirmModal({
  title, body, confirmLabel = 'Delete', onConfirm, onCancel, loading,
}: {
  title: string; body: string; confirmLabel?: string;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">{title}</h3>
              <p className="mt-1 text-sm text-gray-600">{body}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
          <button onClick={onCancel} disabled={loading} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
            {loading ? <><Spinner size="sm" /> Deleting…</> : <><Trash2 className="h-4 w-4" /> {confirmLabel}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export default function FacilitiesPage() {
  const { token, user } = useAuthStore();
  const isOwner = (user as { role?: string } | null)?.role === 'owner';

  const [properties, setProperties] = useState<Property[]>([]);
  const [allAmenities, setAllAmenities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [search, setSearch] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState(new Set<string>());
  const [expandedProps, setExpandedProps] = useState(new Set<string>());
  const [amenityFilterOpen, setAmenityFilterOpen] = useState(false);

  // Edit amenities modal
  const [editTarget, setEditTarget] = useState<{ prop: Property; unit: Unit } | null>(null);
  const [editDraft, setEditDraft] = useState(new Set<string>());
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [customAmenityDraft, setCustomAmenityDraft] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Add building modal
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [buildingForm, setBuildingForm] = useState({ name: '', address: '' });
  const [buildingSaving, setBuildingSaving] = useState(false);
  const [confirmDeleteBuilding, setConfirmDeleteBuilding] = useState<Property | null>(null);
  const [deletingBuilding, setDeletingBuilding] = useState(false);

  // Add unit modal
  const [addUnitTarget, setAddUnitTarget] = useState<Property | null>(null);
  const [unitForm, setUnitForm] = useState({ name: '', beds: 1, baths: 1 });
  const [unitSaving, setUnitSaving] = useState(false);
  const [confirmDeleteUnit, setConfirmDeleteUnit] = useState<{ prop: Property; unit: Unit } | null>(null);
  const [deletingUnit, setDeletingUnit] = useState(false);

  // Import
  const [importing, setImporting] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/facilities`, { headers: authHeader() });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      const props: Property[] = data.properties || [];
      setProperties(props);
      setAllAmenities(data.all_amenities || []);
      if (!silent) setExpandedProps(new Set(props.map((p) => p.property_id)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unable to load facilities';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => { load(); }, [load]);

  // ── Filtered data ─────────────────────────────────────────────────────
  const hasActiveFilter = !!search.trim() || selectedAmenities.size > 0;

  const filteredProperties = useMemo(() => {
    return properties
      .map((p) => ({
        ...p,
        units: p.units.filter((u) => {
          const q = search.toLowerCase();
          const matchesSearch = !q ||
            u.unit_name.toLowerCase().includes(q) ||
            p.property_name.toLowerCase().includes(q) ||
            u.amenities.some((a) => a.toLowerCase().includes(q));
          const matchesAmenities = selectedAmenities.size === 0 ||
            Array.from(selectedAmenities).every((a) => u.amenities.includes(a));
          return matchesSearch && matchesAmenities;
        }),
      }))
      .filter((p) => {
        if (!hasActiveFilter) return true;
        if (p.units.length > 0) return true;
        return !!search.trim() && p.property_name.toLowerCase().includes(search.toLowerCase());
      });
  }, [properties, search, selectedAmenities, hasActiveFilter]);

  const totals = useMemo(() => ({
    properties: properties.length,
    units: properties.reduce((a, p) => a + p.units.length, 0),
    amenities: allAmenities.length,
    filteredUnits: filteredProperties.reduce((a, p) => a + p.units.length, 0),
  }), [properties, allAmenities, filteredProperties]);

  const isEmpty = !loading && properties.length === 0;

  // ── Edit amenities ────────────────────────────────────────────────────
  function openEdit(prop: Property, unit: Unit) {
    setEditTarget({ prop, unit });
    setEditDraft(new Set(unit.amenities));
    setEditOptions([...new Set([...allAmenities, ...unit.amenities])].sort());
    setCustomAmenityDraft('');
  }

  function addCustomAmenity() {
    const name = customAmenityDraft.trim();
    if (!name) return;
    const existing = editOptions.find((a) => a.toLowerCase() === name.toLowerCase());
    if (existing) {
      setEditDraft((s) => new Set(s).add(existing));
      toast.info(`"${existing}" is already available — added to this unit.`);
    } else {
      setEditOptions((prev) => [...prev, name].sort());
      setEditDraft((s) => new Set(s).add(name));
    }
    setCustomAmenityDraft('');
  }

  async function saveEdit() {
    if (!editTarget) return;
    setEditSaving(true);
    const next = Array.from(editDraft).sort();
    try {
      const res = await fetch(`${API_URL}/api/facilities/units/${editTarget.unit.unit_id}`, {
        method: 'PATCH',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ amenities: next }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { detail?: string }).detail || `Save failed (${res.status})`);
      }
      setProperties((prev) =>
        prev.map((p) => {
          if (p.property_id !== editTarget!.prop.property_id) return p;
          return { ...p, units: p.units.map((u) => u.unit_id === editTarget!.unit.unit_id ? { ...u, amenities: next } : u) };
        })
      );
      setAllAmenities((prev) => [...new Set([...prev, ...next])].sort());
      toast.success('Amenities updated');
      setEditTarget(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Import ─────────────────────────────────────────────────────────────
  async function runImport() {
    setConfirmImport(false);
    setImporting(true);
    try {
      const res = await fetch(`${API_URL}/api/facilities/import`, { method: 'POST', headers: authHeader() });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { detail?: string }).detail || `Import failed (${res.status})`);
      }
      const d = await res.json();
      if (d.new_buildings === 0 && d.new_units === 0) {
        toast.info('Already up to date — nothing new to import from DoorLoop.');
      } else {
        toast.success(`Imported ${d.new_buildings} building${d.new_buildings === 1 ? '' : 's'} · ${d.new_units} unit${d.new_units === 1 ? '' : 's'}`);
      }
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  // ── Building CRUD ─────────────────────────────────────────────────────
  async function submitAddBuilding() {
    if (!buildingForm.name.trim()) return;
    setBuildingSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/facilities/buildings`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: buildingForm.name.trim(), address: buildingForm.address.trim() || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { detail?: string }).detail || `Create failed (${res.status})`);
      }
      const created = await res.json();
      toast.success(`${buildingForm.name} added`);
      setShowAddBuilding(false);
      setBuildingForm({ name: '', address: '' });
      await load(true);
      if (created?.id) setExpandedProps((s) => new Set(s).add(created.id));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBuildingSaving(false);
    }
  }

  async function submitDeleteBuilding() {
    if (!confirmDeleteBuilding) return;
    setDeletingBuilding(true);
    try {
      const res = await fetch(`${API_URL}/api/facilities/buildings/${confirmDeleteBuilding.property_id}`, {
        method: 'DELETE', headers: authHeader(),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { detail?: string }).detail || `Delete failed (${res.status})`);
      }
      toast.success(`${confirmDeleteBuilding.property_name} deleted`);
      setConfirmDeleteBuilding(null);
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingBuilding(false);
    }
  }

  // ── Unit CRUD ─────────────────────────────────────────────────────────
  async function submitAddUnit() {
    if (!addUnitTarget || !unitForm.name.trim()) return;
    setUnitSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/facilities/units`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          building_id: addUnitTarget.property_id,
          name: unitForm.name.trim(),
          beds: unitForm.beds,
          baths: unitForm.baths,
          amenities: [],
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { detail?: string }).detail || `Create failed (${res.status})`);
      }
      toast.success(`Unit ${unitForm.name} added`);
      setAddUnitTarget(null);
      setUnitForm({ name: '', beds: 1, baths: 1 });
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setUnitSaving(false);
    }
  }

  async function submitDeleteUnit() {
    if (!confirmDeleteUnit) return;
    setDeletingUnit(true);
    try {
      const res = await fetch(`${API_URL}/api/facilities/units/${confirmDeleteUnit.unit.unit_id}`, {
        method: 'DELETE', headers: authHeader(),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { detail?: string }).detail || `Delete failed (${res.status})`);
      }
      toast.success(`Unit ${confirmDeleteUnit.unit.unit_name} deleted`);
      setConfirmDeleteUnit(null);
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingUnit(false);
    }
  }

  const inp = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500';

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50">
            <Wrench className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Facilities</h1>
            <p className="text-sm text-gray-500">Amenities available per unit across all properties.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => load()} disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {isOwner && (
            <>
              <button onClick={() => setConfirmImport(true)} disabled={importing}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                title="Pulls any new DoorLoop buildings/units. Your edits are preserved.">
                {importing ? <><Spinner size="sm" /> Importing…</> : <><Download className="h-4 w-4" /> Import from DoorLoop</>}
              </button>
              <button onClick={() => { setBuildingForm({ name: '', address: '' }); setShowAddBuilding(true); }}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
                <Plus className="h-4 w-4" /> Add building
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Properties', value: totals.properties, Icon: Building2, tint: 'bg-blue-50 text-blue-700' },
          { label: 'Total units', value: totals.units, Icon: LayoutGrid, tint: 'bg-purple-50 text-purple-700' },
          { label: 'Amenity types', value: totals.amenities, Icon: Package, tint: 'bg-amber-50 text-amber-700' },
          { label: 'Shown', value: totals.filteredUnits, Icon: ListFilter, tint: 'bg-teal-50 text-teal-700' },
        ].map(({ label, value, Icon, tint }) => (
          <div key={label} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tint}`}><Icon className="h-5 w-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
              <div className="text-xl font-semibold text-gray-900">{loading ? '…' : value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by building, unit, or amenity…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>}
        </div>

        {/* Amenity dropdown filter */}
        <div className="relative">
          <button onClick={() => setAmenityFilterOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <ListFilter className="h-4 w-4" />
            {selectedAmenities.size === 0 ? 'Filter by amenity' : `${selectedAmenities.size} selected`}
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
          {amenityFilterOpen && (
            <div className="absolute right-0 z-20 mt-2 max-h-80 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Amenities</span>
                {selectedAmenities.size > 0 && (
                  <button onClick={() => setSelectedAmenities(new Set())} className="text-xs font-medium text-teal-600 hover:text-teal-700">Clear all</button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {allAmenities.map((a) => (
                  <label key={a} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                    <input type="checkbox" checked={selectedAmenities.has(a)}
                      onChange={() => setSelectedAmenities((s) => { const n = new Set(s); n.has(a) ? n.delete(a) : n.add(a); return n; })}
                      className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                    <span className="text-gray-700">{formatAmenity(a)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Expand / Collapse */}
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs">
          <button onClick={() => setExpandedProps(new Set(properties.map((p) => p.property_id)))}
            className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-50">Expand all</button>
          <button onClick={() => setExpandedProps(new Set())}
            className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-50">Collapse all</button>
        </div>
      </div>

      {/* Active filter chips */}
      {selectedAmenities.size > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-gray-500">Filtering by:</span>
          {Array.from(selectedAmenities).map((a) => (
            <button key={a} onClick={() => setSelectedAmenities((s) => { const n = new Set(s); n.delete(a); return n; })}
              className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100">
              {formatAmenity(a)} <X className="h-3 w-3" />
            </button>
          ))}
          <button onClick={() => setSelectedAmenities(new Set())} className="text-xs font-medium text-gray-500 hover:text-gray-700">Clear</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <section key={i} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="space-y-4 p-4">
                {[0, 1, 2].map((j) => <div key={j} className="h-8 w-full animate-pulse rounded bg-gray-100" />)}
              </div>
            </section>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <Building2 className="h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-700">No facilities yet</p>
          <p className="max-w-md text-sm text-gray-500">Import your buildings and units from DoorLoop to get started. After that, you can manage everything from here.</p>
          {isOwner && (
            <div className="mt-2 flex gap-2">
              <button onClick={runImport} disabled={importing}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
                {importing ? <><Spinner size="sm" /> Importing…</> : <><Download className="h-4 w-4" /> Import from DoorLoop</>}
              </button>
              <button onClick={() => { setBuildingForm({ name: '', address: '' }); setShowAddBuilding(true); }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <Plus className="h-4 w-4" /> Add manually
              </button>
            </div>
          )}
        </div>
      ) : filteredProperties.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <Building2 className="h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-700">No units match your filters</p>
          <p className="text-sm text-gray-500">Try removing filters or clearing search.</p>
          {(search || selectedAmenities.size > 0) && (
            <button onClick={() => { setSearch(''); setSelectedAmenities(new Set()); }}
              className="mt-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProperties.map((prop) => {
            const isExpanded = expandedProps.has(prop.property_id);
            return (
              <section key={prop.property_id} className="overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:shadow-sm">
                <div className="flex items-stretch border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                  <button
                    onClick={() => setExpandedProps((s) => { const n = new Set(s); n.has(prop.property_id) ? n.delete(prop.property_id) : n.add(prop.property_id); return n; })}
                    className="flex flex-1 items-center justify-between px-4 py-3 text-left">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                      <Building2 className="h-5 w-5 text-teal-600" />
                      <div>
                        <h2 className="font-semibold text-gray-900">{prop.property_name}</h2>
                        {prop.property_amenities.length > 0 && (
                          <p className="text-xs text-gray-500">
                            Building-wide: {prop.property_amenities.slice(0, 3).map(formatAmenity).join(', ')}{prop.property_amenities.length > 3 ? '…' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      {prop.units.length} unit{prop.units.length === 1 ? '' : 's'}
                    </span>
                  </button>
                  {isOwner && (
                    <div className="flex items-center pr-3">
                      <div className="relative group">
                        <button className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        <div className="absolute right-0 top-full z-10 mt-1 hidden min-w-[160px] rounded-lg border border-gray-200 bg-white shadow-lg group-focus-within:block group-hover:block">
                          <button onClick={() => { setAddUnitTarget(prop); setUnitForm({ name: '', beds: 1, baths: 1 }); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                            <Plus className="h-4 w-4 text-gray-400" /> Add unit
                          </button>
                          <div className="my-1 border-t border-gray-100" />
                          <button onClick={() => setConfirmDeleteBuilding(prop)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" /> Delete building
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {prop.units.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-gray-500">
                        <p>No units in this building yet.</p>
                        {isOwner && (
                          <button onClick={() => { setAddUnitTarget(prop); setUnitForm({ name: '', beds: 1, baths: 1 }); }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-teal-700 hover:bg-teal-50">
                            <Plus className="h-3.5 w-3.5" /> Add first unit
                          </button>
                        )}
                      </div>
                    ) : prop.units.map((unit) => (
                      <div key={unit.unit_id} className="group flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
                        <div className="flex w-48 shrink-0 items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-sm font-semibold text-teal-700">
                            {(unit.unit_name || '?').slice(0, 3)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{unit.unit_name || unit.unit_id}</div>
                            {(unit.beds != null || unit.baths != null) && (
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {unit.beds != null && <span className="inline-flex items-center gap-0.5"><Bed className="h-3 w-3" /> {unit.beds}</span>}
                                {unit.baths != null && <span className="inline-flex items-center gap-0.5"><Bath className="h-3 w-3" /> {unit.baths}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-1 flex-wrap gap-1.5">
                          {unit.amenities.length === 0 ? (
                            <span className="text-xs italic text-gray-400">No amenities listed</span>
                          ) : unit.amenities.map((a) => (
                            <span key={a}
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition ${selectedAmenities.has(a) ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-gray-200 bg-white text-gray-700'}`}>
                              {formatAmenity(a)}
                            </span>
                          ))}
                        </div>
                        {isOwner && (
                          <div className="shrink-0 md:opacity-0 md:transition md:group-hover:opacity-100">
                            <div className="relative group/menu">
                              <button className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              <div className="absolute right-0 top-full z-10 mt-1 hidden min-w-[160px] rounded-lg border border-gray-200 bg-white shadow-lg group-focus-within/menu:block group-hover/menu:block">
                                <button onClick={() => openEdit(prop, unit)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                                  <Pencil className="h-4 w-4 text-gray-400" /> Edit amenities
                                </button>
                                <div className="my-1 border-t border-gray-100" />
                                <button onClick={() => setConfirmDeleteUnit({ prop, unit })}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                                  <Trash2 className="h-4 w-4" /> Delete unit
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}

      {/* Edit amenities modal */}
      {isOwner && editTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setEditTarget(null)}>
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50"><Pencil className="h-4 w-4 text-teal-600" /></div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Edit amenities</h3>
                  <p className="text-xs text-gray-500">{editTarget.prop.property_name} · Unit {editTarget.unit.unit_name || editTarget.unit.unit_id}</p>
                </div>
              </div>
              <button onClick={() => setEditTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </header>

            <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
              {editOptions.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {editOptions.map((a) => (
                    <label key={a}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${editDraft.has(a) ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={editDraft.has(a)}
                        onChange={() => setEditDraft((s) => { const n = new Set(s); n.has(a) ? n.delete(a) : n.add(a); return n; })}
                        className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                      <span className="truncate">{formatAmenity(a)}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-gray-500">No amenities in the library yet. Add your first one below.</p>
              )}

              <div className="mt-4 border-t border-gray-100 pt-4">
                <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Add custom amenity</label>
                <div className="mt-1 flex gap-2">
                  <input type="text" value={customAmenityDraft} onChange={(e) => setCustomAmenityDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomAmenity(); } }}
                    placeholder="e.g. Hot tub, Balcony, Smart lock…"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
                  <button onClick={addCustomAmenity} disabled={!customAmenityDraft.trim()}
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">New amenities are saved with this unit and become available everywhere after you save.</p>
              </div>
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <span className="text-xs text-gray-500">{editDraft.size} selected</span>
              <div className="flex gap-2">
                <button onClick={() => setEditTarget(null)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                <button onClick={saveEdit} disabled={editSaving}
                  className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
                  {editSaving ? <><Spinner size="sm" /> Saving…</> : <><Save className="h-4 w-4" /> Save</>}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Add building modal */}
      {isOwner && showAddBuilding && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setShowAddBuilding(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50"><Building2 className="h-4 w-4 text-teal-600" /></div>
                <h3 className="text-lg font-semibold text-gray-900">Add building</h3>
              </div>
              <button onClick={() => setShowAddBuilding(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </header>
            <div className="space-y-3 px-5 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Building name</label>
                <input value={buildingForm.name} onChange={(e) => setBuildingForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Limon Apartments" className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Address (optional)</label>
                <input value={buildingForm.address} onChange={(e) => setBuildingForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="3505 NW 5th Ave, Miami, FL" className={inp} />
              </div>
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button onClick={() => setShowAddBuilding(false)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={submitAddBuilding} disabled={buildingSaving || !buildingForm.name.trim()}
                className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
                {buildingSaving ? <><Spinner size="sm" /> Adding…</> : <><Plus className="h-4 w-4" /> Add building</>}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Add unit modal */}
      {isOwner && addUnitTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setAddUnitTarget(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50"><Plus className="h-4 w-4 text-teal-600" /></div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Add unit</h3>
                  <p className="text-xs text-gray-500">In {addUnitTarget.property_name}</p>
                </div>
              </div>
              <button onClick={() => setAddUnitTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </header>
            <div className="space-y-3 px-5 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Unit name / number</label>
                <input value={unitForm.name} onChange={(e) => setUnitForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. 11A" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Bedrooms</label>
                  <input type="number" min="0" max="10" value={unitForm.beds}
                    onChange={(e) => setUnitForm((f) => ({ ...f, beds: Number(e.target.value) }))} className={inp} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Bathrooms</label>
                  <input type="number" min="0" max="10" step="0.5" value={unitForm.baths}
                    onChange={(e) => setUnitForm((f) => ({ ...f, baths: Number(e.target.value) }))} className={inp} />
                </div>
              </div>
              <p className="text-xs text-gray-500">You can tick amenities after the unit is created, from the row's ⋯ menu.</p>
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button onClick={() => setAddUnitTarget(null)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={submitAddUnit} disabled={unitSaving || !unitForm.name.trim()}
                className="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
                {unitSaving ? <><Spinner size="sm" /> Adding…</> : <><Save className="h-4 w-4" /> Add unit</>}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Import confirm */}
      {isOwner && confirmImport && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setConfirmImport(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50"><Download className="h-5 w-5 text-teal-600" /></div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Import from DoorLoop?</h3>
                  <p className="mt-1 text-sm text-gray-600">This pulls in any buildings and units from DoorLoop that aren't already here. Existing records and your edits are left untouched.</p>
                  <p className="mt-2 text-xs text-gray-500">Safe to run multiple times — it only adds new items, never overwrites.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button onClick={() => setConfirmImport(false)} disabled={importing} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={runImport} disabled={importing}
                className="inline-flex min-w-[130px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
                {importing ? <><Spinner size="sm" /> Importing…</> : <><Download className="h-4 w-4" /> Yes, import</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete building confirm */}
      {isOwner && confirmDeleteBuilding && (
        <ConfirmModal
          title="Delete building?"
          body={`${confirmDeleteBuilding.property_name} and all ${confirmDeleteBuilding.units.length} unit${confirmDeleteBuilding.units.length === 1 ? '' : 's'} inside it will be removed. This cannot be undone.`}
          onConfirm={submitDeleteBuilding}
          onCancel={() => setConfirmDeleteBuilding(null)}
          loading={deletingBuilding}
        />
      )}

      {/* Delete unit confirm */}
      {isOwner && confirmDeleteUnit && (
        <ConfirmModal
          title="Delete unit?"
          body={`Unit ${confirmDeleteUnit.unit.unit_name} in ${confirmDeleteUnit.prop.property_name} will be removed. This cannot be undone.`}
          onConfirm={submitDeleteUnit}
          onCancel={() => setConfirmDeleteUnit(null)}
          loading={deletingUnit}
        />
      )}
    </div>
  );
}
