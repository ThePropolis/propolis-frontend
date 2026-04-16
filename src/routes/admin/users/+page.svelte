<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { fade, scale } from 'svelte/transition';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { auth } from '$lib/api/auth';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { toast } from '$lib/components/ui/toastStore';
	import Dropdown from '$lib/components/ui/Dropdown.svelte';
	import {
		UserCog,
		Plus,
		Trash2,
		RotateCcw,
		Save,
		X,
		Search,
		Users as UsersIcon,
		Shield,
		Copy,
		Check,
		Eye,
		EyeOff,
		RefreshCw,
		Mail,
		MoreHorizontal,
		KeyRound,
		UserCheck,
		UserX,
		AlertTriangle
	} from 'lucide-svelte';

	type Role = 'owner' | 'investor' | 'operator';
	type UserRow = {
		id: string;
		email: string;
		full_name: string;
		role: Role;
		is_active: boolean;
		avatar_url?: string | null;
		created_at: string;
		last_sign_in_at?: string | null;
	};

	let users: UserRow[] = [];
	let loading = true;
	let error: string | null = null;
	let busyIds = new Set<string>();
	let searchQuery = '';
	let roleFilter: Role | 'all' = 'all';

	// Add-user modal
	let showAdd = false;
	let form = { email: '', full_name: '', role: 'investor' as Role, temp_password: '' };
	let addError: string | null = null;
	let adding = false;
	let passwordVisible = false;
	let passwordCopied = false;

	// Confirmations / action modals
	let confirmDeleteUser: UserRow | null = null;
	let deleting = false;

	let roleTarget: UserRow | null = null;
	let roleDraft: Role = 'investor';
	let roleSaving = false;

	let resetTarget: UserRow | null = null;
	let resetPassword = '';
	let resetVisible = false;
	let resetCopied = false;
	let resetSaving = false;

	function authHeader() {
		return { Authorization: `Bearer ${get(auth).token}` };
	}

	async function load(silent = false) {
		if (!silent) loading = true;
		error = null;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/admin/users`, { headers: authHeader() });
			if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
			const data = await res.json();
			users = data.users || [];
		} catch (e: any) {
			error = e.message;
			if (!silent) toast.error(e.message);
		} finally {
			loading = false;
		}
	}

	onMount(load);

	async function updateField(id: string, patch: Partial<UserRow>, successMsg: string) {
		busyIds.add(id);
		busyIds = busyIds;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/admin/users/${id}`, {
				method: 'PATCH',
				headers: { ...authHeader(), 'Content-Type': 'application/json' },
				body: JSON.stringify(patch)
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Update failed (${res.status})`);
			}
			await load(true);
			toast.success(successMsg);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			busyIds.delete(id);
			busyIds = busyIds;
		}
	}

	async function toggleActive(u: UserRow) {
		await updateField(
			u.id,
			{ is_active: !u.is_active },
			u.is_active ? `${u.full_name || u.email} deactivated` : `${u.full_name || u.email} reactivated`
		);
	}

	function openRoleModal(u: UserRow) {
		roleTarget = u;
		roleDraft = u.role;
	}

	async function submitRoleChange() {
		if (!roleTarget) return;
		if (roleDraft === roleTarget.role) {
			roleTarget = null;
			return;
		}
		roleSaving = true;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/admin/users/${roleTarget.id}`, {
				method: 'PATCH',
				headers: { ...authHeader(), 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: roleDraft })
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Update failed (${res.status})`);
			}
			await load(true);
			toast.success(`${roleTarget.full_name || roleTarget.email} is now ${roleDraft}`);
			roleTarget = null;
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			roleSaving = false;
		}
	}

	function openResetModal(u: UserRow) {
		resetTarget = u;
		resetPassword = '';
		resetVisible = false;
		resetCopied = false;
	}

	function generateResetPassword() {
		const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
		let pw = '';
		for (let i = 0; i < 14; i++) pw += chars[Math.floor(Math.random() * chars.length)];
		resetPassword = pw;
		resetCopied = false;
	}

	async function copyResetPassword() {
		if (!resetPassword) return;
		await navigator.clipboard.writeText(resetPassword);
		resetCopied = true;
		toast.info('Password copied to clipboard');
		setTimeout(() => (resetCopied = false), 2000);
	}

	async function submitReset() {
		if (!resetTarget) return;
		if (resetPassword.length < 8) {
			toast.error('Password must be at least 8 characters');
			return;
		}
		resetSaving = true;
		try {
			const res = await fetch(
				`${PUBLIC_API_URL}/api/admin/users/${resetTarget.id}/reset-password`,
				{
					method: 'POST',
					headers: { ...authHeader(), 'Content-Type': 'application/json' },
					body: JSON.stringify({ new_password: resetPassword })
				}
			);
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Reset failed (${res.status})`);
			}
			toast.success(`Password reset for ${resetTarget.full_name || resetTarget.email}`);
			resetTarget = null;
			resetPassword = '';
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			resetSaving = false;
		}
	}

	async function hardDelete(u: UserRow) {
		deleting = true;
		busyIds.add(u.id);
		busyIds = busyIds;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/admin/users/${u.id}?hard=true`, {
				method: 'DELETE',
				headers: authHeader()
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Delete failed (${res.status})`);
			}
			confirmDeleteUser = null;
			await load(true);
			toast.success(`${u.full_name || u.email} permanently deleted`);
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			deleting = false;
			busyIds.delete(u.id);
			busyIds = busyIds;
		}
	}

	function generatePassword() {
		const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
		let pw = '';
		for (let i = 0; i < 14; i++) pw += chars[Math.floor(Math.random() * chars.length)];
		form.temp_password = pw;
		passwordCopied = false;
	}

	async function copyPassword() {
		if (!form.temp_password) return;
		await navigator.clipboard.writeText(form.temp_password);
		passwordCopied = true;
		toast.info('Password copied to clipboard');
		setTimeout(() => (passwordCopied = false), 2000);
	}

	async function submitAdd() {
		addError = null;
		if (!form.email || !form.full_name || !form.temp_password) {
			addError = 'All fields are required';
			return;
		}
		adding = true;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/admin/users`, {
				method: 'POST',
				headers: { ...authHeader(), 'Content-Type': 'application/json' },
				body: JSON.stringify(form)
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Create failed (${res.status})`);
			}
			await load(true);
			toast.success(`${form.full_name} added as ${form.role}`);
			showAdd = false;
			form = { email: '', full_name: '', role: 'investor', temp_password: '' };
			passwordVisible = false;
			passwordCopied = false;
		} catch (e: any) {
			addError = e.message;
		} finally {
			adding = false;
		}
	}

	function openAddModal() {
		form = { email: '', full_name: '', role: 'investor', temp_password: '' };
		addError = null;
		passwordVisible = false;
		passwordCopied = false;
		showAdd = true;
	}

	// Derived
	$: counts = {
		total: users.length,
		owners: users.filter((u) => u.role === 'owner').length,
		investors: users.filter((u) => u.role === 'investor').length,
		operators: users.filter((u) => u.role === 'operator').length,
		inactive: users.filter((u) => !u.is_active).length
	};

	$: filteredUsers = users.filter((u) => {
		const q = searchQuery.trim().toLowerCase();
		const matchesQ =
			!q ||
			u.email.toLowerCase().includes(q) ||
			(u.full_name || '').toLowerCase().includes(q);
		const matchesRole = roleFilter === 'all' || u.role === roleFilter;
		return matchesQ && matchesRole;
	});

	function initials(u: UserRow) {
		const base = (u.full_name || u.email || '').trim();
		const parts = base.split(/\s+/);
		if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
		return (base[0] || '?').toUpperCase();
	}

	function roleBadgeClass(r: Role) {
		if (r === 'owner') return 'bg-purple-50 text-purple-700 border-purple-200';
		if (r === 'investor') return 'bg-blue-50 text-blue-700 border-blue-200';
		return 'bg-amber-50 text-amber-700 border-amber-200';
	}

	function timeAgo(iso: string) {
		try {
			const d = new Date(iso);
			const diff = Date.now() - d.getTime();
			const mins = Math.floor(diff / 60000);
			if (mins < 1) return 'just now';
			if (mins < 60) return `${mins}m ago`;
			const hrs = Math.floor(mins / 60);
			if (hrs < 24) return `${hrs}h ago`;
			const days = Math.floor(hrs / 24);
			if (days < 30) return `${days}d ago`;
			return d.toLocaleDateString();
		} catch {
			return '';
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<div class="flex items-center gap-3">
			<div class="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50">
				<UserCog class="h-6 w-6 text-teal-600" />
			</div>
			<div>
				<h1 class="text-2xl font-semibold text-gray-900">Users & Roles</h1>
				<p class="text-sm text-gray-500">Create users, assign roles, and manage access.</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<button
				on:click={() => load()}
				class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
				disabled={loading}
			>
				<RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" />
				Refresh
			</button>
			<button
				on:click={openAddModal}
				class="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700"
			>
				<Plus class="h-4 w-4" /> Add user
			</button>
		</div>
	</div>

	<!-- Stat cards -->
	<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
		{#each [
			{ label: 'Total users', value: counts.total, icon: UsersIcon, tint: 'bg-gray-100 text-gray-700' },
			{ label: 'Owners', value: counts.owners, icon: Shield, tint: 'bg-purple-50 text-purple-700' },
			{ label: 'Investors', value: counts.investors, icon: UsersIcon, tint: 'bg-blue-50 text-blue-700' },
			{ label: 'Operators', value: counts.operators, icon: UsersIcon, tint: 'bg-amber-50 text-amber-700' }
		] as card}
			<div class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg {card.tint}">
					<svelte:component this={card.icon} class="h-5 w-5" />
				</div>
				<div>
					<div class="text-xs uppercase tracking-wide text-gray-500">{card.label}</div>
					{#if loading}
						<Skeleton height="1.5rem" width="2rem" />
					{:else}
						<div class="text-xl font-semibold text-gray-900">{card.value}</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Controls -->
	<div class="flex flex-col gap-3 md:flex-row md:items-center">
		<div class="relative flex-1">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search by name or email..."
				class="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
			/>
			{#if searchQuery}
				<button
					on:click={() => (searchQuery = '')}
					class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
					aria-label="Clear"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>
		<div class="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
			{#each ['all', 'owner', 'investor', 'operator'] as const as r}
				<button
					on:click={() => (roleFilter = r)}
					class="rounded-md px-3 py-1.5 text-xs font-medium capitalize transition"
					class:bg-teal-600={roleFilter === r}
					class:text-white={roleFilter === r}
					class:text-gray-600={roleFilter !== r}
					class:hover:bg-gray-50={roleFilter !== r}
				>
					{r}
				</button>
			{/each}
		</div>
	</div>

	<!-- Table -->
	<div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
		<table class="w-full text-sm">
			<thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
				<tr>
					<th class="px-4 py-3">User</th>
					<th class="px-4 py-3">Role</th>
					<th class="px-4 py-3">Status</th>
					<th class="px-4 py-3">Last login</th>
						<th class="px-4 py-3">Created</th>
					<th class="px-4 py-3 text-right">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-100">
				{#if loading}
					{#each Array(4) as _}
						<tr>
							<td class="px-4 py-3">
								<div class="flex items-center gap-3">
									<Skeleton height="2.25rem" width="2.25rem" rounded="full" />
									<div class="flex flex-col gap-1">
										<Skeleton height="0.9rem" width="10rem" />
										<Skeleton height="0.75rem" width="12rem" />
									</div>
								</div>
							</td>
							<td class="px-4 py-3"><Skeleton height="1.5rem" width="5rem" rounded="full" /></td>
							<td class="px-4 py-3"><Skeleton height="1.25rem" width="4rem" rounded="full" /></td>
							<td class="px-4 py-3"><Skeleton height="0.9rem" width="5rem" /></td>
							<td class="px-4 py-3"><Skeleton height="0.9rem" width="4rem" /></td>
							<td class="px-4 py-3">
								<div class="flex justify-end gap-2">
									<Skeleton height="1.75rem" width="2rem" />
								</div>
							</td>
						</tr>
					{/each}
				{:else if filteredUsers.length === 0}
					<tr>
						<td colspan="6" class="px-4 py-10 text-center">
							<div class="mx-auto flex max-w-xs flex-col items-center gap-2">
								<UsersIcon class="h-10 w-10 text-gray-300" />
								<p class="font-medium text-gray-700">No users match</p>
								<p class="text-xs text-gray-500">Try adjusting your search or filter.</p>
								{#if searchQuery || roleFilter !== 'all'}
									<button
										on:click={() => {
											searchQuery = '';
											roleFilter = 'all';
										}}
										class="mt-2 text-xs font-medium text-teal-600 hover:text-teal-700"
									>
										Clear filters
									</button>
								{/if}
							</div>
						</td>
					</tr>
				{:else}
					{#each filteredUsers as u (u.id)}
						<tr class="transition hover:bg-gray-50/60" class:opacity-60={!u.is_active}>
							<td class="px-4 py-3">
								<div class="flex items-center gap-3">
									{#if u.avatar_url}
										<img
											src={u.avatar_url}
											alt={u.full_name || u.email}
											class="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-gray-100"
										/>
									{:else}
										<div
											class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-xs font-medium text-white"
										>
											{initials(u)}
										</div>
									{/if}
									<div class="min-w-0">
										<div class="truncate font-medium text-gray-900">
											{u.full_name || '—'}
										</div>
										<div class="flex items-center gap-1 text-xs text-gray-500">
											<Mail class="h-3 w-3" />
											<span class="truncate">{u.email}</span>
										</div>
									</div>
								</div>
							</td>
							<td class="px-4 py-3">
								<span
									class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize {roleBadgeClass(
										u.role
									)}"
								>
									{u.role}
								</span>
							</td>
							<td class="px-4 py-3">
								{#if u.is_active}
									<span class="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
										<span class="h-1.5 w-1.5 rounded-full bg-green-500"></span> Active
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
										<span class="h-1.5 w-1.5 rounded-full bg-gray-400"></span> Inactive
									</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-xs text-gray-500">
								{#if u.last_sign_in_at}
									{timeAgo(u.last_sign_in_at)}
								{:else}
									<span class="italic text-gray-400">Never</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-xs text-gray-500">{timeAgo(u.created_at)}</td>
							<td class="px-4 py-3">
								<div class="flex items-center justify-end">
									<Dropdown align="right">
										<button
											slot="trigger"
											class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
											aria-label="Row actions"
											disabled={busyIds.has(u.id)}
										>
											{#if busyIds.has(u.id)}
												<Spinner size="xs" />
											{:else}
												<MoreHorizontal class="h-4 w-4" />
											{/if}
										</button>

										<button
											on:click={() => openRoleModal(u)}
											class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
										>
											<Shield class="h-4 w-4 text-gray-400" /> Change role
										</button>
										<button
											on:click={() => openResetModal(u)}
											class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
										>
											<KeyRound class="h-4 w-4 text-gray-400" /> Reset password
										</button>
										<div class="my-1 border-t border-gray-100"></div>
										<button
											on:click={() => toggleActive(u)}
											class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
										>
											{#if u.is_active}
												<UserX class="h-4 w-4 text-gray-400" /> Deactivate
											{:else}
												<UserCheck class="h-4 w-4 text-gray-400" /> Reactivate
											{/if}
										</button>
										<button
											on:click={() => (confirmDeleteUser = u)}
											class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
										>
											<Trash2 class="h-4 w-4" /> Delete permanently
										</button>
									</Dropdown>
								</div>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	{#if !loading && filteredUsers.length > 0}
		<p class="text-xs text-gray-500">
			Showing {filteredUsers.length} of {users.length} {users.length === 1 ? 'user' : 'users'}
		</p>
	{/if}
</div>

<!-- Add user modal -->
{#if showAdd}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
		on:click={() => (showAdd = false)}
		role="dialog"
		aria-modal="true"
	>
		<div
			on:click|stopPropagation
			transition:scale={{ duration: 200, start: 0.96 }}
			class="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
		>
			<header class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50">
						<Plus class="h-4 w-4 text-teal-600" />
					</div>
					<h3 class="text-lg font-semibold text-gray-900">Add user</h3>
				</div>
				<button
					on:click={() => (showAdd = false)}
					class="text-gray-400 transition hover:text-gray-600"
					aria-label="Close"
				>
					<X class="h-5 w-5" />
				</button>
			</header>
			<div class="space-y-4 px-5 py-5">
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-gray-700">Full name</span>
					<input
						bind:value={form.full_name}
						placeholder="Jane Doe"
						class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm transition focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
					/>
				</label>
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-gray-700">Email</span>
					<input
						type="email"
						bind:value={form.email}
						placeholder="jane@example.com"
						class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm transition focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
					/>
				</label>
				<div>
					<span class="mb-1 block text-sm font-medium text-gray-700">Role</span>
					<div class="grid grid-cols-3 gap-2">
						{#each ['owner', 'investor', 'operator'] as const as r}
							<button
								type="button"
								on:click={() => (form.role = r)}
								class="rounded-lg border px-3 py-2 text-xs font-medium capitalize transition"
								class:border-teal-500={form.role === r}
								class:bg-teal-50={form.role === r}
								class:text-teal-700={form.role === r}
								class:border-gray-200={form.role !== r}
								class:text-gray-600={form.role !== r}
								class:hover:bg-gray-50={form.role !== r}
							>
								{r}
							</button>
						{/each}
					</div>
				</div>
				<div>
					<span class="mb-1 block text-sm font-medium text-gray-700">Temporary password</span>
					<div class="flex gap-2">
						<div class="relative flex-1">
							<input
								type={passwordVisible ? 'text' : 'password'}
								bind:value={form.temp_password}
								placeholder="Share with the user manually"
								class="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 font-mono text-sm transition focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
							/>
							<button
								type="button"
								on:click={() => (passwordVisible = !passwordVisible)}
								class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
								aria-label={passwordVisible ? 'Hide password' : 'Show password'}
							>
								{#if passwordVisible}
									<EyeOff class="h-4 w-4" />
								{:else}
									<Eye class="h-4 w-4" />
								{/if}
							</button>
						</div>
						<button
							type="button"
							on:click={generatePassword}
							class="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50"
							title="Generate random password"
						>
							<RefreshCw class="h-3.5 w-3.5" />
						</button>
						<button
							type="button"
							on:click={copyPassword}
							disabled={!form.temp_password}
							class="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
							title="Copy password"
						>
							{#if passwordCopied}
								<Check class="h-3.5 w-3.5 text-green-600" />
							{:else}
								<Copy class="h-3.5 w-3.5" />
							{/if}
						</button>
					</div>
					<p class="mt-1 text-xs text-gray-500">
						Share manually via Slack or email. User can change this after first login.
					</p>
				</div>
				{#if addError}
					<div
						transition:fade={{ duration: 120 }}
						class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
					>
						{addError}
					</div>
				{/if}
			</div>
			<footer class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button
					on:click={() => (showAdd = false)}
					class="rounded-lg px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100"
				>
					Cancel
				</button>
				<button
					on:click={submitAdd}
					disabled={adding}
					class="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-70"
				>
					{#if adding}
						<Spinner size="sm" color="white" /> Creating…
					{:else}
						<Save class="h-4 w-4" /> Create user
					{/if}
				</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Change role modal -->
{#if roleTarget}
	{@const dangerous = roleTarget.role === 'owner' || roleDraft === 'owner'}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
		on:click={() => (roleTarget = null)}
		role="dialog"
		aria-modal="true"
	>
		<div
			on:click|stopPropagation
			transition:scale={{ duration: 200, start: 0.96 }}
			class="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
		>
			<header class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50">
						<Shield class="h-4 w-4 text-teal-600" />
					</div>
					<h3 class="text-lg font-semibold text-gray-900">Change role</h3>
				</div>
				<button on:click={() => (roleTarget = null)} class="text-gray-400 hover:text-gray-600" aria-label="Close"><X class="h-5 w-5" /></button>
			</header>
			<div class="space-y-4 px-5 py-5">
				<p class="text-sm text-gray-600">
					Updating role for <span class="font-medium text-gray-900">{roleTarget.full_name || roleTarget.email}</span>.
				</p>
				<div class="grid grid-cols-3 gap-2">
					{#each ['owner', 'investor', 'operator'] as const as r}
						<button
							type="button"
							on:click={() => (roleDraft = r)}
							class="rounded-lg border px-3 py-2 text-xs font-medium capitalize transition"
							class:border-teal-500={roleDraft === r}
							class:bg-teal-50={roleDraft === r}
							class:text-teal-700={roleDraft === r}
							class:border-gray-200={roleDraft !== r}
							class:text-gray-600={roleDraft !== r}
							class:hover:bg-gray-50={roleDraft !== r}
						>
							{r}
						</button>
					{/each}
				</div>
				{#if dangerous && roleDraft !== roleTarget.role}
					<div class="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
						<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
						<span>
							{roleDraft === 'owner'
								? 'Granting owner gives full app access including user management. Double-check.'
								: 'Removing owner revokes admin access. Make sure at least one other owner exists.'}
						</span>
					</div>
				{/if}
			</div>
			<footer class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (roleTarget = null)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button
					on:click={submitRoleChange}
					disabled={roleSaving || roleDraft === roleTarget.role}
					class="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
				>
					{#if roleSaving}
						<Spinner size="sm" color="white" /> Saving…
					{:else}
						<Save class="h-4 w-4" /> Save
					{/if}
				</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Reset password modal -->
{#if resetTarget}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
		on:click={() => (resetTarget = null)}
		role="dialog"
		aria-modal="true"
	>
		<div
			on:click|stopPropagation
			transition:scale={{ duration: 200, start: 0.96 }}
			class="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
		>
			<header class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50">
						<KeyRound class="h-4 w-4 text-amber-600" />
					</div>
					<h3 class="text-lg font-semibold text-gray-900">Reset password</h3>
				</div>
				<button on:click={() => (resetTarget = null)} class="text-gray-400 hover:text-gray-600" aria-label="Close"><X class="h-5 w-5" /></button>
			</header>
			<div class="space-y-4 px-5 py-5">
				<p class="text-sm text-gray-600">
					Set a new password for <span class="font-medium text-gray-900">{resetTarget.full_name || resetTarget.email}</span>. Share it manually — they can change it after signing in.
				</p>
				<div class="flex gap-2">
					<div class="relative flex-1">
						<input
							type={resetVisible ? 'text' : 'password'}
							bind:value={resetPassword}
							placeholder="New password (min 8 chars)"
							class="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 font-mono text-sm transition focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
						/>
						<button
							type="button"
							on:click={() => (resetVisible = !resetVisible)}
							class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
							aria-label={resetVisible ? 'Hide' : 'Show'}
						>
							{#if resetVisible}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</button>
					</div>
					<button type="button" on:click={generateResetPassword} class="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50" title="Generate">
						<RefreshCw class="h-3.5 w-3.5" />
					</button>
					<button type="button" on:click={copyResetPassword} disabled={!resetPassword} class="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50" title="Copy">
						{#if resetCopied}
							<Check class="h-3.5 w-3.5 text-green-600" />
						{:else}
							<Copy class="h-3.5 w-3.5" />
						{/if}
					</button>
				</div>
				{#if resetPassword && resetPassword.length < 8}
					<p class="text-xs text-amber-700">Must be at least 8 characters.</p>
				{/if}
			</div>
			<footer class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button on:click={() => (resetTarget = null)} class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
				<button
					on:click={submitReset}
					disabled={resetSaving || resetPassword.length < 8}
					class="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-60"
				>
					{#if resetSaving}
						<Spinner size="sm" color="white" /> Resetting…
					{:else}
						<KeyRound class="h-4 w-4" /> Reset password
					{/if}
				</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Confirm hard-delete -->
{#if confirmDeleteUser}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
		on:click={() => (confirmDeleteUser = null)}
		role="dialog"
		aria-modal="true"
	>
		<div
			on:click|stopPropagation
			transition:scale={{ duration: 200, start: 0.96 }}
			class="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl"
		>
			<div class="px-5 py-5">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
						<Trash2 class="h-5 w-5 text-red-600" />
					</div>
					<div>
						<h3 class="text-base font-semibold text-gray-900">Permanently delete user?</h3>
						<p class="mt-1 text-sm text-gray-600">
							<span class="font-medium text-gray-800">{confirmDeleteUser.full_name || confirmDeleteUser.email}</span> will be removed from Supabase Auth. This cannot be undone.
						</p>
						<p class="mt-2 text-xs text-gray-500">
							If you only want to revoke access, use <strong>Deactivate</strong> instead.
						</p>
					</div>
				</div>
			</div>
			<div class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
				<button
					on:click={() => (confirmDeleteUser = null)}
					disabled={deleting}
					class="rounded-lg px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100"
				>
					Cancel
				</button>
				<button
					on:click={() => confirmDeleteUser && hardDelete(confirmDeleteUser)}
					disabled={deleting}
					class="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-70"
				>
					{#if deleting}
						<Spinner size="sm" color="white" /> Deleting…
					{:else}
						<Trash2 class="h-4 w-4" /> Delete permanently
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
