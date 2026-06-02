<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto, beforeNavigate } from '$app/navigation';
	import Header from '../lib/components/layout/Header.svelte';
	import Sidebar from '../lib/components/layout/Sidebar.svelte';
	import Toaster from '$lib/components/ui/Toaster.svelte';
	import NavProgress from '$lib/components/layout/NavProgress.svelte';
	import { auth, getCurrentRole, isAuthenticated } from '$lib/api/auth';
	import { isRouteAllowed, roleLandingPage } from '$lib/data/routes';
	import { compactMode } from '$lib/stores/layoutStore';
	/** @typedef {'owner' | 'investor' | 'operator'} Role */

	let isSidebarOpen = false;
	let isDesktop = true;
	function toggleSidebar() {
		isSidebarOpen = !isSidebarOpen;
	}

	$: effectiveSidebarOpen = isSidebarOpen && !$compactMode;

	// Client-side navigation guard: intercept every route change and block
	// disallowed routes before the page loads. Defense-in-depth alongside
	// the backend role enforcement.
	beforeNavigate(({ to, cancel }) => {
		if (!to) return;
		const path = to.url.pathname;
		if (path === '/login') return;

		const role = /** @type {Role | null} */ (getCurrentRole());
		if (!role) {
			cancel();
			goto('/login');
			return;
		}
		if (!isRouteAllowed(path, role)) {
			cancel();
			goto(roleLandingPage[role]);
		}
	});

	onMount(() => {
		const init = async () => {
			await auth.checkAuth();

			const role = /** @type {Role | null} */ (getCurrentRole());
			const path = $page.url.pathname;
			if (path !== '/login') {
				if (!role) {
					goto('/login');
				} else if (!isRouteAllowed(path, role)) {
					goto(roleLandingPage[role]);
				}
			}
		};
		init();

		const handleResize = () => {
			isDesktop = window.innerWidth >= 768;
			isSidebarOpen = isDesktop;
		};
		handleResize();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});
</script>
<NavProgress />
<Toaster />
<div class="relative flex h-screen bg-gray-50">
	<!-- Sidebar Container - Only shown when authenticated -->
	{#if $isAuthenticated}
		<div
			class="sidebar-container fixed z-20 h-full overflow-hidden transition-all duration-300 ease-in-out"
			class:w-64={effectiveSidebarOpen}
			class:w-0={!effectiveSidebarOpen}
		>
			<div class="h-full w-full bg-white shadow-md">
				<Sidebar currentPath={$page.url.pathname} isSidebarOpen={effectiveSidebarOpen} {toggleSidebar} />
			</div>
		</div>

		<!-- Overlay for mobile when sidebar is open -->
		{#if !isDesktop && effectiveSidebarOpen}
			<button class="bg-opacity-30 fixed inset-0 z-10 bg-black" on:click={toggleSidebar} aria-label="Toggle Sidebar"></button>
		{/if}
	{/if}

	<!-- Main Content - Adjusts margin based on sidebar state -->
	<div
		class="z-0 flex flex-1 flex-col overflow-hidden transition-all duration-300"
		class:ml-0={!effectiveSidebarOpen || !$isAuthenticated}
		class:ml-64={effectiveSidebarOpen && isDesktop && $isAuthenticated}
	>
		{#if !$compactMode}
			<Header on:toggleSidebar={toggleSidebar} {isDesktop} isSidebarOpen={effectiveSidebarOpen} currentPath={$page.url.pathname} />
		{/if}
		<main class="flex-1 overflow-scroll bg-white p-6" class:pt-6={$compactMode}>
			<slot />
		</main>
	</div>
</div>
<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Inter', sans-serif;
	}
</style>