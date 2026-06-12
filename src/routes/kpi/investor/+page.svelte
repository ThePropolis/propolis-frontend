<script lang="ts">
  /**
   * INVESTOR VIEW — Simplified, curated KPI set per document spec.
   * Investors MAY see: Revenue, Occupancy, NOI, Cash Flow, Revenue Growth,
   *                     NOI Growth, Profit Per Unit, Asset Performance, Portfolio Performance.
   * Investors MUST NOT see: Labor productivity, Operational inefficiencies,
   *                          Cleaning labor detail, Maintenance task detail, Staff performance.
   */
  import { onMount } from 'svelte';
  import { kpi, ytdRange, lastYearRange } from '$lib/api/kpi';
  import type { RevenueKPI, FinanceKPI, HybridKPI, RevenueDensityKPI } from '$lib/api/kpi';
  import KPICard from '$lib/components/kpi/KPICard.svelte';
  import DateRangePicker from '$lib/components/kpi/DateRangePicker.svelte';
  import { DollarSign, TrendingUp, Percent, BarChart3, Building2, RefreshCw } from 'lucide-svelte';
  import { Chart } from 'svelte-echarts';
  import { init as echartsInit, use as echartsUse } from 'echarts/core';
  import { BarChart } from 'echarts/charts';
  import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';
  echartsUse([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

  let { start, end } = ytdRange();
  let prevYear = lastYearRange();

  let revenue: RevenueKPI | null = null;
  let finance: FinanceKPI | null = null;
  let revDensity: RevenueDensityKPI | null = null;
  let prevRevenue: RevenueKPI | null = null;
  let prevFinance: FinanceKPI | null = null;
  let loading = true;
  let error: string | null = null;

  async function load() {
    loading = true; error = null;
    try {
      [revenue, finance, revDensity, prevRevenue, prevFinance] = await Promise.all([
        kpi.revenue(start, end),
        kpi.finance(start, end),
        kpi.revenueDensity(start, end),
        kpi.revenue(prevYear.start, prevYear.end),
        kpi.finance(prevYear.start, prevYear.end),
      ]);
    } catch (e: any) { error = e.message; }
    finally { loading = false; }
  }

  onMount(load);

  function onDateChange(e: CustomEvent<{ start: string; end: string }>) {
    start = e.detail.start; end = e.detail.end;
    load();
  }

  function growthPct(current: number | null, prev: number | null): number | null {
    if (!current || !prev || prev === 0) return null;
    return ((current - prev) / prev) * 100;
  }

  $: revenueGrowth = growthPct(revenue?.total_revenue ?? null, prevRevenue?.total_revenue ?? null);
  $: noiGrowth = growthPct(finance?.noi ?? null, prevFinance?.noi ?? null);

  $: assetChart = revDensity ? {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255,255,255,0.97)', borderColor: '#e5e7eb',
      formatter: (p: any[]) => `<strong>${p[0].name}</strong><br/>` + p.map((s: any) => `${s.marker} ${s.seriesName}: <strong>$${Number(s.value).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>`).join('<br/>') },
    legend: { data: ['Revenue per Unit', 'Revenue per Room'], bottom: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
    grid: { left: 12, right: 12, top: 16, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: revDensity.buildings.map(b => b.building_name), axisLabel: { color: '#6b7280', fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { color: '#9ca3af', fontSize: 10, formatter: (v: number) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}` }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [
      { name: 'Revenue per Unit', type: 'bar', barMaxWidth: 48, data: revDensity.buildings.map(b => b.revenue_per_unit ?? 0), itemStyle: { color: '#0d9488', borderRadius: [4,4,0,0] } },
      { name: 'Revenue per Room', type: 'bar', barMaxWidth: 48, data: revDensity.buildings.map(b => b.revenue_per_room ?? 0), itemStyle: { color: '#d97706', borderRadius: [4,4,0,0] } },
    ]
  } : null;
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Investor Dashboard</h1>
      <p class="text-sm text-gray-500">Portfolio performance — revenue, NOI, occupancy, cash flow</p>
    </div>
    <div class="flex items-center gap-2">
      <DateRangePicker {start} {end} on:change={onDateChange} />
      <button class="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50" on:click={load}>
        <RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" />
      </button>
    </div>
  </div>

  {#if error}
    <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  {/if}

  <!-- Revenue & Profitability -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Portfolio Performance</h2>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <KPICard title="Total Revenue" value={revenue?.total_revenue ?? null} format="currency" icon={DollarSign} color="teal" {loading}
        trend={revenueGrowth} trendLabel="vs last year" />
      <KPICard title="Net Operating Income" value={finance?.noi ?? null} format="currency" icon={TrendingUp} color="green" {loading}
        trend={noiGrowth} trendLabel="vs last year" />
      <KPICard title="Gross Operating Income" value={finance?.goi ?? null} format="currency" color="blue" {loading} />
      <KPICard title="Net Cash Flow" value={finance?.net_cash_flow ?? null} format="currency" color="amber" {loading} subtitle="NOI (debt service manual)" />
    </div>
  </section>

  <!-- Growth & Margins -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Growth & Margins</h2>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <KPICard title="Revenue Growth" value={revenueGrowth} format="percent" icon={TrendingUp} color="green" {loading} subtitle="vs previous year" />
      <KPICard title="NOI Growth" value={noiGrowth} format="percent" color="teal" {loading} subtitle="vs previous year" />
      <KPICard title="Operating Margin" value={finance?.operating_margin_pct ?? null} format="percent" icon={Percent} color="blue" {loading} />
      <KPICard title="STR Revenue" value={revenue?.str_revenue ?? null} format="currency" color="purple" {loading} />
    </div>
  </section>

  <!-- Asset Performance -->
  {#if revDensity && assetChart}
    <section>
      <h2 class="mb-3 text-base font-semibold text-gray-700">Asset Performance</h2>
      <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm mb-4">
        <Chart init={echartsInit} options={assetChart} style="height:240px" />
      </div>
      <div class="rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th class="px-4 py-3 text-left">Building</th>
              <th class="px-4 py-3 text-right">Total Revenue</th>
              <th class="px-4 py-3 text-right">Units</th>
              <th class="px-4 py-3 text-right">Revenue / Unit</th>
              <th class="px-4 py-3 text-right">Revenue / Room</th>
              <th class="px-4 py-3 text-right">Revenue / Sq Ft</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            {#each revDensity.buildings as b}
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 font-medium text-gray-800">{b.building_name}</td>
                <td class="px-4 py-3 text-right font-semibold text-teal-700">${b.total_revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td class="px-4 py-3 text-right text-gray-600">{b.unit_count}</td>
                <td class="px-4 py-3 text-right">{b.revenue_per_unit ? `$${b.revenue_per_unit.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                <td class="px-4 py-3 text-right">{b.revenue_per_room ? `$${b.revenue_per_room.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                <td class="px-4 py-3 text-right">{b.revenue_per_sqft ? `$${b.revenue_per_sqft.toFixed(2)}` : '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}

  <!-- Profit per Unit summary -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Profit Per Unit</h2>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {#if revDensity}
        {#each revDensity.buildings as b}
          <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p class="text-sm font-semibold text-gray-800 mb-2">{b.building_name}</p>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Revenue / Unit</span>
              <span class="font-medium">{b.revenue_per_unit ? `$${b.revenue_per_unit.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
            </div>
            <div class="flex justify-between text-sm mt-1">
              <span class="text-gray-500">Revenue / Room</span>
              <span class="font-medium">{b.revenue_per_room ? `$${b.revenue_per_room.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
            </div>
            <div class="flex justify-between text-sm mt-1">
              <span class="text-gray-500">Revenue / Sq Ft</span>
              <span class="font-medium">{b.revenue_per_sqft ? `$${b.revenue_per_sqft.toFixed(2)}` : '—'}</span>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </section>
</div>
