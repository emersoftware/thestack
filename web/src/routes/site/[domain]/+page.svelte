<script lang="ts">
  import { page } from '$app/stores';
  import type { PageData } from './$types';
  import { getSitePosts } from '$lib/sites';
  import { getMyUpvotedPostIds } from '$lib/votes';
  import { useSession } from '$lib/auth';
  import type { Post } from '$lib/posts';
  import PostCard from '$lib/components/PostCard.svelte';
  import LoadMoreButton from '$lib/components/LoadMoreButton.svelte';

  let { data }: { data: PageData } = $props();

  const domain = $derived($page.params.domain);
  const session = useSession();
  const user = $derived($session.data?.user);

  let posts = $state<Post[]>(data.posts);
  // Initialize upvotes from server-provided hasUpvoted field
  let myUpvotes = $state<Set<string>>(
    new Set(data.posts.filter((p) => p.hasUpvoted).map((p) => p.id))
  );
  let loadingMore = $state(false);
  let pageNum = $state(1);
  let hasMore = $state(data.hasMore);
  // Track if we have server-provided upvote data
  let hasServerUpvotes = $state(data.posts.some((p) => p.hasUpvoted !== undefined));

  // Only fetch upvotes client-side if not provided by server
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

  async function loadMore() {
    if (loadingMore || !hasMore || !domain) return;
    loadingMore = true;
    pageNum += 1;
    const siteData = await getSitePosts(domain, pageNum);
    posts = [...posts, ...siteData.posts];
    hasMore = siteData.hasMore;
    // Add new upvotes from loaded posts
    siteData.posts.forEach((p) => {
      if (p.hasUpvoted) {
        myUpvotes = new Set([...myUpvotes, p.id]);
      }
    });
    loadingMore = false;
  }
</script>

<svelte:head>
  <title>{data.domain} - the stack</title>
</svelte:head>

<div class="mt-4 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-4">
  <!-- Domain Header -->
  <div class="mb-4 sm:mb-6">
    <h1 class="text-xl sm:text-2xl font-bold text-foreground">{data.domain}</h1>
    <p class="text-xs sm:text-sm text-muted-foreground mt-1">
      {data.totalPosts}
      {data.totalPosts === 1 ? 'post' : 'posts'}
    </p>
  </div>

  <!-- Posts -->
  {#if posts.length === 0}
    <p class="text-muted-foreground text-center py-8">Sin posts de este dominio</p>
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
</div>
