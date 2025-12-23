import type { Handle } from '@sveltejs/kit';
import { PUBLIC_API_URL } from '$env/static/public';

export const handle: Handle = async ({ event, resolve }) => {
  const cookieHeader = event.request.headers.get('cookie');

  if (cookieHeader) {
    try {
      // Forward cookies to API - better-auth validates the session token
      // using BETTER_AUTH_SECRET on the backend
      const response = await fetch(`${PUBLIC_API_URL}/api/auth/get-session`, {
        headers: { cookie: cookieHeader },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.user) {
          event.locals.user = data.user;
        }
      }
    } catch (error) {
      console.error('Session fetch error:', error);
    }
  }

  event.locals.user = event.locals.user ?? null;
  return resolve(event);
};
