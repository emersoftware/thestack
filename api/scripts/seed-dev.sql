-- development seed for the stack
--
-- run with:
--   npx wrangler d1 execute the-stack-db --local --file=./migrations/seed-dev.sql
--
-- after running the seed, recalculate scores:
--   1. start server: npm run dev -- --test-scheduled
--   2. trigger cron: curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"

-- =============================================
-- 1. users (~10 users)
-- =============================================

INSERT INTO users (id, name, email, email_verified, username, karma, about, is_admin, is_banned, created_at, updated_at) VALUES
('user_001', 'María González', 'maria@example.com', 1, 'mariag', 45, 'Desarrolladora frontend en Santiago', 1, 0, strftime('%s', 'now', '-30 days'), strftime('%s', 'now')),
('user_002', 'Carlos Pérez', 'carlos@example.com', 1, 'carlosp', 32, 'Backend engineer. Go y Rust enthusiast.', 0, 0, strftime('%s', 'now', '-28 days'), strftime('%s', 'now')),
('user_003', 'Ana Rodríguez', 'ana@example.com', 1, 'anar', 28, NULL, 0, 0, strftime('%s', 'now', '-25 days'), strftime('%s', 'now')),
('user_004', 'Diego Silva', 'diego@example.com', 1, 'diegos', 15, 'Estudiante de ingeniería informática', 0, 0, strftime('%s', 'now', '-20 days'), strftime('%s', 'now')),
('user_005', 'Valentina López', 'valentina@example.com', 1, 'valel', 52, 'CTO @ startup chilena. Ex-Google.', 0, 0, strftime('%s', 'now', '-18 days'), strftime('%s', 'now')),
('user_006', 'Sebastián Torres', 'seba@example.com', 1, 'sebat', 8, NULL, 0, 0, strftime('%s', 'now', '-15 days'), strftime('%s', 'now')),
('user_007', 'Camila Fernández', 'camila@example.com', 1, 'camilaf', 19, 'DevOps engineer. Kubernetes fan.', 0, 0, strftime('%s', 'now', '-12 days'), strftime('%s', 'now')),
('user_008', 'Matías Vargas', 'matias@example.com', 1, 'matiasv', 5, NULL, 0, 0, strftime('%s', 'now', '-10 days'), strftime('%s', 'now')),
('user_009', 'Javiera Muñoz', 'javiera@example.com', 1, 'javieram', 22, 'Mobile dev. Flutter y React Native.', 0, 0, strftime('%s', 'now', '-8 days'), strftime('%s', 'now')),
('user_010', 'Felipe Contreras', 'felipe@example.com', 1, 'felipec', 3, NULL, 0, 0, strftime('%s', 'now', '-5 days'), strftime('%s', 'now'));

-- =============================================
-- 2. posts (~50 posts with different dates)
-- score = 0 (calculated by cron)
-- =============================================

INSERT INTO posts (id, title, url, domain, author_id, upvotes_count, score, is_deleted, created_at, updated_at) VALUES
-- posts from 7 days ago
('post_001', 'Cloudflare Workers ahora soporta Python', 'https://blog.cloudflare.com/python-workers', 'blog.cloudflare.com', 'user_001', 12, 0, 0, strftime('%s', 'now', '-7 days'), strftime('%s', 'now', '-7 days')),
('post_002', 'Nuevo release de Rust 1.80', 'https://blog.rust-lang.org/2024/rust-1-80', 'blog.rust-lang.org', 'user_002', 8, 0, 0, strftime('%s', 'now', '-7 days', '+2 hours'), strftime('%s', 'now', '-7 days')),
('post_003', 'La guía definitiva de TypeScript 5.5', 'https://devblogs.microsoft.com/typescript-5-5', 'devblogs.microsoft.com', 'user_005', 15, 0, 0, strftime('%s', 'now', '-7 days', '+5 hours'), strftime('%s', 'now', '-7 days')),

-- posts from 6 days ago
('post_004', 'Introducción a Bun 2.0', 'https://bun.sh/blog/bun-2-0', 'bun.sh', 'user_003', 6, 0, 0, strftime('%s', 'now', '-6 days'), strftime('%s', 'now', '-6 days')),
('post_005', 'Por qué dejamos Kubernetes por Nomad', 'https://medium.com/@techstartup/leaving-kubernetes', 'medium.com', 'user_007', 22, 0, 0, strftime('%s', 'now', '-6 days', '+3 hours'), strftime('%s', 'now', '-6 days')),
('post_006', 'El estado de WebAssembly en 2024', 'https://webassembly.org/roadmap-2024', 'webassembly.org', 'user_002', 9, 0, 0, strftime('%s', 'now', '-6 days', '+6 hours'), strftime('%s', 'now', '-6 days')),
('post_007', 'Cómo escalamos a 1M de usuarios con SQLite', 'https://dev.to/startup/sqlite-at-scale', 'dev.to', 'user_005', 18, 0, 0, strftime('%s', 'now', '-6 days', '+9 hours'), strftime('%s', 'now', '-6 days')),

-- posts from 5 days ago
('post_008', 'GitHub Copilot X: primeras impresiones', 'https://github.blog/copilot-x-review', 'github.blog', 'user_001', 14, 0, 0, strftime('%s', 'now', '-5 days'), strftime('%s', 'now', '-5 days')),
('post_009', 'Svelte 5 está en beta pública', 'https://svelte.dev/blog/svelte-5-beta', 'svelte.dev', 'user_009', 11, 0, 0, strftime('%s', 'now', '-5 days', '+4 hours'), strftime('%s', 'now', '-5 days')),
('post_010', 'El problema con los microservicios', 'https://newsletter.pragmaticengineer.com/microservices-problem', 'newsletter.pragmaticengineer.com', 'user_002', 25, 0, 0, strftime('%s', 'now', '-5 days', '+8 hours'), strftime('%s', 'now', '-5 days')),
('post_011', 'Deno 2.0 release notes', 'https://deno.com/blog/v2', 'deno.com', 'user_004', 7, 0, 0, strftime('%s', 'now', '-5 days', '+12 hours'), strftime('%s', 'now', '-5 days')),

-- posts from 4 days ago
('post_012', 'PostgreSQL vs MySQL en 2024', 'https://planetscale.com/blog/postgres-vs-mysql', 'planetscale.com', 'user_003', 16, 0, 0, strftime('%s', 'now', '-4 days'), strftime('%s', 'now', '-4 days')),
('post_013', 'Cómo construimos nuestro propio CDN', 'https://fly.io/blog/building-cdn', 'fly.io', 'user_007', 10, 0, 0, strftime('%s', 'now', '-4 days', '+3 hours'), strftime('%s', 'now', '-4 days')),
('post_014', 'El futuro de React Server Components', 'https://react.dev/blog/server-components-future', 'react.dev', 'user_001', 19, 0, 0, strftime('%s', 'now', '-4 days', '+6 hours'), strftime('%s', 'now', '-4 days')),
('post_015', 'Tailwind CSS 4.0: lo que viene', 'https://tailwindcss.com/blog/v4-preview', 'tailwindcss.com', 'user_009', 13, 0, 0, strftime('%s', 'now', '-4 days', '+9 hours'), strftime('%s', 'now', '-4 days')),
('post_016', 'Astro 4.0 released', 'https://astro.build/blog/astro-4', 'astro.build', 'user_006', 8, 0, 0, strftime('%s', 'now', '-4 days', '+12 hours'), strftime('%s', 'now', '-4 days')),

-- posts from 3 days ago
('post_017', 'Por qué Go sigue siendo relevante', 'https://go.dev/blog/go-relevance-2024', 'go.dev', 'user_002', 11, 0, 0, strftime('%s', 'now', '-3 days'), strftime('%s', 'now', '-3 days')),
('post_018', 'La verdad sobre los salarios tech en Chile', 'https://blog.getonbrd.com/salarios-tech-chile-2024', 'blog.getonbrd.com', 'user_005', 35, 0, 0, strftime('%s', 'now', '-3 days', '+2 hours'), strftime('%s', 'now', '-3 days')),
('post_019', 'Introducción a Drizzle ORM', 'https://orm.drizzle.team/docs/overview', 'orm.drizzle.team', 'user_004', 6, 0, 0, strftime('%s', 'now', '-3 days', '+5 hours'), strftime('%s', 'now', '-3 days')),
('post_020', 'Vercel Edge Functions vs Cloudflare Workers', 'https://vercel.com/blog/edge-vs-workers', 'vercel.com', 'user_007', 14, 0, 0, strftime('%s', 'now', '-3 days', '+8 hours'), strftime('%s', 'now', '-3 days')),
('post_021', 'Supabase lanza su nuevo Auth', 'https://supabase.com/blog/new-auth', 'supabase.com', 'user_003', 9, 0, 0, strftime('%s', 'now', '-3 days', '+11 hours'), strftime('%s', 'now', '-3 days')),

-- posts from 2 days ago
('post_022', 'Cómo Netflix maneja millones de requests', 'https://netflixtechblog.com/handling-millions-requests', 'netflixtechblog.com', 'user_001', 28, 0, 0, strftime('%s', 'now', '-2 days'), strftime('%s', 'now', '-2 days')),
('post_023', 'El problema con npm', 'https://socket.dev/blog/npm-problem', 'socket.dev', 'user_002', 17, 0, 0, strftime('%s', 'now', '-2 days', '+3 hours'), strftime('%s', 'now', '-2 days')),
('post_024', 'Startups tech chilenas a seguir en 2025', 'https://fintual.com/blog/startups-chile-2025', 'fintual.com', 'user_005', 21, 0, 0, strftime('%s', 'now', '-2 days', '+6 hours'), strftime('%s', 'now', '-2 days')),
('post_025', 'Vue 4 roadmap oficial', 'https://vuejs.org/about/roadmap-v4', 'vuejs.org', 'user_009', 10, 0, 0, strftime('%s', 'now', '-2 days', '+9 hours'), strftime('%s', 'now', '-2 days')),
('post_026', 'Por qué usamos Hono en producción', 'https://hono.dev/blog/production-case-study', 'hono.dev', 'user_007', 7, 0, 0, strftime('%s', 'now', '-2 days', '+12 hours'), strftime('%s', 'now', '-2 days')),
('post_027', 'Linear: arquitectura de una app rápida', 'https://linear.app/blog/architecture', 'linear.app', 'user_003', 15, 0, 0, strftime('%s', 'now', '-2 days', '+15 hours'), strftime('%s', 'now', '-2 days')),

-- posts from 1 day ago
('post_028', 'Qwik vs Next.js: benchmark completo', 'https://qwik.dev/blog/qwik-vs-nextjs', 'qwik.dev', 'user_004', 12, 0, 0, strftime('%s', 'now', '-1 days'), strftime('%s', 'now', '-1 days')),
('post_029', 'Stripe lanza nuevas APIs de pagos', 'https://stripe.com/blog/new-payment-apis', 'stripe.com', 'user_001', 8, 0, 0, strftime('%s', 'now', '-1 days', '+2 hours'), strftime('%s', 'now', '-1 days')),
('post_030', 'El costo oculto de los ORMs', 'https://www.prisma.io/blog/orm-cost', 'www.prisma.io', 'user_002', 19, 0, 0, strftime('%s', 'now', '-1 days', '+4 hours'), strftime('%s', 'now', '-1 days')),
('post_031', 'Remix vs Next.js en 2024', 'https://remix.run/blog/remix-vs-nextjs-2024', 'remix.run', 'user_006', 14, 0, 0, strftime('%s', 'now', '-1 days', '+6 hours'), strftime('%s', 'now', '-1 days')),
('post_032', 'Railway: la alternativa a Heroku', 'https://railway.app/blog/heroku-alternative', 'railway.app', 'user_008', 6, 0, 0, strftime('%s', 'now', '-1 days', '+8 hours'), strftime('%s', 'now', '-1 days')),
('post_033', 'Cómo debuggear memory leaks en Node.js', 'https://nodejs.org/en/learn/diagnostics/memory-leaks', 'nodejs.org', 'user_007', 11, 0, 0, strftime('%s', 'now', '-1 days', '+10 hours'), strftime('%s', 'now', '-1 days')),
('post_034', 'Turborepo 2.0: monorepos más rápidos', 'https://turbo.build/blog/turbo-2', 'turbo.build', 'user_003', 9, 0, 0, strftime('%s', 'now', '-1 days', '+12 hours'), strftime('%s', 'now', '-1 days')),

-- posts from today
('post_035', 'OpenAI lanza GPT-5', 'https://openai.com/blog/gpt-5', 'openai.com', 'user_001', 42, 0, 0, strftime('%s', 'now', '-12 hours'), strftime('%s', 'now', '-12 hours')),
('post_036', 'El estado de la IA en desarrollo de software', 'https://stackoverflow.blog/ai-software-development-2024', 'stackoverflow.blog', 'user_005', 18, 0, 0, strftime('%s', 'now', '-10 hours'), strftime('%s', 'now', '-10 hours')),
('post_037', 'Cursor vs GitHub Copilot: comparativa', 'https://cursor.com/blog/cursor-vs-copilot', 'cursor.com', 'user_009', 15, 0, 0, strftime('%s', 'now', '-8 hours'), strftime('%s', 'now', '-8 hours')),
('post_038', 'SvelteKit 2.5 con mejor SSR', 'https://kit.svelte.dev/blog/sveltekit-2-5', 'kit.svelte.dev', 'user_004', 7, 0, 0, strftime('%s', 'now', '-6 hours'), strftime('%s', 'now', '-6 hours')),
('post_039', 'Cloudflare D1 sale de beta', 'https://blog.cloudflare.com/d1-ga', 'blog.cloudflare.com', 'user_007', 11, 0, 0, strftime('%s', 'now', '-5 hours'), strftime('%s', 'now', '-5 hours')),
('post_040', 'Cómo usar Better Auth con SvelteKit', 'https://better-auth.com/docs/sveltekit', 'better-auth.com', 'user_002', 5, 0, 0, strftime('%s', 'now', '-4 hours'), strftime('%s', 'now', '-4 hours')),
('post_041', 'Figma lanza Dev Mode 2.0', 'https://figma.com/blog/dev-mode-2', 'figma.com', 'user_003', 8, 0, 0, strftime('%s', 'now', '-3 hours'), strftime('%s', 'now', '-3 hours')),
('post_042', 'Nuxt 4 roadmap oficial', 'https://nuxt.com/blog/v4-roadmap', 'nuxt.com', 'user_006', 4, 0, 0, strftime('%s', 'now', '-2 hours'), strftime('%s', 'now', '-2 hours')),
('post_043', 'La historia de cómo creamos The Stack', 'https://thestack.cl/blog/how-we-built-thestack', 'thestack.cl', 'user_001', 3, 0, 0, strftime('%s', 'now', '-1 hours'), strftime('%s', 'now', '-1 hours')),
('post_044', 'Biome: el reemplazo de ESLint + Prettier', 'https://biomejs.dev/blog/biome-1-5', 'biomejs.dev', 'user_008', 6, 0, 0, strftime('%s', 'now', '-45 minutes'), strftime('%s', 'now', '-45 minutes')),
('post_045', 'Render vs Fly.io: cuál elegir', 'https://render.com/blog/render-vs-fly', 'render.com', 'user_010', 2, 0, 0, strftime('%s', 'now', '-30 minutes'), strftime('%s', 'now', '-30 minutes')),
('post_046', 'Effect-TS: el futuro de TypeScript?', 'https://effect.website/blog/introduction', 'effect.website', 'user_002', 4, 0, 0, strftime('%s', 'now', '-20 minutes'), strftime('%s', 'now', '-20 minutes')),
('post_047', 'Cómo Notion maneja offline sync', 'https://notion.so/blog/offline-sync', 'notion.so', 'user_005', 9, 0, 0, strftime('%s', 'now', '-15 minutes'), strftime('%s', 'now', '-15 minutes')),
('post_048', 'Arc Browser: el navegador del futuro', 'https://arc.net/blog/arc-features', 'arc.net', 'user_009', 5, 0, 0, strftime('%s', 'now', '-10 minutes'), strftime('%s', 'now', '-10 minutes')),
('post_049', 'Zed Editor 1.0 release', 'https://zed.dev/blog/zed-1-0', 'zed.dev', 'user_004', 7, 0, 0, strftime('%s', 'now', '-5 minutes'), strftime('%s', 'now', '-5 minutes')),
('post_050', 'Obsidian lanza su web clipper', 'https://obsidian.md/blog/web-clipper', 'obsidian.md', 'user_007', 3, 0, 0, strftime('%s', 'now', '-2 minutes'), strftime('%s', 'now', '-2 minutes'));

-- =============================================
-- 3. upvotes (~15 upvotes, 30% of posts)
-- =============================================

INSERT INTO post_upvotes (id, post_id, user_id, created_at) VALUES
('upvote_001', 'post_035', 'user_002', strftime('%s', 'now', '-11 hours')),
('upvote_002', 'post_035', 'user_003', strftime('%s', 'now', '-10 hours')),
('upvote_003', 'post_035', 'user_005', strftime('%s', 'now', '-9 hours')),
('upvote_004', 'post_018', 'user_001', strftime('%s', 'now', '-2 days')),
('upvote_005', 'post_018', 'user_007', strftime('%s', 'now', '-2 days')),
('upvote_006', 'post_010', 'user_001', strftime('%s', 'now', '-4 days')),
('upvote_007', 'post_010', 'user_005', strftime('%s', 'now', '-4 days')),
('upvote_008', 'post_022', 'user_003', strftime('%s', 'now', '-1 days')),
('upvote_009', 'post_022', 'user_009', strftime('%s', 'now', '-1 days')),
('upvote_010', 'post_005', 'user_001', strftime('%s', 'now', '-5 days')),
('upvote_011', 'post_036', 'user_002', strftime('%s', 'now', '-8 hours')),
('upvote_012', 'post_037', 'user_001', strftime('%s', 'now', '-6 hours')),
('upvote_013', 'post_039', 'user_005', strftime('%s', 'now', '-4 hours')),
('upvote_014', 'post_047', 'user_003', strftime('%s', 'now', '-10 minutes')),
('upvote_015', 'post_003', 'user_002', strftime('%s', 'now', '-6 days'));
