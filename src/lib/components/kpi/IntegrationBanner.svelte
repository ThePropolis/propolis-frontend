<script lang="ts">
  import { AlertTriangle, ExternalLink } from 'lucide-svelte';
  export let system: string;
  export let description: string;
  export let docsUrl: string = '';
</script>

<div class="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
  <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
  <div>
    <p class="text-sm font-semibold text-amber-800">Integration Pending: {system}</p>
    <p class="mt-0.5 text-xs text-amber-700">{description}</p>
    {#if docsUrl}
      <a href={docsUrl} class="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700 underline" target="_blank" rel="noopener">
        Setup guide <ExternalLink class="h-3 w-3" />
      </a>
    {/if}
  </div>
</div>
