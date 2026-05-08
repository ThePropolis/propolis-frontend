<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { fade, scale } from 'svelte/transition';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { auth, userRole } from '$lib/api/auth';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Dropdown from '$lib/components/ui/Dropdown.svelte';
	import { toast } from '$lib/components/ui/toastStore';
	import {
		Boxes,
		Building2,
		ChevronDown,
		ChevronRight,
		Plus,
		Pencil,
		Trash2,
		MoreHorizontal,
		Save,
		X,
		RefreshCw,
		Bed,
		Bath,
		Layers,
		ArrowUpDown,
		DollarSign,
		Calendar,
		TrendingUp,
		Accessibility,
		Search,
		ListFilter,
		ArrowDown,
		ArrowUp,
		Eye
	} from 'lucide-svelte';

	type Length = 'LTR' | 'STR';
	type Strategy = 'Coliving' | 'Entire Apt';

	type Room = {
		id: string;
		unit_id: string;
		name: string;
		length: Length | null;
		strategy: Strategy | null;
		bed_size: string | null;
		bathroom: string | null;
		ceiling_height: string | null;
		balcony: string | null;
		room_type_name: string | null;
		amenities: string[];
		notes: string | null;
		base_rent: number | null;
		market_rent: number | null;
		actual_rent: number | null;
		revenue_year: number | null;
		revenue_month: number | null;
		is_ada: boolean | null;
		extras: string | null;
		adjustment?: number | null;
		actual_rent_with_util?: number | null;
		pessimistic_rent?: number | null;
		concession_rent?: number | null;
		concession_rent_with_util?: number | null;
		stake_5_cashback?: number | null;
		stake_8_cashback?: number | null;
		revenue_per_apartment?: number | null;
		unit_type?: string | null;
		listing_date?: string | null;
	};
	type Unit = {
		id: string;
		building_id: string;
		name: string;
		notes: string | null;
		rooms: Room[];
	};
	type Building = {
		id: string;
		name: string;
		full_name: string | null;
		address: string | null;
		owner_llc: string | null;
		units_count: number | null;
		beds_count: number | null;
		floors: number | null;
		has_elevator: boolean | null;
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
	let allAmenities: string[] = [];
	let loading = true;
	let busyIds = new Set<string>();
	let expandedBuildings = new Set<string>();
	let expandedUnits = new Set<string>();
	let financialsBuildingId: string | null = null; // building whose monthly panel is open
	let detailsRoomId: string | null = null;        // room whose details are expanded inline

	// ── Filters ───────────────────────────────────────────────────────
	let search = '';
	let lengthFilter: 'all' | 'LTR' | 'STR' | 'unset' = 'all';
	let strategyFilter: 'all' | 'Coliving' | 'Entire Apt' | 'unset' = 'all';
	let bathroomFilter: 'all' | 'Private' | 'Shared' = 'all';
	let bedSizeFilter = new Set<string>();
	let amenityFilter = new Set<string>();
	let buildingFilter = new Set<string>();
	let adaOnly = false;
	let withRentOnly = false;
	let rentMin: number | null = null;
	let rentMax: number | null = null;
	let sortKey: 'name' | 'rent_desc' | 'rent_asc' | 'revenue_desc' = 'name';
	let showFilters = true;

	function clearFilters() {
		search = '';
		lengthFilter = 'all';
		strategyFilter = 'all';
		bathroomFilter = 'all';
		bedSizeFilter = new Set();
		amenityFilter = new Set();
		buildingFilter = new Set();
		adaOnly = false;
		withRentOnly = false;
		rentMin = null;
		rentMax = null;
		sortKey = 'name';
	}

	function toggleSet<T>(s: Set<T>, v: T): Set<T> {
		if (s.has(v)) s.delete(v);
		else s.add(v);
		return s;
	}
	let monthlyByBuilding: Record<string, MonthlyPerf[]> = {};
	let loadingPerf = false;

	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	function fmtMoney(v: number | null | undefined, opts: { compact?: boolean } = {}): string {
		if (v == null || isNaN(v as number)) return '—';
		const n = Number(v);
		if (opts.compact && Math.abs(n) >= 1000) {
			return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
		}
		return new Intl.NumberFormat('en-US', {
			style: 'currency', currency: 'USD', maximumFractionDigits: 0
		}).format(n);
	}
	function fmtPct(v: number | null | undefined): string {
		if (v == null || isNaN(v as number)) return '—';
		return `${Number(v).toFixed(1)}%`;
	}

	$: isOwner = $userRole === 'owner';

	function authHeader() {
		return { Authorization: `Bearer ${get(auth).token}` };
	}

	async function load(silent = false) {
		if (!silent) loading = true;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/inventory`, { headers: authHeader() });
			if (!res.ok) throw new Error(`Failed to load (${res.status})`);
			const data = await res.json();
			buildings = data.buildings || [];
			allAmenities = data.all_amenities || [];
			if (!silent && expandedBuildings.size === 0) {
				expandedBuildings = new Set(buildings.map((b) => b.id));
			}
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			loading = false;
		}
	}

	onMount(load);

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

	// ── Building modals ────────────────────────────────────────────────
	let showBuildingModal = false;
	let buildingDraft: Partial<Building> = {};
	let buildingSaving = false;
	let confirmDeleteBuilding: Building | null = null;

	function openCreateBuilding() {
		buildingDraft = {
			name: '',
			full_name: '',
			address: '',
			owner_llc: '',
			floors: undefined,
			has_elevator: undefined,
			notes: ''
		};
		showBuildingModal = true;
	}
	function openEditBuilding(b: Building) {
		buildingDraft = { ...b };
		showBuildingModal = true;
	}

	async function saveBuilding() {
		if (!buildingDraft.name?.trim()) {
			toast.error('Name is required');
			return;
		}
		buildingSaving = true;
		try {
			const isEdit = !!buildingDraft.id;
			const url = isEdit
				? `${PUBLIC_API_URL}/api/inventory/buildings/${buildingDraft.id}`
				: `${PUBLIC_API_URL}/api/inventory/buildings`;
			const body: any = {
				name: buildingDraft.name?.trim(),
				full_name: buildingDraft.full_name || null,
				address: buildingDraft.address || null,
				owner_llc: buildingDraft.owner_llc || null,
				floors: buildingDraft.floors ?? null,
				has_elevator: buildingDraft.has_elevator ?? null,
				notes: buildingDraft.notes || null
			};
			const res = await fetch(url, {
				method: isEdit ? 'PATCH' : 'POST',
				headers: { ...authHeader(), 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Save failed (${res.status})`);
			}
			toast.success(isEdit ? 'Building updated' : 'Building created');
			showBuildingModal = false;
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			buildingSaving = false;
		}
	}

	async function deleteBuilding() {
		if (!confirmDeleteBuilding) return;
		busyIds.add(confirmDeleteBuilding.id);
		busyIds = busyIds;
		try {
			const res = await fetch(
				`${PUBLIC_API_URL}/api/inventory/buildings/${confirmDeleteBuilding.id}`,
				{ method: 'DELETE', headers: authHeader() }
			);
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Delete failed (${res.status})`);
			}
			toast.success(`${confirmDeleteBuilding.name} deleted`);
			confirmDeleteBuilding = null;
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			busyIds.delete(confirmDeleteBuilding?.id || '');
			busyIds = busyIds;
		}
	}

	// ── Unit modals ────────────────────────────────────────────────────
	let showUnitModal = false;
	let unitDraft: Partial<Unit & { building_id: string }> = {};
	let unitSaving = false;
	let confirmDeleteUnit: { building: Building; unit: Unit } | null = null;

	function openCreateUnit(b: Building) {
		unitDraft = { building_id: b.id, name: '', notes: '' };
		showUnitModal = true;
	}
	function openEditUnit(u: Unit) {
		unitDraft = { ...u };
		showUnitModal = true;
	}

	async function saveUnit() {
		if (!unitDraft.name?.trim()) {
			toast.error('Name is required');
			return;
		}
		unitSaving = true;
		try {
			const isEdit = !!unitDraft.id;
			const url = isEdit
				? `${PUBLIC_API_URL}/api/inventory/units/${unitDraft.id}`
				: `${PUBLIC_API_URL}/api/inventory/units`;
			const body: any = {
				name: unitDraft.name.trim(),
				notes: unitDraft.notes || null
			};
			if (!isEdit) body.building_id = unitDraft.building_id;
			const res = await fetch(url, {
				method: isEdit ? 'PATCH' : 'POST',
				headers: { ...authHeader(), 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Save failed (${res.status})`);
			}
			toast.success(isEdit ? 'Unit updated' : 'Unit created');
			showUnitModal = false;
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			unitSaving = false;
		}
	}

	async function deleteUnit() {
		if (!confirmDeleteUnit) return;
		const id = confirmDeleteUnit.unit.id;
		busyIds.add(id);
		busyIds = busyIds;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/inventory/units/${id}`, {
				method: 'DELETE',
				headers: authHeader()
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Delete failed (${res.status})`);
			}
			toast.success(`Unit ${confirmDeleteUnit.unit.name} deleted`);
			confirmDeleteUnit = null;
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			busyIds.delete(id);
			busyIds = busyIds;
		}
	}

	// ── Room modals ────────────────────────────────────────────────────
	let showRoomModal = false;
	let roomDraft: Partial<Room & { unit_id: string }> = {};
	let roomDraftAmenities = new Set<string>();
	let roomCustomAmenity = '';
	let roomSaving = false;
	let confirmDeleteRoom: { unit: Unit; room: Room } | null = null;

	function openCreateRoom(u: Unit) {
		roomDraft = {
			unit_id: u.id,
			name: '',
			length: null,
			strategy: null,
			bed_size: '',
			bathroom: '',
			ceiling_height: '',
			balcony: '',
			room_type_name: '',
			notes: '',
			actual_rent: null,
			base_rent: null,
			market_rent: null,
			revenue_year: null,
			revenue_month: null,
			is_ada: null,
			extras: ''
		};
		roomDraftAmenities = new Set();
		roomCustomAmenity = '';
		showRoomModal = true;
	}
	function openEditRoom(r: Room) {
		roomDraft = { ...r };
		roomDraftAmenities = new Set(r.amenities || []);
		roomCustomAmenity = '';
		showRoomModal = true;
	}

	function toggleRoomAmenity(a: string) {
		if (roomDraftAmenities.has(a)) roomDraftAmenities.delete(a);
		else roomDraftAmenities.add(a);
		roomDraftAmenities = roomDraftAmenities;
	}

	function addRoomCustomAmenity() {
		const name = roomCustomAmenity.trim();
		if (!name) return;
		const existing = allAmenities.find((a) => a.toLowerCase() === name.toLowerCase());
		const value = existing ?? name;
		if (!allAmenities.includes(value)) {
			allAmenities = [...allAmenities, value].sort();
		}
		roomDraftAmenities.add(value);
		roomDraftAmenities = roomDraftAmenities;
		roomCustomAmenity = '';
	}

	async function saveRoom() {
		if (!roomDraft.name?.trim()) {
			toast.error('Name is required');
			return;
		}
		roomSaving = true;
		try {
			const isEdit = !!roomDraft.id;
			const url = isEdit
				? `${PUBLIC_API_URL}/api/inventory/rooms/${roomDraft.id}`
				: `${PUBLIC_API_URL}/api/inventory/rooms`;
			const body: any = {
				name: roomDraft.name.trim(),
				length: roomDraft.length || null,
				strategy: roomDraft.strategy || null,
				bed_size: roomDraft.bed_size || null,
				bathroom: roomDraft.bathroom || null,
				ceiling_height: roomDraft.ceiling_height || null,
				balcony: roomDraft.balcony || null,
				room_type_name: roomDraft.room_type_name || null,
				amenities: Array.from(roomDraftAmenities).sort(),
				notes: roomDraft.notes || null,
				actual_rent: roomDraft.actual_rent ?? null,
				base_rent: roomDraft.base_rent ?? null,
				market_rent: roomDraft.market_rent ?? null,
				revenue_year: roomDraft.revenue_year ?? null,
				revenue_month: roomDraft.revenue_month ?? null,
				is_ada: roomDraft.is_ada ?? null,
				extras: roomDraft.extras || null
			};
			if (!isEdit) body.unit_id = roomDraft.unit_id;
			const res = await fetch(url, {
				method: isEdit ? 'PATCH' : 'POST',
				headers: { ...authHeader(), 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Save failed (${res.status})`);
			}
			toast.success(isEdit ? 'Room updated' : 'Room created');
			showRoomModal = false;
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			roomSaving = false;
		}
	}

	async function deleteRoom() {
		if (!confirmDeleteRoom) return;
		const id = confirmDeleteRoom.room.id;
		busyIds.add(id);
		busyIds = busyIds;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/inventory/rooms/${id}`, {
				method: 'DELETE',
				headers: authHeader()
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Delete failed (${res.status})`);
			}
			toast.success(`Room ${confirmDeleteRoom.room.name} deleted`);
			confirmDeleteRoom = null;
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			busyIds.delete(id);
			busyIds = busyIds;
		}
	}

	// One-click LTR/STR flip — no modal, since the client said this changes often
	async function flipLength(room: Room) {
		const next: Length = room.length === 'STR' ? 'LTR' : 'STR';
		busyIds.add(room.id);
		busyIds = busyIds;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/inventory/rooms/${room.id}`, {
				method: 'PATCH',
				headers: { ...authHeader(), 'Content-Type': 'application/json' },
				body: JSON.stringify({ length: next })
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Save failed (${res.status})`);
			}
			// Optimistic update
			room.length = next;
			buildings = buildings;
			toast.success(`${room.name} is now ${next}`);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			busyIds.delete(room.id);
			busyIds = busyIds;
		}
	}

	function rentOf(r: Room): number {
		return Number(r.actual_rent ?? r.base_rent ?? 0) || 0;
	}

	function roomMatches(r: Room): boolean {
		// Length filter
		if (lengthFilter !== 'all') {
			if (lengthFilter === 'unset') {
				if (r.length) return false;
			} else if (r.length !== lengthFilter) return false;
		}
		// Strategy filter
		if (strategyFilter !== 'all') {
			if (strategyFilter === 'unset') {
				if (r.strategy) return false;
			} else if (r.strategy !== strategyFilter) return false;
		}
		if (bathroomFilter !== 'all' && r.bathroom !== bathroomFilter) return false;
		if (bedSizeFilter.size > 0 && (!r.bed_size || !bedSizeFilter.has(r.bed_size))) return false;
		if (amenityFilter.size > 0) {
			for (const a of amenityFilter) if (!r.amenities.includes(a)) return false;
		}
		if (adaOnly && !r.is_ada) return false;
		const rent = rentOf(r);
		if (withRentOnly && rent <= 0) return false;
		// Coerce explicitly — number inputs sometimes hand us strings, and
		// "3000" > 2500 is a string compare in JS.
		const minN = rentMin == null || rentMin === ('' as any) ? null : Number(rentMin);
		const maxN = rentMax == null || rentMax === ('' as any) ? null : Number(rentMax);
		if (minN != null && !isNaN(minN) && rent < minN) return false;
		if (maxN != null && !isNaN(maxN) && rent > maxN) return false;
		// Search hits room name, amenities, room_type, extras
		if (search.trim()) {
			const q = search.trim().toLowerCase();
			const blob = [
				r.name, r.room_type_name, r.extras, r.bed_size, r.bathroom, r.balcony,
				...(r.amenities || [])
			].filter(Boolean).join(' ').toLowerCase();
			if (!blob.includes(q)) return false;
		}
		return true;
	}

	function buildingMatchesByName(b: Building): boolean {
		if (!search.trim()) return true;
		const q = search.trim().toLowerCase();
		return (
			b.name.toLowerCase().includes(q) ||
			(b.full_name || '').toLowerCase().includes(q) ||
			(b.address || '').toLowerCase().includes(q)
		);
	}

	$: bedSizeOptions = Array.from(
		new Set(
			buildings.flatMap((b) => b.units.flatMap((u) => u.rooms.map((r) => r.bed_size).filter(Boolean)))
		)
	).sort() as string[];

	$: hasAnyFilter =
		!!search.trim() ||
		lengthFilter !== 'all' ||
		strategyFilter !== 'all' ||
		bathroomFilter !== 'all' ||
		bedSizeFilter.size > 0 ||
		amenityFilter.size > 0 ||
		buildingFilter.size > 0 ||
		adaOnly ||
		withRentOnly ||
		rentMin != null ||
		rentMax != null;

	$: filteredBuildings = buildings
		.filter((b) => buildingFilter.size === 0 || buildingFilter.has(b.id))
		.map((b) => {
			const sb = buildingMatchesByName(b);
			return {
				...b,
				units: b.units
					.map((u) => ({
						...u,
						// Sort rooms by selected key
						rooms: [...u.rooms]
							.filter(roomMatches)
							.sort((a, c) => {
								if (sortKey === 'rent_desc') return rentOf(c) - rentOf(a);
								if (sortKey === 'rent_asc') return rentOf(a) - rentOf(c);
								if (sortKey === 'revenue_desc')
									return Number(c.revenue_year || 0) - Number(a.revenue_year || 0);
								return (a.name || '').localeCompare(c.name || '');
							})
					}))
					.filter((u) => sb || u.rooms.length > 0)
			};
		})
		.filter((b) => {
			if (hasAnyFilter) {
				if (b.units.some((u) => u.rooms.length > 0)) return true;
				return buildingMatchesByName(b);
			}
			return true;
		});
	function unitMonthlyRent(u: Unit): number {
		return u.rooms.reduce((a, r) => a + rentOf(r), 0);
	}
	function buildingMonthlyRent(b: Building): number {
		return b.units.reduce((a, u) => a + unitMonthlyRent(u), 0);
	}
	function buildingAnnualRevenue(b: Building): number {
		return b.units.reduce((a, u) => a + u.rooms.reduce((aa, r) => aa + (Number(r.revenue_year) || 0), 0), 0);
	}

	// Totals reflect the *filtered* set so the cards mirror what's on screen
	$: totals = {
		buildings: filteredBuildings.length,
		units: filteredBuildings.reduce((acc, b) => acc + b.units.length, 0),
		rooms: filteredBuildings.reduce((acc, b) => acc + b.units.reduce((a2, u) => a2 + u.rooms.length, 0), 0),
		ltr: filteredBuildings.reduce(
			(acc, b) => acc + b.units.reduce((a2, u) => a2 + u.rooms.filter((r) => r.length === 'LTR').length, 0),
			0
		),
		str: filteredBuildings.reduce(
			(acc, b) => acc + b.units.reduce((a2, u) => a2 + u.rooms.filter((r) => r.length === 'STR').length, 0),
			0
		),
		monthlyRent: filteredBuildings.reduce(
			(acc, b) => acc + b.units.reduce((a2, u) => a2 + u.rooms.reduce((aa, r) => aa + rentOf(r), 0), 0),
			0
		),
		annualRevenue: filteredBuildings.reduce(
			(acc, b) =>
				acc + b.units.reduce((a2, u) => a2 + u.rooms.reduce((aa, r) => aa + (Number(r.revenue_year) || 0), 0), 0),
			0
		)
	};

	// ── Monthly performance ───────────────────────────────────────────
	let perfDraft: Partial<MonthlyPerf> & { building_id?: string } = {};
	let showPerfModal = false;
	let perfSaving = false;
	let confirmDeletePerf: MonthlyPerf | null = null;

	async function loadMonthly(buildingId: string) {
		loadingPerf = true;
		try {
			const res = await fetch(
				`${PUBLIC_API_URL}/api/inventory/monthly-performance?building_id=${buildingId}`,
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
			period_month: now.getMonth() + 1,
			occupancy_pct: undefined,
			adr: undefined,
			revpar: undefined,
			revenue: undefined,
			notes: ''
		};
		showPerfModal = true;
	}
	function openEditPerf(row: MonthlyPerf) {
		perfDraft = { ...row };
		showPerfModal = true;
	}

	async function savePerf() {
		if (!perfDraft.period_year || !perfDraft.period_month) {
			toast.error('Year and month are required');
			return;
		}
		perfSaving = true;
		try {
			const isEdit = !!perfDraft.id;
			const url = isEdit
				? `${PUBLIC_API_URL}/api/inventory/monthly-performance/${perfDraft.id}`
				: `${PUBLIC_API_URL}/api/inventory/monthly-performance`;
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
			const res = await fetch(url, {
				method: isEdit ? 'PATCH' : 'POST',
				headers: { ...authHeader(), 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Save failed (${res.status})`);
			}
			toast.success(isEdit ? 'Updated' : 'Added');
			showPerfModal = false;
			if (perfDraft.building_id) await loadMonthly(perfDraft.building_id);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			perfSaving = false;
		}
	}

	async function deletePerf() {
		if (!confirmDeletePerf) return;
		try {
			const res = await fetch(
				`${PUBLIC_API_URL}/api/inventory/monthly-performance/${confirmDeletePerf.id}`,
				{ method: 'DELETE', headers: authHeader() }
			);
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Delete failed (${res.status})`);
			}
			const bid = confirmDeletePerf.building_id;
			confirmDeletePerf = null;
			toast.success('Deleted');
			await loadMonthly(bid);
		} catch (e: any) {
			toast.error(e.message);
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<div class="flex items-center gap-3">
			<div class="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50">
				<Boxes class="h-6 w-6 text-teal-600" />
			</div>
			<div>
				<h1 class="text-2xl font-semibold text-gray-900">Inventory</h1>
				<p class="text-sm text-gray-500">
					Buildings, units, and rooms — the canonical record. Everything editable here.
				</p>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<button
				on:click={() => load()}
				disabled={loading}
				class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
			>
				<RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" /> Refresh
			</button>
			{#if isOwner}
				<button
					on:click={openCreateBuilding}
					class="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
				>
					<Plus class="h-4 w-4" /> Add building
				</button>
			{/if}
		</div>
	</div>

	<!-- Stat cards -->
	<div class="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
		{#each [
			{ label: 'Buildings',  value: totals.buildings, icon: Building2, tint: 'bg-blue-50 text-blue-700',     fmt: 'n' },
			{ label: 'Units',      value: totals.units,     icon: Layers,    tint: 'bg-purple-50 text-purple-700', fmt: 'n' },
			{ label: 'Rooms',      value: totals.rooms,     icon: Bed,       tint: 'bg-amber-50 text-amber-700',   fmt: 'n' },
			{ label: 'LTR rooms',  value: totals.ltr,       icon: ArrowUpDown, tint: 'bg-teal-50 text-teal-700',   fmt: 'n' },
			{ label: 'STR rooms',  value: totals.str,       icon: ArrowUpDown, tint: 'bg-orange-50 text-orange-700', fmt: 'n' },
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
		<div class="flex flex-col gap-3 md:flex-row md:items-center">
			<div class="relative flex-1">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
				<input
					type="text"
					bind:value={search}
					placeholder="Search building, unit, room, amenity, type…"
					class="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
				/>
				{#if search}
					<button
						on:click={() => (search = '')}
						class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
						aria-label="Clear"
					>
						<X class="h-4 w-4" />
					</button>
				{/if}
			</div>

			<button
				on:click={() => (showFilters = !showFilters)}
				class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
			>
				<ListFilter class="h-4 w-4" />
				{showFilters ? 'Hide' : 'Show'} filters
				{#if hasAnyFilter}
					<span class="ml-1 rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-medium text-white">on</span>
				{/if}
			</button>

			<select bind:value={sortKey} class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
				<option value="name">Sort: Name (A→Z)</option>
				<option value="rent_desc">Sort: Rent (high → low)</option>
				<option value="rent_asc">Sort: Rent (low → high)</option>
				<option value="revenue_desc">Sort: Revenue (high → low)</option>
			</select>

			{#if hasAnyFilter}
				<button
					on:click={clearFilters}
					class="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
				>
					<X class="h-3.5 w-3.5" /> Clear all
				</button>
			{/if}
		</div>

		{#if showFilters}
			<div class="mt-3 grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 md:grid-cols-2 lg:grid-cols-4">
				<!-- Length -->
				<div>
					<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Length</div>
					<div class="flex flex-wrap gap-1">
						{#each ['all', 'LTR', 'STR', 'unset'] as const as v}
							<button
								on:click={() => (lengthFilter = v)}
								class="rounded-md border px-2 py-1 text-xs font-medium capitalize transition"
								class:border-teal-500={lengthFilter === v}
								class:bg-teal-50={lengthFilter === v}
								class:text-teal-700={lengthFilter === v}
								class:border-gray-200={lengthFilter !== v}
								class:text-gray-600={lengthFilter !== v}
								class:hover:bg-gray-50={lengthFilter !== v}
							>{v === 'unset' ? 'unset' : v}</button>
						{/each}
					</div>
				</div>

				<!-- Strategy -->
				<div>
					<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Strategy</div>
					<div class="flex flex-wrap gap-1">
						{#each ['all', 'Coliving', 'Entire Apt', 'unset'] as const as v}
							<button
								on:click={() => (strategyFilter = v)}
								class="rounded-md border px-2 py-1 text-xs font-medium transition"
								class:border-teal-500={strategyFilter === v}
								class:bg-teal-50={strategyFilter === v}
								class:text-teal-700={strategyFilter === v}
								class:border-gray-200={strategyFilter !== v}
								class:text-gray-600={strategyFilter !== v}
								class:hover:bg-gray-50={strategyFilter !== v}
							>{v}</button>
						{/each}
					</div>
				</div>

				<!-- Bathroom -->
				<div>
					<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Bathroom</div>
					<div class="flex flex-wrap gap-1">
						{#each ['all', 'Private', 'Shared'] as const as v}
							<button
								on:click={() => (bathroomFilter = v)}
								class="rounded-md border px-2 py-1 text-xs font-medium transition"
								class:border-teal-500={bathroomFilter === v}
								class:bg-teal-50={bathroomFilter === v}
								class:text-teal-700={bathroomFilter === v}
								class:border-gray-200={bathroomFilter !== v}
								class:text-gray-600={bathroomFilter !== v}
								class:hover:bg-gray-50={bathroomFilter !== v}
							>{v}</button>
						{/each}
					</div>
				</div>

				<!-- Toggles -->
				<div>
					<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Quick toggles</div>
					<div class="flex flex-wrap gap-3">
						<label class="inline-flex items-center gap-2 text-sm">
							<input type="checkbox" bind:checked={adaOnly} class="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
							<span class="text-gray-700">ADA only</span>
						</label>
						<label class="inline-flex items-center gap-2 text-sm">
							<input type="checkbox" bind:checked={withRentOnly} class="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
							<span class="text-gray-700">Has rent</span>
						</label>
					</div>
				</div>

				<!-- Bed sizes -->
				{#if bedSizeOptions.length > 0}
					<div class="md:col-span-2">
						<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Bed size</div>
						<div class="flex flex-wrap gap-1">
							{#each bedSizeOptions as bs}
								<button
									on:click={() => (bedSizeFilter = toggleSet(bedSizeFilter, bs))}
									class="rounded-md border px-2 py-1 text-xs transition"
									class:border-teal-500={bedSizeFilter.has(bs)}
									class:bg-teal-50={bedSizeFilter.has(bs)}
									class:text-teal-700={bedSizeFilter.has(bs)}
									class:border-gray-200={!bedSizeFilter.has(bs)}
									class:text-gray-600={!bedSizeFilter.has(bs)}
									class:hover:bg-gray-50={!bedSizeFilter.has(bs)}
								>{bs}</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Rent range -->
				<div>
					<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Rent range ($/mo)</div>
					<div class="flex items-center gap-2">
						<input type="number" min="0" step="50" bind:value={rentMin} placeholder="Min" class="w-24 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
						<span class="text-gray-400">—</span>
						<input type="number" min="0" step="50" bind:value={rentMax} placeholder="Max" class="w-24 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
					</div>
				</div>

				<!-- Buildings -->
				{#if buildings.length > 1}
					<div class="md:col-span-2 lg:col-span-3">
						<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Buildings</div>
						<div class="flex flex-wrap gap-1">
							{#each buildings as b}
								<button
									on:click={() => (buildingFilter = toggleSet(buildingFilter, b.id))}
									class="rounded-md border px-2 py-1 text-xs transition"
									class:border-teal-500={buildingFilter.has(b.id)}
									class:bg-teal-50={buildingFilter.has(b.id)}
									class:text-teal-700={buildingFilter.has(b.id)}
									class:border-gray-200={!buildingFilter.has(b.id)}
									class:text-gray-600={!buildingFilter.has(b.id)}
									class:hover:bg-gray-50={!buildingFilter.has(b.id)}
								>{b.name}</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Amenities -->
				{#if allAmenities.length > 0}
					<div class="md:col-span-2 lg:col-span-4">
						<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Has amenities (all)</div>
						<div class="flex flex-wrap gap-1">
							{#each allAmenities as a}
								<button
									on:click={() => (amenityFilter = toggleSet(amenityFilter, a))}
									class="rounded-md border px-2 py-1 text-xs transition"
									class:border-teal-500={amenityFilter.has(a)}
									class:bg-teal-50={amenityFilter.has(a)}
									class:text-teal-700={amenityFilter.has(a)}
									class:border-gray-200={!amenityFilter.has(a)}
									class:text-gray-600={!amenityFilter.has(a)}
									class:hover:bg-gray-50={!amenityFilter.has(a)}
								>{a}</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</section>

	<!-- Filter results counter -->
	{#if !loading}
		<div class="flex items-center justify-between text-xs text-gray-500">
			<div>
				{#if hasAnyFilter}
					<span class="font-medium text-gray-700">{totals.rooms}</span>
					of
					<span class="font-medium text-gray-700">{buildings.reduce((a, b) => a + b.units.reduce((aa, u) => aa + u.rooms.length, 0), 0)}</span>
					rooms match · {totals.buildings} of {buildings.length} buildings
				{:else}
					Showing all {totals.rooms} rooms across {totals.buildings} buildings
				{/if}
			</div>
			{#if hasAnyFilter}
				<button on:click={clearFilters} class="font-medium text-teal-600 hover:text-teal-700">Clear filters</button>
			{/if}
		</div>
	{/if}

	<!-- Tree -->
	{#if loading}
		{#each Array(3) as _}
			<section class="overflow-hidden rounded-lg border border-gray-200 bg-white">
				<div class="border-b border-gray-100 bg-gray-50 px-4 py-3">
					<Skeleton height="1.25rem" width="14rem" />
				</div>
				<div class="space-y-4 p-4">
					{#each Array(3) as _}
						<Skeleton height="2rem" />
					{/each}
				</div>
			</section>
		{/each}
	{:else if buildings.length === 0}
		<div
			class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center"
		>
			<Boxes class="h-10 w-10 text-gray-300" />
			<p class="font-medium text-gray-700">No inventory yet</p>
			<p class="max-w-md text-sm text-gray-500">
				Run the one-time XLSX import on the backend to seed the initial data, or add a building
				manually.
			</p>
			{#if isOwner}
				<button
					on:click={openCreateBuilding}
					class="mt-2 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
				>
					<Plus class="h-4 w-4" /> Add building
				</button>
			{/if}
		</div>
	{:else}
		{#each filteredBuildings as b (b.id)}
			<section class="overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:shadow-sm">
				<div class="flex items-stretch border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
					<button
						on:click={() => toggleBuilding(b.id)}
						class="flex flex-1 items-center justify-between px-4 py-3 text-left"
					>
						<div class="flex items-center gap-3">
							{#if expandedBuildings.has(b.id)}
								<ChevronDown class="h-4 w-4 text-gray-400" />
							{:else}
								<ChevronRight class="h-4 w-4 text-gray-400" />
							{/if}
							<Building2 class="h-5 w-5 text-teal-600" />
							<div>
								<h2 class="font-semibold text-gray-900">{b.name}</h2>
								<div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
									{#if b.address}<span>{b.address}</span>{/if}
									{#if b.owner_llc}<span>· {b.owner_llc}</span>{/if}
									{#if b.floors != null}<span>· {b.floors} floor{b.floors === 1 ? '' : 's'}</span>{/if}
									{#if b.has_elevator != null}
										<span>· Elevator: {b.has_elevator ? 'Yes' : 'No'}</span>
									{/if}
								</div>
							</div>
						</div>
						<div class="flex flex-col items-end gap-0.5">
							<span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
								{b.units.length} unit{b.units.length === 1 ? '' : 's'}
							</span>
							{#if buildingMonthlyRent(b) > 0}
								<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
									<DollarSign class="h-3 w-3" /> {fmtMoney(buildingMonthlyRent(b), { compact: true })}/mo
								</span>
							{/if}
						</div>
					</button>
					<div class="flex items-center pr-2">
						<button
							on:click={() => toggleFinancials(b)}
							class="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
							title="Financials"
						>
							<TrendingUp class="h-3.5 w-3.5" /> Financials
						</button>
					</div>
					{#if isOwner}
						<div class="flex items-center pr-3">
							<Dropdown align="right">
								<button
									slot="trigger"
									class="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
									aria-label="Building actions"
								>
									<MoreHorizontal class="h-4 w-4" />
								</button>
								<button
									on:click={() => openCreateUnit(b)}
									class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
								>
									<Plus class="h-4 w-4 text-gray-400" /> Add unit
								</button>
								<button
									on:click={() => openEditBuilding(b)}
									class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
								>
									<Pencil class="h-4 w-4 text-gray-400" /> Edit building
								</button>
								<div class="my-1 border-t border-gray-100"></div>
								<button
									on:click={() => (confirmDeleteBuilding = b)}
									class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
								>
									<Trash2 class="h-4 w-4" /> Delete building
								</button>
							</Dropdown>
						</div>
					{/if}
				</div>

				{#if financialsBuildingId === b.id}
					<div transition:fade={{ duration: 150 }} class="border-b border-gray-100 bg-gradient-to-br from-emerald-50/40 to-white p-4">
						<div class="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
							<div class="rounded-md border border-gray-200 bg-white p-2.5">
								<div class="text-[10px] uppercase tracking-wide text-gray-500">Monthly rent</div>
								<div class="text-lg font-semibold text-emerald-700">{fmtMoney(buildingMonthlyRent(b))}</div>
							</div>
							<div class="rounded-md border border-gray-200 bg-white p-2.5">
								<div class="text-[10px] uppercase tracking-wide text-gray-500">Annualized rent</div>
								<div class="text-lg font-semibold text-emerald-700">{fmtMoney(buildingMonthlyRent(b) * 12)}</div>
							</div>
							<div class="rounded-md border border-gray-200 bg-white p-2.5">
								<div class="text-[10px] uppercase tracking-wide text-gray-500">Last-yr revenue</div>
								<div class="text-lg font-semibold text-indigo-700">{fmtMoney(buildingAnnualRevenue(b))}</div>
							</div>
							<div class="rounded-md border border-gray-200 bg-white p-2.5">
								<div class="text-[10px] uppercase tracking-wide text-gray-500">Avg / room</div>
								<div class="text-lg font-semibold text-gray-800">
									{b.units.reduce((a, u) => a + u.rooms.length, 0) > 0
										? fmtMoney(buildingMonthlyRent(b) / b.units.reduce((a, u) => a + u.rooms.length, 0))
										: '—'}
								</div>
							</div>
						</div>

						<!-- Monthly performance table -->
						<div class="rounded-md border border-gray-200 bg-white">
							<div class="flex items-center justify-between border-b border-gray-100 px-3 py-2">
								<div class="flex items-center gap-2 text-sm font-medium text-gray-800">
									<Calendar class="h-4 w-4 text-gray-400" /> Monthly performance
								</div>
								{#if isOwner}
									<button
										on:click={() => openAddPerf(b)}
										class="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
									>
										<Plus class="h-3.5 w-3.5" /> Add month
									</button>
								{/if}
							</div>
							{#if loadingPerf && !monthlyByBuilding[b.id]}
								<div class="p-3"><Skeleton height="2rem" /></div>
							{:else if (monthlyByBuilding[b.id] || []).length === 0}
								<div class="px-3 py-4 text-center text-xs text-gray-500">
									No monthly data yet. {#if isOwner}Click <strong>Add month</strong>.{/if}
								</div>
							{:else}
								<div class="overflow-x-auto">
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
													<td class="px-3 py-1.5 font-medium text-gray-800">
														{MONTH_NAMES[row.period_month - 1]} {row.period_year}
													</td>
													<td class="px-3 py-1.5 text-right">{fmtPct(row.occupancy_pct)}</td>
													<td class="px-3 py-1.5 text-right">{row.adr != null ? fmtMoney(row.adr) : '—'}</td>
													<td class="px-3 py-1.5 text-right">{row.revpar != null ? fmtMoney(row.revpar) : '—'}</td>
													<td class="px-3 py-1.5 text-right">{row.revenue != null ? fmtMoney(row.revenue) : '—'}</td>
													<td class="px-3 py-1.5 text-right">
														{#if isOwner}
															<Dropdown align="right">
																<button slot="trigger" class="text-gray-400 hover:text-gray-600" aria-label="Row actions">
																	<MoreHorizontal class="h-4 w-4" />
																</button>
																<button on:click={() => openEditPerf(row)} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
																	<Pencil class="h-4 w-4 text-gray-400" /> Edit
																</button>
																<button on:click={() => (confirmDeletePerf = row)} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
																	<Trash2 class="h-4 w-4" /> Delete
																</button>
															</Dropdown>
														{/if}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				{#if expandedBuildings.has(b.id)}
					<div transition:fade={{ duration: 150 }} class="divide-y divide-gray-100">
						{#if b.units.length === 0}
							<div class="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-gray-500">
								<p>No units in this building yet.</p>
								{#if isOwner}
									<button
										on:click={() => openCreateUnit(b)}
										class="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-teal-700 hover:bg-teal-50"
									>
										<Plus class="h-3.5 w-3.5" /> Add first unit
									</button>
								{/if}
							</div>
						{/if}

						{#each b.units as u (u.id)}
							<div>
								<div class="flex items-stretch">
									<button
										on:click={() => toggleUnit(u.id)}
										class="flex flex-1 items-center justify-between px-6 py-2.5 text-left hover:bg-gray-50"
									>
										<div class="flex items-center gap-3">
											{#if expandedUnits.has(u.id)}
												<ChevronDown class="h-3.5 w-3.5 text-gray-400" />
											{:else}
												<ChevronRight class="h-3.5 w-3.5 text-gray-400" />
											{/if}
											<Layers class="h-4 w-4 text-purple-500" />
											<span class="font-medium text-gray-800">Apartment {u.name}</span>
											<span class="text-xs text-gray-500">
												{u.rooms.length} room{u.rooms.length === 1 ? '' : 's'}
											</span>
											{#if unitMonthlyRent(u) > 0}
												<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
													{fmtMoney(unitMonthlyRent(u))}/mo
												</span>
											{/if}
										</div>
									</button>
									{#if isOwner}
										<div class="flex items-center pr-4">
											<Dropdown align="right">
												<button
													slot="trigger"
													class="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
													aria-label="Unit actions"
												>
													<MoreHorizontal class="h-3.5 w-3.5" />
												</button>
												<button
													on:click={() => openCreateRoom(u)}
													class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
												>
													<Plus class="h-4 w-4 text-gray-400" /> Add room
												</button>
												<button
													on:click={() => openEditUnit(u)}
													class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
												>
													<Pencil class="h-4 w-4 text-gray-400" /> Rename unit
												</button>
												<div class="my-1 border-t border-gray-100"></div>
												<button
													on:click={() => (confirmDeleteUnit = { building: b, unit: u })}
													class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
												>
													<Trash2 class="h-4 w-4" /> Delete unit
												</button>
											</Dropdown>
										</div>
									{/if}
								</div>

								{#if expandedUnits.has(u.id)}
									<div transition:fade={{ duration: 120 }} class="bg-gray-50/40">
										{#if u.rooms.length === 0}
											<div class="flex flex-col items-center gap-2 px-4 py-4 text-center text-sm text-gray-500">
												<p class="text-xs">No rooms yet.</p>
												{#if isOwner}
													<button
														on:click={() => openCreateRoom(u)}
														class="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-teal-700 hover:bg-teal-50"
													>
														<Plus class="h-3.5 w-3.5" /> Add first room
													</button>
												{/if}
											</div>
										{/if}
										{#each u.rooms as r (r.id)}
											<div class="group flex flex-col gap-2 border-t border-gray-100 px-10 py-2 md:flex-row md:items-center">
												<div class="flex w-32 shrink-0 items-center gap-2">
													<Bed class="h-3.5 w-3.5 text-gray-400" />
													<span class="font-medium text-gray-800">{r.name}</span>
												</div>
												<div class="flex flex-1 flex-wrap items-center gap-1.5 text-xs">
													{#if isOwner}
														<button
															on:click={() => flipLength(r)}
															disabled={busyIds.has(r.id)}
															class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium transition disabled:opacity-60"
															class:border-teal-300={r.length === 'LTR'}
															class:bg-teal-50={r.length === 'LTR'}
															class:text-teal-800={r.length === 'LTR'}
															class:border-orange-300={r.length === 'STR'}
															class:bg-orange-50={r.length === 'STR'}
															class:text-orange-800={r.length === 'STR'}
															class:border-gray-200={!r.length}
															class:text-gray-500={!r.length}
															title="Click to flip"
														>
															{r.length || '—'}
															<ArrowUpDown class="h-3 w-3 opacity-60" />
														</button>
													{:else}
														<span
															class="inline-flex items-center rounded-full border px-2 py-0.5 font-medium"
															class:border-teal-300={r.length === 'LTR'}
															class:bg-teal-50={r.length === 'LTR'}
															class:text-teal-800={r.length === 'LTR'}
															class:border-orange-300={r.length === 'STR'}
															class:bg-orange-50={r.length === 'STR'}
															class:text-orange-800={r.length === 'STR'}
															class:border-gray-200={!r.length}
															class:text-gray-500={!r.length}
														>
															{r.length || '—'}
														</span>
													{/if}
													{#if r.strategy}
														<span class="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-gray-700">{r.strategy}</span>
													{/if}
													{#if r.bed_size}
														<span class="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-gray-700">{r.bed_size}</span>
													{/if}
													{#if r.bathroom}
														<span class="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-gray-700">
															<Bath class="h-3 w-3" /> {r.bathroom}
														</span>
													{/if}
													{#if r.balcony && r.balcony.toLowerCase() !== 'no balcony'}
														<span class="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-gray-700">{r.balcony}</span>
													{/if}
													{#if r.room_type_name}
														<span class="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-800">{r.room_type_name}</span>
													{/if}
													{#if r.actual_rent || r.base_rent}
														<span class="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700" title="Monthly rent (actual / base)">
															<DollarSign class="h-3 w-3" />{fmtMoney(rentOf(r))}/mo
														</span>
													{/if}
													{#if r.revenue_year}
														<span class="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700" title="Last-year revenue">
															{fmtMoney(r.revenue_year, { compact: true })}/yr
														</span>
													{/if}
													{#if r.is_ada}
														<span class="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700" title="ADA accessible">
															<Accessibility class="h-3 w-3" /> ADA
														</span>
													{/if}
													{#each r.amenities as a}
														<span class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{a}</span>
													{/each}
												</div>
												<button
													on:click={() => (detailsRoomId = detailsRoomId === r.id ? null : r.id)}
													class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
													title="Show all details"
													aria-label="Show all details"
												>
													<Eye class="h-3.5 w-3.5" />
												</button>
												{#if isOwner}
													<div class="shrink-0 md:opacity-0 md:transition md:group-hover:opacity-100">
														<Dropdown align="right">
															<button
																slot="trigger"
																class="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
																aria-label="Room actions"
															>
																<MoreHorizontal class="h-3.5 w-3.5" />
															</button>
															<button
																on:click={() => openEditRoom(r)}
																class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
															>
																<Pencil class="h-4 w-4 text-gray-400" /> Edit room
															</button>
															<div class="my-1 border-t border-gray-100"></div>
															<button
																on:click={() => (confirmDeleteRoom = { unit: u, room: r })}
																class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
															>
																<Trash2 class="h-4 w-4" /> Delete room
															</button>
														</Dropdown>
													</div>
												{/if}
											</div>
											{#if detailsRoomId === r.id}
												<div transition:fade={{ duration: 120 }} class="border-t border-gray-100 bg-white px-10 py-3 text-xs">
													<div class="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
														{#each [
															['Listing date', r.listing_date],
															['Unit type', r.unit_type],
															['Length', r.length],
															['Strategy', r.strategy],
															['Bed size', r.bed_size],
															['Bathroom', r.bathroom],
															['Ceiling', r.ceiling_height],
															['Balcony', r.balcony],
															['Room type', r.room_type_name],
															['ADA', r.is_ada == null ? null : (r.is_ada ? 'Yes' : 'No')],
															['Extras', r.extras]
														] as [label, val]}
															{#if val != null && val !== ''}
																<div>
																	<div class="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
																	<div class="text-gray-800">{val}</div>
																</div>
															{/if}
														{/each}
													</div>

													<div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-emerald-100 bg-emerald-50/40 p-2 sm:grid-cols-3 lg:grid-cols-4">
														{#each [
															['Actual rent / mo', r.actual_rent],
															['Base rent / mo', r.base_rent],
															['Market rent / mo', r.market_rent],
															['Actual rent + util', r.actual_rent_with_util],
															['Pessimistic + util', r.pessimistic_rent],
															['Concession (13mo)', r.concession_rent],
															['Concession + util', r.concession_rent_with_util],
															['Adjustment', r.adjustment],
															['Stake 5% cashback', r.stake_5_cashback],
															['Stake 8% cashback', r.stake_8_cashback],
															['Revenue / mo', r.revenue_month],
															['Revenue / year', r.revenue_year],
															['Rev / apartment', r.revenue_per_apartment]
														] as [label, val]}
															{#if val != null}
																<div>
																	<div class="text-[10px] uppercase tracking-wide text-emerald-700/80">{label}</div>
																	<div class="font-medium text-gray-900">{fmtMoney(val as number)}</div>
																</div>
															{/if}
														{/each}
													</div>

													{#if r.notes}
														<div class="mt-3 rounded border border-gray-200 bg-gray-50 p-2 text-gray-700">
															<div class="text-[10px] uppercase tracking-wide text-gray-500">Notes</div>
															<div>{r.notes}</div>
														</div>
													{/if}
												</div>
											{/if}
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/each}
	{/if}
</div>

<!-- Building modal -->
{#if isOwner && showBuildingModal}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
		on:click={() => (showBuildingModal = false)}
		role="dialog"
		aria-modal="true"
	>
		<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
			<header class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50">
						<Building2 class="h-4 w-4 text-teal-600" />
					</div>
					<h3 class="text-lg font-semibold text-gray-900">{buildingDraft.id ? 'Edit building' : 'Add building'}</h3>
				</div>
				<button on:click={() => (showBuildingModal = false)} class="text-gray-400 hover:text-gray-600" aria-label="Close"><X class="h-5 w-5" /></button>
			</header>
			<div class="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-gray-700">Name</span>
					<input bind:value={buildingDraft.name} placeholder="e.g. Aerie" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
				</label>
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-gray-700">Full name</span>
					<input bind:value={buildingDraft.full_name} placeholder="e.g. Aerie Apartments" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
				</label>
				<label class="block text-sm sm:col-span-2">
					<span class="mb-1 block font-medium text-gray-700">Address</span>
					<input bind:value={buildingDraft.address} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
				</label>
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-gray-700">Owner LLC</span>
					<input bind:value={buildingDraft.owner_llc} placeholder="e.g. NW 121 LLC" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
				</label>
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-gray-700">Floors</span>
					<input type="number" min="0" max="50" bind:value={buildingDraft.floors} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
				</label>
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={buildingDraft.has_elevator} class="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
					<span class="text-gray-700">Has elevator</span>
				</label>
				<label class="block text-sm sm:col-span-2">
					<span class="mb-1 block font-medium text-gray-700">Notes</span>
					<textarea bind:value={buildingDraft.notes} rows="2" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"></textarea>
				</label>
			</div>
			<footer class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (showBuildingModal = false)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button on:click={saveBuilding} disabled={buildingSaving} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
					{#if buildingSaving}<Spinner size="sm" color="white" /> Saving…{:else}<Save class="h-4 w-4" /> Save{/if}
				</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Unit modal -->
{#if isOwner && showUnitModal}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
		on:click={() => (showUnitModal = false)}
		role="dialog"
		aria-modal="true"
	>
		<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
			<header class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50">
						<Layers class="h-4 w-4 text-teal-600" />
					</div>
					<h3 class="text-lg font-semibold text-gray-900">{unitDraft.id ? 'Rename unit' : 'Add unit'}</h3>
				</div>
				<button on:click={() => (showUnitModal = false)} class="text-gray-400 hover:text-gray-600" aria-label="Close"><X class="h-5 w-5" /></button>
			</header>
			<div class="space-y-3 px-5 py-4">
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-gray-700">Apartment number</span>
					<input bind:value={unitDraft.name} placeholder="e.g. 11" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
				</label>
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-gray-700">Notes</span>
					<textarea bind:value={unitDraft.notes} rows="2" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"></textarea>
				</label>
			</div>
			<footer class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (showUnitModal = false)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button on:click={saveUnit} disabled={unitSaving} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
					{#if unitSaving}<Spinner size="sm" color="white" /> Saving…{:else}<Save class="h-4 w-4" /> Save{/if}
				</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Room modal -->
{#if isOwner && showRoomModal}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
		on:click={() => (showRoomModal = false)}
		role="dialog"
		aria-modal="true"
	>
		<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
			<header class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50">
						<Bed class="h-4 w-4 text-teal-600" />
					</div>
					<h3 class="text-lg font-semibold text-gray-900">{roomDraft.id ? 'Edit room' : 'Add room'}</h3>
				</div>
				<button on:click={() => (showRoomModal = false)} class="text-gray-400 hover:text-gray-600" aria-label="Close"><X class="h-5 w-5" /></button>
			</header>
			<div class="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<label class="block text-sm">
						<span class="mb-1 block font-medium text-gray-700">Room name</span>
						<input bind:value={roomDraft.name} placeholder="e.g. 11A" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
					</label>
					<label class="block text-sm">
						<span class="mb-1 block font-medium text-gray-700">Room type name</span>
						<input bind:value={roomDraft.room_type_name} placeholder="e.g. Standard, Deluxe" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
					</label>
					<div>
						<span class="mb-1 block text-sm font-medium text-gray-700">Length</span>
						<div class="grid grid-cols-3 gap-1.5">
							{#each [['LTR', 'Long term'], ['STR', 'Short term']] as const as [v, label]}
								<button
									type="button"
									on:click={() => (roomDraft.length = v)}
									class="rounded-lg border px-2 py-2 text-xs font-medium transition"
									class:border-teal-500={roomDraft.length === v}
									class:bg-teal-50={roomDraft.length === v}
									class:text-teal-700={roomDraft.length === v}
									class:border-gray-200={roomDraft.length !== v}
									class:text-gray-600={roomDraft.length !== v}
								>{label}</button>
							{/each}
							<button
								type="button"
								on:click={() => (roomDraft.length = null)}
								class="rounded-lg border px-2 py-2 text-xs font-medium transition"
								class:border-teal-500={!roomDraft.length}
								class:bg-teal-50={!roomDraft.length}
								class:text-teal-700={!roomDraft.length}
								class:border-gray-200={!!roomDraft.length}
								class:text-gray-600={!!roomDraft.length}
							>Unset</button>
						</div>
					</div>
					<div>
						<span class="mb-1 block text-sm font-medium text-gray-700">Strategy</span>
						<div class="grid grid-cols-3 gap-1.5">
							{#each [['Coliving', 'Coliving'], ['Entire Apt', 'Entire Apt']] as const as [v, label]}
								<button
									type="button"
									on:click={() => (roomDraft.strategy = v)}
									class="rounded-lg border px-2 py-2 text-xs font-medium transition"
									class:border-teal-500={roomDraft.strategy === v}
									class:bg-teal-50={roomDraft.strategy === v}
									class:text-teal-700={roomDraft.strategy === v}
									class:border-gray-200={roomDraft.strategy !== v}
									class:text-gray-600={roomDraft.strategy !== v}
								>{label}</button>
							{/each}
							<button
								type="button"
								on:click={() => (roomDraft.strategy = null)}
								class="rounded-lg border px-2 py-2 text-xs font-medium transition"
								class:border-teal-500={!roomDraft.strategy}
								class:bg-teal-50={!roomDraft.strategy}
								class:text-teal-700={!roomDraft.strategy}
								class:border-gray-200={!!roomDraft.strategy}
								class:text-gray-600={!!roomDraft.strategy}
							>Unset</button>
						</div>
					</div>
					<label class="block text-sm">
						<span class="mb-1 block font-medium text-gray-700">Bed size</span>
						<input bind:value={roomDraft.bed_size} placeholder="Queen, Full, Twin, Studio" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
					</label>
					<label class="block text-sm">
						<span class="mb-1 block font-medium text-gray-700">Bathroom</span>
						<input bind:value={roomDraft.bathroom} placeholder="Private, Shared" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
					</label>
					<label class="block text-sm">
						<span class="mb-1 block font-medium text-gray-700">Ceiling height</span>
						<input bind:value={roomDraft.ceiling_height} placeholder="Average, Extra High" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
					</label>
					<label class="block text-sm">
						<span class="mb-1 block font-medium text-gray-700">Balcony</span>
						<input bind:value={roomDraft.balcony} placeholder="No Balcony, Personal Balcony, Shared" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
					</label>
				</div>

				<div class="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
					<div class="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-900">
						<DollarSign class="h-4 w-4" /> Financials
					</div>
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
						<label class="block text-sm">
							<span class="mb-1 block text-xs font-medium text-gray-600">Actual rent / mo</span>
							<input type="number" min="0" step="1" bind:value={roomDraft.actual_rent} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
						</label>
						<label class="block text-sm">
							<span class="mb-1 block text-xs font-medium text-gray-600">Base rent / mo</span>
							<input type="number" min="0" step="1" bind:value={roomDraft.base_rent} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
						</label>
						<label class="block text-sm">
							<span class="mb-1 block text-xs font-medium text-gray-600">Market rent / mo</span>
							<input type="number" min="0" step="1" bind:value={roomDraft.market_rent} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
						</label>
						<label class="block text-sm">
							<span class="mb-1 block text-xs font-medium text-gray-600">Revenue / mo</span>
							<input type="number" min="0" step="1" bind:value={roomDraft.revenue_month} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
						</label>
						<label class="block text-sm sm:col-span-2">
							<span class="mb-1 block text-xs font-medium text-gray-600">Revenue / year (last)</span>
							<input type="number" min="0" step="1" bind:value={roomDraft.revenue_year} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
						</label>
					</div>
					<div class="mt-2 flex items-center gap-3">
						<label class="flex items-center gap-2 text-sm">
							<input type="checkbox" bind:checked={roomDraft.is_ada} class="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
							<span class="text-gray-700">ADA accessible</span>
						</label>
					</div>
					<label class="mt-2 block text-sm">
						<span class="mb-1 block text-xs font-medium text-gray-600">Extras</span>
						<input bind:value={roomDraft.extras} placeholder="e.g. Shared Backyard" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
					</label>
				</div>

				<div>
					<span class="mb-1 block text-sm font-medium text-gray-700">Amenities</span>
					{#if allAmenities.length > 0}
						<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
							{#each allAmenities as a}
								<label
									class="flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition"
									class:border-teal-500={roomDraftAmenities.has(a)}
									class:bg-teal-50={roomDraftAmenities.has(a)}
									class:text-teal-800={roomDraftAmenities.has(a)}
									class:border-gray-200={!roomDraftAmenities.has(a)}
									class:text-gray-700={!roomDraftAmenities.has(a)}
									class:hover:bg-gray-50={!roomDraftAmenities.has(a)}
								>
									<input
										type="checkbox"
										checked={roomDraftAmenities.has(a)}
										on:change={() => toggleRoomAmenity(a)}
										class="h-3.5 w-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
									/>
									<span class="truncate">{a}</span>
								</label>
							{/each}
						</div>
					{/if}
					<div class="mt-2 flex gap-2">
						<input
							type="text"
							bind:value={roomCustomAmenity}
							on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addRoomCustomAmenity())}
							placeholder="Add custom amenity (e.g. Hot tub)"
							class="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
						/>
						<button
							type="button"
							on:click={addRoomCustomAmenity}
							disabled={!roomCustomAmenity.trim()}
							class="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
						>
							<Plus class="h-3.5 w-3.5" /> Add
						</button>
					</div>
				</div>

				<label class="block text-sm">
					<span class="mb-1 block font-medium text-gray-700">Notes</span>
					<textarea bind:value={roomDraft.notes} rows="2" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"></textarea>
				</label>
			</div>
			<footer class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (showRoomModal = false)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button on:click={saveRoom} disabled={roomSaving} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
					{#if roomSaving}<Spinner size="sm" color="white" /> Saving…{:else}<Save class="h-4 w-4" /> Save{/if}
				</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Confirm delete dialogs -->
{#if confirmDeleteBuilding}
	<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" on:click={() => (confirmDeleteBuilding = null)} role="dialog" aria-modal="true">
		<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
			<div class="px-5 py-5">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50"><Trash2 class="h-5 w-5 text-red-600" /></div>
					<div>
						<h3 class="text-base font-semibold text-gray-900">Delete building?</h3>
						<p class="mt-1 text-sm text-gray-600">
							<span class="font-medium text-gray-800">{confirmDeleteBuilding.name}</span> and all {confirmDeleteBuilding.units.length} unit{confirmDeleteBuilding.units.length === 1 ? '' : 's'} (and their rooms) will be removed. This cannot be undone.
						</p>
					</div>
				</div>
			</div>
			<div class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (confirmDeleteBuilding = null)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button on:click={deleteBuilding} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
					<Trash2 class="h-4 w-4" /> Delete
				</button>
			</div>
		</div>
	</div>
{/if}

{#if confirmDeleteUnit}
	<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" on:click={() => (confirmDeleteUnit = null)} role="dialog" aria-modal="true">
		<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
			<div class="px-5 py-5">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50"><Trash2 class="h-5 w-5 text-red-600" /></div>
					<div>
						<h3 class="text-base font-semibold text-gray-900">Delete unit?</h3>
						<p class="mt-1 text-sm text-gray-600">
							Apartment <span class="font-medium text-gray-800">{confirmDeleteUnit.unit.name}</span> in <span class="font-medium text-gray-800">{confirmDeleteUnit.building.name}</span> and all {confirmDeleteUnit.unit.rooms.length} room{confirmDeleteUnit.unit.rooms.length === 1 ? '' : 's'} inside will be removed.
						</p>
					</div>
				</div>
			</div>
			<div class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (confirmDeleteUnit = null)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button on:click={deleteUnit} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
					<Trash2 class="h-4 w-4" /> Delete
				</button>
			</div>
		</div>
	</div>
{/if}

{#if confirmDeleteRoom}
	<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" on:click={() => (confirmDeleteRoom = null)} role="dialog" aria-modal="true">
		<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
			<div class="px-5 py-5">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50"><Trash2 class="h-5 w-5 text-red-600" /></div>
					<div>
						<h3 class="text-base font-semibold text-gray-900">Delete room?</h3>
						<p class="mt-1 text-sm text-gray-600">
							Room <span class="font-medium text-gray-800">{confirmDeleteRoom.room.name}</span> will be removed.
						</p>
					</div>
				</div>
			</div>
			<div class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (confirmDeleteRoom = null)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button on:click={deleteRoom} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
					<Trash2 class="h-4 w-4" /> Delete
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Monthly performance modal -->
{#if isOwner && showPerfModal}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
		on:click={() => (showPerfModal = false)}
		role="dialog"
		aria-modal="true"
	>
		<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
			<header class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50">
						<Calendar class="h-4 w-4 text-teal-600" />
					</div>
					<h3 class="text-lg font-semibold text-gray-900">{perfDraft.id ? 'Edit month' : 'Add month'}</h3>
				</div>
				<button on:click={() => (showPerfModal = false)} class="text-gray-400 hover:text-gray-600" aria-label="Close"><X class="h-5 w-5" /></button>
			</header>
			<div class="grid grid-cols-2 gap-3 px-5 py-4">
				<label class="block text-sm">
					<span class="mb-1 block text-xs font-medium text-gray-600">Year</span>
					<input type="number" min="2000" max="2100" bind:value={perfDraft.period_year} disabled={!!perfDraft.id} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-gray-50" />
				</label>
				<label class="block text-sm">
					<span class="mb-1 block text-xs font-medium text-gray-600">Month</span>
					<select bind:value={perfDraft.period_month} disabled={!!perfDraft.id} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-gray-50">
						{#each MONTH_NAMES as name, i}
							<option value={i + 1}>{name}</option>
						{/each}
					</select>
				</label>
				<label class="block text-sm">
					<span class="mb-1 block text-xs font-medium text-gray-600">Occupancy %</span>
					<input type="number" min="0" max="100" step="0.1" bind:value={perfDraft.occupancy_pct} placeholder="0–100" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
				</label>
				<label class="block text-sm">
					<span class="mb-1 block text-xs font-medium text-gray-600">ADR ($)</span>
					<input type="number" min="0" step="0.01" bind:value={perfDraft.adr} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
				</label>
				<label class="block text-sm">
					<span class="mb-1 block text-xs font-medium text-gray-600">RevPAR ($)</span>
					<input type="number" min="0" step="0.01" bind:value={perfDraft.revpar} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
				</label>
				<label class="block text-sm">
					<span class="mb-1 block text-xs font-medium text-gray-600">Revenue ($)</span>
					<input type="number" min="0" step="0.01" bind:value={perfDraft.revenue} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
				</label>
				<label class="col-span-2 block text-sm">
					<span class="mb-1 block text-xs font-medium text-gray-600">Notes</span>
					<textarea bind:value={perfDraft.notes} rows="2" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"></textarea>
				</label>
			</div>
			<footer class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (showPerfModal = false)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button on:click={savePerf} disabled={perfSaving} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
					{#if perfSaving}<Spinner size="sm" color="white" /> Saving…{:else}<Save class="h-4 w-4" /> Save{/if}
				</button>
			</footer>
		</div>
	</div>
{/if}

{#if confirmDeletePerf}
	<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" on:click={() => (confirmDeletePerf = null)} role="dialog" aria-modal="true">
		<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
			<div class="px-5 py-5">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50"><Trash2 class="h-5 w-5 text-red-600" /></div>
					<div>
						<h3 class="text-base font-semibold text-gray-900">Delete this month?</h3>
						<p class="mt-1 text-sm text-gray-600">
							{MONTH_NAMES[confirmDeletePerf.period_month - 1]} {confirmDeletePerf.period_year} will be removed.
						</p>
					</div>
				</div>
			</div>
			<div class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (confirmDeletePerf = null)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button on:click={deletePerf} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
					<Trash2 class="h-4 w-4" /> Delete
				</button>
			</div>
		</div>
	</div>
{/if}
