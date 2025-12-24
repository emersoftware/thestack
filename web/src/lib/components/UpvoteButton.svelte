<script lang="ts">
  let {
    count = 0,
    active = false,
    onclick,
    disabled = false,
    loading = false
  }: {
    count?: number;
    active?: boolean;
    onclick?: (e: MouseEvent) => void;
    disabled?: boolean;
    loading?: boolean;
  } = $props();
</script>

<button
  type="button"
  onclick={onclick}
  disabled={disabled || loading}
  aria-pressed={active}
  aria-label="Upvote"
  data-nav-upvote
  class="flex items-center gap-1 transition-colors hover:cursor-pointer disabled:cursor-not-allowed {active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'} {loading ? 'animate-pulse' : ''}"
>
  <svg
    class="w-4 h-4 {loading ? 'opacity-50' : ''}"
    viewBox="0 0 24 24"
    fill={active ? 'currentColor' : 'none'}
    stroke="currentColor"
    stroke-width="2"
  >
    <path d="M12 6 L19 18 L5 18 Z" />
  </svg>
  <span class="text-xs font-semibold {active ? 'text-foreground' : 'text-muted-foreground'} {loading ? 'opacity-50' : ''}">{count}</span>
</button>
