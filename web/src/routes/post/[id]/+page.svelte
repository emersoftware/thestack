<script lang="ts">
  import type { PageData } from './$types';
  import PostHeader from '$lib/components/PostHeader.svelte';
  import Comments from '$lib/components/Comments.svelte';
  import { getUpvoteStatus } from '$lib/votes';

  let { data }: { data: PageData } = $props();
  // Initialize from server-provided hasUpvoted, fallback to false
  let hasUpvoted = $state(data.post.hasUpvoted ?? false);

  // Only fetch upvote status client-side if not provided by server
  $effect(() => {
    if (data.post.hasUpvoted === undefined) {
      getUpvoteStatus(data.post.id)
        .then((status) => {
          hasUpvoted = status;
        })
        .catch(() => {
          hasUpvoted = false;
        });
    }
  });
</script>

<svelte:head>
  <title>{data.post.title} - the stack</title>
  <meta property="og:title" content={data.post.title} />
  <meta property="og:description" content={`${data.post.domain} · @${data.post.author.username}`} />
  <meta property="og:url" content={`https://thestack.cl/post/${data.post.id}`} />
  <meta property="og:image" content={`https://thestack.cl/og/post/${data.post.id}`} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:title" content={data.post.title} />
  <meta name="twitter:description" content={`${data.post.domain} · @${data.post.author.username}`} />
  <meta name="twitter:image" content={`https://thestack.cl/og/post/${data.post.id}`} />
</svelte:head>

<div class="mt-4 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-4">
  <PostHeader post={data.post} {hasUpvoted} />

  <Comments postId={data.post.id} initialComments={data.comments} />
</div>
