import test from 'node:test';
import assert from 'node:assert/strict';
import { createPredictor, parseSuggestion, selectContext, lastTurn } from '../engine.js';
import { apply } from '../index.js';

const end = (turn = 1) => ({ type: 'turn/end', seq: turn * 3, data: { turn, reason: { kind: 'completed' } } });
function fixture(stream) {
  let calls = 0;
  const session = {
    id: 'test-session', snapshotEvents: () => [end()],
    deriveMessages: () => [{ role: 'user', content: [{ type: 'text', text: '帮我写排序函数' }] }, { role: 'assistant', content: [{ type: 'text', text: '排序函数已完成，还未测试。' }] }],
    requestContext: () => ({ provider: 'deepseek-account', model: 'test-model' }),
  };
  const ctx = { sessions: { get: id => id === session.id ? session : undefined }, llm: { stream: options => { calls++; return stream(options); } } };
  return { ctx, session, calls: () => calls };
}
async function* good(options) {
  assert.equal(options.provider, 'deepseek-account');
  assert.equal(options.tools, undefined);
  assert.equal(options.messages.length, 1);
  yield { type: 'text-delta', text: '{"suggestion":"帮我补上排序函数的边界测试。"}' };
  yield { type: 'finish', reason: { kind: 'stop' } };
}
test('bounded context excludes tool outputs, images, and reasoning', () => {
  const selected = selectContext([{ role: 'tool', content: [{ type: 'text', text: 'secret' }] }, { role: 'assistant', content: [{ type: 'reasoning', text: 'private' }, { type: 'text', text: 'a'.repeat(15000) }] }], 80);
  assert.equal(selected.length, 1); assert.equal(selected[0].text.length, 80);
});
test('parsing rejects malformed, oversized and non-string suggestions', () => {
  for (const raw of ['not json', '{"suggestion":1}', JSON.stringify({ suggestion: 'x'.repeat(281) })]) assert.equal(parseSuggestion(raw), '');
  assert.equal(parseSuggestion('```json\n{"suggestion":"继续测试。"}\n```'), '继续测试。');
});
test('completed-turn lookup rejects active and failed turns', () => {
  assert.equal(lastTurn({ snapshotEvents: () => [end(), { type: 'turn/start' }] }), null);
  assert.equal(lastTurn({ snapshotEvents: () => [{ ...end(), data: { reason: { kind: 'error' } } }] }), null);
});
test('same completed turn is single-flight and cached, no transcript writes', async () => {
  const f = fixture(good), p = createPredictor(f.ctx);
  const results = await Promise.all([p.predict(f.session.id), p.predict(f.session.id)]);
  assert.equal(f.calls(), 1); assert.equal(results[0].suggestion, '帮我补上排序函数的边界测试。');
  assert.deepEqual(await p.predict(f.session.id), results[0]); assert.equal(f.calls(), 1); p.dispose();
});
test('new turn aborts an in-flight result; completed new turn can generate', async () => {
  let aborted = false;
  const f = fixture(async function* (options) {
    await new Promise(resolve => options.signal.addEventListener('abort', () => { aborted = true; resolve(); }, { once: true }));
    yield { type: 'text-delta', text: '{"suggestion":"stale"}' }; yield { type: 'finish', reason: { kind: 'stop' } };
  });
  const p = createPredictor(f.ctx); const pending = p.predict(f.session.id);
  p.observe(f.session, { type: 'turn/start' });
  assert.equal((await pending).suggestion, ''); assert.equal(aborted, true);
  p.observe(f.session, { type: 'turn/end', seq: 6, data: { turn: 2, reason: { kind: 'error' } } });
  assert.equal((await p.predict(f.session.id)).revision, null); p.dispose();
});
test('failed, truncated, tool-calling and missing-route generations fail quietly', async () => {
  for (const reason of ['error', 'max-tokens', 'tool-calls']) {
    const f = fixture(async function* () { yield { type: 'text-delta', text: '{"suggestion":"do it"}' }; yield { type: 'finish', reason: { kind: reason } }; });
    const p = createPredictor(f.ctx); assert.equal((await p.predict(f.session.id)).suggestion, ''); p.dispose();
  }
  const f = fixture(good); f.session.requestContext = () => undefined;
  const p = createPredictor(f.ctx); assert.equal((await p.predict(f.session.id)).suggestion, ''); assert.equal(f.calls(), 0); p.dispose();
});
test('unloaded plugin aborts pending generation', async () => {
  const f = fixture(async function* (o) { await new Promise(r => o.signal.addEventListener('abort', r, { once: true })); yield { type: 'finish', reason: { kind: 'aborted' } }; });
  const p = createPredictor(f.ctx); const pending = p.predict(f.session.id); p.dispose();
  assert.equal((await pending).suggestion, '');
});
test('authenticated Fetch RPC registration and envelope work without webServer', async () => {
  const f = fixture(good); let route; const disposers = [];
  Object.assign(f.ctx, { on() {}, effect(fn) { disposers.push(fn()); }, connection: { fetch: { register(r) { route = r; } } } });
  apply(f.ctx);
  assert.equal(route.path, '/api/dsh-next-step');
  const response = await route.fetch(new Request('http://local/api/dsh-next-step', { method: 'POST', body: JSON.stringify({ type: 'client-request', rpcId: '1', method: 'dsh-next-step', payload: { sessionId: f.session.id } }) }));
  const body = await response.json(); assert.equal(body.rpcId, '1'); assert.equal(body.result.ok, true); assert.match(body.result.value.suggestion, /边界测试/);
  assert.equal((await route.fetch(new Request('http://local', { method: 'POST', body: '{}' }))).status, 400);
  for (const dispose of disposers) dispose?.();
});
