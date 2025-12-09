<script lang="ts">
  import { useSession, type CustomUser } from '$lib/auth';
  import { signOutUser } from '$lib/auth-utils';
  import { page } from '$app/stores';
  import Logo from './Logo.svelte';

  const session = useSession();

  const user = $derived($session.data?.user as CustomUser | undefined);
  const pathname = $derived($page.url.pathname);
</script>

<header class="w-full max-w-4xl mx-auto flex justify-between items-center px-4 py-3">
  <div class="flex items-center gap-6">
    <a href="/" class="flex items-center gap-2">
      <Logo />
      <h1 class="text-xl font-bold text-the-black">the stack</h1>
    </a>

    <!-- Navigation Tabs -->
    <nav class="flex items-center gap-1">
      <a
        href="/"
        class="px-3 py-1 text-sm rounded-md transition-colors {pathname === '/'
          ? 'bg-neutral-100 text-the-black font-medium'
          : 'text-neutral-500 hover:text-the-black'}"
      >
        hot
      </a>
      <a
        href="/new"
        class="px-3 py-1 text-sm rounded-md transition-colors {pathname === '/new'
          ? 'bg-neutral-100 text-the-black font-medium'
          : 'text-neutral-500 hover:text-the-black'}"
      >
        new
      </a>
    </nav>
  </div>

  <div class="flex items-center">
    {#if !$session.isPending && user}
      <div class="flex items-center space-x-3">
        {#if pathname !== '/submit'}
          <a
            href="/submit"
            class="text-neutral-700 px-3 py-1 rounded-full text-sm font-medium border border-neutral-300 hover:border-the-black hover:text-the-black transition-colors"
          >
            publicar
          </a>
        {/if}

        <a
          href="/user/{user.username || user.name}"
          class="text-sm text-neutral-700 hover:text-the-black hover:underline"
        >
          {user.username || user.name}
        </a>

        {#if user.isAdmin}
          <a
            href="/admin"
            class="text-sm text-neutral-500 hover:text-the-black"
          >
            admin
          </a>
        {/if}

        <button
          onclick={signOutUser}
          class="cursor-pointer text-sm text-neutral-500 hover:text-neutral-700"
        >
          logout
        </button>
      </div>
    {:else if !$session.isPending && !user && pathname !== '/login' && pathname !== '/register'}
      <a
        href="/login"
        class="text-neutral-700 px-3 py-1 rounded-full text-sm font-medium border border-neutral-300 hover:border-the-black hover:text-the-black transition-colors"
      >
        Entrar
      </a>
    {/if}
  </div>
</header>

{#if user && !user.emailVerified}
  <div class="w-full max-w-4xl mx-auto px-4">
    <div class="border border-the-red text-the-red px-4 py-2 rounded-lg text-sm flex items-center justify-between">
      <span>Verifica tu email para publicar y votar. Revisa tu bandeja de entrada.</span>
      <a href="/resend-verification" class="underline hover:no-underline font-medium">
        Reenviar email
      </a>
    </div>
  </div>
{/if}
