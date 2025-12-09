import { Hono } from 'hono';
import { createAuth, type Env } from '../lib/auth';

const auth = new Hono<{ Bindings: Env }>();

auth.on(['GET', 'POST'], '/*', async (c) => {
  const authInstance = createAuth(c.env);
  return authInstance.handler(c.req.raw);
});

export default auth;
