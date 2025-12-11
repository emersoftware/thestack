import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  if (locals.user.isBanned) {
    throw redirect(303, '/?error=banned');
  }

  return {
    user: locals.user,
  };
};
