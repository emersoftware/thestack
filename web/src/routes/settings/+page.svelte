<script lang="ts">
  import { goto } from '$app/navigation';
  import { useSession, type CustomUser } from '$lib/auth';
  import { getUser, updateNewsletterPreference, type UserProfile } from '$lib/users';
  import { getMyFeeds, createFeed, deleteFeed, type Feed } from '$lib/feeds';

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
    creatingFeed = true;
    try {
      await createFeed(newFeedName.trim(), newFeedAutoPublish);
      newFeedName = '';
      newFeedAutoPublish = false;
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

  function copyEmail(feed: Feed) {
    navigator.clipboard.writeText(feed.email);
    copiedFeedId = feed.id;
    setTimeout(() => (copiedFeedId = null), 2000);
  }

  async function toggleNewsletter() {
    if (!profile || !user) return;

    const username = user.username || user.name;
    if (!username) return;

    saving = true;
    error = '';
    successMessage = '';

    try {
      const newValue = !profile.newsletterEnabled;
      await updateNewsletterPreference(username, newValue);
      profile.newsletterEnabled = newValue;
      successMessage = newValue
        ? 'Newsletter activado'
        : 'Newsletter desactivado';

      // Clear success message after 3 seconds
      setTimeout(() => {
        successMessage = '';
      }, 3000);
    } catch (err) {
      error = 'Error al actualizar preferencia';
    } finally {
      saving = false;
    }
  }
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

        {#if successMessage}
          <div class="mt-4 rounded-lg bg-accent/10 border border-accent px-3 py-2 text-sm text-accent">
            {successMessage}
          </div>
        {/if}

        {#if error && profile}
          <div class="mt-4 rounded-lg border border-error bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </div>
        {/if}
      </div>

      <!-- Feeds Section -->
      <div class="bg-card border border-border rounded-xl p-4 sm:p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base sm:text-lg font-medium text-foreground">Mis Feeds</h2>
          <a href="/settings/feeds" class="text-xs text-accent hover:underline">Posts pendientes</a>
        </div>

        <p class="text-sm text-muted-foreground mb-4">
          Crea direcciones email para suscribirte a newsletters externos. Un agente AI procesara los emails y publicara contenido relevante.
        </p>

        <!-- Create feed form -->
        <div class="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="text"
            bind:value={newFeedName}
            placeholder="Nombre del feed..."
            class="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <label class="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <input type="checkbox" bind:checked={newFeedAutoPublish} class="rounded" />
            Auto-publicar
          </label>
          <button
            onclick={handleCreateFeed}
            disabled={creatingFeed || !newFeedName.trim()}
            class="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 shrink-0"
          >
            {creatingFeed ? 'Creando...' : 'Crear feed'}
          </button>
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
                  <p class="text-sm font-medium text-foreground">{feed.name}</p>
                  <div class="flex items-center gap-2 mt-1">
                    <code class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate">{feed.email}</code>
                    <button
                      onclick={() => copyEmail(feed)}
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
