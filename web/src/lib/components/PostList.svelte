<script lang="ts">
  import { onMount } from 'svelte';
  import { getPosts, type Post } from '$lib/posts';
  import { getMyUpvotedPostIds } from '$lib/votes';
  import { useSession } from '$lib/auth';
  import PostCard from './PostCard.svelte';
  import LoadMoreButton from './LoadMoreButton.svelte';

  let {
    sort = 'hot',
    initialPosts,
    initialHasMore,
  }: {
    sort: 'hot' | 'new';
    initialPosts: Post[];
    initialHasMore: boolean;
  } = $props();

  const session = useSession();
  const user = $derived($session.data?.user);

  let posts = $state<Post[]>(initialPosts);
  let myUpvotes = $state<Set<string>>(new Set());
  let loadingMore = $state(false);
  let error = $state('');
  let page = $state(1);
  let hasMore = $state(initialHasMore);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    loadingMore = true;
    page += 1;
    try {
      const response = await getPosts(sort, page);
      posts = [...posts, ...response.posts];
      hasMore = response.hasMore;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al cargar posts';
    } finally {
      loadingMore = false;
    }
  }

  onMount(async () => {
    // Fetch upvotes client-side (requires auth cookies)
    const upvotedIds = await getMyUpvotedPostIds().catch(() => []);
    myUpvotes = new Set(upvotedIds);
  });

  // Refetch upvotes when user changes
  $effect(() => {
    if (user) {
      getMyUpvotedPostIds()
        .then((ids) => {
          myUpvotes = new Set(ids);
        })
        .catch(() => {
          myUpvotes = new Set();
        });
    } else {
      myUpvotes = new Set();
    }
  });
</script>

{#if error}
  <div class="rounded-lg border border-error bg-error/10 px-4 py-3 text-sm text-error">
    {error}
  </div>
{:else if posts.length === 0}
  <div class="text-center py-16">
    <p class="text-muted-foreground mb-4">No hay posts todavía</p>
    <a href="/submit" class="text-foreground hover:underline font-medium">
      Sé el primero en publicar
    </a>
  </div>
{:else}
  <div class="grid gap-2 sm:gap-3 justify-items-stretch sm:justify-items-start">
    {#each posts as post (post.id)}
      <PostCard {post} hasUpvoted={myUpvotes.has(post.id)} />
    {/each}
  </div>

  {#if hasMore}
    <LoadMoreButton loading={loadingMore} onclick={loadMore} />
  {/if}
{/if}
