<script lang="ts">
  import type { Post } from '$lib/posts';
  import { toggleUpvote } from '$lib/votes';
  import { useSession } from '$lib/auth';
  import { goto } from '$app/navigation';
  import UpvoteButton from './UpvoteButton.svelte';
  import { logoStore } from '$lib/stores/logo';
  import { toast } from '$lib/toast';
  import { ApiError } from '$lib/api';

  let { post, hasUpvoted = false }: { post: Post; hasUpvoted?: boolean } = $props();

  const session = useSession();
  const user = $derived($session.data?.user);

  let optimisticUpvoted = $state(hasUpvoted);
  let optimisticCount = $state(post.upvotesCount);
  let loading = $state(false);

  // Sync with prop changes
  $effect(() => {
    optimisticUpvoted = hasUpvoted;
  });

  $effect(() => {
    optimisticCount = post.upvotesCount;
  });

  async function handleUpvote() {
    if (!user) {
      goto('/login');
      return;
    }

    if (loading) return;

    // Optimistic update
    const wasUpvoted = optimisticUpvoted;
    const prevCount = optimisticCount;
    optimisticUpvoted = !wasUpvoted;
    optimisticCount += wasUpvoted ? -1 : 1;
    loading = true;

    // Trigger logo animation when upvoting (not when removing)
    if (!wasUpvoted) {
      logoStore.bump();
    }

    try {
      const result = await toggleUpvote(post.id);
      // Sync with server
      optimisticUpvoted = result.hasUpvoted;
      optimisticCount = result.upvotesCount;
    } catch (err) {
      // Rollback on error
      optimisticUpvoted = wasUpvoted;
      optimisticCount = prevCount;

      // Show toast for email verification error
      if (err instanceof ApiError && err.status === 403) {
        toast.error('Debes verificar tu email para votar');
      }
    } finally {
      loading = false;
    }
  }

  function getRelativeTime(dateString: string): string {
    const created = new Date(dateString);
    const now = new Date();
    const ms = now.getTime() - created.getTime();
    const mins = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    if (mins < 60) {
      return `hace ${mins === 0 ? 1 : mins}m`;
    }
    if (hours < 24) {
      return `hace ${hours}h`;
    }
    if (days < 7) {
      return `hace ${days === 0 ? 1 : days}d`;
    }

    const weeks = Math.floor(days / 7);
    if (weeks < 4) {
      return `hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
    }

    const months = Math.floor(days / 30);
    return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
  }
</script>

<article
  data-nav-item
  data-nav-id={post.id}
  class="bg-card rounded-xl py-3 pl-3 pr-3 sm:pl-4 border border-border hover:border-border-hover transition-colors duration-200 w-full sm:w-fit"
>
  <div class="flex flex-col gap-2">
    <div class="flex items-start sm:items-center justify-between gap-2">
      <a
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        data-nav-link
        class="hover:underline text-foreground hover:text-muted-foreground text-sm leading-snug break-words sm:truncate sm:max-w-md"
      >
        {post.title}
      </a>
      <a
        href="/site/{post.domain}"
        class="text-xs shrink-0 border-input border text-muted-foreground hover:border-border-hover hover:text-foreground transition-colors duration-200 px-2 py-1 m-0 rounded-full max-w-[120px] truncate"
      >
        {post.domain}
      </a>
    </div>
    <div class="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground flex-wrap">
      <UpvoteButton
        count={optimisticCount}
        active={optimisticUpvoted}
        onclick={handleUpvote}
        {loading}
      />
      <span class="hidden sm:inline">·</span>
      <span>{getRelativeTime(post.createdAt)}</span>
      <span>·</span>
      <a href="/user/{post.author.username}" class="hover:text-foreground truncate max-w-[100px] sm:max-w-none">
        {post.author.username}
      </a>
      <span>·</span>
      <a href="/post/{post.id}" data-nav-comments class="hover:text-foreground">
        comentarios
      </a>
    </div>
  </div>
</article>
