import { PUBLIC_API_URL } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { Post } from '$lib/posts';
import type { Comment } from '$lib/comments';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
  const [postRes, upvoteRes, commentsRes] = await Promise.all([
    fetch(`${PUBLIC_API_URL}/api/posts/${params.id}`),
    fetch(`${PUBLIC_API_URL}/api/posts/${params.id}/upvote/status`),
    fetch(`${PUBLIC_API_URL}/api/comments/post/${params.id}`)
  ]);

  if (!postRes.ok) {
    throw error(404, 'Post no encontrado');
  }

  const post: Post = await postRes.json();
  const upvoteData = upvoteRes.ok
    ? await upvoteRes.json() as { hasUpvoted: boolean }
    : { hasUpvoted: false };
  const commentsData = commentsRes.ok
    ? await commentsRes.json() as { comments: Comment[] }
    : { comments: [] };

  return {
    post,
    hasUpvoted: upvoteData.hasUpvoted,
    comments: commentsData.comments
  };
};
