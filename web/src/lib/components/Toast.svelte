<script lang="ts">
  import { fly } from 'svelte/transition';
  import { toast } from '$lib/toast';
</script>

<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
  {#each $toast as t (t.id)}
    <div
      transition:fly={{ y: 20, duration: 200 }}
      class="px-4 py-3 rounded-lg shadow-lg text-sm font-medium
        {t.type === 'success' ? 'bg-success text-white' : ''}
        {t.type === 'error' ? 'bg-error text-white' : ''}
        {t.type === 'info' ? 'bg-accent text-accent-foreground' : ''}"
    >
      {t.message}
    </div>
  {/each}
</div>
