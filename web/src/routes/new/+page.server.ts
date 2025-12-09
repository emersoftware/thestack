import { PUBLIC_API_URL } from '$env/static/public';
import type { PostsResponse } from '$lib/posts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const response = await fetch(`${PUBLIC_API_URL}/api/posts?sort=new&page=1`);

    if (!response.ok) {
      return { posts: [], hasMore: false };
    }

    const data: PostsResponse = await response.json();
    return {
      posts: data.posts,
      hasMore: data.hasMore,
    };
  } catch (error) {
    console.error('Error fetching posts:', error);
    return { posts: [], hasMore: false };
  }
};
