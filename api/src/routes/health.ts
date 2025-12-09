import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

const health = new Hono<{ Bindings: Bindings }>();

health.get('/', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT 1 as ok').first();

    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: result ? 'connected' : 'no result',
      version: '0.1.0',
    });
  } catch (error) {
    return c.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default health;
