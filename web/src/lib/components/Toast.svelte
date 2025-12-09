<script lang="ts">
  import { fly } from 'svelte/transition';
  import { toast } from '$lib/toast';
</script>

<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
  {#each $toast as t (t.id)}
    <div
      transition:fly={{ y: 20, duration: 200 }}
      class="px-4 py-3 rounded-lg shadow-lg text-sm font-medium
        {t.type === 'success' ? 'bg-the-green text-white' : ''}
        {t.type === 'error' ? 'bg-the-red text-white' : ''}
        {t.type === 'info' ? 'bg-the-black text-white' : ''}"
    >
      {t.message}
    </div>
  {/each}
</div>
