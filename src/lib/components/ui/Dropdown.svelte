<script lang="ts">
	import { fade } from 'svelte/transition';
	import { onDestroy } from 'svelte';

	export let align: 'left' | 'right' = 'right';

	let open = false;
	let wrapper: HTMLDivElement;

	function toggle() {
		open = !open;
	}
	function close() {
		open = false;
	}

	function onDocClick(e: MouseEvent) {
		if (!wrapper) return;
		if (!wrapper.contains(e.target as Node)) close();
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	$: if (typeof document !== 'undefined') {
		if (open) {
			document.addEventListener('click', onDocClick);
			document.addEventListener('keydown', onKey);
		} else {
			document.removeEventListener('click', onDocClick);
			document.removeEventListener('keydown', onKey);
		}
	}

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.removeEventListener('click', onDocClick);
			document.removeEventListener('keydown', onKey);
		}
	});
</script>

<div bind:this={wrapper} class="relative inline-block">
	<div on:click={toggle} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && toggle()}>
		<slot name="trigger" {toggle} {open} />
	</div>

	{#if open}
		<div
			transition:fade={{ duration: 100 }}
			class="absolute z-30 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
			class:right-0={align === 'right'}
			class:left-0={align === 'left'}
			on:click={close}
			role="menu"
			tabindex="-1"
		>
			<slot {close} />
		</div>
	{/if}
</div>
