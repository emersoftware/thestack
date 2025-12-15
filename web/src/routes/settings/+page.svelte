<script lang="ts">
  import { goto } from '$app/navigation';
  import { useSession, type CustomUser } from '$lib/auth';
  import { getUser, updateNewsletterPreference, type UserProfile } from '$lib/users';

  const session = useSession();
  const user = $derived($session.data?.user as CustomUser | undefined);

  let profile = $state<UserProfile | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let successMessage = $state('');

  // Load user profile on mount
  $effect(() => {
    if ($session.isPending) return;

    if (!user) {
      goto('/login');
      return;
    }

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
    }
  });

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
