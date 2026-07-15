<script lang="ts">
  import { get } from 'svelte/store';
  import PostList from '$lib/components/PostList.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { pendingPost } from '$lib/stores/pendingPost';

  let { data } = $props();

  // If we arrived from /submit, consume the just-published post exactly once so
  // PostList can animate it into the list. Cleared immediately so revisiting
  // /new later doesn't replay the animation.
  const enterPost = get(pendingPost);
  pendingPost.set(null);
</script>

<svelte:head>
  <title>New - the stack</title>
</svelte:head>

<div class="mt-4 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-4">
  <PostList sort="new" initialPosts={data.posts} initialHasMore={data.hasMore} {enterPost} />
</div>

<Footer />
