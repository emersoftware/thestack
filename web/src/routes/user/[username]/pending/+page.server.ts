import { PUBLIC_API_URL } from '$env/static/public';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch, request }) => {
  const cookieHeader = request.headers.get('cookie');
  const headers: HeadersInit = cookieHeader ? { cookie: cookieHeader } : {};

  // Fetch pending posts (requires auth)
  const res = await fetch(`${PUBLIC_API_URL}/api/feeds/pending`, { headers });

  if (!res.ok) {
    // Not authenticated or error — redirect to login
    throw redirect(302, `/login?redirect=/user/${encodeURIComponent(params.username)}/pending`);
  }

  const data = await res.json();
  return {
    posts: data.posts as Array<{
      id: string;
      title: string;
      url: string;
      domain: string;
      createdAt: string | null;
    }>,
    username: params.username,
  };
};
