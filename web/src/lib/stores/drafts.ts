import { browser } from '$app/environment';

const STORAGE_KEY = 'thestack-submit-draft';

export interface PostDraft {
  title: string;
  url: string;
  updatedAt: number;
}

function loadDraft(): PostDraft | null {
  if (!browser) return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function saveDraft(draft: PostDraft): void {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore quota errors
  }
}

function clearDraft(): void {
  if (!browser) return;
  localStorage.removeItem(STORAGE_KEY);
}

export const draftStore = {
  load: loadDraft,
  save: saveDraft,
  clear: clearDraft,
};
