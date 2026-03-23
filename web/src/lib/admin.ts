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

export interface NewsletterSendItem {
  id: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'sent';
  sentAt: string | null;
  recipientCount: number | null;
  openedCount: number;
  openRate: number;
}

export interface NewsletterStatus {
  activeSubscribers: number;
  nextSendAt: string;
  secondsUntilNextSend: number;
  currentDraft: NewsletterSendItem | null;
}

export async function getNewsletterStatus(): Promise<NewsletterStatus> {
  return apiFetch('/api/admin/newsletter/status');
}

export async function getNewsletterSends(): Promise<{ sends: NewsletterSendItem[] }> {
  return apiFetch('/api/admin/newsletter/sends');
}

export async function upsertNewsletterDraft(subject: string): Promise<NewsletterSendItem> {
  return apiFetch('/api/admin/newsletter/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject }),
  });
}

export async function sendNewsletter(sendId?: string): Promise<NewsletterResult & { sendId: string }> {
  return apiFetch('/api/admin/newsletter/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sendId }),
  });
}

// ─── Feeds ───

export interface AdminFeed {
  id: string;
  name: string;
  type: 'email' | 'rss' | 'blog';
  email: string | null;
  sourceUrl: string | null;
  autoPublish: boolean;
  isActive: boolean;
  lastProcessedAt: string | null;
  createdAt: string;
  owner: { id: string; username: string };
}

export async function getAdminFeeds(): Promise<{ feeds: AdminFeed[] }> {
  return apiFetch('/api/admin/feeds');
}

export async function deleteAdminFeed(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/admin/feeds/${id}`, { method: 'DELETE' });
}

export async function retryFeedLog(logId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/admin/feeds/logs/${logId}/retry`, { method: 'POST' });
}

// ─── Analytics ───

function dateParams(start: string, end: string): string {
  return `?start=${start}&end=${end}`;
}

export interface AnalyticsOverview {
  pageViews: number;
  uniqueVisitors: number;
  linkClicks: number;
  newsletterOpens: number;
}

export interface DayCount { day: string; count: number }
export interface PathCount { path: string; count: number }

export async function getAnalyticsOverview(start: string, end: string): Promise<AnalyticsOverview> {
  return apiFetch(`/api/admin/analytics/overview${dateParams(start, end)}`);
}

export async function getPostsPerDay(start: string, end: string): Promise<{ data: DayCount[] }> {
  return apiFetch(`/api/admin/analytics/posts-per-day${dateParams(start, end)}`);
}

export async function getRegistrationsPerDay(start: string, end: string): Promise<{ data: DayCount[] }> {
  return apiFetch(`/api/admin/analytics/registrations-per-day${dateParams(start, end)}`);
}

export async function getEngagement(start: string, end: string): Promise<{
  commentsPerDay: number; upvotesPerDay: number; postsPerDay: number;
  commentsPerPost: number; upvotesPerPost: number;
}> {
  return apiFetch(`/api/admin/analytics/engagement${dateParams(start, end)}`);
}

export async function getRetention(start: string, end: string): Promise<{
  dau: { day: string; active_users: number }[];
  wau: { week: string; active_users: number }[];
}> {
  return apiFetch(`/api/admin/analytics/retention${dateParams(start, end)}`);
}

export async function getNewsletterAnalytics(start: string, end: string): Promise<{
  activeSubscribers: number;
  sends: { send_day: string; total: number; opened: number }[];
}> {
  return apiFetch(`/api/admin/analytics/newsletter${dateParams(start, end)}`);
}

export async function getContentAnalytics(start: string, end: string): Promise<{
  topPosts: { id: string; title: string; domain: string; upvotesCount: number; authorUsername: string }[];
  topUsers: { username: string; post_count: number; total_upvotes: number }[];
  topDomains: { domain: string; post_count: number; total_upvotes: number }[];
}> {
  return apiFetch(`/api/admin/analytics/content${dateParams(start, end)}`);
}

export async function getActivationFunnel(start: string, end: string): Promise<{
  totalUsers: number; posted: number; commented: number; upvoted: number;
  postedPct: number; commentedPct: number; upvotedPct: number;
}> {
  return apiFetch(`/api/admin/analytics/activation-funnel${dateParams(start, end)}`);
}

export async function getPageViewsAnalytics(start: string, end: string): Promise<{
  perDay: DayCount[]; topPaths: PathCount[];
}> {
  return apiFetch(`/api/admin/analytics/page-views${dateParams(start, end)}`);
}

export async function getLinkClicksAnalytics(start: string, end: string): Promise<{
  perDay: DayCount[]; topPosts: { post_id: string; title: string; click_count: number }[];
}> {
  return apiFetch(`/api/admin/analytics/link-clicks${dateParams(start, end)}`);
}

// ─── Scoring ───

export interface ScoringConfigData {
  gravity: number;
  boost: number;
  ageOffsetHours: number;
  recalcWindowHours: number;
}

export interface ScoringPost {
  id: string;
  title: string;
  upvotesCount: number;
  currentScore: number;
  publishedAt: string | null;
  createdAt: string;
  authorUsername: string;
}

export interface SimulatedPost extends ScoringPost {
  newScore: number;
  currentRank: number;
  newRank: number;
  rankChange: number;
}

export async function getScoringConfig(): Promise<{ config: ScoringConfigData; posts: ScoringPost[] }> {
  return apiFetch('/api/admin/scoring');
}

export async function simulateScoring(params: ScoringConfigData): Promise<{ posts: SimulatedPost[]; totalPosts: number }> {
  return apiFetch('/api/admin/scoring/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function applyScoring(params: ScoringConfigData): Promise<{ success: boolean; updated: number }> {
  return apiFetch('/api/admin/scoring/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}
