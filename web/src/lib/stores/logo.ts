import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const MAX_STEPS = 16;
const STORAGE_KEY = 'thestack-logo-state';

interface LogoState {
  step: number;
  direction: 1 | -1;
}

function loadState(): LogoState {
  if (!browser) return { step: 0, direction: 1 };

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        step: Math.min(Math.max(0, parsed.step || 0), MAX_STEPS - 1),
        direction: parsed.direction === -1 ? -1 : 1,
      };
    }
  } catch {
    // localStorage can fail in private browsing, disabled cookies, or SSR
  }
  return { step: 0, direction: 1 };
}

function saveState(state: LogoState) {
  if (!browser) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage can fail: quota exceeded, private browsing, disabled cookies
  }
}

function createLogoStore() {
  const initialState = loadState();
  const version = writable(0);
  const step = writable(initialState.step);
  let direction: 1 | -1 = initialState.direction;

  function bump() {
    version.update((v) => v + 1);
  }

  function nextStep() {
    step.update((currentStep) => {
      let next = currentStep + direction;

      if (next >= MAX_STEPS) {
        direction = -1;
        next = MAX_STEPS - 2;
      } else if (next < 0) {
        direction = 1;
        next = 1;
      }

      saveState({ step: next, direction });

      return next;
    });
  }

  return {
    step: { subscribe: step.subscribe },
    version: { subscribe: version.subscribe },
    bump,
    nextStep,
  };
}

export const logoStore = createLogoStore();
