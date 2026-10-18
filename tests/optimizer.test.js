import test from 'node:test';
import assert from 'node:assert/strict';
import { createPromptOptimizer, parseOptimizedPrompt } from '../optimizer.js';
import { apply } from '../index.js';
function fixture(stream, live = true) {
  const requests = [];
  const session = { id: 'test', requestContext: () => ({ provider: 'deepseek-account', model: 'current' }) };
  return {
    requests,
    ctx: {
      sessions: { get: () => live ? session : undefined },
      get: () => ({ currentSelection: () => ({ provider: 'demo', model: 'initial' }) }),
      llm: { stream(options) { requests.push(options); return stream(options); } },
    },
  };
}
async function* good() {
  yield { type: 'text-delta', text: JSON.stringify({ prompt: '请实现任务的添加与删除。\n保持界面简洁。' }) };
  yield { type: 'finish', reason: { kind: 'stop' } };
}
test('optimization uses only the draft and no tools; preserves multiline output', async () => {
  const f = fixture(good), optimizer = createPromptOptimizer(f.ctx);
  const result = await optimizer.optimize('test', '添加删除任务，简洁点');
  assert.equal(result.prompt, '请实现任务的添加与删除。\n保持界面简洁。');
  assert.equal(f.requests[0].provider, 'deepseek-account'); assert.equal(f.requests[0].tools, undefined);
  assert.deepEqual(JSON.parse(f.requests[0].messages[0].content[0].text), { draft: '添加删除任务，简洁点' }); optimizer.dispose();
});
test('an unsent first prompt uses the configured default model', async () => {
  const f = fixture(good, false), optimizer = createPromptOptimizer(f.ctx);
  await optimizer.optimize('new-session', '写一个页面');
  assert.equal(f.requests[0].provider, 'demo'); assert.equal(f.requests[0].model, 'initial'); assert.equal(f.requests[0].sessionId, undefined); optimizer.dispose();
});
test('invalid drafts are refused before model calls; malformed or truncated output never replaces the draft', async () => {
  const f = fixture(good), optimizer = createPromptOptimizer(f.ctx);
  for (const draft of ['', '   ', 123, 'x'.repeat(12001)]) await assert.rejects(optimizer.optimize('test', draft), /invalid-prompt/);
  assert.equal(f.requests.length, 0); optimizer.dispose();
  assert.equal(parseOptimizedPrompt('{"prompt":3}'), ''); assert.equal(parseOptimizedPrompt('not json'), '');
  assert.equal(parseOptimizedPrompt(JSON.stringify({ prompt: 'x'.repeat(16001) })), '');
  const bad = fixture(async function* () { yield { type: 'text-delta', text: '{"prompt":"partial"}' }; yield { type: 'finish', reason: { kind: 'max-tokens' } }; });
  const p = createPromptOptimizer(bad.ctx); await assert.rejects(p.optimize('test','draft'), /incomplete-output/); p.dispose();
});
test('caller cancellation and plugin disposal abort pending optimization', async () => {
  for (const dispose of [false, true]) {
    const f = fixture(async function* (o) {
      await new Promise(r => o.signal.addEventListener('abort', r, { once: true }));
      yield { type: 'finish', reason: { kind: 'aborted' } };
    });
    const p = createPromptOptimizer(f.ctx), abort = new AbortController();
    const pending = p.optimize('test', 'draft', abort.signal);
    if (dispose) p.dispose(); else abort.abort();
    await assert.rejects(pending); assert.equal(f.requests[0].signal.aborted, true); p.dispose();
  }
});
test('RPC dispatches explicit optimization and rejects invalid actions and prompts', async () => {
  const f = fixture(good); let route; const disposers = [];
  Object.assign(f.ctx, { on() {}, effect(fn) { disposers.push(fn()); }, connection: { fetch: { register(r) { route = r; } } } }); apply(f.ctx);
  async function call(payload) {
    const response = await route.fetch(new Request('http://local/api/dsh-next-step', { method: 'POST', body: JSON.stringify({ type: 'client-request', rpcId: '1', method: 'dsh-next-step', payload }) }));
    return (await response.json()).result;
  }
  assert.match((await call({ sessionId: 'test', action: 'optimize', draft: '添加删除任务' })).value.prompt, /添加与删除/);
  assert.equal((await call({ sessionId: 'test', action: 'optimize', draft: '' })).error.code, 'invalid-prompt');
  assert.equal((await call({ sessionId: 'test', action: 'other' })).error.code, 'invalid-action');
  for (const dispose of disposers) dispose?.();
});
