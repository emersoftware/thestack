import { writable } from 'svelte/store';
import type { Post } from '$lib/posts';

/**
 * Carries a freshly-published post from /submit to /new across a client-side
 * navigation, so the New list can animate it in from the top instead of it
 * just being present on load.
 *
 * Set right before `goto('/new')`; read once (via `get`) and cleared by the
 * /new page on init, so revisiting /new later does not replay the animation.
 */
export const pendingPost = writable<Post | null>(null);
