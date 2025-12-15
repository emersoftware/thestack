import { apiFetch } from './api';
import type { Post } from './posts';

export interface UserProfile {
  username: string;
  karma: number;
  about: string | null;
  createdAt: string;
  newsletterEnabled?: boolean;
}

export interface UserPostsResponse {
  posts: Post[];
  hasMore: boolean;
}

export async function getUser(username: string): Promise<UserProfile> {
  return apiFetch<UserProfile>(`/api/users/${encodeURIComponent(username)}`);
}

export async function getUserPosts(
  username: string,
  page = 1
): Promise<UserPostsResponse> {
  return apiFetch<UserPostsResponse>(
    `/api/users/${encodeURIComponent(username)}/posts?page=${page}`
  );
}

export async function updateUserAbout(
  username: string,
  about: string
): Promise<{ success: boolean }> {
  return apiFetch(`/api/users/${encodeURIComponent(username)}`, {
    method: 'PUT',
    body: JSON.stringify({ about }),
  });
}

export async function updateNewsletterPreference(
  username: string,
  newsletterEnabled: boolean
): Promise<{ success: boolean; newsletterEnabled: boolean }> {
  return apiFetch(`/api/users/${encodeURIComponent(username)}`, {
    method: 'PUT',
    body: JSON.stringify({ newsletterEnabled }),
  });
}
