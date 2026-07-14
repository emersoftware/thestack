<script lang="ts">
	import { onMount } from 'svelte';
	import { resolvedTheme } from '$lib/stores/theme';
	import { registerBurst, unregisterBurst, type BurstIntensity } from '$lib/ascii-burst';

	let canvas: HTMLCanvasElement;

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);

		const FONT_PX = 20;
		const CELL_W = 17;
		const CELL_H = 22;

		// Braille Unicode (U+2800–U+28FF) — varying dot densities.
		// Bias toward sparse cells (lots of empty / 1–2 dot glyphs) for the dithered look.
		const CHARSET = (() => {
			const arr: string[] = [];
			// empties — bulk of the field
			for (let i = 0; i < 14; i++) arr.push('⠀');
			// low-dot patterns (1–2 dots): pick offsets that are visually pleasant
			const lowDots = [
				0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x03, 0x09, 0x12, 0x24, 0x48, 0x90, 0xc0,
				0x05, 0x0a, 0x14, 0x28, 0x50, 0xa0
			];
			for (const o of lowDots) arr.push(String.fromCharCode(0x2800 + o));
			// medium-dot patterns (3–4 dots) — sparser
			const midDots = [
				0x07, 0x0b, 0x0d, 0x0e, 0x16, 0x1c, 0x32, 0x34, 0x38, 0x49, 0x52, 0x64, 0x68, 0x70, 0x91,
				0xc4, 0xe0, 0x47, 0x83, 0x1a
			];
			for (const o of midDots) arr.push(String.fromCharCode(0x2800 + o));
			// a few denser ones — rare
			const heavy = [0x3f, 0x7e, 0xfc, 0xe7, 0xdb];
			for (const o of heavy) arr.push(String.fromCharCode(0x2800 + o));
			return arr;
		})();

		let cols = 0;
		let rows = 0;
		let chars: string[][] = []; // chars[r][c]
		let baseAlpha: number[][] = []; // baseAlpha[r][c] in [0..1] — per-cell base intensity (dithered look)
		let lastAlpha: number[][] = []; // tracks last-drawn alpha so we know which cells need repainting

		// Base character colour of the idle field — theme dependent. Updated on theme change.
		let baseRgb: [number, number, number] = [200, 200, 200];

		function pickChar(): string {
			const idx = Math.floor(Math.pow(Math.random(), 1.5) * CHARSET.length);
			return CHARSET[idx];
		}

		function build(): void {
			canvas.width = Math.floor(window.innerWidth * dpr);
			canvas.height = Math.floor(window.innerHeight * dpr);
			canvas.style.width = window.innerWidth + 'px';
			canvas.style.height = window.innerHeight + 'px';
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			cols = Math.ceil(window.innerWidth / CELL_W) + 1;
			rows = Math.ceil(window.innerHeight / CELL_H) + 1;
			chars = [];
			baseAlpha = [];
			lastAlpha = [];
			for (let r = 0; r < rows; r++) {
				const cr: string[] = [];
				const br: number[] = [];
				const la: number[] = [];
				for (let c = 0; c < cols; c++) {
					cr.push(pickChar());
					// gentle dithered noise so the field has subtle texture
					const n = (Math.sin(c * 0.31 + r * 0.27) * Math.cos(c * 0.13 - r * 0.19) + 1) / 2;
					br.push(0.025 + n * 0.045 + Math.random() * 0.015);
					la.push(-1);
				}
				chars.push(cr);
				baseAlpha.push(br);
				lastAlpha.push(la);
			}
			ctx.font = FONT_PX + 'px ui-monospace, Menlo, Monaco, monospace';
			ctx.textBaseline = 'top';
			ctx.textAlign = 'left';
			paintAll();
		}

		// bsmnt-inspired brand palette — wave samples colours from this gradient
		const PALETTE: [number, number, number][] = [
			[51, 15, 31], // php
			[200, 50, 40], // swift
			[251, 136, 65], // ruby
			[211, 221, 146], // unity
			[89, 130, 79], // terraform
			[0, 36, 20], // c
			[0, 20, 61], // go
			[40, 116, 215], // java
			[153, 194, 255] // python
		];

		function sampleGradient(t: number): [number, number, number] {
			if (t < 0) t = 0;
			else if (t > 1) t = 1;
			const f = t * (PALETTE.length - 1);
			const i = Math.floor(f);
			const u = f - i;
			const a = PALETTE[i];
			const b = PALETTE[Math.min(PALETTE.length - 1, i + 1)];
			return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
		}

		function paintCellBase(r: number, c: number): void {
			const x = c * CELL_W;
			const y = r * CELL_H;
			const a = baseAlpha[r][c];
			ctx.clearRect(x, y, CELL_W + 1, CELL_H + 1);
			ctx.fillStyle = `rgba(${baseRgb[0]},${baseRgb[1]},${baseRgb[2]},${a})`;
			ctx.fillText(chars[r][c], x, y + 1);
			lastAlpha[r][c] = a;
		}

		function paintCellLit(
			r: number,
			c: number,
			rgb: [number, number, number],
			alpha: number
		): void {
			const x = c * CELL_W;
			const y = r * CELL_H;
			ctx.clearRect(x, y, CELL_W + 1, CELL_H + 1);
			ctx.fillStyle = `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha})`;
			ctx.fillText(chars[r][c], x, y + 1);
			lastAlpha[r][c] = alpha;
		}

		function paintAll(): void {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			for (let r = 0; r < rows; r++) {
				for (let c = 0; c < cols; c++) {
					const a = baseAlpha[r][c];
					ctx.fillStyle = `rgba(${baseRgb[0]},${baseRgb[1]},${baseRgb[2]},${a})`;
					ctx.fillText(chars[r][c], c * CELL_W, r * CELL_H + 1);
					lastAlpha[r][c] = a;
				}
			}
		}

		// ---------- Wave engine ----------
		// Render an organic blobby wave on a hidden canvas, then sample it per ASCII
		// cell to mask colour/alpha onto the grid. The shape comes from many
		// radial-gradient blobs at jittered angles → uneven, natural.
		interface Blob {
			angle: number;
			rJitter: number;
			size: number;
			phase: number;
			wob: number;
		}
		interface Wave {
			cx: number;
			cy: number;
			start: number;
			speed: number;
			maxR: number;
			fadeDur: number;
			peak: number;
			ringScale: number;
			blobs: Blob[];
		}

		let waves: Wave[] = [];
		let raf: number | null = null;
		let prevDirty: { r: number; c: number }[] = [];

		// hidden source canvas where we paint the wave shape
		const waveCanvas = document.createElement('canvas');
		const wctx = waveCanvas.getContext('2d', { willReadFrequently: true })!;
		let waveData: ImageData | null = null;

		function sizeWaveCanvas(): void {
			waveCanvas.width = window.innerWidth;
			waveCanvas.height = window.innerHeight;
		}
		sizeWaveCanvas();

		// Tuned wave config (from the design's TWEAKS_DEFAULTS). Applies to every burst.
		const waveCfg = {
			speed: 1060,
			fadeDur: 1200,
			ringScale: 190,
			peak: 0.45,
			blobCount: 140,
			blobSize: 200,
			jitter: 0.32,
			wobble: 22,
			ease: 'cubic',
			blend: 'lighter',
			monochrome: false,
			threshold: 0.13,
			hueDrift: 0.25,
			intensity: 'auto' as BurstIntensity
		};

		function makeBlobs(): Blob[] {
			const N = Math.max(6, Math.floor(waveCfg.blobCount));
			const j = waveCfg.jitter;
			const sz = waveCfg.blobSize;
			const arr: Blob[] = [];
			for (let i = 0; i < N; i++) {
				arr.push({
					angle: (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
					rJitter: 1 - j * 0.6 + Math.random() * j,
					size: sz * 0.55 + Math.random() * sz * 0.9,
					phase: Math.random(),
					wob: Math.random() * Math.PI * 2
				});
			}
			return arr;
		}

		function easeFront(t: number): number {
			switch (waveCfg.ease) {
				case 'linear':
					return t;
				case 'quart':
					return 1 - Math.pow(1 - t, 4);
				case 'quint':
					return 1 - Math.pow(1 - t, 5);
				case 'sine':
					return Math.sin((t * Math.PI) / 2);
				case 'cubic':
				default:
					return 1 - Math.pow(1 - t, 3);
			}
		}

		function paintWaveCanvas(now: number): void {
			const W = waveCanvas.width;
			const H = waveCanvas.height;
			wctx.clearRect(0, 0, W, H);
			wctx.globalCompositeOperation = 'lighter';
			for (const w of waves) {
				const elapsed = now - w.start;
				const expandDur = (w.maxR / w.speed) * 1000;
				const totalDur = expandDur + w.fadeDur;
				if (elapsed >= totalDur) continue;

				const expandT = Math.min(1, elapsed / expandDur);
				const eased = easeFront(expandT);
				const front = w.maxR * eased;

				// fade progress 0→1 once the wave finished expanding
				const fadeT = elapsed > expandDur ? Math.min(1, (elapsed - expandDur) / w.fadeDur) : 0;
				if (fadeT >= 1) continue;

				wctx.globalCompositeOperation =
					waveCfg.blend === 'screen'
						? 'screen'
						: waveCfg.blend === 'over'
							? 'source-over'
							: 'lighter';

				for (const b of w.blobs) {
					// staggered switch-off: each blob cuts off at its own moment,
					// shrinking as it goes so no lone stragglers linger at the end
					let gAlpha = 1;
					if (fadeT > 0) {
						const cut = 0.05 + b.phase * 0.45; // off-moments early (0.05–0.5)
						const k = (fadeT - cut) / 0.5; // long, gentle cut window
						gAlpha = k <= 0 ? 1 : k >= 1 ? 0 : 1 - k * k * (3 - 2 * k);
						gAlpha *= Math.pow(1 - fadeT, 1.5) * (1 + fadeT * 0.5); // soft global tail-off
					}
					if (gAlpha <= 0.01) continue;
					const blobR = front * b.rJitter + Math.sin(elapsed * 0.004 + b.wob) * waveCfg.wobble;
					const px = w.cx + Math.cos(b.angle) * blobR;
					const py = w.cy + Math.sin(b.angle) * blobR;
					// blob size grows with the front — wave starts as a single point
					const sizeT = Math.min(1, eased + 0.04);
					const size = b.size * sizeT * (0.6 + 0.4 * gAlpha);
					if (size < 1) continue;
					if (px < -size || px > W + size || py < -size || py > H + size) continue;
					const phase = waveCfg.monochrome ? 0.55 : (b.phase + waveCfg.hueDrift) % 1;
					const rgb = sampleGradient(phase);
					const grad = wctx.createRadialGradient(px, py, 0, px, py, size);
					grad.addColorStop(0, `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${0.85 * gAlpha * w.peak})`);
					grad.addColorStop(
						0.55,
						`rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${0.35 * gAlpha * w.peak})`
					);
					grad.addColorStop(1, 'rgba(0,0,0,0)');
					wctx.fillStyle = grad;
					wctx.fillRect(px - size, py - size, size * 2, size * 2);
				}
			}
			wctx.globalCompositeOperation = 'source-over';
			waveData = wctx.getImageData(0, 0, W, H);
		}

		function step(): void {
			const now = performance.now();
			// restore previously-dirty cells to base
			for (const cell of prevDirty) paintCellBase(cell.r, cell.c);
			const newDirty: { r: number; c: number }[] = [];

			// 1) prune dead waves
			let alive = false;
			for (let wi = waves.length - 1; wi >= 0; wi--) {
				const w = waves[wi];
				const elapsed = now - w.start;
				const expandDur = (w.maxR / w.speed) * 1000;
				if (elapsed >= expandDur + w.fadeDur) {
					waves.splice(wi, 1);
					continue;
				}
				alive = true;
			}

			if (alive) {
				// 2) paint wave canvas + read pixels
				paintWaveCanvas(now);
				const W = waveCanvas.width;
				const data = waveData!.data;

				// bbox over all live waves
				let minPX = W;
				let maxPX = 0;
				let minPY = waveCanvas.height;
				let maxPY = 0;
				for (const w of waves) {
					const elapsed = now - w.start;
					const expandDur = (w.maxR / w.speed) * 1000;
					const expandT = Math.min(1, elapsed / expandDur);
					const eased = 1 - Math.pow(1 - expandT, 3);
					const reach = w.maxR * eased + 160; // include blob radius padding
					minPX = Math.min(minPX, w.cx - reach);
					maxPX = Math.max(maxPX, w.cx + reach);
					minPY = Math.min(minPY, w.cy - reach);
					maxPY = Math.max(maxPY, w.cy + reach);
				}
				const minC = Math.max(0, Math.floor(minPX / CELL_W));
				const maxC = Math.min(cols - 1, Math.ceil(maxPX / CELL_W));
				const minR = Math.max(0, Math.floor(minPY / CELL_H));
				const maxRr = Math.min(rows - 1, Math.ceil(maxPY / CELL_H));

				for (let r = minR; r <= maxRr; r++) {
					for (let c = minC; c <= maxC; c++) {
						const px = (c * CELL_W + CELL_W / 2) | 0;
						const py = (r * CELL_H + CELL_H / 2) | 0;
						if (px < 0 || py < 0 || px >= W || py >= waveCanvas.height) continue;
						const idx = (py * W + px) * 4;
						const a = data[idx + 3] / 255;
						if (a < waveCfg.threshold) continue;
						const rgb: [number, number, number] = [data[idx], data[idx + 1], data[idx + 2]];
						const lit = a;
						const finalA = Math.min(1, baseAlpha[r][c] + lit);
						paintCellLit(r, c, rgb, finalA);
						newDirty.push({ r, c });
					}
				}
			}

			prevDirty = newDirty;
			if (alive) {
				raf = requestAnimationFrame(step);
			} else {
				raf = null;
				if (prevDirty.length) {
					for (const cell of prevDirty) paintCellBase(cell.r, cell.c);
					prevDirty = [];
				}
			}
		}

		function triggerASCIIBurst(x: number, y: number, intensity?: BurstIntensity): void {
			if (!cols) return;
			const cx = x ?? window.innerWidth / 2;
			const cy = y ?? window.innerHeight / 2;
			// exact pixel origin — do NOT snap to cell
			const corners = [
				[0, 0],
				[window.innerWidth, 0],
				[0, window.innerHeight],
				[window.innerWidth, window.innerHeight]
			];
			let maxR = 0;
			for (const [px, py] of corners) {
				const d = Math.hypot(px - cx, py - cy);
				if (d > maxR) maxR = d;
			}
			const preset = intensity || waveCfg.intensity;
			let s = waveCfg.speed;
			let f = waveCfg.fadeDur;
			const p = waveCfg.peak;
			let rs = waveCfg.ringScale;
			if (preset === 'sm') {
				s = Math.max(s, 1200);
				f = Math.min(f, 900);
				rs = Math.min(rs, 160);
			} else if (preset === 'lg') {
				s = Math.max(s, 1800);
				f = Math.max(f, 1400);
				rs = Math.max(rs, 240);
			}
			waves.push({
				cx,
				cy,
				start: performance.now(),
				speed: s,
				maxR,
				fadeDur: f,
				peak: p,
				ringScale: rs,
				blobs: makeBlobs()
			});
			if (!raf) raf = requestAnimationFrame(step);
		}

		// Repaint idle grid whenever the resolved theme changes. Fires synchronously
		// on subscribe with the current value (before build(), so guarded by cols).
		const unsubTheme = resolvedTheme.subscribe((t) => {
			baseRgb = t === 'dark' ? [200, 200, 200] : [70, 80, 74];
			if (cols) paintAll();
		});

		build();
		registerBurst(triggerASCIIBurst);

		let resizeT: ReturnType<typeof setTimeout>;
		const onResize = () => {
			sizeWaveCanvas();
			clearTimeout(resizeT);
			resizeT = setTimeout(() => {
				build();
			}, 120);
		};
		window.addEventListener('resize', onResize);

		return () => {
			unregisterBurst();
			if (raf) cancelAnimationFrame(raf);
			window.removeEventListener('resize', onResize);
			clearTimeout(resizeT);
			unsubTheme();
		};
	});
</script>

<canvas
	bind:this={canvas}
	aria-hidden="true"
	class="pointer-events-none fixed inset-0 z-0 select-none"
></canvas>
