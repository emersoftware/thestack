import { ChatGoogle } from '@langchain/google';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { Feed } from '../db/schema';
import { extractDomain, generateId, calculateHNScore } from './utils';
import { generateUniqueSlug } from './slug';
import { Resend } from 'resend';
import type { Env } from './auth';

interface PublishAction {
  title: string;
  url: string;
}

interface SkipAction {
  url: string;
  reason: string;
}

const SYSTEM_PROMPT = `You are a content curator for TheStack, a Latin American community for intellectually curious people.

TheStack is a feed for sharing things that spark intellectual curiosity — blog posts, tools, papers, side projects, interesting threads, news, meetups, job offers, and more. It is NOT limited to tech. Anything genuinely interesting is welcome: science, design, economics, philosophy, startups, open source, essays, research.

What does NOT belong: politics, celebrity gossip, sports, TV news, generic landing pages, ads, tracking/unsubscribe links, or pages with no substantial content.

You receive links extracted from a newsletter. For each link:
1. Fetch it to understand what it is.
2. If it has genuinely interesting content worth sharing, use publish_post with a concise, descriptive title. Use the original title when possible. Do not editorialize, use ALL CAPS, or add hype words.
3. If it is not worth sharing, use skip with a brief reason.

Process ALL links. Be selective — only publish content that would spark curiosity in a thoughtful reader.`;

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

  // Define tools
  const fetchUrlTool = tool(
    async ({ url }) => {
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'TheStack-FeedBot/1.0' },
          redirect: 'follow',
        });

        if (!response.ok) {
          return `Error fetching ${url}: HTTP ${response.status}`;
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
        return `Error fetching ${url}: ${String(err)}`;
      }
    },
    {
      name: 'fetch_url',
      description: 'Fetch a URL and extract its main text content. Use this to read articles and determine if they are worth publishing.',
      schema: z.object({ url: z.string().describe('The URL to fetch') }),
    }
  );

  const publishPostTool = tool(
    async ({ title, url }) => {
      publishActions.push({ title, url });
      return `Marked for publishing: "${title}" (${url})`;
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
    model: 'gemini-2.5-flash',
    apiKey: env.GOOGLE_API_KEY,
    temperature: 0.3,
  }).bindTools(tools);

  // Run agent loop
  let userMessage: string;
  if (links.length > 0) {
    const linksText = links.map((l, i) => `${i + 1}. ${l}`).join('\n');
    userMessage = `Aqui estan los links extraidos de un newsletter. Procesa cada uno:\n\n${linksText}`;
  } else if (rawBody) {
    userMessage = `No pude extraer links del email. Aqui esta el contenido completo del email. Extrae las URLs que encuentres, visita las que parezcan relevantes, y usa publish_post o skip segun corresponda:\n\n${rawBody}`;
  } else {
    return;
  }

  const messages: any[] = [
    new SystemMessage(SYSTEM_PROMPT),
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
  let published = 0;
  let skipped = skipActions.length;

  for (const action of publishActions) {
    try {
      // Check for duplicate URL
      const [existing] = await db
        .select({ id: schema.posts.id })
        .from(schema.posts)
        .where(eq(schema.posts.url, action.url))
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      const domain = extractDomain(action.url);
      if (!domain) {
        skipped++;
        continue;
      }

      const slug = await generateUniqueSlug(db, action.title);
      const now = new Date();
      const postId = generateId();
      const isAutoPublish = feed.autoPublish;
      const initialScore = isAutoPublish ? calculateHNScore(1, now) : 0;

      if (isAutoPublish) {
        await db.batch([
          db.insert(schema.posts).values({
            id: postId,
            title: action.title,
            slug,
            url: action.url,
            domain,
            authorId: feed.userId,
            upvotesCount: 1,
            score: initialScore,
            isDeleted: false,
            source: 'feed',
            feedId: feed.id,
            status: 'published',
            createdAt: now,
            updatedAt: now,
          }),
          db.insert(schema.postUpvotes).values({
            id: generateId(),
            postId,
            userId: feed.userId,
            createdAt: now,
          }),
          db.update(schema.users)
            .set({ karma: sql`${schema.users.karma} + 1` })
            .where(eq(schema.users.id, feed.userId)),
        ]);
      } else {
        await db.insert(schema.posts).values({
          id: postId,
          title: action.title,
          slug,
          url: action.url,
          domain,
          authorId: feed.userId,
          upvotesCount: 0,
          score: 0,
          isDeleted: false,
          source: 'feed',
          feedId: feed.id,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        });
      }

      published++;
    } catch (err) {
      console.error(`[Feed Agent] Error publishing ${action.url}:`, err);
      skipped++;
    }
  }

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
  if (published > 0 && !feed.autoPublish) {
    try {
      const [user] = await db
        .select({
          email: schema.users.email,
          name: schema.users.name,
          username: schema.users.username,
        })
        .from(schema.users)
        .where(eq(schema.users.id, feed.userId))
        .limit(1);

      if (user?.email) {
        const postTitles = publishActions.map((a) => a.title);
        const listHtml = postTitles
          .map((t) => `<li>${t}</li>`)
          .join('');

        const resend = new Resend(env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'The Stack <noreply@thestack.cl>',
          to: user.email,
          subject: `Tienes ${published} ${published === 1 ? 'post pendiente' : 'posts pendientes'} del feed "${feed.name}"`,
          html: `
            <p>Hola ${user.name || user.username},</p>
            <p>Tu feed <strong>${feed.name}</strong> proceso ${published} ${published === 1 ? 'post' : 'posts'} que ${published === 1 ? 'requiere' : 'requieren'} tu aprobacion:</p>
            <ul>${listHtml}</ul>
            <p><a href="https://thestack.cl/user/${user.username}/pending">Revisar posts pendientes</a></p>
          `,
        });
      }
    } catch (err) {
      console.error('[Feed Agent] Error sending pending notification email:', err);
    }
  }
}
