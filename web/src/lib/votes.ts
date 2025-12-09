import { apiFetch } from './api';

export interface UpvoteResponse {
  hasUpvoted: boolean;
  upvotesCount: number;
}

export async function toggleUpvote(postId: string): Promise<UpvoteResponse> {
  return apiFetch<UpvoteResponse>(`/api/posts/${postId}/upvote`, {
    method: 'POST',
  });
}

export async function getMyUpvotedPostIds(): Promise<string[]> {
  const response = await apiFetch<{ postIds: string[] }>('/api/posts/my-upvotes');
  return response.postIds;
}

export async function getUpvoteStatus(postId: string): Promise<boolean> {
  const response = await apiFetch<{ hasUpvoted: boolean }>(`/api/posts/${postId}/upvote/status`);
  return response.hasUpvoted;
}
