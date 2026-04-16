<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { fade } from 'svelte/transition';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { auth } from '$lib/api/auth';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
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
		Package
	} from 'lucide-svelte';

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

	async function load(silent = false) {
		if (!silent) loading = true;
		error = null;
		const token = get(auth).token;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/doorloop/facilities`, {
				headers: { Authorization: `Bearer ${token}` }
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

	$: filteredProperties = properties
		.map((p) => ({
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
		}))
		.filter((p) => p.units.length > 0);

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
		<div class="flex items-center gap-2">
			<button
				on:click={() => load()}
				disabled={loading}
				class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
			>
				<RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" /> Refresh
			</button>
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
				<button
					on:click={() => toggleProperty(prop.property_id)}
					class="flex w-full items-center justify-between border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-4 py-3 text-left"
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

				{#if expandedProps.has(prop.property_id)}
					<div transition:fade={{ duration: 150 }} class="divide-y divide-gray-100">
						{#each prop.units as unit (unit.unit_id)}
							<div class="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
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
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/each}
	{/if}
</div>
