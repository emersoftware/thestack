import { apiFetch } from './api';

export interface Post {
  id: string;
  title: string;
  url: string;
  domain: string;
  author: {
    id: string;
    username: string;
  };
  upvotesCount: number;
  score: number;
  createdAt: string;
}

export interface PostsResponse {
  posts: Post[];
  hasMore: boolean;
}

export async function getPosts(
  sort: 'hot' | 'new' = 'hot',
  page = 1
): Promise<PostsResponse> {
  return apiFetch<PostsResponse>(`/api/posts?sort=${sort}&page=${page}`);
}

export async function getPost(id: string): Promise<Post> {
  return apiFetch<Post>(`/api/posts/${id}`);
}

export async function createPost(title: string, url: string): Promise<Post> {
  return apiFetch<Post>('/api/posts', {
    method: 'POST',
    body: JSON.stringify({ title, url }),
  });
}

export async function deletePost(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/posts/${id}`, {
    method: 'DELETE',
  });
}
