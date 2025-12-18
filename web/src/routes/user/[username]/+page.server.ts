import { PUBLIC_API_URL } from '$env/static/public';
import type { UserProfile, UserPostsResponse } from '$lib/users';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch, request }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const headers: HeadersInit = cookieHeader ? { cookie: cookieHeader } : {};

    const [profileRes, postsRes] = await Promise.all([
      fetch(`${PUBLIC_API_URL}/api/users/${encodeURIComponent(params.username)}`, { headers }),
      fetch(`${PUBLIC_API_URL}/api/users/${encodeURIComponent(params.username)}/posts?page=1`, { headers })
    ]);

    if (!profileRes.ok) {
      return { profile: null, posts: [], hasMore: false };
    }

    const profile: UserProfile = await profileRes.json();
    const postsData: UserPostsResponse = postsRes.ok ? await postsRes.json() : { posts: [], hasMore: false };

    return {
      profile,
      posts: postsData.posts,
      hasMore: postsData.hasMore
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    return { profile: null, posts: [], hasMore: false };
  }
};
