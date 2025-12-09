<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { useSession, type CustomUser } from '$lib/auth';
  import {
    getAdminStats,
    getAdminUsers,
    getAdminPosts,
    promoteUser,
    demoteUser,
    banUser,
    unbanUser,
    deletePost,
    restorePost,
    type AdminStats,
    type AdminUser,
    type AdminPost,
  } from '$lib/admin';

  const session = useSession();
  const user = $derived($session.data?.user as CustomUser | undefined);

  let activeTab = $state<'stats' | 'users' | 'posts'>('stats');
  let stats = $state<AdminStats | null>(null);
  let users = $state<AdminUser[]>([]);
  let posts = $state<AdminPost[]>([]);
  let loading = $state(true);
  let error = $state('');

  async function loadData() {
    loading = true;
    error = '';
    try {
      const [statsData, usersData, postsData] = await Promise.all([
        getAdminStats(),
        getAdminUsers(),
        getAdminPosts(),
      ]);
      stats = statsData;
      users = usersData.users;
      posts = postsData.posts;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al cargar datos';
      if (error.includes('403') || error.includes('401')) {
        goto('/');
      }
    } finally {
      loading = false;
    }
  }

  async function handlePromote(id: string) {
    await promoteUser(id);
    users = users.map((u) => (u.id === id ? { ...u, isAdmin: true } : u));
  }

  async function handleDemote(id: string) {
    await demoteUser(id);
    users = users.map((u) => (u.id === id ? { ...u, isAdmin: false } : u));
  }

  async function handleBan(id: string) {
    await banUser(id);
    users = users.map((u) => (u.id === id ? { ...u, isBanned: true } : u));
  }

  async function handleUnban(id: string) {
    await unbanUser(id);
    users = users.map((u) => (u.id === id ? { ...u, isBanned: false } : u));
  }

  async function handleDelete(id: string) {
    await deletePost(id);
    posts = posts.map((p) => (p.id === id ? { ...p, isDeleted: true } : p));
  }

  async function handleRestore(id: string) {
    await restorePost(id);
    posts = posts.map((p) => (p.id === id ? { ...p, isDeleted: false } : p));
  }

  onMount(() => {
    if (user && !user.isAdmin) {
      goto('/');
    } else {
      loadData();
    }
  });

  $effect(() => {
    if (!$session.isPending && user && !user.isAdmin) {
      goto('/');
    }
  });
</script>

<svelte:head>
  <title>Admin - the stack</title>
</svelte:head>

<div class="mt-8 w-full max-w-4xl mx-auto px-4">
  <h1 class="text-2xl font-bold text-the-black mb-6">Admin Panel</h1>

  <!-- Tabs -->
  <div class="flex gap-2 mb-6 border-b border-neutral-200">
    {#each ['stats', 'users', 'posts'] as tab}
      <button
        onclick={() => (activeTab = tab as 'stats' | 'users' | 'posts')}
        class="px-4 py-2 text-sm font-medium transition-colors
          {activeTab === tab
          ? 'text-the-black border-b-2 border-the-black'
          : 'text-neutral-500 hover:text-the-black'}"
      >
        {tab === 'stats' ? 'Estadisticas' : tab === 'users' ? 'Usuarios' : 'Posts'}
      </button>
    {/each}
  </div>

  {#if loading}
    <p class="text-neutral-500 text-center py-8">Cargando...</p>
  {:else if error}
    <div class="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error}
    </div>
  {:else}
    <!-- Stats Tab -->
    {#if activeTab === 'stats' && stats}
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-the-white border border-neutral-200 rounded-xl p-6 text-center">
          <p class="text-3xl font-bold text-the-black">{stats.users}</p>
          <p class="text-sm text-neutral-500">Usuarios</p>
        </div>
        <div class="bg-the-white border border-neutral-200 rounded-xl p-6 text-center">
          <p class="text-3xl font-bold text-the-black">{stats.posts}</p>
          <p class="text-sm text-neutral-500">Posts</p>
        </div>
        <div class="bg-the-white border border-neutral-200 rounded-xl p-6 text-center">
          <p class="text-3xl font-bold text-the-black">{stats.upvotes}</p>
          <p class="text-sm text-neutral-500">Upvotes</p>
        </div>
      </div>
    {/if}

    <!-- Users Tab -->
    {#if activeTab === 'users'}
      <div class="bg-the-white border border-neutral-200 rounded-xl overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-the-white border-b border-neutral-200">
            <tr>
              <th class="text-left px-4 py-3 font-medium text-neutral-700">Usuario</th>
              <th class="text-left px-4 py-3 font-medium text-neutral-700">Karma</th>
              <th class="text-left px-4 py-3 font-medium text-neutral-700">Estado</th>
              <th class="text-right px-4 py-3 font-medium text-neutral-700">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#each users as u (u.id)}
              <tr class="border-b border-neutral-100 last:border-0">
                <td class="px-4 py-3">
                  <span class="font-medium">{u.username}</span>
                  <span class="text-neutral-500 text-xs ml-2">{u.email}</span>
                </td>
                <td class="px-4 py-3">{u.karma}</td>
                <td class="px-4 py-3">
                  {#if u.isBanned}
                    <span class="text-the-red">Baneado</span>
                  {:else if u.isAdmin}
                    <span class="text-the-blue">Admin</span>
                  {:else}
                    <span class="text-neutral-500">Usuario</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-right space-x-2">
                  {#if u.id !== user?.id}
                    {#if u.isAdmin}
                      <button onclick={() => handleDemote(u.id)} class="text-xs text-the-orange hover:underline">
                        Quitar admin
                      </button>
                    {:else}
                      <button onclick={() => handlePromote(u.id)} class="text-xs text-the-blue hover:underline">
                        Hacer admin
                      </button>
                    {/if}
                    {#if u.isBanned}
                      <button onclick={() => handleUnban(u.id)} class="text-xs text-the-green hover:underline">
                        Desbanear
                      </button>
                    {:else}
                      <button onclick={() => handleBan(u.id)} class="text-xs text-the-red hover:underline">
                        Banear
                      </button>
                    {/if}
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- Posts Tab -->
    {#if activeTab === 'posts'}
      <div class="bg-the-white border border-neutral-200 rounded-xl overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-the-white border-b border-neutral-200">
            <tr>
              <th class="text-left px-4 py-3 font-medium text-neutral-700">Titulo</th>
              <th class="text-left px-4 py-3 font-medium text-neutral-700">Autor</th>
              <th class="text-left px-4 py-3 font-medium text-neutral-700">Estado</th>
              <th class="text-right px-4 py-3 font-medium text-neutral-700">Accion</th>
            </tr>
          </thead>
          <tbody>
            {#each posts as p (p.id)}
              <tr class="border-b border-neutral-100 last:border-0 {p.isDeleted ? 'opacity-50' : ''}">
                <td class="px-4 py-3">
                  <a href={p.url} target="_blank" class="hover:underline">{p.title}</a>
                </td>
                <td class="px-4 py-3">{p.author.username}</td>
                <td class="px-4 py-3">
                  {#if p.isDeleted}
                    <span class="text-the-red">Eliminado</span>
                  {:else}
                    <span class="text-the-green">Activo</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-right">
                  {#if p.isDeleted}
                    <button onclick={() => handleRestore(p.id)} class="text-xs text-the-green hover:underline">
                      Restaurar
                    </button>
                  {:else}
                    <button onclick={() => handleDelete(p.id)} class="text-xs text-the-red hover:underline">
                      Eliminar
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>
