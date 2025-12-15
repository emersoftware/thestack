import { apiFetch } from './api';

export interface AdminStats {
  users: number;
  posts: number;
  upvotes: number;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  karma: number;
  isAdmin: boolean;
  isBanned: boolean;
  createdAt: string;
}

export interface AdminPost {
  id: string;
  title: string;
  url: string;
  domain: string;
  upvotesCount: number;
  isDeleted: boolean;
  createdAt: string;
  author: { id: string; username: string };
}

export async function getAdminStats(): Promise<AdminStats> {
  return apiFetch('/api/admin/stats');
}

export async function getAdminUsers(): Promise<{ users: AdminUser[] }> {
  return apiFetch('/api/admin/users');
}

export async function getAdminPosts(): Promise<{ posts: AdminPost[] }> {
  return apiFetch('/api/admin/posts');
}

export async function promoteUser(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/admin/users/${id}/promote`, { method: 'PUT' });
}

export async function demoteUser(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/admin/users/${id}/demote`, { method: 'PUT' });
}

export async function banUser(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/admin/users/${id}/ban`, { method: 'PUT' });
}

export async function unbanUser(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/admin/users/${id}/unban`, { method: 'PUT' });
}

export async function deletePost(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/admin/posts/${id}`, { method: 'DELETE' });
}

export async function restorePost(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/admin/posts/${id}/restore`, { method: 'PUT' });
}

export interface NewsletterResult {
  success: boolean;
  sent: number;
  errors: number;
}

export async function sendNewsletter(): Promise<NewsletterResult> {
  return apiFetch('/api/admin/newsletter/send', { method: 'POST' });
}
