<script lang="ts">
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { ANIM } from '$lib/anim';
  import { getPosts, type Post } from '$lib/posts';
  import { getMyUpvotedPostIds } from '$lib/votes';
  import { useSession } from '$lib/auth';
  import PostCard from './PostCard.svelte';
  import LoadMoreButton from './LoadMoreButton.svelte';

  let {
    sort = 'hot',
    initialPosts,
    initialHasMore,
    enterPost = null,
  }: {
    sort: 'hot' | 'new';
    initialPosts: Post[];
    initialHasMore: boolean;
    // A freshly-published post to animate into the top of the list (from /submit).
    enterPost?: Post | null;
  } = $props();

  // Animation timing (ms), shared via $lib/anim so /submit and the list stay in sync.
  const ENTER_BEAT = ANIM.enterBeat; // list shown WITHOUT the new post
  const ENTER_MS = ANIM.enterMs; // new post flies in from the top
  const FLIP_MS = ANIM.flipMs; // existing posts slide down to make room

  const prefersReducedMotion = () =>
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const session = useSession();
  const user = $derived($session.data?.user);

  // Start WITHOUT the freshly-published post so the list visibly shifts to make
  // room when we insert it at the top after a short beat (see onMount below).
  const baseInitial = enterPost ? initialPosts.filter((p) => p.id !== enterPost.id) : initialPosts;
  let posts = $state<Post[]>(baseInitial);
  // Only the just-inserted post is allowed to play its fly-in intro; every other
  // element (initial render, loadMore) gets a no-op transition. Gated by id.
  let enterId = $state<string | null>(null);
  // Initialize upvotes from server-provided hasUpvoted field. The new post is
  // auto-upvoted by its author, so seed it as upvoted even if the load lagged.
  let myUpvotes = $state<Set<string>>(
    new Set([
      ...initialPosts.filter((p) => p.hasUpvoted).map((p) => p.id),
      ...(enterPost ? [enterPost.id] : []),
    ])
  );
  let loadingMore = $state(false);
  let error = $state('');
  let page = $state(1);
  let hasMore = $state(initialHasMore);
  // Track if we have server-provided upvote data
  let hasServerUpvotes = $state(initialPosts.some((p) => p.hasUpvoted !== undefined));

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    loadingMore = true;
    page += 1;
    try {
      const response = await getPosts(sort, page);
      posts = [...posts, ...response.posts];
      hasMore = response.hasMore;
      // Add new upvotes from loaded posts
      response.posts.forEach((p) => {
        if (p.hasUpvoted) {
          myUpvotes = new Set([...myUpvotes, p.id]);
        }
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al cargar posts';
    } finally {
      loadingMore = false;
    }
  }

  // Only refetch upvotes when user changes and we don't have server data
  $effect(() => {
    if (user && !hasServerUpvotes) {
      getMyUpvotedPostIds()
        .then((ids) => {
          myUpvotes = new Set(ids);
        })
        .catch(() => {
          myUpvotes = new Set();
        });
    } else if (!user && !hasServerUpvotes) {
      // Only reset if we don't have server data
      // (prevents clearing SSR upvotes during hydration)
      myUpvotes = new Set();
    }
  });

  // Insert the freshly-published post at the top after a short beat, so the user
  // sees the list momentarily without it and then watches it drop in from above
  // while the others slide down (animate:flip).
  onMount(() => {
    if (!enterPost) return;
    const post = enterPost;

    const insert = () => {
      if (!posts.some((p) => p.id === post.id)) {
        posts = [post, ...posts];
      }
    };

    if (prefersReducedMotion()) {
      insert();
      return;
    }

    let t2: ReturnType<typeof setTimeout>;
    const t1 = setTimeout(() => {
      enterId = post.id; // arm the fly-in for exactly this post
      insert();
      // Disarm once the intro is done so later array changes don't animate.
      t2 = setTimeout(() => {
        enterId = null;
      }, ENTER_MS + 60);
    }, ENTER_BEAT);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  });

  // Custom intro: delegates to fly ONLY for the armed post; a no-op otherwise so
  // initial-render and loadMore items appear instantly without a transition.
  function enterIntro(node: Element, { id }: { id: string }) {
    if (id !== enterId) return { duration: 0 };
    return fly(node, { y: ANIM.enterFlyY, duration: ENTER_MS, easing: cubicOut });
  }
</script>

{#if error}
  <div class="rounded-lg border border-error bg-error/10 px-4 py-3 text-sm text-error">
    {error}
  </div>
{:else if posts.length === 0}
  <div class="text-center py-16">
    <p class="text-muted-foreground mb-4">No hay posts todavía</p>
    <a href="/submit" class="text-foreground hover:underline font-medium">
      Sé el primero en publicar
    </a>
  </div>
{:else}
  <div class="grid gap-2 sm:gap-3 justify-items-stretch sm:justify-items-start">
    {#each posts as post (post.id)}
      <div
        class="w-full sm:w-fit"
        animate:flip={{ duration: FLIP_MS, easing: cubicOut }}
        in:enterIntro={{ id: post.id }}
      >
        <PostCard {post} hasUpvoted={myUpvotes.has(post.id)} />
      </div>
    {/each}
  </div>

  {#if hasMore}
    <LoadMoreButton loading={loadingMore} onclick={loadMore} />
  {/if}
{/if}
