<script lang="ts">
  let { title = '', url = '', username = '' }: { title?: string; url?: string; username?: string } = $props();

  function extractDomain(urlString: string): string {
    try {
      const parsed = new URL(urlString);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return '—';
    }
  }

  const domain = $derived(url ? extractDomain(url) : '—');
  const isEmpty = $derived(!title && !url);
</script>

<div class="bg-the-white rounded-xl p-4 border border-neutral-200 pointer-events-none">
  {#if isEmpty}
    <!-- Skeleton placeholder -->
    <div class="flex flex-col gap-2">
      <div class="flex w-full items-center gap-2">
        <div class="h-4 bg-neutral-200 rounded w-1/2 animate-pulse"></div>
        <div class="h-6 w-16 bg-neutral-200 rounded-full animate-pulse"></div>
      </div>
      <div class="flex items-center gap-3 text-xs text-neutral-400">
        <span>1 punto</span>
        <span>·</span>
        <span>hace 1m</span>
        {#if username}
          <span>·</span>
          <span>{username}</span>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Live preview -->
    <div class="flex flex-col gap-2">
      <div class="flex w-full items-center justify-between gap-2">
        <span class="truncate text-the-black text-sm leading-snug">
          {title || 'Título de tu post'}
        </span>
        <span class="shrink-0 text-xs border border-neutral-300 text-neutral-500 px-2 py-1 rounded-full">
          {domain}
        </span>
      </div>
      <div class="flex items-center gap-3 text-xs text-neutral-500">
        <span>1 punto</span>
        <span>·</span>
        <span>hace 1m</span>
        {#if username}
          <span>·</span>
          <span>{username}</span>
        {/if}
      </div>
    </div>
  {/if}
</div>
