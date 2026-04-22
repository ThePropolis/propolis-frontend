<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { fade, scale } from 'svelte/transition';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { auth, userRole } from '$lib/api/auth';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { toast } from '$lib/components/ui/toastStore';
	import {
		Search,
		Wrench,
		Building2,
		X,
		RefreshCw,
		ChevronDown,
		ChevronRight,
		LayoutGrid,
		ListFilter,
		Bed,
		Bath,
		Package,
		Pencil,
		Save,
		Info,
		Plus,
		MoreHorizontal,
		Trash2,
		Download
	} from 'lucide-svelte';
	import Dropdown from '$lib/components/ui/Dropdown.svelte';

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

	let loading = true;
	let error: string | null = null;
	let properties: Property[] = [];
	let allAmenities: string[] = [];
	let search = '';
	let selectedAmenities = new Set<string>();
	let expandedProps = new Set<string>();
	let amenityFilterOpen = false;

	// Edit-amenities modal state
	let editTarget: { prop: Property; unit: Unit } | null = null;
	let editDraft = new Set<string>();
	// Per-modal list of options. Starts from the global vocabulary, but users
	// can append custom amenities and they appear immediately in the grid.
	let editOptions: string[] = [];
	let customAmenityDraft = '';
	let editSaving = false;

	// Building CRUD modal state
	let showAddBuilding = false;
	let buildingForm = { name: '', address: '' };
	let buildingSaving = false;
	let confirmDeleteBuilding: Property | null = null;
	let deletingBuilding = false;

	// Unit CRUD modal state
	let addUnitTarget: Property | null = null;
	let unitForm = { name: '', beds: 1, baths: 1 };
	let unitSaving = false;
	let confirmDeleteUnit: { prop: Property; unit: Unit } | null = null;
	let deletingUnit = false;

	// Import
	let importing = false;
	let confirmImport = false;

	$: isOwner = $userRole === 'owner';
	$: isEmpty = !loading && properties.length === 0;

	function openEdit(prop: Property, unit: Unit) {
		editTarget = { prop, unit };
		editDraft = new Set(unit.amenities);
		// Union of global vocabulary + anything already on this unit (in case an
		// edit removed it from every other unit but it still lives here).
		editOptions = Array.from(new Set([...allAmenities, ...unit.amenities])).sort();
		customAmenityDraft = '';
	}

	function addCustomAmenity() {
		const name = customAmenityDraft.trim();
		if (!name) return;
		// Case-insensitive dedupe against the current options
		const existing = editOptions.find((a) => a.toLowerCase() === name.toLowerCase());
		if (existing) {
			editDraft.add(existing);
			editDraft = editDraft;
			toast.info(`"${existing}" is already available — added to this unit.`);
		} else {
			editOptions = [...editOptions, name].sort();
			editDraft.add(name);
			editDraft = editDraft;
		}
		customAmenityDraft = '';
	}

	function onCustomKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addCustomAmenity();
		}
	}

	function toggleDraftAmenity(a: string) {
		if (editDraft.has(a)) editDraft.delete(a);
		else editDraft.add(a);
		editDraft = editDraft;
	}

	async function runImport() {
		confirmImport = false;
		importing = true;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/facilities/import`, {
				method: 'POST',
				headers: authHeader()
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Import failed (${res.status})`);
			}
			const d = await res.json();
			if (d.new_buildings === 0 && d.new_units === 0) {
				toast.info('Already up to date — nothing new to import from DoorLoop.');
			} else {
				toast.success(
					`Imported ${d.new_buildings} building${d.new_buildings === 1 ? '' : 's'} · ${d.new_units} unit${d.new_units === 1 ? '' : 's'}`
				);
			}
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			importing = false;
		}
	}

	async function submitAddBuilding() {
		if (!buildingForm.name.trim()) return;
		buildingSaving = true;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/facilities/buildings`, {
				method: 'POST',
				headers: { ...authHeader(), 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: buildingForm.name.trim(), address: buildingForm.address.trim() || null })
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Create failed (${res.status})`);
			}
			const created = await res.json();
			toast.success(`${buildingForm.name} added`);
			showAddBuilding = false;
			buildingForm = { name: '', address: '' };
			await load(true);
			// Auto-expand the new (empty) building so the owner can drop units into it.
			if (created?.id) {
				expandedProps.add(created.id);
				expandedProps = expandedProps;
			}
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			buildingSaving = false;
		}
	}

	async function submitDeleteBuilding() {
		if (!confirmDeleteBuilding) return;
		deletingBuilding = true;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/facilities/buildings/${confirmDeleteBuilding.property_id}`, {
				method: 'DELETE',
				headers: authHeader()
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Delete failed (${res.status})`);
			}
			toast.success(`${confirmDeleteBuilding.property_name} deleted`);
			confirmDeleteBuilding = null;
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			deletingBuilding = false;
		}
	}

	async function submitAddUnit() {
		if (!addUnitTarget || !unitForm.name.trim()) return;
		unitSaving = true;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/facilities/units`, {
				method: 'POST',
				headers: { ...authHeader(), 'Content-Type': 'application/json' },
				body: JSON.stringify({
					building_id: addUnitTarget.property_id,
					name: unitForm.name.trim(),
					beds: unitForm.beds,
					baths: unitForm.baths,
					amenities: []
				})
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Create failed (${res.status})`);
			}
			toast.success(`Unit ${unitForm.name} added`);
			addUnitTarget = null;
			unitForm = { name: '', beds: 1, baths: 1 };
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			unitSaving = false;
		}
	}

	async function submitDeleteUnit() {
		if (!confirmDeleteUnit) return;
		deletingUnit = true;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/facilities/units/${confirmDeleteUnit.unit.unit_id}`, {
				method: 'DELETE',
				headers: authHeader()
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Delete failed (${res.status})`);
			}
			toast.success(`Unit ${confirmDeleteUnit.unit.unit_name} deleted`);
			confirmDeleteUnit = null;
			await load(true);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			deletingUnit = false;
		}
	}

	function authHeader() {
		return { Authorization: `Bearer ${get(auth).token}` };
	}

	async function saveEdit() {
		if (!editTarget) return;
		editSaving = true;
		const next = Array.from(editDraft).sort();
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/facilities/units/${editTarget.unit.unit_id}`, {
				method: 'PATCH',
				headers: { ...authHeader(), 'Content-Type': 'application/json' },
				body: JSON.stringify({ amenities: next })
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Save failed (${res.status})`);
			}
			properties = properties.map((p) => {
				if (p.property_id !== editTarget!.prop.property_id) return p;
				return {
					...p,
					units: p.units.map((u) =>
						u.unit_id === editTarget!.unit.unit_id ? { ...u, amenities: next } : u
					)
				};
			});
			allAmenities = Array.from(new Set([...allAmenities, ...next])).sort();
			toast.success('Amenities updated');
			editTarget = null;
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			editSaving = false;
		}
	}

	async function load(silent = false) {
		if (!silent) loading = true;
		error = null;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/facilities`, {
				headers: authHeader()
			});
			if (!res.ok) throw new Error(`Failed to load (${res.status})`);
			const data = await res.json();
			properties = data.properties || [];
			allAmenities = data.all_amenities || [];
			// Expand all by default on initial load
			if (!silent) expandedProps = new Set(properties.map((p) => p.property_id));
		} catch (e: any) {
			error = e.message || 'Unable to load facilities';
			toast.error(error ?? 'Unable to load facilities');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function toggleAmenity(a: string) {
		if (selectedAmenities.has(a)) selectedAmenities.delete(a);
		else selectedAmenities.add(a);
		selectedAmenities = selectedAmenities;
	}

	function clearAmenities() {
		selectedAmenities = new Set();
	}

	function toggleProperty(id: string) {
		if (expandedProps.has(id)) expandedProps.delete(id);
		else expandedProps.add(id);
		expandedProps = expandedProps;
	}

	function expandAll() {
		expandedProps = new Set(properties.map((p) => p.property_id));
	}
	function collapseAll() {
		expandedProps = new Set();
	}

	// Friendly labels for common DoorLoop amenity slugs
	const amenityLabel: Record<string, string> = {
		AirConditioner: 'AC',
		WirelessInternet: 'Wi-Fi',
		HighSpeed: 'High-speed Internet',
		SmokeFree: 'Smoke-free',
		OnSiteMaintenance: 'On-site maintenance',
		FurnishedAvailable: 'Furnishing available',
		CeilingFan: 'Ceiling fan'
	};
	function formatAmenity(a: string) {
		if (amenityLabel[a]) return amenityLabel[a];
		// CamelCase → "Camel Case"
		return a.replace(/([A-Z])/g, ' $1').trim();
	}

	$: hasActiveFilter = !!search.trim() || selectedAmenities.size > 0;
	$: filteredProperties = properties
		.map((p) => {
			const matchBuildingName = !!search.trim() && p.property_name.toLowerCase().includes(search.toLowerCase());
			return {
				...p,
				units: p.units.filter((u) => {
					const q = search.toLowerCase();
					const matchesSearch =
						!q ||
						u.unit_name.toLowerCase().includes(q) ||
						p.property_name.toLowerCase().includes(q) ||
						u.amenities.some((a) => a.toLowerCase().includes(q));
					const matchesAmenities =
						selectedAmenities.size === 0 ||
						Array.from(selectedAmenities).every((a) => u.amenities.includes(a));
					return matchesSearch && matchesAmenities;
				})
			};
		})
		// When no filter is active, keep every building (including empty ones).
		// When a filter IS active, drop buildings that now have zero matching units,
		// unless the building name itself matches the search.
		.filter((p) => {
			if (!hasActiveFilter) return true;
			if (p.units.length > 0) return true;
			return !!search.trim() && p.property_name.toLowerCase().includes(search.toLowerCase());
		});

	$: totals = {
		properties: properties.length,
		units: properties.reduce((acc, p) => acc + p.units.length, 0),
		amenities: allAmenities.length,
		filteredUnits: filteredProperties.reduce((acc, p) => acc + p.units.length, 0)
	};
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<div class="flex items-center gap-3">
			<div class="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50">
				<Wrench class="h-6 w-6 text-teal-600" />
			</div>
			<div>
				<h1 class="text-2xl font-semibold text-gray-900">Facilities</h1>
				<p class="text-sm text-gray-500">
					Amenities available per unit across all properties.
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
					on:click={() => (confirmImport = true)}
					disabled={importing}
					class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
					title="Pulls any new DoorLoop buildings/units into the database. Your edits are preserved."
				>
					{#if importing}
						<Spinner size="sm" /> Importing…
					{:else}
						<Download class="h-4 w-4" /> Import from DoorLoop
					{/if}
				</button>
				<button
					on:click={() => { buildingForm = { name: '', address: '' }; showAddBuilding = true; }}
					class="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
				>
					<Plus class="h-4 w-4" /> Add building
				</button>
			{/if}
		</div>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
		{#each [
			{ label: 'Properties', value: totals.properties, icon: Building2, tint: 'bg-blue-50 text-blue-700' },
			{ label: 'Total units', value: totals.units, icon: LayoutGrid, tint: 'bg-purple-50 text-purple-700' },
			{ label: 'Amenity types', value: totals.amenities, icon: Package, tint: 'bg-amber-50 text-amber-700' },
			{ label: 'Shown', value: totals.filteredUnits, icon: ListFilter, tint: 'bg-teal-50 text-teal-700' }
		] as c}
			<div class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg {c.tint}">
					<svelte:component this={c.icon} class="h-5 w-5" />
				</div>
				<div>
					<div class="text-xs uppercase tracking-wide text-gray-500">{c.label}</div>
					{#if loading}
						<Skeleton height="1.5rem" width="2rem" />
					{:else}
						<div class="text-xl font-semibold text-gray-900">{c.value}</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Controls -->
	<div class="flex flex-col gap-3 md:flex-row md:items-center">
		<div class="relative flex-1">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
			<input
				type="text"
				bind:value={search}
				placeholder="Search by building, unit, or amenity..."
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

		<!-- Amenity multi-select -->
		<div class="relative">
			<button
				on:click={() => (amenityFilterOpen = !amenityFilterOpen)}
				class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
			>
				<ListFilter class="h-4 w-4" />
				{selectedAmenities.size === 0
					? 'Filter by amenity'
					: `${selectedAmenities.size} selected`}
				<ChevronDown class="h-4 w-4 text-gray-400" />
			</button>
			{#if amenityFilterOpen}
				<div
					transition:fade={{ duration: 120 }}
					class="absolute right-0 z-20 mt-2 max-h-80 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
				>
					<div class="flex items-center justify-between border-b border-gray-100 px-3 py-2">
						<span class="text-xs font-medium uppercase tracking-wide text-gray-500">Amenities</span>
						{#if selectedAmenities.size > 0}
							<button
								on:click={clearAmenities}
								class="text-xs font-medium text-teal-600 hover:text-teal-700"
							>
								Clear all
							</button>
						{/if}
					</div>
					<div class="max-h-64 overflow-y-auto py-1">
						{#each allAmenities as a}
							<label
								class="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
							>
								<input
									type="checkbox"
									checked={selectedAmenities.has(a)}
									on:change={() => toggleAmenity(a)}
									class="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
								/>
								<span class="text-gray-700">{formatAmenity(a)}</span>
							</label>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<div class="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs">
			<button
				on:click={expandAll}
				class="rounded-md px-2 py-1 text-gray-600 transition hover:bg-gray-50"
			>
				Expand all
			</button>
			<button
				on:click={collapseAll}
				class="rounded-md px-2 py-1 text-gray-600 transition hover:bg-gray-50"
			>
				Collapse all
			</button>
		</div>
	</div>

	<!-- Active filter chips -->
	{#if selectedAmenities.size > 0}
		<div class="flex flex-wrap items-center gap-2" transition:fade={{ duration: 150 }}>
			<span class="text-xs uppercase tracking-wide text-gray-500">Filtering by:</span>
			{#each Array.from(selectedAmenities) as a}
				<button
					on:click={() => toggleAmenity(a)}
					class="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 transition hover:bg-teal-100"
				>
					{formatAmenity(a)}
					<X class="h-3 w-3" />
				</button>
			{/each}
			<button
				on:click={clearAmenities}
				class="text-xs font-medium text-gray-500 hover:text-gray-700"
			>
				Clear
			</button>
		</div>
	{/if}

	<!-- Content -->
	{#if loading}
		{#each Array(3) as _}
			<section class="overflow-hidden rounded-lg border border-gray-200 bg-white">
				<div class="border-b border-gray-100 bg-gray-50 px-4 py-3">
					<Skeleton height="1.25rem" width="14rem" />
				</div>
				<div class="space-y-4 p-4">
					{#each Array(3) as _}
						<div class="flex gap-4">
							<Skeleton height="2.5rem" width="6rem" />
							<div class="flex-1 space-y-2">
								<Skeleton height="0.75rem" width="60%" />
								<Skeleton height="0.75rem" width="40%" />
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/each}
	{:else if error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
	{:else if isEmpty}
		<div
			class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center"
		>
			<Building2 class="h-10 w-10 text-gray-300" />
			<p class="font-medium text-gray-700">No facilities yet</p>
			<p class="max-w-md text-sm text-gray-500">
				Import your buildings and units from DoorLoop to get started. After that, you can manage everything from here.
			</p>
			{#if isOwner}
				<div class="mt-2 flex gap-2">
					<button
						on:click={runImport}
						disabled={importing}
						class="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
					>
						{#if importing}
							<Spinner size="sm" color="white" /> Importing…
						{:else}
							<Download class="h-4 w-4" /> Import from DoorLoop
						{/if}
					</button>
					<button
						on:click={() => { buildingForm = { name: '', address: '' }; showAddBuilding = true; }}
						class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
					>
						<Plus class="h-4 w-4" /> Add manually
					</button>
				</div>
			{/if}
		</div>
	{:else if filteredProperties.length === 0}
		<div
			class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center"
		>
			<Building2 class="h-10 w-10 text-gray-300" />
			<p class="font-medium text-gray-700">No units match your filters</p>
			<p class="text-sm text-gray-500">Try removing filters or clearing search.</p>
			{#if search || selectedAmenities.size > 0}
				<button
					on:click={() => {
						search = '';
						clearAmenities();
					}}
					class="mt-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
				>
					Clear all filters
				</button>
			{/if}
		</div>
	{:else}
		{#each filteredProperties as prop (prop.property_id)}
			<section
				class="overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:shadow-sm"
			>
				<div class="flex items-stretch border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
					<button
						on:click={() => toggleProperty(prop.property_id)}
						class="flex flex-1 items-center justify-between px-4 py-3 text-left"
					>
						<div class="flex items-center gap-3">
							{#if expandedProps.has(prop.property_id)}
								<ChevronDown class="h-4 w-4 text-gray-400" />
							{:else}
								<ChevronRight class="h-4 w-4 text-gray-400" />
							{/if}
							<Building2 class="h-5 w-5 text-teal-600" />
							<div>
								<h2 class="font-semibold text-gray-900">{prop.property_name}</h2>
								{#if prop.property_amenities.length > 0}
									<p class="text-xs text-gray-500">
										Building-wide: {prop.property_amenities.slice(0, 3).map(formatAmenity).join(', ')}{prop
											.property_amenities.length > 3
											? '…'
											: ''}
									</p>
								{/if}
							</div>
						</div>
						<span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
							{prop.units.length} unit{prop.units.length === 1 ? '' : 's'}
						</span>
					</button>
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
									on:click={() => { addUnitTarget = prop; unitForm = { name: '', beds: 1, baths: 1 }; }}
									class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
								>
									<Plus class="h-4 w-4 text-gray-400" /> Add unit
								</button>
								<div class="my-1 border-t border-gray-100"></div>
								<button
									on:click={() => (confirmDeleteBuilding = prop)}
									class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
								>
									<Trash2 class="h-4 w-4" /> Delete building
								</button>
							</Dropdown>
						</div>
					{/if}
				</div>

				{#if expandedProps.has(prop.property_id)}
					<div transition:fade={{ duration: 150 }} class="divide-y divide-gray-100">
						{#if prop.units.length === 0}
							<div class="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-gray-500">
								<p>No units in this building yet.</p>
								{#if isOwner}
									<button
										on:click={() => { addUnitTarget = prop; unitForm = { name: '', beds: 1, baths: 1 }; }}
										class="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-teal-700 hover:bg-teal-50"
									>
										<Plus class="h-3.5 w-3.5" /> Add first unit
									</button>
								{/if}
							</div>
						{/if}
						{#each prop.units as unit (unit.unit_id)}
							<div class="group flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
								<div class="flex w-48 shrink-0 items-center gap-3">
									<div
										class="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-sm font-semibold text-teal-700"
									>
										{(unit.unit_name || '?').slice(0, 3)}
									</div>
									<div>
										<div class="font-medium text-gray-900">
											{unit.unit_name || unit.unit_id}
										</div>
										{#if unit.beds != null || unit.baths != null}
											<div class="flex items-center gap-2 text-xs text-gray-500">
												{#if unit.beds != null}
													<span class="inline-flex items-center gap-0.5">
														<Bed class="h-3 w-3" /> {unit.beds}
													</span>
												{/if}
												{#if unit.baths != null}
													<span class="inline-flex items-center gap-0.5">
														<Bath class="h-3 w-3" /> {unit.baths}
													</span>
												{/if}
											</div>
										{/if}
									</div>
								</div>
								<div class="flex flex-1 flex-wrap gap-1.5">
									{#if unit.amenities.length === 0}
										<span class="text-xs italic text-gray-400">No amenities listed</span>
									{:else}
										{#each unit.amenities as a}
											<span
												class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition"
												class:border-teal-300={selectedAmenities.has(a)}
												class:bg-teal-50={selectedAmenities.has(a)}
												class:text-teal-800={selectedAmenities.has(a)}
												class:border-gray-200={!selectedAmenities.has(a)}
												class:bg-white={!selectedAmenities.has(a)}
												class:text-gray-700={!selectedAmenities.has(a)}
											>
												{formatAmenity(a)}
											</span>
										{/each}
									{/if}
								</div>
								{#if isOwner}
									<div class="shrink-0 md:opacity-0 md:transition md:group-hover:opacity-100">
										<Dropdown align="right">
											<button
												slot="trigger"
												class="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
												aria-label="Unit actions"
											>
												<MoreHorizontal class="h-4 w-4" />
											</button>
											<button
												on:click={() => openEdit(prop, unit)}
												class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
											>
												<Pencil class="h-4 w-4 text-gray-400" /> Edit amenities
											</button>
											<div class="my-1 border-t border-gray-100"></div>
											<button
												on:click={() => (confirmDeleteUnit = { prop, unit })}
												class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
											>
												<Trash2 class="h-4 w-4" /> Delete unit
											</button>
										</Dropdown>
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

{#if isOwner && editTarget}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
		on:click={() => (editTarget = null)}
		role="dialog"
		aria-modal="true"
	>
		<div
			on:click|stopPropagation
			transition:scale={{ duration: 200, start: 0.96 }}
			class="flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
		>
			<header class="flex items-start justify-between border-b border-gray-100 px-5 py-4">
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50">
						<Pencil class="h-4 w-4 text-teal-600" />
					</div>
					<div>
						<h3 class="text-lg font-semibold text-gray-900">Edit amenities</h3>
						<p class="text-xs text-gray-500">
							{editTarget.prop.property_name} · Unit {editTarget.unit.unit_name || editTarget.unit.unit_id}
						</p>
					</div>
				</div>
				<button
					on:click={() => (editTarget = null)}
					class="text-gray-400 hover:text-gray-600"
					aria-label="Close"
				>
					<X class="h-5 w-5" />
				</button>
			</header>

			<div class="max-h-[55vh] overflow-y-auto px-5 py-4">
				{#if editOptions.length > 0}
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{#each editOptions as a}
							<label
								class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition"
								class:border-teal-500={editDraft.has(a)}
								class:bg-teal-50={editDraft.has(a)}
								class:text-teal-800={editDraft.has(a)}
								class:border-gray-200={!editDraft.has(a)}
								class:text-gray-700={!editDraft.has(a)}
								class:hover:bg-gray-50={!editDraft.has(a)}
							>
								<input
									type="checkbox"
									checked={editDraft.has(a)}
									on:change={() => toggleDraftAmenity(a)}
									class="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
								/>
								<span class="truncate">{formatAmenity(a)}</span>
							</label>
						{/each}
					</div>
				{:else}
					<p class="py-6 text-center text-sm text-gray-500">
						No amenities in the library yet. Add your first one below.
					</p>
				{/if}

				<!-- Custom amenity -->
				<div class="mt-4 border-t border-gray-100 pt-4">
					<label class="block text-xs font-medium uppercase tracking-wide text-gray-500">
						Add custom amenity
					</label>
					<div class="mt-1 flex gap-2">
						<input
							type="text"
							bind:value={customAmenityDraft}
							on:keydown={onCustomKey}
							placeholder="e.g. Hot tub, Balcony, Smart lock…"
							class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
						/>
						<button
							on:click={addCustomAmenity}
							disabled={!customAmenityDraft.trim()}
							class="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
						>
							<Plus class="h-4 w-4" /> Add
						</button>
					</div>
					<p class="mt-1 text-xs text-gray-500">
						New amenities are saved with this unit and become available everywhere after you save.
					</p>
				</div>
			</div>

			<footer class="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<span class="text-xs text-gray-500">{editDraft.size} selected</span>
				<div class="flex gap-2">
					<button on:click={() => (editTarget = null)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
					<button
						on:click={saveEdit}
						disabled={editSaving}
						class="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
					>
						{#if editSaving}
							<Spinner size="sm" color="white" /> Saving…
						{:else}
							<Save class="h-4 w-4" /> Save
						{/if}
					</button>
				</div>
			</footer>
		</div>
	</div>
{/if}

<!-- Add building modal -->
{#if isOwner && showAddBuilding}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
		on:click={() => (showAddBuilding = false)}
		role="dialog"
		aria-modal="true"
	>
		<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
			<header class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50"><Building2 class="h-4 w-4 text-teal-600" /></div>
					<h3 class="text-lg font-semibold text-gray-900">Add building</h3>
				</div>
				<button on:click={() => (showAddBuilding = false)} class="text-gray-400 hover:text-gray-600" aria-label="Close"><X class="h-5 w-5" /></button>
			</header>
			<div class="space-y-3 px-5 py-4">
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-gray-700">Building name</span>
					<input bind:value={buildingForm.name} placeholder="e.g. Limon Apartments" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
				</label>
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-gray-700">Address (optional)</span>
					<input bind:value={buildingForm.address} placeholder="3505 NW 5th Ave, Miami, FL" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
				</label>
			</div>
			<footer class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (showAddBuilding = false)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button on:click={submitAddBuilding} disabled={buildingSaving || !buildingForm.name.trim()} class="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
					{#if buildingSaving}<Spinner size="sm" color="white" /> Adding…{:else}<Plus class="h-4 w-4" /> Add building{/if}
				</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Add unit modal -->
{#if isOwner && addUnitTarget}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
		on:click={() => (addUnitTarget = null)}
		role="dialog"
		aria-modal="true"
	>
		<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
			<header class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50"><Plus class="h-4 w-4 text-teal-600" /></div>
					<div>
						<h3 class="text-lg font-semibold text-gray-900">Add unit</h3>
						<p class="text-xs text-gray-500">In {addUnitTarget.property_name}</p>
					</div>
				</div>
				<button on:click={() => (addUnitTarget = null)} class="text-gray-400 hover:text-gray-600" aria-label="Close"><X class="h-5 w-5" /></button>
			</header>
			<div class="space-y-3 px-5 py-4">
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-gray-700">Unit name / number</span>
					<input bind:value={unitForm.name} placeholder="e.g. 11A" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
				</label>
				<div class="grid grid-cols-2 gap-3">
					<label class="block text-sm">
						<span class="mb-1 block font-medium text-gray-700">Bedrooms</span>
						<input type="number" min="0" max="10" bind:value={unitForm.beds} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
					</label>
					<label class="block text-sm">
						<span class="mb-1 block font-medium text-gray-700">Bathrooms</span>
						<input type="number" min="0" max="10" step="0.5" bind:value={unitForm.baths} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
					</label>
				</div>
				<p class="text-xs text-gray-500">You'll be able to tick amenities after the unit is created, from the row's ⋯ menu.</p>
			</div>
			<footer class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (addUnitTarget = null)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button on:click={submitAddUnit} disabled={unitSaving || !unitForm.name.trim()} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
					{#if unitSaving}<Spinner size="sm" color="white" /> Adding…{:else}<Save class="h-4 w-4" /> Add unit{/if}
				</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Delete building confirm -->
{#if isOwner && confirmDeleteBuilding}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
		on:click={() => (confirmDeleteBuilding = null)}
		role="dialog"
		aria-modal="true"
	>
		<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
			<div class="px-5 py-5">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50"><Trash2 class="h-5 w-5 text-red-600" /></div>
					<div>
						<h3 class="text-base font-semibold text-gray-900">Delete building?</h3>
						<p class="mt-1 text-sm text-gray-600">
							<span class="font-medium text-gray-800">{confirmDeleteBuilding.property_name}</span> and all {confirmDeleteBuilding.units.length} unit{confirmDeleteBuilding.units.length === 1 ? '' : 's'} inside it will be removed. This cannot be undone.
						</p>
					</div>
				</div>
			</div>
			<div class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (confirmDeleteBuilding = null)} disabled={deletingBuilding} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button on:click={submitDeleteBuilding} disabled={deletingBuilding} class="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
					{#if deletingBuilding}<Spinner size="sm" color="white" /> Deleting…{:else}<Trash2 class="h-4 w-4" /> Delete{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete unit confirm -->
{#if isOwner && confirmDeleteUnit}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
		on:click={() => (confirmDeleteUnit = null)}
		role="dialog"
		aria-modal="true"
	>
		<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
			<div class="px-5 py-5">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50"><Trash2 class="h-5 w-5 text-red-600" /></div>
					<div>
						<h3 class="text-base font-semibold text-gray-900">Delete unit?</h3>
						<p class="mt-1 text-sm text-gray-600">
							Unit <span class="font-medium text-gray-800">{confirmDeleteUnit.unit.unit_name}</span> in <span class="font-medium text-gray-800">{confirmDeleteUnit.prop.property_name}</span> will be removed. This cannot be undone.
						</p>
					</div>
				</div>
			</div>
			<div class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (confirmDeleteUnit = null)} disabled={deletingUnit} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button on:click={submitDeleteUnit} disabled={deletingUnit} class="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
					{#if deletingUnit}<Spinner size="sm" color="white" /> Deleting…{:else}<Trash2 class="h-4 w-4" /> Delete{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Import confirmation -->
{#if isOwner && confirmImport}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
		on:click={() => (confirmImport = false)}
		role="dialog"
		aria-modal="true"
	>
		<div on:click|stopPropagation transition:scale={{ duration: 200, start: 0.96 }} class="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
			<div class="px-5 py-5">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50">
						<Download class="h-5 w-5 text-teal-600" />
					</div>
					<div>
						<h3 class="text-base font-semibold text-gray-900">Import from DoorLoop?</h3>
						<p class="mt-1 text-sm text-gray-600">
							This pulls in any buildings and units from DoorLoop that aren't already here. Existing records and your edits are left untouched.
						</p>
						<p class="mt-2 text-xs text-gray-500">
							Safe to run multiple times — it only adds new items, never overwrites.
						</p>
					</div>
				</div>
			</div>
			<div class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (confirmImport = false)} disabled={importing} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button on:click={runImport} disabled={importing} class="inline-flex min-w-[130px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
					{#if importing}
						<Spinner size="sm" color="white" /> Importing…
					{:else}
						<Download class="h-4 w-4" /> Yes, import
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
