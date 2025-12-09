<script lang="ts">
  import { onMount } from 'svelte';
  import { getPosts, type Post } from '$lib/posts';
  import { getMyUpvotedPostIds } from '$lib/votes';
  import { useSession } from '$lib/auth';
  import PostCard from './PostCard.svelte';
  import LoadMoreButton from './LoadMoreButton.svelte';

  let {
    sort = 'hot',
    initialPosts = [],
    initialHasMore = false,
  }: {
    sort: 'hot' | 'new';
    initialPosts?: Post[];
    initialHasMore?: boolean;
  } = $props();

  const session = useSession();
  const user = $derived($session.data?.user);

  let posts = $state<Post[]>(initialPosts);
  let myUpvotes = $state<Set<string>>(new Set());
  let loading = $state(initialPosts.length === 0);
  let loadingMore = $state(false);
  let error = $state('');
  let page = $state(1);
  let hasMore = $state(initialHasMore);

  async function loadPosts(pageNum: number, append = false) {
    try {
      const response = await getPosts(sort, pageNum);
      if (append) {
        posts = [...posts, ...response.posts];
      } else {
        posts = response.posts;
      }
      hasMore = response.hasMore;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al cargar posts';
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    loadingMore = true;
    page += 1;
    await loadPosts(page, true);
    loadingMore = false;
  }

  onMount(async () => {
    try {
      // If no initial posts, fetch them client-side
      if (initialPosts.length === 0) {
        await loadPosts(1);
      }
      // Fetch upvotes client-side (requires auth cookies)
      const upvotedIds = await getMyUpvotedPostIds().catch(() => []);
      myUpvotes = new Set(upvotedIds);
    } finally {
      loading = false;
    }
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

{#if loading}
  <div class="flex justify-center py-8">
    <p class="text-neutral-500">Cargando posts...</p>
  </div>
{:else if error}
  <div class="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
    {error}
  </div>
{:else if posts.length === 0}
  <div class="text-center py-16">
    <p class="text-neutral-500 mb-4">No hay posts todavía</p>
    <a href="/submit" class="text-the-black hover:underline font-medium">
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
