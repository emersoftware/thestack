import { redirect } from '@sveltejs/kit';
import { PUBLIC_API_URL } from '$env/static/public';
import type { PageServerLoad } from './$types';
import type { AdminStats, AdminUser, AdminPost } from '$lib/admin';

interface SessionResponse {
  user?: {
    id: string;
    isAdmin?: boolean;
  };
}

export const load: PageServerLoad = async ({ fetch }) => {
  // Check auth first
  const sessionRes = await fetch(`${PUBLIC_API_URL}/api/auth/get-session`);

  if (!sessionRes.ok) {
    throw redirect(302, '/login');
  }

  const session: SessionResponse = await sessionRes.json();

  if (!session?.user) {
    throw redirect(302, '/login');
  }

  if (!session.user.isAdmin) {
    throw redirect(302, '/');
  }

  // Fetch admin data in parallel
  try {
    const [statsRes, usersRes, postsRes] = await Promise.all([
      fetch(`${PUBLIC_API_URL}/api/admin/stats`),
      fetch(`${PUBLIC_API_URL}/api/admin/users`),
      fetch(`${PUBLIC_API_URL}/api/admin/posts`),
    ]);

    const stats: AdminStats = statsRes.ok ? await statsRes.json() : { users: 0, posts: 0, upvotes: 0 };
    const usersData = usersRes.ok ? await usersRes.json() as { users: AdminUser[] } : { users: [] };
    const postsData = postsRes.ok ? await postsRes.json() as { posts: AdminPost[] } : { posts: [] };

    return {
      stats,
      users: usersData.users,
      posts: postsData.posts,
    };
  } catch (error) {
    console.error('Error fetching admin data:', error);
    return {
      stats: { users: 0, posts: 0, upvotes: 0 },
      users: [],
      posts: [],
    };
  }
};
