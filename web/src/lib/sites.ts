import { apiFetch } from './api';
import type { Post } from './posts';

export interface SitePostsResponse {
  domain: string;
  totalPosts: number;
  posts: Post[];
  hasMore: boolean;
}

export async function getSitePosts(
  domain: string,
  page = 1
): Promise<SitePostsResponse> {
  return apiFetch<SitePostsResponse>(
    `/api/sites/${encodeURIComponent(domain)}/posts?page=${page}`
  );
}
