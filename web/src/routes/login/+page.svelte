<script lang="ts">
  import { signInWithEmail, signInWithGitHub } from '$lib/auth-utils';
  import { goto } from '$app/navigation';
  import { logoStore } from '$lib/stores/logo';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      await signInWithEmail(email, password);
      logoStore.bump();
      goto('/');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al iniciar sesión';
    } finally {
      loading = false;
    }
  }

  async function handleGitHubLogin() {
    error = '';
    loading = true;
    try {
      await signInWithGitHub();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error con GitHub';
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Login - the stack</title>
</svelte:head>

<div class="flex-1 flex items-center justify-center bg-background py-4 sm:py-0">
  <div class="max-w-md w-full space-y-6 sm:space-y-8 px-4">
    <div>
      <h2 class="text-center text-2xl sm:text-3xl text-foreground">
        Ingresa a <span class="font-extrabold text-foreground">the stack</span>
      </h2>
    </div>

    <div class="space-y-4">
      <button
        onclick={handleGitHubLogin}
        disabled={loading}
        class="hover:cursor-pointer w-full flex items-center justify-center gap-2 px-4 py-2 border border-input rounded-lg bg-card text-foreground hover:border-border-hover hover:text-foreground transition-colors disabled:opacity-50"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
          />
        </svg>
        Continuar con GitHub
      </button>

      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-input"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-2 bg-background text-muted-foreground">o</span>
        </div>
      </div>

      {#if error}
        <div class="rounded-lg border border-error bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      {/if}

      <form onsubmit={handleSubmit} class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-foreground mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            bind:value={email}
            required
            class="w-full px-3 py-2 border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="tu@email.com"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-foreground mb-1">
            Contraseña
          </label>
          <input
            type="password"
            id="password"
            bind:value={password}
            required
            minlength={8}
            class="w-full px-3 py-2 border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="********"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          class="hover:cursor-pointer w-full hover:opacity-80 text-accent-foreground py-2 px-4 rounded-lg bg-accent transition-colors disabled:opacity-40"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div class="text-center">
        <a href="/register" class="text-sm text-muted-foreground hover:text-foreground">
          ¿no tienes cuenta? únete aquí
        </a>
      </div>
    </div>
  </div>
</div>
