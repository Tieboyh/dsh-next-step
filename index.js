import { createPredictor } from './engine.js';
import { createPromptOptimizer, MAX_PROMPT_LENGTH } from './optimizer.js';

export const name = 'dsh-next-step';
export const inject = ['connection', 'sessions', 'llm'];

export function apply(ctx, options = {}) {
  const predictor = createPredictor(ctx, options);
  const optimizer = createPromptOptimizer(ctx, options);
  ctx.on('session/event', (session, event) => {
    predictor.observe(session, event);
    if (event.type === 'turn/start') optimizer.invalidate(session.id);
  });
  ctx.on('session/disposed', session => { predictor.invalidate(session.id); optimizer.invalidate(session.id); });
  ctx.effect(() => () => { predictor.dispose(); optimizer.dispose(); });
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
      let result;
      if (typeof sessionId !== 'string' || sessionId.length > 256) {
        result = { ok: false, error: { code: 'invalid-session', message: 'Invalid session', details: {} } };
      } else if (body.payload.action === 'optimize') {
        const draft = body.payload.draft;
        if (typeof draft !== 'string' || !draft.trim() || draft.length > MAX_PROMPT_LENGTH) {
          result = { ok: false, error: { code: 'invalid-prompt', message: 'Enter a prompt of at most 12000 characters', details: {} } };
        } else {
          try { result = { ok: true, value: await optimizer.optimize(sessionId, draft, request.signal) }; }
          catch { result = { ok: false, error: { code: 'optimize-failed', message: 'Could not optimize the prompt. Your original draft is unchanged.', details: {} } }; }
        }
      } else if (body.payload.action === undefined || body.payload.action === 'predict') {
        result = { ok: true, value: await predictor.predict(sessionId) };
      } else {
        result = { ok: false, error: { code: 'invalid-action', message: 'Unknown action', details: {} } };
      }
      return Response.json({ type: 'server-response', rpcId: body.rpcId, result });
    },
  });
}
