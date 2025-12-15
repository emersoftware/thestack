import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import { and, eq, gte, desc } from 'drizzle-orm';
import { Resend } from 'resend';
import * as schema from '../db/schema';
import type { Env } from './auth';

interface NewsletterPost {
  title: string;
  url: string;
  domain: string;
  upvotesCount: number;
}

interface NewsletterSubscriber {
  email: string;
  name: string;
}

/**
 * Rotating subject lines for variety
 */
const NEWSLETTER_SUBJECTS = [
  'A hombros de gigantes',
  'La mejor forma de predecir el futuro es construirlo',
  'Save the internet',
  'Think different',
  'Move fast and break things',
];

/**
 * Get the subject line for the current week (rotates through the array)
 */
export function getWeeklySubject(): string {
  const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const quote = NEWSLETTER_SUBJECTS[weekNum % NEWSLETTER_SUBJECTS.length];
  return `${quote} - La ultima semana en the stack`;
}

/**
 * Get the top 5 most upvoted posts from the last 7 days
 */
export async function getWeeklyTopPosts(
  db: DrizzleD1Database<typeof schema>,
  limit = 5
): Promise<NewsletterPost[]> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const posts = await db
    .select({
      title: schema.posts.title,
      url: schema.posts.url,
      domain: schema.posts.domain,
      upvotesCount: schema.posts.upvotesCount,
    })
    .from(schema.posts)
    .where(
      and(
        gte(schema.posts.createdAt, weekAgo),
        eq(schema.posts.isDeleted, false)
      )
    )
    .orderBy(desc(schema.posts.upvotesCount))
    .limit(limit);

  return posts;
}

/**
 * Get all users who are eligible to receive the newsletter
 * - Email verified
 * - Newsletter enabled
 * - Not banned
 */
export async function getNewsletterSubscribers(
  db: DrizzleD1Database<typeof schema>
): Promise<NewsletterSubscriber[]> {
  const subscribers = await db
    .select({
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.emailVerified, true),
        eq(schema.users.newsletterEnabled, true),
        eq(schema.users.isBanned, false)
      )
    );

  return subscribers;
}

/**
 * Generate the HTML content for the newsletter email
 */
export function generateNewsletterHTML(posts: NewsletterPost[], frontendUrl: string): string {
  const postCards = posts
    .map(
      (post) => `
      <tr>
        <td class="post-card" style="padding: 12px 16px; background: #fafafa; border-radius: 12px; border: 1px solid #e5e5e5;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="vertical-align: middle;">
                <a class="post-title" href="${post.url}" style="color: #141414; font-size: 15px; font-weight: 500; text-decoration: none; line-height: 1.4;">
                  ${escapeHtml(post.title)}
                </a>
              </td>
              <td style="vertical-align: middle; text-align: right; padding-left: 12px; white-space: nowrap;">
                <a class="domain-badge" href="${frontendUrl}/site/${post.domain}" style="display: inline-block; padding: 2px 8px; font-size: 10px; color: #a3a3a3; text-decoration: none; border: 1px solid #e5e5e5; border-radius: 12px;">
                  ${post.domain.length > 15 ? post.domain.substring(0, 15) + '...' : post.domain}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="height: 10px;"></td></tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Los m&aacute;s votados de la semana - the stack</title>
      <style>
        .post-card { transition: border-color 0.15s ease; }
        .post-card:hover { border-color: #a3a3a3 !important; }
        .post-title { transition: color 0.15s ease; }
        .post-title:hover { color: #525252 !important; }
        .domain-badge { transition: border-color 0.15s ease, color 0.15s ease; }
        .domain-badge:hover { border-color: #a3a3a3 !important; color: #525252 !important; }
        .btn-link { transition: color 0.15s ease; }
        .btn-link:hover { color: #141414 !important; }
        .btn-outline { transition: border-color 0.15s ease; }
        .btn-outline:hover { border-color: #a3a3a3 !important; }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #fafafa;">
        <tr>
          <td align="center" style="padding: 40px 16px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 480px;">
              <!-- Header -->
              <tr>
                <td style="padding-bottom: 24px;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="vertical-align: middle; padding-right: 12px;">
                        <img src="${frontendUrl}/icon.png" alt="the stack" width="36" height="36" style="display: block; border-radius: 6px;" />
                      </td>
                      <td style="vertical-align: middle;">
                        <h1 style="color: #141414; font-size: 18px; font-weight: 400; margin: 0;">
                          Los m&aacute;s votados en <strong>the stack</strong>
                        </h1>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Intro text -->
              <tr>
                <td style="padding-bottom: 20px;">
                  <p style="color: #525252; font-size: 14px; line-height: 1.5; margin: 0;">
                    Esto te puede gustar:
                  </p>
                </td>
              </tr>

              <!-- Post cards -->
              ${postCards}

              <!-- CTA -->
              <tr>
                <td style="padding-top: 16px; padding-bottom: 28px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <a class="btn-link" href="${frontendUrl}" style="color: #737373; font-size: 14px; text-decoration: none; margin-right: 16px;">
                          ver m&aacute;s
                        </a>
                        <a class="btn-outline" href="${frontendUrl}/submit" style="display: inline-block; background: transparent; color: #141414; padding: 8px 16px; text-decoration: none; border-radius: 9999px; font-weight: 500; font-size: 14px; border: 1px solid #e5e5e5;">
                          publicar
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="border-top: 1px solid #e5e5e5; padding-top: 20px;">
                  <p style="color: #a3a3a3; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                    Recibiste este email porque est&aacute;s suscrito al newsletter de the stack.<br />
                    <a href="${frontendUrl}/settings" style="color: #737373;">Gestionar preferencias</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Helper function to escape HTML entities
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

/**
 * Helper function to split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Main function to send the weekly newsletter
 */
export async function sendWeeklyNewsletter(
  env: Env
): Promise<{ sent: number; errors: number }> {
  const db = drizzle(env.DB, { schema });
  const resend = new Resend(env.RESEND_API_KEY);

  let totalSent = 0;
  let totalErrors = 0;

  try {
    // Get top 5 posts from the week
    const posts = await getWeeklyTopPosts(db);

    if (posts.length === 0) {
      console.log('[Newsletter] No posts from this week, skipping newsletter');
      return { sent: 0, errors: 0 };
    }

    // Get eligible subscribers
    const subscribers = await getNewsletterSubscribers(db);

    if (subscribers.length === 0) {
      console.log('[Newsletter] No eligible subscribers, skipping newsletter');
      return { sent: 0, errors: 0 };
    }

    console.log(
      `[Newsletter] Sending to ${subscribers.length} subscribers with ${posts.length} posts`
    );

    // Generate email HTML and subject
    const emailHtml = generateNewsletterHTML(posts, env.FRONTEND_URL);
    const subject = getWeeklySubject();

    console.log(`[Newsletter] Using subject: "${subject}"`);

    // Split subscribers into chunks of 100 for batch sending
    const BATCH_SIZE = 100;
    const chunks = chunkArray(subscribers, BATCH_SIZE);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      try {
        const batchEmails = chunk.map((subscriber) => ({
          from: 'the stack <hola@thestack.cl>',
          to: [subscriber.email],
          subject,
          html: emailHtml,
        }));

        const result = await resend.batch.send(batchEmails);
        console.log('[Newsletter] Resend response:', JSON.stringify(result, null, 2));

        if (result.error) {
          throw new Error(result.error.message);
        }

        totalSent += chunk.length;
        console.log(
          `[Newsletter] Batch ${i + 1}/${chunks.length}: sent ${chunk.length} emails`
        );
      } catch (error) {
        totalErrors += chunk.length;
        console.error(`[Newsletter] Batch ${i + 1}/${chunks.length} failed:`, error);
      }

      // Small delay between batches to respect rate limits (2 req/sec)
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(
      `[Newsletter] Completed: ${totalSent} sent, ${totalErrors} errors`
    );
  } catch (error) {
    console.error('[Newsletter] Fatal error:', error);
  }

  return { sent: totalSent, errors: totalErrors };
}
