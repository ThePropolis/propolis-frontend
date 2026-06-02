<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import {
    Users, ArrowRight, RefreshCw, ChevronRight, X,
    CheckCircle2, Circle, BookOpen
  } from 'lucide-svelte';
  import { getLeads, getLead, getLifecycleStatuses, updateLeadStatus, getSourcePlatforms } from '$lib/api/crm';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import { toast } from '$lib/components/ui/toastStore';

  type Lead = {
    id: string;
    business_line: 'LTR' | 'STR';
    created_at: string;
    utm_source: string | null;
    utm_campaign: string | null;
    person: { id: string; full_legal_name: string; primary_email: string; primary_phone: string | null } | null;
    source_platform: { platform_name: string; platform_category: string } | null;
    lifecycle_status: { status_name: string; is_closed_status: boolean } | null;
  };

  type LeadDetail = {
    lead: Lead & {
      budget_min: number | null;
      budget_max: number | null;
      desired_move_in_date: string | null;
      ghl_opportunity_id: string | null;
    };
    history: {
      id: string;
      from_status: { status_name: string } | null;
      to_status: { status_name: string } | null;
      source_system: string;
      notes: string | null;
      created_at: string;
    }[];
  };

  let leads: Lead[] = [];
  let statuses: { id: string; status_name: string; status_order: number; is_closed_status: boolean; business_line: string }[] = [];
  let loading = true;
  let selectedLead: LeadDetail | null = null;
  let detailLoading = false;
  let advancingStatus = false;
  let filterBL: 'all' | 'LTR' | 'STR' = 'all';
  let showLegend = false;
  let platforms: { platform_name: string; platform_category: string; business_line: string; notes: string | null }[] = [];

  onMount(async () => {
    await reload();
    platforms = await getSourcePlatforms().catch(() => []);
  });

  async function reload() {
    loading = true;
    try {
      [leads, statuses] = await Promise.all([
        getLeads({ limit: 200 }),
        getLifecycleStatuses()
      ]);
    } catch {
      toast.error('Failed to load leads');
    } finally {
      loading = false;
    }
  }

  async function openLead(id: string) {
    if (selectedLead?.lead.id === id) { selectedLead = null; return; }
    detailLoading = true;
    selectedLead = null;
    try {
      selectedLead = await getLead(id);
    } catch {
      toast.error('Failed to load lead details');
    } finally {
      detailLoading = false;
    }
  }

  async function advanceStatus(leadId: string, statusId: string, statusName: string) {
    advancingStatus = true;
    try {
      await updateLeadStatus(leadId, statusId, `Advanced to ${statusName}`);
      toast.success(`Status → ${statusName}`);
      selectedLead = await getLead(leadId);
      const idx = leads.findIndex(l => l.id === leadId);
      if (idx !== -1) {
        leads[idx] = { ...leads[idx], lifecycle_status: { status_name: statusName, is_closed_status: false } };
        leads = [...leads];
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      advancingStatus = false;
    }
  }

  function nextStatus(currentStatusName: string | undefined, bl: string) {
    const blStatuses = statuses.filter(s => s.business_line === bl || s.business_line === 'Both');
    const current = blStatuses.find(s => s.status_name === currentStatusName);
    if (!current) return null;
    return blStatuses
      .filter(s => s.status_order > current.status_order && !s.is_closed_status)
      .sort((a, b) => a.status_order - b.status_order)[0] ?? null;
  }

  function statusColor(name: string | undefined, closed: boolean | undefined) {
    if (closed) return 'bg-emerald-100 text-emerald-700';
    if (!name) return 'bg-zinc-100 text-zinc-500';
    const n = name.toLowerCase();
    if (n.includes('lost') || n.includes('rejected')) return 'bg-red-100 text-red-600';
    if (n.includes('tour')) return 'bg-blue-100 text-blue-700';
    if (n.includes('application') || n.includes('approved')) return 'bg-violet-100 text-violet-700';
    if (n.includes('lease')) return 'bg-amber-100 text-amber-700';
    if (n.includes('new')) return 'bg-zinc-100 text-zinc-600';
    return 'bg-sky-100 text-sky-700';
  }

  function platformColor(cat: string | undefined) {
    if (!cat) return 'bg-zinc-100 text-zinc-500';
    if (cat === 'Listing') return 'bg-blue-50 text-blue-600';
    if (cat === 'Niche Housing') return 'bg-purple-50 text-purple-600';
    if (cat === 'Social') return 'bg-pink-50 text-pink-600';
    if (cat === 'Referral') return 'bg-orange-50 text-orange-600';
    return 'bg-zinc-100 text-zinc-500';
  }

  function timeAgo(ts: string) {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // Turn "miami_rentals_june" into "Miami Rentals June"
  function humanize(s: string | null) {
    if (!s) return '';
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Map UTM medium codes to plain English
  function mediumLabel(m: string | null) {
    if (!m) return '';
    const map: Record<string, string> = {
      cpc: 'Paid Ad', ppc: 'Paid Ad', paid: 'Paid Ad',
      organic: 'Organic Search', email: 'Email', referral: 'Referral',
      social: 'Social Media', listing: 'Listing', direct: 'Direct'
    };
    return map[m.toLowerCase()] ?? humanize(m);
  }

  $: filtered = filterBL === 'all' ? leads : leads.filter(l => l.business_line === filterBL);
  $: ltrCount = leads.filter(l => l.business_line === 'LTR').length;
  $: strCount = leads.filter(l => l.business_line === 'STR').length;
  $: openCount = leads.filter(l => !l.lifecycle_status?.is_closed_status).length;

</script>

<div class="flex h-full min-h-0 overflow-hidden">

  <!-- Main panel -->
  <div class="flex flex-col flex-1 min-w-0 overflow-hidden">

    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
          <Users size={16} class="text-violet-600" />
        </div>
        <div>
          <h1 class="text-base font-semibold text-zinc-900">Leads</h1>
          <p class="text-xs text-zinc-400">Source-tracked · Deduplicated · Lifecycle-owned</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          on:click={() => { showLegend = !showLegend; selectedLead = null; }}
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
            {showLegend ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'}"
        >
          <BookOpen size={12} />
          Guide
        </button>
        <button
          on:click={reload}
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors"
        >
          <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
    </div>

    <!-- Stats bar -->
    <div class="flex items-center gap-6 px-6 py-2.5 bg-white border-b border-zinc-100 shrink-0">
      <div class="text-sm">
        <span class="font-semibold text-zinc-800">{leads.length}</span>
        <span class="text-zinc-400 ml-1">total</span>
      </div>
      <div class="text-sm">
        <span class="font-semibold text-zinc-800">{openCount}</span>
        <span class="text-zinc-400 ml-1">open</span>
      </div>
      <div class="text-sm">
        <span class="font-semibold text-blue-600">{ltrCount}</span>
        <span class="text-zinc-400 ml-1">LTR</span>
      </div>
      <div class="text-sm">
        <span class="font-semibold text-amber-600">{strCount}</span>
        <span class="text-zinc-400 ml-1">STR</span>
      </div>
      <div class="ml-auto flex items-center gap-1">
        {#each ['all', 'LTR', 'STR'] as bl}
          <button
            on:click={() => (filterBL = bl)}
            class="px-3 py-1 text-xs rounded-full font-medium transition-colors
              {filterBL === bl ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-200'}"
          >
            {bl === 'all' ? 'All' : bl}
          </button>
        {/each}
      </div>
    </div>

    <!-- Table -->
    <div class="flex-1 overflow-y-auto">
      {#if loading}
        <div class="flex items-center justify-center h-40">
          <Spinner size="sm" />
        </div>
      {:else if filtered.length === 0}
        <div class="flex flex-col items-center justify-center h-40 gap-2 text-zinc-400">
          <Users size={28} class="opacity-30" />
          <p class="text-sm">No leads yet</p>
        </div>
      {:else}
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-zinc-400 uppercase tracking-wide border-b border-zinc-100">
              <th class="text-left px-6 py-3 font-medium">Person</th>
              <th class="text-left px-6 py-3 font-medium">Source</th>
              <th class="text-left px-6 py-3 font-medium">Stage</th>
              <th class="text-left px-6 py-3 font-medium">Type</th>
              <th class="text-left px-6 py-3 font-medium">Attribution</th>
              <th class="text-left px-6 py-3 font-medium">Created</th>
              <th class="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {#each filtered as lead (lead.id)}
              <tr
                class="border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer transition-colors
                  {selectedLead?.lead.id === lead.id ? 'bg-violet-50' : ''}"
                on:click={() => openLead(lead.id)}
              >
                <td class="px-6 py-3.5">
                  <p class="font-medium text-zinc-900 text-sm leading-tight">
                    {lead.person?.full_legal_name ?? '—'}
                  </p>
                  <p class="text-xs text-zinc-400 mt-0.5">{lead.person?.primary_email ?? ''}</p>
                </td>
                <td class="px-6 py-3.5">
                  {#if lead.source_platform}
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                      {platformColor(lead.source_platform.platform_category)}">
                      {lead.source_platform.platform_name}
                    </span>
                  {:else}
                    <span class="text-zinc-300 text-xs">—</span>
                  {/if}
                </td>
                <td class="px-6 py-3.5">
                  {#if lead.lifecycle_status}
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
                      {statusColor(lead.lifecycle_status.status_name, lead.lifecycle_status.is_closed_status)}">
                      {#if lead.lifecycle_status.is_closed_status}
                        <CheckCircle2 size={10} />
                      {:else}
                        <Circle size={10} />
                      {/if}
                      {lead.lifecycle_status.status_name}
                    </span>
                  {:else}
                    <span class="text-zinc-300">—</span>
                  {/if}
                </td>
                <td class="px-6 py-3.5">
                  <span class="inline-flex px-2 py-0.5 rounded text-xs font-semibold
                    {lead.business_line === 'LTR' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}">
                    {lead.business_line}
                  </span>
                </td>
                <td class="px-6 py-3.5">
                  {#if lead.utm_source}
                    <p class="text-xs text-zinc-600">
                      {humanize(lead.utm_source)}{lead.utm_campaign ? ` · ${humanize(lead.utm_campaign)}` : ''}
                    </p>
                  {:else}
                    <span class="text-zinc-300 text-xs">—</span>
                  {/if}
                </td>
                <td class="px-6 py-3.5 text-xs text-zinc-400">{timeAgo(lead.created_at)}</td>
                <td class="px-6 py-3.5">
                  <ChevronRight size={13} class="text-zinc-300" />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>

  <!-- Legend / Guide panel -->
  {#if showLegend}
    <div
      class="w-[420px] shrink-0 border-l border-zinc-200 bg-white flex flex-col overflow-hidden"
      in:fly={{ x: 16, duration: 160 }}
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 shrink-0">
        <div class="flex items-center gap-2">
          <BookOpen size={14} class="text-zinc-500" />
          <h2 class="font-semibold text-zinc-800 text-sm">Reference Guide</h2>
        </div>
        <button
          on:click={() => (showLegend = false)}
          class="text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded p-1 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-6">

        <!-- Business lines -->
        <section>
          <p class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Rental Type</p>
          <div class="space-y-2">
            <div class="flex gap-3 items-start p-3 bg-blue-50 rounded-lg">
              <span class="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 shrink-0 mt-0.5">LTR</span>
              <div>
                <p class="text-xs font-semibold text-zinc-800">Long-Term Rental</p>
                <p class="text-xs text-zinc-500 mt-0.5">A standard lease, typically month-to-month or 12 months. The tenant pays monthly rent and lives in the unit full-time.</p>
              </div>
            </div>
            <div class="flex gap-3 items-start p-3 bg-amber-50 rounded-lg">
              <span class="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 shrink-0 mt-0.5">STR</span>
              <div>
                <p class="text-xs font-semibold text-zinc-800">Short-Term Rental</p>
                <p class="text-xs text-zinc-500 mt-0.5">A nightly or weekly stay, like Airbnb or VRBO. The guest books for a few days or weeks, not a full lease.</p>
              </div>
            </div>
          </div>
        </section>

        <!-- LTR stages -->
        <section>
          <p class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Long-Term Rental — Lead Stages</p>
          <div class="space-y-1">
            {#each statuses.filter(s => s.business_line === 'LTR').sort((a,b) => a.status_order - b.status_order) as s}
              <div class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-50">
                <span class="text-xs font-semibold text-zinc-400 w-5 text-right shrink-0">{s.status_order}</span>
                <div class="flex-1 flex items-center justify-between gap-2">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
                    {s.is_closed_status ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}">
                    {#if s.is_closed_status}<CheckCircle2 size={10} />{:else}<Circle size={10} />{/if}
                    {s.status_name}
                  </span>
                  {#if s.is_closed_status}
                    <span class="text-xs text-zinc-300 italic">final</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </section>

        <!-- STR stages -->
        <section>
          <p class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Short-Term Rental — Lead Stages</p>
          <div class="space-y-1">
            {#each statuses.filter(s => s.business_line === 'STR').sort((a,b) => a.status_order - b.status_order) as s}
              <div class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-50">
                <span class="text-xs font-semibold text-zinc-400 w-5 text-right shrink-0">{s.status_order}</span>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
                  {s.is_closed_status ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}">
                  {#if s.is_closed_status}<CheckCircle2 size={10} />{:else}<Circle size={10} />{/if}
                  {s.status_name}
                </span>
              </div>
            {/each}
          </div>
        </section>

        <!-- Source platforms -->
        <section>
          <p class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Where Leads Come From</p>
          <div class="space-y-1">
            {#each ['Listing', 'Niche Housing', 'Social', 'Referral', 'Search', 'Direct'] as cat}
              {@const catPlatforms = platforms.filter(p => p.platform_category === cat)}
              {#if catPlatforms.length > 0}
                <p class="text-xs font-semibold text-zinc-400 mt-3 mb-1 px-1">{cat}</p>
                {#each catPlatforms as p}
                  <div class="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-zinc-50">
                    <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium shrink-0 mt-0.5
                      {platformColor(p.platform_category)}">
                      {p.platform_name}
                    </span>
                    {#if p.notes}
                      <p class="text-xs text-zinc-400 leading-relaxed">{p.notes}</p>
                    {/if}
                  </div>
                {/each}
              {/if}
            {/each}
          </div>
        </section>

        <!-- Stage colors -->
        <section>
          <p class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Status Colors</p>
          <div class="space-y-2">
            {#each [
              { color: 'bg-zinc-100 text-zinc-600', label: 'Grey', meaning: 'New or early-stage — no action taken yet' },
              { color: 'bg-blue-100 text-blue-700', label: 'Blue', meaning: 'Tour scheduled or in progress' },
              { color: 'bg-violet-100 text-violet-700', label: 'Purple', meaning: 'Application submitted or under review' },
              { color: 'bg-amber-100 text-amber-700', label: 'Amber', meaning: 'Lease being prepared or sent' },
              { color: 'bg-emerald-100 text-emerald-700', label: 'Green', meaning: 'Closed and won — lead converted' },
              { color: 'bg-red-100 text-red-600', label: 'Red', meaning: 'Closed and lost — lead did not convert' },
            ] as row}
              <div class="flex items-center gap-3">
                <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium w-16 justify-center {row.color}">{row.label}</span>
                <p class="text-xs text-zinc-500">{row.meaning}</p>
              </div>
            {/each}
          </div>
        </section>

      </div>
    </div>
  {/if}

  <!-- Detail panel -->
  {#if detailLoading || selectedLead}
    <div
      class="w-96 shrink-0 border-l border-zinc-200 bg-white flex flex-col overflow-hidden"
      in:fly={{ x: 16, duration: 160 }}
    >
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 shrink-0">
        <h2 class="font-semibold text-zinc-800 text-sm">Lead Detail</h2>
        <button
          on:click={() => (selectedLead = null)}
          class="text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded p-1 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {#if detailLoading}
        <div class="flex items-center justify-center flex-1">
          <Spinner size="sm" />
        </div>
      {:else if selectedLead}
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          <!-- Person -->
          <section>
            <p class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Person</p>
            <div class="bg-zinc-50 rounded-lg p-3 space-y-1">
              <p class="font-semibold text-zinc-900 text-sm">{selectedLead.lead.person?.full_legal_name ?? '—'}</p>
              <p class="text-xs text-zinc-500">{selectedLead.lead.person?.primary_email ?? ''}</p>
              {#if selectedLead.lead.person?.primary_phone}
                <p class="text-xs text-zinc-500">{selectedLead.lead.person.primary_phone}</p>
              {/if}
            </div>
          </section>

          <!-- Lead info -->
          <section>
            <p class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Lead Info</p>
            <div class="space-y-2">
              <div class="flex justify-between text-xs">
                <span class="text-zinc-400">Type</span>
                <span class="font-medium text-zinc-800">{selectedLead.lead.business_line}</span>
              </div>
              {#if selectedLead.lead.source_platform}
                <div class="flex justify-between text-xs">
                  <span class="text-zinc-400">Source</span>
                  <span class="font-medium text-zinc-800">{selectedLead.lead.source_platform.platform_name}</span>
                </div>
              {/if}
              {#if selectedLead.lead.desired_move_in_date}
                <div class="flex justify-between text-xs">
                  <span class="text-zinc-400">Move-in</span>
                  <span class="font-medium text-zinc-800">{selectedLead.lead.desired_move_in_date}</span>
                </div>
              {/if}
              {#if selectedLead.lead.budget_min || selectedLead.lead.budget_max}
                <div class="flex justify-between text-xs">
                  <span class="text-zinc-400">Budget</span>
                  <span class="font-medium text-zinc-800">
                    ${selectedLead.lead.budget_min ?? '?'} – ${selectedLead.lead.budget_max ?? '?'}
                  </span>
                </div>
              {/if}
              {#if selectedLead.lead.ghl_opportunity_id}
                <div class="flex justify-between text-xs">
                  <span class="text-zinc-400">GHL Opportunity</span>
                  <span class="font-mono text-xs text-zinc-600">{selectedLead.lead.ghl_opportunity_id}</span>
                </div>
              {/if}
            </div>
          </section>

          <!-- Attribution -->
          {#if selectedLead.lead.utm_source}
            <section>
              <p class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">How They Found Us</p>
              <div class="bg-zinc-50 rounded-lg p-3 space-y-2">
                {#if selectedLead.lead.utm_source}
                  <div class="flex justify-between text-xs">
                    <span class="text-zinc-400">Channel</span>
                    <span class="font-medium text-zinc-800">{humanize(selectedLead.lead.utm_source)}</span>
                  </div>
                {/if}
                {#if selectedLead.lead.utm_medium}
                  <div class="flex justify-between text-xs">
                    <span class="text-zinc-400">Ad Type</span>
                    <span class="font-medium text-zinc-800">{mediumLabel(selectedLead.lead.utm_medium)}</span>
                  </div>
                {/if}
                {#if selectedLead.lead.utm_campaign}
                  <div class="flex justify-between text-xs">
                    <span class="text-zinc-400">Campaign</span>
                    <span class="font-medium text-zinc-800">{humanize(selectedLead.lead.utm_campaign)}</span>
                  </div>
                {/if}
              </div>
            </section>
          {/if}

          <!-- Stage + advance -->
          <section>
            <p class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Current Stage</p>
            {#if selectedLead.lead.lifecycle_status}
              <div class="flex items-center justify-between">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                  {statusColor(selectedLead.lead.lifecycle_status.status_name, selectedLead.lead.lifecycle_status.is_closed_status)}">
                  {#if selectedLead.lead.lifecycle_status.is_closed_status}
                    <CheckCircle2 size={11} />
                  {:else}
                    <Circle size={11} />
                  {/if}
                  {selectedLead.lead.lifecycle_status.status_name}
                </span>
                {#if !selectedLead.lead.lifecycle_status.is_closed_status}
                  {@const next = nextStatus(selectedLead.lead.lifecycle_status.status_name, selectedLead.lead.business_line)}
                  {#if next}
                    <button
                      disabled={advancingStatus}
                      on:click={() => advanceStatus(selectedLead.lead.id, next.id, next.status_name)}
                      class="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 text-white text-xs font-medium rounded-lg
                        hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                    >
                      {#if advancingStatus}
                        <Spinner size="xs" />
                      {:else}
                        <ArrowRight size={11} />
                      {/if}
                      {next.status_name}
                    </button>
                  {/if}
                {/if}
              </div>
            {/if}
          </section>

          <!-- Audit trail -->
          <section>
            <p class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
              History ({selectedLead.history.length} events)
            </p>
            <div class="space-y-0">
              {#each selectedLead.history as event, i (event.id)}
                <div class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <div class="w-2 h-2 rounded-full bg-violet-400 mt-0.5 shrink-0"></div>
                    {#if i < selectedLead.history.length - 1}
                      <div class="w-px flex-1 bg-zinc-100 my-1"></div>
                    {/if}
                  </div>
                  <div class="pb-3.5">
                    <p class="text-xs font-medium text-zinc-700">
                      {event.from_status ? event.from_status.status_name + ' →' : 'Created →'}
                      <span class="text-violet-600">{event.to_status?.status_name}</span>
                    </p>
                    {#if event.notes}
                      <p class="text-xs text-zinc-400 mt-0.5">{event.notes}</p>
                    {/if}
                    <p class="text-xs text-zinc-300 mt-0.5">via {event.source_system} · {timeAgo(event.created_at)}</p>
                  </div>
                </div>
              {/each}
            </div>
          </section>

        </div>
      {/if}
    </div>
  {/if}

</div>
