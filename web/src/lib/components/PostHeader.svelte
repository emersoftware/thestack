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

    const wasUpvoted = optimisticUpvoted;
    const prevCount = optimisticCount;
    optimisticUpvoted = !wasUpvoted;
    optimisticCount += wasUpvoted ? -1 : 1;
    loading = true;

    if (!wasUpvoted) {
      logoStore.bump();
    }

    try {
      const result = await toggleUpvote(post.id);
      optimisticUpvoted = result.hasUpvoted;
      optimisticCount = result.upvotesCount;
    } catch (err) {
      optimisticUpvoted = wasUpvoted;
      optimisticCount = prevCount;

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

<a
  href={post.url}
  target="_blank"
  rel="noopener noreferrer"
  class="block bg-card border border-border hover:border-border-hover transition-colors duration-200 rounded-xl p-4"
>
  <article class="flex justify-between items-start gap-2">
    <div>
      <span class="text-lg text-foreground hover:underline">
        {post.title}
      </span>
      <div class="flex items-center gap-2 text-xs text-muted-foreground mt-4">
        <UpvoteButton
          count={optimisticCount}
          active={optimisticUpvoted}
          onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleUpvote(); }}
          {loading}
        />
        <span>·</span>
        <span>{getRelativeTime(post.createdAt)}</span>
        <span>·</span>
        <button
          type="button"
          onclick={(e) => { e.preventDefault(); e.stopPropagation(); goto(`/user/${post.author.username}`); }}
          class="hover:text-foreground"
        >
          {post.author.username}
        </button>
      </div>
    </div>
    <button
      type="button"
      onclick={(e) => { e.preventDefault(); e.stopPropagation(); goto(`/site/${post.domain}`); }}
      class="text-xs shrink-0 border-input border text-muted-foreground hover:border-border-hover hover:text-foreground transition-colors duration-200 px-2 py-1 rounded-full max-w-[120px] truncate"
    >
      {post.domain}
    </button>
  </article>
</a>
