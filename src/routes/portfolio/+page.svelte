<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { fade, scale } from 'svelte/transition';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { auth, userRole } from '$lib/api/auth';
	import { toast } from '$lib/components/ui/toastStore';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import Dropdown from '$lib/components/ui/Dropdown.svelte';
	import {
		LayoutGrid,
		Building2,
		Layers,
		Bed,
		Bath,
		ChevronDown,
		ChevronRight,
		Plus,
		Pencil,
		Trash2,
		MoreHorizontal,
		Save,
		X,
		RefreshCw,
		Search,
		ListFilter,
		ArrowUpDown,
		DollarSign,
		TrendingUp,
		Calendar,
		Eye,
		Accessibility,
		Image as ImageIcon,
		Columns,
		ChevronsUpDown
	} from 'lucide-svelte';

	type Length = 'LTR' | 'STR';
	type Strategy = 'Coliving' | 'Entire Apt';
	type Mode = 'owner' | 'investor' | 'operator';

	type Amenity = { id: string; name: string; category: string | null };
	type Financials = {
		actual_rent: number | null;
		base_rent: number | null;
		market_rent: number | null;
		actual_rent_with_util: number | null;
		pessimistic_rent: number | null;
		concession_rent: number | null;
		concession_rent_with_util: number | null;
		adjustment: number | null;
		stake_5_cashback: number | null;
		stake_8_cashback: number | null;
		revenue_month: number | null;
		revenue_year: number | null;
		revenue_per_apartment: number | null;
		extras: string | null;
	};
	type Room = {
		id: string;
		unit_id: string;
		name: string;
		length: Length | null;
		strategy: Strategy | null;
		beds: number | null;
		baths: number | null;
		bed_size: string | null;
		bathroom: string | null;
		ceiling_height: string | null;
		balcony: string | null;
		room_type_name: string | null;
		sqft: number | null;
		is_ada: boolean | null;
		listing_date: string | null;
		amenity_ids: string[];
		notes: string | null;
		financials: Financials | null;
	};
	type Unit = {
		id: string;
		building_id: string;
		name: string;
		unit_type: string | null;
		amenity_ids: string[];
		notes: string | null;
		rooms: Room[];
	};
	type Building = {
		id: string;
		name: string;
		full_name: string | null;
		address: string | null;
		owner_llc: string | null;
		floors: number | null;
		has_elevator: boolean | null;
		units_count: number | null;
		beds_count: number | null;
		description: string | null;
		photos: string[];
		amenity_ids: string[];
		notes: string | null;
		units: Unit[];
	};
	type MonthlyPerf = {
		id: string;
		building_id: string;
		period_year: number;
		period_month: number;
		occupancy_pct: number | null;
		adr: number | null;
		revpar: number | null;
		revenue: number | null;
		notes: string | null;
	};

	let buildings: Building[] = [];
	let amenities: Amenity[] = [];
	let amenitiesById = new Map<string, Amenity>();
	let loading = true;
	let loadError: string | null = null;
	let busyIds = new Set<string>();

	// Modes
	$: isOwner = $userRole === 'owner' || $userRole === 'operator';
	// Operators default to the editor view; investors default to card view
	$: defaultMode = ($userRole === 'operator' ? 'owner' : ($userRole as Mode)) || 'investor';
	let mode: Mode = 'investor';
	$: if (defaultMode && !modeChosenManually) mode = defaultMode;
	let modeChosenManually = false;
	$: isOwnerView = isOwner && mode === 'owner';

	// Tree expansion
	let expandedBuildings = new Set<string>();
	let expandedUnits = new Set<string>();
	let financialsBuildingId: string | null = null;
	let detailsRoomId: string | null = null;
	let monthlyByBuilding: Record<string, MonthlyPerf[]> = {};
	let loadingPerf = false;

	// Filters
	let search = '';
	let lengthFilter = new Set<string>();
	let strategyFilter: 'all' | 'Coliving' | 'Entire Apt' | 'unset' = 'all';
	let bathroomFilter: 'all' | 'Private' | 'Shared' = 'all';
	let bedsFilter = new Set<number>();
	let bathsFilter = new Set<number>();
	let bedSizeFilter = new Set<string>();
	let roomTypeFilter = new Set<string>();
	let unitTypeFilter = new Set<string>();
	let amenityFilter = new Set<string>();
	let buildingFilter = new Set<string>();
	let adaOnly = false;
	let withRentOnly = false;
	let rentMin: number | null = null;
	let rentMax: number | null = null;
	let sortKey: 'name' | 'rent_desc' | 'rent_asc' | 'revenue_desc' = 'name';
	let showFilters = false;

	// Building-level filters
	let elevatorOnly = false;
	let ownerLLCFilter = new Set<string>();

	// Compare mode
	let compareMode = false;
	let compareHideNeither = true;

	// Set B filter state (mirrors Set A)
	let search_b = '';
	let lengthFilter_b = new Set<string>();
	let strategyFilter_b: 'all' | 'Coliving' | 'Entire Apt' | 'unset' = 'all';
	let bathroomFilter_b: 'all' | 'Private' | 'Shared' = 'all';
	let bedsFilter_b = new Set<number>();
	let bathsFilter_b = new Set<number>();
	let bedSizeFilter_b = new Set<string>();
	let roomTypeFilter_b = new Set<string>();
	let unitTypeFilter_b = new Set<string>();
	let amenityFilter_b = new Set<string>();
	let buildingFilter_b = new Set<string>();
	let adaOnly_b = false;
	let withRentOnly_b = false;
	let rentMin_b: number | null = null;
	let rentMax_b: number | null = null;

	// Investor drawer
	let drawerBuilding: Building | null = null;

	// Modals
	let showAddBuilding = false;
	let buildingDraft: Partial<Building> = {};
	let buildingPhotosCsv = '';
	let buildingAmenitySet = new Set<string>();
	let buildingSaving = false;
	let confirmDeleteBuilding: Building | null = null;
	let deletingBuilding = false;

	let showUnitModal: { kind: 'add'; building: Building } | { kind: 'edit'; building: Building; unit: Unit } | null = null;
	let unitDraft: Partial<Unit> = {};
	let unitAmenitySet = new Set<string>();
	let unitSaving = false;
	let confirmDeleteUnit: { building: Building; unit: Unit } | null = null;
	let deletingUnit = false;

	let showRoomModal:
		| { kind: 'add'; building: Building; unit: Unit }
		| { kind: 'edit'; building: Building; unit: Unit; room: Room }
		| null = null;
	let roomDraft: any = {};
	let roomDraftAmenities = new Set<string>();
	let customAmenityDraft = '';
	let roomSaving = false;
	let confirmDeleteRoom: { building: Building; unit: Unit; room: Room } | null = null;
	let deletingRoom = false;

	let perfDraft: Partial<MonthlyPerf> & { building_id?: string } = {};
	let showPerfModal = false;
	let perfSaving = false;
	let confirmDeletePerf: MonthlyPerf | null = null;

	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	// Reactive Set toggles (Svelte 5 doesn't pick up mutations on Set, so reassign)
	function toggleBuilding(id: string) {
		if (expandedBuildings.has(id)) expandedBuildings.delete(id);
		else expandedBuildings.add(id);
		expandedBuildings = expandedBuildings;
	}
	function toggleUnit(id: string) {
		if (expandedUnits.has(id)) expandedUnits.delete(id);
		else expandedUnits.add(id);
		expandedUnits = expandedUnits;
	}
	function expandAll() {
		expandedBuildings = new Set(buildings.map((b) => b.id));
		expandedUnits = new Set(buildings.flatMap((b) => b.units.map((u) => u.id)));
	}
	function collapseAll() {
		expandedBuildings = new Set();
		expandedUnits = new Set();
	}

	// ── Helpers ───────────────────────────────────────────────────
	function authHeader() {
		return { Authorization: `Bearer ${get(auth).token}` };
	}
	function fmtMoney(v: number | null | undefined, opts: { compact?: boolean } = {}) {
		if (v == null || isNaN(Number(v))) return '—';
		const n = Number(v);
		if (opts.compact) {
			if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(Math.abs(n) >= 10_000_000 ? 1 : 2)}M`;
			if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(Math.abs(n) >= 10_000 ? 0 : 1)}k`;
		}
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
	}
	function fmtPct(v: number | null | undefined) {
		if (v == null) return '—';
		return `${Number(v).toFixed(1)}%`;
	}
	function rentOf(r: Room): number {
		const f = r.financials;
		if (!f) return 0;
		return Number(f.actual_rent ?? f.base_rent ?? 0) || 0;
	}
	function unitRent(u: Unit): number {
		return u.rooms.reduce((a, r) => a + rentOf(r), 0);
	}
	function buildingRent(b: Building): number {
		return b.units.reduce((a, u) => a + unitRent(u), 0);
	}
	function buildingAnnualRevenue(b: Building): number {
		return b.units.reduce(
			(a, u) => a + u.rooms.reduce((aa, r) => aa + Number(r.financials?.revenue_year || 0), 0),
			0
		);
	}
	function nameOfAmenity(id: string): string {
		return amenitiesById.get(id)?.name ?? '';
	}
	function toggleSet<T>(s: Set<T>, v: T): Set<T> {
		s.has(v) ? s.delete(v) : s.add(v);
		return s;
	}

	// ── Filters ───────────────────────────────────────────────────
	// Reactive function so Svelte re-creates it (and re-runs dependents) whenever any Set A filter changes
	$: roomMatches = (r: Room): boolean => {
		if (lengthFilter.size > 0) {
			const key = r.length ?? 'unset';
			if (!lengthFilter.has(key)) return false;
		}
		if (roomTypeFilter.size > 0 && !roomTypeFilter.has(r.room_type_name ?? 'unset')) return false;
		if (strategyFilter !== 'all') {
			if (strategyFilter === 'unset') {
				if (r.strategy) return false;
			} else if (r.strategy !== strategyFilter) return false;
		}
		if (bathroomFilter !== 'all' && r.bathroom !== bathroomFilter) return false;
		if (bedsFilter.size > 0 && (r.beds == null || !bedsFilter.has(r.beds))) return false;
		if (bathsFilter.size > 0 && (r.baths == null || !bathsFilter.has(r.baths))) return false;
		if (bedSizeFilter.size > 0 && (!r.bed_size || !bedSizeFilter.has(r.bed_size))) return false;
		if (amenityFilter.size > 0) {
			for (const aid of amenityFilter) if (!r.amenity_ids.includes(aid)) return false;
		}
		if (adaOnly && !r.is_ada) return false;
		const rent = rentOf(r);
		if (withRentOnly && rent <= 0) return false;
		const minN = rentMin == null || (rentMin as any) === '' ? null : Number(rentMin);
		const maxN = rentMax == null || (rentMax as any) === '' ? null : Number(rentMax);
		if (minN != null && !isNaN(minN) && rent < minN) return false;
		if (maxN != null && !isNaN(maxN) && rent > maxN) return false;
		if (search.trim()) {
			const q = search.trim().toLowerCase();
			const blob = [
				r.name, r.room_type_name, r.financials?.extras, r.bed_size, r.bathroom, r.balcony,
				...(r.amenity_ids || []).map(nameOfAmenity)
			].filter(Boolean).join(' ').toLowerCase();
			if (!blob.includes(q)) return false;
		}
		return true;
	};
	function buildingMatchesByName(b: Building): boolean {
		if (!search.trim()) return true;
		const q = search.trim().toLowerCase();
		return (
			b.name.toLowerCase().includes(q) ||
			(b.full_name || '').toLowerCase().includes(q) ||
			(b.address || '').toLowerCase().includes(q)
		);
	}
	$: bedsOptions = Array.from(
		new Set(buildings.flatMap((b) => b.units.flatMap((u) => u.rooms.map((r) => r.beds).filter((v): v is number => v != null))))
	).sort((a, b) => a - b);
	$: bathsOptions = Array.from(
		new Set(buildings.flatMap((b) => b.units.flatMap((u) => u.rooms.map((r) => r.baths).filter((v): v is number => v != null))))
	).sort((a, b) => a - b);
	$: bedSizeOptions = Array.from(
		new Set(
			buildings.flatMap((b) => b.units.flatMap((u) => u.rooms.map((r) => r.bed_size).filter(Boolean)))
		)
	).sort() as string[];
	$: roomTypeOptions = Array.from(
		new Set(
			buildings.flatMap((b) =>
				b.units.flatMap((u) => u.rooms.map((r) => r.room_type_name).filter(Boolean))
			)
		)
	).sort() as string[];
	$: unitTypeOptions = Array.from(
		new Set(buildings.flatMap((b) => b.units.map((u) => u.unit_type).filter(Boolean)))
	).sort() as string[];
	$: ownerLLCOptions = Array.from(new Set(buildings.map((b) => b.owner_llc).filter(Boolean))).sort() as string[];

	// Set B room matcher — reactive so it rebuilds whenever a B filter changes
	$: roomMatchesB = (r: Room): boolean => {
		if (lengthFilter_b.size > 0) { const key = r.length ?? 'unset'; if (!lengthFilter_b.has(key)) return false; }
		if (roomTypeFilter_b.size > 0 && !roomTypeFilter_b.has(r.room_type_name ?? 'unset')) return false;
		if (strategyFilter_b !== 'all') {
			if (strategyFilter_b === 'unset') { if (r.strategy) return false; }
			else if (r.strategy !== (strategyFilter_b as string)) return false;
		}
		if (bathroomFilter_b !== 'all' && r.bathroom !== bathroomFilter_b) return false;
		if (bedsFilter_b.size > 0 && (r.beds == null || !bedsFilter_b.has(r.beds))) return false;
		if (bathsFilter_b.size > 0 && (r.baths == null || !bathsFilter_b.has(r.baths))) return false;
		if (bedSizeFilter_b.size > 0 && (!r.bed_size || !bedSizeFilter_b.has(r.bed_size))) return false;
		if (amenityFilter_b.size > 0) { for (const aid of amenityFilter_b) if (!r.amenity_ids.includes(aid)) return false; }
		if (adaOnly_b && !r.is_ada) return false;
		const rent = rentOf(r);
		if (withRentOnly_b && rent <= 0) return false;
		const minN = rentMin_b == null || (rentMin_b as any) === '' ? null : Number(rentMin_b);
		const maxN = rentMax_b == null || (rentMax_b as any) === '' ? null : Number(rentMax_b);
		if (minN != null && !isNaN(minN) && rent < minN) return false;
		if (maxN != null && !isNaN(maxN) && rent > maxN) return false;
		if (search_b.trim()) {
			const q = search_b.trim().toLowerCase();
			const blob = [r.name, r.room_type_name, r.financials?.extras, r.bed_size, r.bathroom, r.balcony,
				...(r.amenity_ids || []).map(nameOfAmenity)].filter(Boolean).join(' ').toLowerCase();
			if (!blob.includes(q)) return false;
		}
		return true;
	};
	$: hasAnyFilterB =
		!!search_b.trim() || lengthFilter_b.size > 0 || strategyFilter_b !== 'all' || bathroomFilter_b !== 'all' ||
		bedsFilter_b.size > 0 || bathsFilter_b.size > 0 || bedSizeFilter_b.size > 0 || roomTypeFilter_b.size > 0 || unitTypeFilter_b.size > 0 ||
		amenityFilter_b.size > 0 || buildingFilter_b.size > 0 ||
		adaOnly_b || withRentOnly_b || rentMin_b != null || rentMax_b != null;

	$: hasAnyFilter =
		!!search.trim() ||
		lengthFilter.size > 0 ||
		strategyFilter !== 'all' ||
		bathroomFilter !== 'all' ||
		bedsFilter.size > 0 ||
		bathsFilter.size > 0 ||
		bedSizeFilter.size > 0 ||
		roomTypeFilter.size > 0 ||
		unitTypeFilter.size > 0 ||
		amenityFilter.size > 0 ||
		buildingFilter.size > 0 ||
		adaOnly ||
		withRentOnly ||
		rentMin != null ||
		rentMax != null ||
		elevatorOnly ||
		ownerLLCFilter.size > 0;
	$: filteredBuildings = buildings
		.filter((b) =>
			(buildingFilter.size === 0 || buildingFilter.has(b.id)) &&
			(!elevatorOnly || b.has_elevator) &&
			(ownerLLCFilter.size === 0 || ownerLLCFilter.has(b.owner_llc ?? ''))
		)
		.map((b) => ({
			...b,
			units: b.units
				.map((u) => {
					const unitMatchesA = unitTypeFilter.size === 0 || unitTypeFilter.has(u.unit_type ?? 'unset');
					const unitMatchesB = unitTypeFilter_b.size === 0 || unitTypeFilter_b.has(u.unit_type ?? 'unset');
					return {
						...u,
						rooms: [...u.rooms]
							.filter((r) => {
								const mA = unitMatchesA && roomMatches(r);
								const mB = unitMatchesB && roomMatchesB(r);
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
				.filter((u) => buildingMatchesByName(b) || u.rooms.length > 0)
		}))
		.filter((b) => {
			if (hasAnyFilter || compareMode) {
				if (b.units.some((u) => u.rooms.length > 0)) return true;
				return buildingMatchesByName(b);
			}
			return true;
		});
	$: totals = {
		buildings: filteredBuildings.length,
		units: filteredBuildings.reduce((a, b) => a + b.units.length, 0),
		rooms: filteredBuildings.reduce((a, b) => a + b.units.reduce((aa, u) => aa + u.rooms.length, 0), 0),
		ltr: filteredBuildings.reduce(
			(a, b) => a + b.units.reduce((aa, u) => aa + u.rooms.filter((r) => r.length === 'LTR').length, 0),
			0
		),
		str: filteredBuildings.reduce(
			(a, b) => a + b.units.reduce((aa, u) => aa + u.rooms.filter((r) => r.length === 'STR').length, 0),
			0
		),
		monthlyRent: filteredBuildings.reduce(
			(a, b) => a + b.units.reduce((aa, u) => aa + u.rooms.reduce((aaa, r) => aaa + rentOf(r), 0), 0),
			0
		),
		annualRevenue: filteredBuildings.reduce(
			(a, b) =>
				a + b.units.reduce((aa, u) => aa + u.rooms.reduce((aaa, r) => aaa + Number(r.financials?.revenue_year || 0), 0), 0),
			0
		)
	};
	$: totalRoomsAll = buildings.reduce((a, b) => a + b.units.reduce((aa, u) => aa + u.rooms.length, 0), 0);

	$: roomCompareTag = compareMode
		? new Map<string, 'A' | 'B' | 'AB'>(
			buildings.flatMap((b) =>
				b.units.flatMap((u) => {
					const utA = unitTypeFilter.size === 0 || unitTypeFilter.has(u.unit_type ?? 'unset');
					const utB = unitTypeFilter_b.size === 0 || unitTypeFilter_b.has(u.unit_type ?? 'unset');
					return u.rooms
						.filter((r) => (utA && roomMatches(r)) || (utB && roomMatchesB(r)))
						.map((r) => {
							const a = utA && roomMatches(r), bm = utB && roomMatchesB(r);
							return [r.id, a && bm ? 'AB' : a ? 'A' : 'B'] as [string, 'A' | 'B' | 'AB'];
						});
				})
			)
		)
		: new Map<string, 'A' | 'B' | 'AB'>();

	$: compareStats = (() => {
		if (!compareMode) return null;
		const roomsA = buildings.flatMap((b) => b.units.flatMap((u) => {
			const utOK = unitTypeFilter.size === 0 || unitTypeFilter.has(u.unit_type ?? 'unset');
			return utOK ? u.rooms.filter(roomMatches) : [];
		}));
		const roomsB = buildings.flatMap((b) => b.units.flatMap((u) => {
			const utOK = unitTypeFilter_b.size === 0 || unitTypeFilter_b.has(u.unit_type ?? 'unset');
			return utOK ? u.rooms.filter(roomMatchesB) : [];
		}));
		const stat = (rooms: Room[]) => ({
			rooms: rooms.length,
			ltr: rooms.filter((r) => r.length === 'LTR').length,
			str: rooms.filter((r) => r.length === 'STR').length,
			monthlyRent: rooms.reduce((s, r) => s + rentOf(r), 0),
			annualRevenue: rooms.reduce((s, r) => s + Number(r.financials?.revenue_year || 0), 0),
			avgRent: rooms.length ? rooms.reduce((s, r) => s + rentOf(r), 0) / (rooms.filter(r => rentOf(r) > 0).length || 1) : 0
		});
		return { a: stat(roomsA), b: stat(roomsB) };
	})();

	function clearFilters() {
		search = ''; lengthFilter = new Set(); strategyFilter = 'all'; bathroomFilter = 'all';
		bedsFilter = new Set(); bathsFilter = new Set();
		bedSizeFilter = new Set(); roomTypeFilter = new Set(); unitTypeFilter = new Set();
		amenityFilter = new Set(); buildingFilter = new Set();
		adaOnly = false; withRentOnly = false;
		rentMin = null; rentMax = null; sortKey = 'name';
		elevatorOnly = false; ownerLLCFilter = new Set();
	}
	function clearFiltersB() {
		search_b = ''; lengthFilter_b = new Set(); strategyFilter_b = 'all'; bathroomFilter_b = 'all';
		bedsFilter_b = new Set(); bathsFilter_b = new Set();
		bedSizeFilter_b = new Set(); roomTypeFilter_b = new Set(); unitTypeFilter_b = new Set();
		amenityFilter_b = new Set(); buildingFilter_b = new Set();
		adaOnly_b = false; withRentOnly_b = false;
		rentMin_b = null; rentMax_b = null;
	}

	// ── Data load ─────────────────────────────────────────────────
	async function load(silent = false) {
		if (!silent) loading = true;
		loadError = null;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/portfolio`, { headers: authHeader() });
			if (!res.ok) {
				if (res.status >= 500) {
					loadError = 'The New Properties Page tables aren\'t set up yet. Run `Backend/migrations/008_portfolio_schema.sql` in Supabase, then run `python3 Backend/scripts/seed_portfolio_from_inventory.py`.';
				} else {
					loadError = `Load failed (${res.status})`;
				}
				return;
			}
			const d = await res.json();
			buildings = d.buildings || [];
			amenities = d.amenities || [];
			amenitiesById = new Map(amenities.map((a) => [a.id, a]));
			// Buildings and units start collapsed — owner expands what they need.
		} catch (e: any) {
			loadError = e.message;
		} finally {
			loading = false;
		}
	}
	onMount(load);

	// ── Mutations ─────────────────────────────────────────────────
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

	// Building
	function openAddBuilding() {
		buildingDraft = { name: '', full_name: '', address: '', owner_llc: '', floors: undefined, has_elevator: false, description: '' };
		buildingPhotosCsv = '';
		buildingAmenitySet = new Set();
		showAddBuilding = true;
	}
	function openEditBuilding(b: Building) {
		buildingDraft = { ...b };
		buildingPhotosCsv = (b.photos || []).join(', ');
		buildingAmenitySet = new Set(b.amenity_ids || []);
		showAddBuilding = true;
	}
	async function saveBuilding() {
		if (!buildingDraft.name?.trim()) {
			toast.error('Building name is required');
			return;
		}
		buildingSaving = true;
		const photos = buildingPhotosCsv
			.split(/[,\n]/)
			.map((s) => s.trim())
			.filter(Boolean);
		const body: any = {
			name: buildingDraft.name.trim(),
			full_name: buildingDraft.full_name || null,
			address: buildingDraft.address || null,
			owner_llc: buildingDraft.owner_llc || null,
			floors: buildingDraft.floors ?? null,
			has_elevator: buildingDraft.has_elevator ?? null,
			description: buildingDraft.description || null,
			photos,
			amenity_ids: Array.from(buildingAmenitySet),
			notes: buildingDraft.notes || null
		};
		try {
			if (buildingDraft.id) {
				await callJSON(`${PUBLIC_API_URL}/api/portfolio/buildings/${buildingDraft.id}`, 'PATCH', body);
				toast.success(`${body.name} updated`);
			} else {
				await callJSON(`${PUBLIC_API_URL}/api/portfolio/buildings`, 'POST', body);
				toast.success(`${body.name} added`);
			}
			showAddBuilding = false;
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			buildingSaving = false;
		}
	}
	async function doDeleteBuilding() {
		if (!confirmDeleteBuilding) return;
		deletingBuilding = true;
		try {
			await callJSON(`${PUBLIC_API_URL}/api/portfolio/buildings/${confirmDeleteBuilding.id}`, 'DELETE');
			toast.success(`${confirmDeleteBuilding.name} deleted`);
			confirmDeleteBuilding = null;
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			deletingBuilding = false;
		}
	}

	// Unit
	function openAddUnit(b: Building) {
		showUnitModal = { kind: 'add', building: b };
		unitDraft = { name: '', unit_type: '', notes: '' };
		unitAmenitySet = new Set();
	}
	function openEditUnit(b: Building, u: Unit) {
		showUnitModal = { kind: 'edit', building: b, unit: u };
		unitDraft = { ...u };
		unitAmenitySet = new Set(u.amenity_ids || []);
	}
	async function saveUnit() {
		if (!showUnitModal) return;
		if (!unitDraft.name?.trim()) {
			toast.error('Apartment name required');
			return;
		}
		unitSaving = true;
		try {
			if (showUnitModal.kind === 'add') {
				await callJSON(`${PUBLIC_API_URL}/api/portfolio/units`, 'POST', {
					building_id: showUnitModal.building.id,
					name: unitDraft.name.trim(),
					unit_type: unitDraft.unit_type || null,
					amenity_ids: Array.from(unitAmenitySet),
					notes: unitDraft.notes || null
				});
				toast.success(`Apartment ${unitDraft.name} added`);
			} else {
				await callJSON(`${PUBLIC_API_URL}/api/portfolio/units/${showUnitModal.unit.id}`, 'PATCH', {
					name: unitDraft.name.trim(),
					unit_type: unitDraft.unit_type || null,
					amenity_ids: Array.from(unitAmenitySet),
					notes: unitDraft.notes || null
				});
				toast.success(`Apartment ${unitDraft.name} updated`);
			}
			showUnitModal = null;
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			unitSaving = false;
		}
	}
	async function doDeleteUnit() {
		if (!confirmDeleteUnit) return;
		deletingUnit = true;
		try {
			await callJSON(`${PUBLIC_API_URL}/api/portfolio/units/${confirmDeleteUnit.unit.id}`, 'DELETE');
			toast.success(`Apartment deleted`);
			confirmDeleteUnit = null;
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			deletingUnit = false;
		}
	}

	// Room
	function openAddRoom(b: Building, u: Unit) {
		showRoomModal = { kind: 'add', building: b, unit: u };
		roomDraft = { name: '', length: '', strategy: '' };
		roomDraftAmenities = new Set();
		customAmenityDraft = '';
	}
	function openEditRoom(b: Building, u: Unit, r: Room) {
		showRoomModal = { kind: 'edit', building: b, unit: u, room: r };
		roomDraft = { ...r, ...(r.financials || {}) };
		roomDraftAmenities = new Set(r.amenity_ids || []);
		customAmenityDraft = '';
	}
	function toggleRoomAmenity(id: string) {
		if (roomDraftAmenities.has(id)) roomDraftAmenities.delete(id);
		else roomDraftAmenities.add(id);
		roomDraftAmenities = roomDraftAmenities;
	}
	async function addCustomAmenity() {
		const n = customAmenityDraft.trim();
		if (!n) return;
		const existing = amenities.find((a) => a.name.toLowerCase() === n.toLowerCase());
		if (existing) {
			roomDraftAmenities.add(existing.id);
			roomDraftAmenities = roomDraftAmenities;
			customAmenityDraft = '';
			toast.info(`"${existing.name}" added`);
			return;
		}
		try {
			const created = await callJSON(`${PUBLIC_API_URL}/api/portfolio/amenities`, 'POST', { name: n });
			amenities = [...amenities, created].sort((a, b) => a.name.localeCompare(b.name));
			amenitiesById = new Map(amenities.map((a) => [a.id, a]));
			roomDraftAmenities.add(created.id);
			roomDraftAmenities = roomDraftAmenities;
			customAmenityDraft = '';
		} catch (e: any) {
			toast.error(e.message);
		}
	}
	async function saveRoom() {
		if (!showRoomModal) return;
		if (!roomDraft.name?.trim()) {
			toast.error('Room name required');
			return;
		}
		roomSaving = true;
		const body: any = {
			name: roomDraft.name.trim(),
			length: roomDraft.length || null,
			strategy: roomDraft.strategy || null,
			beds: roomDraft.beds != null && roomDraft.beds !== '' ? Number(roomDraft.beds) : null,
			baths: roomDraft.baths != null && roomDraft.baths !== '' ? Number(roomDraft.baths) : null,
			bed_size: roomDraft.bed_size || null,
			bathroom: roomDraft.bathroom || null,
			ceiling_height: roomDraft.ceiling_height || null,
			balcony: roomDraft.balcony || null,
			room_type_name: roomDraft.room_type_name || null,
			sqft: roomDraft.sqft != null && roomDraft.sqft !== '' ? Number(roomDraft.sqft) : null,
			is_ada: roomDraft.is_ada ?? null,
			listing_date: roomDraft.listing_date || null,
			amenity_ids: Array.from(roomDraftAmenities),
			notes: roomDraft.notes || null,
			actual_rent: roomDraft.actual_rent ?? null,
			base_rent: roomDraft.base_rent ?? null,
			market_rent: roomDraft.market_rent ?? null,
			actual_rent_with_util: roomDraft.actual_rent_with_util ?? null,
			pessimistic_rent: roomDraft.pessimistic_rent ?? null,
			concession_rent: roomDraft.concession_rent ?? null,
			concession_rent_with_util: roomDraft.concession_rent_with_util ?? null,
			adjustment: roomDraft.adjustment ?? null,
			stake_5_cashback: roomDraft.stake_5_cashback ?? null,
			stake_8_cashback: roomDraft.stake_8_cashback ?? null,
			revenue_month: roomDraft.revenue_month ?? null,
			revenue_year: roomDraft.revenue_year ?? null,
			revenue_per_apartment: roomDraft.revenue_per_apartment ?? null,
			extras: roomDraft.extras || null
		};
		try {
			if (showRoomModal.kind === 'add') {
				await callJSON(`${PUBLIC_API_URL}/api/portfolio/rooms`, 'POST', { ...body, unit_id: showRoomModal.unit.id });
				toast.success(`Room ${body.name} added`);
			} else {
				await callJSON(`${PUBLIC_API_URL}/api/portfolio/rooms/${showRoomModal.room.id}`, 'PATCH', body);
				toast.success(`Room ${body.name} updated`);
			}
			showRoomModal = null;
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			roomSaving = false;
		}
	}
	async function doDeleteRoom() {
		if (!confirmDeleteRoom) return;
		deletingRoom = true;
		try {
			await callJSON(`${PUBLIC_API_URL}/api/portfolio/rooms/${confirmDeleteRoom.room.id}`, 'DELETE');
			toast.success('Room deleted');
			confirmDeleteRoom = null;
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			deletingRoom = false;
		}
	}

	// Quick LTR/STR pill flip
	async function flipLength(r: Room) {
		busyIds.add(r.id);
		busyIds = busyIds;
		const next: Length = r.length === 'LTR' ? 'STR' : 'LTR';
		try {
			await callJSON(`${PUBLIC_API_URL}/api/portfolio/rooms/${r.id}`, 'PATCH', { length: next });
			r.length = next;
			buildings = buildings; // reactive
			toast.success(`Set to ${next}`);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			busyIds.delete(r.id);
			busyIds = busyIds;
		}
	}

	// Monthly perf
	async function loadMonthly(buildingId: string) {
		loadingPerf = true;
		try {
			const res = await fetch(
				`${PUBLIC_API_URL}/api/portfolio/monthly-performance?building_id=${buildingId}`,
				{ headers: authHeader() }
			);
			if (!res.ok) throw new Error(`Failed (${res.status})`);
			const d = await res.json();
			monthlyByBuilding[buildingId] = d.rows || [];
			monthlyByBuilding = monthlyByBuilding;
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			loadingPerf = false;
		}
	}
	function toggleFinancials(b: Building) {
		if (financialsBuildingId === b.id) {
			financialsBuildingId = null;
		} else {
			financialsBuildingId = b.id;
			if (!monthlyByBuilding[b.id]) loadMonthly(b.id);
		}
	}
	function openAddPerf(b: Building) {
		const now = new Date();
		perfDraft = {
			building_id: b.id,
			period_year: now.getFullYear(),
			period_month: now.getMonth() + 1
		};
		showPerfModal = true;
	}
	function openEditPerf(row: MonthlyPerf) {
		perfDraft = { ...row };
		showPerfModal = true;
	}
	async function savePerf() {
		if (!perfDraft.period_year || !perfDraft.period_month) {
			toast.error('Year and month required');
			return;
		}
		perfSaving = true;
		try {
			const isEdit = !!perfDraft.id;
			const url = isEdit
				? `${PUBLIC_API_URL}/api/portfolio/monthly-performance/${perfDraft.id}`
				: `${PUBLIC_API_URL}/api/portfolio/monthly-performance`;
			const body: any = {
				occupancy_pct: perfDraft.occupancy_pct ?? null,
				adr: perfDraft.adr ?? null,
				revpar: perfDraft.revpar ?? null,
				revenue: perfDraft.revenue ?? null,
				notes: perfDraft.notes || null
			};
			if (!isEdit) {
				body.building_id = perfDraft.building_id;
				body.period_year = perfDraft.period_year;
				body.period_month = perfDraft.period_month;
			}
			await callJSON(url, isEdit ? 'PATCH' : 'POST', body);
			toast.success(isEdit ? 'Updated' : 'Added');
			showPerfModal = false;
			if (perfDraft.building_id) await loadMonthly(perfDraft.building_id);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			perfSaving = false;
		}
	}
	async function doDeletePerf() {
		if (!confirmDeletePerf) return;
		try {
			await callJSON(`${PUBLIC_API_URL}/api/portfolio/monthly-performance/${confirmDeletePerf.id}`, 'DELETE');
			const bid = confirmDeletePerf.building_id;
			confirmDeletePerf = null;
			toast.success('Deleted');
			await loadMonthly(bid);
		} catch (e: any) {
			toast.error(e.message);
		}
	}
</script>

<div class="space-y-5">
	<!-- Header -->
	<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<div class="flex items-center gap-3">
			<div class="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50">
				<LayoutGrid class="h-6 w-6 text-teal-600" />
			</div>
			<div>
				<h1 class="text-2xl font-semibold text-gray-900">New Properties Page</h1>
				<p class="text-sm text-gray-500">Buildings, units, rooms, amenities, and financials — all in one place.</p>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			{#if isOwner}
				<div class="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs">
					{#each [{ k: 'owner', label: 'Editor' }, { k: 'investor', label: 'Cards' }, { k: 'operator', label: 'Amenities' }] as opt}
						<button
							on:click={() => { mode = opt.k as Mode; modeChosenManually = true; }}
							class="rounded-md px-2 py-1 transition"
							class:bg-teal-600={mode === opt.k}
							class:text-white={mode === opt.k}
							class:text-gray-600={mode !== opt.k}
							class:hover:bg-gray-50={mode !== opt.k}
						>{opt.label}</button>
					{/each}
				</div>
			{/if}
			{#if mode === 'owner'}
				<div class="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs">
					<button on:click={expandAll} class="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-50">Expand all</button>
					<button on:click={collapseAll} class="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-50">Collapse all</button>
				</div>
			{/if}
			<button
				on:click={() => { compareMode = !compareMode; if (!compareMode) clearFiltersB(); }}
				class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition"
				class:border-amber-300={compareMode}
				class:bg-amber-50={compareMode}
				class:text-amber-700={compareMode}
				class:border-gray-200={!compareMode}
				class:bg-white={!compareMode}
				class:text-gray-700={!compareMode}
				class:hover:bg-amber-100={compareMode}
				class:hover:bg-gray-50={!compareMode}
				title="Compare two filter sets side-by-side"
			>
				<Columns class="h-4 w-4" /> {compareMode ? 'Exit compare' : 'Compare'}
			</button>
			<button
				on:click={() => load()}
				disabled={loading}
				class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
			>
				<RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" /> Refresh
			</button>
			{#if isOwnerView}
				<button
					on:click={openAddBuilding}
					class="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
				>
					<Plus class="h-4 w-4" /> Add building
				</button>
			{/if}
		</div>
	</div>

	<!-- Stat strip -->
	<div class="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
		{#each [
			{ label: 'Buildings', value: totals.buildings, icon: Building2, tint: 'bg-blue-50 text-blue-700', fmt: 'n' },
			{ label: 'Units', value: totals.units, icon: Layers, tint: 'bg-purple-50 text-purple-700', fmt: 'n' },
			{ label: 'Rooms', value: totals.rooms, icon: Bed, tint: 'bg-amber-50 text-amber-700', fmt: 'n' },
			{ label: 'LTR rooms', value: totals.ltr, icon: ArrowUpDown, tint: 'bg-teal-50 text-teal-700', fmt: 'n' },
			{ label: 'STR rooms', value: totals.str, icon: ArrowUpDown, tint: 'bg-orange-50 text-orange-700', fmt: 'n' },
			{ label: 'Monthly rent', value: totals.monthlyRent, icon: DollarSign, tint: 'bg-emerald-50 text-emerald-700', fmt: '$' },
			{ label: 'Last yr revenue', value: totals.annualRevenue, icon: TrendingUp, tint: 'bg-indigo-50 text-indigo-700', fmt: '$' }
		] as c}
			<div class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg {c.tint}">
					<svelte:component this={c.icon} class="h-5 w-5" />
				</div>
				<div>
					<div class="text-xs uppercase tracking-wide text-gray-500">{c.label}</div>
					{#if loading}
						<Skeleton height="1.5rem" width="2rem" />
					{:else if c.fmt === '$'}
						<div class="text-xl font-semibold text-gray-900">{fmtMoney(c.value, { compact: true })}</div>
					{:else}
						<div class="text-xl font-semibold text-gray-900">{c.value}</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Filter bar -->
	<section class="rounded-lg border border-gray-200 bg-white p-3">
		<!-- Top bar: search + controls -->
		<div class="flex flex-col gap-3 md:flex-row md:items-center">
			<div class="relative flex-1">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
				<input type="text" bind:value={search} placeholder="Search building, unit, room, amenity, type…"
					class="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
				{#if search}<button on:click={() => (search = '')} class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X class="h-4 w-4" /></button>{/if}
			</div>
			<button on:click={() => (showFilters = !showFilters)}
				class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
				<ListFilter class="h-4 w-4" />
				{showFilters ? 'Hide' : 'Show'} filters
				{#if hasAnyFilter}<span class="ml-1 rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-medium text-white">on</span>{/if}
			</button>
			<select bind:value={sortKey} class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
				<option value="name">Sort: Name (A→Z)</option>
				<option value="rent_desc">Sort: Rent ↓</option>
				<option value="rent_asc">Sort: Rent ↑</option>
				<option value="revenue_desc">Sort: Revenue ↓</option>
			</select>
			{#if hasAnyFilter}
				<button on:click={clearFilters} class="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">
					<X class="h-3.5 w-3.5" /> Clear all
				</button>
			{/if}
		</div>

		{#if showFilters}
			{#if compareMode}
				<!-- Compare mode: two filter sets side by side -->
				<div class="mt-3 grid grid-cols-1 gap-4 border-t border-gray-100 pt-3 lg:grid-cols-2">
					<!-- Set A -->
					<div class="rounded-lg border-2 border-teal-200 bg-teal-50/30 p-3">
						<div class="mb-2 flex items-center justify-between">
							<span class="flex items-center gap-2 text-sm font-semibold text-teal-700"><span class="flex h-5 w-5 items-center justify-center rounded bg-teal-600 text-[10px] font-bold text-white">A</span> Set A</span>
							{#if hasAnyFilter}<button on:click={clearFilters} class="text-xs text-teal-600 hover:underline">Clear</button>{/if}
						</div>
						<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
							<div><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Length</div><div class="flex flex-wrap gap-1">{#each ['LTR','STR','unset'] as v}<button on:click={() => (lengthFilter = toggleSet(lengthFilter, v))} class="rounded border px-1.5 py-0.5 text-[11px] font-medium transition" class:border-teal-500={lengthFilter.has(v)} class:bg-teal-100={lengthFilter.has(v)} class:text-teal-800={lengthFilter.has(v)} class:border-gray-200={!lengthFilter.has(v)} class:text-gray-600={!lengthFilter.has(v)}>{v==='unset'?'—':v}</button>{/each}</div></div>
							<div><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Strategy</div><div class="flex flex-wrap gap-1">{#each ['all','Coliving','Entire Apt','unset'] as const as v}<button on:click={() => (strategyFilter = v)} class="rounded border px-1.5 py-0.5 text-[11px] transition" class:border-teal-500={strategyFilter===v} class:bg-teal-100={strategyFilter===v} class:text-teal-800={strategyFilter===v} class:border-gray-200={strategyFilter!==v} class:text-gray-600={strategyFilter!==v}>{v}</button>{/each}</div></div>
							<div><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Bathroom</div><div class="flex flex-wrap gap-1">{#each ['all','Private','Shared'] as const as v}<button on:click={() => (bathroomFilter = v)} class="rounded border px-1.5 py-0.5 text-[11px] transition" class:border-teal-500={bathroomFilter===v} class:bg-teal-100={bathroomFilter===v} class:text-teal-800={bathroomFilter===v} class:border-gray-200={bathroomFilter!==v} class:text-gray-600={bathroomFilter!==v}>{v}</button>{/each}</div></div>
							{#if unitTypeOptions.length > 0}<div class="col-span-2 sm:col-span-3"><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Unit type</div><div class="flex flex-wrap gap-1">{#each unitTypeOptions as ut}<button on:click={() => (unitTypeFilter = toggleSet(unitTypeFilter, ut))} class="rounded border px-1.5 py-0.5 text-[11px] font-medium transition" class:border-teal-500={unitTypeFilter.has(ut)} class:bg-teal-100={unitTypeFilter.has(ut)} class:text-teal-800={unitTypeFilter.has(ut)} class:border-gray-200={!unitTypeFilter.has(ut)} class:text-gray-600={!unitTypeFilter.has(ut)}>{ut}</button>{/each}</div></div>{/if}
							{#if bedsOptions.length > 0}<div><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Beds</div><div class="flex flex-wrap gap-1">{#each bedsOptions as n}<button on:click={() => (bedsFilter = toggleSet(bedsFilter, n))} class="rounded border px-1.5 py-0.5 text-[11px] font-medium transition" class:border-teal-500={bedsFilter.has(n)} class:bg-teal-100={bedsFilter.has(n)} class:text-teal-800={bedsFilter.has(n)} class:border-gray-200={!bedsFilter.has(n)} class:text-gray-600={!bedsFilter.has(n)}>{n} bd</button>{/each}</div></div>{/if}
							{#if bathsOptions.length > 0}<div><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Baths</div><div class="flex flex-wrap gap-1">{#each bathsOptions as n}<button on:click={() => (bathsFilter = toggleSet(bathsFilter, n))} class="rounded border px-1.5 py-0.5 text-[11px] font-medium transition" class:border-teal-500={bathsFilter.has(n)} class:bg-teal-100={bathsFilter.has(n)} class:text-teal-800={bathsFilter.has(n)} class:border-gray-200={!bathsFilter.has(n)} class:text-gray-600={!bathsFilter.has(n)}>{n} ba</button>{/each}</div></div>{/if}
							{#if bedSizeOptions.length > 0}<div class="col-span-2 sm:col-span-3"><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Bed size</div><div class="flex flex-wrap gap-1">{#each bedSizeOptions as bs}<button on:click={() => (bedSizeFilter = toggleSet(bedSizeFilter, bs))} class="rounded border px-1.5 py-0.5 text-[11px] transition" class:border-teal-500={bedSizeFilter.has(bs)} class:bg-teal-100={bedSizeFilter.has(bs)} class:text-teal-800={bedSizeFilter.has(bs)} class:border-gray-200={!bedSizeFilter.has(bs)} class:text-gray-600={!bedSizeFilter.has(bs)}>{bs}</button>{/each}</div></div>{/if}
							{#if roomTypeOptions.length > 0}<div class="col-span-2 sm:col-span-3"><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Room type</div><div class="flex flex-wrap gap-1">{#each roomTypeOptions as rt}<button on:click={() => (roomTypeFilter = toggleSet(roomTypeFilter, rt))} class="rounded border px-1.5 py-0.5 text-[11px] transition" class:border-teal-500={roomTypeFilter.has(rt)} class:bg-teal-100={roomTypeFilter.has(rt)} class:text-teal-800={roomTypeFilter.has(rt)} class:border-gray-200={!roomTypeFilter.has(rt)} class:text-gray-600={!roomTypeFilter.has(rt)}>{rt}</button>{/each}</div></div>{/if}
							{#if buildings.length > 1}<div class="col-span-2 sm:col-span-3"><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Buildings</div><div class="flex flex-wrap gap-1">{#each buildings as b}<button on:click={() => (buildingFilter = toggleSet(buildingFilter, b.id))} class="rounded border px-1.5 py-0.5 text-[11px] transition" class:border-teal-500={buildingFilter.has(b.id)} class:bg-teal-100={buildingFilter.has(b.id)} class:text-teal-800={buildingFilter.has(b.id)} class:border-gray-200={!buildingFilter.has(b.id)} class:text-gray-600={!buildingFilter.has(b.id)}>{b.name}</button>{/each}</div></div>{/if}
							<div class="col-span-2 sm:col-span-3"><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Rent ($/mo)</div><div class="flex items-center gap-2"><input type="number" min="0" step="50" bind:value={rentMin} placeholder="Min" class="w-20 rounded border border-gray-200 px-2 py-1 text-xs" /><span class="text-gray-400">—</span><input type="number" min="0" step="50" bind:value={rentMax} placeholder="Max" class="w-20 rounded border border-gray-200 px-2 py-1 text-xs" /></div></div>
							<div class="col-span-2 sm:col-span-3 flex gap-3"><label class="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" bind:checked={adaOnly} class="h-3.5 w-3.5 rounded border-gray-300 text-teal-600" /><span>ADA</span></label><label class="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" bind:checked={withRentOnly} class="h-3.5 w-3.5 rounded border-gray-300 text-teal-600" /><span>Has rent</span></label></div>
						</div>
					</div>

					<!-- Set B -->
					<div class="rounded-lg border-2 border-amber-200 bg-amber-50/30 p-3">
						<div class="mb-2 flex items-center justify-between">
							<span class="flex items-center gap-2 text-sm font-semibold text-amber-700"><span class="flex h-5 w-5 items-center justify-center rounded bg-amber-500 text-[10px] font-bold text-white">B</span> Set B</span>
							{#if hasAnyFilterB}<button on:click={clearFiltersB} class="text-xs text-amber-600 hover:underline">Clear</button>{/if}
						</div>
						<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
							<div><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Length</div><div class="flex flex-wrap gap-1">{#each ['LTR','STR','unset'] as v}<button on:click={() => (lengthFilter_b = toggleSet(lengthFilter_b, v))} class="rounded border px-1.5 py-0.5 text-[11px] font-medium transition" class:border-amber-500={lengthFilter_b.has(v)} class:bg-amber-100={lengthFilter_b.has(v)} class:text-amber-800={lengthFilter_b.has(v)} class:border-gray-200={!lengthFilter_b.has(v)} class:text-gray-600={!lengthFilter_b.has(v)}>{v==='unset'?'—':v}</button>{/each}</div></div>
							<div><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Strategy</div><div class="flex flex-wrap gap-1">{#each ['all','Coliving','Entire Apt','unset'] as const as v}<button on:click={() => (strategyFilter_b = v)} class="rounded border px-1.5 py-0.5 text-[11px] transition" class:border-amber-500={strategyFilter_b===v} class:bg-amber-100={strategyFilter_b===v} class:text-amber-800={strategyFilter_b===v} class:border-gray-200={strategyFilter_b!==v} class:text-gray-600={strategyFilter_b!==v}>{v}</button>{/each}</div></div>
							<div><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Bathroom</div><div class="flex flex-wrap gap-1">{#each ['all','Private','Shared'] as const as v}<button on:click={() => (bathroomFilter_b = v)} class="rounded border px-1.5 py-0.5 text-[11px] transition" class:border-amber-500={bathroomFilter_b===v} class:bg-amber-100={bathroomFilter_b===v} class:text-amber-800={bathroomFilter_b===v} class:border-gray-200={bathroomFilter_b!==v} class:text-gray-600={bathroomFilter_b!==v}>{v}</button>{/each}</div></div>
							{#if unitTypeOptions.length > 0}<div class="col-span-2 sm:col-span-3"><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Unit type</div><div class="flex flex-wrap gap-1">{#each unitTypeOptions as ut}<button on:click={() => (unitTypeFilter_b = toggleSet(unitTypeFilter_b, ut))} class="rounded border px-1.5 py-0.5 text-[11px] font-medium transition" class:border-amber-500={unitTypeFilter_b.has(ut)} class:bg-amber-100={unitTypeFilter_b.has(ut)} class:text-amber-800={unitTypeFilter_b.has(ut)} class:border-gray-200={!unitTypeFilter_b.has(ut)} class:text-gray-600={!unitTypeFilter_b.has(ut)}>{ut}</button>{/each}</div></div>{/if}
							{#if bedsOptions.length > 0}<div><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Beds</div><div class="flex flex-wrap gap-1">{#each bedsOptions as n}<button on:click={() => (bedsFilter_b = toggleSet(bedsFilter_b, n))} class="rounded border px-1.5 py-0.5 text-[11px] font-medium transition" class:border-amber-500={bedsFilter_b.has(n)} class:bg-amber-100={bedsFilter_b.has(n)} class:text-amber-800={bedsFilter_b.has(n)} class:border-gray-200={!bedsFilter_b.has(n)} class:text-gray-600={!bedsFilter_b.has(n)}>{n} bd</button>{/each}</div></div>{/if}
							{#if bathsOptions.length > 0}<div><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Baths</div><div class="flex flex-wrap gap-1">{#each bathsOptions as n}<button on:click={() => (bathsFilter_b = toggleSet(bathsFilter_b, n))} class="rounded border px-1.5 py-0.5 text-[11px] font-medium transition" class:border-amber-500={bathsFilter_b.has(n)} class:bg-amber-100={bathsFilter_b.has(n)} class:text-amber-800={bathsFilter_b.has(n)} class:border-gray-200={!bathsFilter_b.has(n)} class:text-gray-600={!bathsFilter_b.has(n)}>{n} ba</button>{/each}</div></div>{/if}
							{#if bedSizeOptions.length > 0}<div class="col-span-2 sm:col-span-3"><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Bed size</div><div class="flex flex-wrap gap-1">{#each bedSizeOptions as bs}<button on:click={() => (bedSizeFilter_b = toggleSet(bedSizeFilter_b, bs))} class="rounded border px-1.5 py-0.5 text-[11px] transition" class:border-amber-500={bedSizeFilter_b.has(bs)} class:bg-amber-100={bedSizeFilter_b.has(bs)} class:text-amber-800={bedSizeFilter_b.has(bs)} class:border-gray-200={!bedSizeFilter_b.has(bs)} class:text-gray-600={!bedSizeFilter_b.has(bs)}>{bs}</button>{/each}</div></div>{/if}
							{#if roomTypeOptions.length > 0}<div class="col-span-2 sm:col-span-3"><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Room type</div><div class="flex flex-wrap gap-1">{#each roomTypeOptions as rt}<button on:click={() => (roomTypeFilter_b = toggleSet(roomTypeFilter_b, rt))} class="rounded border px-1.5 py-0.5 text-[11px] transition" class:border-amber-500={roomTypeFilter_b.has(rt)} class:bg-amber-100={roomTypeFilter_b.has(rt)} class:text-amber-800={roomTypeFilter_b.has(rt)} class:border-gray-200={!roomTypeFilter_b.has(rt)} class:text-gray-600={!roomTypeFilter_b.has(rt)}>{rt}</button>{/each}</div></div>{/if}
							{#if buildings.length > 1}<div class="col-span-2 sm:col-span-3"><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Buildings</div><div class="flex flex-wrap gap-1">{#each buildings as b}<button on:click={() => (buildingFilter_b = toggleSet(buildingFilter_b, b.id))} class="rounded border px-1.5 py-0.5 text-[11px] transition" class:border-amber-500={buildingFilter_b.has(b.id)} class:bg-amber-100={buildingFilter_b.has(b.id)} class:text-amber-800={buildingFilter_b.has(b.id)} class:border-gray-200={!buildingFilter_b.has(b.id)} class:text-gray-600={!buildingFilter_b.has(b.id)}>{b.name}</button>{/each}</div></div>{/if}
							<div class="col-span-2 sm:col-span-3"><div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Rent ($/mo)</div><div class="flex items-center gap-2"><input type="number" min="0" step="50" bind:value={rentMin_b} placeholder="Min" class="w-20 rounded border border-gray-200 px-2 py-1 text-xs" /><span class="text-gray-400">—</span><input type="number" min="0" step="50" bind:value={rentMax_b} placeholder="Max" class="w-20 rounded border border-gray-200 px-2 py-1 text-xs" /></div></div>
							<div class="col-span-2 sm:col-span-3 flex gap-3"><label class="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" bind:checked={adaOnly_b} class="h-3.5 w-3.5 rounded border-gray-300 text-amber-500" /><span>ADA</span></label><label class="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" bind:checked={withRentOnly_b} class="h-3.5 w-3.5 rounded border-gray-300 text-amber-500" /><span>Has rent</span></label></div>
						</div>
					</div>
				</div>
			{:else}
				<!-- Normal single filter set -->
				<div class="mt-3 grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 md:grid-cols-2 lg:grid-cols-4">
					<div>
						<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Length <span class="font-normal normal-case text-gray-400">(multi)</span></div>
						<div class="flex flex-wrap gap-1">
							{#each ['LTR', 'STR', 'unset'] as v}
								<button on:click={() => (lengthFilter = toggleSet(lengthFilter, v))} class="rounded-md border px-2 py-1 text-xs font-medium transition" class:border-teal-500={lengthFilter.has(v)} class:bg-teal-50={lengthFilter.has(v)} class:text-teal-700={lengthFilter.has(v)} class:border-gray-200={!lengthFilter.has(v)} class:text-gray-600={!lengthFilter.has(v)}>{v === 'unset' ? 'Not set' : v}</button>
							{/each}
						</div>
					</div>
					<div>
						<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Strategy</div>
						<div class="flex flex-wrap gap-1">
							{#each ['all', 'Coliving', 'Entire Apt', 'unset'] as const as v}
								<button on:click={() => (strategyFilter = v)} class="rounded-md border px-2 py-1 text-xs transition" class:border-teal-500={strategyFilter === v} class:bg-teal-50={strategyFilter === v} class:text-teal-700={strategyFilter === v} class:border-gray-200={strategyFilter !== v} class:text-gray-600={strategyFilter !== v}>{v}</button>
							{/each}
						</div>
					</div>
					<div>
						<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Bathroom</div>
						<div class="flex flex-wrap gap-1">
							{#each ['all', 'Private', 'Shared'] as const as v}
								<button on:click={() => (bathroomFilter = v)} class="rounded-md border px-2 py-1 text-xs transition" class:border-teal-500={bathroomFilter === v} class:bg-teal-50={bathroomFilter === v} class:text-teal-700={bathroomFilter === v} class:border-gray-200={bathroomFilter !== v} class:text-gray-600={bathroomFilter !== v}>{v}</button>
							{/each}
						</div>
					</div>
					<div>
						<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Quick toggles</div>
						<div class="flex flex-wrap gap-3">
							<label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={adaOnly} class="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" /><span class="text-gray-700">ADA only</span></label>
							<label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={withRentOnly} class="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" /><span class="text-gray-700">Has rent</span></label>
							<label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={elevatorOnly} class="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" /><span class="text-gray-700">Has elevator</span></label>
						</div>
					</div>
					{#if unitTypeOptions.length > 0}
					<div class="md:col-span-2 lg:col-span-4">
						<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Unit type <span class="font-normal normal-case text-gray-400">(3/3, Studio, etc.)</span></div>
						<div class="flex flex-wrap gap-1">
							{#each unitTypeOptions as ut}
								<button on:click={() => (unitTypeFilter = toggleSet(unitTypeFilter, ut))} class="rounded-md border px-2 py-1 text-xs font-medium transition" class:border-teal-500={unitTypeFilter.has(ut)} class:bg-teal-50={unitTypeFilter.has(ut)} class:text-teal-700={unitTypeFilter.has(ut)} class:border-gray-200={!unitTypeFilter.has(ut)} class:text-gray-600={!unitTypeFilter.has(ut)}>{ut}</button>
							{/each}
						</div>
					</div>
					{/if}
					{#if bedsOptions.length > 0}
						<div>
							<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Beds</div>
							<div class="flex flex-wrap gap-1">
								{#each bedsOptions as n}
									<button on:click={() => (bedsFilter = toggleSet(bedsFilter, n))} class="rounded-md border px-2 py-1 text-xs font-semibold transition" class:border-teal-500={bedsFilter.has(n)} class:bg-teal-50={bedsFilter.has(n)} class:text-teal-700={bedsFilter.has(n)} class:border-gray-200={!bedsFilter.has(n)} class:text-gray-600={!bedsFilter.has(n)}>{n} bd</button>
								{/each}
							</div>
						</div>
					{/if}
					{#if bathsOptions.length > 0}
						<div>
							<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Baths</div>
							<div class="flex flex-wrap gap-1">
								{#each bathsOptions as n}
									<button on:click={() => (bathsFilter = toggleSet(bathsFilter, n))} class="rounded-md border px-2 py-1 text-xs font-semibold transition" class:border-teal-500={bathsFilter.has(n)} class:bg-teal-50={bathsFilter.has(n)} class:text-teal-700={bathsFilter.has(n)} class:border-gray-200={!bathsFilter.has(n)} class:text-gray-600={!bathsFilter.has(n)}>{n} ba</button>
								{/each}
							</div>
						</div>
					{/if}
					{#if bedSizeOptions.length > 0}
						<div class="md:col-span-2">
							<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Bed size</div>
							<div class="flex flex-wrap gap-1">
								{#each bedSizeOptions as bs}
									<button on:click={() => (bedSizeFilter = toggleSet(bedSizeFilter, bs))} class="rounded-md border px-2 py-1 text-xs transition" class:border-teal-500={bedSizeFilter.has(bs)} class:bg-teal-50={bedSizeFilter.has(bs)} class:text-teal-700={bedSizeFilter.has(bs)} class:border-gray-200={!bedSizeFilter.has(bs)} class:text-gray-600={!bedSizeFilter.has(bs)}>{bs}</button>
								{/each}
							</div>
						</div>
					{/if}
					{#if roomTypeOptions.length > 0}
						<div class="md:col-span-2">
							<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Room type</div>
							<div class="flex flex-wrap gap-1">
								{#each roomTypeOptions as rt}
									<button on:click={() => (roomTypeFilter = toggleSet(roomTypeFilter, rt))} class="rounded-md border px-2 py-1 text-xs transition" class:border-teal-500={roomTypeFilter.has(rt)} class:bg-teal-50={roomTypeFilter.has(rt)} class:text-teal-700={roomTypeFilter.has(rt)} class:border-gray-200={!roomTypeFilter.has(rt)} class:text-gray-600={!roomTypeFilter.has(rt)}>{rt}</button>
								{/each}
							</div>
						</div>
					{/if}
					<div>
						<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Rent range ($/mo)</div>
						<div class="flex items-center gap-2">
							<input type="number" min="0" step="50" bind:value={rentMin} placeholder="Min" class="w-24 rounded-md border border-gray-200 px-2 py-1 text-sm" />
							<span class="text-gray-400">—</span>
							<input type="number" min="0" step="50" bind:value={rentMax} placeholder="Max" class="w-24 rounded-md border border-gray-200 px-2 py-1 text-sm" />
						</div>
					</div>
					{#if buildings.length > 1}
						<div class="md:col-span-2 lg:col-span-3">
							<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Buildings</div>
							<div class="flex flex-wrap gap-1">
								{#each buildings as b}
									<button on:click={() => (buildingFilter = toggleSet(buildingFilter, b.id))} class="rounded-md border px-2 py-1 text-xs transition" class:border-teal-500={buildingFilter.has(b.id)} class:bg-teal-50={buildingFilter.has(b.id)} class:text-teal-700={buildingFilter.has(b.id)} class:border-gray-200={!buildingFilter.has(b.id)} class:text-gray-600={!buildingFilter.has(b.id)}>{b.name}</button>
								{/each}
							</div>
						</div>
					{/if}
					{#if ownerLLCOptions.length > 1}
						<div>
							<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Owner LLC</div>
							<div class="flex flex-wrap gap-1">
								{#each ownerLLCOptions as llc}
									<button on:click={() => (ownerLLCFilter = toggleSet(ownerLLCFilter, llc))} class="rounded-md border px-2 py-1 text-xs transition" class:border-teal-500={ownerLLCFilter.has(llc)} class:bg-teal-50={ownerLLCFilter.has(llc)} class:text-teal-700={ownerLLCFilter.has(llc)} class:border-gray-200={!ownerLLCFilter.has(llc)} class:text-gray-600={!ownerLLCFilter.has(llc)}>{llc}</button>
								{/each}
							</div>
						</div>
					{/if}
					{#if amenities.length > 0}
						<div class="md:col-span-2 lg:col-span-4">
							<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Has amenities (all must match)</div>
							<div class="flex flex-wrap gap-1">
								{#each amenities as a}
									<button on:click={() => (amenityFilter = toggleSet(amenityFilter, a.id))} class="rounded-md border px-2 py-1 text-xs transition" class:border-teal-500={amenityFilter.has(a.id)} class:bg-teal-50={amenityFilter.has(a.id)} class:text-teal-700={amenityFilter.has(a.id)} class:border-gray-200={!amenityFilter.has(a.id)} class:text-gray-600={!amenityFilter.has(a.id)}>{a.name}</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</section>

	<!-- Compare summary panel -->
	{#if compareMode && compareStats && !loading}
		{@const csA = compareStats.a}
		{@const csB = compareStats.b}
		<div class="rounded-lg border border-amber-200 bg-white shadow-sm overflow-hidden">
			<div class="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-4 py-2.5">
				<div class="flex items-center gap-2">
					<Columns class="h-4 w-4 text-amber-600" />
					<span class="text-sm font-semibold text-amber-800">Comparison</span>
				</div>
				<label class="inline-flex items-center gap-2 text-xs text-gray-600">
					<input type="checkbox" bind:checked={compareHideNeither} class="h-3.5 w-3.5 rounded border-gray-300" />
					Hide rooms matching neither set
				</label>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-100 text-xs text-gray-500">
							<th class="px-4 py-2 text-left font-medium">Metric</th>
							<th class="px-4 py-2 text-right font-medium"><span class="inline-flex items-center gap-1 rounded bg-teal-100 px-2 py-0.5 text-teal-700 font-bold">A</span></th>
							<th class="px-4 py-2 text-right font-medium"><span class="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-amber-700 font-bold">B</span></th>
							<th class="px-4 py-2 text-right font-medium text-gray-400">Δ (A − B)</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-50">
						{#each [
							{ label: 'Rooms', va: csA.rooms, vb: csB.rooms, fmt: 'n' },
							{ label: 'LTR rooms', va: csA.ltr, vb: csB.ltr, fmt: 'n' },
							{ label: 'STR rooms', va: csA.str, vb: csB.str, fmt: 'n' },
							{ label: 'Monthly rent', va: csA.monthlyRent, vb: csB.monthlyRent, fmt: '$' },
							{ label: 'Annual revenue', va: csA.annualRevenue, vb: csB.annualRevenue, fmt: '$' },
							{ label: 'Avg rent / room', va: csA.avgRent, vb: csB.avgRent, fmt: '$' },
						] as row}
							{@const delta = row.va - row.vb}
							{@const pct = row.vb > 0 ? ((delta / row.vb) * 100).toFixed(1) : null}
							<tr class="hover:bg-gray-50">
								<td class="px-4 py-2 text-gray-600">{row.label}</td>
								<td class="px-4 py-2 text-right font-semibold text-teal-700">{row.fmt === '$' ? fmtMoney(row.va, { compact: true }) : row.va}</td>
								<td class="px-4 py-2 text-right font-semibold text-amber-700">{row.fmt === '$' ? fmtMoney(row.vb, { compact: true }) : row.vb}</td>
								{#if delta === 0}
									<td class="px-4 py-2 text-right text-xs text-gray-400">—</td>
								{:else}
									<td class="px-4 py-2 text-right text-xs" class:text-emerald-600={delta > 0} class:text-red-500={delta < 0}>
										{delta > 0 ? '+' : ''}{row.fmt === '$' ? fmtMoney(delta, { compact: true }) : delta}
										{#if pct}<span class="ml-1 opacity-70">({delta > 0 ? '+' : ''}{pct}%)</span>{/if}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- Counter -->
	{#if !loading}
		<div class="flex items-center justify-between text-xs text-gray-500">
			<span>
				{#if compareMode}
					<strong class="text-teal-700">{compareStats?.a.rooms ?? 0}</strong> rooms in A · <strong class="text-amber-600">{compareStats?.b.rooms ?? 0}</strong> rooms in B
				{:else if hasAnyFilter}
					<strong class="text-gray-900">{totals.rooms}</strong> of {totalRoomsAll} rooms match
					· <strong class="text-gray-900">{totals.buildings}</strong> of {buildings.length} buildings
				{:else}
					Showing all <strong class="text-gray-900">{totalRoomsAll}</strong> rooms across <strong class="text-gray-900">{buildings.length}</strong> buildings
				{/if}
			</span>
			{#if hasAnyFilter}<button on:click={clearFilters} class="font-medium text-teal-600 hover:text-teal-700">Clear filters</button>{/if}
		</div>
	{/if}

	<!-- Body — varies by mode -->
	{#if loading}
		<div class="space-y-3">
			{#each Array(3) as _}
				<Skeleton height="6rem" />
			{/each}
		</div>
	{:else if loadError}
		<div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
			<p class="font-medium">New Properties Page is not ready yet.</p>
			<p class="mt-1 text-amber-800/90">{loadError}</p>
			<button on:click={() => load()} class="mt-3 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100">
				<RefreshCw class="h-3.5 w-3.5" /> Retry
			</button>
		</div>
	{:else if mode === 'investor'}
		<!-- Investor cards -->
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
			{#each filteredBuildings as b (b.id)}
				<button
					on:click={() => (drawerBuilding = b)}
					class="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition hover:shadow-md"
				>
					<div class="aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-teal-100 to-emerald-100">
						{#if b.photos?.[0]}
							<img src={b.photos[0]} alt={b.name} class="h-full w-full object-cover transition group-hover:scale-[1.02]" loading="lazy" />
						{:else}
							<div class="flex h-full w-full items-center justify-center text-teal-700/40">
								<ImageIcon class="h-10 w-10" />
							</div>
						{/if}
					</div>
					<div class="flex-1 p-4">
						<div class="flex items-start justify-between gap-2">
							<div>
								<h3 class="font-semibold text-gray-900">{b.full_name || b.name}</h3>
								{#if b.address}<p class="text-xs text-gray-500">{b.address}</p>{/if}
							</div>
							{#if b.has_elevator}<span class="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">Elevator</span>{/if}
						</div>
						{#if b.description}<p class="mt-2 line-clamp-2 text-sm text-gray-600">{b.description}</p>{/if}
						<div class="mt-3 grid grid-cols-3 gap-2 text-xs">
							<div><div class="text-gray-500">Units</div><div class="font-semibold text-gray-900">{b.units.length}</div></div>
							<div><div class="text-gray-500">Monthly</div><div class="font-semibold text-emerald-700">{fmtMoney(buildingRent(b), { compact: true })}</div></div>
							<div><div class="text-gray-500">Last yr</div><div class="font-semibold text-indigo-700">{fmtMoney(buildingAnnualRevenue(b), { compact: true })}</div></div>
						</div>
					</div>
				</button>
			{/each}
		</div>
	{:else if mode === 'operator'}
		<!-- Operator amenity-focused list -->
		<div class="space-y-3">
			{#each filteredBuildings as b (b.id)}
				<section class="rounded-lg border border-gray-200 bg-white">
					<div class="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2">
						<Building2 class="h-4 w-4 text-teal-600" />
						<h2 class="font-medium text-gray-900">{b.name}</h2>
						<span class="ml-auto text-xs text-gray-500">{b.units.reduce((a, u) => a + u.rooms.length, 0)} rooms</span>
					</div>
					<div class="divide-y divide-gray-100">
						{#each b.units as u (u.id)}
							{#if u.amenity_ids?.length > 0}
								<div class="flex flex-wrap items-center gap-1.5 bg-indigo-50/50 px-4 py-1.5">
									<span class="mr-1 text-[10px] font-medium uppercase tracking-wide text-indigo-400">Apt {u.name}:</span>
									{#each u.amenity_ids as aid}
										<span class="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-700">{nameOfAmenity(aid)}</span>
									{/each}
								</div>
							{/if}
							{#each u.rooms as r (r.id)}
								<div class="flex items-center gap-3 px-4 py-2 text-sm">
									<div class="w-20 shrink-0 font-medium text-gray-800">{r.name}</div>
									{#if r.beds != null || r.baths != null}<span class="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">{r.beds != null ? r.beds : '?'} bd / {r.baths != null ? r.baths : '?'} ba</span>{/if}
									{#if r.bed_size}<span class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700">{r.bed_size}</span>{/if}
									<div class="flex flex-1 flex-wrap gap-1">
										{#if r.amenity_ids.length === 0}
											<span class="text-xs italic text-gray-400">No amenities</span>
										{:else}
											{#each r.amenity_ids as aid}
												<span class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">{nameOfAmenity(aid)}</span>
											{/each}
										{/if}
									</div>
								</div>
							{/each}
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{:else}
		<!-- Owner editor mode (full tree) -->
		<div class="space-y-3">
			{#each filteredBuildings as b (b.id)}
				<section class="rounded-lg border border-gray-200 bg-white">
					<div class="flex items-stretch border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
						<button on:click={() => toggleBuilding(b.id)} class="flex flex-1 items-center justify-between px-4 py-3 text-left">
							<div class="flex items-center gap-3">
								{#if expandedBuildings.has(b.id)}<ChevronDown class="h-4 w-4 text-gray-400" />{:else}<ChevronRight class="h-4 w-4 text-gray-400" />{/if}
								<Building2 class="h-5 w-5 text-teal-600" />
								<div>
									<h2 class="font-semibold text-gray-900">{b.name}</h2>
									<div class="flex items-center gap-2 text-xs text-gray-500">
										{#if b.address}<span>{b.address}</span>{/if}
										{#if b.owner_llc}<span>· {b.owner_llc}</span>{/if}
										{#if b.floors}<span>· {b.floors} floors</span>{/if}
									</div>
								</div>
							</div>
							{#each [{ bRooms: b.units.reduce((a,u)=>a+u.rooms.length,0), bLTR: b.units.reduce((a,u)=>a+u.rooms.filter(r=>r.length==='LTR').length,0), bSTR: b.units.reduce((a,u)=>a+u.rooms.filter(r=>r.length==='STR').length,0), bRev: buildingAnnualRevenue(b) }] as bm}
							<div class="flex flex-col items-end gap-1">
								<div class="flex flex-wrap justify-end gap-1">
									<span class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{b.units.length} apts</span>
									<span class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{bm.bRooms} rooms</span>
									{#if bm.bLTR > 0}<span class="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">{bm.bLTR} LTR</span>{/if}
									{#if bm.bSTR > 0}<span class="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] text-purple-700">{bm.bSTR} STR</span>{/if}
								</div>
								<div class="flex flex-wrap justify-end gap-1">
									{#if buildingRent(b) > 0}
										<span class="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
											<DollarSign class="h-3 w-3" /> {fmtMoney(buildingRent(b), { compact: true })}/mo
										</span>
									{/if}
									{#if bm.bRev > 0}
										<span class="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
											{fmtMoney(bm.bRev, { compact: true })} last yr
										</span>
									{/if}
								</div>
							</div>
							{/each}
						</button>
						<div class="flex items-center gap-2 pr-3">
							<button on:click={() => toggleFinancials(b)} class="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200">
								<TrendingUp class="h-3.5 w-3.5" /> Financials
							</button>
							<Dropdown align="right">
								<button slot="trigger" class="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50" aria-label="Building actions">
									<MoreHorizontal class="h-4 w-4" />
								</button>
								<button on:click={() => openAddUnit(b)} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"><Plus class="h-4 w-4 text-gray-400" /> Add unit</button>
								<button on:click={() => openEditBuilding(b)} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"><Pencil class="h-4 w-4 text-gray-400" /> Edit building</button>
								<div class="my-1 border-t border-gray-100"></div>
								<button on:click={() => (confirmDeleteBuilding = b)} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 class="h-4 w-4" /> Delete building</button>
							</Dropdown>
						</div>
					</div>

					{#if financialsBuildingId === b.id}
						<div transition:fade={{ duration: 150 }} class="border-b border-gray-100 bg-gradient-to-br from-emerald-50/40 to-white p-4">
							<div class="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
								<div class="rounded-md border border-gray-200 bg-white p-2.5"><div class="text-[10px] uppercase tracking-wide text-gray-500">Monthly rent</div><div class="text-lg font-semibold text-emerald-700">{fmtMoney(buildingRent(b))}</div></div>
								<div class="rounded-md border border-gray-200 bg-white p-2.5"><div class="text-[10px] uppercase tracking-wide text-gray-500">Annualized</div><div class="text-lg font-semibold text-emerald-700">{fmtMoney(buildingRent(b) * 12)}</div></div>
								<div class="rounded-md border border-gray-200 bg-white p-2.5"><div class="text-[10px] uppercase tracking-wide text-gray-500">Last yr revenue</div><div class="text-lg font-semibold text-indigo-700">{fmtMoney(buildingAnnualRevenue(b))}</div></div>
								<div class="rounded-md border border-gray-200 bg-white p-2.5"><div class="text-[10px] uppercase tracking-wide text-gray-500">Avg/room</div><div class="text-lg font-semibold text-gray-800">{b.units.reduce((a, u) => a + u.rooms.length, 0) > 0 ? fmtMoney(buildingRent(b) / b.units.reduce((a, u) => a + u.rooms.length, 0)) : '—'}</div></div>
							</div>
							<div class="rounded-md border border-gray-200 bg-white">
								<div class="flex items-center justify-between border-b border-gray-100 px-3 py-2">
									<div class="flex items-center gap-2 text-sm font-medium text-gray-800"><Calendar class="h-4 w-4 text-gray-400" /> Monthly performance</div>
									<button on:click={() => openAddPerf(b)} class="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"><Plus class="h-3.5 w-3.5" /> Add month</button>
								</div>
								{#if loadingPerf && !monthlyByBuilding[b.id]}
									<div class="p-3"><Skeleton height="2rem" /></div>
								{:else if (monthlyByBuilding[b.id] || []).length === 0}
									<div class="px-3 py-4 text-center text-xs text-gray-500">No monthly data yet.</div>
								{:else}
									<table class="w-full text-xs">
										<thead class="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
											<tr>
												<th class="px-3 py-1.5">Period</th>
												<th class="px-3 py-1.5 text-right">Occupancy</th>
												<th class="px-3 py-1.5 text-right">ADR</th>
												<th class="px-3 py-1.5 text-right">RevPAR</th>
												<th class="px-3 py-1.5 text-right">Revenue</th>
												<th class="px-3 py-1.5"></th>
											</tr>
										</thead>
										<tbody class="divide-y divide-gray-100">
											{#each monthlyByBuilding[b.id] as row (row.id)}
												<tr>
													<td class="px-3 py-1.5 font-medium text-gray-800">{MONTH_NAMES[row.period_month - 1]} {row.period_year}</td>
													<td class="px-3 py-1.5 text-right">{fmtPct(row.occupancy_pct)}</td>
													<td class="px-3 py-1.5 text-right">{row.adr != null ? fmtMoney(row.adr) : '—'}</td>
													<td class="px-3 py-1.5 text-right">{row.revpar != null ? fmtMoney(row.revpar) : '—'}</td>
													<td class="px-3 py-1.5 text-right">{row.revenue != null ? fmtMoney(row.revenue) : '—'}</td>
													<td class="px-3 py-1.5 text-right">
														<Dropdown align="right">
															<button slot="trigger" class="text-gray-400 hover:text-gray-600" aria-label="Row"><MoreHorizontal class="h-4 w-4" /></button>
															<button on:click={() => openEditPerf(row)} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"><Pencil class="h-4 w-4 text-gray-400" /> Edit</button>
															<button on:click={() => (confirmDeletePerf = row)} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 class="h-4 w-4" /> Delete</button>
														</Dropdown>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								{/if}
							</div>
						</div>
					{/if}

					{#if expandedBuildings.has(b.id)}
						<div transition:fade={{ duration: 150 }} class="divide-y divide-gray-100">
							{#if b.units.length === 0}
								<div class="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-gray-500">
									<p>No units yet.</p>
									<button on:click={() => openAddUnit(b)} class="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-teal-700 hover:bg-teal-50"><Plus class="h-3.5 w-3.5" /> Add first unit</button>
								</div>
							{/if}
							{#each b.units as u (u.id)}
								<div class="bg-gray-50/30">
									<div class="flex items-center justify-between px-4 py-2">
										<button on:click={() => toggleUnit(u.id)} class="flex flex-1 items-center gap-2 text-left">
											{#if expandedUnits.has(u.id)}<ChevronDown class="h-3.5 w-3.5 text-gray-400" />{:else}<ChevronRight class="h-3.5 w-3.5 text-gray-400" />{/if}
											<Layers class="h-4 w-4 text-purple-500" />
											<span class="font-medium text-gray-800">Apartment {u.name}</span>
											{#if u.unit_type}<span class="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] text-purple-700">{u.unit_type}</span>{/if}
											<span class="text-xs text-gray-500">{u.rooms.length} room{u.rooms.length === 1 ? '' : 's'}</span>
											{#if unitRent(u) > 0}<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">{fmtMoney(unitRent(u))}/mo</span>{/if}
										</button>
										<Dropdown align="right">
											<button slot="trigger" class="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50" aria-label="Unit actions"><MoreHorizontal class="h-3.5 w-3.5" /></button>
											<button on:click={() => openAddRoom(b, u)} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"><Plus class="h-4 w-4 text-gray-400" /> Add room</button>
											<button on:click={() => openEditUnit(b, u)} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"><Pencil class="h-4 w-4 text-gray-400" /> Edit unit</button>
											<div class="my-1 border-t border-gray-100"></div>
											<button on:click={() => (confirmDeleteUnit = { building: b, unit: u })} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 class="h-4 w-4" /> Delete unit</button>
										</Dropdown>
									</div>
									{#if expandedUnits.has(u.id)}
										<div class="divide-y divide-gray-100 border-t border-gray-100 bg-white">
											{#if u.rooms.length === 0}
												<div class="flex items-center justify-center gap-2 px-4 py-3 text-xs text-gray-500">
													<span>No rooms.</span>
													<button on:click={() => openAddRoom(b, u)} class="text-teal-600 hover:text-teal-700">Add one</button>
												</div>
											{/if}
											{#each u.rooms as r (r.id)}
												<div class="group border-l-2 border-transparent px-4 py-3 hover:border-l-teal-400 hover:bg-teal-50/20">
													<!-- Top row: identity + LTR/STR + actions -->
													<div class="flex flex-wrap items-center gap-2">
														<div class="flex items-center gap-2">
															<Bed class="h-3.5 w-3.5 text-teal-500" />
															<span class="font-semibold text-gray-900">Room {r.name}</span>
														</div>
														{#if compareMode}
															{@const tag = roomCompareTag.get(r.id)}
															{#if tag === 'A' || tag === 'AB'}<span class="rounded px-1.5 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-700">A</span>{/if}
															{#if tag === 'B' || tag === 'AB'}<span class="rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700">B</span>{/if}
															{#if !tag}<span class="text-[10px] italic text-gray-300">neither</span>{/if}
														{/if}
														{#if r.length}
															<button
																on:click={() => flipLength(r)}
																disabled={busyIds.has(r.id)}
																class="rounded-full px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-80"
																class:bg-teal-100={r.length === 'LTR'}
																class:text-teal-800={r.length === 'LTR'}
																class:bg-orange-100={r.length === 'STR'}
																class:text-orange-800={r.length === 'STR'}
																title="Click to flip"
															>{r.length}</button>
														{:else}
															<button
																on:click={() => flipLength({ ...r, length: 'STR' } as Room)}
																class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 hover:bg-gray-200"
																title="Set length"
															>set length</button>
														{/if}
														{#if r.strategy}<span class="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">{r.strategy}</span>{/if}
														{#if r.is_ada}<span class="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700"><Accessibility class="h-3 w-3" /> ADA</span>{/if}
														<div class="ml-auto flex items-center gap-2">
															{#if rentOf(r) > 0}
																<span class="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
																	<DollarSign class="h-3 w-3" />{fmtMoney(rentOf(r))}<span class="text-[10px] font-normal opacity-80">/mo</span>
																</span>
															{/if}
															{#if r.financials?.revenue_year}
																<span class="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700" title="Last year revenue">
																	{fmtMoney(r.financials.revenue_year, { compact: true })}<span class="text-[10px] font-normal opacity-80">/yr</span>
																</span>
															{/if}
															<Dropdown align="right">
																<button slot="trigger" class="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50" aria-label="Room actions"><MoreHorizontal class="h-3.5 w-3.5" /></button>
																<button on:click={() => openEditRoom(b, u, r)} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"><Pencil class="h-4 w-4 text-gray-400" /> Edit room</button>
																<div class="my-1 border-t border-gray-100"></div>
																<button on:click={() => (confirmDeleteRoom = { building: b, unit: u, room: r })} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 class="h-4 w-4" /> Delete room</button>
															</Dropdown>
														</div>
													</div>

													<!-- Spec strip -->
													<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
														{#if r.beds != null || r.baths != null}<span class="font-semibold text-blue-700">{r.beds != null ? r.beds : '?'} bd / {r.baths != null ? r.baths : '?'} ba</span>{/if}
														{#if r.bed_size}<span><span class="text-gray-400">Bed size:</span> <span class="font-medium text-gray-800">{r.bed_size}</span></span>{/if}
														{#if r.bathroom}<span><span class="text-gray-400">Bath type:</span> <span class="font-medium text-gray-800">{r.bathroom}</span></span>{/if}
														{#if r.sqft}<span><span class="text-gray-400">Sqft:</span> <span class="font-medium text-gray-800">{r.sqft} ft²</span></span>{/if}
														{#if r.balcony && r.balcony.toLowerCase() !== 'no balcony'}<span><span class="text-gray-400">Balcony:</span> <span class="font-medium text-gray-800">{r.balcony}</span></span>{/if}
														{#if r.ceiling_height}<span><span class="text-gray-400">Ceiling:</span> <span class="font-medium text-gray-800">{r.ceiling_height}</span></span>{/if}
														{#if r.room_type_name}<span><span class="text-gray-400">Type:</span> <span class="font-medium text-indigo-700">{r.room_type_name}</span></span>{/if}
														{#if r.listing_date}<span><span class="text-gray-400">Listed:</span> <span class="font-medium text-gray-800">{r.listing_date}</span></span>{/if}
													</div>

													<!-- Amenities (always all of them) -->
													{#if r.amenity_ids.length > 0}
														<div class="mt-2 flex flex-wrap gap-1">
															{#each r.amenity_ids as aid}
																<span class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">{nameOfAmenity(aid)}</span>
															{/each}
														</div>
													{/if}

													<!-- Financials (always all populated values) -->
													{#if r.financials}
														{@const fin = r.financials}
														{@const moneyEntries = [
															['Actual rent', fin.actual_rent],
															['Base rent', fin.base_rent],
															['Market rent', fin.market_rent],
															['Actual + util', fin.actual_rent_with_util],
															['Pessimistic', fin.pessimistic_rent],
															['Concession', fin.concession_rent],
															['Concession + util', fin.concession_rent_with_util],
															['Adjustment', fin.adjustment],
															['Stake 5%', fin.stake_5_cashback],
															['Stake 8%', fin.stake_8_cashback],
															['Revenue / mo', fin.revenue_month],
															['Revenue / yr', fin.revenue_year],
															['Rev / apt', fin.revenue_per_apartment]
														].filter(([, v]) => v != null)}
														{#if moneyEntries.length > 0}
															<div class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 rounded-md border border-emerald-100 bg-emerald-50/30 px-2 py-1.5 text-[11px]">
																{#each moneyEntries as [label, val]}
																	<span class="inline-flex items-baseline gap-1">
																		<span class="text-emerald-700/70">{label}:</span>
																		<span class="font-semibold text-gray-900">{fmtMoney(val as number)}</span>
																	</span>
																{/each}
															</div>
														{/if}
														{#if fin.extras}
															<div class="mt-1.5 text-[11px] text-gray-600"><span class="text-gray-400">Extras:</span> <span class="font-medium text-gray-800">{fin.extras}</span></div>
														{/if}
													{/if}

													{#if r.notes}
														<div class="mt-1.5 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700"><span class="text-gray-400">Notes:</span> {r.notes}</div>
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/each}
		</div>
	{/if}
</div>

<!-- Drawer for investor cards -->
{#if drawerBuilding}
	<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 flex items-stretch justify-end bg-gray-900/40" on:click={() => (drawerBuilding = null)} role="dialog" aria-modal="true">
		<div on:click|stopPropagation class="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
			<div class="flex items-start justify-between">
				<div>
					<h2 class="text-xl font-semibold text-gray-900">{drawerBuilding.full_name || drawerBuilding.name}</h2>
					{#if drawerBuilding.address}<p class="text-sm text-gray-500">{drawerBuilding.address}</p>{/if}
				</div>
				<button on:click={() => (drawerBuilding = null)} class="text-gray-400 hover:text-gray-600"><X class="h-5 w-5" /></button>
			</div>
			{#if drawerBuilding.photos && drawerBuilding.photos.length > 0}
				<div class="mt-3 grid grid-cols-2 gap-2">
					{#each drawerBuilding.photos.slice(0, 4) as p}
						<img src={p} alt="" class="aspect-[4/3] w-full rounded-lg object-cover" />
					{/each}
				</div>
			{/if}
			{#if drawerBuilding.description}<p class="mt-4 text-sm text-gray-700">{drawerBuilding.description}</p>{/if}
			<div class="mt-4 grid grid-cols-3 gap-3 text-sm">
				<div class="rounded-md bg-gray-50 p-3"><div class="text-[10px] uppercase tracking-wide text-gray-500">Units</div><div class="text-lg font-semibold text-gray-900">{drawerBuilding.units.length}</div></div>
				<div class="rounded-md bg-gray-50 p-3"><div class="text-[10px] uppercase tracking-wide text-gray-500">Monthly rent</div><div class="text-lg font-semibold text-emerald-700">{fmtMoney(buildingRent(drawerBuilding))}</div></div>
				<div class="rounded-md bg-gray-50 p-3"><div class="text-[10px] uppercase tracking-wide text-gray-500">Last yr revenue</div><div class="text-lg font-semibold text-indigo-700">{fmtMoney(buildingAnnualRevenue(drawerBuilding))}</div></div>
			</div>
			<h3 class="mt-6 mb-2 text-sm font-semibold text-gray-700">Apartments</h3>
			<div class="space-y-2">
				{#each drawerBuilding.units as u (u.id)}
					<div class="rounded-lg border border-gray-100 p-3">
						<div class="flex items-center justify-between text-sm font-medium text-gray-800">
							<span>{u.name}{u.unit_type ? ' · ' + u.unit_type : ''}</span>
							{#if unitRent(u) > 0}<span class="text-xs text-emerald-700">{fmtMoney(unitRent(u))}/mo</span>{/if}
						</div>
						<div class="mt-2 grid grid-cols-2 gap-1 text-xs">
							{#each u.rooms as r}
								<div class="flex items-center gap-1.5 rounded bg-gray-50 px-2 py-1">
									<span class="font-medium text-gray-700">{r.name}</span>
									{#if r.length}<span class="rounded-full bg-white px-1.5 py-0 text-[10px] {r.length === 'LTR' ? 'text-teal-700' : 'text-orange-700'}">{r.length}</span>{/if}
									{#if rentOf(r) > 0}<span class="ml-auto text-emerald-700">{fmtMoney(rentOf(r))}</span>{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<!-- Owner-only modals -->
{#if isOwner}
	<!-- Building modal -->
	{#if showAddBuilding}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" on:click={() => (showAddBuilding = false)} role="dialog" aria-modal="true">
			<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
				<header class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
					<h3 class="text-lg font-semibold">{buildingDraft.id ? 'Edit building' : 'Add building'}</h3>
					<button on:click={() => (showAddBuilding = false)} class="text-gray-400 hover:text-gray-600"><X class="h-5 w-5" /></button>
				</header>
				<div class="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto px-5 py-4">
					<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Name</span><input bind:value={buildingDraft.name} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
					<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Full name</span><input bind:value={buildingDraft.full_name} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
					<label class="col-span-2 block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Address</span><input bind:value={buildingDraft.address} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
					<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Owner LLC</span><input bind:value={buildingDraft.owner_llc} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
					<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Floors</span><input type="number" bind:value={buildingDraft.floors} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
					<label class="col-span-2 inline-flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={buildingDraft.has_elevator} class="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" /><span class="text-gray-700">Has elevator</span></label>
					<label class="col-span-2 block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Description</span><textarea bind:value={buildingDraft.description} rows="3" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"></textarea></label>
					<label class="col-span-2 block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Photo URLs (comma- or newline-separated)</span><textarea bind:value={buildingPhotosCsv} rows="2" placeholder="https://… , https://…" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono"></textarea></label>
					<div class="col-span-2">
						<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Building amenities</div>
						<div class="flex flex-wrap gap-1">
							{#each amenities as a}
								<button type="button" on:click={() => (buildingAmenitySet = toggleSet(buildingAmenitySet, a.id))} class="rounded-md border px-2 py-1 text-xs transition" class:border-teal-500={buildingAmenitySet.has(a.id)} class:bg-teal-50={buildingAmenitySet.has(a.id)} class:text-teal-700={buildingAmenitySet.has(a.id)} class:border-gray-200={!buildingAmenitySet.has(a.id)} class:text-gray-600={!buildingAmenitySet.has(a.id)}>{a.name}</button>
							{/each}
						</div>
					</div>
				</div>
				<footer class="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
					<button on:click={() => (showAddBuilding = false)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
					<button on:click={saveBuilding} disabled={buildingSaving} class="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">{#if buildingSaving}<Spinner size="sm" color="white" /> Saving…{:else}<Save class="h-4 w-4" /> Save{/if}</button>
				</footer>
			</div>
		</div>
	{/if}

	<!-- Unit modal -->
	{#if showUnitModal}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" on:click={() => (showUnitModal = null)} role="dialog" aria-modal="true">
			<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
				<header class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
					<h3 class="text-lg font-semibold">{showUnitModal.kind === 'edit' ? 'Edit unit' : 'Add unit'}</h3>
					<button on:click={() => (showUnitModal = null)} class="text-gray-400 hover:text-gray-600"><X class="h-5 w-5" /></button>
				</header>
				<div class="space-y-3 px-5 py-4">
					<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Apartment name</span><input bind:value={unitDraft.name} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
					<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Unit type (e.g. Studio, 2-bed)</span><input bind:value={unitDraft.unit_type} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
					{#if amenities.length > 0}
						<div>
							<div class="mb-1 text-xs font-medium text-gray-600">Apartment amenities</div>
							<div class="flex flex-wrap gap-1.5">
								{#each amenities as a}
									<button type="button" on:click={() => (unitAmenitySet = toggleSet(unitAmenitySet, a.id))}
										class="rounded-md border px-2 py-1 text-xs transition"
										class:border-teal-500={unitAmenitySet.has(a.id)}
										class:bg-teal-50={unitAmenitySet.has(a.id)}
										class:text-teal-700={unitAmenitySet.has(a.id)}
										class:border-gray-200={!unitAmenitySet.has(a.id)}
										class:text-gray-600={!unitAmenitySet.has(a.id)}>{a.name}</button>
								{/each}
							</div>
						</div>
					{/if}
					<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Notes</span><textarea bind:value={unitDraft.notes} rows="2" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"></textarea></label>
				</div>
				<footer class="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
					<button on:click={() => (showUnitModal = null)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
					<button on:click={saveUnit} disabled={unitSaving} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">{#if unitSaving}<Spinner size="sm" color="white" /> Saving…{:else}<Save class="h-4 w-4" /> Save{/if}</button>
				</footer>
			</div>
		</div>
	{/if}

	<!-- Room modal -->
	{#if showRoomModal}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" on:click={() => (showRoomModal = null)} role="dialog" aria-modal="true">
			<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
				<header class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
					<h3 class="text-lg font-semibold">{showRoomModal.kind === 'edit' ? 'Edit room' : 'Add room'}</h3>
					<button on:click={() => (showRoomModal = null)} class="text-gray-400 hover:text-gray-600"><X class="h-5 w-5" /></button>
				</header>
				<div class="max-h-[75vh] space-y-4 overflow-y-auto px-5 py-4">
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
						<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Name</span><input bind:value={roomDraft.name} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
						<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Length</span><select bind:value={roomDraft.length} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="">—</option><option value="LTR">LTR</option><option value="STR">STR</option></select></label>
						<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Strategy</span><select bind:value={roomDraft.strategy} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="">—</option><option value="Coliving">Coliving</option><option value="Entire Apt">Entire Apt</option></select></label>
						<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Beds</span><input type="number" min="0" step="1" bind:value={roomDraft.beds} placeholder="e.g. 2" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
						<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Baths</span><input type="number" min="0" step="1" bind:value={roomDraft.baths} placeholder="e.g. 1" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
						<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Bed size</span><input bind:value={roomDraft.bed_size} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
						<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Bathroom type</span><input bind:value={roomDraft.bathroom} placeholder="Private / Shared" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
						<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Ceiling height</span><input bind:value={roomDraft.ceiling_height} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
						<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Balcony</span><input bind:value={roomDraft.balcony} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
						<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Room type</span><input bind:value={roomDraft.room_type_name} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
						<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Sq ft</span><input type="number" min="0" step="1" bind:value={roomDraft.sqft} placeholder="e.g. 280" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
						<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Listing date</span><input type="date" bind:value={roomDraft.listing_date} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
					</div>
					<label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={roomDraft.is_ada} class="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" /><span class="text-gray-700">ADA accessible</span></label>

					<div class="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
						<div class="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-900"><DollarSign class="h-4 w-4" /> Financials</div>
						<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
							{#each [
								['actual_rent', 'Actual rent / mo'], ['base_rent', 'Base rent / mo'], ['market_rent', 'Market rent / mo'],
								['actual_rent_with_util', 'Actual + util'], ['pessimistic_rent', 'Pessimistic'], ['concession_rent', 'Concession'],
								['concession_rent_with_util', 'Concession + util'], ['adjustment', 'Adjustment'],
								['stake_5_cashback', 'Stake 5%'], ['stake_8_cashback', 'Stake 8%'],
								['revenue_month', 'Revenue / mo'], ['revenue_year', 'Revenue / yr'], ['revenue_per_apartment', 'Rev / apt']
							] as [field, label]}
								<label class="block text-sm">
									<span class="mb-1 block text-xs font-medium text-gray-600">{label}</span>
									<input type="number" min="0" step="1" bind:value={roomDraft[field]} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
								</label>
							{/each}
						</div>
						<label class="mt-2 block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Extras</span><input bind:value={roomDraft.extras} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
					</div>

					<div>
						<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Amenities</div>
						<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
							{#each amenities as a}
								<label class="flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs" class:border-teal-500={roomDraftAmenities.has(a.id)} class:bg-teal-50={roomDraftAmenities.has(a.id)} class:border-gray-200={!roomDraftAmenities.has(a.id)}>
									<input type="checkbox" checked={roomDraftAmenities.has(a.id)} on:change={() => toggleRoomAmenity(a.id)} class="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
									<span class="truncate">{a.name}</span>
								</label>
							{/each}
						</div>
						<div class="mt-2 flex gap-2">
							<input type="text" bind:value={customAmenityDraft} on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAmenity())} placeholder="Add custom amenity (e.g. Hot tub)" class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
							<button on:click={addCustomAmenity} disabled={!customAmenityDraft.trim()} class="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-sm text-white hover:bg-teal-700 disabled:opacity-50"><Plus class="h-4 w-4" /> Add</button>
						</div>
					</div>

					<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Notes</span><textarea bind:value={roomDraft.notes} rows="2" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"></textarea></label>
				</div>
				<footer class="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
					<button on:click={() => (showRoomModal = null)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
					<button on:click={saveRoom} disabled={roomSaving} class="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">{#if roomSaving}<Spinner size="sm" color="white" /> Saving…{:else}<Save class="h-4 w-4" /> Save{/if}</button>
				</footer>
			</div>
		</div>
	{/if}

	<!-- Confirms -->
	{#if confirmDeleteBuilding}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" on:click={() => (confirmDeleteBuilding = null)} role="dialog" aria-modal="true">
			<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
				<div class="px-5 py-5">
					<h3 class="text-base font-semibold text-gray-900">Delete building?</h3>
					<p class="mt-1 text-sm text-gray-600"><span class="font-medium">{confirmDeleteBuilding.name}</span> and all its units/rooms will be removed. Cannot be undone.</p>
				</div>
				<div class="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
					<button on:click={() => (confirmDeleteBuilding = null)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
					<button on:click={doDeleteBuilding} disabled={deletingBuilding} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">{#if deletingBuilding}<Spinner size="sm" color="white" /> Deleting…{:else}<Trash2 class="h-4 w-4" /> Delete{/if}</button>
				</div>
			</div>
		</div>
	{/if}
	{#if confirmDeleteUnit}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" on:click={() => (confirmDeleteUnit = null)} role="dialog" aria-modal="true">
			<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
				<div class="px-5 py-5">
					<h3 class="text-base font-semibold text-gray-900">Delete unit?</h3>
					<p class="mt-1 text-sm text-gray-600">Apartment <span class="font-medium">{confirmDeleteUnit.unit.name}</span> in {confirmDeleteUnit.building.name} will be removed.</p>
				</div>
				<div class="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
					<button on:click={() => (confirmDeleteUnit = null)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
					<button on:click={doDeleteUnit} disabled={deletingUnit} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">{#if deletingUnit}<Spinner size="sm" color="white" /> Deleting…{:else}<Trash2 class="h-4 w-4" /> Delete{/if}</button>
				</div>
			</div>
		</div>
	{/if}
	{#if confirmDeleteRoom}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" on:click={() => (confirmDeleteRoom = null)} role="dialog" aria-modal="true">
			<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
				<div class="px-5 py-5">
					<h3 class="text-base font-semibold text-gray-900">Delete room?</h3>
					<p class="mt-1 text-sm text-gray-600">Room <span class="font-medium">{confirmDeleteRoom.room.name}</span> will be removed (financials too).</p>
				</div>
				<div class="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
					<button on:click={() => (confirmDeleteRoom = null)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
					<button on:click={doDeleteRoom} disabled={deletingRoom} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">{#if deletingRoom}<Spinner size="sm" color="white" /> Deleting…{:else}<Trash2 class="h-4 w-4" /> Delete{/if}</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Monthly perf modal + delete -->
	{#if showPerfModal}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" on:click={() => (showPerfModal = false)} role="dialog" aria-modal="true">
			<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
				<header class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
					<h3 class="text-lg font-semibold">{perfDraft.id ? 'Edit month' : 'Add month'}</h3>
					<button on:click={() => (showPerfModal = false)} class="text-gray-400 hover:text-gray-600"><X class="h-5 w-5" /></button>
				</header>
				<div class="grid grid-cols-2 gap-3 px-5 py-4">
					<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Year</span><input type="number" bind:value={perfDraft.period_year} disabled={!!perfDraft.id} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50" /></label>
					<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Month</span><select bind:value={perfDraft.period_month} disabled={!!perfDraft.id} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50">{#each MONTH_NAMES as n, i}<option value={i + 1}>{n}</option>{/each}</select></label>
					<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Occupancy %</span><input type="number" min="0" max="100" step="0.1" bind:value={perfDraft.occupancy_pct} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
					<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">ADR ($)</span><input type="number" min="0" step="0.01" bind:value={perfDraft.adr} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
					<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">RevPAR ($)</span><input type="number" min="0" step="0.01" bind:value={perfDraft.revpar} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
					<label class="block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Revenue ($)</span><input type="number" min="0" step="0.01" bind:value={perfDraft.revenue} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
					<label class="col-span-2 block text-sm"><span class="mb-1 block text-xs font-medium text-gray-600">Notes</span><textarea bind:value={perfDraft.notes} rows="2" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"></textarea></label>
				</div>
				<footer class="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
					<button on:click={() => (showPerfModal = false)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
					<button on:click={savePerf} disabled={perfSaving} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">{#if perfSaving}<Spinner size="sm" color="white" /> Saving…{:else}<Save class="h-4 w-4" /> Save{/if}</button>
				</footer>
			</div>
		</div>
	{/if}
	{#if confirmDeletePerf}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" on:click={() => (confirmDeletePerf = null)} role="dialog" aria-modal="true">
			<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
				<div class="px-5 py-5">
					<h3 class="text-base font-semibold text-gray-900">Delete this month?</h3>
					<p class="mt-1 text-sm text-gray-600">{MONTH_NAMES[confirmDeletePerf.period_month - 1]} {confirmDeletePerf.period_year} will be removed.</p>
				</div>
				<div class="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
					<button on:click={() => (confirmDeletePerf = null)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
					<button on:click={doDeletePerf} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Trash2 class="h-4 w-4" /> Delete</button>
				</div>
			</div>
		</div>
	{/if}
{/if}
