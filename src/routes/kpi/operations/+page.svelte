<script lang="ts">
  import { onMount } from 'svelte';
  import { ops, kpi, thisMonthRange } from '$lib/api/kpi';
  import type { Task, TaskStats } from '$lib/api/kpi';
  import { Wrench, Sparkles, RotateCcw, Plus, CheckCircle2, Clock, AlertCircle, X, RefreshCw, Pencil, Trash2, BarChart3 } from 'lucide-svelte';
  import DateRangePicker from '$lib/components/kpi/DateRangePicker.svelte';
  import KPICard from '$lib/components/kpi/KPICard.svelte';

  let { start, end } = thisMonthRange();
  let tasks: Task[] = [];
  let stats: TaskStats | null = null;
  let properties: Array<{ id: string; name: string }> = [];
  let staffList: string[] = [];
  let loading = true;
  let error: string | null = null;
  let activeTab: 'dashboard' | 'tasks' = 'dashboard';

  // Filters for task list
  let filterType = '';
  let filterStatus = '';
  let filterProperty = '';

  // Form
  let showForm = false;
  let editingTask: Task | null = null;
  let saving = false;
  let draft = defaultDraft();

  function defaultDraft() {
    return {
      task_type: 'maintenance',
      task_category: '',
      property_id: '',
      unit_id: '',
      assigned_staff: '',
      priority: 'normal',
      task_status: 'open',
      notes: '',
      created_at: new Date().toISOString().slice(0, 16),
      tracked_minutes: 0,
    };
  }

  async function load() {
    loading = true; error = null;
    try {
      const params: Record<string, string | undefined> = {
        date_from: start, date_to: end,
        ...(filterType ? { task_type: filterType } : {}),
        ...(filterStatus ? { task_status: filterStatus } : {}),
        ...(filterProperty ? { property_id: filterProperty } : {}),
      };
      const [taskRes, statsRes] = await Promise.all([
        ops.listTasks(params),
        ops.taskStats({ date_from: start, date_to: end }),
      ]);
      tasks = taskRes.tasks;
      stats = statsRes;
    } catch (e: any) { error = e.message; }
    finally { loading = false; }
  }

  async function loadReference() {
    try {
      const [p, s] = await Promise.all([ops.properties(), ops.staff()]);
      properties = p.properties;
      staffList = s.staff;
    } catch (_) {}
  }

  onMount(() => { load(); loadReference(); });

  function onDateChange(e: CustomEvent<{ start: string; end: string }>) {
    start = e.detail.start; end = e.detail.end; load();
  }

  function openCreate() {
    editingTask = null; draft = defaultDraft(); showForm = true;
  }
  function openEdit(t: Task) {
    editingTask = t;
    draft = {
      task_type: t.task_type,
      task_category: t.task_category ?? '',
      property_id: t.property_id ?? '',
      unit_id: t.unit_id ?? '',
      assigned_staff: t.assigned_staff ?? '',
      priority: t.priority,
      task_status: t.task_status,
      notes: t.notes ?? '',
      created_at: t.created_at ? t.created_at.slice(0, 16) : new Date().toISOString().slice(0, 16),
      tracked_minutes: t.tracked_minutes ?? 0,
    };
    showForm = true;
  }

  async function saveTask() {
    saving = true;
    try {
      const payload: any = {
        task_type: draft.task_type,
        task_category: draft.task_category || null,
        property_id: draft.property_id || null,
        unit_id: draft.unit_id || null,
        assigned_staff: draft.assigned_staff || null,
        priority: draft.priority,
        task_status: draft.task_status,
        notes: draft.notes || null,
        created_at: draft.created_at ? new Date(draft.created_at).toISOString() : undefined,
        tracked_minutes: Number(draft.tracked_minutes) || 0,
      };
      if (editingTask) {
        await ops.updateTask(editingTask.id, payload);
      } else {
        await ops.createTask(payload);
      }
      showForm = false;
      await load();
    } catch (e: any) { error = e.message; }
    finally { saving = false; }
  }

  async function quickStatus(t: Task, status: string) {
    try {
      await ops.updateTask(t.id, {
        task_status: status,
        ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
        ...(status === 'in_progress' && !t.first_response_at ? { first_response_at: new Date().toISOString() } : {}),
      });
      await load();
    } catch (e: any) { error = e.message; }
  }

  async function deleteTask(t: Task) {
    if (!confirm(`Delete this ${t.task_type} task?`)) return;
    try {
      await ops.deleteTask(t.id);
      await load();
    } catch (e: any) { error = e.message; }
  }

  // Stats by type helpers
  $: maintenanceStats = stats ? {
    total: stats.by_type['maintenance'] ?? 0,
    completed: null as number | null,
    open: null as number | null,
  } : null;

  function typeCount(type: string, status?: string): number {
    if (!tasks.length) return 0;
    return tasks.filter(t => t.task_type === type && (status ? t.task_status === status : true)).length;
  }
  function typeAvgHours(type: string, field: 'first_response_at' | 'completed_at'): number | null {
    const relevant = tasks.filter(t => t.task_type === type && t.created_at && t[field]);
    if (!relevant.length) return null;
    const total = relevant.reduce((sum, t) => {
      const h = (new Date(t[field]!).getTime() - new Date(t.created_at!).getTime()) / 3600000;
      return sum + Math.max(0, h);
    }, 0);
    return Math.round((total / relevant.length) * 10) / 10;
  }

  function durationHours(t: Task): string {
    if (!t.created_at || !t.completed_at) return '—';
    const h = (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / 3600000;
    return `${h.toFixed(1)}h`;
  }

  const STATUS_COLORS: Record<string, string> = {
    open: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-500',
  };
  const PRIORITY_COLORS: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    normal: 'bg-gray-100 text-gray-600',
    low: 'bg-blue-100 text-blue-600',
  };
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Operations KPI Dashboard</h1>
      <p class="text-sm text-gray-500">Maintenance · Cleaning · Turnover — real-time metrics and task management</p>
    </div>
    <div class="flex items-center gap-2">
      <DateRangePicker {start} {end} on:change={onDateChange} />
      <button on:click={load} class="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50">
        <RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" />
      </button>
      <button on:click={openCreate} class="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
        <Plus class="h-4 w-4" /> New Task
      </button>
    </div>
  </div>

  {#if error}<div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>{/if}

  <!-- Tab switcher -->
  <div class="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-sm w-fit">
    <button on:click={() => (activeTab = 'dashboard')}
      class="rounded-md px-4 py-1.5 font-medium transition {activeTab === 'dashboard' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50'}">
      <span class="flex items-center gap-1.5"><BarChart3 class="h-3.5 w-3.5" /> KPI Dashboard</span>
    </button>
    <button on:click={() => (activeTab = 'tasks')}
      class="rounded-md px-4 py-1.5 font-medium transition {activeTab === 'tasks' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50'}">
      <span class="flex items-center gap-1.5"><Wrench class="h-3.5 w-3.5" /> Task Log ({tasks.length})</span>
    </button>
  </div>

  <!-- ═══════════════════════════════════════════════════════════ DASHBOARD TAB -->
  {#if activeTab === 'dashboard'}

    <!-- Overall summary -->
    {#if stats}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard title="Total Tasks" value={stats.total_requests} format="number" color="teal" {loading} />
        <KPICard title="Open" value={stats.open_requests} format="number" color="amber" {loading} />
        <KPICard title="Completed" value={stats.completed_requests} format="number" color="green" {loading} />
        <KPICard title="Avg Response" value={stats.avg_response_time_hours} format="hours" color="blue" {loading}
          subtitle="first_response − created" />
        <KPICard title="Avg Resolution" value={stats.avg_resolution_time_hours} format="hours" color="purple" {loading}
          subtitle="completed − created" />
        <KPICard title="Task Hours Logged" value={stats.total_task_hours} format="hours" color="teal" {loading} />
      </div>
    {:else if loading}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {#each Array(6) as _}
          <div class="h-20 animate-pulse rounded-xl bg-gray-100"></div>
        {/each}
      </div>
    {/if}

    <!-- Maintenance -->
    <section>
      <div class="flex items-center gap-2 mb-3">
        <Wrench class="h-5 w-5 text-teal-600" />
        <h2 class="text-base font-semibold text-gray-700">Maintenance</h2>
        <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{typeCount('maintenance')} tasks</span>
      </div>
      <p class="text-xs text-gray-400 mb-3">All maintenance requests. Measures total maintenance operational demand.</p>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KPICard title="Total Requests" value={typeCount('maintenance')} format="number" icon={Wrench} color="teal" {loading} />
        <KPICard title="Completed" value={typeCount('maintenance', 'completed')} format="number" icon={CheckCircle2} color="green" {loading} />
        <KPICard title="Open" value={typeCount('maintenance', 'open') + typeCount('maintenance', 'in_progress')} format="number" icon={AlertCircle} color="amber" {loading} />
        <KPICard title="Avg Response Time" value={typeAvgHours('maintenance', 'first_response_at')} format="hours" icon={Clock} color="blue" {loading}
          subtitle="first_response_at − created_at" />
        <KPICard title="Avg Resolution Time" value={typeAvgHours('maintenance', 'completed_at')} format="hours" color="purple" {loading}
          subtitle="completed_at − created_at" />
      </div>
    </section>

    <!-- Housekeeping -->
    <section>
      <div class="flex items-center gap-2 mb-3">
        <Sparkles class="h-5 w-5 text-amber-500" />
        <h2 class="text-base font-semibold text-gray-700">Housekeeping</h2>
        <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{typeCount('cleaning')} tasks</span>
      </div>
      <p class="text-xs text-gray-400 mb-3">Cleaning task volume. All cleaning must be logged — unlogged cleaning is invisible to KPIs.</p>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KPICard title="Total Cleaning Tasks" value={typeCount('cleaning')} format="number" color="amber" {loading} />
        <KPICard title="Completed" value={typeCount('cleaning', 'completed')} format="number" icon={CheckCircle2} color="green" {loading} />
        <KPICard title="Open Tasks" value={typeCount('cleaning', 'open') + typeCount('cleaning', 'in_progress')} format="number" color="amber" {loading} />
      </div>
    </section>

    <!-- Turnover -->
    <section>
      <div class="flex items-center gap-2 mb-3">
        <RotateCcw class="h-5 w-5 text-indigo-500" />
        <h2 class="text-base font-semibold text-gray-700">Turnover</h2>
        <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{typeCount('turnover')} turnovers</span>
      </div>
      <p class="text-xs text-gray-400 mb-3">Time to return units to ready state. Formula: ready_timestamp − created_at.</p>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KPICard title="Total Turnovers" value={typeCount('turnover')} format="number" color="indigo" {loading} />
        <KPICard title="Avg Turnover Duration" value={stats?.avg_turnover_hours ?? null} format="hours" color="blue" {loading}
          subtitle="ready_timestamp − created_at" />
        <KPICard title="Max Duration" value={stats?.max_resolution_time_hours ?? null} format="hours" color="red" {loading} />
      </div>
    </section>

    <!-- By priority breakdown -->
    {#if stats && Object.keys(stats.by_priority).length > 0}
      <section>
        <h2 class="mb-3 text-base font-semibold text-gray-700">By Priority</h2>
        <div class="grid grid-cols-4 gap-3">
          {#each [['urgent','red'],['high','orange'],['normal','gray'],['low','blue']] as [p, col]}
            {@const count = stats.by_priority[p] ?? 0}
            <div class="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm text-center">
              <p class="text-[10px] font-medium uppercase tracking-wide text-gray-400 capitalize">{p}</p>
              <p class="mt-0.5 text-2xl font-bold text-gray-900">{count}</p>
            </div>
          {/each}
        </div>
      </section>
    {/if}

  <!-- ═══════════════════════════════════════════════════════════ TASKS TAB -->
  {:else}

    <!-- Filters + Add -->
    <div class="flex flex-wrap gap-2">
      <select bind:value={filterType} on:change={load} class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
        <option value="">All types</option>
        <option value="maintenance">Maintenance</option>
        <option value="cleaning">Cleaning</option>
        <option value="turnover">Turnover</option>
      </select>
      <select bind:value={filterStatus} on:change={load} class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
        <option value="">All statuses</option>
        <option value="open">Open</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <select bind:value={filterProperty} on:change={load} class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
        <option value="">All properties</option>
        {#each properties as p}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
      {#if filterType || filterStatus || filterProperty}
        <button on:click={() => { filterType = ''; filterStatus = ''; filterProperty = ''; load(); }}
          class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">Clear filters</button>
      {/if}
    </div>

    <!-- Task table -->
    <div class="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {#if loading}
        <div class="p-8 text-center text-gray-400"><RefreshCw class="h-6 w-6 mx-auto animate-spin mb-2" /><p class="text-sm">Loading…</p></div>
      {:else if tasks.length === 0}
        <div class="p-12 text-center text-gray-400">
          <Wrench class="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p class="text-sm font-medium">No tasks for this period</p>
          <p class="text-xs mt-1">Create tasks manually — ClickUp will append tasks automatically once connected</p>
          <button on:click={openCreate} class="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
            <Plus class="h-4 w-4" /> Create first task
          </button>
        </div>
      {:else}
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <tr>
              <th class="px-4 py-3 text-left">Type</th>
              <th class="px-4 py-3 text-left">Property / Unit</th>
              <th class="px-4 py-3 text-left">Assigned</th>
              <th class="px-4 py-3 text-left">Priority</th>
              <th class="px-4 py-3 text-left">Status</th>
              <th class="px-4 py-3 text-left">Duration</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            {#each tasks as t (t.id)}
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3">
                  <p class="font-medium text-gray-900 capitalize">{t.task_type}</p>
                  {#if t.task_category}<p class="text-xs text-gray-400">{t.task_category}</p>{/if}
                </td>
                <td class="px-4 py-3 text-gray-600">
                  <p>{t.property_name ?? '—'}</p>
                  {#if t.unit_name}<p class="text-xs text-gray-400">{t.unit_name}</p>{/if}
                </td>
                <td class="px-4 py-3 text-gray-600">{t.assigned_staff ?? '—'}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium capitalize {PRIORITY_COLORS[t.priority] ?? 'bg-gray-100 text-gray-600'}">{t.priority}</span>
                </td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium {STATUS_COLORS[t.task_status] ?? 'bg-gray-100 text-gray-600'}">{t.task_status.replace('_', ' ')}</span>
                </td>
                <td class="px-4 py-3 text-gray-500">{durationHours(t)}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-end gap-1">
                    {#if t.task_status === 'open'}
                      <button title="Mark in progress" on:click={() => quickStatus(t, 'in_progress')} class="rounded p-1 text-blue-500 hover:bg-blue-50"><Clock class="h-3.5 w-3.5" /></button>
                    {/if}
                    {#if t.task_status !== 'completed' && t.task_status !== 'cancelled'}
                      <button title="Mark complete" on:click={() => quickStatus(t, 'completed')} class="rounded p-1 text-green-600 hover:bg-green-50"><CheckCircle2 class="h-3.5 w-3.5" /></button>
                    {/if}
                    <button title="Edit" on:click={() => openEdit(t)} class="rounded p-1 text-gray-400 hover:bg-gray-100"><Pencil class="h-3.5 w-3.5" /></button>
                    <button title="Delete" on:click={() => deleteTask(t)} class="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 class="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        <div class="border-t border-gray-50 px-4 py-2 text-xs text-gray-400">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} · ClickUp sync will append automatically once connected
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Task form slide-over -->
{#if showForm}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-40 bg-black/30" on:click={() => (showForm = false)}></div>
  <div class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl">
    <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
      <h3 class="font-semibold text-gray-900">{editingTask ? 'Edit Task' : 'New Task'}</h3>
      <button on:click={() => (showForm = false)} class="text-gray-400 hover:text-gray-600"><X class="h-5 w-5" /></button>
    </div>
    <div class="flex-1 overflow-y-auto p-5 space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-gray-600">Type *</span>
          <select bind:value={draft.task_type} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="maintenance">Maintenance</option>
            <option value="cleaning">Cleaning</option>
            <option value="turnover">Turnover</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-gray-600">Category</span>
          <input bind:value={draft.task_category} placeholder="e.g. plumbing, HVAC" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
      </div>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-gray-600">Property</span>
        <select bind:value={draft.property_id} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="">— None —</option>
          {#each properties as p}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-gray-600">Unit (optional)</span>
        <input bind:value={draft.unit_id} placeholder="Unit name or ID" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      </label>
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-gray-600">Assigned Staff</span>
          <input bind:value={draft.assigned_staff} list="staff-list" placeholder="Name" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <datalist id="staff-list">{#each staffList as s}<option value={s}>{s}</option>{/each}</datalist>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-gray-600">Priority</span>
          <select bind:value={draft.priority} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-gray-600">Status</span>
          <select bind:value={draft.task_status} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-gray-600">Tracked Minutes</span>
          <input type="number" bind:value={draft.tracked_minutes} min="0" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
      </div>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-gray-600">Created At</span>
        <input type="datetime-local" bind:value={draft.created_at} class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-gray-600">Notes</span>
        <textarea bind:value={draft.notes} rows="3" placeholder="Optional notes…" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none"></textarea>
      </label>
    </div>
    <div class="border-t border-gray-100 px-5 py-4 flex justify-end gap-3">
      <button on:click={() => (showForm = false)} class="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
      <button on:click={saveTask} disabled={saving} class="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
        {#if saving}<RefreshCw class="h-4 w-4 animate-spin" />{/if}
        {editingTask ? 'Save' : 'Create'}
      </button>
    </div>
  </div>
{/if}
