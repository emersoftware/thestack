import { goto } from '$app/navigation';
import { getSession, type CustomUser } from '$lib/auth';

export async function requireAuth(): Promise<boolean> {
  const session = await getSession();

  if (!session.data?.user) {
    goto('/login');
    return false;
  }

  return true;
}

export async function requireAdmin(): Promise<boolean> {
  const session = await getSession();

  if (!session.data?.user) {
    goto('/login');
    return false;
  }

  const user = session.data.user as CustomUser;
  if (!user.isAdmin) {
    goto('/');
    return false;
  }

  return true;
}
