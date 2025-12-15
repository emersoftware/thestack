<script lang="ts">
  import { page } from '$app/stores';
  import type { PageData } from './$types';
  import {
    getUserPosts,
    updateUserAbout,
    type UserProfile,
  } from '$lib/users';
  import { getMyUpvotedPostIds } from '$lib/votes';
  import { useSession } from '$lib/auth';
  import type { Post } from '$lib/posts';
  import PostCard from '$lib/components/PostCard.svelte';
  import LoadMoreButton from '$lib/components/LoadMoreButton.svelte';

  let { data }: { data: PageData } = $props();

  const username = $derived($page.params.username);
  const session = useSession();
  const currentUser = $derived($session.data?.user);
  const isOwnProfile = $derived(
    currentUser && 'username' in currentUser && currentUser.username === username
  );

  let profile = $state<UserProfile | null>(data.profile);
  let posts = $state<Post[]>(data.posts);
  let myUpvotes = $state<Set<string>>(new Set());
  let loadingMore = $state(false);
  let error = $state(data.profile ? '' : 'Usuario no encontrado');
  let pageNum = $state(1);
  let hasMore = $state(data.hasMore);

  let editing = $state(false);
  let editAbout = $state('');
  let saving = $state(false);

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
    const data = await getUserPosts(username, pageNum);
    posts = [...posts, ...data.posts];
    hasMore = data.hasMore;
    loadingMore = false;
  }

  function startEdit() {
    editAbout = profile?.about || '';
    editing = true;
  }

  async function saveAbout() {
    saving = true;
    try {
      await updateUserAbout(username, editAbout);
      if (profile) profile.about = editAbout;
      editing = false;
    } catch (err) {
      alert('Error al guardar');
    } finally {
      saving = false;
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
</script>

<svelte:head>
  <title>{username} - the stack</title>
</svelte:head>

<div class="mt-4 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-4">
  {#if error}
    <div
      class="rounded-lg border border-error bg-error/10 px-4 py-3 text-sm text-error"
    >
      {error}
    </div>
  {:else if profile}
    <div class="bg-card border border-border rounded-xl p-4 sm:p-4 mb-4">
      <div class="flex sm:flex-row justify-between sm:items-start gap-2 sm:gap-0">
        <div>
          <h1 class="text-lg text-foreground">{profile.username}</h1>
          <p class="text-xs sm:text-sm text-muted-foreground mt-1">
            {profile.karma} karma · miembro desde {formatDate(profile.createdAt)}
          </p>
        </div>
        {#if isOwnProfile && !editing}
          <div class="flex gap-3 self-start">
            <button
              onclick={startEdit}
              class="text-sm text-muted-foreground hover:text-foreground"
            >
              editar
            </button>
            <a
              href="/settings"
              class="text-sm text-muted-foreground hover:text-foreground"
            >
              config
            </a>
          </div>
        {/if}
      </div>

      {#if editing}
        <div class="mt-4">
          <textarea
            bind:value={editAbout}
            class="w-full border border-input rounded-lg p-3 text-sm bg-card text-foreground resize-none focus:outline-none focus:border-accent"
            rows="3"
            placeholder="Cuéntanos sobre ti..."
            maxlength="500"
          ></textarea>
          <div class="flex gap-2 mt-2">
            <button
              onclick={saveAbout}
              disabled={saving}
              class="px-3 py-1 text-sm bg-accent text-accent-foreground rounded-lg hover:opacity-80 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onclick={() => (editing = false)}
              class="px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      {:else if profile.about}
        <p class="mt-4 text-sm text-foreground">{profile.about}</p>
      {/if}
    </div>

    <h2 class="text-base sm:text-lg font-medium text-foreground mb-3 sm:mb-4">Posts</h2>
    {#if posts.length === 0}
      <p class="text-muted-foreground text-center py-8">Sin posts todavía</p>
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
  {/if}
</div>
