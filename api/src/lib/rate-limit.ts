import { eq, and, gte, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

const ONE_DAY = 24 * 60 * 60 * 1000;
const DAILY_PUBLISHED_LIMIT = 10;

export async function getPublishedTodayCount(
  db: DrizzleD1Database<typeof schema>,
  userId: string
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.posts)
    .where(
      and(
        eq(schema.posts.authorId, userId),
        gte(schema.posts.createdAt, new Date(Date.now() - ONE_DAY)),
        eq(schema.posts.status, 'published')
      )
    );

  return result?.count || 0;
}

export function isOverDailyLimit(count: number): boolean {
  return count >= DAILY_PUBLISHED_LIMIT;
}

export const RATE_LIMIT_ERROR = 'Has alcanzado el limite de 10 posts publicados por dia';
