<script lang="ts">
  import type { PageData } from './$types';
  import PostCard from '$lib/components/PostCard.svelte';
  import Comments from '$lib/components/Comments.svelte';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.post.title} - the stack</title>
</svelte:head>

<div class="mt-4 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-4">
  <PostCard post={data.post} hasUpvoted={data.hasUpvoted} />

  <Comments postId={data.post.id} initialComments={data.comments} />
</div>
