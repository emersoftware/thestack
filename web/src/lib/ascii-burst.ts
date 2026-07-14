/**
 * ascii-burst — thin bridge between UI interactions and the AsciiBackground canvas.
 *
 * The canvas component registers its burst trigger on mount; anything in the app
 * (e.g. the upvote button) can then fire a wave via `triggerAsciiBurst(x, y)`.
 * No-ops when no canvas is mounted or when the user prefers reduced motion.
 */

export type BurstIntensity = 'sm' | 'md' | 'lg' | 'auto';

type BurstFn = (x: number, y: number, intensity?: BurstIntensity) => void;

let trigger: BurstFn | null = null;

/** Called by AsciiBackground on mount to expose its wave trigger. */
export function registerBurst(fn: BurstFn): void {
	trigger = fn;
}

/** Called by AsciiBackground on destroy so stale triggers are never invoked. */
export function unregisterBurst(): void {
	trigger = null;
}

/**
 * Fire an ASCII wave centred at the given viewport pixel coordinates.
 * Silently no-ops if no canvas is registered or reduced motion is requested.
 */
export function triggerAsciiBurst(x: number, y: number, intensity?: BurstIntensity): void {
	if (!trigger) return;
	if (
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
	) {
		return;
	}
	trigger(x, y, intensity);
}

/**
 * Fire an ASCII wave from a UI event: uses the pointer position when available,
 * otherwise falls back to the center of the submit button (for form submits) or
 * the event's element (for keyboard/programmatic activation).
 */
export function triggerAsciiBurstFromEvent(e: Event, intensity?: BurstIntensity): void {
	let x = (e as MouseEvent).clientX;
	let y = (e as MouseEvent).clientY;
	if (!x || !y) {
		const el = ((e as SubmitEvent).submitter ??
			e.currentTarget ??
			e.target) as HTMLElement | null;
		if (el?.getBoundingClientRect) {
			const rect = el.getBoundingClientRect();
			x = rect.left + rect.width / 2;
			y = rect.top + rect.height / 2;
		}
	}
	if (x || y) triggerAsciiBurst(x, y, intensity);
}
