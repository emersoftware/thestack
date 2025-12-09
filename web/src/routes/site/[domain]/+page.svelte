<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { getSitePosts, type SitePostsResponse } from '$lib/sites';
  import { getMyUpvotedPostIds } from '$lib/votes';
  import type { Post } from '$lib/posts';
  import PostCard from '$lib/components/PostCard.svelte';
  import LoadMoreButton from '$lib/components/LoadMoreButton.svelte';

  const domain = $derived($page.params.domain);

  let data = $state<SitePostsResponse | null>(null);
  let posts = $state<Post[]>([]);
  let myUpvotes = $state<Set<string>>(new Set());
  let loading = $state(true);
  let loadingMore = $state(false);
  let error = $state('');
  let pageNum = $state(1);
  let hasMore = $state(false);

  async function loadData() {
    loading = true;
    error = '';
    try {
      const [siteData, upvotedIds] = await Promise.all([
        getSitePosts(domain, 1),
        getMyUpvotedPostIds().catch(() => []),
      ]);
      data = siteData;
      posts = siteData.posts;
      hasMore = siteData.hasMore;
      myUpvotes = new Set(upvotedIds);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al cargar posts';
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    loadingMore = true;
    pageNum += 1;
    const siteData = await getSitePosts(domain, pageNum);
    posts = [...posts, ...siteData.posts];
    hasMore = siteData.hasMore;
    loadingMore = false;
  }

  onMount(loadData);

  $effect(() => {
    if (domain) {
      pageNum = 1;
      loadData();
    }
  });
</script>

<svelte:head>
  <title>{domain} - the stack</title>
</svelte:head>

<div class="mt-4 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-4">
  {#if loading}
    <p class="text-neutral-500 text-center py-8">Cargando...</p>
  {:else if error}
    <div
      class="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {error}
    </div>
  {:else if data}
    <!-- Domain Header -->
    <div class="mb-4 sm:mb-6">
      <h1 class="text-xl sm:text-2xl font-bold text-the-black">{data.domain}</h1>
      <p class="text-xs sm:text-sm text-neutral-500 mt-1">
        {data.totalPosts}
        {data.totalPosts === 1 ? 'post' : 'posts'}
      </p>
    </div>

    <!-- Posts -->
    {#if posts.length === 0}
      <p class="text-neutral-500 text-center py-8">Sin posts de este dominio</p>
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
  {/if}
</div>
