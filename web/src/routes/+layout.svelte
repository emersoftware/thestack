<script lang="ts">
  import { onMount } from 'svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import KeyboardNav from '$lib/components/KeyboardNav.svelte';

  let { children, data } = $props();

  /**
   * TEMPORARY: Clear legacy cookies from api.thestack.cl on first visit
   * This fixes auth issues caused by duplicate cookies across domains
   * Can be removed after 2025-12-18
   */
  onMount(() => {
    const COOKIE_CLEANUP_KEY = 'legacy_cookies_cleared_v1';

    if (typeof localStorage !== 'undefined' && !localStorage.getItem(COOKIE_CLEANUP_KEY)) {
      fetch(`${PUBLIC_API_URL}/api/auth/clear-legacy-cookies`, {
        method: 'POST',
        credentials: 'include',
      }).then(() => {
        localStorage.setItem(COOKIE_CLEANUP_KEY, Date.now().toString());
      }).catch(() => {
        // Ignore errors - retry on next visit
      });
    }
  });
</script>

<div class="min-h-screen p-2 sm:p-3 bg-background flex flex-col">
  <Header user={data.user} />
  <div class="flex-1">
    {@render children()}
  </div>
</div>

<Toast />
<KeyboardNav />
