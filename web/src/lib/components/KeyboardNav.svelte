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

    // Handle ? for help modal toggle (except in text inputs)
    if (e.key === '?' && target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT' && !target.isContentEditable) {
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
    <div class="bg-card rounded-xl border border-border shadow-xl max-w-sm w-full" onclick={e => e.stopPropagation()}>
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h2 class="text-lg font-semibold text-foreground">Atajos</h2>
        <button onclick={() => showHelp = false} class="text-muted-foreground hover:text-foreground">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="p-4 space-y-3 text-sm">
        <!-- Vim mode toggle -->
        <div class="flex items-center justify-between pb-3 border-b border-border">
          <span class="text-muted-foreground">Modo vim</span>
          <button
            onclick={toggleVimMode}
            class="relative w-10 h-5 rounded-full transition-colors {vimMode ? 'bg-accent' : 'bg-muted'}"
          >
            <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-card rounded-full transition-transform {vimMode ? 'translate-x-5' : ''}"></span>
          </button>
        </div>

        {#if vimMode}
          <div class="space-y-2">
            <div class="flex justify-between"><span class="text-muted-foreground">Siguiente</span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">j</kbd></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Anterior</span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">k</kbd></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Inicio</span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">g</kbd></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Final</span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">G</kbd></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Abrir link</span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">o</kbd></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Comentarios</span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">c</kbd></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Upvote</span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">u</kbd></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Responder</span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">r</kbd></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Volver</span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">p</kbd></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Home</span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">h</kbd></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Enviar</span><span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Ctrl</kbd> <kbd class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">↵</kbd></span></div>
          </div>
        {:else}
          <div class="text-center py-4 text-muted-foreground text-xs">
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
    box-shadow: 0 0 0 2px var(--color-accent) !important;
  }
</style>
