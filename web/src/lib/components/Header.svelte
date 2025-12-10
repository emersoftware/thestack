<script lang="ts">
  import { useSession, type CustomUser } from '$lib/auth';
  import { signOutUser } from '$lib/auth-utils';
  import { page } from '$app/stores';
  import Logo from './Logo.svelte';

  const session = useSession();

  const user = $derived($session.data?.user as CustomUser | undefined);
  const pathname = $derived($page.url.pathname);

  let dropdownOpen = $state(false);

  function toggleDropdown() {
    dropdownOpen = !dropdownOpen;
  }

  function closeDropdown() {
    dropdownOpen = false;
  }

  function handleLogout() {
    closeDropdown();
    signOutUser();
  }
</script>

<svelte:window onclick={(e) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.user-dropdown')) {
    dropdownOpen = false;
  }
}} />

<header class="w-full max-w-4xl mx-auto flex justify-between items-center px-4 py-3">
  <div class="flex items-center gap-3 sm:gap-6">
    <a href="/" class="flex items-center gap-1.5 sm:gap-2">
      <Logo />
      <h1 class="text-lg sm:text-xl font-bold text-the-black">the stack</h1>
    </a>

    <!-- Navigation Tabs -->
    <nav class="flex items-center gap-1">
      <a
        href="/new"
        class="px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors {pathname === '/new'
          ? 'bg-neutral-100 text-the-black font-medium'
          : 'text-neutral-500 hover:text-the-black'}"
      >
        new
      </a>
    </nav>

    <!-- Keyboard hint -->
    <button
      type="button"
      onclick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))}
      class="hidden sm:flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors ml-2"
      title="Atajos de teclado"
    >
      <kbd class="px-1.5 py-0.5 bg-neutral-100 rounded text-[10px] font-mono">?</kbd>
    </button>
  </div>

  <div class="flex items-center">
    {#if !$session.isPending && user}
      <!-- Desktop: links horizontales -->
      <div class="hidden md:flex items-center space-x-3">
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

        <button
          onclick={signOutUser}
          class="cursor-pointer text-sm text-neutral-500 hover:text-neutral-700"
        >
          logout
        </button>
      </div>

      <!-- Mobile: dropdown -->
      <div class="md:hidden relative user-dropdown">
        <button
          onclick={toggleDropdown}
          class="flex items-center gap-1 text-sm text-neutral-700 hover:text-the-black"
        >
          {user.username || user.name}
          <svg class="w-4 h-4 transition-transform {dropdownOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {#if dropdownOpen}
          <div class="absolute right-0 mt-2 w-40 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-50">
            <a
              href="/submit"
              onclick={closeDropdown}
              class="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Publicar
            </a>
            <a
              href="/user/{user.username || user.name}"
              onclick={closeDropdown}
              class="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Perfil
            </a>
            <button
              onclick={handleLogout}
              class="w-full text-left px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-50"
            >
              Logout
            </button>
          </div>
        {/if}
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
    <div class="border border-the-red text-the-red px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
      <span>Verifica tu email para publicar y votar.</span>
      <a href="/resend-verification" class="underline hover:no-underline font-medium whitespace-nowrap">
        Reenviar email
      </a>
    </div>
  </div>
{/if}
