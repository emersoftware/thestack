import { ChatGoogle } from '@langchain/google';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { Feed } from '../db/schema';
import { escapeHtml, FEED_BOT_USER_AGENT, safeFetch, classifyFetchError } from './utils';
import { createFeedPosts, sendPendingPostsNotification } from './post-creator';
import { cleanUrl } from './link-utils';
import type { Env } from './auth';

import type { FeedPostEntry } from './post-creator';
type PublishAction = FeedPostEntry;

interface SkipAction {
  url: string;
  reason: string;
}

export const SYSTEM_PROMPT = `You are a content curator for TheStack, a Latin American community for intellectually curious people.

## What is TheStack?
A feed for sharing things that spark intellectual curiosity and drive the tech industry in Latin America. Think of it like Hacker News for Latam.

## What belongs on TheStack?
Blog posts, tools, papers, side projects, interesting threads, news, meetups, job offers — anything genuinely interesting. Not limited to tech: science, design, economics, philosophy, startups, open source, essays, research are all welcome.

The bar is: would a thoughtful, intellectually curious person find this genuinely interesting or learn something from it?

## What does NOT belong?
- Politics, celebrity gossip, sports, TV news
- Generic landing pages, product marketing pages, or company "about us" pages
- Ads, tracking/unsubscribe links, pages with no substantial content
- Product announcements that are just marketing ("we launched X!") without technical depth or insight
- Pages that are primarily promotional rather than informative or educational

## How to evaluate content:
1. Fetch each link to understand what it is.
2. Ask yourself: does this teach something, share an insight, or present something genuinely novel? If yes, publish it. If it's just marketing, a product page, or shallow content, skip it.
3. When publishing, use the original title. Do not editorialize, use ALL CAPS, or add hype words. If the original title is clickbait, rewrite it to be descriptive.
4. When skipping, give a brief reason.

## Examples of good content:
- A blog post explaining how a company solved a hard technical problem
- A research paper or essay with original thinking
- An open source tool with a clear use case
- A deep dive into an industry trend with data or analysis

## Examples of content to SKIP:
- "Meet our new feature X" (pure product marketing)
- "Company Y raises $10M" (unless there's real insight into the business)
- A landing page for a product with no blog content
- Navigation links, contact pages, "about us" pages
- Changelog or release notes without interesting technical context

Process ALL links. Be highly selective — quality over quantity.

## Available tools
You have three tools:
- **fetch_url**: Fetches a URL and returns its text content. ALWAYS use this to read each link before deciding — never publish or skip without reading the content first.
- **publish_post**: Marks a link as worth publishing. Provide a concise title and the URL.
- **skip**: Marks a link as not worth publishing. Provide the URL and a brief reason.`;

export function generatePendingEmailHtml(
  userName: string,
  feedName: string,
  postTitles: string[],
  username: string,
): string {
  const count = postTitles.length;
  const postCards = postTitles
    .map(
      (title) => `
      <tr>
        <td style="padding: 12px 16px; background: #fafafa; border-radius: 12px; border: 1px solid #e5e5e5;">
          <span style="color: #141414; font-size: 15px; font-weight: 500; line-height: 1.4;">
            ${escapeHtml(title)}
          </span>
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
      <title>Posts pendientes - the stack</title>
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
                        <img src="https://thestack.cl/icon.png" alt="the stack" width="36" height="36" style="display: block; border-radius: 6px;" />
                      </td>
                      <td style="vertical-align: middle;">
                        <h1 style="color: #141414; font-size: 18px; font-weight: 400; margin: 0;">
                          Posts pendientes en <strong>the stack</strong>
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
                    Hola ${escapeHtml(userName)}, tu feed <strong>${escapeHtml(feedName)}</strong> proces&oacute; ${count} ${count === 1 ? 'post' : 'posts'} que ${count === 1 ? 'requiere' : 'requieren'} tu aprobaci&oacute;n:
                  </p>
                </td>
              </tr>

              <!-- Post cards -->
              ${postCards}

              <!-- CTA -->
              <tr>
                <td style="padding-top: 16px; padding-bottom: 28px; text-align: center;">
                  <a href="https://thestack.cl/user/${encodeURIComponent(username)}/pending" style="display: inline-block; background: transparent; color: #141414; padding: 8px 16px; text-decoration: none; border-radius: 9999px; font-weight: 500; font-size: 14px; border: 1px solid #e5e5e5;">
                    Revisar posts pendientes
                  </a>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="border-top: 1px solid #e5e5e5; padding-top: 20px;">
                  <p style="color: #a3a3a3; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                    Recibiste este email porque tienes feeds activos en the stack.<br />
                    <a href="https://thestack.cl/settings" style="color: #737373;">Gestionar feeds</a>
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

export const NEWSLETTER_TASK_PROMPT = `## Your task
You will receive a list of links extracted from a newsletter. For each link:
1. Use fetch_url to read its content — NEVER decide without reading first.
2. Based on the content, use publish_post or skip.
Process every link in the list.`;

export const BLOG_TASK_PROMPT = `## Your task
You will receive the text content of a blog page. Your job:
1. Find URLs in the text that look like blog post entries (not navigation, footer, contact, or "about" links).
2. For each blog post URL you find, use fetch_url to read the actual content.
3. Based on the content you read, use publish_post if it has substance — technical insights, interesting stories, useful knowledge. Use skip only for pure marketing fluff, landing pages, or pages with no real content.
When in doubt, publish — the user will review pending posts and can reject what doesn't fit.`;

export async function runFeedAgent(
  links: string[],
  feed: Feed,
  logId: string,
  env: Env,
  rawBody?: string
) {
  const db = drizzle(env.DB, { schema });
  const publishActions: PublishAction[] = [];
  const skipActions: SkipAction[] = [];

  // Track resolved URLs: original URL -> final destination after redirects
  const resolvedUrls = new Map<string, string>();

  // Define tools
  const fetchUrlTool = tool(
    async ({ url }) => {
      try {
        const { response, finalUrl } = await safeFetch(url, {
          headers: { 'User-Agent': FEED_BOT_USER_AGENT },
          timeoutMs: 10_000,
        });

        if (finalUrl !== url) {
          resolvedUrls.set(url, cleanUrl(finalUrl));
        }

        const html = await response.text();
        // Extract text content, strip tags, truncate
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 4000);

        return text || 'No content found';
      } catch (err) {
        return `Error fetching ${url}: ${classifyFetchError(err)}`;
      }
    },
    {
      name: 'fetch_url',
      description: 'Fetch a URL and extract its text content. ALWAYS use this to read each link before deciding to publish or skip — never decide without reading the content first.',
      schema: z.object({ url: z.string().describe('The URL to fetch') }),
    }
  );

  const publishPostTool = tool(
    async ({ title, url }) => {
      // Use resolved URL if the original was a redirect/tracking URL
      const finalUrl = resolvedUrls.get(url) || cleanUrl(url);
      publishActions.push({ title, url: finalUrl });
      return `Marked for publishing: "${title}" (${finalUrl})`;
    },
    {
      name: 'publish_post',
      description: 'Mark a link as worth publishing on TheStack. Use a concise, descriptive title.',
      schema: z.object({
        title: z.string().describe('A concise title for the post'),
        url: z.string().describe('The URL to publish'),
      }),
    }
  );

  const skipTool = tool(
    async ({ url, reason }) => {
      skipActions.push({ url, reason });
      return `Skipped: ${url} — ${reason}`;
    },
    {
      name: 'skip',
      description: 'Skip a link that is not worth publishing. Provide a brief reason.',
      schema: z.object({
        url: z.string().describe('The URL being skipped'),
        reason: z.string().describe('Brief reason for skipping'),
      }),
    }
  );

  const tools = [fetchUrlTool, publishPostTool, skipTool];

  const model = new ChatGoogle({
    model: 'gemini-3-flash-preview',
    apiKey: env.GOOGLE_API_KEY,
  }).bindTools(tools);

  // Build system prompt with source-specific instructions
  let systemPrompt = SYSTEM_PROMPT;
  let userMessage: string;

  if (links.length > 0) {
    systemPrompt += '\n\n' + NEWSLETTER_TASK_PROMPT;
    userMessage = links.map((l, i) => `${i + 1}. ${l}`).join('\n');
  } else if (rawBody) {
    systemPrompt += '\n\n' + BLOG_TASK_PROMPT;
    userMessage = rawBody;
  } else {
    return;
  }

  const messages: any[] = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userMessage),
  ];

  // Max 10 iterations to prevent infinite loops
  for (let i = 0; i < 10; i++) {
    const response = await model.invoke(messages);
    messages.push(response);

    if (!response.tool_calls || response.tool_calls.length === 0) {
      break;
    }

    // Execute tool calls
    for (const toolCall of response.tool_calls) {
      const toolMap: Record<string, any> = {
        fetch_url: fetchUrlTool,
        publish_post: publishPostTool,
        skip: skipTool,
      };

      const selectedTool = toolMap[toolCall.name];
      if (selectedTool) {
        const result = await selectedTool.invoke(toolCall.args);
        messages.push({
          role: 'tool',
          content: result,
          tool_call_id: toolCall.id,
        });
      }
    }
  }

  // Post-processing: create posts for each publish action
  const result = await createFeedPosts(db, feed, publishActions);

  // Update feed log and feed lastProcessedAt atomically
  const now = new Date();
  await db.batch([
    db.update(schema.feedLogs)
      .set({ status: 'completed' })
      .where(eq(schema.feedLogs.id, logId)),
    db.update(schema.feeds)
      .set({ lastProcessedAt: now, updatedAt: now })
      .where(eq(schema.feeds.id, feed.id)),
  ]);

  // Send email notification for pending posts
  if (result.pendingTitles.length > 0) {
    await sendPendingPostsNotification(db, env, feed, result.pendingTitles);
  }
}
