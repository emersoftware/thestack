import { and, gte, lt } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { generateSlug } from './utils';
import * as schema from '../db/schema';

/**
 * generate a unique slug for a post
 * handles collisions by appending -2, -3, etc.
 */
export async function generateUniqueSlug(
  db: DrizzleD1Database<typeof schema>,
  title: string
): Promise<string> {
  const baseSlug = generateSlug(title);

  // Use range query instead of LIKE to avoid "pattern too complex" SQLite error
  // This finds all slugs that start with baseSlug by using range comparison
  const existingSlugs = await db
    .select({ slug: schema.posts.slug })
    .from(schema.posts)
    .where(
      and(
        gte(schema.posts.slug, baseSlug),
        lt(schema.posts.slug, baseSlug + '\uffff')
      )
    );

  const slugSet = new Set(
    existingSlugs.map((p) => p.slug).filter((s): s is string => s !== null)
  );

  if (!slugSet.has(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;
  while (slugSet.has(`${baseSlug}-${counter}`)) {
    counter++;
  }

  return `${baseSlug}-${counter}`;
}
