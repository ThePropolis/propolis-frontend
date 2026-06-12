<script lang="ts">
  export let title: string;
  export let value: string | number | null = null;
  export let subtitle: string = '';
  export let trend: number | null = null;
  export let trendLabel: string = 'vs last period';
  export let icon: any = null;
  export let color: 'teal' | 'amber' | 'blue' | 'red' | 'green' | 'purple' = 'teal';
  export let pending: boolean = false;
  export let pendingLabel: string = 'Integration Pending';
  export let loading: boolean = false;
  export let format: 'currency' | 'percent' | 'number' | 'hours' | 'days' | 'raw' = 'raw';

  const colorMap: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  const iconColorMap: Record<string, string> = {
    teal: 'text-teal-600',
    amber: 'text-amber-600',
    blue: 'text-blue-600',
    red: 'text-red-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
  };

  function fmt(v: string | number | null): string {
    if (v === null || v === undefined) return '—';
    const n = Number(v);
    if (isNaN(n)) return String(v);
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
      case 'percent':
        return `${n.toFixed(1)}%`;
      case 'hours':
        return `${n.toFixed(1)} hrs`;
      case 'days':
        return `${n.toFixed(1)} days`;
      case 'number':
        return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
      default:
        return String(v);
    }
  }
</script>

<div class="rounded-xl border bg-white p-5 shadow-sm {pending ? 'opacity-70' : ''}">
  <div class="mb-3 flex items-center justify-between">
    <span class="text-sm font-medium text-gray-500">{title}</span>
    {#if icon}
      <div class="rounded-lg p-2 {colorMap[color]}">
        <svelte:component this={icon} class="h-4 w-4 {iconColorMap[color]}" />
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="h-8 w-24 animate-pulse rounded bg-gray-100"></div>
  {:else if pending}
    <div class="flex items-center gap-2">
      <span class="text-lg font-semibold text-gray-400">—</span>
      <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{pendingLabel}</span>
    </div>
  {:else}
    <div class="text-2xl font-bold text-gray-900">{fmt(value)}</div>
  {/if}

  {#if subtitle && !loading}
    <div class="mt-1 text-xs text-gray-500">{subtitle}</div>
  {/if}

  {#if trend !== null && !loading && !pending}
    <div class="mt-2 flex items-center gap-1 text-xs {trend >= 0 ? 'text-green-600' : 'text-red-600'}">
      <span>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%</span>
      <span class="text-gray-400">{trendLabel}</span>
    </div>
  {/if}
</div>
