<script lang="ts">
	import { onMount } from 'svelte';
	import { getDoorloopOccupancyRate, type DoorloopOccupancyResponse } from '../api/doorloop';
	import { RefreshCw, Info } from 'lucide-svelte';

	let startDate = '';
	let endDate = '';
	let occupancyData: DoorloopOccupancyResponse | null = null;
	let loading = false;
	let error = '';

	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
	startDate = startOfMonth.toISOString().split('T')[0];
	endDate = endOfMonth.toISOString().split('T')[0];

	async function fetchOccupancy() {
		if (!startDate || !endDate) {
			error = 'Please select both start and end dates';
			return;
		}
		loading = true;
		error = '';
		try {
			occupancyData = await getDoorloopOccupancyRate(startDate, endDate);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to fetch occupancy data';
			occupancyData = null;
		} finally {
			loading = false;
		}
	}

	onMount(fetchOccupancy);

	$: binary = occupancyData?.occupancy_rate_binary ?? occupancyData?.occupancy_rate ?? 0;
	$: prorated = occupancyData?.occupancy_rate_prorated ?? occupancyData?.occupancy_rate ?? 0;
</script>

<section class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
	<header class="mb-4 flex flex-wrap items-start justify-between gap-3">
		<div>
			<h3 class="text-lg font-semibold text-gray-900">Long-Term Occupancy (DoorLoop)</h3>
			<p class="text-xs text-gray-500">Two views of the same period — pick the one that matches how your team reports.</p>
		</div>
		<button
			on:click={fetchOccupancy}
			disabled={loading}
			class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
		>
			<RefreshCw class="h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" />
			Refresh
		</button>
	</header>

	<div class="mb-4 flex flex-wrap items-end gap-3">
		<label class="flex flex-col gap-1 text-xs text-gray-600">
			Start date
			<input type="date" bind:value={startDate} on:change={fetchOccupancy} class="rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
		</label>
		<label class="flex flex-col gap-1 text-xs text-gray-600">
			End date
			<input type="date" bind:value={endDate} on:change={fetchOccupancy} class="rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
		</label>
	</div>

	{#if error}
		<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">⚠️ {error}</div>
	{/if}

	<div class="grid gap-3 md:grid-cols-2">
		<!-- Binary -->
		<div class="rounded-lg border border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50 p-5">
			<div class="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-teal-700">
				Binary <Info class="h-3 w-3 text-teal-500" />
			</div>
			<div class="flex items-baseline gap-2">
				<span class="text-4xl font-bold text-teal-900">
					{loading ? '—' : `${binary.toFixed(2)}%`}
				</span>
			</div>
			<p class="mt-1 text-xs text-teal-700/80">
				Any lease active in the period = 100% occupied. Matches DoorLoop's dashboard.
			</p>
		</div>

		<!-- Prorated -->
		<div class="rounded-lg border border-purple-100 bg-gradient-to-br from-purple-50 to-indigo-50 p-5">
			<div class="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-purple-700">
				Prorated <Info class="h-3 w-3 text-purple-500" />
			</div>
			<div class="flex items-baseline gap-2">
				<span class="text-4xl font-bold text-purple-900">
					{loading ? '—' : `${prorated.toFixed(2)}%`}
				</span>
			</div>
			<p class="mt-1 text-xs text-purple-700/80">
				Days of coverage ÷ days in period. Reflects mid-month move-ins/outs.
			</p>
		</div>
	</div>

	{#if occupancyData}
		<div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
			<div class="rounded-md bg-gray-50 p-3 text-center">
				<div class="text-[10px] uppercase tracking-wide text-gray-500">Total units</div>
				<div class="text-lg font-semibold text-gray-900">{occupancyData.total_units}</div>
			</div>
			<div class="rounded-md bg-gray-50 p-3 text-center">
				<div class="text-[10px] uppercase tracking-wide text-gray-500">Occupied (binary)</div>
				<div class="text-lg font-semibold text-gray-900">
					{occupancyData.occupied_units_binary ?? occupancyData.occupied_units}
				</div>
			</div>
			<div class="rounded-md bg-gray-50 p-3 text-center">
				<div class="text-[10px] uppercase tracking-wide text-gray-500">Occupied (prorated)</div>
				<div class="text-lg font-semibold text-gray-900">
					{(occupancyData.occupied_units_prorated ?? occupancyData.occupied_units)?.toFixed?.(2) ??
						occupancyData.occupied_units}
				</div>
			</div>
			<div class="rounded-md bg-gray-50 p-3 text-center">
				<div class="text-[10px] uppercase tracking-wide text-gray-500">Period</div>
				<div class="text-xs font-medium text-gray-700">
					{occupancyData.date_from}<br />→ {occupancyData.date_to}
				</div>
			</div>
		</div>
	{/if}
</section>
