import { PUBLIC_API_URL } from '$env/static/public';
import type { RequestHandler } from './$types';
import { ImageResponse } from '@ethercorps/sveltekit-og';

export const GET: RequestHandler = async ({ params }) => {
  const postRes = await fetch(`${PUBLIC_API_URL}/api/posts/${params.id}`);

  if (!postRes.ok) {
    return new Response('Post not found', { status: 404 });
  }

  const post = await postRes.json();
  const title = post.title || 'the stack';
  const domain = post.domain || '';
  const author = post.author?.username || '';

  const subtitle = [domain, author ? `@${author}` : ''].filter(Boolean).join(' - ');
  const logoBase64 = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MCA0MCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIj4KICA8ZGVmcz4KICAgIDxjbGlwUGF0aCBpZD0ibWFzayI+CiAgICAgIDxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcng9IjYiLz4KICAgIDwvY2xpcFBhdGg+CiAgPC9kZWZzPgogIDxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcng9IjYiIGZpbGw9IiMxNDE0MTQiLz4KICA8ZyBjbGlwLXBhdGg9InVybCgjbWFzaykiPgogICAgPHJlY3QgeD0iMiIgeT0iLTE2MSIgd2lkdGg9IjE1IiBoZWlnaHQ9IjEwIiByeD0iNCIgZmlsbD0iI2Y1ZjVmNSIvPjxyZWN0IHg9IjIiIHk9Ii0xNDkiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcng9IjQiIGZpbGw9IiNmNWY1ZjUiLz48cmVjdCB4PSIyIiB5PSItMTI3IiB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHJ4PSI0IiBmaWxsPSIjZjVmNWY1Ii8+PHJlY3QgeD0iMiIgeT0iLTk1IiB3aWR0aD0iMjAiIGhlaWdodD0iMzAiIHJ4PSI0IiBmaWxsPSIjZjVmNWY1Ii8+PHJlY3QgeD0iNyIgeT0iLTYzIiB3aWR0aD0iMTUiIGhlaWdodD0iMTMiIHJ4PSI0IiBmaWxsPSIjZjVmNWY1Ii8+PHJlY3QgeD0iNyIgeT0iLTQ4IiB3aWR0aD0iMTUiIGhlaWdodD0iNyIgcng9IjMuNSIgZmlsbD0iI2Y1ZjVmNSIvPjxyZWN0IHg9IjciIHk9Ii0zOSIgd2lkdGg9IjE1IiBoZWlnaHQ9IjciIHJ4PSIzLjUiIGZpbGw9IiNmNWY1ZjUiLz48cmVjdCB4PSI3IiB5PSItMzAiIHdpZHRoPSIxNSIgaGVpZ2h0PSI3IiByeD0iMy41IiBmaWxsPSIjZjVmNWY1Ii8+PHJlY3QgeD0iMiIgeT0iLTIxIiB3aWR0aD0iMjAiIGhlaWdodD0iMTMiIHJ4PSI0IiBmaWxsPSIjZjVmNWY1Ii8+PHJlY3QgeD0iMiIgeT0iLTYiIHdpZHRoPSIyMCIgaGVpZ2h0PSI2IiByeD0iMyIgZmlsbD0iI2Y1ZjVmNSIvPjxyZWN0IHg9IjIiIHk9IjIiIHdpZHRoPSIyMCIgaGVpZ2h0PSI2IiByeD0iMyIgZmlsbD0iI2Y1ZjVmNSIvPjxyZWN0IHg9IjIiIHk9IjEwIiB3aWR0aD0iMjAiIGhlaWdodD0iOSIgcng9IjQiIGZpbGw9IiNmNWY1ZjUiLz48cmVjdCB4PSIyIiB5PSIyMSIgd2lkdGg9IjIwIiBoZWlnaHQ9IjYiIHJ4PSIzIiBmaWxsPSIjZjVmNWY1Ii8+PHJlY3QgeD0iMiIgeT0iMjkiIHdpZHRoPSIyMCIgaGVpZ2h0PSIzMCIgcng9IjQiIGZpbGw9IiNmNWY1ZjUiLz48cmVjdCB4PSIyIiB5PSI2MSIgd2lkdGg9IjIwIiBoZWlnaHQ9IjMwIiByeD0iNCIgZmlsbD0iI2Y1ZjVmNSIvPjxyZWN0IHg9IjciIHk9IjkzIiB3aWR0aD0iMzEiIGhlaWdodD0iMzEiIHJ4PSI0IiBmaWxsPSIjZjVmNWY1Ii8+CiAgPC9nPgo8L3N2Zz4=';

  const html = `<div style="display: flex; flex-direction: column; width: 100%; height: 100%; background-color: #f5f5f5; padding: 60px; justify-content: space-between;">
  <div style="display: flex; align-items: center;">
    <img src="${logoBase64}" width="50" height="50" />
    <span style="margin-left: 16px; font-size: 32px; font-weight: 600; color: #141414;">the stack</span>
  </div>
  <span style="font-size: 48px; font-weight: 700; color: #141414; text-align: center;">${escapeHtml(title)}</span>
  <span style="font-size: 24px; color: #666666; text-align: center;">${escapeHtml(subtitle)}</span>
</div>`;

  return new ImageResponse(html, {
    width: 1200,
    height: 630
  });
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
