<script lang="ts">
  import { onMount } from 'svelte';
  import { kpi, ytdRange } from '$lib/api/kpi';
  import type { MarketingKPI } from '$lib/api/kpi';
  import KPICard from '$lib/components/kpi/KPICard.svelte';
  import DateRangePicker from '$lib/components/kpi/DateRangePicker.svelte';
  import IntegrationBanner from '$lib/components/kpi/IntegrationBanner.svelte';
  import { Megaphone, DollarSign, Clock, TrendingUp, RefreshCw } from 'lucide-svelte';
  import { Chart } from 'svelte-echarts';
  import { init as echartsInit, use as echartsUse } from 'echarts/core';
  import { PieChart } from 'echarts/charts';
  import { TooltipComponent, LegendComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';
  echartsUse([PieChart, TooltipComponent, LegendComponent, CanvasRenderer]);

  let { start, end } = ytdRange();
  let marketing: MarketingKPI | null = null;
  let loading = true;
  let error: string | null = null;

  async function load() {
    loading = true; error = null;
    try {
      marketing = await kpi.marketing(start, end);
    } catch (e: any) { error = e.message; }
    finally { loading = false; }
  }

  onMount(load);

  function onDateChange(e: CustomEvent<{ start: string; end: string }>) {
    start = e.detail.start; end = e.detail.end; load();
  }

  const COLORS = ['#0d9488','#3b82f6','#f59e0b','#10b981','#8b5cf6','#ef4444','#6b7280'];

  $: sourcePieChart = marketing?.lead_source_breakdown?.length ? {
    tooltip: { trigger: 'item', formatter: '{b}: {c} leads ({d}%)' },
    legend: { bottom: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, position: 'outside', formatter: '{b}: {d}%', fontSize: 11 },
      emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold' } },
      data: (marketing?.lead_source_breakdown ?? []).map((s, i) => ({
        value: s.count,
        name: s.source,
        itemStyle: { color: COLORS[i % COLORS.length] }
      }))
    }]
  } : null;
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Marketing KPI Dashboard</h1>
      <p class="text-sm text-gray-500">Lead sources, cost per lead, campaign performance, response time</p>
    </div>
    <div class="flex items-center gap-2">
      <DateRangePicker {start} {end} on:change={onDateChange} />
      <button class="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50" on:click={load}>
        <RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" />
      </button>
    </div>
  </div>

  {#if error}<div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>{/if}

  <IntegrationBanner
    system="GoHighLevel — Campaign Data"
    description="Full marketing KPIs require GoHighLevel campaign sync and webhook integration. Lead source attribution must be mandatory for all leads. Marketing costs may initially require manual updates until automated integrations exist. Lead source attribution must be tracked: Website, Zillow, Apartments.com, Referral, Social."
  />

  <!-- Key Marketing Metrics -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Marketing Performance</h2>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <KPICard title="Total Leads" value={marketing?.total_leads ?? null} format="number" icon={Megaphone} color="teal" {loading} />
      <KPICard title="Cost Per Lead" value={marketing?.cost_per_lead ?? null} format="currency" icon={DollarSign} color="amber" {loading} pending={!marketing?.cost_per_lead} pendingLabel="Manual campaign cost" subtitle="Campaign Spend ÷ Leads" />
      <KPICard title="Avg Lead Response Time" value={marketing?.avg_lead_response_time_hours ?? null} format="hours" icon={Clock} color="blue" {loading} pending pendingLabel="GHL Webhook" subtitle="first_response_at − lead_created_at" />
      <KPICard title="Lead-to-Lease Rate" value={null} format="percent" icon={TrendingUp} color="green" {loading} pending pendingLabel="GHL + Jurny" subtitle="Executed leases ÷ total leads" />
    </div>
  </section>

  <!-- Lead Source Attribution -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Lead Source Volume</h2>
    <p class="text-xs text-gray-500 mb-3">Count of leads grouped by source. Lead source attribution must be mandatory. Examples: Website, Zillow, Apartments.com, Referral, Social.</p>

    {#if marketing?.lead_source_breakdown?.length && sourcePieChart}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <Chart init={echartsInit} options={sourcePieChart} style="height:280px" />
        </div>
        <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <table class="w-full text-sm">
            <thead class="text-xs text-gray-500 uppercase">
              <tr>
                <th class="pb-2 text-left">Source</th>
                <th class="pb-2 text-right">Leads</th>
                <th class="pb-2 text-right">% Share</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              {#each (marketing?.lead_source_breakdown ?? []) as row, i}
                <tr class="hover:bg-gray-50">
                  <td class="py-2 flex items-center gap-2">
                    <span class="inline-block h-2.5 w-2.5 rounded-full" style="background: {COLORS[i % COLORS.length]}"></span>
                    <span class="capitalize font-medium text-gray-800">{row.source}</span>
                  </td>
                  <td class="py-2 text-right font-semibold">{row.count}</td>
                  <td class="py-2 text-right text-gray-500">{row.pct.toFixed(1)}%</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {:else}
      <div class="rounded-xl border border-gray-100 bg-white p-8 text-center text-gray-400 shadow-sm">
        <Megaphone class="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p class="text-sm">No lead source data available. Connect GoHighLevel to populate this chart.</p>
      </div>
    {/if}
  </section>

  <!-- Campaign Performance -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Campaign Performance</h2>
    <div class="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
      <p class="font-semibold mb-1">Cost Per Lead Calculation</p>
      <p class="text-xs mb-2">Formula: Campaign Spend ÷ Leads Generated</p>
      <p class="text-xs">Required fields per campaign: campaign_id, campaign_cost, lead_count. Marketing costs may initially require manual updates until automated integrations exist.</p>
    </div>
    <div class="mt-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm text-sm text-gray-500 text-center py-8">
      Campaign performance data will appear here once GoHighLevel campaign sync is active.
    </div>
  </section>

  <!-- Integration Status -->
  {#if marketing?.integration_status}
    <section>
      <h2 class="mb-3 text-base font-semibold text-gray-700">Integration Status</h2>
      <div class="grid grid-cols-2 gap-2 text-sm">
        {#each Object.entries(marketing.integration_status) as [key, status]}
          <div class="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-sm">
            <span class="text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
            <span class="rounded-full px-2 py-0.5 text-xs font-medium {status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">
              {status === 'active' ? '✓ Active' : 'Pending'}
            </span>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>
