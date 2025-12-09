import { writable } from 'svelte/store';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  return {
    subscribe,
    show(message: string, type: 'success' | 'error' | 'info' = 'info') {
      const id = crypto.randomUUID();
      update((toasts) => [...toasts, { id, message, type }]);
      setTimeout(() => this.remove(id), 4000);
    },
    remove(id: string) {
      update((toasts) => toasts.filter((t) => t.id !== id));
    },
    success(message: string) {
      this.show(message, 'success');
    },
    error(message: string) {
      this.show(message, 'error');
    },
    info(message: string) {
      this.show(message, 'info');
    },
  };
}

export const toast = createToastStore();
