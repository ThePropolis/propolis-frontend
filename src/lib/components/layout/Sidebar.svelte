<script>
	import { routes, isActiveRoute } from '../../data/routes';
	import { Menu, LogOut, User as UserIcon } from 'lucide-svelte';
	import { user, auth } from '../../api/auth';

	$: userName = $user?.full_name || 'Guest';
	$: userRole = $user?.role || 'User';
	$: avatarUrl = $user?.avatar_url;
	$: initials = (userName || 'G').split(/\s+/).map((/** @type {string} */ p) => p[0]).slice(0, 2).join('').toUpperCase();
	$: visibleRoutes = routes.filter(r => userRole && r.allowedRoles.includes(/** @type {any} */ (userRole)));

	function handleLogout() {
		auth.logout();
	}

	// Props
	export let currentPath = '/';
	export let isSidebarOpen = true;
	export let toggleSidebar = () => {};
</script>

<div class="flex h-full flex-col">
	<!-- Logo and Brand with Close Button -->
	<div class="mb-8 p-6 flex  justify-between items-center gap-2">
		<!-- Close button when sidebar is open -->

		<a href="/" class="">
			{#if isSidebarOpen}
				<img src="/logo.png" alt="Propolis"  />
			{/if}
      
		</a>
    {#if isSidebarOpen}
		<button
			class="right-4 top-6 text-gray-500 hover:text-gray-700 focus:outline-none"
			on:click={toggleSidebar}
			aria-label="Close Sidebar"
		>
			<Menu class="h-5 w-5" />
		</button>
	{/if}
	</div>

	<!-- Navigation Links -->
	<nav class="flex-1 px-4">
		<ul class="space-y-1">
			{#each visibleRoutes as route (route.path)}
				<li>
					<a
						href={route.path}
						class="flex items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-gray-100
                  {isActiveRoute(currentPath, route.path)
							? 'text-gray-700'
							: 'text-gray-700'}"
						style={isActiveRoute(currentPath, route.path) 
							? 'background-color: rgba(0, 150, 136, 0.1); color: var(--color-propolis-teal);'
							: ''}
					>
						<svelte:component
							this={route.icon}
							class="h-5 w-5"
							style="color: {isActiveRoute(currentPath, route.path)
								? 'var(--color-propolis-teal)'
								: '#6b7280'}"
						/>
						{#if isSidebarOpen}
							<span>{route.name}</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</nav>



	<!-- User Profile Section -->
	<div class="mt-auto border-t border-gray-200 p-3">
		<a
			href="/profile"
			class="group flex items-center gap-3 rounded-lg p-2 transition hover:bg-gray-100"
		>
			{#if avatarUrl}
				<img
					src={avatarUrl}
					alt="Profile"
					class="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white"
				/>
			{:else}
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-xs font-semibold text-white">
					{initials || 'U'}
				</div>
			{/if}
			{#if isSidebarOpen}
				<div class="min-w-0 flex-1">
					<div class="truncate text-sm font-medium text-gray-900">{userName}</div>
					<div class="truncate text-xs capitalize text-gray-500">{userRole}</div>
				</div>
				<UserIcon class="h-4 w-4 shrink-0 text-gray-400 opacity-0 transition group-hover:opacity-100" />
			{/if}
		</a>

		{#if isSidebarOpen}
			<button
				on:click={handleLogout}
				class="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 transition hover:bg-red-50 hover:text-red-600"
			>
				<LogOut class="h-4 w-4" />
				<span>Log out</span>
			</button>
		{:else}
			<button
				on:click={handleLogout}
				class="mt-1 flex w-full items-center justify-center rounded-lg py-2 text-gray-600 transition hover:bg-red-50 hover:text-red-600"
				aria-label="Log out"
				title="Log out"
			>
				<LogOut class="h-4 w-4" />
			</button>
		{/if}
	</div>
</div>
