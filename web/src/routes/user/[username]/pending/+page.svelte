<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { useSession, type CustomUser } from '$lib/auth';
  import { approveFeedPost, rejectFeedPost, type PendingPost } from '$lib/feeds';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const username = $derived($page.params.username);
  const session = useSession();
  const currentUser = $derived($session.data?.user as CustomUser | undefined);

  let posts = $state<PendingPost[]>(data.posts);
  let loadingPosts = $state<Record<string, 'approving' | 'rejecting'>>({});
  let error = $state('');

  // Redirect if not own profile
  $effect(() => {
    if ($session.isPending) return;
    if (!currentUser) {
      goto(`/login?redirect=/user/${username}/pending`);
      return;
    }
    if (currentUser.username !== username) {
      goto(`/user/${username}`);
    }
  });

  async function handleApprove(postId: string) {
    if (loadingPosts[postId]) return;
    loadingPosts[postId] = 'approving';
    try {
      await approveFeedPost(postId);
      posts = posts.filter((p) => p.id !== postId);
    } catch (err) {
      error = 'Error al aprobar post';
    } finally {
      const { [postId]: _, ...rest } = loadingPosts;
      loadingPosts = rest;
    }
  }

  async function handleReject(postId: string) {
    if (loadingPosts[postId]) return;
    loadingPosts[postId] = 'rejecting';
    try {
      await rejectFeedPost(postId);
      posts = posts.filter((p) => p.id !== postId);
    } catch (err) {
      error = 'Error al rechazar post';
    } finally {
      const { [postId]: _, ...rest } = loadingPosts;
      loadingPosts = rest;
    }
  }
</script>

<svelte:head>
  <title>Posts pendientes - the stack</title>
</svelte:head>

<div class="mt-4 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-4">
  <div class="flex items-center gap-4 mb-6">
    <a href="/user/{username}" class="text-sm text-muted-foreground hover:text-foreground">&larr; Perfil</a>
    <h1 class="text-xl sm:text-2xl font-bold text-foreground">Posts pendientes</h1>
  </div>

  {#if error}
    <div class="rounded-lg border border-error bg-error/10 px-4 py-3 text-sm text-error mb-4">
      {error}
    </div>
  {/if}

  {#if posts.length === 0}
    <div class="bg-card border border-border rounded-xl p-6 text-center">
      <p class="text-muted-foreground">No hay posts pendientes de aprobacion.</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each posts as post (post.id)}
        <div class="bg-card border border-border rounded-xl p-4">
          <div class="flex justify-between items-start gap-3">
            <div class="min-w-0 flex-1">
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-foreground hover:underline font-medium"
              >
                {post.title}
              </a>
              <div class="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span>{post.domain}</span>
                {#if post.createdAt}
                  <span>&middot;</span>
                  <span>{new Date(post.createdAt).toLocaleDateString('es-CL')}</span>
                {/if}
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              <button
                onclick={() => handleApprove(post.id)}
                disabled={!!loadingPosts[post.id]}
                class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingPosts[post.id] === 'approving' ? 'Aprobando...' : 'Aprobar'}
              </button>
              <button
                onclick={() => handleReject(post.id)}
                disabled={!!loadingPosts[post.id]}
                class="px-3 py-1.5 text-xs font-medium rounded-lg border border-error text-error hover:bg-error/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingPosts[post.id] === 'rejecting' ? 'Rechazando...' : 'Rechazar'}
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
