<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
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
    sendNewsletter,
    type AdminStats,
    type AdminUser,
    type AdminPost,
  } from '$lib/admin';

  // User is guaranteed to be admin by server-side load (redirects if not)
  let { data } = $props();
  const user = data.user!;

  let activeTab = $state<'stats' | 'users' | 'posts' | 'newsletter'>('stats');
  let stats = $state<AdminStats | null>(null);
  let users = $state<AdminUser[]>([]);
  let posts = $state<AdminPost[]>([]);
  let loading = $state(true);
  let error = $state('');

  // Newsletter state
  let showNewsletterModal = $state(false);
  let newsletterSending = $state(false);
  let newsletterResult = $state<{ sent: number; errors: number } | null>(null);

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

  async function handleSendNewsletter() {
    newsletterSending = true;
    newsletterResult = null;
    try {
      const result = await sendNewsletter();
      newsletterResult = { sent: result.sent, errors: result.errors };
    } catch (err) {
      newsletterResult = { sent: 0, errors: -1 };
    } finally {
      newsletterSending = false;
    }
  }

  onMount(() => {
    loadData();
  });
</script>

<svelte:head>
  <title>Admin - the stack</title>
</svelte:head>

<div class="mt-4 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-4">
  <h1 class="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">Admin Panel</h1>

  <!-- Tabs -->
  <div class="flex gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-border overflow-x-auto">
    {#each ['stats', 'users', 'posts', 'newsletter'] as tab}
      <button
        onclick={() => (activeTab = tab as 'stats' | 'users' | 'posts' | 'newsletter')}
        class="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap
          {activeTab === tab
          ? 'text-foreground border-b-2 border-accent'
          : 'text-muted-foreground hover:text-foreground'}"
      >
        {tab === 'stats' ? 'Estadisticas' : tab === 'users' ? 'Usuarios' : tab === 'posts' ? 'Posts' : 'Newsletter'}
      </button>
    {/each}
  </div>

  {#if loading}
    <p class="text-muted-foreground text-center py-8">Cargando...</p>
  {:else if error}
    <div class="rounded-lg border border-error bg-error/10 px-4 py-3 text-sm text-error">
      {error}
    </div>
  {:else}
    <!-- Stats Tab -->
    {#if activeTab === 'stats' && stats}
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div class="bg-card border border-border rounded-xl p-4 sm:p-6 text-center">
          <p class="text-2xl sm:text-3xl font-bold text-foreground">{stats.users}</p>
          <p class="text-xs sm:text-sm text-muted-foreground">Usuarios</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-4 sm:p-6 text-center">
          <p class="text-2xl sm:text-3xl font-bold text-foreground">{stats.posts}</p>
          <p class="text-xs sm:text-sm text-muted-foreground">Posts</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-4 sm:p-6 text-center">
          <p class="text-2xl sm:text-3xl font-bold text-foreground">{stats.upvotes}</p>
          <p class="text-xs sm:text-sm text-muted-foreground">Upvotes</p>
        </div>
      </div>
    {/if}

    <!-- Users Tab -->
    {#if activeTab === 'users'}
      <div class="bg-card border border-border rounded-xl overflow-x-auto">
        <table class="w-full text-xs sm:text-sm min-w-[500px]">
          <thead class="bg-card border-b border-border">
            <tr>
              <th class="text-left px-4 py-3 font-medium text-foreground">Usuario</th>
              <th class="text-left px-4 py-3 font-medium text-foreground">Karma</th>
              <th class="text-left px-4 py-3 font-medium text-foreground">Estado</th>
              <th class="text-right px-4 py-3 font-medium text-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#each users as u (u.id)}
              <tr class="border-b border-border last:border-0">
                <td class="px-4 py-3">
                  <span class="font-medium text-foreground">{u.username}</span>
                  <span class="text-muted-foreground text-xs ml-2">{u.email}</span>
                </td>
                <td class="px-4 py-3 text-foreground">{u.karma}</td>
                <td class="px-4 py-3">
                  {#if u.isBanned}
                    <span class="text-error">Baneado</span>
                  {:else if u.isAdmin}
                    <span class="text-info">Admin</span>
                  {:else}
                    <span class="text-muted-foreground">Usuario</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-right space-x-2">
                  {#if u.id !== user?.id}
                    {#if u.isAdmin}
                      <button onclick={() => handleDemote(u.id)} class="text-xs text-warning hover:underline">
                        Quitar admin
                      </button>
                    {:else}
                      <button onclick={() => handlePromote(u.id)} class="text-xs text-info hover:underline">
                        Hacer admin
                      </button>
                    {/if}
                    {#if u.isBanned}
                      <button onclick={() => handleUnban(u.id)} class="text-xs text-success hover:underline">
                        Desbanear
                      </button>
                    {:else}
                      <button onclick={() => handleBan(u.id)} class="text-xs text-error hover:underline">
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
      <div class="bg-card border border-border rounded-xl overflow-x-auto">
        <table class="w-full text-xs sm:text-sm min-w-[500px]">
          <thead class="bg-card border-b border-border">
            <tr>
              <th class="text-left px-4 py-3 font-medium text-foreground">Titulo</th>
              <th class="text-left px-4 py-3 font-medium text-foreground">Autor</th>
              <th class="text-left px-4 py-3 font-medium text-foreground">Estado</th>
              <th class="text-right px-4 py-3 font-medium text-foreground">Accion</th>
            </tr>
          </thead>
          <tbody>
            {#each posts as p (p.id)}
              <tr class="border-b border-border last:border-0 {p.isDeleted ? 'opacity-50' : ''}">
                <td class="px-4 py-3">
                  <a href={p.url} target="_blank" class="text-foreground hover:underline">{p.title}</a>
                </td>
                <td class="px-4 py-3 text-foreground">{p.author.username}</td>
                <td class="px-4 py-3">
                  {#if p.isDeleted}
                    <span class="text-error">Eliminado</span>
                  {:else}
                    <span class="text-success">Activo</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-right">
                  {#if p.isDeleted}
                    <button onclick={() => handleRestore(p.id)} class="text-xs text-success hover:underline">
                      Restaurar
                    </button>
                  {:else}
                    <button onclick={() => handleDelete(p.id)} class="text-xs text-error hover:underline">
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

    <!-- Newsletter Tab -->
    {#if activeTab === 'newsletter'}
      <div class="bg-card border border-border rounded-xl p-6">
        <h2 class="text-lg font-semibold text-foreground mb-4">Newsletter Semanal</h2>
        <p class="text-sm text-muted-foreground mb-6">
          Envia manualmente el newsletter con los 5 posts mas votados de la semana a todos los usuarios suscritos.
        </p>
        <button
          onclick={() => (showNewsletterModal = true)}
          class="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Enviar newsletter ahora
        </button>
      </div>
    {/if}
  {/if}
</div>

<!-- Newsletter Confirmation Modal -->
{#if showNewsletterModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-card border border-border rounded-xl p-6 max-w-md w-full">
      {#if newsletterResult}
        <!-- Result state -->
        <div class="text-center">
          {#if newsletterResult.errors === -1}
            <div class="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
              <span class="text-error text-xl">!</span>
            </div>
            <h3 class="text-lg font-semibold text-foreground mb-2">Error</h3>
            <p class="text-sm text-muted-foreground mb-6">Ocurrio un error al enviar el newsletter.</p>
          {:else if newsletterResult.errors > 0}
            <div class="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
              <span class="text-warning text-xl">!</span>
            </div>
            <h3 class="text-lg font-semibold text-foreground mb-2">Envio parcial</h3>
            <p class="text-sm text-muted-foreground mb-6">
              Se enviaron {newsletterResult.sent} correos con {newsletterResult.errors} errores.
            </p>
          {:else}
            <div class="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <span class="text-success text-xl">✓</span>
            </div>
            <h3 class="text-lg font-semibold text-foreground mb-2">Enviado</h3>
            <p class="text-sm text-muted-foreground mb-6">
              Se enviaron {newsletterResult.sent} correos exitosamente.
            </p>
          {/if}
          <button
            onclick={() => { showNewsletterModal = false; newsletterResult = null; }}
            class="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Cerrar
          </button>
        </div>
      {:else if newsletterSending}
        <!-- Sending state -->
        <div class="text-center">
          <div class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span class="text-muted-foreground">...</span>
          </div>
          <h3 class="text-lg font-semibold text-foreground mb-2">Enviando...</h3>
          <p class="text-sm text-muted-foreground">Esto puede tomar unos segundos.</p>
        </div>
      {:else}
        <!-- Confirmation state -->
        <h3 class="text-lg font-semibold text-foreground mb-2">Confirmar envio</h3>
        <p class="text-sm text-muted-foreground mb-6">
          Estas seguro de que quieres enviar el newsletter ahora? Se enviara a todos los usuarios suscritos con email verificado.
        </p>
        <div class="flex gap-3 justify-end">
          <button
            onclick={() => (showNewsletterModal = false)}
            class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onclick={handleSendNewsletter}
            class="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Enviar
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
