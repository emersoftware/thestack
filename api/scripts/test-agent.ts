/**
 * Test feed processing flows without touching the DB.
 *
 * Usage:
 *   npx tsx scripts/test-agent.ts --type rss   <url>         # Parse RSS, show entries (no AI)
 *   npx tsx scripts/test-agent.ts --type blog  <url>         # Fetch blog, run AI agent
 *   npx tsx scripts/test-agent.ts --type email <file-path>   # Read local file, run AI agent
 *
 * Examples:
 *   npx tsx scripts/test-agent.ts --type rss   https://www.ciperchile.cl/feed/
 *   npx tsx scripts/test-agent.ts --type blog  https://fintoc.com/cl/blog
 *   npx tsx scripts/test-agent.ts --type email ./test-email.html
 */

import { ChatGoogle } from '@langchain/google';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { SYSTEM_PROMPT, NEWSLETTER_TASK_PROMPT, BLOG_TASK_PROMPT } from '../src/lib/feed-agent';
import { FEED_BOT_USER_AGENT } from '../src/lib/utils';
import { parseRssFeed } from '../src/lib/rss-fetcher';
import { htmlToText } from '../src/lib/blog-fetcher';
import { extractLinks, extractLinksFromText } from '../src/lib/link-utils';

// ── Parse args ──────────────────────────────────────────────

const args = process.argv.slice(2);
const typeIdx = args.indexOf('--type');

if (typeIdx === -1 || !args[typeIdx + 1] || !args[typeIdx + 2]) {
  console.error('Usage: npx tsx scripts/test-agent.ts --type <rss|blog|email> <url-or-file>');
  process.exit(1);
}

const feedType = args[typeIdx + 1] as 'rss' | 'blog' | 'email';
const target = args[typeIdx + 2];

if (!['rss', 'blog', 'email'].includes(feedType)) {
  console.error('Invalid type. Use: rss, blog, or email');
  process.exit(1);
}

// ── Load API key (only for blog/email) ──────────────────────

function loadApiKey(): string {
  try {
    const devVars = readFileSync('.dev.vars', 'utf-8');
    const match = devVars.match(/^GOOGLE_API_KEY=(.+)$/m);
    if (!match) throw new Error('GOOGLE_API_KEY not found');
    return match[1].trim();
  } catch {
    console.error('Could not read GOOGLE_API_KEY from .dev.vars');
    process.exit(1);
  }
}

// ── AI Agent runner ─────────────────────────────────────────

const published: { title: string; url: string }[] = [];
const skipped: { url: string; reason: string }[] = [];

async function runAgent(systemPrompt: string, userMessage: string) {
  const apiKey = loadApiKey();

  const fetchUrlTool = tool(
    async ({ url }) => {
      try {
        console.log(`  📥 Fetching: ${url}`);
        const res = await fetch(url, {
          headers: { 'User-Agent': FEED_BOT_USER_AGENT },
          redirect: 'follow',
        });
        if (!res.ok) return `Error: HTTP ${res.status}`;
        const html = await res.text();
        return html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 4000);
      } catch (err) {
        return `Error: ${err}`;
      }
    },
    {
      name: 'fetch_url',
      description: 'Fetch a URL and extract its text content.',
      schema: z.object({ url: z.string().describe('The URL to fetch') }),
    }
  );

  const publishPostTool = tool(
    async ({ title, url }) => {
      published.push({ title, url });
      console.log(`  ✅ PUBLISH: "${title}" → ${url}`);
      return `Published: "${title}"`;
    },
    {
      name: 'publish_post',
      description: 'Mark a link as worth publishing on TheStack.',
      schema: z.object({
        title: z.string().describe('A concise title for the post'),
        url: z.string().describe('The URL to publish'),
      }),
    }
  );

  const skipTool = tool(
    async ({ url, reason }) => {
      skipped.push({ url, reason });
      console.log(`  ⏭️  SKIP: ${url} — ${reason}`);
      return `Skipped: ${url}`;
    },
    {
      name: 'skip',
      description: 'Skip a link not worth publishing.',
      schema: z.object({
        url: z.string().describe('The URL being skipped'),
        reason: z.string().describe('Brief reason for skipping'),
      }),
    }
  );

  const tools = [fetchUrlTool, publishPostTool, skipTool];
  const model = new ChatGoogle({
    model: 'gemini-3-flash-preview',
    apiKey,
  }).bindTools(tools);

  const messages: any[] = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userMessage),
  ];

  for (let i = 0; i < 10; i++) {
    const response = await model.invoke(messages);
    messages.push(response);
    if (!response.tool_calls || response.tool_calls.length === 0) break;
    for (const toolCall of response.tool_calls) {
      const fn = tools.find((t) => t.name === toolCall.name);
      if (!fn) continue;
      const result = await fn.invoke(toolCall.args);
      messages.push({ role: 'tool', content: result, tool_call_id: toolCall.id });
    }
  }
}

// ── Type handlers ───────────────────────────────────────────

async function handleRss(url: string) {
  console.log(`\n📡 Fetching RSS: ${url}\n`);
  const res = await fetch(url, { headers: { 'User-Agent': FEED_BOT_USER_AGENT } });
  if (!res.ok) { console.error(`Failed: HTTP ${res.status}`); process.exit(1); }
  const xml = await res.text();
  const entries = parseRssFeed(xml);

  console.log(`Found ${entries.length} entries:\n`);
  entries.forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.title}`);
    console.log(`     ${e.url}`);
    if (e.pubDate) console.log(`     📅 ${e.pubDate}`);
    console.log();
  });
}

async function handleBlog(url: string) {
  console.log(`\n🌐 Fetching blog: ${url}\n`);
  const res = await fetch(url, {
    headers: { 'User-Agent': FEED_BOT_USER_AGENT },
    redirect: 'follow',
  });
  if (!res.ok) { console.error(`Failed: HTTP ${res.status}`); process.exit(1); }
  const html = await res.text();
  const pageText = htmlToText(html).slice(0, 16000);

  console.log(`📄 Page text: ${pageText.length} chars`);
  console.log('─'.repeat(60));
  console.log('🤖 Running AI agent...\n');

  await runAgent(SYSTEM_PROMPT + '\n\n' + BLOG_TASK_PROMPT, pageText);
  printResults();
}

async function handleEmail(filePath: string) {
  console.log(`\n📧 Reading file: ${filePath}\n`);
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    console.error(`Could not read file: ${filePath}`);
    process.exit(1);
  }

  const links = extractLinks(content);
  if (links.length === 0) {
    const textLinks = extractLinksFromText(content);
    links.push(...textLinks);
  }

  let taskPrompt: string;
  let userMessage: string;

  if (links.length > 0) {
    console.log(`🔗 Found ${links.length} links\n`);
    links.forEach((l, i) => console.log(`  ${i + 1}. ${l}`));
    console.log();
    taskPrompt = NEWSLETTER_TASK_PROMPT;
    userMessage = links.map((l, i) => `${i + 1}. ${l}`).join('\n');
  } else {
    console.log('🔗 No links found, passing raw content to AI\n');
    taskPrompt = BLOG_TASK_PROMPT;
    userMessage = content.slice(0, 16000);
  }

  console.log('─'.repeat(60));
  console.log('🤖 Running AI agent...\n');
  await runAgent(SYSTEM_PROMPT + '\n\n' + taskPrompt, userMessage);
  printResults();
}

// ── Print results ───────────────────────────────────────────

function printResults() {
  console.log('\n' + '─'.repeat(60));
  console.log(`\n📊 Results: ${published.length} published, ${skipped.length} skipped\n`);

  if (published.length > 0) {
    console.log('✅ Published:');
    published.forEach((p) => console.log(`   "${p.title}"\n   → ${p.url}\n`));
  }
  if (skipped.length > 0) {
    console.log('⏭️  Skipped:');
    skipped.forEach((s) => console.log(`   ${s.url}\n   → ${s.reason}\n`));
  }
}

// ── Main ────────────────────────────────────────────────────

switch (feedType) {
  case 'rss':   handleRss(target).catch(console.error); break;
  case 'blog':  handleBlog(target).catch(console.error); break;
  case 'email': handleEmail(target).catch(console.error); break;
}
