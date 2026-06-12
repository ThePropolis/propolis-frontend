<script lang="ts">
  import { onMount } from 'svelte';
  import { ops, kpi, thisMonthRange } from '$lib/api/kpi';
  import type { ClockEvent, LaborStats } from '$lib/api/kpi';
  import { Clock, DollarSign, Users, Plus, X, RefreshCw, Pencil, Trash2, TrendingUp, BarChart3, Activity } from 'lucide-svelte';
  import DateRangePicker from '$lib/components/kpi/DateRangePicker.svelte';
  import KPICard from '$lib/components/kpi/KPICard.svelte';

  let { start, end } = thisMonthRange();
  let events: ClockEvent[] = [];
  let stats: LaborStats | null = null;
  let taskStats: any = null;
  let loading = true;
  let error: string | null = null;
  let activeTab: 'dashboard' | 'entries' = 'dashboard';

  let filterEmployee = '';
  let filterShiftType = '';

  let showForm = false;
  let editingEvent: ClockEvent | null = null;
  let saving = false;
  let draft = defaultDraft();

  function defaultDraft() {
    const now = new Date();
    return {
      employee_id: '',
      employee_name: '',
      clock_in: now.toISOString().slice(0, 16),
      clock_out: '',
      shift_type: 'maintenance',
      pay_rate: '',
    };
  }

  async function load() {
    loading = true; error = null;
    try {
      const params: Record<string, string | undefined> = {
        date_from: start, date_to: end,
        ...(filterEmployee ? { employee_id: filterEmployee } : {}),
        ...(filterShiftType ? { shift_type: filterShiftType } : {}),
      };
      const [evRes, statRes, tStatRes] = await Promise.all([
        ops.listClockEvents(params),
        ops.laborStats({ date_from: start, date_to: end }),
        ops.taskStats({ date_from: start, date_to: end }).catch(() => null),
      ]);
      events = evRes.events;
      stats = statRes;
      taskStats = tStatRes;
    } catch (e: any) { error = e.message; }
    finally { loading = false; }
  }

  onMount(load);

  function onDateChange(e: CustomEvent<{ start: string; end: string }>) {
    start = e.detail.start; end = e.detail.end; load();
  }

  function openCreate() { editingEvent = null; draft = defaultDraft(); showForm = true; }
  function openEdit(e: ClockEvent) {
    editingEvent = e;
    draft = {
      employee_id: e.employee_id,
      employee_name: e.employee_name ?? '',
      clock_in: e.clock_in ? e.clock_in.slice(0, 16) : '',
      clock_out: e.clock_out ? e.clock_out.slice(0, 16) : '',
      shift_type: e.shift_type,
      pay_rate: e.pay_rate != null ? String(e.pay_rate) : '',
    };
    showForm = true;
  }

  async function saveEvent() {
    if (!draft.employee_name && !draft.employee_id) { error = 'Employee name is required'; return; }
    if (!draft.clock_in) { error = 'Clock-in time is required'; return; }
    saving = true;
    try {
      const payload: any = {
        employee_id: draft.employee_id || draft.employee_name.toLowerCase().replace(/\s+/g, '_'),
        employee_name: draft.employee_name || draft.employee_id,
        clock_in: new Date(draft.clock_in).toISOString(),
        clock_out: draft.clock_out ? new Date(draft.clock_out).toISOString() : null,
        shift_type: draft.shift_type,
        pay_rate: draft.pay_rate ? parseFloat(draft.pay_rate) : null,
      };
      if (editingEvent) {
        await ops.updateClockEvent(editingEvent.id, payload);
      } else {
        await ops.createClockEvent(payload);
      }
      showForm = false;
      await load();
    } catch (e: any) { error = e.message; }
    finally { saving = false; }
  }

  async function deleteEvent(e: ClockEvent) {
    if (!confirm('Delete this labor entry?')) return;
    try { await ops.deleteClockEvent(e.id); await load(); }
    catch (e: any) { error = e.message; }
  }

  function shiftHours(e: ClockEvent): number {
    if (!e.clock_in || !e.clock_out) return 0;
    return Math.max(0, (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000);
  }
  function fmtCurrency(n: number | null | undefined): string {
    if (n == null) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  }
  function fmtDatetime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // Utilization = task hours / clocked hours
  $: utilizationPct = (stats?.total_clocked_hours && taskStats?.total_task_hours)
    ? Math.min(100, (taskStats.total_task_hours / stats.total_clocked_hours) * 100)
    : null;

  const SHIFT_COLORS: Record<string, string> = {
    maintenance: 'bg-teal-100 text-teal-700',
    cleaning: 'bg-amber-100 text-amber-700',
    admin: 'bg-blue-100 text-blue-700',
    other: 'bg-gray-100 text-gray-600',
  };

  $: previewHours = (draft.clock_in && draft.clock_out)
    ? Math.max(0, (new Date(draft.clock_out).getTime() - new Date(draft.clock_in).getTime()) / 3600000)
    : 0;
  $: previewCost = (previewHours > 0 && draft.pay_rate) ? previewHours * parseFloat(draft.pay_rate) : 0;
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Labor KPI Dashboard</h1>
      <p class="text-sm text-gray-500">Clocked hours, task hours, utilization rate, and labor costs</p>
    </div>
    <div class="flex items-center gap-2">
      <DateRangePicker {start} {end} on:change={onDateChange} />
      <button on:click={load} class="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50">
        <RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" />
      </button>
      <button on:click={openCreate} class="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
        <Plus class="h-4 w-4" /> Log Hours
      </button>
    </div>
  </div>

  {#if error}<div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>{/if}

  <!-- Tabs -->
  <div class="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-sm w-fit">
    <button on:click={() => (activeTab = 'dashboard')}
      class="rounded-md px-4 py-1.5 font-medium transition {activeTab === 'dashboard' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50'}">
      <span class="flex items-center gap-1.5"><BarChart3 class="h-3.5 w-3.5" /> KPI Dashboard</span>
    </button>
    <button on:click={() => (activeTab = 'entries')}
      class="rounded-md px-4 py-1.5 font-medium transition {activeTab === 'entries' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50'}">
      <span class="flex items-center gap-1.5"><Clock class="h-3.5 w-3.5" /> Labor Log ({events.length})</span>
    </button>
  </div>

  <!-- ═══════════════════════════════════════════════════════════ DASHBOARD TAB -->
  {#if activeTab === 'dashboard'}

    <!-- Architecture note -->
    <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
      <p class="font-semibold mb-1">Labor Architecture</p>
      <ul class="list-disc list-inside space-y-1 text-xs text-gray-600">
        <li><strong>Clocked Labor Hours</strong> = paid time logged here (manual or clock-system API)</li>
        <li><strong>Task Labor Hours</strong> = productive effort tracked in Operations tasks (tracked_minutes)</li>
        <li><strong>Utilization Rate</strong> = Task Hours ÷ Clocked Hours — productive vs. paid ratio</li>
      </ul>
    </div>

    <!-- Clocked Labor Hours -->
    <section>
      <div class="flex items-center gap-2 mb-3">
        <Clock class="h-5 w-5 text-teal-600" />
        <h2 class="text-base font-semibold text-gray-700">Clocked Labor Hours</h2>
      </div>
      <p class="text-xs text-gray-400 mb-3">Total paid labor hours. Source: manual entries + future clock-system API. Formula: sum of (clock_out − clock_in).</p>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KPICard title="Total Clocked Hours" value={stats?.total_clocked_hours ?? null} format="hours" icon={Clock} color="teal" {loading} />
        <KPICard title="Total Entries" value={stats?.total_events ?? null} format="number" color="blue" {loading} />
        <KPICard title="Total Labor Cost" value={stats?.total_labor_cost ?? null} format="currency" icon={DollarSign} color="green" {loading}
          subtitle="Hours × pay rate" />
        <KPICard title="Employees" value={stats ? Object.keys(stats.by_employee).length : null} format="number" icon={Users} color="purple" {loading} />
      </div>
    </section>

    <!-- By shift type -->
    {#if stats && Object.keys(stats.by_shift_type).length > 0}
      <section>
        <h2 class="mb-3 text-base font-semibold text-gray-700">By Shift Type</h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {#each Object.entries(stats.by_shift_type) as [stype, data]}
            <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <span class="rounded-full px-2 py-0.5 text-xs font-medium capitalize {SHIFT_COLORS[stype] ?? 'bg-gray-100 text-gray-600'}">{stype}</span>
              <p class="mt-2 text-xl font-bold text-gray-900">{data.hours.toFixed(1)}h</p>
              <p class="text-xs text-gray-400">{fmtCurrency(data.cost)}</p>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- Task Labor Hours -->
    <section>
      <div class="flex items-center gap-2 mb-3">
        <Activity class="h-5 w-5 text-blue-600" />
        <h2 class="text-base font-semibold text-gray-700">Task Labor Hours</h2>
      </div>
      <p class="text-xs text-gray-400 mb-3">Productive effort tracked per task via tracked_minutes. Source: Operations task log.</p>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KPICard title="Total Task Hours" value={taskStats?.total_task_hours ?? null} format="hours" color="blue" {loading} />
        <KPICard title="Tasks with Time Tracked" value={taskStats?.total_requests ?? null} format="number" color="teal" {loading} />
        <KPICard title="Maintenance Hours" value={null} format="hours" color="amber" {loading}
          subtitle="Filter by type in Operations" />
      </div>
    </section>

    <!-- Labor Utilization -->
    <section>
      <div class="flex items-center gap-2 mb-3">
        <TrendingUp class="h-5 w-5 text-purple-600" />
        <h2 class="text-base font-semibold text-gray-700">Labor Utilization Rate</h2>
      </div>
      <p class="text-xs text-gray-400 mb-3">Task Labor Hours ÷ Clocked Labor Hours. Measures productive vs. paid ratio.</p>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KPICard title="Utilization Rate" value={utilizationPct} format="percent" icon={Activity} color="teal" {loading} />
        <KPICard title="Clocked Hours" value={stats?.total_clocked_hours ?? null} format="hours" color="blue" {loading} />
        <KPICard title="Task Hours" value={taskStats?.total_task_hours ?? null} format="hours" color="amber" {loading} />
      </div>
    </section>

    <!-- Labor Cost -->
    <section>
      <div class="flex items-center gap-2 mb-3">
        <DollarSign class="h-5 w-5 text-amber-600" />
        <h2 class="text-base font-semibold text-gray-700">Labor Cost</h2>
      </div>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KPICard title="Total Labor Cost" value={stats?.total_labor_cost ?? null} format="currency" icon={DollarSign} color="teal" {loading} />
        <KPICard title="Maintenance Labor" value={stats?.by_shift_type?.['maintenance']?.cost ?? null} format="currency" color="amber" {loading} />
        <KPICard title="Cleaning Labor" value={stats?.by_shift_type?.['cleaning']?.cost ?? null} format="currency" color="blue" {loading} />
        <KPICard title="Admin Labor" value={stats?.by_shift_type?.['admin']?.cost ?? null} format="currency" color="purple" {loading} />
      </div>
      <div class="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>Note:</strong> Labor cost = clocked hours × configured pay rate per entry. Set the hourly rate when logging each entry.
      </div>
    </section>

    <!-- Per employee table -->
    {#if stats && Object.keys(stats.by_employee).length > 0}
      <section>
        <h2 class="mb-3 text-base font-semibold text-gray-700">By Employee</h2>
        <div class="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <tr>
                <th class="px-4 py-3 text-left">Employee</th>
                <th class="px-4 py-3 text-right">Hours</th>
                <th class="px-4 py-3 text-right">Cost</th>
                <th class="px-4 py-3 text-right">Avg $/hr</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              {#each Object.entries(stats.by_employee).sort((a,b) => b[1].hours - a[1].hours) as [name, data]}
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-medium text-gray-900">{name}</td>
                  <td class="px-4 py-3 text-right text-gray-700">{data.hours.toFixed(1)}h</td>
                  <td class="px-4 py-3 text-right text-emerald-700">{fmtCurrency(data.cost)}</td>
                  <td class="px-4 py-3 text-right text-gray-500">
                    {data.hours > 0 ? fmtCurrency(data.cost / data.hours) : '—'}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}

  <!-- ═══════════════════════════════════════════════════════════ ENTRIES TAB -->
  {:else}

    <!-- Filters -->
    <div class="flex flex-wrap gap-2">
      <input bind:value={filterEmployee} on:change={load} placeholder="Filter by employee…"
        class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm w-48" />
      <select bind:value={filterShiftType} on:change={load} class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
        <option value="">All shift types</option>
        <option value="maintenance">Maintenance</option>
        <option value="cleaning">Cleaning</option>
        <option value="admin">Admin</option>
        <option value="other">Other</option>
      </select>
      {#if filterEmployee || filterShiftType}
        <button on:click={() => { filterEmployee = ''; filterShiftType = ''; load(); }}
          class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">Clear</button>
      {/if}
    </div>

    <!-- Entries table -->
    <div class="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {#if loading}
        <div class="p-8 text-center text-gray-400"><RefreshCw class="h-6 w-6 mx-auto animate-spin mb-2" /><p class="text-sm">Loading…</p></div>
      {:else if events.length === 0}
        <div class="p-12 text-center text-gray-400">
          <Clock class="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p class="text-sm font-medium">No labor entries for this period</p>
          <p class="text-xs mt-1">Log hours manually — a clock-in system will append entries once integrated</p>
          <button on:click={openCreate} class="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
            <Plus class="h-4 w-4" /> Log first entry
          </button>
        </div>
      {:else}
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <tr>
              <th class="px-4 py-3 text-left">Employee</th>
              <th class="px-4 py-3 text-left">Shift Type</th>
              <th class="px-4 py-3 text-left">Clock In</th>
              <th class="px-4 py-3 text-left">Clock Out</th>
              <th class="px-4 py-3 text-right">Hours</th>
              <th class="px-4 py-3 text-right">Rate</th>
              <th class="px-4 py-3 text-right">Cost</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            {#each events as ev (ev.id)}
              {@const hrs = shiftHours(ev)}
              {@const cost = ev.pay_rate ? hrs * ev.pay_rate : null}
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 font-medium text-gray-900">{ev.employee_name || ev.employee_id}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium capitalize {SHIFT_COLORS[ev.shift_type] ?? 'bg-gray-100 text-gray-600'}">{ev.shift_type}</span>
                </td>
                <td class="px-4 py-3 text-gray-600">{fmtDatetime(ev.clock_in)}</td>
                <td class="px-4 py-3 text-gray-600">
                  {#if ev.clock_out}
                    {fmtDatetime(ev.clock_out)}
                  {:else}
                    <span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600">Active</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-right font-semibold text-gray-900">{hrs > 0 ? `${hrs.toFixed(2)}h` : '—'}</td>
                <td class="px-4 py-3 text-right text-gray-500">{ev.pay_rate ? `$${ev.pay_rate}/hr` : '—'}</td>
                <td class="px-4 py-3 text-right font-semibold text-emerald-700">{cost != null ? fmtCurrency(cost) : '—'}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <button title="Edit" on:click={() => openEdit(ev)} class="rounded p-1 text-gray-400 hover:bg-gray-100"><Pencil class="h-3.5 w-3.5" /></button>
                    <button title="Delete" on:click={() => deleteEvent(ev)} class="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 class="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        <div class="border-t border-gray-50 px-4 py-2 text-xs text-gray-400">
          {events.length} entr{events.length !== 1 ? 'ies' : 'y'}
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Labor entry slide-over -->
{#if showForm}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-40 bg-black/30" on:click={() => (showForm = false)}></div>
  <div class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl">
    <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
      <h3 class="font-semibold text-gray-900">{editingEvent ? 'Edit Labor Entry' : 'Log Labor Hours'}</h3>
      <button on:click={() => (showForm = false)} class="text-gray-400 hover:text-gray-600"><X class="h-5 w-5" /></button>
    </div>
    <div class="flex-1 overflow-y-auto p-5 space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-gray-600">Employee Name *</span>
          <input bind:value={draft.employee_name} placeholder="e.g. John Smith" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-gray-600">Employee ID</span>
          <input bind:value={draft.employee_id} placeholder="auto-generated if blank" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
      </div>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-gray-600">Shift Type</span>
        <select bind:value={draft.shift_type} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="maintenance">Maintenance</option>
          <option value="cleaning">Cleaning</option>
          <option value="admin">Admin</option>
          <option value="other">Other</option>
        </select>
      </label>
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-gray-600">Clock In *</span>
          <input type="datetime-local" bind:value={draft.clock_in} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-gray-600">Clock Out</span>
          <input type="datetime-local" bind:value={draft.clock_out} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
      </div>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-gray-600">Hourly Rate ($/hr)</span>
        <input type="number" bind:value={draft.pay_rate} step="0.01" min="0" placeholder="e.g. 22.50"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      </label>
      {#if previewHours > 0 && parseFloat(draft.pay_rate || '0') > 0}
        <div class="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-700">
          {previewHours.toFixed(2)}h × ${parseFloat(draft.pay_rate).toFixed(2)}/hr = <strong>{fmtCurrency(previewCost)}</strong>
        </div>
      {/if}
    </div>
    <div class="border-t border-gray-100 px-5 py-4 flex justify-end gap-3">
      <button on:click={() => (showForm = false)} class="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
      <button on:click={saveEvent} disabled={saving} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
        {#if saving}<RefreshCw class="h-4 w-4 animate-spin" />{/if}
        {editingEvent ? 'Save' : 'Log Hours'}
      </button>
    </div>
  </div>
{/if}
