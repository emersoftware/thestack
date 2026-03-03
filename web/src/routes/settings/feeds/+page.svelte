<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { useSession, type CustomUser } from '$lib/auth';
  import { getPendingPosts, approveFeedPost, rejectFeedPost, getMyFeeds, getFeedLogs, type PendingPost, type Feed, type FeedLog } from '$lib/feeds';

  const session = useSession();
  const user = $derived($session.data?.user as CustomUser | undefined);

  let posts = $state<PendingPost[]>([]);
  let loading = $state(true);
  let error = $state('');
  let loadingPosts = $state<Record<string, 'approving' | 'rejecting'>>({});

  // Logs state
  let feeds = $state<Feed[]>([]);
  let selectedFeedId = $state<string | null>(null);
  let logs = $state<FeedLog[]>([]);
  let logsLoading = $state(false);
  let showLogs = $state(false);

  onMount(async () => {
    if (!user) {
      goto('/login');
      return;
    }

    try {
      const [postsData, feedsData] = await Promise.all([
        getPendingPosts(),
        getMyFeeds(),
      ]);
      posts = postsData.posts;
      feeds = feedsData.feeds;
    } catch (err) {
      error = 'Error al cargar posts pendientes';
    } finally {
      loading = false;
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

  async function loadLogs(feedId: string) {
    if (selectedFeedId === feedId && showLogs) {
      showLogs = false;
      return;
    }
    selectedFeedId = feedId;
    logsLoading = true;
    showLogs = true;
    try {
      const data = await getFeedLogs(feedId);
      logs = data.logs;
    } catch (err) {
      error = 'Error al cargar logs';
    } finally {
      logsLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Posts pendientes - the stack</title>
</svelte:head>

<div class="mt-4 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-4">
  <div class="flex items-center gap-4 mb-6">
    <a href="/settings" class="text-sm text-muted-foreground hover:text-foreground">&larr; Configuracion</a>
    <h1 class="text-xl sm:text-2xl font-bold text-foreground">Posts pendientes</h1>
  </div>

  {#if loading}
    <p class="text-muted-foreground text-center py-8">Cargando...</p>
  {:else if error}
    <div class="rounded-lg border border-error bg-error/10 px-4 py-3 text-sm text-error mb-4">
      {error}
    </div>
  {:else if posts.length === 0}
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

  <!-- Feed Logs Section -->
  {#if !loading && feeds.length > 0}
    <div class="bg-card border border-border rounded-xl p-4 mt-6">
      <h2 class="text-base font-medium text-foreground mb-3">Historial de procesamiento</h2>
      <div class="flex flex-wrap gap-2 mb-4">
        {#each feeds as feed (feed.id)}
          <button
            onclick={() => loadLogs(feed.id)}
            class="px-3 py-1.5 text-xs rounded-lg border transition-colors {selectedFeedId === feed.id && showLogs ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted-foreground hover:border-border-hover'}"
          >
            {feed.name}
          </button>
        {/each}
      </div>

      {#if showLogs}
        {#if logsLoading}
          <p class="text-xs text-muted-foreground">Cargando logs...</p>
        {:else if logs.length === 0}
          <p class="text-xs text-muted-foreground">No hay logs para este feed.</p>
        {:else}
          <div class="space-y-2">
            {#each logs as log (log.id)}
              <div class="border border-border rounded-lg p-3 text-xs">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium text-foreground truncate">{log.emailSubject || 'Sin asunto'}</span>
                  <span class="shrink-0 px-2 py-0.5 rounded-full {log.status === 'completed' ? 'bg-success/10 text-success' : log.status === 'error' ? 'bg-error/10 text-error' : 'bg-muted text-muted-foreground'}">
                    {log.status}
                  </span>
                </div>
                <div class="flex items-center gap-3 mt-1 text-muted-foreground">
                  {#if log.emailFrom}
                    <span>De: {log.emailFrom}</span>
                  {/if}
                </div>
                {#if log.error}
                  <p class="mt-1 text-error">{log.error}</p>
                {/if}
                <p class="mt-1 text-muted-foreground">{new Date(log.createdAt).toLocaleString('es-CL')}</p>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
