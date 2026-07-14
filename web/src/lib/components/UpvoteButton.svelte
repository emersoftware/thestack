<script lang="ts">
  import { triggerAsciiBurstFromEvent } from '$lib/ascii-burst';

  let {
    count = 0,
    active = false,
    onclick,
    disabled = false,
    loading = false
  }: {
    count?: number;
    active?: boolean;
    onclick?: () => void;
    disabled?: boolean;
    loading?: boolean;
  } = $props();

  function handleClick(e: MouseEvent) {
    // Only burst when casting a vote (not un-voting) and the button is usable.
    if (!active && !disabled && !loading) {
      triggerAsciiBurstFromEvent(e);
    }
    onclick?.();
  }
</script>

<button
  type="button"
  onclick={handleClick}
  disabled={disabled || loading}
  aria-pressed={active}
  aria-label="Upvote"
  data-nav-upvote
  class="flex items-center gap-1 transition-colors hover:cursor-pointer disabled:cursor-not-allowed {active ? 'text-upvote' : 'text-muted-foreground hover:text-upvote'} {loading ? 'animate-pulse' : ''}"
>
  <svg
    class="w-4 h-4 {loading ? 'opacity-50' : ''}"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={active ? 'currentColor' : 'none'}
    stroke="currentColor"
    stroke-width="2"
  >
    <path d="M12 6 L19 18 L5 18 Z" />
  </svg>
  <span class="text-xs font-semibold {active ? 'text-upvote' : 'text-muted-foreground'} {loading ? 'opacity-50' : ''}">{count}</span>
</button>
