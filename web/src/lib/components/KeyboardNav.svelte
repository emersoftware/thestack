<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let showHelp = $state(false);
  let selectedIndex = $state(-1);
  let vimMode = $state(browser ? localStorage.getItem('vimMode') === 'true' : false);

  function toggleVimMode() {
    vimMode = !vimMode;
    if (browser) {
      localStorage.setItem('vimMode', String(vimMode));
    }
  }

  function getItems(): HTMLElement[] {
    if (!browser) return [];
    return Array.from(document.querySelectorAll('[data-nav-item]'));
  }

  function select(index: number) {
    const items = getItems();
    if (index < 0 || index >= items.length) return;

    // Remove previous focus
    items.forEach(el => el.removeAttribute('data-nav-focus'));

    // Set new focus
    selectedIndex = index;
    items[index].setAttribute('data-nav-focus', 'true');
    items[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;

    // Always handle ? for help modal toggle
    if (e.key === '?') {
      e.preventDefault();
      showHelp = !showHelp;
      return;
    }

    if (e.key === 'Escape' && showHelp) {
      showHelp = false;
      return;
    }

    // If vim mode is off, only handle Ctrl+Enter in textareas
    if (!vimMode) {
      if ((target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const btn = target.closest('form')?.querySelector('[data-nav-submit]') as HTMLButtonElement
          || document.querySelector(`[data-nav-submit="${target.getAttribute('data-nav-submit-id')}"]`) as HTMLButtonElement;
        btn?.click();
      }
      return;
    }

    // In textarea: only handle Ctrl+Enter and Escape
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      if (e.key === 'Escape') {
        target.blur();
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const btn = target.closest('form')?.querySelector('[data-nav-submit]') as HTMLButtonElement
          || document.querySelector(`[data-nav-submit="${target.getAttribute('data-nav-submit-id')}"]`) as HTMLButtonElement;
        btn?.click();
      }
      return;
    }

    const items = getItems();

    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        select(Math.min(selectedIndex + 1, items.length - 1));
        break;
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        select(Math.max(selectedIndex - 1, 0));
        break;
      case 'g':
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        selectedIndex = 0;
        items.forEach(el => el.removeAttribute('data-nav-focus'));
        if (items[0]) items[0].setAttribute('data-nav-focus', 'true');
        break;
      case 'G':
        e.preventDefault();
        select(items.length - 1);
        break;
      case 'c':
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && items[selectedIndex]) {
          const link = items[selectedIndex].querySelector('[data-nav-comments]') as HTMLAnchorElement;
          if (link) goto(link.href);
        }
        break;
      case 'o':
        e.preventDefault();
        if (selectedIndex >= 0 && items[selectedIndex]) {
          const link = items[selectedIndex].querySelector('[data-nav-link]') as HTMLAnchorElement;
          if (link) window.open(link.href, '_blank');
        }
        break;
      case 'u':
        e.preventDefault();
        if (selectedIndex >= 0 && items[selectedIndex]) {
          const btn = items[selectedIndex].querySelector('[data-nav-upvote]') as HTMLButtonElement;
          btn?.click();
        }
        break;
      case 'r':
        e.preventDefault();
        // If a comment is selected, reply to it
        if (selectedIndex >= 0 && items[selectedIndex]) {
          const btn = items[selectedIndex].querySelector('[data-nav-reply]') as HTMLButtonElement;
          if (btn) {
            btn.click();
            setTimeout(() => {
              const textarea = items[selectedIndex].querySelector('textarea') as HTMLTextAreaElement;
              textarea?.focus();
            }, 50);
            break;
          }
        }
        // Otherwise focus the main comment textarea
        const mainTextarea = document.querySelector('[data-nav-textarea]') as HTMLTextAreaElement;
        if (mainTextarea) mainTextarea.focus();
        break;
      case 'p':
        e.preventDefault();
        history.back();
        break;
      case 'h':
        e.preventDefault();
        goto('/');
        break;
    }
  }

  // Reset on navigation
  $effect(() => {
    $page.url.pathname;
    selectedIndex = -1;
    if (browser) {
      document.querySelectorAll('[data-nav-focus]').forEach(el => el.removeAttribute('data-nav-focus'));
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if showHelp}
  <div
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    onclick={() => showHelp = false}
    role="dialog"
  >
    <div class="bg-the-white rounded-xl border border-neutral-200 shadow-xl max-w-sm w-full" onclick={e => e.stopPropagation()}>
      <div class="p-4 border-b border-neutral-200 flex justify-between items-center">
        <h2 class="text-lg font-semibold text-the-black">Atajos</h2>
        <button onclick={() => showHelp = false} class="text-neutral-400 hover:text-the-black">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="p-4 space-y-3 text-sm">
        <!-- Vim mode toggle -->
        <div class="flex items-center justify-between pb-3 border-b border-neutral-200">
          <span class="text-neutral-600">Modo vim</span>
          <button
            onclick={toggleVimMode}
            class="relative w-10 h-5 rounded-full transition-colors {vimMode ? 'bg-the-black' : 'bg-neutral-300'}"
          >
            <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform {vimMode ? 'translate-x-5' : ''}"></span>
          </button>
        </div>

        {#if vimMode}
          <div class="space-y-2">
            <div class="flex justify-between"><span class="text-neutral-600">Siguiente</span><kbd class="px-1.5 py-0.5 bg-neutral-100 rounded text-xs font-mono">j</kbd></div>
            <div class="flex justify-between"><span class="text-neutral-600">Anterior</span><kbd class="px-1.5 py-0.5 bg-neutral-100 rounded text-xs font-mono">k</kbd></div>
            <div class="flex justify-between"><span class="text-neutral-600">Inicio</span><kbd class="px-1.5 py-0.5 bg-neutral-100 rounded text-xs font-mono">g</kbd></div>
            <div class="flex justify-between"><span class="text-neutral-600">Final</span><kbd class="px-1.5 py-0.5 bg-neutral-100 rounded text-xs font-mono">G</kbd></div>
            <div class="flex justify-between"><span class="text-neutral-600">Abrir link</span><kbd class="px-1.5 py-0.5 bg-neutral-100 rounded text-xs font-mono">o</kbd></div>
            <div class="flex justify-between"><span class="text-neutral-600">Comentarios</span><kbd class="px-1.5 py-0.5 bg-neutral-100 rounded text-xs font-mono">c</kbd></div>
            <div class="flex justify-between"><span class="text-neutral-600">Upvote</span><kbd class="px-1.5 py-0.5 bg-neutral-100 rounded text-xs font-mono">u</kbd></div>
            <div class="flex justify-between"><span class="text-neutral-600">Responder</span><kbd class="px-1.5 py-0.5 bg-neutral-100 rounded text-xs font-mono">r</kbd></div>
            <div class="flex justify-between"><span class="text-neutral-600">Volver</span><kbd class="px-1.5 py-0.5 bg-neutral-100 rounded text-xs font-mono">p</kbd></div>
            <div class="flex justify-between"><span class="text-neutral-600">Home</span><kbd class="px-1.5 py-0.5 bg-neutral-100 rounded text-xs font-mono">h</kbd></div>
            <div class="flex justify-between"><span class="text-neutral-600">Enviar</span><span><kbd class="px-1.5 py-0.5 bg-neutral-100 rounded text-xs font-mono">Ctrl</kbd> <kbd class="px-1.5 py-0.5 bg-neutral-100 rounded text-xs font-mono">↵</kbd></span></div>
          </div>
        {:else}
          <div class="text-center py-4 text-neutral-400 text-xs">
            Activa el modo vim para usar atajos de teclado
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  :global([data-nav-focus="true"]) {
    outline: none !important;
    box-shadow: 0 0 0 2px var(--color-the-black) !important;
  }
</style>
