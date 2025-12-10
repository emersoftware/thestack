import { PUBLIC_API_URL } from '$env/static/public';
import type { RequestHandler } from './$types';
import { ImageResponse } from '@ethercorps/sveltekit-og';

export const GET: RequestHandler = async ({ params, fetch }) => {
  const postRes = await fetch(`${PUBLIC_API_URL}/api/posts/${params.id}`);

  if (!postRes.ok) {
    return new Response('Post not found', { status: 404 });
  }

  const post = await postRes.json();
  const title = post.title || 'the stack';
  const domain = post.domain || '';
  const author = post.author?.username || '';

  const html = `
    <div style="display: flex; flex-direction: column; width: 100%; height: 100%; background-color: #f5f5f5; padding: 60px;">
      <div style="display: flex; align-items: center; margin-bottom: 40px;">
        <div style="display: flex; flex-direction: column; width: 60px; height: 60px; background-color: #141414; border-radius: 9px; padding: 3px; gap: 3px;">
          <div style="width: 30px; height: 9px; background-color: #f5f5f5; border-radius: 4.5px;"></div>
          <div style="width: 30px; height: 9px; background-color: #f5f5f5; border-radius: 4.5px;"></div>
          <div style="width: 30px; height: 13px; background-color: #f5f5f5; border-radius: 6px;"></div>
          <div style="width: 30px; height: 20px; background-color: #f5f5f5; border-radius: 6px;"></div>
        </div>
        <span style="margin-left: 20px; font-size: 32px; font-weight: 600; color: #141414;">the stack</span>
      </div>

      <div style="display: flex; flex: 1; justify-content: center; align-items: center;">
        <h1 style="font-size: 56px; font-weight: 700; color: #141414; text-align: center; margin: 0; max-width: 1000px; overflow-wrap: break-word;">${escapeHtml(title)}</h1>
      </div>

      <div style="display: flex; justify-content: center;">
        <span style="font-size: 24px; color: #666666;">${domain ? escapeHtml(domain) : ''}${domain && author ? ' · ' : ''}${author ? '@' + escapeHtml(author) : ''}</span>
      </div>
    </div>
  `;

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
