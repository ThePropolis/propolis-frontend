'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Megaphone, Search, Plus, Pencil, Trash2, MoreHorizontal, Save, X, RefreshCw,
  Image as ImageIcon, Building2, Bed, DollarSign, Calendar, EyeOff, Copy,
  Archive, CheckCircle2, ArrowRight, ArrowLeft, Tag, Sparkles, Mail, Phone,
  Send, ChevronRight, AlertCircle
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { Spinner } from '@/components/ui/Spinner';
import { Skeleton } from '@/components/ui/Skeleton';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Status = 'draft' | 'published' | 'archived' | 'rented';

type ListingRow = {
  id: string; building_id: string | null; title: string; subtitle: string | null;
  status: Status; cover_photo: string | null; photos: string[]; asking_rent: number | null;
  available_from: string | null; min_lease_months: number | null; updated_at: string; room_count?: number;
};

type RoomDetail = {
  id: string; unit_id: string; name: string; length: 'LTR' | 'STR' | null;
  bed_size: string | null; bathroom: string | null; amenity_ids: string[];
  financials?: { actual_rent: number | null; base_rent: number | null; revenue_year: number | null } | null;
  unit?: { id: string; name: string; building_id: string; unit_type?: string | null };
};

type Listing = ListingRow & {
  description: string | null; slug: string | null; meta_description: string | null;
  deposit: number | null; application_fee: number | null; available_until: string | null;
  max_lease_months: number | null; is_furnished: boolean | null; utilities_included: boolean | null;
  utilities_note: string | null; pets_allowed: boolean | null; smoking_allowed: boolean | null;
  highlights: string[]; tags: string[]; inquiry_email: string | null; inquiry_phone: string | null;
  published_at: string | null; archived_at: string | null; rooms: RoomDetail[]; building: unknown;
};

type InventoryRoom = {
  unit_id: string; id: string; name: string; length: 'LTR' | 'STR' | null;
  bed_size: string | null; bathroom: string | null;
  financials?: { actual_rent: number | null; base_rent: number | null } | null;
};
type InventoryUnit = { id: string; building_id: string; name: string; unit_type: string | null; rooms: InventoryRoom[] };
type InventoryBuilding = { id: string; name: string; full_name: string | null; address: string | null; photos: string[]; units: InventoryUnit[] };

type DraftListing = Partial<Listing>;
type EditorMode = 'closed' | 'wizard' | 'edit';

function blankDraft(): DraftListing {
  return {
    title: '', subtitle: '', description: '', cover_photo: '', photos: [],
    asking_rent: undefined, deposit: undefined, application_fee: undefined,
    available_from: '', available_until: '', min_lease_months: undefined, max_lease_months: undefined,
    is_furnished: undefined, utilities_included: undefined, utilities_note: '',
    pets_allowed: undefined, smoking_allowed: undefined, highlights: [], tags: [],
    inquiry_email: '', inquiry_phone: '', meta_description: '', building_id: null,
  };
}

function fmtMoney(v: number | null | undefined, opts: { compact?: boolean } = {}) {
  if (v == null || isNaN(Number(v))) return '—';
  const n = Number(v);
  if (opts.compact && Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function timeAgo(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch { return ''; }
}

function statusCls(s: Status) {
  if (s === 'published') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'draft') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (s === 'archived') return 'bg-gray-100 text-gray-600 border-gray-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

function StatusIcon({ s }: { s: Status }) {
  if (s === 'published') return <CheckCircle2 className="h-3 w-3" />;
  if (s === 'draft') return <Pencil className="h-3 w-3" />;
  if (s === 'archived') return <Archive className="h-3 w-3" />;
  return <Tag className="h-3 w-3" />;
}

export default function PublishingPage() {
  const { token } = useAuthStore();
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [inventory, setInventory] = useState<InventoryBuilding[]>([]);
  const [inUseRooms, setInUseRooms] = useState<Record<string, { listing_id: string; listing_title: string; status: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [buildingFilter, setBuildingFilter] = useState<string>('all');

  const [editorMode, setEditorMode] = useState<EditorMode>('closed');
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DraftListing>(blankDraft());
  const [draftRooms, setDraftRooms] = useState<Set<string>>(new Set());
  const [photosCsv, setPhotosCsv] = useState('');
  const [highlightsCsv, setHighlightsCsv] = useState('');
  const [tagsCsv, setTagsCsv] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<ListingRow | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const authHeader = () => ({ Authorization: `Bearer ${token}` });

  async function callJSON(url: string, method: string, body?: unknown): Promise<unknown> {
    const res = await fetch(url, {
      method,
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { detail?: string };
      throw new Error(d.detail || `${method} ${url} failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
  }

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [l, inv, inUse] = await Promise.all([
        fetch(`${API_URL}/api/listings`, { headers: authHeader() }).then((r) => r.json()),
        fetch(`${API_URL}/api/portfolio`, { headers: authHeader() }).then((r) => r.json()),
        fetch(`${API_URL}/api/listings/in-use-rooms`, { headers: authHeader() }).then((r) => r.json()),
      ]);
      setListings(l.listings || []);
      setInventory(inv.buildings || []);
      setInUseRooms(inUse.rooms || {});
    } catch {
      setLoadError("The listings tables aren't set up yet. Run `Backend/migrations/010_listings.sql` in Supabase.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const stats = useMemo(() => ({
    drafts: listings.filter((l) => l.status === 'draft').length,
    published: listings.filter((l) => l.status === 'published').length,
    archived: listings.filter((l) => l.status === 'archived').length,
    rented: listings.filter((l) => l.status === 'rented').length,
  }), [listings]);

  const filteredListings = useMemo(() => listings.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (buildingFilter !== 'all' && l.building_id !== buildingFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!l.title.toLowerCase().includes(q) && !(l.subtitle || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [listings, statusFilter, buildingFilter, search]);

  function buildingNameOf(id: string | null) {
    if (!id) return '';
    return inventory.find((b) => b.id === id)?.name ?? '';
  }

  function findRoomById(rid: string) {
    for (const b of inventory) {
      for (const u of b.units) {
        for (const r of u.rooms) {
          if (r.id === rid) return { ...r, unit_buildingId: b.id, unit_name: u.name };
        }
      }
    }
    return null;
  }

  const selectedRoomList = useMemo(() => {
    return Array.from(draftRooms).map((id) => findRoomById(id)).filter(Boolean);
  }, [draftRooms, inventory]); // eslint-disable-line react-hooks/exhaustive-deps

  const askingRentSuggestion = useMemo(() =>
    selectedRoomList.reduce((s, r) => s + Number(r?.financials?.actual_rent ?? r?.financials?.base_rent ?? 0), 0),
    [selectedRoomList]);

  function toggleRoom(roomId: string) {
    setDraftRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }

  function startNew() {
    setDraft(blankDraft());
    setDraftRooms(new Set());
    setPhotosCsv(''); setHighlightsCsv(''); setTagsCsv('');
    setWizardStep(1); setEditingId(null); setEditorMode('wizard');
  }

  async function startEdit(listing: ListingRow) {
    setBusyIds((prev) => new Set(prev).add(listing.id));
    try {
      const full = await callJSON(`${API_URL}/api/listings/${listing.id}`, 'GET') as Listing;
      setDraft({ ...full });
      setDraftRooms(new Set(full.rooms.map((r) => r.id)));
      setPhotosCsv((full.photos || []).join(', '));
      setHighlightsCsv((full.highlights || []).join(', '));
      setTagsCsv((full.tags || []).join(', '));
      setEditingId(listing.id);
      setEditorMode('edit');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load listing');
    } finally {
      setBusyIds((prev) => { const n = new Set(prev); n.delete(listing.id); return n; });
    }
  }

  function closeEditor() { setEditorMode('closed'); setEditingId(null); }

  function buildBody() {
    const photos = photosCsv.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const highlights = highlightsCsv.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const tags = tagsCsv.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    let inferredBuilding = draft.building_id;
    if (!inferredBuilding) {
      outer: for (const b of inventory) {
        for (const u of b.units) {
          for (const r of u.rooms) {
            if (draftRooms.has(r.id)) { inferredBuilding = b.id; break outer; }
          }
        }
      }
    }
    return {
      building_id: inferredBuilding ?? null, title: draft.title?.trim() || null,
      subtitle: draft.subtitle || null, description: draft.description || null,
      meta_description: draft.meta_description || null,
      cover_photo: draft.cover_photo || (photos[0] ?? null), photos,
      asking_rent: draft.asking_rent ?? null, deposit: draft.deposit ?? null,
      application_fee: draft.application_fee ?? null, available_from: draft.available_from || null,
      available_until: draft.available_until || null, min_lease_months: draft.min_lease_months ?? null,
      max_lease_months: draft.max_lease_months ?? null, is_furnished: draft.is_furnished ?? null,
      utilities_included: draft.utilities_included ?? null, utilities_note: draft.utilities_note || null,
      pets_allowed: draft.pets_allowed ?? null, smoking_allowed: draft.smoking_allowed ?? null,
      highlights, tags, inquiry_email: draft.inquiry_email || null,
      inquiry_phone: draft.inquiry_phone || null, room_ids: Array.from(draftRooms),
    };
  }

  async function saveListing(opts: { publish?: boolean } = {}) {
    if (!draft.title?.trim()) { toast.error('Title is required'); return; }
    if (draftRooms.size === 0) { toast.error('Add at least one room'); return; }
    setSaving(true);
    try {
      const body = buildBody();
      let saved: { id: string };
      if (editingId) {
        saved = await callJSON(`${API_URL}/api/listings/${editingId}`, 'PATCH', body) as { id: string };
      } else {
        saved = await callJSON(`${API_URL}/api/listings`, 'POST', body) as { id: string };
      }
      if (opts.publish) {
        await callJSON(`${API_URL}/api/listings/${saved.id}/publish`, 'POST');
        toast.success('Published');
      } else {
        toast.success(editingId ? 'Saved' : 'Draft created');
      }
      setEditorMode('closed'); setEditingId(null);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(listing: ListingRow, action: 'publish' | 'unpublish' | 'archive' | 'mark-rented') {
    setBusyIds((prev) => new Set(prev).add(listing.id));
    try {
      await callJSON(`${API_URL}/api/listings/${listing.id}/${action}`, 'POST');
      toast.success(`Listing ${action.replace('-', ' ')}d`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyIds((prev) => { const n = new Set(prev); n.delete(listing.id); return n; });
      setOpenDropdown(null);
    }
  }

  async function duplicate(listing: ListingRow) {
    setBusyIds((prev) => new Set(prev).add(listing.id));
    try {
      await callJSON(`${API_URL}/api/listings/${listing.id}/duplicate`, 'POST');
      toast.success('Duplicated as draft');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Duplicate failed');
    } finally {
      setBusyIds((prev) => { const n = new Set(prev); n.delete(listing.id); return n; });
      setOpenDropdown(null);
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    try {
      await callJSON(`${API_URL}/api/listings/${confirmDelete.id}`, 'DELETE');
      toast.success('Listing deleted');
      setConfirmDelete(null);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  function nextWizardStep() {
    if (wizardStep === 1) {
      if (draftRooms.size === 0) { toast.error('Pick at least one room'); return; }
      if (!draft.title?.trim()) {
        const ids = Array.from(draftRooms);
        const room = findRoomById(ids[0]);
        if (room) {
          const bld = inventory.find((b) => b.id === room.unit_buildingId);
          const suggested = ids.length === 1
            ? `Private ${room.bed_size || 'Room'} in ${bld?.full_name || bld?.name || ''}`
            : `${ids.length}-Bedroom Stay at ${bld?.full_name || bld?.name || ''}`;
          setDraft((d) => ({ ...d, title: suggested }));
        }
      }
      setWizardStep(2);
    } else if (wizardStep === 2) {
      if (!draft.title?.trim()) { toast.error('Title is required'); return; }
      setWizardStep(3);
    }
  }

  const previewPhotos = useMemo(() => {
    const extras = photosCsv.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    return draft.cover_photo ? [draft.cover_photo, ...extras] : extras;
  }, [draft.cover_photo, photosCsv]);

  const previewHighlights = useMemo(() =>
    highlightsCsv.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
    [highlightsCsv]);

  const statCards = [
    { label: 'Drafts', value: stats.drafts, tint: 'bg-amber-50 text-amber-700', icon: <Pencil className="h-5 w-5" /> },
    { label: 'Published', value: stats.published, tint: 'bg-emerald-50 text-emerald-700', icon: <CheckCircle2 className="h-5 w-5" /> },
    { label: 'Archived', value: stats.archived, tint: 'bg-gray-100 text-gray-700', icon: <Archive className="h-5 w-5" /> },
    { label: 'Rented', value: stats.rented, tint: 'bg-blue-50 text-blue-700', icon: <Tag className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-rose-50">
            <Megaphone className="h-6 w-6 text-rose-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Publishing</h1>
            <p className="text-sm text-gray-500">Curate listings from your inventory and publish them when ready.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={startNew} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700">
            <Plus className="h-4 w-4" /> New listing
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCards.map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.tint}`}>{c.icon}</div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">{c.label}</div>
              {loading ? <Skeleton height="1.5rem" width="2rem" /> : <div className="text-xl font-semibold text-gray-900">{c.value}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <section className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search listings…"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs">
            {(['all', 'draft', 'published', 'rented', 'archived'] as const).map((v) => (
              <button key={v} onClick={() => setStatusFilter(v)}
                className={`rounded-md px-2.5 py-1 capitalize transition ${statusFilter === v ? 'bg-rose-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {v}
              </button>
            ))}
          </div>
          {inventory.length > 0 && (
            <select value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
              <option value="all">All buildings</option>
              {inventory.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      </section>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} height="13rem" />)}
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div><div className="font-medium">Setup needed</div><div className="mt-1">{loadError}</div></div>
          </div>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <Megaphone className="h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-700">{listings.length === 0 ? 'No listings yet' : 'No matches'}</p>
          <p className="max-w-md text-sm text-gray-500">
            {listings.length === 0 ? 'Create your first listing to start publishing rooms from your inventory.' : 'Try a different filter or search.'}
          </p>
          {listings.length === 0 && (
            <button onClick={startNew} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
              <Plus className="h-4 w-4" /> New listing
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" ref={dropdownRef}>
          {filteredListings.map((l) => (
            <article key={l.id} className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:shadow-md">
              <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-rose-100 to-pink-100">
                {l.cover_photo
                  ? <img src={l.cover_photo} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" loading="lazy" />
                  : <div className="flex h-full w-full items-center justify-center text-rose-700/40"><ImageIcon className="h-10 w-10" /></div>
                }
                <span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${statusCls(l.status)}`}>
                  <StatusIcon s={l.status} /> {l.status}
                </span>
                <div className="absolute right-2 top-2">
                  <div className="relative">
                    <button
                      onClick={() => setOpenDropdown(openDropdown === l.id ? null : l.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-gray-700 shadow-sm hover:bg-white"
                    >
                      {busyIds.has(l.id) ? <Spinner size="xs" /> : <MoreHorizontal className="h-4 w-4" />}
                    </button>
                    {openDropdown === l.id && (
                      <div className="absolute right-0 top-9 z-10 min-w-[180px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                        <button onClick={() => { startEdit(l); setOpenDropdown(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                          <Pencil className="h-4 w-4 text-gray-400" /> Edit
                        </button>
                        <button onClick={() => duplicate(l)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                          <Copy className="h-4 w-4 text-gray-400" /> Duplicate
                        </button>
                        <div className="my-1 border-t border-gray-100" />
                        {l.status === 'draft' && (
                          <button onClick={() => setStatus(l, 'publish')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50">
                            <Send className="h-4 w-4" /> Publish
                          </button>
                        )}
                        {l.status === 'published' && (<>
                          <button onClick={() => setStatus(l, 'unpublish')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50">
                            <EyeOff className="h-4 w-4" /> Unpublish (draft)
                          </button>
                          <button onClick={() => setStatus(l, 'mark-rented')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50">
                            <Tag className="h-4 w-4" /> Mark as rented
                          </button>
                        </>)}
                        {(l.status === 'rented' || l.status === 'archived') && (
                          <button onClick={() => setStatus(l, 'unpublish')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50">
                            <Pencil className="h-4 w-4" /> Move to draft
                          </button>
                        )}
                        {l.status !== 'archived' && (
                          <button onClick={() => setStatus(l, 'archive')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                            <Archive className="h-4 w-4 text-gray-400" /> Archive
                          </button>
                        )}
                        <div className="my-1 border-t border-gray-100" />
                        <button onClick={() => { setConfirmDelete(l); setOpenDropdown(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <button onClick={() => startEdit(l)} className="text-left">
                  <h3 className="font-semibold text-gray-900 group-hover:text-rose-700">{l.title}</h3>
                  {l.subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{l.subtitle}</p>}
                </button>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  {l.building_id && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {buildingNameOf(l.building_id)}</span>}
                  <span className="inline-flex items-center gap-1"><Bed className="h-3 w-3" /> {l.room_count ?? 0} room{l.room_count === 1 ? '' : 's'}</span>
                  {l.available_from && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {l.available_from}</span>}
                </div>
                <div className="mt-3 flex items-end justify-between">
                  {l.asking_rent != null ? (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">Asking</div>
                      <div className="text-lg font-bold text-emerald-700">{fmtMoney(l.asking_rent)}<span className="text-xs font-normal text-gray-500">/mo</span></div>
                    </div>
                  ) : (
                    <span className="text-xs italic text-gray-400">No price set</span>
                  )}
                  <span className="text-[10px] text-gray-400">edited {timeAgo(l.updated_at)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Editor slide-over */}
      {editorMode !== 'closed' && (
        <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-gray-900/50" onClick={closeEditor} role="dialog" aria-modal="true">
          <div onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-gray-100 px-6 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-50">
                  <Megaphone className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{editorMode === 'edit' ? 'Edit listing' : 'New listing'}</h2>
                  {editorMode === 'wizard' && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      {([1, 2, 3] as const).map((n, i) => (<>
                        {i > 0 && <ChevronRight key={`sep-${n}`} className="h-3 w-3 text-gray-300" />}
                        <span key={n} className={wizardStep === n ? 'font-semibold text-rose-700' : ''}>
                          {n}. {n === 1 ? 'Pick rooms' : n === 2 ? 'Details' : 'Preview'}
                        </span>
                      </>))}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={closeEditor} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Step 1: Rooms */}
              {editorMode === 'wizard' && wizardStep === 1 && (
                <div>
                  <div className="mb-3 text-sm text-gray-600">Choose the rooms this listing covers. A single private bedroom = one room. An entire apartment = all its rooms.</div>
                  <div className="rounded-lg border border-gray-200 bg-white">
                    {inventory.map((b) => (
                      <details key={b.id} className="group border-b border-gray-100 last:border-b-0" open>
                        <summary className="flex cursor-pointer items-center gap-2 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
                          <ChevronRight className="h-3.5 w-3.5 text-gray-400 transition group-open:rotate-90" />
                          <Building2 className="h-4 w-4 text-rose-500" /> {b.name}
                          <span className="ml-auto text-xs text-gray-500">{b.units.reduce((a, u) => a + u.rooms.length, 0)} rooms</span>
                        </summary>
                        <div className="divide-y divide-gray-100">
                          {b.units.map((u) => (
                            <div key={u.id} className="px-3 py-2">
                              <div className="text-xs font-medium text-gray-500">Apt {u.name}{u.unit_type ? ` · ${u.unit_type}` : ''}</div>
                              <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                                {u.rooms.map((r) => {
                                  const inUse = inUseRooms[r.id];
                                  const sel = draftRooms.has(r.id);
                                  return (
                                    <label key={r.id} className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition ${sel ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                                      <input type="checkbox" checked={sel} onChange={() => toggleRoom(r.id)} className="h-3.5 w-3.5 rounded border-gray-300 text-rose-600" />
                                      <span className="font-medium">{r.name}</span>
                                      {r.length && <span className="text-[10px] text-gray-500">· {r.length}</span>}
                                      {r.bed_size && <span className="text-[10px] text-gray-500">· {r.bed_size}</span>}
                                      {r.financials?.actual_rent && <span className="ml-auto text-emerald-700">{fmtMoney(r.financials.actual_rent)}</span>}
                                      {inUse && inUse.length > 0 && (
                                        <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-800" title={`In: ${inUse.map((x) => x.listing_title).join(', ')}`}>in use</span>
                                      )}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-gray-500"><strong className="text-gray-900">{draftRooms.size}</strong> room{draftRooms.size === 1 ? '' : 's'} selected</div>
                </div>
              )}

              {/* Step 2/Edit: Details */}
              {(editorMode === 'edit' || wizardStep === 2) && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="space-y-3 lg:col-span-2">
                    <section className="rounded-lg border border-gray-200 bg-white p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800"><Sparkles className="h-4 w-4 text-rose-500" /> Marketing</h3>
                      {(['title', 'subtitle', 'meta_description'] as const).map((field) => (
                        <label key={field} className="mt-3 block text-sm first:mt-0">
                          <span className="mb-1 block text-xs font-medium text-gray-600">{field === 'title' ? 'Title *' : field === 'subtitle' ? 'Subtitle' : 'SEO meta description'}</span>
                          <input value={(draft[field] as string) || ''} onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                            placeholder={field === 'title' ? 'Modern Studio in East Little Havana' : field === 'subtitle' ? 'Furnished · all-inclusive · steps from Brickell' : 'One-liner for search results (~155 chars)'}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                        </label>
                      ))}
                      <label className="mt-3 block text-sm">
                        <span className="mb-1 block text-xs font-medium text-gray-600">Description</span>
                        <textarea value={draft.description || ''} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={5}
                          placeholder="Long-form marketing copy…" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                      </label>
                    </section>

                    <section className="rounded-lg border border-gray-200 bg-white p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800"><ImageIcon className="h-4 w-4 text-rose-500" /> Photos</h3>
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs font-medium text-gray-600">Cover photo URL</span>
                        <input value={draft.cover_photo || ''} onChange={(e) => setDraft((d) => ({ ...d, cover_photo: e.target.value }))}
                          placeholder="https://…" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                      </label>
                      <label className="mt-3 block text-sm">
                        <span className="mb-1 block text-xs font-medium text-gray-600">Gallery (one URL per line, or comma-separated)</span>
                        <textarea value={photosCsv} onChange={(e) => setPhotosCsv(e.target.value)} rows={3}
                          placeholder="https://…" className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs" />
                      </label>
                      {previewPhotos.length > 0 && (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {previewPhotos.slice(0, 6).map((p, i) => (
                            <div key={i} className={`aspect-[4/3] overflow-hidden rounded-md ${i === 0 ? 'ring-2 ring-rose-300' : 'ring-1 ring-gray-200'}`}>
                              <img src={p} alt="" className="h-full w-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="rounded-lg border border-gray-200 bg-white p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800"><Tag className="h-4 w-4 text-rose-500" /> Highlights & Tags</h3>
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs font-medium text-gray-600">Highlights (comma-separated)</span>
                        <input value={highlightsCsv} onChange={(e) => setHighlightsCsv(e.target.value)}
                          placeholder="Walk to Brickell, In-unit washer, Roof deck" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                      </label>
                      <label className="mt-3 block text-sm">
                        <span className="mb-1 block text-xs font-medium text-gray-600">Tags (search filters)</span>
                        <input value={tagsCsv} onChange={(e) => setTagsCsv(e.target.value)}
                          placeholder="brickell, downtown, coliving, pet-friendly" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                      </label>
                    </section>
                  </div>

                  <div className="space-y-3">
                    <section className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-900"><DollarSign className="h-4 w-4" /> Pricing</h3>
                      {askingRentSuggestion > 0 && !draft.asking_rent && (
                        <button onClick={() => setDraft((d) => ({ ...d, asking_rent: askingRentSuggestion }))}
                          className="mb-2 inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50">
                          <Sparkles className="h-3.5 w-3.5" /> Use {fmtMoney(askingRentSuggestion)} from inventory
                        </button>
                      )}
                      {(['asking_rent', 'deposit', 'application_fee'] as const).map((f) => (
                        <label key={f} className="mt-2 block text-sm first:mt-0">
                          <span className="mb-1 block text-xs font-medium text-gray-600">{f === 'asking_rent' ? 'Asking rent / month' : f === 'deposit' ? 'Deposit' : 'Application fee'}</span>
                          <input type="number" min="0" step="1" value={(draft[f] as number) ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                        </label>
                      ))}
                    </section>

                    <section className="rounded-lg border border-gray-200 bg-white p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800"><Calendar className="h-4 w-4 text-rose-500" /> Availability & terms</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {(['available_from', 'available_until', 'min_lease_months', 'max_lease_months'] as const).map((f) => (
                          <label key={f} className="block text-sm">
                            <span className="mb-1 block text-xs font-medium text-gray-600">{f.replace(/_/g, ' ').replace('from', 'from').replace('until', 'until').replace('min', 'Min').replace('max', 'Max').replace('months', '(months)')}</span>
                            <input type={f.includes('from') || f.includes('until') ? 'date' : 'number'} min="1"
                              value={(draft[f] as string | number) ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value === '' ? undefined : f.includes('from') || f.includes('until') ? e.target.value : Number(e.target.value) }))}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                          </label>
                        ))}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        {([['is_furnished', 'Furnished'], ['utilities_included', 'Utilities included'], ['pets_allowed', 'Pets allowed'], ['smoking_allowed', 'Smoking allowed']] as const).map(([f, label]) => (
                          <label key={f} className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={!!draft[f]} onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.checked }))}
                              className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500" />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                      <label className="mt-3 block text-sm">
                        <span className="mb-1 block text-xs font-medium text-gray-600">Utilities note</span>
                        <input value={draft.utilities_note || ''} onChange={(e) => setDraft((d) => ({ ...d, utilities_note: e.target.value }))}
                          placeholder="Internet + electricity included; gas separate" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                      </label>
                    </section>

                    <section className="rounded-lg border border-gray-200 bg-white p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800"><Mail className="h-4 w-4 text-rose-500" /> Inquiries</h3>
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs font-medium text-gray-600">Contact email</span>
                        <input type="email" value={draft.inquiry_email || ''} onChange={(e) => setDraft((d) => ({ ...d, inquiry_email: e.target.value }))}
                          placeholder="leads@propolis.com" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                      </label>
                      <label className="mt-2 block text-sm">
                        <span className="mb-1 block text-xs font-medium text-gray-600">Contact phone</span>
                        <input type="tel" value={draft.inquiry_phone || ''} onChange={(e) => setDraft((d) => ({ ...d, inquiry_phone: e.target.value }))}
                          placeholder="+1 305 555 0100" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                      </label>
                    </section>

                    {editorMode === 'edit' && (
                      <section className="rounded-lg border border-gray-200 bg-white p-4">
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800"><Bed className="h-4 w-4 text-rose-500" /> Rooms ({draftRooms.size})</h3>
                        <details className="text-sm" open={draftRooms.size === 0}>
                          <summary className="cursor-pointer text-rose-700 hover:text-rose-800">Edit room selection</summary>
                          <div className="mt-2 max-h-72 overflow-y-auto rounded border border-gray-200">
                            {inventory.map((b) => (
                              <div key={b.id} className="border-b border-gray-100 last:border-b-0">
                                <div className="bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700">{b.name}</div>
                                {b.units.map((u) => (
                                  <div key={u.id} className="px-2 py-1">
                                    <div className="text-[10px] text-gray-500">Apt {u.name}</div>
                                    <div className="mt-0.5 flex flex-wrap gap-1">
                                      {u.rooms.map((r) => (
                                        <button key={r.id} type="button" onClick={() => toggleRoom(r.id)}
                                          className={`rounded-md border px-1.5 py-0.5 text-[11px] ${draftRooms.has(r.id) ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-600'}`}>
                                          {r.name}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </details>
                      </section>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Preview */}
              {editorMode === 'wizard' && wizardStep === 3 && (
                <div className="mx-auto max-w-3xl">
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    {previewPhotos[0]
                      ? <div className="aspect-video w-full overflow-hidden bg-gray-100"><img src={previewPhotos[0]} alt="" className="h-full w-full object-cover" /></div>
                      : <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-rose-100 to-pink-100 text-rose-600/40"><ImageIcon className="h-12 w-12" /></div>
                    }
                    <div className="p-6">
                      <h2 className="text-2xl font-bold text-gray-900">{draft.title}</h2>
                      {draft.subtitle && <p className="mt-1 text-base text-gray-600">{draft.subtitle}</p>}
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-700">
                        {draft.asking_rent != null && <span className="text-2xl font-bold text-emerald-700">{fmtMoney(draft.asking_rent)}<span className="text-sm font-normal text-gray-500">/mo</span></span>}
                        <span>· {draftRooms.size} room{draftRooms.size === 1 ? '' : 's'}</span>
                        {draft.available_from && <span>· Available {draft.available_from}</span>}
                        {draft.is_furnished && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Furnished</span>}
                        {draft.utilities_included && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">Utilities included</span>}
                      </div>
                      {previewHighlights.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {previewHighlights.map((h) => <span key={h} className="rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-700">{h}</span>)}
                        </div>
                      )}
                      {draft.description && <p className="mt-4 whitespace-pre-line text-sm text-gray-700">{draft.description}</p>}
                      <div className="mt-6 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-4">
                        <div><div className="text-[10px] uppercase tracking-wide text-gray-500">Deposit</div><div className="font-medium">{fmtMoney(draft.deposit)}</div></div>
                        <div><div className="text-[10px] uppercase tracking-wide text-gray-500">App fee</div><div className="font-medium">{fmtMoney(draft.application_fee)}</div></div>
                        <div><div className="text-[10px] uppercase tracking-wide text-gray-500">Min lease</div><div className="font-medium">{draft.min_lease_months ? `${draft.min_lease_months} mo` : '—'}</div></div>
                        <div><div className="text-[10px] uppercase tracking-wide text-gray-500">Pets</div><div className="font-medium">{draft.pets_allowed ? 'Yes' : 'No'}</div></div>
                      </div>
                      {(draft.inquiry_email || draft.inquiry_phone) && (
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-600">
                          {draft.inquiry_email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {draft.inquiry_email}</span>}
                          {draft.inquiry_phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {draft.inquiry_phone}</span>}
                        </div>
                      )}
                      {previewPhotos.length > 1 && (
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          {previewPhotos.slice(1, 7).map((p, i) => (
                            <div key={i} className="aspect-[4/3] overflow-hidden rounded-md"><img src={p} alt="" className="h-full w-full object-cover" /></div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-center text-xs text-gray-500">Save as draft to keep tweaking, or publish now.</p>
                </div>
              )}
            </div>

            <footer className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-3">
              <div>
                {editorMode === 'wizard' && wizardStep > 1 && (
                  <button onClick={() => setWizardStep((s) => (s - 1) as 1 | 2)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={closeEditor} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                {editorMode === 'wizard' && wizardStep < 3 ? (
                  <button onClick={nextWizardStep} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
                    Next <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (<>
                  <button onClick={() => saveListing({ publish: false })} disabled={saving}
                    className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                    {saving ? <><Spinner size="sm" /> Saving…</> : <><Save className="h-4 w-4" /> Save draft</>}
                  </button>
                  <button onClick={() => saveListing({ publish: true })} disabled={saving}
                    className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
                    {saving ? <><Spinner size="sm" color="white" /> Publishing…</> : <><Send className="h-4 w-4" /> Publish</>}
                  </button>
                </>)}
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setConfirmDelete(null)} role="dialog" aria-modal="true">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="px-5 py-5">
              <h3 className="text-base font-semibold text-gray-900">Delete listing?</h3>
              <p className="mt-1 text-sm text-gray-600"><span className="font-medium">{confirmDelete.title}</span> will be removed permanently.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button onClick={() => setConfirmDelete(null)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={doDelete} className="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
