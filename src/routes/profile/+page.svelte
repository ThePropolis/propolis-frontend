<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { auth, user } from '$lib/api/auth';
	import { toast } from '$lib/components/ui/toastStore';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import { User as UserIcon, Upload, Save, Shield, Mail, Camera, Trash2, KeyRound, Eye, EyeOff } from 'lucide-svelte';

	type Profile = {
		email: string;
		full_name: string;
		role: string;
		avatar_url?: string | null;
	};

	let profile: Profile | null = null;
	let loading = true;
	let saving = false;
	let uploading = false;
	let fullName = '';
	let fileInput: HTMLInputElement;

	// Password change state
	let currentPw = '';
	let newPw = '';
	let confirmPw = '';
	let showCurrent = false;
	let showNew = false;
	let changingPw = false;

	async function loadMe() {
		loading = true;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/auth/me`, {
				headers: { Authorization: `Bearer ${get(auth).token}` }
			});
			if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
			profile = await res.json();
			fullName = profile?.full_name || '';
			// sync global store
			auth.updateUser({ full_name: profile?.full_name || '', avatar_url: profile?.avatar_url ?? null });
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			loading = false;
		}
	}

	onMount(loadMe);

	async function saveName() {
		if (!fullName.trim()) {
			toast.error('Name cannot be empty');
			return;
		}
		saving = true;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/auth/me`, {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${get(auth).token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ full_name: fullName.trim() })
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Save failed (${res.status})`);
			}
			const updated = await res.json();
			profile = updated;
			auth.updateUser({ full_name: updated.full_name });
			toast.success('Profile updated');
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			saving = false;
		}
	}

	function triggerFile() {
		fileInput?.click();
	}

	async function onFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			toast.error('Please pick an image file');
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			toast.error('Image must be under 5 MB');
			return;
		}

		uploading = true;
		try {
			const fd = new FormData();
			fd.append('file', file);
			const res = await fetch(`${PUBLIC_API_URL}/api/auth/me/avatar`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${get(auth).token}` },
				body: fd
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Upload failed (${res.status})`);
			}
			const { avatar_url } = await res.json();
			if (profile) profile.avatar_url = avatar_url;
			profile = profile; // reactive
			auth.updateUser({ avatar_url });
			toast.success('Profile picture updated');
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			uploading = false;
			if (target) target.value = '';
		}
	}

	async function changePassword() {
		if (newPw.length < 8) {
			toast.error('New password must be at least 8 characters');
			return;
		}
		if (newPw !== confirmPw) {
			toast.error('New password and confirmation do not match');
			return;
		}
		if (newPw === currentPw) {
			toast.error('New password must differ from current');
			return;
		}
		changingPw = true;
		try {
			const res = await fetch(`${PUBLIC_API_URL}/api/auth/me/password`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${get(auth).token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ current_password: currentPw, new_password: newPw })
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.detail || `Password change failed (${res.status})`);
			}
			currentPw = newPw = confirmPw = '';
			showCurrent = showNew = false;
			toast.success('Password updated. Use it next time you log in.');
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			changingPw = false;
		}
	}

	$: initials = (fullName || profile?.email || 'U')
		.split(/\s+|@/)
		.filter(Boolean)
		.map((p) => p[0])
		.slice(0, 2)
		.join('')
		.toUpperCase();

	function roleColor(r: string) {
		if (r === 'owner') return 'bg-purple-50 text-purple-700 border-purple-200';
		if (r === 'investor') return 'bg-blue-50 text-blue-700 border-blue-200';
		if (r === 'operator') return 'bg-amber-50 text-amber-700 border-amber-200';
		return 'bg-gray-50 text-gray-700 border-gray-200';
	}
</script>

<div class="mx-auto max-w-3xl space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<div class="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50">
			<UserIcon class="h-6 w-6 text-teal-600" />
		</div>
		<div>
			<h1 class="text-2xl font-semibold text-gray-900">Your profile</h1>
			<p class="text-sm text-gray-500">Update your name and profile picture.</p>
		</div>
	</div>

	<!-- Avatar card -->
	<section class="rounded-xl border border-gray-200 bg-white p-6">
		<div class="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
			<div class="relative">
				{#if loading}
					<Skeleton height="6rem" width="6rem" rounded="full" />
				{:else if profile?.avatar_url}
					<img
						src={profile.avatar_url}
						alt="Profile"
						class="h-24 w-24 rounded-full object-cover ring-4 ring-white shadow-md"
					/>
				{:else}
					<div
						class="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-2xl font-semibold text-white shadow-md"
					>
						{initials}
					</div>
				{/if}
				<button
					type="button"
					on:click={triggerFile}
					disabled={uploading}
					class="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-teal-600 text-white shadow-lg transition hover:bg-teal-700 disabled:opacity-70"
					aria-label="Upload photo"
					title="Upload photo"
				>
					{#if uploading}
						<Spinner size="sm" color="white" />
					{:else}
						<Camera class="h-4 w-4" />
					{/if}
				</button>
			</div>

			<div class="flex-1">
				<h2 class="text-lg font-semibold text-gray-900">Profile picture</h2>
				<p class="mt-1 text-sm text-gray-500">
					PNG, JPG or GIF. Max 5 MB. Square images look best.
				</p>
				<div class="mt-3 flex gap-2">
					<button
						type="button"
						on:click={triggerFile}
						disabled={uploading}
						class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
					>
						<Upload class="h-4 w-4" />
						{uploading ? 'Uploading…' : 'Upload new'}
					</button>
				</div>
				<input
					bind:this={fileInput}
					type="file"
					accept="image/*"
					on:change={onFileChange}
					class="hidden"
				/>
			</div>
		</div>
	</section>

	<!-- Details -->
	<section class="rounded-xl border border-gray-200 bg-white p-6">
		<h2 class="text-lg font-semibold text-gray-900">Account details</h2>
		<p class="mt-1 text-sm text-gray-500">Email and role are managed by the admin.</p>

		<div class="mt-5 space-y-4">
			<label class="block">
				<span class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Full name</span>
				{#if loading}
					<Skeleton height="2.5rem" />
				{:else}
					<input
						bind:value={fullName}
						class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
					/>
				{/if}
			</label>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<span class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Email</span>
					<div class="inline-flex w-full items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
						<Mail class="h-4 w-4 text-gray-400" />
						{loading ? '…' : profile?.email}
					</div>
				</div>
				<div>
					<span class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Role</span>
					{#if loading}
						<Skeleton height="2.5rem" />
					{:else}
						<div class="inline-flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm capitalize {roleColor(profile?.role || '')}">
							<Shield class="h-4 w-4" />
							{profile?.role}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="mt-5 flex justify-end">
			<button
				on:click={saveName}
				disabled={saving || loading || fullName.trim() === (profile?.full_name || '')}
				class="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
			>
				{#if saving}
					<Spinner size="sm" color="white" /> Saving…
				{:else}
					<Save class="h-4 w-4" /> Save changes
				{/if}
			</button>
		</div>
	</section>

	<!-- Change password -->
	<section class="rounded-xl border border-gray-200 bg-white p-6">
		<div class="flex items-center gap-2">
			<KeyRound class="h-5 w-5 text-teal-600" />
			<h2 class="text-lg font-semibold text-gray-900">Change password</h2>
		</div>
		<p class="mt-1 text-sm text-gray-500">
			You'll need your current password. Minimum 8 characters.
		</p>

		<div class="mt-5 grid gap-4 md:grid-cols-2">
			<label class="md:col-span-2">
				<span class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Current password</span>
				<div class="relative">
					<input
						type={showCurrent ? 'text' : 'password'}
						bind:value={currentPw}
						class="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
					/>
					<button
						type="button"
						on:click={() => (showCurrent = !showCurrent)}
						class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
						aria-label={showCurrent ? 'Hide' : 'Show'}
					>
						{#if showCurrent}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
					</button>
				</div>
			</label>
			<label>
				<span class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">New password</span>
				<div class="relative">
					<input
						type={showNew ? 'text' : 'password'}
						bind:value={newPw}
						class="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
					/>
					<button
						type="button"
						on:click={() => (showNew = !showNew)}
						class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
						aria-label={showNew ? 'Hide' : 'Show'}
					>
						{#if showNew}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
					</button>
				</div>
			</label>
			<label>
				<span class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Confirm new password</span>
				<input
					type={showNew ? 'text' : 'password'}
					bind:value={confirmPw}
					class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
				/>
			</label>
		</div>

		{#if newPw && newPw.length < 8}
			<p class="mt-2 text-xs text-amber-700">Password must be at least 8 characters.</p>
		{:else if newPw && confirmPw && newPw !== confirmPw}
			<p class="mt-2 text-xs text-amber-700">New password and confirmation do not match.</p>
		{/if}

		<div class="mt-5 flex justify-end">
			<button
				on:click={changePassword}
				disabled={changingPw || !currentPw || newPw.length < 8 || newPw !== confirmPw}
				class="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
			>
				{#if changingPw}
					<Spinner size="sm" color="white" /> Updating…
				{:else}
					<KeyRound class="h-4 w-4" /> Change password
				{/if}
			</button>
		</div>
	</section>

	<!-- Session -->
	<section class="rounded-xl border border-gray-200 bg-white p-6">
		<h2 class="text-lg font-semibold text-gray-900">Session</h2>
		<p class="mt-1 text-sm text-gray-500">Sign out of this browser.</p>
		<button
			on:click={() => auth.logout()}
			class="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
		>
			<Trash2 class="h-4 w-4" /> Log out
		</button>
	</section>
</div>
