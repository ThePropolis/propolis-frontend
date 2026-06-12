<script lang="ts">
  import { onMount } from 'svelte';
  import { kpi, ytdRange, thisMonthRange } from '$lib/api/kpi';
  import type { RevenueKPI, FinanceKPI, HybridKPI, OccupancyKPI } from '$lib/api/kpi';
  import KPICard from '$lib/components/kpi/KPICard.svelte';
  import DateRangePicker from '$lib/components/kpi/DateRangePicker.svelte';
  import { DollarSign, TrendingUp, Building2, BarChart3, Percent, Wallet, RefreshCw } from 'lucide-svelte';
  import { Chart } from 'svelte-echarts';
  import { init as echartsInit, use as echartsUse } from 'echarts/core';
  import { BarChart, LineChart } from 'echarts/charts';
  import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';
  echartsUse([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

  let { start, end } = ytdRange();

  let revenue: RevenueKPI | null = null;
  let finance: FinanceKPI | null = null;
  let hybrid: HybridKPI | null = null;
  let occupancy: OccupancyKPI | null = null;
  let loading = true;
  let error: string | null = null;

  async function load() {
    loading = true;
    error = null;
    try {
      [revenue, finance, hybrid, occupancy] = await Promise.all([
        kpi.revenue(start, end),
        kpi.finance(start, end),
        kpi.hybrid(start, end),
        kpi.occupancy(start, end),
      ]);
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function onDateChange(e: CustomEvent<{ start: string; end: string }>) {
    start = e.detail.start;
    end = e.detail.end;
    load();
  }

  $: hybridChart = hybrid ? {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255,255,255,0.97)', borderColor: '#e5e7eb',
      formatter: (p: any[]) => `<strong>${p[0].name}</strong><br/>` + p.map((s: any) => `${s.marker} ${s.seriesName}: <strong>$${Number(s.value).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>`).join('<br/>') },
    legend: { data: ['STR Revenue', 'LTR Revenue'], bottom: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
    grid: { left: 12, right: 12, top: 16, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: (hybrid?.buildings ?? []).map(b => b.building_name), axisLabel: { color: '#6b7280', fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { color: '#9ca3af', fontSize: 10, formatter: (v: number) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}` }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [
      { name: 'STR Revenue', type: 'bar', stack: 'rev', barMaxWidth: 60, data: (hybrid?.buildings ?? []).map(b => b.str_revenue), itemStyle: { color: '#0d9488', borderRadius: [0,0,0,0] } },
      { name: 'LTR Revenue', type: 'bar', stack: 'rev', barMaxWidth: 60, data: (hybrid?.buildings ?? []).map(b => b.ltr_revenue), itemStyle: { color: '#d97706', borderRadius: [4,4,0,0] } },
    ]
  } : null;
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Executive KPI Dashboard</h1>
      <p class="text-sm text-gray-500">Portfolio revenue, profitability, hybrid analysis, and trends</p>
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

  <!-- Revenue Section -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Revenue</h2>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <KPICard title="Total Revenue" value={revenue?.total_revenue ?? null} format="currency" icon={DollarSign} color="teal" {loading} />
      <KPICard title="STR Revenue" value={revenue?.str_revenue ?? null} format="currency" icon={Building2} color="blue" {loading} subtitle="Short-term rentals" />
      <KPICard title="LTR Revenue" value={revenue?.ltr_revenue ?? null} format="currency" icon={Building2} color="amber" {loading} subtitle="Long-term leases" />
      <KPICard title="Cleaning Revenue" value={revenue?.cleaning_revenue ?? null} format="currency" color="green" {loading} pending={!revenue || revenue.cleaning_revenue === 0} pendingLabel="Jurny line-item" />
      <KPICard title="Ancillary Revenue" value={revenue?.ancillary_revenue ?? null} format="currency" color="purple" {loading} pending={!revenue || revenue.ancillary_revenue === 0} pendingLabel="Jurny line-item" />
    </div>
  </section>

  <!-- Profitability Section -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Profitability</h2>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <KPICard title="Gross Operating Income" value={finance?.goi ?? null} format="currency" icon={Wallet} color="teal" {loading} subtitle="Revenue − Vacancy − Delinquency" />
      <KPICard title="Net Operating Income" value={finance?.noi ?? null} format="currency" icon={TrendingUp} color="green" {loading} subtitle="GOI − Operating Expenses" />
      <KPICard title="Operating Margin" value={finance?.operating_margin_pct ?? null} format="percent" icon={Percent} color="blue" {loading} />
      <KPICard title="Net Cash Flow" value={finance?.net_cash_flow ?? null} format="currency" color="amber" {loading} subtitle="NOI (debt service requires manual input)" />
    </div>
  </section>

  <!-- Occupancy Section -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Occupancy</h2>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <KPICard title="STR Occupancy" value={occupancy?.str_occupancy_pct ?? null} format="percent" color="teal" {loading} />
      <KPICard title="LTR Occupancy" value={occupancy?.ltr_occupancy_pct ?? null} format="percent" color="amber" {loading} />
      <KPICard title="STR ADR" value={occupancy?.str_adr ?? null} format="currency" color="blue" {loading} pending={!occupancy?.str_adr} pendingLabel="Jurny API" />
      <KPICard title="STR RevPAR" value={null} format="currency" color="purple" {loading} pending pendingLabel="Jurny API" />
    </div>
  </section>

  <!-- Expense Breakdown (non-investor) -->
  {#if finance?.expenses}
    <section>
      <h2 class="mb-3 text-base font-semibold text-gray-700">Operating Expenses</h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KPICard title="Cleaning Cost" value={finance.expenses.cleaning} format="currency" color="teal" {loading} />
        <KPICard title="Maintenance Cost" value={finance.expenses.maintenance} format="currency" color="amber" {loading} />
        <KPICard title="Utilities" value={finance.expenses.utilities} format="currency" color="blue" {loading} />
        <KPICard title="Insurance" value={finance.expenses.insurance} format="currency" color="red" {loading} />
        <KPICard title="Software" value={finance.expenses.software} format="currency" color="purple" {loading} />
        <KPICard title="Management Fees" value={finance.expenses.management_fees} format="currency" color="amber" {loading} />
        <KPICard title="Supplies" value={finance.expenses.supplies} format="currency" color="green" {loading} />
        <KPICard title="Contractors" value={finance.expenses.contractors} format="currency" color="blue" {loading} />
      </div>
    </section>
  {/if}

  <!-- Hybrid STR/LTR Chart -->
  {#if hybrid && hybridChart}
    <section>
      <div class="flex items-center justify-between mb-3">
        <div>
          <h2 class="text-base font-semibold text-gray-700">STR vs LTR Revenue by Building</h2>
          <p class="text-xs text-gray-500 mt-0.5">Hybrid analysis — portfolio winning model: <strong class="text-teal-700">{hybrid.portfolio_winning_model}</strong></p>
        </div>
        <div class="text-right text-sm">
          <div class="font-semibold text-gray-900">${hybrid.portfolio_total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          <div class="text-xs text-gray-400">Portfolio Total</div>
        </div>
      </div>

      <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <Chart init={echartsInit} options={hybridChart} style="height:260px" />
      </div>

      <!-- Building-level table -->
      <div class="mt-3 rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th class="px-4 py-3 text-left">Building</th>
              <th class="px-4 py-3 text-right">STR Revenue</th>
              <th class="px-4 py-3 text-right">LTR Revenue</th>
              <th class="px-4 py-3 text-right">Total</th>
              <th class="px-4 py-3 text-right">Winning Model</th>
              <th class="px-4 py-3 text-right">Opportunity Gap</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            {#each hybrid.buildings as b}
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 font-medium text-gray-800">{b.building_full_name || b.building_name}</td>
                <td class="px-4 py-3 text-right text-teal-700">${b.str_revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td class="px-4 py-3 text-right text-amber-700">${b.ltr_revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td class="px-4 py-3 text-right font-semibold">${b.total_revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td class="px-4 py-3 text-right">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium {b.winning_model === 'STR' ? 'bg-teal-100 text-teal-700' : b.winning_model === 'LTR' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}">
                    {b.winning_model}
                  </span>
                </td>
                <td class="px-4 py-3 text-right text-gray-600">${b.revenue_opportunity_gap.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}
</div>
