import test from 'node:test';
import assert from 'node:assert/strict';
import { createPromptOptimizer, parseOptimizedPrompt, optimizationFailure } from '../optimizer.js';
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
  const p = createPromptOptimizer(bad.ctx); await assert.rejects(p.optimize('test','draft'), /output-truncated/); p.dispose();
});

test('provider failures preserve useful status while excluding raw error text and request data', () => {
  for (const [status, code] of [[401, 'authentication-failed'], [403, 'authentication-failed'], [429, 'rate-limited'], [503, 'service-unavailable'], [400, 'request-rejected']]) {
    const error = new Error('secret token / private draft / https://private-service');
    error.cause = { status, request: { headers: { authorization: 'secret' } } };
    assert.deepEqual(optimizationFailure(error), { code, message: code, details: { status } });
  }
  const network = new Error('private host'); network.cause = { code: 'ECONNREFUSED' };
  assert.equal(optimizationFailure(network).code, 'network-error');
  const cycle = new Error('secret'); cycle.cause = cycle;
  assert.deepEqual(optimizationFailure(cycle), { code: 'request-failed', message: 'request-failed', details: {} });
});

test('missing model, empty output, invalid JSON and incomplete streams remain distinguishable', async () => {
  const missing = fixture(good, false); missing.ctx.get = () => undefined;
  await assert.rejects(createPromptOptimizer(missing.ctx).optimize('new', 'draft'), { code: 'missing-model' });
  for (const [text, finish, expected] of [['', 'stop', 'empty-output'], ['not json', 'stop', 'invalid-output'], ['{"prompt":"draft"}', undefined, 'incomplete-output']]) {
    const f = fixture(async function* () {
      yield { type: 'text-delta', text };
      if (finish) yield { type: 'finish', reason: { kind: finish } };
    });
    const optimizer = createPromptOptimizer(f.ctx);
    await assert.rejects(optimizer.optimize('test', 'draft'), { code: expected });
    optimizer.dispose();
  }
});

test('timeout is distinguished from cancellation, including a provider returning after abort', async () => {
  const f = fixture(async function* (o) {
    await new Promise(resolve => o.signal.addEventListener('abort', resolve, { once: true }));
    yield* good();
  });
  const optimizer = createPromptOptimizer(f.ctx, { timeoutMs: 1000 });
  await assert.rejects(optimizer.optimize('test', 'draft'), error => {
    assert.deepEqual(optimizationFailure(error), { code: 'timeout', message: 'timeout', details: { timeoutMs: 1000 } });
    return true;
  });
  optimizer.dispose();
  const cancelled = createPromptOptimizer(f.ctx), abort = new AbortController();
  const pending = cancelled.optimize('test', 'draft', abort.signal); abort.abort();
  await assert.rejects(pending, { code: 'cancelled' }); cancelled.dispose();
});

test('RPC forwards classified failures without private provider details', async () => {
  const f = fixture(async function* () {
    const error = new Error('secret API key and private draft'); error.status = 401; throw error;
  });
  let route; const disposers = [];
  Object.assign(f.ctx, { on() {}, effect(fn) { disposers.push(fn()); }, connection: { fetch: { register(r) { route = r; } } } });
  apply(f.ctx);
  const response = await route.fetch(new Request('http://local/api/dsh-next-step', {
    method: 'POST', body: JSON.stringify({ type: 'client-request', rpcId: 'failure', method: 'dsh-next-step', payload: { sessionId: 'test', action: 'optimize', draft: 'private draft' } }),
  }));
  assert.deepEqual(await response.json(), { type: 'server-response', rpcId: 'failure', result: { ok: false, error: { code: 'authentication-failed', message: 'authentication-failed', details: { status: 401 } } } });
  for (const dispose of disposers) dispose?.();
});

test('actual DSH terminal failure chunks retain their classification and never use partial output', async () => {
  for (const [code, expected] of [
    ['AUTH', 'authentication-failed'], ['MISSING_CREDENTIAL', 'authentication-failed'],
    ['INVALID_CREDENTIAL', 'authentication-failed'], ['QUOTA', 'quota-exceeded'],
    ['ACCOUNT_QUOTA', 'quota-exceeded'], ['RATE_LIMIT', 'rate-limited'],
    ['NO_ADAPTER', 'missing-model'], ['UNKNOWN_MODEL', 'missing-model'],
    ['UNKNOWN_PROVIDER', 'missing-model'], ['INVALID_CONFIG', 'missing-model'],
    ['SERVER', 'service-unavailable'], ['TIMEOUT', 'timeout'],
    ['TRANSPORT', 'network-error'], ['INVALID_REQUEST', 'request-rejected'],
    ['CONTEXT_WINDOW_EXCEEDED', 'context-exceeded'], ['EMPTY_RESPONSE', 'empty-output'],
    ['ABORTED', 'request-interrupted'], ['UNKNOWN', 'request-failed'],
  ]) {
    const f = fixture(async function* () {
      yield { type: 'text-delta', text: '{"prompt":"must not replace the draft"}' };
      yield { type: 'finish', reason: { kind: code === 'ABORTED' ? 'aborted' : 'error', failure: { code, message: 'secret from service' } } };
    });
    const optimizer = createPromptOptimizer(f.ctx);
    await assert.rejects(optimizer.optimize('test', 'draft'), error => {
      assert.deepEqual(optimizationFailure(error), { code: expected, message: expected, details: {} }); return true;
    });
    optimizer.dispose();
  }
  assert.equal(optimizationFailure({ code: 'QUOTA', status: 429 }).code, 'quota-exceeded');
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

test('confirmation sections are rewritten once into defaults without dropping the original draft', async () => {
  let attempts = 0;
  const f = fixture(async function* () {
    const prompt = attempts++ === 0 ? '# 网站\n## 待确认项\n- 用什么布局？'
      : '# 网站\n## 默认方案（可调整）\n采用单页布局。\n不提供登录。';
    yield { type: 'text-delta', text: JSON.stringify({ prompt }) };
    yield { type: 'finish', reason: { kind: 'stop' } };
  });
  const optimizer = createPromptOptimizer(f.ctx);
  const result = await optimizer.optimize('test', '做一个网站，不提供登录。');
  assert.match(result.prompt, /默认方案/); assert.equal(f.requests.length, 2);
  assert.deepEqual(f.requests[1].messages[0], f.requests[0].messages[0]);
  assert.match(f.requests[1].messages[1].content[0].text, /待确认项/);
  assert.equal(f.requests[1].signal, f.requests[0].signal); optimizer.dispose();
});

test('persistent confirmation sections are rejected after one repair, not returned as a successful draft', async () => {
  const f = fixture(async function* () {
    yield { type: 'text-delta', text: JSON.stringify({ prompt: '## To confirm\n- Choose a layout?' }) };
    yield { type: 'finish', reason: { kind: 'stop' } };
  });
  const optimizer = createPromptOptimizer(f.ctx);
  await assert.rejects(optimizer.optimize('test', 'Build a website'), { code: 'unresolved-questions' });
  assert.equal(f.requests.length, 2); optimizer.dispose();
});
