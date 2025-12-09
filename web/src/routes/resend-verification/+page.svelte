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

<div class="flex-1 flex items-center justify-center bg-the-white">
  <div class="max-w-md w-full space-y-6 px-4 text-center">
    {#if success}
      <div class="space-y-4">
        <div class="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
          <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-2xl text-neutral-900">Email enviado</h2>
        <p class="text-neutral-600">
          Revisa tu bandeja de entrada en <strong>{user?.email}</strong>
        </p>
        <a href="/" class="inline-block text-the-black underline hover:no-underline">
          Volver al inicio
        </a>
      </div>
    {:else}
      <div class="space-y-4">
        <h2 class="text-2xl text-neutral-900">
          Verificar email
        </h2>
        <p class="text-neutral-600">
          Tu email <strong>{user?.email}</strong> no está verificado.
          Haz clic en el botón para recibir un nuevo enlace de verificación.
        </p>

        {#if error}
          <div class="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        {/if}

        <button
          onclick={handleResend}
          disabled={loading}
          class="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg
            text-sm font-medium text-the-white bg-the-black hover:bg-neutral-800
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-the-black
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {#if loading}
            Enviando...
          {:else}
            Reenviar email de verificación
          {/if}
        </button>

        <a href="/" class="inline-block text-neutral-500 hover:text-neutral-700 text-sm">
          Volver al inicio
        </a>
      </div>
    {/if}
  </div>
</div>
