<script lang="ts">
  import { onMount } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { browser } from '$app/environment';
  import { logoStore } from '$lib/stores/logo';

  let { size = 'md' }: { size?: 'md' | 'lg' } = $props();

  const sizeClass = size === 'md' ? 'w-8 h-8' : 'w-16 h-16';

  // Pre-calculated offsets based on rectangle Y positions
  // -(rectY - firstRectY) where firstRectY = 2
  const OFFSETS = [
    0,     // y=2   → -(2-2)
    -12,   // y=14  → -(14-2)
    -34,   // y=36  → -(36-2)
    -66,   // y=68  → -(68-2)
    -98,   // y=100 → -(100-2)
    -113,  // y=115 → -(115-2)
    -122,  // y=124 → -(124-2)
    -131,  // y=133 → -(133-2)
    -140,  // y=142 → -(142-2)
    -155,  // y=157 → -(157-2)
    -163,  // y=165 → -(165-2)
    -171,  // y=173 → -(173-2)
    -182,  // y=184 → -(184-2)
    -190,  // y=192 → -(192-2)
    -222,  // y=224 → -(224-2)
    -254,  // y=256 → -(256-2)
  ];

  // Get initial step from store (will be from localStorage on client)
  let initialStep = 0;
  if (browser) {
    // Read directly from store
    logoStore.step.subscribe((s) => (initialStep = s))();
  }

  // Initialize tweened with correct starting position
  const y = tweened(OFFSETS[initialStep] ?? 0, {
    duration: 250,
    easing: cubicOut,
  });

  let wasHidden = false;

  // Subscribe to step changes
  const step = logoStore.step;

  // React to step changes
  $effect(() => {
    const currentStep = $step;
    if (currentStep >= 0 && currentStep < OFFSETS.length) {
      y.set(OFFSETS[currentStep]);
    }
  });

  // React to version changes (bump)
  const version = logoStore.version;
  let lastVersion = 0;

  $effect(() => {
    const currentVersion = $version;
    if (currentVersion > lastVersion) {
      logoStore.nextStep();
      lastVersion = currentVersion;
    }
  });

  onMount(() => {
    // Tab visibility change handler
    function handleVisibilityChange() {
      if (document.hidden) {
        wasHidden = true;
      } else if (wasHidden) {
        logoStore.nextStep();
        wasHidden = false;
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });

  function handleMouseEnter() {
    logoStore.nextStep();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svg
  class={sizeClass}
  viewBox="0 0 40 40"
  onmouseenter={handleMouseEnter}
>
  <defs>
    <clipPath id="logo-mask">
      <rect x="0" y="0" width="40" height="40" rx="6" />
    </clipPath>
  </defs>

  <rect
    x="0"
    y="0"
    width="40"
    height="40"
    rx="6"
    stroke="white"
    stroke-width="1"
    class="fill-the-black"
  />

  <g clip-path="url(#logo-mask)">
    <g style="transform: translateY({$y}px)">
      <rect x="2" y="2" width="15" height="10" rx="4" class="fill-the-white" />
      <rect x="2" y="14" width="20" height="20" rx="4" class="fill-the-white" />
      <rect x="2" y="36" width="30" height="30" rx="4" class="fill-the-white" />
      <rect x="2" y="68" width="20" height="30" rx="4" class="fill-the-white" />
      <rect x="7" y="100" width="15" height="13" rx="4" class="fill-the-white" />
      <rect x="7" y="115" width="15" height="7" rx="3.5" class="fill-the-white" />
      <rect x="7" y="124" width="15" height="7" rx="3.5" class="fill-the-white" />
      <rect x="7" y="133" width="15" height="7" rx="3.5" class="fill-the-white" />
      <rect x="2" y="142" width="20" height="13" rx="4" class="fill-the-white" />
      <rect x="2" y="157" width="20" height="6" rx="3" class="fill-the-white" />
      <rect x="2" y="165" width="20" height="6" rx="3" class="fill-the-white" />
      <rect x="2" y="173" width="20" height="9" rx="4" class="fill-the-white" />
      <rect x="2" y="184" width="20" height="6" rx="3" class="fill-the-white" />
      <rect x="2" y="192" width="20" height="30" rx="4" class="fill-the-white" />
      <rect x="2" y="224" width="20" height="30" rx="4" class="fill-the-white" />
      <rect x="7" y="256" width="31" height="31" rx="4" class="fill-the-white" />
    </g>
  </g>
</svg>
