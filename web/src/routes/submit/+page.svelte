<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { goto, preloadData } from '$app/navigation';
  import { createPost } from '$lib/posts';
  import { ApiError } from '$lib/api';
  import PostPreviewCard from '$lib/components/PostPreviewCard.svelte';
  import { toast } from '$lib/toast';
  import { logoStore } from '$lib/stores/logo';
  import { draftStore } from '$lib/stores/drafts';
  import { pendingPost } from '$lib/stores/pendingPost';
  import { ANIM } from '$lib/anim';
  import { triggerAsciiBurstFromEvent } from '$lib/ascii-burst';

  // User is guaranteed by server-side load (redirects if not logged in)
  let { data } = $props();
  const user = data.user!;

  let title = $state('');
  let url = $state('');
  let loading = $state(false);

  // Post-publish exit sequence: the form leaves, only the preview remains, then
  // the preview flies down and off-screen, and we navigate to /new.
  let published = $state(false); // form/heading have left, preview is alone
  let previewLeaving = $state(false); // preview is flying down and out
  let navPromise: Promise<unknown> | null = null; // /new data, preloaded during the animation

  const FORM_OUT_MS = ANIM.formOut; // heading + form fade out
  const PREVIEW_HOLD_MS = ANIM.previewHold; // beat where only the preview is on screen
  const PREVIEW_OUT_MS = ANIM.previewOut; // preview flies down and out

  const prefersReducedMotion = () =>
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Fires when the preview finishes flying out — jump to /new (data already warm).
  async function finishAndNavigate() {
    if (navPromise) await navPromise;
    await goto('/new');
  }

  onMount(() => {
    const draft = draftStore.load();
    if (draft) {
      title = draft.title;
      url = draft.url;
    }
  });

  $effect(() => {
    if (title || url) {
      draftStore.save({ title, url, updatedAt: Date.now() });
    }
  });

  function isValidUrl(urlString: string): boolean {
    try {
      const parsed = new URL(urlString);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('El título es requerido');
      return;
    }
    if (title.length > 300) {
      toast.error('El título es muy largo (máximo 300 caracteres)');
      return;
    }
    if (!url.trim()) {
      toast.error('La URL es requerida');
      return;
    }
    if (!isValidUrl(url)) {
      toast.error('URL inválida. Debe comenzar con http:// o https://');
      return;
    }

    triggerAsciiBurstFromEvent(e, 'md');

    loading = true;

    try {
      const newPost = await createPost(title.trim(), url.trim());
      draftStore.clear();
      logoStore.bump();
      // Hand the new post to /new so it can animate it into the list.
      pendingPost.set(newPost);

      if (prefersReducedMotion()) {
        await goto('/new');
        return;
      }

      // Warm /new's data while the exit animation plays so the swap is instant.
      navPromise = preloadData('/new');

      published = true; // heading + form fade out, leaving only the preview
      await tick();
      // Hold on the lone preview, then let it fly down and out (see markup).
      // Navigation is triggered by the preview's onoutroend handler.
      setTimeout(() => {
        previewLeaving = true;
      }, PREVIEW_HOLD_MS);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          toast.error('Debes verificar tu email para publicar');
        } else if (err.status === 409) {
          toast.error('Esta URL ya fue publicada anteriormente');
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error('Error al publicar. Intenta de nuevo.');
      }
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Publicar - the stack</title>
</svelte:head>

<div class="flex-1 flex items-center justify-center py-4 sm:py-0">
  <div class="max-w-md w-full space-y-6 sm:space-y-8 px-4">
    {#if !published}
      <div out:fade={{ duration: FORM_OUT_MS }}>
        <h2 class="text-center text-2xl sm:text-3xl text-foreground">
          Publicar en <span class="font-extrabold text-foreground">the stack</span>
        </h2>
      </div>
    {/if}

    <div class="space-y-4">
      {#if !published}
      <form onsubmit={handleSubmit} class="space-y-3" out:fade={{ duration: FORM_OUT_MS }}>
        <div>
          <label for="title" class="block text-sm font-medium text-foreground mb-1">
            Título
          </label>
          <input
            type="text"
            id="title"
            bind:value={title}
            required
            maxlength={300}
            disabled={loading}
            class="w-full px-3 py-2 border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
            placeholder="Ingresa el título del artículo"
          />
        </div>

        <div>
          <label for="url" class="block text-sm font-medium text-foreground mb-1">
            URL
          </label>
          <input
            type="url"
            id="url"
            bind:value={url}
            required
            disabled={loading}
            class="w-full px-3 py-2 border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
            placeholder="https://ejemplo.com/articulo"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          class="hover:cursor-pointer w-full hover:opacity-80 text-accent-foreground py-2 px-4 rounded-lg bg-accent transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {#if loading}
            <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            Publicando...
          {:else}
            Publicar
          {/if}
        </button>

        <div class="text-center">
          <a href="/" class="text-sm text-muted-foreground hover:text-foreground">
            volver
          </a>
        </div>
      </form>
      {/if}

      <div class="space-y-2">
        {#if !published}
        <div class="flex items-center gap-2" out:fade={{ duration: FORM_OUT_MS }}>
          <p class="text-sm text-muted-foreground">Vista previa</p>
          <svg
            class="w-4 h-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        </div>
        {/if}
        {#if !previewLeaving}
        <div out:fly={{ y: ANIM.previewFlyY, duration: PREVIEW_OUT_MS, easing: cubicOut }} onoutroend={finishAndNavigate}>
          <PostPreviewCard
            {title}
            {url}
            username={user.username || user.name || ''}
          />
        </div>
        {/if}
      </div>
    </div>
  </div>
</div>
