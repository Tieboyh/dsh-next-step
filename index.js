import { createPredictor } from './engine.js';

export const name = 'dsh-next-step';
export const inject = ['connection', 'sessions', 'llm'];

export function apply(ctx, options = {}) {
  const predictor = createPredictor(ctx, options);
  ctx.on('session/event', (session, event) => predictor.observe(session, event));
  ctx.on('session/disposed', session => predictor.invalidate(session.id));
  ctx.effect(() => () => predictor.dispose());
  // Exact Fetch routes ride the native desktop IPC transport as well as HTTP.
  // The host Connection applies authentication and owner checks before dispatch.
  ctx.connection.fetch.register({
    path: '/api/dsh-next-step', methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      let body;
      try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
      if (body?.type !== 'client-request' || typeof body.rpcId !== 'string' || body.method !== 'dsh-next-step') {
        return new Response('Invalid request', { status: 400 });
      }
      const sessionId = body.payload?.sessionId;
      const result = typeof sessionId !== 'string' || sessionId.length > 256
        ? { ok: false, error: { code: 'invalid-session', message: 'Invalid session', details: {} } }
        : { ok: true, value: await predictor.predict(sessionId) };
      return Response.json({ type: 'server-response', rpcId: body.rpcId, result });
    },
  });
}
