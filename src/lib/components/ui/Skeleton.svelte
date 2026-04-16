<script lang="ts">
	export let height = '1rem';
	export let width: string = '100%';
	export let rounded: 'sm' | 'md' | 'lg' | 'full' = 'md';
</script>

<div
	class="animate-pulse bg-gray-200"
	class:rounded-sm={rounded === 'sm'}
	class:rounded-md={rounded === 'md'}
	class:rounded-lg={rounded === 'lg'}
	class:rounded-full={rounded === 'full'}
	style="height: {height}; width: {width};"
></div>
