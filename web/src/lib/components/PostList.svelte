<script lang="ts">
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
  // Initialize upvotes from server-provided hasUpvoted field
  let myUpvotes = $state<Set<string>>(
    new Set(initialPosts.filter((p) => p.hasUpvoted).map((p) => p.id))
  );
  let loadingMore = $state(false);
  let error = $state('');
  let page = $state(1);
  let hasMore = $state(initialHasMore);
  // Track if we have server-provided upvote data
  let hasServerUpvotes = $state(initialPosts.some((p) => p.hasUpvoted !== undefined));

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    loadingMore = true;
    page += 1;
    try {
      const response = await getPosts(sort, page);
      posts = [...posts, ...response.posts];
      hasMore = response.hasMore;
      // Add new upvotes from loaded posts
      response.posts.forEach((p) => {
        if (p.hasUpvoted) {
          myUpvotes = new Set([...myUpvotes, p.id]);
        }
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al cargar posts';
    } finally {
      loadingMore = false;
    }
  }

  // Only refetch upvotes when user changes and we don't have server data
  $effect(() => {
    if (user && !hasServerUpvotes) {
      getMyUpvotedPostIds()
        .then((ids) => {
          myUpvotes = new Set(ids);
        })
        .catch(() => {
          myUpvotes = new Set();
        });
    } else if (!user && !hasServerUpvotes) {
      // Only reset if we don't have server data
      // (prevents clearing SSR upvotes during hydration)
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
