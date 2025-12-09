<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import {
    getUser,
    getUserPosts,
    updateUserAbout,
    type UserProfile,
  } from '$lib/users';
  import { getMyUpvotedPostIds } from '$lib/votes';
  import { useSession } from '$lib/auth';
  import type { Post } from '$lib/posts';
  import PostCard from '$lib/components/PostCard.svelte';
  import LoadMoreButton from '$lib/components/LoadMoreButton.svelte';

  const username = $derived($page.params.username);
  const session = useSession();
  const currentUser = $derived($session.data?.user);
  const isOwnProfile = $derived(
    currentUser && 'username' in currentUser && currentUser.username === username
  );

  let profile = $state<UserProfile | null>(null);
  let posts = $state<Post[]>([]);
  let myUpvotes = $state<Set<string>>(new Set());
  let loading = $state(true);
  let loadingMore = $state(false);
  let error = $state('');
  let pageNum = $state(1);
  let hasMore = $state(false);

  let editing = $state(false);
  let editAbout = $state('');
  let saving = $state(false);

  async function loadData() {
    loading = true;
    error = '';
    try {
      const [profileData, postsData, upvotedIds] = await Promise.all([
        getUser(username),
        getUserPosts(username, 1),
        getMyUpvotedPostIds().catch(() => []),
      ]);
      profile = profileData;
      posts = postsData.posts;
      hasMore = postsData.hasMore;
      myUpvotes = new Set(upvotedIds);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al cargar perfil';
    } finally {
      loading = false;
    }
  }

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

  onMount(loadData);

  $effect(() => {
    if (username) {
      pageNum = 1;
      loadData();
    }
  });
</script>

<svelte:head>
  <title>{username} - the stack</title>
</svelte:head>

<div class="mt-4 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-4">
  {#if loading}
    <p class="text-neutral-500 text-center py-8">Cargando...</p>
  {:else if error}
    <div
      class="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {error}
    </div>
  {:else if profile}
    <div class="bg-the-white border border-neutral-200 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-the-black">{profile.username}</h1>
          <p class="text-xs sm:text-sm text-neutral-500 mt-1">
            {profile.karma} karma · miembro desde {formatDate(profile.createdAt)}
          </p>
        </div>
        {#if isOwnProfile && !editing}
          <button
            onclick={startEdit}
            class="text-sm text-neutral-500 hover:text-the-black self-start"
          >
            editar
          </button>
        {/if}
      </div>

      {#if editing}
        <div class="mt-4">
          <textarea
            bind:value={editAbout}
            class="w-full border border-neutral-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-the-black"
            rows="3"
            placeholder="Cuéntanos sobre ti..."
            maxlength="500"
          ></textarea>
          <div class="flex gap-2 mt-2">
            <button
              onclick={saveAbout}
              disabled={saving}
              class="px-3 py-1 text-sm bg-the-black text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onclick={() => (editing = false)}
              class="px-3 py-1 text-sm text-neutral-500 hover:text-the-black"
            >
              Cancelar
            </button>
          </div>
        </div>
      {:else if profile.about}
        <p class="mt-4 text-sm text-neutral-700">{profile.about}</p>
      {/if}
    </div>

    <h2 class="text-base sm:text-lg font-medium text-the-black mb-3 sm:mb-4">Posts</h2>
    {#if posts.length === 0}
      <p class="text-neutral-500 text-center py-8">Sin posts todavía</p>
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
