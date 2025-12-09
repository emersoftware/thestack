import { createAuthClient } from 'better-auth/svelte';
import { PUBLIC_API_URL } from '$env/static/public';

export interface CustomUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  username?: string;
  karma?: number;
  about?: string;
  isAdmin?: boolean;
  isBanned?: boolean;
}

export const authClient = createAuthClient({
  baseURL: PUBLIC_API_URL,
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
