<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { requireAuth } from '$lib/guards/requireAuth';
  import { createPost } from '$lib/posts';
  import { ApiError } from '$lib/api';
  import { useSession, type CustomUser } from '$lib/auth';
  import PostPreviewCard from '$lib/components/PostPreviewCard.svelte';
  import { toast } from '$lib/toast';
  import { logoStore } from '$lib/stores/logo';
  import { draftStore } from '$lib/stores/drafts';

  const session = useSession();
  const user = $derived($session.data?.user as CustomUser | undefined);

  let authorized = $state(false);
  let checking = $state(true);

  let title = $state('');
  let url = $state('');
  let loading = $state(false);

  onMount(async () => {
    authorized = await requireAuth();
    checking = false;

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

    loading = true;

    try {
      await createPost(title.trim(), url.trim());
      draftStore.clear();
      logoStore.bump();
      toast.success('Post publicado exitosamente');
      goto('/');
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

{#if checking}
  <div class="flex-1 flex items-center justify-center">
    <p class="text-neutral-500">Verificando autenticación...</p>
  </div>
{:else if authorized}
  <div class="flex-1 flex items-center justify-center">
    <div class="max-w-md w-full space-y-8 px-4">
      <div>
        <h2 class="text-center text-3xl text-neutral-900">
          Publicar en <span class="font-extrabold text-the-black">the stack</span>
        </h2>
      </div>

      <div class="space-y-4">
        <form onsubmit={handleSubmit} class="space-y-3">
          <div>
            <label for="title" class="block text-sm font-medium text-neutral-700 mb-1">
              Título
            </label>
            <input
              type="text"
              id="title"
              bind:value={title}
              required
              maxlength={300}
              disabled={loading}
              class="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-the-black disabled:bg-neutral-100"
              placeholder="Ingresa el título del artículo"
            />
          </div>

          <div>
            <label for="url" class="block text-sm font-medium text-neutral-700 mb-1">
              URL
            </label>
            <input
              type="url"
              id="url"
              bind:value={url}
              required
              disabled={loading}
              class="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-the-black disabled:bg-neutral-100"
              placeholder="https://ejemplo.com/articulo"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            class="hover:cursor-pointer w-full hover:bg-the-white hover:text-the-black hover:ring-the-black hover:ring-1 text-white py-2 px-4 rounded-lg bg-the-black transition-colors disabled:bg-neutral-400 flex items-center justify-center gap-2"
          >
            {#if loading}
              <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Publicando...
            {:else}
              Publicar
            {/if}
          </button>

          <div class="text-center">
            <a href="/" class="text-sm text-neutral-500 hover:text-neutral-700">
              volver
            </a>
          </div>
        </form>

        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <p class="text-sm text-neutral-500">Vista previa</p>
            <svg
              class="w-4 h-4 text-neutral-500"
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
          <PostPreviewCard
            {title}
            {url}
            username={user?.username || user?.name || ''}
          />
        </div>
      </div>
    </div>
  </div>
{/if}
