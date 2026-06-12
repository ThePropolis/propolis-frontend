<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Calendar } from 'lucide-svelte';

  export let start: string;
  export let end: string;

  const dispatch = createEventDispatcher<{ change: { start: string; end: string } }>();

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  const mStart = (yr: number, mo: number) => `${yr}-${String(mo + 1).padStart(2, '0')}-01`;
  const mEnd = (yr: number, mo: number) => toISO(new Date(yr, mo + 1, 0));

  const presets = [
    { label: 'This Month', start: mStart(y, m), end: toISO(now) },
    { label: 'Last Month', start: mStart(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1), end: mEnd(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1) },
    { label: `Q1 ${y}`, start: `${y}-01-01`, end: `${y}-03-31` },
    { label: `Q2 ${y}`, start: `${y}-04-01`, end: `${y}-06-30` },
    { label: `Q3 ${y}`, start: `${y}-07-01`, end: `${y}-09-30` },
    { label: `Q4 ${y}`, start: `${y}-10-01`, end: `${y}-12-31` },
    { label: `YTD ${y}`, start: `${y}-01-01`, end: toISO(now) },
    { label: `Full ${y - 1}`, start: `${y - 1}-01-01`, end: `${y - 1}-12-31` },
  ];

  let showPicker = false;

  function applyPreset(p: { start: string; end: string }) {
    start = p.start;
    end = p.end;
    dispatch('change', { start, end });
    showPicker = false;
  }

  function applyCustom() {
    if (start && end) {
      dispatch('change', { start, end });
      showPicker = false;
    }
  }

  function activePreset() {
    return presets.find(p => p.start === start && p.end === end)?.label ?? 'Custom';
  }
</script>

<div class="relative">
  <button
    class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
    on:click={() => showPicker = !showPicker}
  >
    <Calendar class="h-4 w-4 text-gray-400" />
    <span>{activePreset()}</span>
    <span class="text-xs text-gray-400">{start} → {end}</span>
  </button>

  {#if showPicker}
    <div class="absolute left-0 top-full z-30 mt-1 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Quick Select</p>
      <div class="mb-3 grid grid-cols-2 gap-1">
        {#each presets as p}
          <button
            class="rounded-lg px-2 py-1.5 text-left text-xs hover:bg-gray-100 {p.start === start && p.end === end ? 'bg-teal-50 text-teal-700 font-medium' : 'text-gray-700'}"
            on:click={() => applyPreset(p)}
          >{p.label}</button>
        {/each}
      </div>
      <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Custom Range</p>
      <div class="flex gap-2">
        <input type="date" bind:value={start} class="flex-1 rounded border border-gray-200 px-2 py-1 text-xs" />
        <input type="date" bind:value={end} class="flex-1 rounded border border-gray-200 px-2 py-1 text-xs" />
      </div>
      <button
        class="mt-2 w-full rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700"
        on:click={applyCustom}
      >Apply</button>
    </div>
  {/if}
</div>
