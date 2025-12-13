import { goto, invalidateAll } from '$app/navigation';
import { PUBLIC_API_URL } from '$env/static/public';
import { authClient } from './auth';
import { draftStore } from './stores/drafts';

/**
 * TEMPORARY: Clear legacy cookies from api.thestack.cl before OAuth
 * This prevents state_mismatch errors from old cookies
 * Can be removed after 2025-12-18
 */
async function clearLegacyCookies(): Promise<void> {
  try {
    await fetch(`${PUBLIC_API_URL}/api/auth/clear-legacy-cookies`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Ignore errors - this is just a cleanup step
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  username: string,
  name: string
) {
  // TEMPORARY: Clear legacy cookies before auth to prevent session conflicts
  // Can be removed after 2025-12-18
  await clearLegacyCookies();

  const { data, error } = await authClient.signUp.email({
    email,
    password,
    name,
    callbackURL: '/',
  }, {
    // workaround: better auth types don't support custom fields, but body merges into request
    body: { username },
  } as unknown as Record<string, unknown>);

  if (error) {
    throw new Error(error.message || 'Sign up failed');
  }

  return data;
}

export async function signInWithEmail(email: string, password: string) {
  // TEMPORARY: Clear legacy cookies before auth to prevent session conflicts
  // Can be removed after 2025-12-18
  await clearLegacyCookies();

  const { data, error } = await authClient.signIn.email({
    email,
    password,
    rememberMe: true,
    callbackURL: '/',
  });

  if (error) {
    throw new Error(error.message || 'Sign in failed');
  }

  return data;
}

export async function signInWithGitHub() {
  // TEMPORARY: Clear legacy cookies before OAuth to prevent state_mismatch
  // Can be removed after 2025-12-18
  await clearLegacyCookies();

  await authClient.signIn.social({
    provider: 'github',
    callbackURL: window.location.origin + '/',
  });
}

export async function signOutUser() {
  draftStore.clear();
  await authClient.signOut({
    fetchOptions: {
      onSuccess: async () => {
        await invalidateAll();
        goto('/login');
      },
    },
  });
}
