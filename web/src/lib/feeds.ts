import { apiFetch } from './api';

export type FeedType = 'email' | 'rss' | 'blog';

export interface Feed {
  id: string;
  name: string;
  type: FeedType;
  email: string | null;
  sourceUrl: string | null;
  autoPublish: boolean;
  isActive: boolean;
  lastProcessedAt: string | null;
  createdAt: string;
}

export interface FeedLog {
  id: string;
  subject: string | null;
  source: string | null;
  status: 'processing' | 'completed' | 'error' | 'rate_limited';
  error: string | null;
  createdAt: string;
}

export interface PendingPost {
  id: string;
  title: string;
  url: string;
  domain: string;
  createdAt: string | null;
  feedName: string | null;
}

export async function getMyFeeds(): Promise<{ feeds: Feed[] }> {
  return apiFetch('/api/feeds');
}

export async function createFeed(
  name: string,
  autoPublish: boolean,
  type: FeedType = 'email',
  sourceUrl?: string
): Promise<Feed> {
  return apiFetch('/api/feeds', {
    method: 'POST',
    body: JSON.stringify({ name, autoPublish, type, sourceUrl }),
  });
}

export async function updateFeed(id: string, data: { name?: string; autoPublish?: boolean; isActive?: boolean }): Promise<{ success: boolean }> {
  return apiFetch(`/api/feeds/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteFeed(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/feeds/${id}`, { method: 'DELETE' });
}

export async function getFeedLogs(id: string): Promise<{ logs: FeedLog[] }> {
  return apiFetch(`/api/feeds/${id}/logs`);
}

export async function getPendingPosts(): Promise<{ posts: PendingPost[] }> {
  return apiFetch('/api/feeds/pending');
}

export async function updateFeedPostTitle(postId: string, title: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/feeds/posts/${postId}/title`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  });
}

export async function approveFeedPost(postId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/feeds/posts/${postId}/approve`, { method: 'PUT' });
}

export async function rejectFeedPost(postId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/feeds/posts/${postId}`, { method: 'DELETE' });
}
