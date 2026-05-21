<script lang="ts">
  import type { DashboardData } from '../types/dashboard';
  import { dashboardLoading, unitFilteringData, yoyData, yoyLoading, dashboardDateRange } from '../stores/simpleDashboardStore';
  import { userRole } from '../api/auth';
  import WelcomeCard from './dashboard/WelcomeCard.svelte';
  import CardWidget from './dashboard/CardWidget.svelte';

  export let dashboardData: DashboardData;

  $: loading = $dashboardLoading;
  $: unitData = $unitFilteringData;
  $: isOwner = $userRole === 'owner';
  $: yoy = $yoyData;
  $: yoyLoad = $yoyLoading;
  $: currentRange = $dashboardDateRange;

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }
  function formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }
  function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }
  function formatDays(value: number): string {
    return `${Math.round(value)} days`;
  }

  // ── YoY helpers ──────────────────────────────────────────────────────────
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function _fmt(dateStr: string): string {
    // Add time to avoid timezone issues with date parsing
    const d = new Date(dateStr + 'T00:00:00');
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function _shiftBack(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  }

  $: yoyLabel = currentRange
    ? (() => {
        const s = _shiftBack(currentRange.startDate);
        const e = _shiftBack(currentRange.endDate);
        const sd = new Date(s + 'T00:00:00'), ed = new Date(e + 'T00:00:00');
        if (sd.getFullYear() === ed.getFullYear() && sd.getMonth() === ed.getMonth())
          return _fmt(s);
        if (sd.getFullYear() === ed.getFullYear())
          return `${MONTHS[sd.getMonth()]}–${MONTHS[ed.getMonth()]} ${sd.getFullYear()}`;
        return `${_fmt(s)} – ${_fmt(e)}`;
      })()
    : '';

  function pct(current: number, prev: number | null | undefined): number | null {
    if (prev == null || prev === 0) return null;
    return ((current - prev) / Math.abs(prev)) * 100;
  }

  function comp(
    current: number,
    prev: number | null | undefined,
    higherIsBetter: boolean,
    fmt: (v: number) => string
  ) {
    return {
      prevLoading: yoyLoad,
      prevValueFormatted: (!yoyLoad && yoy != null && prev != null) ? fmt(prev) : null,
      prevLabel: yoyLabel ? `vs. ${yoyLabel}` : '',
      changePct: (yoy != null && prev != null) ? pct(current, prev) : null,
      higherIsBetter,
    };
  }
</script>

<div class="dashboard-summary">
  
  <WelcomeCard />
  <p class="subtitle">Real-time data from Doorloop (Long-term) and Guesty (Short-term)</p>
  

  
  <!-- Revenue Section -->
  <div class="section">
    <h2>📊 Revenue Overview</h2>
    <div class="cards-grid">
      <CardWidget
        info="Formula: longterm revenue + shortterm revenue"
        {...comp(dashboardData.totalRevenue, yoy?.totalRevenue, true, formatCurrency)}
      >
        <span slot="title" class="mb-1 text-xs text-gray-500 font-semibold">
          {#if unitData}Total Revenue (Filtered){:else}Total Revenue{/if}
        </span>
        <div class="card-value text-2xl font-bold text-[color:var(--color-propolis-teal)]">
          {#if unitData && unitData.filters_applied?.type === 'long-term' && unitData.data.length > 0}
            {formatCurrency(unitData.data.reduce((sum, item) => sum + (item.Revenue || 0), 0))}
          {:else if unitData && unitData.filters_applied?.type === 'short-term' && unitData.data.length > 0}
            {formatCurrency(unitData.data.reduce((sum, item) => sum + (item.Revenue || 0), 0))}
          {:else}
            {formatCurrency(dashboardData.totalRevenue)}
          {/if}
        </div>
        {#if unitData}
          <div class="text-xs text-gray-500 mt-1">{unitData.filters_applied.property} - {unitData.filters_applied.unit}</div>
        {/if}
      </CardWidget>

      <CardWidget
        info="Cash basis: counts rent the month the payment was received. Matches DoorLoop's P&L and typical owner reporting."
        {...comp(dashboardData.longTermRevenue, yoy?.longTermRevenue, true, formatCurrency)}
      >
        <span slot="title" class="mb-1 text-xs text-gray-500 font-semibold">
          {#if unitData && unitData.filters_applied?.type === 'long-term'}
            Long Term Revenue (Filtered)
          {:else}
            Long Term Revenue{#if isOwner} <span class="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">Cash</span>{/if}
          {/if}
        </span>
        <div class="card-value text-2xl font-bold text-[color:var(--color-propolis-teal)]">
          {#if unitData && unitData.filters_applied?.type === 'long-term' && unitData.data.length > 0}
            {formatCurrency(unitData.data.reduce((sum, item) => sum + (item.Revenue || 0), 0))}
          {:else if unitData && unitData.filters_applied?.type === 'short-term'}
            {formatCurrency(0)}
          {:else}
            {formatCurrency(dashboardData.longTermRevenue)}
          {/if}
        </div>
        {#if unitData && unitData.filters_applied?.type === 'long-term'}
          <div class="text-xs text-gray-500 mt-1">{unitData.filters_applied.property} - {unitData.filters_applied.unit}</div>
        {/if}
      </CardWidget>

      {#if isOwner && dashboardData.longTermRevenueAccrual != null && (!unitData || !unitData.filters_applied)}
        <CardWidget
          info="Accrual basis: counts rent in the month it was earned, regardless of when it was paid. Owner view only."
          {...comp(dashboardData.longTermRevenueAccrual, yoy?.longTermRevenueAccrual, true, formatCurrency)}
        >
          <span slot="title" class="mb-1 text-xs text-gray-500 font-semibold">
            Long Term Revenue <span class="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">Accrual</span>
          </span>
          <div class="card-value text-2xl font-bold text-purple-700">
            {formatCurrency(dashboardData.longTermRevenueAccrual)}
          </div>
        </CardWidget>
      {/if}

      <CardWidget
        info="Formula: Short term gross income"
        {...comp(dashboardData.shortTermRevenue, yoy?.shortTermRevenue, true, formatCurrency)}
      >
        <span slot="title" class="mb-1 text-xs text-gray-500 font-semibold">
          {#if unitData && unitData.filters_applied?.type === 'short-term'}Short Term Revenue (Filtered){:else}Short Term Revenue{/if}
        </span>
        <div class="card-value text-2xl font-bold text-[color:var(--color-propolis-teal)]">
          {#if unitData && unitData.filters_applied?.type === 'short-term' && unitData.data.length > 0}
            {formatCurrency(unitData.data.reduce((sum, item) => sum + (item.Revenue || 0), 0))}
          {:else}
            {formatCurrency(dashboardData.shortTermRevenue)}
          {/if}
        </div>
        {#if unitData && unitData.filters_applied?.type === 'short-term'}
          <div class="text-xs text-gray-500 mt-1">{unitData.filters_applied.property} - {unitData.filters_applied.unit}</div>
        {/if}
      </CardWidget>
     
    </div>
  </div>
  
  <!-- Occupancy Section -->
  <div class="section">
    <h2>🏠 Occupancy Rates</h2>
    <div class="cards-grid">
      <CardWidget
        info="Formula: longterm occupancy + shortterm occupancy / 2"
        {...comp(dashboardData.averageOccupancyRate, yoy?.averageOccupancyRate, true, formatPercentage)}
      >
        <span slot="title" class="mb-1 text-xs text-gray-500 font-semibold">Average Occupancy</span>
        <div class="card-value text-2xl font-bold text-[color:var(--color-propolis-teal)]">{formatPercentage(dashboardData.averageOccupancyRate)}</div>
      </CardWidget>

      <CardWidget
        info="Binary: any active lease in the period counts as 100% occupied. Matches DoorLoop's UI."
        {...comp(dashboardData.longTermOccupancyRate, yoy?.longTermOccupancyRate, true, formatPercentage)}
      >
        <span slot="title" class="mb-1 text-xs text-gray-500 font-semibold">
          Long-term Occupancy{#if isOwner} <span class="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">Binary</span>{/if}
        </span>
        <div class="card-value text-2xl font-bold text-[color:var(--color-propolis-teal)]">{formatPercentage(dashboardData.longTermOccupancyRate)}</div>
      </CardWidget>

      {#if isOwner && dashboardData.longTermOccupancyRateProrated != null}
        <CardWidget
          info="Prorated: days of lease coverage ÷ days in period. Reflects mid-month move-ins/outs. Owner view only."
          {...comp(dashboardData.longTermOccupancyRateProrated, yoy?.longTermOccupancyRateProrated, true, formatPercentage)}
        >
          <span slot="title" class="mb-1 text-xs text-gray-500 font-semibold">
            Long-term Occupancy <span class="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">Prorated</span>
          </span>
          <div class="card-value text-2xl font-bold text-purple-700">{formatPercentage(dashboardData.longTermOccupancyRateProrated)}</div>
        </CardWidget>
      {/if}

      <CardWidget
        info="Formula: total occupied units / total units"
        {...comp(dashboardData.shortTermOccupancyRate, yoy?.shortTermOccupancyRate, true, formatPercentage)}
      >
        <span slot="title" class="mb-1 text-xs text-gray-500 font-semibold">Short-term Occupancy</span>
        <div class="card-value text-2xl font-bold text-[color:var(--color-propolis-yellow)]">{formatPercentage(dashboardData.shortTermOccupancyRate)}</div>
      </CardWidget>
    </div>
  </div>
  
  <!-- Additional Metrics -->
  <div class="section">
    <h2>📈 Additional Metrics</h2>
    <div class="cards-grid four-column">
      <CardWidget
        info="Formula: ( Σ (Lease End Date – Lease Start Date) ) ÷ (Number of Leases)"
        {...comp(dashboardData.averageLeaseTenancy, yoy?.averageLeaseTenancy, true, formatDays)}
      >
        <span slot="title" class="mb-1 text-xs text-gray-500 font-semibold">Avg Lease Tenancy</span>
        <div class="card-value text-2xl font-bold text-[color:var(--color-propolis-teal)]">{dashboardData.averageLeaseTenancy} days</div>
      </CardWidget>

      <CardWidget
        info="Formula: Σ (Lease Start Date – Vacancy Date) ) ÷ (Number of Leases Signed)"
        {...comp(dashboardData.timeToLease, yoy?.timeToLease, false, formatDays)}
      >
        <span slot="title" class="mb-1 text-xs text-gray-500 font-semibold">Time to Lease</span>
        <div class="card-value text-2xl font-bold text-[color:var(--color-propolis-teal)]">{dashboardData.timeToLease} days</div>
      </CardWidget>

      <CardWidget
        info="Formula: (Move-Outs ÷ Active Tenants) × 100"
        {...comp(dashboardData.tenantTurnover, yoy?.tenantTurnover, false, formatPercentage)}
      >
        <span slot="title" class="mb-1 text-xs text-gray-500 font-semibold">Tenant Turnover</span>
        <div class="card-value text-2xl font-bold text-[color:var(--color-propolis-yellow)]">{formatPercentage(dashboardData.tenantTurnover)}</div>
      </CardWidget>

      <CardWidget
        info="Formula: Total STR Revenue ÷ Nights Booked"
        {...comp(dashboardData.shortTermAverageDailyRate, yoy?.shortTermAverageDailyRate, true, formatCurrency)}
      >
        <span slot="title" class="mb-1 text-xs text-gray-500 font-semibold">Avg Daily Rate</span>
        <div class="card-value text-2xl font-bold text-[color:var(--color-propolis-yellow)]">{formatCurrency(dashboardData.shortTermAverageDailyRate)}</div>
      </CardWidget>

      <CardWidget
        info="Formula: Total STR Revenue ÷ Available Nights"
        {...comp(dashboardData.revenuePerAvailableRoom, yoy?.revenuePerAvailableRoom, true, formatCurrency)}
      >
        <span slot="title" class="mb-1 text-xs text-gray-500 font-semibold">Revenue per Available Room</span>
        <div class="card-value text-2xl font-bold text-[color:var(--color-propolis-teal)]">{formatCurrency(dashboardData.revenuePerAvailableRoom)}</div>
      </CardWidget>

      <CardWidget
        info="Formula: Total Charges - Total Amount Paid"
        {...comp(dashboardData.leaseBalanceOverdue, yoy?.leaseBalanceOverdue, false, formatCurrency)}
      >
        <span slot="title" class="mb-1 text-xs text-gray-500 font-semibold">Balance Overdue</span>
        <div class="card-value text-2xl font-bold text-[color:var(--color-propolis-yellow)]">{formatCurrency(dashboardData.leaseBalanceOverdue)}</div>
      </CardWidget>
    </div>
  </div>
</div>

<style>
  .dashboard-summary {
    padding: 0rem;
    max-width: 1400px;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  
  .subtitle {
    color: #6b7280;
    font-size: 1.1rem;
    margin: 0 0 2rem 0;
  }
  
  .section {
    margin-bottom: 3rem;
  }
  
  h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 1.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }
  .cards-grid.four-column {
    grid-template-columns: repeat(3, 1fr);
  }
  

  
  @media (max-width: 900px) {
    .cards-grid, .cards-grid.four-column {
      grid-template-columns: 1fr;
    }
  }
 
  
  .card-value {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }
  
 
  
  @media (max-width: 768px) {
    .dashboard-summary {
      padding: 1rem;
    }
    

    
    .cards-grid {
      grid-template-columns: 1fr;
    }
    
    .cards-grid.four-column {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style> 