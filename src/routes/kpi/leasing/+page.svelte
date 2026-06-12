<script lang="ts">
  import { onMount } from 'svelte';
  import { kpi, ytdRange } from '$lib/api/kpi';
  import type { LeasingKPI } from '$lib/api/kpi';
  import KPICard from '$lib/components/kpi/KPICard.svelte';
  import DateRangePicker from '$lib/components/kpi/DateRangePicker.svelte';
  import IntegrationBanner from '$lib/components/kpi/IntegrationBanner.svelte';
  import { Users, Target, TrendingUp, Clock, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-svelte';
  import { Chart } from 'svelte-echarts';
  import { init as echartsInit, use as echartsUse } from 'echarts/core';
  import { FunnelChart } from 'echarts/charts';
  import { TooltipComponent, LegendComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';
  echartsUse([FunnelChart, TooltipComponent, LegendComponent, CanvasRenderer]);

  let { start, end } = ytdRange();
  let leasing: LeasingKPI | null = null;
  let loading = true;
  let error: string | null = null;

  async function load() {
    loading = true; error = null;
    try {
      leasing = await kpi.leasing(start, end);
    } catch (e: any) { error = e.message; }
    finally { loading = false; }
  }

  onMount(load);

  function onDateChange(e: CustomEvent<{ start: string; end: string }>) {
    start = e.detail.start; end = e.detail.end; load();
  }

  $: ghlPending = leasing?.integration_status?.lead_data === 'pending_ghl_sync';

  $: funnelChart = leasing ? {
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    legend: { data: ['Leads', 'Qualified', 'Applications', 'Leases'], bottom: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
    series: [{
      type: 'funnel',
      left: '10%',
      top: 20,
      width: '80%',
      minSize: '20%',
      maxSize: '100%',
      sort: 'descending',
      gap: 4,
      data: [
        { value: leasing.total_leads, name: 'Leads', itemStyle: { color: '#0d9488' } },
        { value: leasing.qualified_leads, name: 'Qualified', itemStyle: { color: '#3b82f6' } },
        { value: leasing.application_starts, name: 'Applications', itemStyle: { color: '#f59e0b' } },
        { value: leasing.executed_leases, name: 'Leases', itemStyle: { color: '#10b981' } },
      ],
      label: { show: true, position: 'inside', color: '#fff', fontWeight: 600, fontSize: 12,
        formatter: (p: any) => `${p.name}: ${p.value}` },
    }]
  } : null;
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Leasing KPI Dashboard</h1>
      <p class="text-sm text-gray-500">Lead funnel, conversion rates, time to lease, vacancy days</p>
    </div>
    <div class="flex items-center gap-2">
      <DateRangePicker {start} {end} on:change={onDateChange} />
      <button class="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50" on:click={load}>
        <RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" />
      </button>
    </div>
  </div>

  {#if error}<div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>{/if}

  {#if ghlPending}
    <IntegrationBanner
      system="GoHighLevel CRM"
      description="Full leasing KPIs require GoHighLevel webhook integration. Lead data from GoHighLevel will flow through the CRM tables (lead_opportunity, lead_lifecycle_event). The CRM-agnostic backend is ready — GoHighLevel is temporary infrastructure that can be replaced with Salesforce or any CRM without backend redesign. All leasing leads must enter the CRM."
    />
  {/if}

  <!-- Data Architecture Note -->
  <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
    <p class="font-semibold mb-1">Source System Architecture</p>
    <div class="grid grid-cols-2 gap-4 text-xs text-gray-600">
      <div>
        <p class="font-medium text-gray-700 mb-1">GoHighLevel owns:</p>
        <ul class="list-disc list-inside space-y-0.5">
          <li>Lead intake & routing</li>
          <li>Funnel stages</li>
          <li>Campaign workflows & attribution</li>
          <li>Tour scheduling</li>
          <li>Lead follow-up workflows</li>
        </ul>
      </div>
      <div>
        <p class="font-medium text-gray-700 mb-1">Jurny owns:</p>
        <ul class="list-disc list-inside space-y-0.5">
          <li>Application starts</li>
          <li>Application approval</li>
          <li>Lease execution</li>
          <li>Tenant records</li>
          <li>Available for lease timestamp</li>
        </ul>
      </div>
    </div>
    <p class="mt-2 text-amber-700 font-medium">GoHighLevel is temporary infrastructure. The backend remains CRM-agnostic for future migration to Salesforce or proprietary CRM.</p>
  </div>

  <!-- Lead Volume & Funnel -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Lead Funnel</h2>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
      <KPICard title="Total Leads" value={leasing?.total_leads ?? null} format="number" icon={Users} color="teal" {loading} pending={ghlPending} pendingLabel="GoHighLevel" subtitle="All leads created" />
      <KPICard title="Qualified Leads" value={leasing?.qualified_leads ?? null} format="number" icon={Target} color="blue" {loading} pending={ghlPending} pendingLabel="GoHighLevel" subtitle="Moved to qualified stage" />
      <KPICard title="Application Starts" value={leasing?.application_starts ?? null} format="number" icon={CheckCircle2} color="amber" {loading} pending={ghlPending || leasing?.integration_status?.application_approval === 'pending_jurny_applicant_sync'} pendingLabel="GHL + Jurny" />
      <KPICard title="Executed Leases" value={leasing?.executed_leases ?? null} format="number" icon={CheckCircle2} color="green" {loading} pending={ghlPending} pendingLabel="GoHighLevel" />
    </div>
    {#if leasing && funnelChart && !ghlPending && leasing.total_leads > 0}
      <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <Chart init={echartsInit} options={funnelChart} style="height:280px" />
      </div>
    {:else if !ghlPending}
      <div class="rounded-xl border border-gray-100 bg-white p-8 text-center text-gray-400 shadow-sm">
        <Users class="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p class="text-sm">No lead data for this period</p>
      </div>
    {/if}
  </section>

  <!-- Conversion Rates -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Conversion Rates</h2>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <KPICard title="Lead → Qualified" value={leasing?.lead_to_qualified_rate_pct ?? null} format="percent" color="teal" {loading} pending={ghlPending} pendingLabel="GoHighLevel" />
      <KPICard title="Application → Lease" value={leasing?.application_to_lease_rate_pct ?? null} format="percent" color="green" {loading} pending={ghlPending} pendingLabel="GoHighLevel" />
      <KPICard title="Lead → Lease Rate" value={leasing?.lead_to_lease_rate_pct ?? null} format="percent" icon={TrendingUp} color="blue" {loading} pending={ghlPending} pendingLabel="GoHighLevel" />
      <KPICard title="Application Approval Rate" value={null} format="percent" color="purple" pending pendingLabel="Jurny Applicant API" subtitle="Approved ÷ Completed applications" />
    </div>
  </section>

  <!-- Time KPIs -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Timing KPIs</h2>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <KPICard title="Avg Lead Response Time" value={leasing?.avg_lead_response_time_hours ?? null} format="hours" icon={Clock} color="teal" pending pendingLabel="GHL Webhook" subtitle="first_response_at − lead_created_at" />
      <KPICard title="Avg Time to Lease" value={leasing?.avg_time_to_lease_days ?? null} format="days" color="blue" pending pendingLabel="Jurny + Availability Registry" subtitle="lease_execution − available_for_lease" />
      <KPICard title="Vacancy Days to Lease" value={leasing?.vacancy_days_to_lease ?? null} format="days" color="amber" pending pendingLabel="Jurny + Availability Registry" subtitle="lease_execution − prev occupancy_end" />
      <KPICard title="Avg Tour → Application" value={null} format="days" color="purple" pending pendingLabel="GoHighLevel" subtitle="Tour scheduling data" />
    </div>
    <div class="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-700">
      <p class="font-semibold mb-1">Required Data for Timing KPIs</p>
      <ul class="list-disc list-inside space-y-0.5">
        <li>Lead response time: Responses must occur inside tracked systems (GoHighLevel webhook)</li>
        <li>Time to Lease: Availability dates must be tracked consistently whenever units become lease-ready</li>
        <li>Vacancy Days: Move-out dates and lease-ready dates must remain normalized</li>
      </ul>
    </div>
  </section>

  <!-- Integration Status -->
  {#if leasing?.integration_status}
    <section>
      <h2 class="mb-3 text-base font-semibold text-gray-700">Integration Status</h2>
      <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div class="grid grid-cols-2 gap-2 text-sm">
          {#each Object.entries(leasing.integration_status) as [key, status]}
            <div class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <span class="text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
              <span class="rounded-full px-2 py-0.5 text-xs font-medium {status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">
                {status === 'active' ? '✓ Active' : 'Pending'}
              </span>
            </div>
          {/each}
        </div>
      </div>
    </section>
  {/if}
</div>
