<script lang="ts">
  import { onMount } from 'svelte';
  import { kpi, ytdRange } from '$lib/api/kpi';
  import type { FinanceKPI, CollectionsKPI, LeaseAnalyticsKPI } from '$lib/api/kpi';
  import KPICard from '$lib/components/kpi/KPICard.svelte';
  import DateRangePicker from '$lib/components/kpi/DateRangePicker.svelte';
  import IntegrationBanner from '$lib/components/kpi/IntegrationBanner.svelte';
  import { DollarSign, TrendingUp, AlertTriangle, RefreshCw, Wallet } from 'lucide-svelte';

  let { start, end } = ytdRange();
  let finance: FinanceKPI | null = null;
  let collections: CollectionsKPI | null = null;
  let leaseAnalytics: LeaseAnalyticsKPI | null = null;
  let loading = true;
  let error: string | null = null;

  async function load() {
    loading = true; error = null;
    try {
      [finance, collections, leaseAnalytics] = await Promise.all([
        kpi.finance(start, end),
        kpi.collections(start, end).catch(() => null),
        kpi.leaseAnalytics(start, end).catch(() => null),
      ]);
    } catch (e: any) { error = e.message; }
    finally { loading = false; }
  }

  onMount(load);

  function onDateChange(e: CustomEvent<{ start: string; end: string }>) {
    start = e.detail.start; end = e.detail.end; load();
  }
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Finance KPI Dashboard</h1>
      <p class="text-sm text-gray-500">NOI, GOI, margins, cash flow, collections, delinquency, lease analytics</p>
    </div>
    <div class="flex items-center gap-2">
      <DateRangePicker {start} {end} on:change={onDateChange} />
      <button class="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50" on:click={load}>
        <RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" />
      </button>
    </div>
  </div>

  {#if error}<div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>{/if}

  <!-- Profitability -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Profitability</h2>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <KPICard title="Total Revenue" value={finance?.total_revenue ?? null} format="currency" icon={DollarSign} color="teal" {loading} />
      <KPICard title="GOI" value={finance?.goi ?? null} format="currency" icon={Wallet} color="blue" {loading} subtitle="Revenue − Vacancy − Delinquency" />
      <KPICard title="NOI" value={finance?.noi ?? null} format="currency" icon={TrendingUp} color="green" {loading} subtitle="GOI − Operating Expenses" />
      <KPICard title="Operating Margin" value={finance?.operating_margin_pct ?? null} format="percent" color="amber" {loading} />
    </div>
  </section>

  <!-- Expenses -->
  {#if finance?.expenses}
    <section>
      <h2 class="mb-3 text-base font-semibold text-gray-700">Operating Expenses</h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KPICard title="Total Expenses" value={finance.expenses.total_operating} format="currency" color="red" {loading} />
        <KPICard title="Cleaning" value={finance.expenses.cleaning} format="currency" color="teal" {loading} />
        <KPICard title="Maintenance" value={finance.expenses.maintenance} format="currency" color="amber" {loading} />
        <KPICard title="Utilities" value={finance.expenses.utilities} format="currency" color="blue" {loading} />
        <KPICard title="Insurance" value={finance.expenses.insurance} format="currency" color="red" {loading} />
        <KPICard title="Software" value={finance.expenses.software} format="currency" color="purple" {loading} />
        <KPICard title="Management Fees" value={finance.expenses.management_fees} format="currency" color="amber" {loading} />
        <KPICard title="Contractors" value={finance.expenses.contractors} format="currency" color="blue" {loading} />
      </div>
      <div class="mt-3 rounded-xl border border-gray-100 bg-white p-4 text-sm shadow-sm">
        <div class="flex justify-between">
          <span class="text-gray-500">Labor Cost % of Revenue</span>
          <span class="text-gray-400 italic">Pending Clock System integration</span>
        </div>
      </div>
    </section>
  {/if}

  <!-- Collections & Delinquency -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Collections & Delinquency</h2>
    {#if collections?.aging_buckets.integration_status === 'partial' || !collections}
      <IntegrationBanner
        system="Jurny Ledger API"
        description="Detailed aging buckets and per-tenant delinquency require Jurny leases/charges and payments API. Bulk totals are available now; per-tenant aging requires ledger endpoint access."
      />
    {/if}
    <div class="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <KPICard title="Scheduled Revenue" value={collections?.scheduled_revenue ?? null} format="currency" color="teal" {loading} />
      <KPICard title="Collected Revenue" value={collections?.collected_revenue ?? null} format="currency" color="green" {loading} />
      <KPICard title="Outstanding Balance" value={collections?.outstanding_balance ?? null} format="currency" color="red" {loading} />
      <KPICard title="Collection Rate" value={collections?.collection_rate_pct ?? null} format="percent" color="teal" {loading} />
      <KPICard title="Delinquency Rate" value={collections?.delinquency_rate_pct ?? null} format="percent" color="red" {loading} />
    </div>
    {#if collections?.aging_buckets}
      <div class="mt-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <p class="text-sm font-semibold text-gray-700 mb-3">Aging Buckets</p>
        <div class="grid grid-cols-4 gap-3 text-center">
          {#each [
            { label: '0–30 Days', value: collections.aging_buckets.bucket_0_30 },
            { label: '31–60 Days', value: collections.aging_buckets.bucket_31_60 },
            { label: '61–90 Days', value: collections.aging_buckets.bucket_61_90 },
            { label: '90+ Days', value: collections.aging_buckets.bucket_90_plus },
          ] as bucket}
            <div class="rounded-lg border border-gray-100 p-3">
              <p class="text-xs text-gray-500">{bucket.label}</p>
              <p class="text-lg font-bold {bucket.value > 0 ? 'text-red-600' : 'text-gray-400'}">
                {bucket.value > 0 ? `$${bucket.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
              </p>
            </div>
          {/each}
        </div>
        {#if collections.aging_buckets.integration_status === 'partial'}
          <p class="mt-2 text-xs text-amber-600">{collections.aging_buckets.note}</p>
        {/if}
      </div>
    {/if}
  </section>

  <!-- Lease Term Analytics -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Lease Term Analytics</h2>
    <p class="mb-2 text-xs text-gray-500">Lease duration changes the product being sold. A 3-month lease is not the same product as a 12-month lease. Averages are always segmented by lease duration.</p>
    {#if leaseAnalytics?.integration_status === 'pending'}
      <IntegrationBanner
        system="Lease Length Data"
        description="Lease length segmentation requires lease_length_months field to be populated during DoorLoop rentroll sync. Currently returning unsegmented data."
      />
    {/if}
    <div class="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <KPICard title="Weighted Avg Rent" value={leaseAnalytics?.weighted_average_rent ?? null} format="currency" color="teal" {loading} />
      <KPICard title="3-Month Avg Rent" value={leaseAnalytics?.average_rent_by_lease_length?.['3_month_avg_rent'] ?? null} format="currency" color="blue" {loading}
        pending={!leaseAnalytics?.average_rent_by_lease_length?.['3_month_avg_rent']} pendingLabel="No data" />
      <KPICard title="6-Month Avg Rent" value={leaseAnalytics?.average_rent_by_lease_length?.['6_month_avg_rent'] ?? null} format="currency" color="amber" {loading}
        pending={!leaseAnalytics?.average_rent_by_lease_length?.['6_month_avg_rent']} pendingLabel="No data" />
      <KPICard title="12-Month Avg Rent" value={leaseAnalytics?.average_rent_by_lease_length?.['12_month_avg_rent'] ?? null} format="currency" color="green" {loading}
        pending={!leaseAnalytics?.average_rent_by_lease_length?.['12_month_avg_rent']} pendingLabel="No data" />
      <KPICard title="14-Month Avg Rent" value={leaseAnalytics?.average_rent_by_lease_length?.['14_month_avg_rent'] ?? null} format="currency" color="purple" {loading}
        pending={!leaseAnalytics?.average_rent_by_lease_length?.['14_month_avg_rent']} pendingLabel="No data" />
    </div>
    {#if leaseAnalytics}
      <div class="mt-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm text-sm">
        <p class="font-semibold text-gray-700 mb-2">Lease Length Distribution</p>
        <div class="grid grid-cols-4 gap-3">
          {#each Object.entries(leaseAnalytics.lease_length_distribution) as [key, pct]}
            <div class="text-center">
              <div class="h-1.5 bg-teal-100 rounded-full overflow-hidden mb-1">
                <div class="h-full bg-teal-600 rounded-full" style="width: {pct}%"></div>
              </div>
              <p class="text-xs text-gray-500">{key.replace('_pct','').replace('_month','-mo')}</p>
              <p class="text-sm font-semibold text-gray-800">{pct.toFixed(1)}%</p>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </section>

  <!-- Cash Flow & Accounting note -->
  <section>
    <h2 class="mb-3 text-base font-semibold text-gray-700">Cash Flow</h2>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <KPICard title="Net Cash Flow" value={finance?.net_cash_flow ?? null} format="currency" icon={DollarSign} color="teal" {loading} subtitle="NOI (debt service required)" />
      <KPICard title="Debt Service" value={null} format="currency" color="red" pending pendingLabel="Manual Input Required" />
      <KPICard title="Capital Expenditures" value={null} format="currency" color="amber" pending pendingLabel="Manual Input Required" />
    </div>
    <div class="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
      <strong>Accounting Note:</strong> Mortgage principal, mortgage interest, owner distributions, and capital expenditure data must be entered manually until a debt-service data integration is implemented. These items are excluded from NOI per standard definition.
    </div>
  </section>
</div>
