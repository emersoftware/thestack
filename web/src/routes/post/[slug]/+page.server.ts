import { PUBLIC_API_URL } from '$env/static/public';
import { error, redirect } from '@sveltejs/kit';
import type { Post } from '$lib/posts';
import type { Comment } from '$lib/comments';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch, request }) => {
  const cookieHeader = request.headers.get('cookie');
  const headers: HeadersInit = cookieHeader ? { cookie: cookieHeader } : {};

  // First, fetch the post (handles both slug and UUID)
  const postRes = await fetch(`${PUBLIC_API_URL}/api/posts/${params.slug}`, { headers });

  // Handle redirect response (when UUID was used instead of slug)
  if (postRes.status === 301) {
    const data = await postRes.json() as { redirect: boolean; slug: string };
    if (data.redirect && data.slug) {
      redirect(301, `/post/${data.slug}`);
    }
  }

  if (!postRes.ok) {
    throw error(404, 'Post no encontrado');
  }

  const post: Post = await postRes.json();

  // Use the post's UUID for fetching comments (comments API uses UUID)
  const commentsRes = await fetch(`${PUBLIC_API_URL}/api/comments/post/${post.id}`, { headers });
  const commentsData = commentsRes.ok
    ? await commentsRes.json() as { comments: Comment[] }
    : { comments: [] };

  return {
    post,
    comments: commentsData.comments
  };
};
