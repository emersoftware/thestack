<script lang="ts">
	import { theme, resolvedTheme, setTheme, type Theme } from '$lib/stores/theme';

	let dropdownOpen = $state(false);

	const themes: { value: Theme; label: string; icon: 'system' | 'sun' | 'moon' }[] = [
		{ value: 'system', label: 'Sistema', icon: 'system' },
		{ value: 'light', label: 'Claro', icon: 'sun' },
		{ value: 'dark', label: 'Oscuro', icon: 'moon' }
	];

	const currentTheme = $derived($theme);
	const resolved = $derived($resolvedTheme);

	function selectTheme(t: Theme) {
		setTheme(t);
		dropdownOpen = false;
	}
</script>

<svelte:window
	onclick={(e) => {
		const target = e.target as HTMLElement;
		if (!target.closest('.theme-dropdown')) {
			dropdownOpen = false;
		}
	}}
/>

<div class="relative theme-dropdown">
	<button
		type="button"
		onclick={() => (dropdownOpen = !dropdownOpen)}
		class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
		aria-label="Cambiar tema"
	>
		{#if resolved === 'dark'}
			<!-- Moon icon -->
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
			</svg>
		{:else}
			<!-- Sun icon -->
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="5" />
				<line x1="12" y1="1" x2="12" y2="3" />
				<line x1="12" y1="21" x2="12" y2="23" />
				<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
				<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
				<line x1="1" y1="12" x2="3" y2="12" />
				<line x1="21" y1="12" x2="23" y2="12" />
				<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
				<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
			</svg>
		{/if}
	</button>

	{#if dropdownOpen}
		<div
			class="absolute right-0 mt-2 w-36 bg-card border border-border rounded-lg shadow-lg py-1 z-50"
		>
			{#each themes as t}
				<button
					type="button"
					onclick={() => selectTheme(t.value)}
					class="w-full text-left px-3 py-2 text-sm flex items-center gap-2
                 {currentTheme === t.value
						? 'text-foreground bg-muted'
						: 'text-muted-foreground hover:text-foreground hover:bg-muted'}"
				>
					{#if t.icon === 'system'}
						<svg
							class="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
							<line x1="8" y1="21" x2="16" y2="21" />
							<line x1="12" y1="17" x2="12" y2="21" />
						</svg>
					{:else if t.icon === 'sun'}
						<svg
							class="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle cx="12" cy="12" r="5" />
							<line x1="12" y1="1" x2="12" y2="3" />
							<line x1="12" y1="21" x2="12" y2="23" />
							<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
							<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
							<line x1="1" y1="12" x2="3" y2="12" />
							<line x1="21" y1="12" x2="23" y2="12" />
							<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
							<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
						</svg>
					{:else}
						<svg
							class="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
						</svg>
					{/if}
					{t.label}
				</button>
			{/each}
		</div>
	{/if}
</div>
