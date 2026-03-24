<script lang="ts">
  import { goto } from '$app/navigation';
  import { useSession, type CustomUser } from '$lib/auth';
  import { getUser, updateUser, type UserProfile } from '$lib/users';
  import { getMyFeeds, createFeed, deleteFeed, type Feed, type FeedType } from '$lib/feeds';

  const session = useSession();
  const user = $derived($session.data?.user as CustomUser | undefined);

  let profile = $state<UserProfile | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let successMessage = $state('');

  // Feeds state
  let feeds = $state<Feed[]>([]);
  let feedsLoading = $state(false);
  let newFeedName = $state('');
  let newFeedAutoPublish = $state(false);
  let newFeedType = $state<FeedType>('email');
  let newFeedSourceUrl = $state('');
  let creatingFeed = $state(false);
  let copiedFeedId = $state<string | null>(null);

  let dataLoaded = false;

  // Redirect if not logged in, load data once session resolves
  $effect(() => {
    if ($session.isPending) return;
    if (!user) {
      goto('/login');
      return;
    }
    if (dataLoaded) return;
    dataLoaded = true;

    const username = user.username || user.name;
    if (username) {
      getUser(username)
        .then((data) => {
          profile = data;
          loading = false;
        })
        .catch(() => {
          error = 'Error al cargar preferencias';
          loading = false;
        });
      loadFeeds();
    }
  });

  async function loadFeeds() {
    feedsLoading = true;
    try {
      const data = await getMyFeeds();
      feeds = data.feeds;
    } catch (err) {
      console.error('Error loading feeds:', err);
    } finally {
      feedsLoading = false;
    }
  }

  async function handleCreateFeed() {
    if (!newFeedName.trim() || creatingFeed) return;
    if (newFeedType !== 'email' && !newFeedSourceUrl.trim()) {
      error = 'URL es requerida para feeds RSS y Blog';
      return;
    }
    creatingFeed = true;
    try {
      await createFeed(
        newFeedName.trim(),
        newFeedAutoPublish,
        newFeedType,
        newFeedType !== 'email' ? newFeedSourceUrl.trim() : undefined
      );
      newFeedName = '';
      newFeedAutoPublish = false;
      newFeedType = 'email';
      newFeedSourceUrl = '';
      await loadFeeds();
    } catch (err: any) {
      error = err?.message || 'Error al crear feed';
    } finally {
      creatingFeed = false;
    }
  }

  async function handleDeleteFeed(id: string) {
    try {
      await deleteFeed(id);
      feeds = feeds.filter((f) => f.id !== id);
    } catch (err) {
      error = 'Error al eliminar feed';
    }
  }

  function copyFeedIdentifier(feed: Feed) {
    const text = feed.type === 'email' ? feed.email! : feed.sourceUrl!;
    navigator.clipboard.writeText(text);
    copiedFeedId = feed.id;
    setTimeout(() => (copiedFeedId = null), 2000);
  }

  async function toggleSetting(
    field: 'newsletterEnabled' | 'showAuthor',
    messages: { on: string; off: string },
    defaultValue = false,
  ) {
    if (!profile || !user) return;
    const username = user.username || user.name;
    if (!username) return;

    saving = true;
    error = '';
    successMessage = '';

    try {
      const newValue = !(profile[field] ?? defaultValue);
      await updateUser(username, { [field]: newValue });
      profile[field] = newValue;
      successMessage = newValue ? messages.on : messages.off;
      setTimeout(() => { successMessage = ''; }, 3000);
    } catch (err) {
      error = 'Error al actualizar preferencia';
    } finally {
      saving = false;
    }
  }

  const toggleNewsletter = () => toggleSetting(
    'newsletterEnabled',
    { on: 'Newsletter activado', off: 'Newsletter desactivado' },
  );

  const toggleShowAuthor = () => toggleSetting(
    'showAuthor',
    { on: 'Tu nombre se muestra en los posts', off: 'Tu nombre esta oculto en los posts' },
    true,
  );
</script>

<svelte:head>
  <title>Configuración - the stack</title>
</svelte:head>

<div class="mt-4 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-4">
  <h1 class="text-xl sm:text-2xl font-bold text-foreground mb-6">Configuración</h1>

  {#if loading}
    <div class="text-muted-foreground text-center py-8">Cargando...</div>
  {:else if error && !profile}
    <div class="rounded-lg border border-error bg-error/10 px-4 py-3 text-sm text-error">
      {error}
    </div>
  {:else if profile}
    <div class="space-y-6">
      {#if successMessage}
        <div class="rounded-lg bg-accent/10 border border-accent px-3 py-2 text-sm text-accent">
          {successMessage}
        </div>
      {/if}

      {#if error && profile}
        <div class="rounded-lg border border-error bg-error/10 px-3 py-2 text-sm text-error">
          {error}
        </div>
      {/if}

      <!-- Newsletter Section -->
      <div class="bg-card border border-border rounded-xl p-4 sm:p-6">
        <h2 class="text-base sm:text-lg font-medium text-foreground mb-4">
          Newsletter semanal
        </h2>

        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <p class="text-sm text-muted-foreground">
              Recibe cada lunes un resumen con los 5 posts más votados de la semana.
            </p>
          </div>

          <button
            onclick={toggleNewsletter}
            disabled={saving}
            class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed {profile.newsletterEnabled ? 'bg-accent' : 'bg-muted'}"
            role="switch"
            aria-checked={profile.newsletterEnabled}
            aria-label="Activar newsletter semanal"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {profile.newsletterEnabled ? 'translate-x-5' : 'translate-x-0'}"
            ></span>
          </button>
        </div>
      </div>

      <!-- Show Author Section -->
      <div class="bg-card border border-border rounded-xl p-4 sm:p-6">
        <h2 class="text-base sm:text-lg font-medium text-foreground mb-4">
          Privacidad
        </h2>

        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <p class="text-sm text-muted-foreground">
              Mostrar tu nombre en los posts del feed. Si desactivas esto, tus posts solo mostraran el titulo y el sitio.
            </p>
          </div>

          <button
            onclick={toggleShowAuthor}
            disabled={saving}
            class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed {(profile.showAuthor ?? true) ? 'bg-accent' : 'bg-muted'}"
            role="switch"
            aria-checked={profile.showAuthor ?? true}
            aria-label="Mostrar nombre en posts"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {(profile.showAuthor ?? true) ? 'translate-x-5' : 'translate-x-0'}"
            ></span>
          </button>
        </div>
      </div>

      <!-- Feeds Section -->
      <div class="bg-card border border-border rounded-xl p-4 sm:p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base sm:text-lg font-medium text-foreground">Mis Feeds</h2>
        </div>

        <p class="text-sm text-muted-foreground mb-4">
          Agrega fuentes de contenido: newsletters por email, feeds RSS, o blogs HTML que un agente AI procesara.
        </p>

        <!-- Create feed form -->
        <div class="flex flex-col gap-2 mb-4">
          <div class="flex flex-col sm:flex-row gap-2">
            <select
              bind:value={newFeedType}
              class="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              <option value="email">Email</option>
              <option value="rss">RSS</option>
              <option value="blog">Blog HTML</option>
            </select>
            <input
              type="text"
              bind:value={newFeedName}
              placeholder="Nombre del feed..."
              class="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
          {#if newFeedType !== 'email'}
            <input
              type="url"
              bind:value={newFeedSourceUrl}
              placeholder={newFeedType === 'rss' ? 'URL del feed RSS...' : 'URL del blog...'}
              class="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          {/if}
          <div class="flex items-center gap-2">
            <label class="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" bind:checked={newFeedAutoPublish} class="rounded" />
              Auto-publicar
            </label>
            <button
              onclick={handleCreateFeed}
              disabled={creatingFeed || !newFeedName.trim()}
              class="ml-auto px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 shrink-0"
            >
              {creatingFeed ? 'Creando...' : 'Crear feed'}
            </button>
          </div>
        </div>

        <!-- Feeds list -->
        {#if feedsLoading}
          <p class="text-xs text-muted-foreground">Cargando feeds...</p>
        {:else if feeds.length === 0}
          <p class="text-xs text-muted-foreground">No tienes feeds creados.</p>
        {:else}
          <div class="space-y-2">
            {#each feeds as feed (feed.id)}
              <div class="border border-border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="text-sm font-medium text-foreground">{feed.name}</p>
                    <span class="text-[10px] uppercase font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{feed.type}</span>
                  </div>
                  <div class="flex items-center gap-2 mt-1">
                    <code class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate">
                      {feed.type === 'email' ? feed.email : feed.sourceUrl}
                    </code>
                    <button
                      onclick={() => copyFeedIdentifier(feed)}
                      class="text-xs text-accent hover:underline shrink-0"
                    >
                      {copiedFeedId === feed.id ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <div class="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {#if feed.autoPublish}
                      <span>Auto-publicar</span>
                    {/if}
                    {#if feed.lastProcessedAt}
                      <span>Ultimo: {new Date(feed.lastProcessedAt).toLocaleDateString('es-CL')}</span>
                    {/if}
                  </div>
                </div>
                <button
                  onclick={() => handleDeleteFeed(feed.id)}
                  class="text-xs text-error hover:underline shrink-0"
                >
                  Eliminar
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Profile Link -->
      <div class="bg-card border border-border rounded-xl p-4 sm:p-6">
        <h2 class="text-base sm:text-lg font-medium text-foreground mb-4">
          Perfil
        </h2>
        <p class="text-sm text-muted-foreground mb-4">
          Edita tu bio y ve tu actividad en tu página de perfil.
        </p>
        <a
          href="/user/{profile.username}"
          class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-input hover:border-border-hover text-foreground transition-colors"
        >
          Ver perfil
        </a>
      </div>
    </div>
  {/if}
</div>
