import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'thestack-theme';

export type Theme = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

function getSystemTheme(): ResolvedTheme {
	if (!browser) return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function loadTheme(): Theme {
	if (!browser) return 'system';
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
	} catch {
		// localStorage can fail in private browsing
	}
	return 'system';
}

function applyTheme(resolved: ResolvedTheme): void {
	if (!browser) return;
	document.documentElement.classList.toggle('dark', resolved === 'dark');
	document.documentElement.style.colorScheme = resolved;
}

const initialTheme = loadTheme();
const initialResolved = initialTheme === 'system' ? getSystemTheme() : initialTheme;

export const theme = writable<Theme>(initialTheme);
export const resolvedTheme = writable<ResolvedTheme>(initialResolved);

export function setTheme(newTheme: Theme) {
	theme.set(newTheme);
	if (browser) {
		try {
			localStorage.setItem(STORAGE_KEY, newTheme);
		} catch {
			// Ignore quota errors
		}
	}
	const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;
	resolvedTheme.set(resolved);
	applyTheme(resolved);
}

// Listen for system theme changes
if (browser) {
	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	mediaQuery.addEventListener('change', (e) => {
		const currentTheme = get(theme);
		if (currentTheme === 'system') {
			const newResolved = e.matches ? 'dark' : 'light';
			resolvedTheme.set(newResolved);
			applyTheme(newResolved);
		}
	});
}
