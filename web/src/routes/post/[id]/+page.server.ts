import { PUBLIC_API_URL } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { Post } from '$lib/posts';
import type { Comment } from '$lib/comments';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch, request }) => {
  const cookieHeader = request.headers.get('cookie');
  const headers: HeadersInit = cookieHeader ? { cookie: cookieHeader } : {};

  const [postRes, commentsRes] = await Promise.all([
    fetch(`${PUBLIC_API_URL}/api/posts/${params.id}`, { headers }),
    fetch(`${PUBLIC_API_URL}/api/comments/post/${params.id}`, { headers })
  ]);

  if (!postRes.ok) {
    throw error(404, 'Post no encontrado');
  }

  const post: Post = await postRes.json();
  const commentsData = commentsRes.ok
    ? await commentsRes.json() as { comments: Comment[] }
    : { comments: [] };

  return {
    post,
    comments: commentsData.comments
  };
};
