import { goto } from '$app/navigation';
import { authClient } from './auth';
import { draftStore } from './stores/drafts';

export async function signUpWithEmail(
  email: string,
  password: string,
  username: string,
  name: string
) {
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
  await authClient.signIn.social({
    provider: 'github',
    callbackURL: window.location.origin + '/',
  });
}

export async function signOutUser() {
  draftStore.clear();
  await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        goto('/login');
      },
    },
  });
}
