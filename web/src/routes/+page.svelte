<script lang="ts">
  import PostList from '$lib/components/PostList.svelte';
</script>

<svelte:head>
  <title>the stack</title>
</svelte:head>

<div class="mt-8 w-full max-w-4xl mx-auto px-4">
  <PostList sort="hot" />
</div>
