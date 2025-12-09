<script lang="ts">
  import { page } from '$app/stores';
  import type { PageData } from './$types';
  import { getSitePosts } from '$lib/sites';
  import { getMyUpvotedPostIds } from '$lib/votes';
  import type { Post } from '$lib/posts';
  import PostCard from '$lib/components/PostCard.svelte';
  import LoadMoreButton from '$lib/components/LoadMoreButton.svelte';

  let { data }: { data: PageData } = $props();

  const domain = $derived($page.params.domain);

  let posts = $state<Post[]>(data.posts);
  let myUpvotes = $state<Set<string>>(new Set());
  let loadingMore = $state(false);
  let pageNum = $state(1);
  let hasMore = $state(data.hasMore);

  // Load upvotes client-side
  $effect(() => {
    getMyUpvotedPostIds()
      .then((ids) => {
        myUpvotes = new Set(ids);
      })
      .catch(() => {
        myUpvotes = new Set();
      });
  });

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    loadingMore = true;
    pageNum += 1;
    const siteData = await getSitePosts(domain, pageNum);
    posts = [...posts, ...siteData.posts];
    hasMore = siteData.hasMore;
    loadingMore = false;
  }
</script>

<svelte:head>
  <title>{data.domain} - the stack</title>
</svelte:head>

<div class="mt-4 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-4">
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
</div>
