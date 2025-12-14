<script lang="ts">
  import { goto } from '$app/navigation';
  import { authClient, useSession, type CustomUser } from '$lib/auth';

  const session = useSession();
  const user = $derived($session.data?.user as CustomUser | undefined);

  let loading = $state(false);
  let success = $state(false);
  let error = $state('');

  async function handleResend() {
    if (!user?.email) return;

    loading = true;
    error = '';

    try {
      await authClient.sendVerificationEmail({
        email: user.email,
        callbackURL: window.location.origin,
      });
      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al enviar email';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (!$session.isPending && !user) {
      goto('/login');
    }
    if (user?.emailVerified) {
      goto('/');
    }
  });
</script>

<svelte:head>
  <title>Verificar email - the stack</title>
</svelte:head>

<div class="flex-1 flex items-center justify-center bg-background py-4 sm:py-0">
  <div class="max-w-md w-full space-y-6 px-4 text-center">
    {#if success}
      <div class="space-y-4">
        <div class="w-16 h-16 mx-auto bg-success/20 rounded-full flex items-center justify-center">
          <svg class="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-2xl text-foreground">Email enviado</h2>
        <p class="text-muted-foreground">
          Revisa tu bandeja de entrada en <strong>{user?.email}</strong>
        </p>
        <a href="/" class="inline-block text-foreground underline hover:no-underline">
          Volver al inicio
        </a>
      </div>
    {:else}
      <div class="space-y-4">
        <h2 class="text-2xl text-foreground">
          Verificar email
        </h2>
        <p class="text-muted-foreground">
          Tu email <strong>{user?.email}</strong> no está verificado.
          Haz clic en el botón para recibir un nuevo enlace de verificación.
        </p>

        {#if error}
          <div class="rounded-lg border border-error bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        {/if}

        <button
          onclick={handleResend}
          disabled={loading}
          class="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg
            text-sm font-medium text-accent-foreground bg-accent hover:opacity-80
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {#if loading}
            Enviando...
          {:else}
            Reenviar email de verificación
          {/if}
        </button>

        <a href="/" class="inline-block text-muted-foreground hover:text-foreground text-sm">
          Volver al inicio
        </a>
      </div>
    {/if}
  </div>
</div>
