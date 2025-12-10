import { apiFetch } from './api';

export interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  upvotesCount: number;
  hasUpvoted: boolean;
  isDeleted: boolean;
  createdAt: string;
  author: {
    id: string;
    username: string;
  };
}

export interface CommentsResponse {
  comments: Comment[];
}

export interface CommentUpvoteResponse {
  hasUpvoted: boolean;
  upvotesCount: number;
}

export async function getComments(postId: string): Promise<CommentsResponse> {
  return apiFetch<CommentsResponse>(`/api/comments/post/${postId}`);
}

export async function createComment(
  postId: string,
  content: string,
  parentId?: string
): Promise<Comment> {
  return apiFetch<Comment>(`/api/comments/post/${postId}`, {
    method: 'POST',
    body: JSON.stringify({ content, parentId }),
  });
}

export async function deleteComment(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/comments/${id}`, {
    method: 'DELETE',
  });
}

export async function toggleCommentUpvote(commentId: string): Promise<CommentUpvoteResponse> {
  return apiFetch<CommentUpvoteResponse>(`/api/comments/${commentId}/upvote`, {
    method: 'POST',
  });
}
