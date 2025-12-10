<script lang="ts">
  import type { PageData } from './$types';
  import PostHeader from '$lib/components/PostHeader.svelte';
  import Comments from '$lib/components/Comments.svelte';
  import { getUpvoteStatus } from '$lib/votes';

  let { data }: { data: PageData } = $props();
  let hasUpvoted = $state(false);

  // Load upvote status client-side (requires auth cookies)
  $effect(() => {
    getUpvoteStatus(data.post.id)
      .then((status) => {
        hasUpvoted = status;
      })
      .catch(() => {
        hasUpvoted = false;
      });
  });
</script>

<svelte:head>
  <title>{data.post.title} - the stack</title>
</svelte:head>

<div class="mt-4 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-4">
  <PostHeader post={data.post} {hasUpvoted} />

  <Comments postId={data.post.id} initialComments={data.comments} />
</div>
