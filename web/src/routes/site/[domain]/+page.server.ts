import { PUBLIC_API_URL } from '$env/static/public';
import type { SitePostsResponse } from '$lib/sites';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch, request }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const response = await fetch(
      `${PUBLIC_API_URL}/api/sites/${encodeURIComponent(params.domain)}/posts?page=1`,
      { headers: cookieHeader ? { cookie: cookieHeader } : {} }
    );

    if (!response.ok) {
      return { domain: params.domain, totalPosts: 0, posts: [], hasMore: false };
    }

    const data: SitePostsResponse = await response.json();
    return {
      domain: data.domain,
      totalPosts: data.totalPosts,
      posts: data.posts,
      hasMore: data.hasMore
    };
  } catch (error) {
    console.error('Error fetching site posts:', error);
    return { domain: params.domain, totalPosts: 0, posts: [], hasMore: false };
  }
};
