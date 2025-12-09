<script lang="ts">
  let { loading = false, onclick }: { loading?: boolean; onclick: () => void } = $props();
</script>

<div class="flex justify-center py-6">
  <button
    onclick={onclick}
    disabled={loading}
    class="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-the-black
           border border-neutral-300 rounded-lg hover:border-the-black
           transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {loading ? 'Cargando...' : 'Cargar más'}
  </button>
</div>
