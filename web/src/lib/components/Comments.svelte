<script lang="ts">
  import type { Comment } from '$lib/comments';
  import { createComment, deleteComment, toggleCommentUpvote, getMyCommentUpvotes } from '$lib/comments';
  import { useSession } from '$lib/auth';
  import { goto } from '$app/navigation';
  import { toast } from '$lib/toast';
  import { ApiError } from '$lib/api';
  import { logoStore } from '$lib/stores/logo';

  let { postId, initialComments = [] }: { postId: string; initialComments?: Comment[] } = $props();

  const session = useSession();
  const user = $derived($session.data?.user);

  let comments = $state<Comment[]>(initialComments);
  let newComment = $state('');
  let replyingTo = $state<string | null>(null);
  let replyContent = $state('');
  let submitting = $state(false);
  let upvotingComment = $state<string | null>(null);
  let deletingCommentId = $state<string | null>(null);
  let upvotesLoaded = $state(false);

  // Load user's upvoted comments client-side (requires auth cookies)
  $effect(() => {
    if (user && !upvotesLoaded) {
      upvotesLoaded = true;
      getMyCommentUpvotes(postId)
        .then((upvotedIds) => {
          const upvotedSet = new Set(upvotedIds);
          comments = comments.map((c) => ({
            ...c,
            hasUpvoted: upvotedSet.has(c.id)
          }));
        })
        .catch(() => {
          // Silently fail - upvotes will show as false
        });
    }
  });

  // Build tree structure from flat comments
  const commentTree = $derived.by(() => {
    const map = new Map<string | null, Comment[]>();
    map.set(null, []);

    for (const comment of comments) {
      if (!map.has(comment.parentId)) {
        map.set(comment.parentId, []);
      }
      map.get(comment.parentId)!.push(comment);
    }

    return map;
  });

  const rootComments = $derived(commentTree.get(null) || []);

  function getRelativeTime(dateString: string): string {
    const created = new Date(dateString);
    const now = new Date();
    const ms = now.getTime() - created.getTime();
    const mins = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    if (mins < 60) return `hace ${mins === 0 ? 1 : mins}m`;
    if (hours < 24) return `hace ${hours}h`;
    if (days < 7) return `hace ${days}d`;

    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;

    const months = Math.floor(days / 30);
    return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();

    if (!user) {
      goto('/login');
      return;
    }

    if (!newComment.trim() || submitting) return;

    submitting = true;
    try {
      const comment = await createComment(postId, newComment.trim());
      comments = [...comments, comment];
      newComment = '';
      logoStore.bump();
      // Scroll to new comment, only add focus if vim mode is active
      setTimeout(() => {
        const el = document.querySelector(`[data-nav-id="${comment.id}"]`) as HTMLElement;
        if (el) {
          const vimMode = localStorage.getItem('vimMode') === 'true';
          if (vimMode) {
            document.querySelectorAll('[data-nav-focus]').forEach(e => e.removeAttribute('data-nav-focus'));
            el.setAttribute('data-nav-focus', 'true');
          }
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Error al crear comentario');
      }
    } finally {
      submitting = false;
    }
  }

  async function handleReply(parentId: string) {
    if (!user) {
      goto('/login');
      return;
    }

    if (!replyContent.trim() || submitting) return;

    submitting = true;
    try {
      const comment = await createComment(postId, replyContent.trim(), parentId);
      comments = [...comments, comment];
      replyContent = '';
      replyingTo = null;
      logoStore.bump();
      // Scroll to new reply, only add focus if vim mode is active
      setTimeout(() => {
        const el = document.querySelector(`[data-nav-id="${comment.id}"]`) as HTMLElement;
        if (el) {
          const vimMode = localStorage.getItem('vimMode') === 'true';
          if (vimMode) {
            document.querySelectorAll('[data-nav-focus]').forEach(e => e.removeAttribute('data-nav-focus'));
            el.setAttribute('data-nav-focus', 'true');
          }
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Error al crear comentario');
      }
    } finally {
      submitting = false;
    }
  }

  function handleDelete(commentId: string) {
    deletingCommentId = commentId;
  }

  async function confirmDelete() {
    if (!deletingCommentId) return;
    try {
      await deleteComment(deletingCommentId);
      comments = comments.map(c =>
        c.id === deletingCommentId
          ? { ...c, content: '[eliminado]', isDeleted: true, author: { ...c.author, username: '[eliminado]' } }
          : c
      );
    } catch {
      toast.error('Error al eliminar comentario');
    } finally {
      deletingCommentId = null;
    }
  }

  function getChildren(parentId: string): Comment[] {
    return commentTree.get(parentId) || [];
  }

  function scrollIntoView(node: HTMLElement) {
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function handleUpvote(commentId: string) {
    if (!user) {
      goto('/login');
      return;
    }

    if (upvotingComment) return;

    // Optimistic update
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    const wasLiked = comment.hasUpvoted;
    const prevCount = comment.upvotesCount;

    comments = comments.map(c =>
      c.id === commentId
        ? { ...c, hasUpvoted: !wasLiked, upvotesCount: wasLiked ? c.upvotesCount - 1 : c.upvotesCount + 1 }
        : c
    );

    if (!wasLiked) {
      logoStore.bump();
    }

    upvotingComment = commentId;
    try {
      const result = await toggleCommentUpvote(commentId);
      comments = comments.map(c =>
        c.id === commentId
          ? { ...c, hasUpvoted: result.hasUpvoted, upvotesCount: result.upvotesCount }
          : c
      );
    } catch (err) {
      // Rollback
      comments = comments.map(c =>
        c.id === commentId
          ? { ...c, hasUpvoted: wasLiked, upvotesCount: prevCount }
          : c
      );
      if (err instanceof ApiError) {
        toast.error(err.message);
      }
    } finally {
      upvotingComment = null;
    }
  }
</script>

<div class="mt-4">
  <!-- Header -->
  <div class="flex items-center gap-3 mb-4">
    <span class="text-sm font-semibold text-foreground">
      {comments.length} {comments.length === 1 ? 'comentario' : 'comentarios'}
    </span>
    <div class="flex-1 h-px bg-border"></div>
  </div>

  <!-- New comment form -->
  <form onsubmit={handleSubmit} class="mb-4">
    <div class="bg-card rounded-xl border border-border focus-within:border-border-hover transition-colors p-3 sm:p-4" data-nav-item>
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-semibold text-foreground">{user?.username || 'Tú'}</span>
      </div>
      <textarea
        bind:value={newComment}
        placeholder={user ? 'Escribe un comentario...' : 'Inicia sesión para comentar'}
        disabled={!user || submitting}
        rows="1"
        data-nav-textarea
        class="w-full text-sm bg-transparent text-foreground focus:outline-none resize-none disabled:cursor-not-allowed placeholder:text-muted-foreground leading-relaxed"
      ></textarea>
      <div class="flex justify-end mt-2">
        <button
          type="submit"
          data-nav-submit
          disabled={!user || !newComment.trim() || submitting}
          class="px-4 py-1.5 text-xs font-medium text-accent-foreground bg-accent rounded-full hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Enviando...' : 'Comentar'}
        </button>
      </div>
    </div>
  </form>

  <!-- Comments list -->
  {#if comments.length === 0}
    <div class="text-center py-12">
      <p class="text-muted-foreground text-sm">Sin comentarios aún</p>
      <p class="text-muted-foreground text-xs mt-1">Sé el primero en comentar</p>
    </div>
  {:else}
    <div class="space-y-2">
      {#each rootComments as comment (comment.id)}
        {@render commentNode(comment, 0)}
      {/each}
    </div>
  {/if}
</div>

{#snippet commentNode(comment: Comment, depth: number)}
  <div class="relative {depth > 0 ? 'ml-4 sm:ml-8' : ''}">
    <div
      class="bg-card rounded-xl border border-border hover:border-border-hover transition-colors p-3 sm:p-4"
      data-nav-item
      data-nav-id={comment.id}
      data-nav-parent={comment.parentId || ''}
      data-nav-depth={depth}
    >
      <!-- Comment header -->
      <div class="flex items-center gap-2 mb-2">
        <a
          href="/user/{comment.author.username}"
          class="text-xs font-semibold text-foreground hover:underline {comment.isDeleted ? 'pointer-events-none' : ''}"
        >
          {comment.author.username}
        </a>
        <span class="text-xs text-muted-foreground">·</span>
        <span class="text-xs text-muted-foreground">{getRelativeTime(comment.createdAt)}</span>
      </div>

      <!-- Comment content -->
      <p class="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed {comment.isDeleted ? 'italic text-muted-foreground' : ''}">
        {comment.content}
      </p>

      <!-- Actions -->
      {#if !comment.isDeleted}
        <div class="flex items-center gap-3 mt-2">
          <!-- Like button -->
          <button
            type="button"
            onclick={() => handleUpvote(comment.id)}
            disabled={upvotingComment === comment.id}
            data-nav-upvote
            class="flex items-center gap-1 transition-colors hover:cursor-pointer disabled:cursor-not-allowed {comment.hasUpvoted ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'} {upvotingComment === comment.id ? 'animate-pulse' : ''}"
          >
            <svg
              class="w-3 h-3 {upvotingComment === comment.id ? 'opacity-50' : ''}"
              viewBox="0 0 24 24"
              fill={comment.hasUpvoted ? 'currentColor' : 'none'}
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 6 L19 18 L5 18 Z" />
            </svg>
            <span class="text-xs font-semibold {comment.hasUpvoted ? 'text-foreground' : 'text-muted-foreground'} {upvotingComment === comment.id ? 'opacity-50' : ''}">{comment.upvotesCount}</span>
          </button>
          <button
            type="button"
            onclick={() => { replyingTo = replyingTo === comment.id ? null : comment.id; replyContent = ''; }}
            data-nav-reply
            class="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 10h10a5 5 0 0 1 5 5v6M3 10l6-6M3 10l6 6"/>
            </svg>
            responder
          </button>
          {#if user && (user.id === comment.author.id || (user as { isAdmin?: boolean }).isAdmin)}
            <button
              type="button"
              onclick={() => handleDelete(comment.id)}
              class="text-xs text-muted-foreground hover:text-error transition-colors"
            >
              eliminar
            </button>
          {/if}
        </div>
      {/if}

    </div>

    <!-- Reply form as separate card -->
    {#if replyingTo === comment.id}
      <div
        class="mt-2 ml-4 sm:ml-8"
        use:scrollIntoView
      >
        <div class="bg-card rounded-xl border border-border-hover p-3 sm:p-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-semibold text-foreground">{user?.username || 'Tú'}</span>
            <span class="text-xs text-muted-foreground">·</span>
            <span class="text-xs text-muted-foreground">borrador</span>
          </div>
          <textarea
            bind:value={replyContent}
            placeholder="Escribe una respuesta..."
            rows="1"
            data-nav-textarea
            data-nav-submit-id={comment.id}
            class="w-full text-sm bg-transparent text-foreground focus:outline-none resize-none placeholder:text-muted-foreground leading-relaxed"
          ></textarea>
          <div class="flex gap-2 justify-end mt-1">
            <button
              type="button"
              onclick={() => { replyingTo = null; replyContent = ''; }}
              class="px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onclick={() => handleReply(comment.id)}
              disabled={!replyContent.trim() || submitting}
              data-nav-submit={comment.id}
              class="px-3 py-1 text-xs font-medium text-accent-foreground bg-accent rounded-full hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '...' : 'Responder'}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Nested replies -->
    {#if getChildren(comment.id).length > 0}
      <div class="mt-2 space-y-2">
        {#each getChildren(comment.id) as child (child.id)}
          {@render commentNode(child, depth + 1)}
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#if deletingCommentId}
  <div
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    onclick={() => deletingCommentId = null}
    role="dialog"
  >
    <div class="bg-card rounded-xl shadow-xl max-w-sm w-full p-4" onclick={e => e.stopPropagation()}>
      <h2 class="text-lg font-semibold text-foreground mb-2">Eliminar comentario</h2>
      <p class="text-sm text-muted-foreground mb-4">Seguro? Esta acción no se puede deshacer.</p>
      <div class="flex justify-end gap-2">
        <button onclick={() => deletingCommentId = null} class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          Cancelar
        </button>
        <button onclick={confirmDelete} class="px-4 py-2 text-sm font-medium text-error border border-error rounded-full hover:bg-error hover:text-white transition-colors">
          Eliminar
        </button>
      </div>
    </div>
  </div>
{/if}
