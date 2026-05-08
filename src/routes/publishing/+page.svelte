<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { fade, scale } from 'svelte/transition';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { auth } from '$lib/api/auth';
	import { toast } from '$lib/components/ui/toastStore';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import Dropdown from '$lib/components/ui/Dropdown.svelte';
	import {
		Megaphone,
		Search,
		Plus,
		Pencil,
		Trash2,
		MoreHorizontal,
		Save,
		X,
		RefreshCw,
		Image as ImageIcon,
		Building2,
		Bed,
		DollarSign,
		Calendar,
		Eye,
		EyeOff,
		Copy,
		Archive,
		CheckCircle2,
		ArrowRight,
		ArrowLeft,
		Tag,
		Sparkles,
		Mail,
		Phone,
		Send,
		ChevronDown,
		ChevronRight,
		AlertCircle
	} from 'lucide-svelte';

	type Status = 'draft' | 'published' | 'archived' | 'rented';

	type ListingRow = {
		id: string;
		building_id: string | null;
		title: string;
		subtitle: string | null;
		status: Status;
		cover_photo: string | null;
		photos: string[];
		asking_rent: number | null;
		available_from: string | null;
		min_lease_months: number | null;
		updated_at: string;
		room_count?: number;
	};

	type RoomDetail = {
		id: string;
		unit_id: string;
		name: string;
		length: 'LTR' | 'STR' | null;
		bed_size: string | null;
		bathroom: string | null;
		amenity_ids: string[];
		financials?: {
			actual_rent: number | null;
			base_rent: number | null;
			revenue_year: number | null;
		} | null;
		unit?: { id: string; name: string; building_id: string; unit_type?: string | null };
	};

	type Listing = ListingRow & {
		description: string | null;
		slug: string | null;
		meta_description: string | null;
		deposit: number | null;
		application_fee: number | null;
		available_until: string | null;
		max_lease_months: number | null;
		is_furnished: boolean | null;
		utilities_included: boolean | null;
		utilities_note: string | null;
		pets_allowed: boolean | null;
		smoking_allowed: boolean | null;
		highlights: string[];
		tags: string[];
		inquiry_email: string | null;
		inquiry_phone: string | null;
		published_at: string | null;
		archived_at: string | null;
		rooms: RoomDetail[];
		building: any | null;
	};

	type InventoryRoom = {
		unit_id: string;
		id: string;
		name: string;
		length: 'LTR' | 'STR' | null;
		bed_size: string | null;
		bathroom: string | null;
		financials?: { actual_rent: number | null; base_rent: number | null } | null;
	};
	type InventoryUnit = { id: string; building_id: string; name: string; unit_type: string | null; rooms: InventoryRoom[] };
	type InventoryBuilding = { id: string; name: string; full_name: string | null; address: string | null; photos: string[]; units: InventoryUnit[] };

	let listings: ListingRow[] = [];
	let inventory: InventoryBuilding[] = [];
	let inUseRooms: Record<string, { listing_id: string; listing_title: string; status: string }[]> = {};
	let loading = true;
	let loadError: string | null = null;

	// filters
	let search = '';
	let statusFilter: 'all' | Status = 'all';
	let buildingFilter: string | 'all' = 'all';

	// editor state
	type EditorMode = 'closed' | 'wizard' | 'edit';
	let editorMode: EditorMode = 'closed';
	let wizardStep: 1 | 2 | 3 = 1;
	let editingId: string | null = null;
	let saving = false;

	// shared draft state
	let draft: Partial<Listing> = blankDraft();
	let draftRooms = new Set<string>();
	let photosCsv = '';
	let highlightsCsv = '';
	let tagsCsv = '';
	let confirmDelete: ListingRow | null = null;
	let busyIds = new Set<string>();

	function blankDraft(): Partial<Listing> {
		return {
			title: '',
			subtitle: '',
			description: '',
			cover_photo: '',
			photos: [],
			asking_rent: undefined,
			deposit: undefined,
			application_fee: undefined,
			available_from: '',
			available_until: '',
			min_lease_months: undefined,
			max_lease_months: undefined,
			is_furnished: undefined,
			utilities_included: undefined,
			utilities_note: '',
			pets_allowed: undefined,
			smoking_allowed: undefined,
			highlights: [],
			tags: [],
			inquiry_email: '',
			inquiry_phone: '',
			meta_description: '',
			building_id: null
		};
	}

	function authHeader() {
		return { Authorization: `Bearer ${get(auth).token}` };
	}
	async function callJSON(url: string, method: string, body?: any): Promise<any> {
		const res = await fetch(url, {
			method,
			headers: { ...authHeader(), 'Content-Type': 'application/json' },
			body: body ? JSON.stringify(body) : undefined
		});
		if (!res.ok) {
			const d = await res.json().catch(() => ({}));
			throw new Error(d.detail || `${method} ${url} failed (${res.status})`);
		}
		return res.json().catch(() => ({}));
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
		} catch {
			return '';
		}
	}
	function statusClass(s: Status): string {
		if (s === 'published') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
		if (s === 'draft') return 'bg-amber-50 text-amber-700 border-amber-200';
		if (s === 'archived') return 'bg-gray-100 text-gray-600 border-gray-200';
		return 'bg-blue-50 text-blue-700 border-blue-200'; // rented
	}

	async function load() {
		loading = true;
		loadError = null;
		try {
			const [l, inv, in_use] = await Promise.all([
				fetch(`${PUBLIC_API_URL}/api/listings`, { headers: authHeader() }).then((r) => r.json()),
				fetch(`${PUBLIC_API_URL}/api/portfolio`, { headers: authHeader() }).then((r) => r.json()),
				fetch(`${PUBLIC_API_URL}/api/listings/in-use-rooms`, { headers: authHeader() }).then((r) => r.json())
			]);
			listings = l.listings || [];
			inventory = inv.buildings || [];
			inUseRooms = in_use.rooms || {};
		} catch (e: any) {
			loadError = 'The listings tables aren\'t set up yet. Run `Backend/migrations/010_listings.sql` in Supabase.';
		} finally {
			loading = false;
		}
	}
	onMount(load);

	// ── Filtered list ────────────────────────────────────────────
	$: filteredListings = listings.filter((l) => {
		if (statusFilter !== 'all' && l.status !== statusFilter) return false;
		if (buildingFilter !== 'all' && l.building_id !== buildingFilter) return false;
		if (search.trim()) {
			const q = search.trim().toLowerCase();
			if (
				!l.title.toLowerCase().includes(q) &&
				!(l.subtitle || '').toLowerCase().includes(q)
			)
				return false;
		}
		return true;
	});

	$: stats = {
		drafts: listings.filter((l) => l.status === 'draft').length,
		published: listings.filter((l) => l.status === 'published').length,
		archived: listings.filter((l) => l.status === 'archived').length,
		rented: listings.filter((l) => l.status === 'rented').length
	};

	function buildingNameOf(id: string | null): string {
		if (!id) return '';
		return inventory.find((b) => b.id === id)?.name ?? '';
	}

	// ── Wizard / Editor ─────────────────────────────────────────
	function startNew() {
		draft = blankDraft();
		draftRooms = new Set();
		photosCsv = '';
		highlightsCsv = '';
		tagsCsv = '';
		wizardStep = 1;
		editingId = null;
		editorMode = 'wizard';
	}

	async function startEdit(listing: ListingRow) {
		busyIds.add(listing.id);
		busyIds = busyIds;
		try {
			const full: Listing = await callJSON(`${PUBLIC_API_URL}/api/listings/${listing.id}`, 'GET');
			draft = { ...full };
			draftRooms = new Set(full.rooms.map((r) => r.id));
			photosCsv = (full.photos || []).join(', ');
			highlightsCsv = (full.highlights || []).join(', ');
			tagsCsv = (full.tags || []).join(', ');
			editingId = listing.id;
			editorMode = 'edit';
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			busyIds.delete(listing.id);
			busyIds = busyIds;
		}
	}

	function closeEditor() {
		editorMode = 'closed';
		editingId = null;
	}

	function toggleRoom(roomId: string) {
		if (draftRooms.has(roomId)) draftRooms.delete(roomId);
		else draftRooms.add(roomId);
		draftRooms = draftRooms;
	}

	function buildBody(): any {
		const photos = photosCsv.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
		const highlights = highlightsCsv.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
		const tags = tagsCsv.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
		// Building inferred from selected rooms (first one's building) if not set
		let inferredBuilding = draft.building_id;
		if (!inferredBuilding) {
			for (const b of inventory) {
				for (const u of b.units) {
					for (const r of u.rooms) {
						if (draftRooms.has(r.id)) {
							inferredBuilding = b.id;
							break;
						}
					}
					if (inferredBuilding) break;
				}
				if (inferredBuilding) break;
			}
		}
		return {
			building_id: inferredBuilding ?? null,
			title: draft.title?.trim() || null,
			subtitle: draft.subtitle || null,
			description: draft.description || null,
			meta_description: draft.meta_description || null,
			cover_photo: draft.cover_photo || (photos[0] ?? null),
			photos,
			asking_rent: draft.asking_rent ?? null,
			deposit: draft.deposit ?? null,
			application_fee: draft.application_fee ?? null,
			available_from: draft.available_from || null,
			available_until: draft.available_until || null,
			min_lease_months: draft.min_lease_months ?? null,
			max_lease_months: draft.max_lease_months ?? null,
			is_furnished: draft.is_furnished ?? null,
			utilities_included: draft.utilities_included ?? null,
			utilities_note: draft.utilities_note || null,
			pets_allowed: draft.pets_allowed ?? null,
			smoking_allowed: draft.smoking_allowed ?? null,
			highlights,
			tags,
			inquiry_email: draft.inquiry_email || null,
			inquiry_phone: draft.inquiry_phone || null,
			room_ids: Array.from(draftRooms)
		};
	}

	async function saveListing(opts: { publish?: boolean } = {}): Promise<string | null> {
		if (!draft.title?.trim()) {
			toast.error('Title is required');
			return null;
		}
		if (draftRooms.size === 0) {
			toast.error('Add at least one room');
			return null;
		}
		saving = true;
		try {
			const body = buildBody();
			let saved;
			if (editingId) {
				saved = await callJSON(`${PUBLIC_API_URL}/api/listings/${editingId}`, 'PATCH', body);
			} else {
				saved = await callJSON(`${PUBLIC_API_URL}/api/listings`, 'POST', body);
			}
			const id = saved.id;
			if (opts.publish) {
				await callJSON(`${PUBLIC_API_URL}/api/listings/${id}/publish`, 'POST');
				toast.success('Published');
			} else {
				toast.success(editingId ? 'Saved' : 'Draft created');
			}
			editorMode = 'closed';
			editingId = null;
			await load();
			return id;
		} catch (e: any) {
			toast.error(e.message);
			return null;
		} finally {
			saving = false;
		}
	}

	async function setStatus(listing: ListingRow, action: 'publish' | 'unpublish' | 'archive' | 'mark-rented') {
		busyIds.add(listing.id);
		busyIds = busyIds;
		try {
			await callJSON(`${PUBLIC_API_URL}/api/listings/${listing.id}/${action}`, 'POST');
			toast.success(`Listing ${action.replace('-', ' ')}d`);
			await load();
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			busyIds.delete(listing.id);
			busyIds = busyIds;
		}
	}

	async function duplicate(listing: ListingRow) {
		busyIds.add(listing.id);
		busyIds = busyIds;
		try {
			await callJSON(`${PUBLIC_API_URL}/api/listings/${listing.id}/duplicate`, 'POST');
			toast.success('Duplicated as draft');
			await load();
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			busyIds.delete(listing.id);
			busyIds = busyIds;
		}
	}

	async function doDelete() {
		if (!confirmDelete) return;
		try {
			await callJSON(`${PUBLIC_API_URL}/api/listings/${confirmDelete.id}`, 'DELETE');
			toast.success('Listing deleted');
			confirmDelete = null;
			await load();
		} catch (e: any) {
			toast.error(e.message);
		}
	}

	// Auto-suggest a title when stepping from rooms → details
	function suggestTitle(): string {
		if (!draft.title) {
			const ids = Array.from(draftRooms);
			if (ids.length === 0) return '';
			const room = findRoomById(ids[0]);
			const bld = inventory.find((b) => b.id === room?.unit_buildingId);
			if (room && bld) {
				if (ids.length === 1) {
					return `Private ${room.bed_size || 'Room'} in ${bld.full_name || bld.name}`;
				}
				return `${ids.length}-Bedroom Stay at ${bld.full_name || bld.name}`;
			}
		}
		return draft.title || '';
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

	function nextWizardStep() {
		if (wizardStep === 1) {
			if (draftRooms.size === 0) {
				toast.error('Pick at least one room');
				return;
			}
			if (!draft.title?.trim()) draft.title = suggestTitle();
			wizardStep = 2;
		} else if (wizardStep === 2) {
			if (!draft.title?.trim()) {
				toast.error('Title is required');
				return;
			}
			wizardStep = 3;
		}
	}

	$: selectedRoomList = (() => {
		const list: ReturnType<typeof findRoomById>[] = [];
		for (const id of draftRooms) {
			const r = findRoomById(id);
			if (r) list.push(r);
		}
		return list;
	})();

	$: askingRentSuggestion = (() => {
		if (!selectedRoomList.length) return 0;
		return selectedRoomList.reduce((s, r) => s + Number(r?.financials?.actual_rent ?? r?.financials?.base_rent ?? 0), 0);
	})();
</script>

<div class="space-y-5">
	<!-- Header -->
	<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<div class="flex items-center gap-3">
			<div class="flex h-11 w-11 items-center justify-center rounded-lg bg-rose-50">
				<Megaphone class="h-6 w-6 text-rose-600" />
			</div>
			<div>
				<h1 class="text-2xl font-semibold text-gray-900">Publishing</h1>
				<p class="text-sm text-gray-500">Curate listings from your inventory and publish them when ready.</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<button on:click={load} disabled={loading} class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
				<RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" /> Refresh
			</button>
			<button on:click={startNew} class="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700">
				<Plus class="h-4 w-4" /> New listing
			</button>
		</div>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
		{#each [
			{ label: 'Drafts', value: stats.drafts, tint: 'bg-amber-50 text-amber-700' },
			{ label: 'Published', value: stats.published, tint: 'bg-emerald-50 text-emerald-700' },
			{ label: 'Archived', value: stats.archived, tint: 'bg-gray-100 text-gray-700' },
			{ label: 'Rented', value: stats.rented, tint: 'bg-blue-50 text-blue-700' }
		] as c}
			<div class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg {c.tint}">
					{#if c.label === 'Published'}<CheckCircle2 class="h-5 w-5" />
					{:else if c.label === 'Drafts'}<Pencil class="h-5 w-5" />
					{:else if c.label === 'Archived'}<Archive class="h-5 w-5" />
					{:else}<Tag class="h-5 w-5" />{/if}
				</div>
				<div>
					<div class="text-xs uppercase tracking-wide text-gray-500">{c.label}</div>
					{#if loading}<Skeleton height="1.5rem" width="2rem" />{:else}<div class="text-xl font-semibold text-gray-900">{c.value}</div>{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Filter bar -->
	<section class="rounded-lg border border-gray-200 bg-white p-3">
		<div class="flex flex-col gap-3 md:flex-row md:items-center">
			<div class="relative flex-1">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
				<input type="text" bind:value={search} placeholder="Search listings…" class="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500" />
				{#if search}
					<button on:click={() => (search = '')} class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Clear"><X class="h-4 w-4" /></button>
				{/if}
			</div>
			<div class="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs">
				{#each ['all', 'draft', 'published', 'rented', 'archived'] as const as v}
					<button on:click={() => (statusFilter = v)} class="rounded-md px-2.5 py-1 capitalize transition" class:bg-rose-600={statusFilter === v} class:text-white={statusFilter === v} class:text-gray-600={statusFilter !== v} class:hover:bg-gray-50={statusFilter !== v}>{v}</button>
				{/each}
			</div>
			{#if inventory.length > 0}
				<select bind:value={buildingFilter} class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
					<option value="all">All buildings</option>
					{#each inventory as b}
						<option value={b.id}>{b.name}</option>
					{/each}
				</select>
			{/if}
		</div>
	</section>

	<!-- List -->
	{#if loading}
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
			{#each Array(3) as _}
				<Skeleton height="13rem" />
			{/each}
		</div>
	{:else if loadError}
		<div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
			<div class="flex items-start gap-2">
				<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
				<div>
					<div class="font-medium">Setup needed</div>
					<div class="mt-1">{loadError}</div>
				</div>
			</div>
		</div>
	{:else if filteredListings.length === 0}
		<div class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
			<Megaphone class="h-10 w-10 text-gray-300" />
			<p class="font-medium text-gray-700">{listings.length === 0 ? 'No listings yet' : 'No matches'}</p>
			<p class="max-w-md text-sm text-gray-500">
				{#if listings.length === 0}
					Create your first listing to start publishing rooms from your inventory.
				{:else}
					Try a different filter or search.
				{/if}
			</p>
			{#if listings.length === 0}
				<button on:click={startNew} class="mt-2 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"><Plus class="h-4 w-4" /> New listing</button>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
			{#each filteredListings as l (l.id)}
				<article class="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:shadow-md">
					<div class="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-rose-100 to-pink-100">
						{#if l.cover_photo}
							<img src={l.cover_photo} alt="" class="h-full w-full object-cover transition group-hover:scale-[1.02]" loading="lazy" />
						{:else}
							<div class="flex h-full w-full items-center justify-center text-rose-700/40"><ImageIcon class="h-10 w-10" /></div>
						{/if}
						<span class="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize {statusClass(l.status)}">
							{#if l.status === 'published'}<CheckCircle2 class="h-3 w-3" />
							{:else if l.status === 'draft'}<Pencil class="h-3 w-3" />
							{:else if l.status === 'archived'}<Archive class="h-3 w-3" />
							{:else}<Tag class="h-3 w-3" />{/if}
							{l.status}
						</span>
						<div class="absolute right-2 top-2">
							<Dropdown align="right">
								<button slot="trigger" class="flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-gray-700 shadow-sm hover:bg-white" aria-label="Listing actions">
									{#if busyIds.has(l.id)}<Spinner size="xs" />{:else}<MoreHorizontal class="h-4 w-4" />{/if}
								</button>
								<button on:click={() => startEdit(l)} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"><Pencil class="h-4 w-4 text-gray-400" /> Edit</button>
								<button on:click={() => duplicate(l)} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"><Copy class="h-4 w-4 text-gray-400" /> Duplicate</button>
								<div class="my-1 border-t border-gray-100"></div>
								{#if l.status === 'draft'}
									<button on:click={() => setStatus(l, 'publish')} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50"><Send class="h-4 w-4" /> Publish</button>
								{:else if l.status === 'published'}
									<button on:click={() => setStatus(l, 'unpublish')} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50"><EyeOff class="h-4 w-4" /> Unpublish (back to draft)</button>
									<button on:click={() => setStatus(l, 'mark-rented')} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50"><Tag class="h-4 w-4" /> Mark as rented</button>
								{:else if l.status === 'rented'}
									<button on:click={() => setStatus(l, 'unpublish')} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50"><Pencil class="h-4 w-4" /> Move to draft</button>
								{:else if l.status === 'archived'}
									<button on:click={() => setStatus(l, 'unpublish')} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50"><Pencil class="h-4 w-4" /> Restore as draft</button>
								{/if}
								{#if l.status !== 'archived'}
									<button on:click={() => setStatus(l, 'archive')} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"><Archive class="h-4 w-4 text-gray-400" /> Archive</button>
								{/if}
								<div class="my-1 border-t border-gray-100"></div>
								<button on:click={() => (confirmDelete = l)} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 class="h-4 w-4" /> Delete</button>
							</Dropdown>
						</div>
					</div>
					<div class="flex flex-1 flex-col p-4">
						<button on:click={() => startEdit(l)} class="text-left">
							<h3 class="font-semibold text-gray-900 group-hover:text-rose-700">{l.title}</h3>
							{#if l.subtitle}<p class="mt-0.5 line-clamp-1 text-xs text-gray-500">{l.subtitle}</p>{/if}
						</button>
						<div class="mt-2 flex items-center gap-3 text-xs text-gray-500">
							{#if l.building_id}<span class="inline-flex items-center gap-1"><Building2 class="h-3 w-3" /> {buildingNameOf(l.building_id)}</span>{/if}
							<span class="inline-flex items-center gap-1"><Bed class="h-3 w-3" /> {l.room_count ?? 0} room{l.room_count === 1 ? '' : 's'}</span>
							{#if l.available_from}<span class="inline-flex items-center gap-1"><Calendar class="h-3 w-3" /> {l.available_from}</span>{/if}
						</div>
						<div class="mt-3 flex items-end justify-between">
							{#if l.asking_rent != null}
								<div>
									<div class="text-[10px] uppercase tracking-wide text-gray-500">Asking</div>
									<div class="text-lg font-bold text-emerald-700">{fmtMoney(l.asking_rent)}<span class="text-xs font-normal text-gray-500">/mo</span></div>
								</div>
							{:else}
								<span class="text-xs italic text-gray-400">No price set</span>
							{/if}
							<span class="text-[10px] text-gray-400">edited {timeAgo(l.updated_at)}</span>
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>

<!-- Editor (wizard or full edit) -->
{#if editorMode !== 'closed'}
	<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 flex items-stretch justify-end bg-gray-900/50" on:click={closeEditor} role="dialog" aria-modal="true">
		<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl">
			<header class="flex items-center justify-between border-b border-gray-100 px-6 py-3">
				<div class="flex items-center gap-2">
					<div class="flex h-9 w-9 items-center justify-center rounded-md bg-rose-50">
						<Megaphone class="h-5 w-5 text-rose-600" />
					</div>
					<div>
						<h2 class="text-lg font-semibold text-gray-900">{editorMode === 'edit' ? 'Edit listing' : 'New listing'}</h2>
						{#if editorMode === 'wizard'}
							<div class="flex items-center gap-1 text-xs text-gray-500">
								<span class:font-semibold={wizardStep === 1} class:text-rose-700={wizardStep === 1}>1. Pick rooms</span>
								<ChevronRight class="h-3 w-3 text-gray-300" />
								<span class:font-semibold={wizardStep === 2} class:text-rose-700={wizardStep === 2}>2. Details</span>
								<ChevronRight class="h-3 w-3 text-gray-300" />
								<span class:font-semibold={wizardStep === 3} class:text-rose-700={wizardStep === 3}>3. Preview</span>
							</div>
						{/if}
					</div>
				</div>
				<button on:click={closeEditor} class="text-gray-400 hover:text-gray-600"><X class="h-5 w-5" /></button>
			</header>

			<div class="flex-1 overflow-y-auto p-6">
				<!-- Step 1: rooms (wizard only; in edit mode merged with details) -->
				{#if editorMode === 'wizard' && wizardStep === 1}
					<div class="mb-3 text-sm text-gray-600">Choose the rooms this listing covers. A single private bedroom = one room. An entire apartment = all its rooms.</div>
					<div class="rounded-lg border border-gray-200 bg-white">
						{#each inventory as b}
							<details class="group border-b border-gray-100 last:border-b-0" open>
								<summary class="flex cursor-pointer items-center gap-2 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
									<ChevronRight class="h-3.5 w-3.5 text-gray-400 transition group-open:rotate-90" />
									<Building2 class="h-4 w-4 text-rose-500" /> {b.name}
									<span class="ml-auto text-xs text-gray-500">{b.units.reduce((a, u) => a + u.rooms.length, 0)} rooms</span>
								</summary>
								<div class="divide-y divide-gray-100">
									{#each b.units as u}
										<div class="px-3 py-2">
											<div class="text-xs font-medium text-gray-500">Apt {u.name}{u.unit_type ? ' · ' + u.unit_type : ''}</div>
											<div class="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
												{#each u.rooms as r}
													{@const inUse = inUseRooms[r.id]}
													<label class="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition" class:border-rose-500={draftRooms.has(r.id)} class:bg-rose-50={draftRooms.has(r.id)} class:text-rose-700={draftRooms.has(r.id)} class:border-gray-200={!draftRooms.has(r.id)} class:hover:bg-gray-50={!draftRooms.has(r.id)}>
														<input type="checkbox" checked={draftRooms.has(r.id)} on:change={() => toggleRoom(r.id)} class="h-3.5 w-3.5 rounded border-gray-300 text-rose-600" />
														<span class="font-medium">{r.name}</span>
														{#if r.length}<span class="text-[10px] text-gray-500">· {r.length}</span>{/if}
														{#if r.bed_size}<span class="text-[10px] text-gray-500">· {r.bed_size}</span>{/if}
														{#if r.financials?.actual_rent}<span class="ml-auto text-emerald-700">{fmtMoney(r.financials.actual_rent)}</span>{/if}
														{#if inUse && inUse.length > 0}
															<span class="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-800" title="Already in: {inUse.map((x) => x.listing_title).join(', ')}">in use</span>
														{/if}
													</label>
												{/each}
											</div>
										</div>
									{/each}
								</div>
							</details>
						{/each}
					</div>
					<div class="mt-3 text-xs text-gray-500"><strong class="text-gray-900">{draftRooms.size}</strong> room{draftRooms.size === 1 ? '' : 's'} selected</div>
				{/if}

				<!-- Step 2: details (and the same shape used in edit mode) -->
				{#if editorMode === 'edit' || wizardStep === 2}
					<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
						<!-- Marketing -->
						<div class="space-y-3 lg:col-span-2">
							<section class="rounded-lg border border-gray-200 bg-white p-4">
								<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800"><Sparkles class="h-4 w-4 text-rose-500" /> Marketing</h3>
								<label class="block text-sm">
									<span class="mb-1 block text-xs font-medium text-gray-600">Title *</span>
									<input bind:value={draft.title} placeholder="Modern Studio in East Little Havana" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
								</label>
								<label class="mt-3 block text-sm">
									<span class="mb-1 block text-xs font-medium text-gray-600">Subtitle</span>
									<input bind:value={draft.subtitle} placeholder="Furnished · all-inclusive · steps from Brickell" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
								</label>
								<label class="mt-3 block text-sm">
									<span class="mb-1 block text-xs font-medium text-gray-600">Description</span>
									<textarea bind:value={draft.description} rows="5" placeholder="Long-form marketing copy: what's special, who it's for, what's included…" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"></textarea>
								</label>
								<label class="mt-3 block text-sm">
									<span class="mb-1 block text-xs font-medium text-gray-600">SEO meta description</span>
									<input bind:value={draft.meta_description} placeholder="One-liner for search results (~155 chars)" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
								</label>
							</section>

							<section class="rounded-lg border border-gray-200 bg-white p-4">
								<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800"><ImageIcon class="h-4 w-4 text-rose-500" /> Photos</h3>
								<label class="block text-sm">
									<span class="mb-1 block text-xs font-medium text-gray-600">Cover photo URL</span>
									<input bind:value={draft.cover_photo} placeholder="https://…" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
								</label>
								<label class="mt-3 block text-sm">
									<span class="mb-1 block text-xs font-medium text-gray-600">Gallery (one URL per line, or comma-separated)</span>
									<textarea bind:value={photosCsv} rows="3" placeholder="https://…&#10;https://…" class="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"></textarea>
								</label>
								{#if (draft.cover_photo || photosCsv) && (draft.cover_photo || photosCsv.trim())}
									<div class="mt-3 grid grid-cols-3 gap-2">
										{#if draft.cover_photo}
											<div class="aspect-[4/3] overflow-hidden rounded-md ring-2 ring-rose-300">
												<img src={draft.cover_photo} alt="cover" class="h-full w-full object-cover" />
											</div>
										{/if}
										{#each photosCsv.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 5) as p}
											<div class="aspect-[4/3] overflow-hidden rounded-md ring-1 ring-gray-200">
												<img src={p} alt="" class="h-full w-full object-cover" />
											</div>
										{/each}
									</div>
								{/if}
							</section>

							<section class="rounded-lg border border-gray-200 bg-white p-4">
								<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800"><Tag class="h-4 w-4 text-rose-500" /> Highlights & Tags</h3>
								<label class="block text-sm">
									<span class="mb-1 block text-xs font-medium text-gray-600">Highlights (comma-separated)</span>
									<input bind:value={highlightsCsv} placeholder="Walk to Brickell, In-unit washer, Roof deck" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
								</label>
								<label class="mt-3 block text-sm">
									<span class="mb-1 block text-xs font-medium text-gray-600">Tags (search filters)</span>
									<input bind:value={tagsCsv} placeholder="brickell, downtown, coliving, pet-friendly" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
								</label>
							</section>
						</div>

						<!-- Right column: pricing + terms -->
						<div class="space-y-3">
							<section class="rounded-lg border border-emerald-100 bg-emerald-50/40 p-4">
								<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-900"><DollarSign class="h-4 w-4" /> Pricing</h3>
								{#if askingRentSuggestion > 0 && !draft.asking_rent}
									<button on:click={() => (draft.asking_rent = askingRentSuggestion)} class="mb-2 inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50">
										<Sparkles class="h-3.5 w-3.5" /> Use {fmtMoney(askingRentSuggestion)} from inventory
									</button>
								{/if}
								<label class="block text-sm">
									<span class="mb-1 block text-xs font-medium text-gray-600">Asking rent / month</span>
									<input type="number" min="0" step="1" bind:value={draft.asking_rent} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
								</label>
								<label class="mt-2 block text-sm">
									<span class="mb-1 block text-xs font-medium text-gray-600">Deposit</span>
									<input type="number" min="0" step="1" bind:value={draft.deposit} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
								</label>
								<label class="mt-2 block text-sm">
									<span class="mb-1 block text-xs font-medium text-gray-600">Application fee</span>
									<input type="number" min="0" step="1" bind:value={draft.application_fee} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
								</label>
							</section>

							<section class="rounded-lg border border-gray-200 bg-white p-4">
								<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800"><Calendar class="h-4 w-4 text-rose-500" /> Availability & terms</h3>
								<div class="grid grid-cols-2 gap-2">
									<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Available from</span><input type="date" bind:value={draft.available_from} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
									<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Available until</span><input type="date" bind:value={draft.available_until} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
									<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Min lease (months)</span><input type="number" min="1" bind:value={draft.min_lease_months} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
									<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Max lease (months)</span><input type="number" min="1" bind:value={draft.max_lease_months} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
								</div>
								<div class="mt-3 grid grid-cols-2 gap-2 text-sm">
									<label class="inline-flex items-center gap-2"><input type="checkbox" bind:checked={draft.is_furnished} class="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500" /><span>Furnished</span></label>
									<label class="inline-flex items-center gap-2"><input type="checkbox" bind:checked={draft.utilities_included} class="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500" /><span>Utilities included</span></label>
									<label class="inline-flex items-center gap-2"><input type="checkbox" bind:checked={draft.pets_allowed} class="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500" /><span>Pets allowed</span></label>
									<label class="inline-flex items-center gap-2"><input type="checkbox" bind:checked={draft.smoking_allowed} class="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500" /><span>Smoking allowed</span></label>
								</div>
								<label class="mt-3 block text-sm">
									<span class="mb-1 block text-xs font-medium text-gray-600">Utilities note</span>
									<input bind:value={draft.utilities_note} placeholder="Internet + electricity included; gas separate" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
								</label>
							</section>

							<section class="rounded-lg border border-gray-200 bg-white p-4">
								<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800"><Mail class="h-4 w-4 text-rose-500" /> Inquiries</h3>
								<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Contact email</span><input type="email" bind:value={draft.inquiry_email} placeholder="leads@propolis.com" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
								<label class="mt-2 block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Contact phone</span><input type="tel" bind:value={draft.inquiry_phone} placeholder="+1 305 555 0100" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
							</section>

							{#if editorMode === 'edit'}
								<section class="rounded-lg border border-gray-200 bg-white p-4">
									<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800"><Bed class="h-4 w-4 text-rose-500" /> Rooms in this listing ({draftRooms.size})</h3>
									<details class="text-sm" open={draftRooms.size === 0}>
										<summary class="cursor-pointer text-rose-700 hover:text-rose-800">Edit room selection</summary>
										<div class="mt-2 max-h-72 overflow-y-auto rounded border border-gray-200">
											{#each inventory as b}
												<div class="border-b border-gray-100 last:border-b-0">
													<div class="bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700">{b.name}</div>
													{#each b.units as u}
														<div class="px-2 py-1">
															<div class="text-[10px] text-gray-500">Apt {u.name}</div>
															<div class="mt-0.5 flex flex-wrap gap-1">
																{#each u.rooms as r}
																	<button type="button" on:click={() => toggleRoom(r.id)} class="rounded-md border px-1.5 py-0.5 text-[11px]" class:border-rose-500={draftRooms.has(r.id)} class:bg-rose-50={draftRooms.has(r.id)} class:text-rose-700={draftRooms.has(r.id)} class:border-gray-200={!draftRooms.has(r.id)} class:text-gray-600={!draftRooms.has(r.id)}>{r.name}</button>
																{/each}
															</div>
														</div>
													{/each}
												</div>
											{/each}
										</div>
									</details>
								</section>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Step 3: Preview -->
				{#if editorMode === 'wizard' && wizardStep === 3}
					{@const photos = (draft.cover_photo ? [draft.cover_photo] : []).concat(photosCsv.split(/[,\n]/).map((s) => s.trim()).filter(Boolean))}
					{@const highlights = highlightsCsv.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)}
					<div class="mx-auto max-w-3xl">
						<div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
							{#if photos[0]}
								<div class="aspect-[16/9] w-full overflow-hidden bg-gray-100">
									<img src={photos[0]} alt="" class="h-full w-full object-cover" />
								</div>
							{:else}
								<div class="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-rose-100 to-pink-100 text-rose-600/40"><ImageIcon class="h-12 w-12" /></div>
							{/if}
							<div class="p-6">
								<h2 class="text-2xl font-bold text-gray-900">{draft.title}</h2>
								{#if draft.subtitle}<p class="mt-1 text-base text-gray-600">{draft.subtitle}</p>{/if}
								<div class="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-700">
									{#if draft.asking_rent != null}
										<span class="text-2xl font-bold text-emerald-700">{fmtMoney(draft.asking_rent)}<span class="text-sm font-normal text-gray-500">/mo</span></span>
									{/if}
									<span>· {draftRooms.size} room{draftRooms.size === 1 ? '' : 's'}</span>
									{#if draft.available_from}<span>· Available {draft.available_from}</span>{/if}
									{#if draft.is_furnished}<span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Furnished</span>{/if}
									{#if draft.utilities_included}<span class="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">Utilities included</span>{/if}
								</div>
								{#if highlights.length > 0}
									<div class="mt-4 flex flex-wrap gap-2">
										{#each highlights as h}
											<span class="rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-700">{h}</span>
										{/each}
									</div>
								{/if}
								{#if draft.description}
									<p class="mt-4 whitespace-pre-line text-sm text-gray-700">{draft.description}</p>
								{/if}

								<div class="mt-6 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-4">
									<div><div class="text-[10px] uppercase tracking-wide text-gray-500">Deposit</div><div class="font-medium">{draft.deposit != null ? fmtMoney(draft.deposit) : '—'}</div></div>
									<div><div class="text-[10px] uppercase tracking-wide text-gray-500">App fee</div><div class="font-medium">{draft.application_fee != null ? fmtMoney(draft.application_fee) : '—'}</div></div>
									<div><div class="text-[10px] uppercase tracking-wide text-gray-500">Min lease</div><div class="font-medium">{draft.min_lease_months ? draft.min_lease_months + ' mo' : '—'}</div></div>
									<div><div class="text-[10px] uppercase tracking-wide text-gray-500">Pets</div><div class="font-medium">{draft.pets_allowed ? 'Yes' : 'No'}</div></div>
								</div>

								{#if draft.inquiry_email || draft.inquiry_phone}
									<div class="mt-4 flex flex-wrap gap-2 text-xs text-gray-600">
										{#if draft.inquiry_email}<span class="inline-flex items-center gap-1"><Mail class="h-3 w-3" /> {draft.inquiry_email}</span>{/if}
										{#if draft.inquiry_phone}<span class="inline-flex items-center gap-1"><Phone class="h-3 w-3" /> {draft.inquiry_phone}</span>{/if}
									</div>
								{/if}

								{#if photos.length > 1}
									<div class="mt-4 grid grid-cols-3 gap-2">
										{#each photos.slice(1, 7) as p}
											<div class="aspect-[4/3] overflow-hidden rounded-md"><img src={p} alt="" class="h-full w-full object-cover" /></div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
						<p class="mt-3 text-center text-xs text-gray-500">This is roughly how the listing will look on the public site. Save as draft to keep tweaking, or publish now.</p>
					</div>
				{/if}
			</div>

			<footer class="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-3">
				<div>
					{#if editorMode === 'wizard' && wizardStep > 1}
						<button on:click={() => (wizardStep = (wizardStep - 1) as 1 | 2)} class="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"><ArrowLeft class="h-4 w-4" /> Back</button>
					{/if}
				</div>
				<div class="flex items-center gap-2">
					<button on:click={closeEditor} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
					{#if editorMode === 'wizard' && wizardStep < 3}
						<button on:click={nextWizardStep} class="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">Next <ArrowRight class="h-4 w-4" /></button>
					{:else}
						<button on:click={() => saveListing({ publish: false })} disabled={saving} class="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
							{#if saving}<Spinner size="sm" /> Saving…{:else}<Save class="h-4 w-4" /> Save draft{/if}
						</button>
						<button on:click={() => saveListing({ publish: true })} disabled={saving} class="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
							{#if saving}<Spinner size="sm" color="white" /> Publishing…{:else}<Send class="h-4 w-4" /> Publish{/if}
						</button>
					{/if}
				</div>
			</footer>
		</div>
	</div>
{/if}

<!-- Delete confirm -->
{#if confirmDelete}
	<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" on:click={() => (confirmDelete = null)} role="dialog" aria-modal="true">
		<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
			<div class="px-5 py-5">
				<h3 class="text-base font-semibold text-gray-900">Delete listing?</h3>
				<p class="mt-1 text-sm text-gray-600"><span class="font-medium">{confirmDelete.title}</span> will be removed permanently.</p>
			</div>
			<div class="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (confirmDelete = null)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button on:click={doDelete} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Trash2 class="h-4 w-4" /> Delete</button>
			</div>
		</div>
	</div>
{/if}
