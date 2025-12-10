<script lang="ts">
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import KeyboardNav from '$lib/components/KeyboardNav.svelte';

  let { children } = $props();
</script>

<div class="min-h-screen p-2 sm:p-3 bg-the-white flex flex-col">
  <Header />
  {@render children()}
</div>

<Toast />
<KeyboardNav />
