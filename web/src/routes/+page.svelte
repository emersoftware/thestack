<script lang="ts">
  import PostList from '$lib/components/PostList.svelte';
  import Footer from '$lib/components/Footer.svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>the stack</title>
  <meta property="og:title" content="the stack" />
  <meta property="og:description" content="the stack - latam hacker news" />
  <meta property="og:url" content="https://thestack.cl/" />
  <meta property="og:image" content="https://thestack.cl/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:title" content="the stack" />
  <meta name="twitter:description" content="the stack - latam hacker news" />
  <meta name="twitter:image" content="https://thestack.cl/og-image.png" />
</svelte:head>

<div class="mt-4 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-4">
  <PostList sort="hot" initialPosts={data.posts} initialHasMore={data.hasMore} />
</div>

<Footer />
