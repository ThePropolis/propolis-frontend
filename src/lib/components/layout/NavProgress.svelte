<script lang="ts">
	import { navigating } from '$app/stores';
	import { fade } from 'svelte/transition';

	// SvelteKit sets $navigating = { from, to, ... } while a nav is in flight.
	$: active = !!$navigating;
</script>

{#if active}
	<div
		out:fade={{ duration: 180 }}
		class="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden"
	>
		<div class="nav-progress-bar h-full bg-teal-500"></div>
	</div>
{/if}

<style>
	.nav-progress-bar {
		width: 30%;
		animation: navslide 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
		background: linear-gradient(90deg, rgba(20, 184, 166, 0.6), rgb(20, 184, 166), rgba(20, 184, 166, 0.6));
	}
	@keyframes navslide {
		0%   { transform: translateX(-120%); }
		50%  { transform: translateX(160%); }
		100% { transform: translateX(360%); }
	}
</style>
