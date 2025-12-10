import { redirect } from '@sveltejs/kit';
import { PUBLIC_API_URL } from '$env/static/public';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, request }) => {
  try {
    const response = await fetch(`${PUBLIC_API_URL}/api/auth/get-session`, {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    });

    if (!response.ok) {
      throw redirect(302, '/login');
    }

    const session = await response.json();

    if (!session?.user) {
      throw redirect(302, '/login');
    }

    return {};
  } catch (error) {
    if (error instanceof Response || (error && typeof error === 'object' && 'status' in error)) {
      throw error;
    }
    throw redirect(302, '/login');
  }
};
