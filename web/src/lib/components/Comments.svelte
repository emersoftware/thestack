<script lang="ts">
  import type { Comment } from '$lib/comments';
  import { createComment, deleteComment, toggleCommentLike } from '$lib/comments';
  import { useSession } from '$lib/auth';
  import { goto } from '$app/navigation';
  import { toast } from '$lib/toast';
  import { ApiError } from '$lib/api';

  let { postId, initialComments = [] }: { postId: string; initialComments?: Comment[] } = $props();

  const session = useSession();
  const user = $derived($session.data?.user);

  let comments = $state<Comment[]>(initialComments);
  let newComment = $state('');
  let replyingTo = $state<string | null>(null);
  let replyContent = $state('');
  let submitting = $state(false);
  let likingComment = $state<string | null>(null);

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
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error('Debes verificar tu email para comentar');
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
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error('Debes verificar tu email para comentar');
      } else {
        toast.error('Error al crear comentario');
      }
    } finally {
      submitting = false;
    }
  }

  async function handleDelete(commentId: string) {
    if (!confirm('¿Eliminar este comentario?')) return;

    try {
      await deleteComment(commentId);
      comments = comments.map(c =>
        c.id === commentId
          ? { ...c, content: '[eliminado]', isDeleted: true, author: { ...c.author, username: '[eliminado]' } }
          : c
      );
    } catch {
      toast.error('Error al eliminar comentario');
    }
  }

  function getChildren(parentId: string): Comment[] {
    return commentTree.get(parentId) || [];
  }

  function scrollIntoView(node: HTMLElement) {
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function handleLike(commentId: string) {
    if (!user) {
      goto('/login');
      return;
    }

    if (likingComment) return;

    // Optimistic update
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    const wasLiked = comment.hasLiked;
    const prevCount = comment.likesCount;

    comments = comments.map(c =>
      c.id === commentId
        ? { ...c, hasLiked: !wasLiked, likesCount: wasLiked ? c.likesCount - 1 : c.likesCount + 1 }
        : c
    );

    likingComment = commentId;
    try {
      const result = await toggleCommentLike(commentId);
      comments = comments.map(c =>
        c.id === commentId
          ? { ...c, hasLiked: result.hasLiked, likesCount: result.likesCount }
          : c
      );
    } catch (err) {
      // Rollback
      comments = comments.map(c =>
        c.id === commentId
          ? { ...c, hasLiked: wasLiked, likesCount: prevCount }
          : c
      );
      if (err instanceof ApiError && err.status === 403) {
        toast.error('Debes verificar tu email para dar like');
      }
    } finally {
      likingComment = null;
    }
  }
</script>

<div class="mt-8">
  <!-- Header -->
  <div class="flex items-center gap-3 mb-5">
    <span class="text-sm font-semibold text-the-black">
      {comments.length} {comments.length === 1 ? 'comentario' : 'comentarios'}
    </span>
    <div class="flex-1 h-px bg-neutral-200"></div>
  </div>

  <!-- New comment form -->
  <form onsubmit={handleSubmit} class="mb-6">
    <div class="bg-the-white rounded-xl border border-neutral-200 focus-within:border-the-black transition-colors overflow-hidden">
      <textarea
        bind:value={newComment}
        placeholder={user ? 'Escribe un comentario...' : 'Inicia sesión para comentar'}
        disabled={!user || submitting}
        rows="3"
        class="w-full px-4 py-3 text-sm bg-transparent focus:outline-none resize-none disabled:cursor-not-allowed placeholder:text-neutral-400"
      ></textarea>
      <div class="flex justify-end px-3 pb-3">
        <button
          type="submit"
          disabled={!user || !newComment.trim() || submitting}
          class="px-4 py-1.5 text-xs font-medium text-the-white bg-the-black rounded-full hover:bg-neutral-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Enviando...' : 'Comentar'}
        </button>
      </div>
    </div>
  </form>

  <!-- Comments list -->
  {#if comments.length === 0}
    <div class="text-center py-12">
      <p class="text-neutral-400 text-sm">Sin comentarios aún</p>
      <p class="text-neutral-400 text-xs mt-1">Sé el primero en comentar</p>
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
  <div
    class="relative"
    style="margin-left: {Math.min(depth * 20, 60)}px"
  >
    <!-- Thread line for nested comments -->
    {#if depth > 0}
      <div class="absolute left-0 top-0 bottom-0 w-px bg-neutral-200 -translate-x-3"></div>
    {/if}

    <div class="bg-the-white rounded-xl border border-neutral-200 hover:border-neutral-300 transition-colors p-3 sm:p-4">
      <!-- Comment header -->
      <div class="flex items-center gap-2 mb-2">
        <a
          href="/user/{comment.author.username}"
          class="text-xs font-semibold text-the-black hover:underline {comment.isDeleted ? 'pointer-events-none' : ''}"
        >
          {comment.author.username}
        </a>
        <span class="text-xs text-neutral-400">·</span>
        <span class="text-xs text-neutral-400">{getRelativeTime(comment.createdAt)}</span>
      </div>

      <!-- Comment content -->
      <p class="text-sm text-the-black whitespace-pre-wrap break-words leading-relaxed {comment.isDeleted ? 'italic text-neutral-400' : ''}">
        {comment.content}
      </p>

      <!-- Actions -->
      {#if !comment.isDeleted}
        <div class="flex items-center gap-3 mt-2">
          <!-- Like button -->
          <button
            type="button"
            onclick={() => handleLike(comment.id)}
            disabled={likingComment === comment.id}
            class="flex items-center gap-1 transition-colors hover:cursor-pointer disabled:cursor-not-allowed {comment.hasLiked ? 'text-the-black' : 'text-neutral-400 hover:text-the-black'} {likingComment === comment.id ? 'animate-pulse' : ''}"
          >
            <svg
              class="w-3 h-3 {likingComment === comment.id ? 'opacity-50' : ''}"
              viewBox="0 0 24 24"
              fill={comment.hasLiked ? 'currentColor' : 'none'}
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 6 L19 18 L5 18 Z" />
            </svg>
            <span class="text-xs font-semibold {comment.hasLiked ? 'text-the-black' : 'text-neutral-500'} {likingComment === comment.id ? 'opacity-50' : ''}">{comment.likesCount}</span>
          </button>
          <button
            type="button"
            onclick={() => { replyingTo = replyingTo === comment.id ? null : comment.id; replyContent = ''; }}
            class="text-xs text-neutral-500 hover:text-the-black transition-colors flex items-center gap-1"
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
              class="text-xs text-neutral-400 hover:text-the-red transition-colors"
            >
              eliminar
            </button>
          {/if}
        </div>
      {/if}

      <!-- Reply form -->
      {#if replyingTo === comment.id}
        <div class="mt-3 pt-3 border-t border-neutral-100" use:scrollIntoView>
          <div class="bg-neutral-50 rounded-lg border border-neutral-200 focus-within:border-the-black transition-colors overflow-hidden">
            <textarea
              bind:value={replyContent}
              placeholder="Escribe una respuesta..."
              rows="2"
              class="w-full px-3 py-2 text-sm bg-transparent focus:outline-none resize-none placeholder:text-neutral-400"
            ></textarea>
            <div class="flex gap-2 justify-end px-2 pb-2">
              <button
                type="button"
                onclick={() => { replyingTo = null; replyContent = ''; }}
                class="px-3 py-1 text-xs text-neutral-500 hover:text-the-black transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onclick={() => handleReply(comment.id)}
                disabled={!replyContent.trim() || submitting}
                class="px-3 py-1 text-xs font-medium text-the-white bg-the-black rounded-full hover:bg-neutral-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? '...' : 'Responder'}
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>

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
