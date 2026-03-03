<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { useSession, type CustomUser } from '$lib/auth';
  import { approveFeedPost, rejectFeedPost, updateFeedPostTitle, type PendingPost } from '$lib/feeds';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const username = $derived($page.params.username);
  const session = useSession();
  const currentUser = $derived($session.data?.user as CustomUser | undefined);

  let posts = $state<PendingPost[]>(data.posts);
  let loadingPosts = $state<Record<string, 'approving' | 'rejecting'>>({});
  let editingPostId = $state<string | null>(null);
  let editTitle = $state('');
  let savingTitle = $state(false);
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

  function startEditTitle(post: PendingPost) {
    editingPostId = post.id;
    editTitle = post.title;
  }

  function cancelEdit() {
    editingPostId = null;
    editTitle = '';
  }

  async function saveTitle(postId: string) {
    const trimmed = editTitle.trim();
    if (!trimmed || savingTitle) return;

    savingTitle = true;
    try {
      await updateFeedPostTitle(postId, trimmed);
      const post = posts.find((p) => p.id === postId);
      if (post) post.title = trimmed;
      editingPostId = null;
    } catch (err) {
      error = 'Error al actualizar titulo';
    } finally {
      savingTitle = false;
    }
  }

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
  <a href="/user/{username}" class="text-sm text-muted-foreground hover:text-foreground">&larr; Perfil</a>
  <h1 class="text-xl sm:text-2xl font-bold text-foreground mt-3 mb-6">Posts pendientes</h1>

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
              {#if editingPostId === post.id}
                <div class="flex gap-2 items-center">
                  <input
                    type="text"
                    bind:value={editTitle}
                    onkeydown={(e) => { if (e.key === 'Enter') saveTitle(post.id); if (e.key === 'Escape') cancelEdit(); }}
                    class="flex-1 bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:border-accent"
                    maxlength="200"
                  />
                  <button
                    onclick={() => saveTitle(post.id)}
                    disabled={savingTitle || !editTitle.trim()}
                    class="px-2 py-1 text-xs font-medium rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
                  >
                    {savingTitle ? '...' : 'OK'}
                  </button>
                  <button
                    onclick={cancelEdit}
                    class="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    &times;
                  </button>
                </div>
              {:else}
                <div class="flex items-start gap-1">
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-foreground hover:underline font-medium"
                  >
                    {post.title}
                  </a>
                  <button
                    onclick={() => startEditTitle(post)}
                    class="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                    title="Editar titulo"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    </svg>
                  </button>
                </div>
              {/if}
              <div class="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                <span>{post.domain}</span>
                {#if post.createdAt}
                  <span>&middot;</span>
                  <span>{new Date(post.createdAt).toLocaleDateString('es-CL')}</span>
                {/if}
                {#if post.feedName}
                  <span>&middot;</span>
                  <span class="text-accent">{post.feedName}</span>
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
