<script lang="ts">
	import { fly } from 'svelte/transition';
	import { CheckCircle2, AlertCircle, Info, X } from 'lucide-svelte';
	import { toast } from './toastStore';
</script>

<div class="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
	{#each $toast as t (t.id)}
		<div
			in:fly={{ x: 40, duration: 220 }}
			out:fly={{ x: 40, duration: 180 }}
			class="pointer-events-auto flex max-w-sm items-start gap-3 rounded-lg border bg-white px-4 py-3 shadow-lg"
			class:border-green-200={t.variant === 'success'}
			class:border-red-200={t.variant === 'error'}
			class:border-blue-200={t.variant === 'info'}
		>
			{#if t.variant === 'success'}
				<CheckCircle2 class="h-5 w-5 shrink-0 text-green-600" />
			{:else if t.variant === 'error'}
				<AlertCircle class="h-5 w-5 shrink-0 text-red-600" />
			{:else}
				<Info class="h-5 w-5 shrink-0 text-blue-600" />
			{/if}
			<p class="flex-1 text-sm text-gray-800">{t.message}</p>
			<button
				on:click={() => toast.dismiss(t.id)}
				class="text-gray-400 hover:text-gray-600"
				aria-label="Dismiss"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	{/each}
</div>
