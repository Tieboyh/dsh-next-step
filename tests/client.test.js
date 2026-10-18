import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
const pause = ms => new Promise(r => setTimeout(r, ms));
function mount(response = Promise.resolve({ ok: true, value: { revision: '1:3', suggestion: '补上边界测试。' } }), entryId = 'dsh-next-step') {
  const entries = new Map(), listeners = new Map(), states = [], effects = [];
  let plugin, cursor = 0, dirty = false, tree, calls = 0, focus = 0, sends = 0, storageReads = 0;
  const session = { running: false, pendingSubmissions: [] };
  const input = { draft: '', draftRev: 0, phase: 'plain', attachmentIds: [], queue: [], occurrences: [] };
  const requests = [], notices = [];
  let currentNotice = null;
  const React = {
    Fragment: 'fragment',
    createElement: (tag, props, ...children) => ({ tag, props, children }),
    useState(initial) {
      const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], value => { const next = typeof value === 'function' ? value(states[i]) : value; if (!Object.is(next, states[i])) { states[i] = next; dirty = true; } }];
    },
    useRef(value) { const i = cursor++; return states[i] ??= { current: value }; },
    useCallback(fn, deps) { const i = cursor++; if (!states[i] || deps.some((d, n) => !Object.is(d, states[i].deps[n]))) states[i] = { fn, deps }; return states[i].fn; },
    useEffect(fn, deps) {
      const i = cursor++, prior = states[i];
      if (!prior || deps.some((d, n) => !Object.is(d, prior.deps[n]))) {
        states[i] = { deps, cleanup: prior?.cleanup };
        effects.push(() => { states[i].cleanup?.(); states[i].cleanup = fn(); });
      }
    },
  };
  const seat = { querySelector() { return editor; } };
  class Element {
    attributes = new Map();
    closest(selector) { return selector === '[data-composer-seat]' ? seat : editor; }
    getClientRects() { return [{}]; }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
  }
  const editor = new Element();
  const window = {
    __ModuleLoader__: { load(def) { plugin = def.factory(() => React); } },
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    dispatchEvent(event) { for (const fn of listeners.get(event.type) ?? []) fn(event); },
  };
  vm.runInNewContext(source, { window, document: { head: { append() {} }, createElement() { return { dataset: {}, remove() {} }; } }, HTMLElement: Element, localStorage: { getItem() { storageReads++; return 'false'; } }, Event, setTimeout, clearTimeout, AbortController });
  plugin.apply({
    effect(fn) { fn(); },
    slots: { inject(_name, fn) { fn(); }, register(def, component) { entries.set(def.id, { def, component }); } },
    sessions: { scope() { return {}; } }, conversation: { input: { for() { return {
      focus() { focus++; }, state: { getSnapshot: () => input },
      notices: { getSnapshot: () => currentNotice, set(value) { currentNotice = value; } },
      notify(level, text) { currentNotice = { level, text }; notices.push({ level, text }); },
    }; } } },
    connection: { rpc: { call(_channel, _endpoint, payload, signal) { calls++; requests.push({ payload, signal }); return response; } } },
  });
  const entry = entries.get(entryId);
  const props = {
    ...entry.def.inject('session'), sessionId: 'session',
    useSession: select => select(session), useInput: select => select(input),
    inputActions: { setDraft(text) { input.draft = text; input.draftRev++; }, submit() { sends++; } },
  };
  function render() {
    do {
      dirty = false; cursor = 0; tree = entry.component(props);
      if (tree?.props?.ref) tree.props.ref.current = new Element();
      while (effects.length) effects.shift()();
    } while (dirty);
    return tree;
  }
  function key(name, extra = {}) {
    let prevented = false;
    window.dispatchEvent({ type: 'keydown', key: name, target: new Element(), preventDefault() { prevented = true; }, stopImmediatePropagation() {}, ...extra });
    return prevented;
  }
  function dispose() { for (const s of states) s?.cleanup?.(); }
  return { render, key, dispose, input, session, window, editor, entries, listeners, requests, notices, setNotice: value => { currentNotice = value; }, currentNotice: () => currentNotice, storageReads: () => storageReads, calls: () => calls, focus: () => focus, sends: () => sends };
}
test('Tab accepts only a visible prediction; modifiers and IME pass through; never submits', async () => {
  const m = mount(); m.render(); await pause(370);
  assert.equal(m.render().props.hidden, true);
  assert.equal(m.editor.getAttribute('data-dsh-next-step'), '补上边界测试。');
  assert.equal(m.input.draft, '');
  assert.equal(m.key('Tab', { isComposing: true }), false);
  assert.equal(m.key('Tab', { shiftKey: true }), false);
  assert.equal(m.key('Tab', { target: { closest() { return {}; } } }), false);
  assert.equal(m.key('Tab'), true); assert.equal(m.input.draft, '补上边界测试。');
  assert.equal(m.focus(), 1); assert.equal(m.sends(), 0); m.render(); assert.equal(m.editor.getAttribute('data-dsh-next-step'), null); m.dispose();
});
test('Esc dismisses once and clearing a draft does not generate another call', async () => {
  const m = mount(); m.render(); await pause(370); m.render();
  assert.equal(m.key('Escape'), true); m.render(); assert.equal(m.editor.getAttribute('data-dsh-next-step'), null);
  m.input.draft = '我的内容'; m.render(); m.input.draft = ''; m.render();
  await pause(370); assert.equal(m.calls(), 1); m.dispose();
});
test('late results cannot replace typed text or a new running turn', async () => {
  let resolve; const pending = new Promise(r => { resolve = r; });
  const m = mount(pending); m.render(); await pause(370);
  m.input.draft = '正在写的新指令'; m.render();
  resolve({ ok: true, value: { revision: 'old', suggestion: '旧建议' } }); await pause(0);
  m.render(); assert.equal(m.editor.getAttribute('data-dsh-next-step'), null); assert.equal(m.input.draft, '正在写的新指令');
  assert.equal(m.key('Tab'), false); m.dispose();
});

test('ghost accessibility annotation is restored on dismissal and disposal', async () => {
  const m = mount(); m.editor.setAttribute('aria-description', '原有说明');
  m.render(); await pause(370); m.render();
  assert.match(m.editor.getAttribute('aria-description'), /按 Tab 接受/);
  m.dispose();
  assert.equal(m.editor.getAttribute('data-dsh-next-step'), null);
  assert.equal(m.editor.getAttribute('aria-description'), '原有说明');
});

test('plugin activation ignores the old disabled preference and registers no composer toggle', async () => {
  const m = mount(); m.render(); await pause(370); m.render();
  assert.equal(m.entries.size, 2);
  assert.equal(m.entries.has('dsh-next-step-toggle'), false);
  assert.equal(m.storageReads(), 0);
  assert.equal(m.listeners.has('storage'), false);
  assert.equal(m.listeners.has('dsh-next-step/toggle'), false);
  assert.equal(m.calls(), 1);
  assert.equal(m.editor.getAttribute('data-dsh-next-step'), '补上边界测试。');
  m.dispose();
});

test('optimizer icon is disabled for empty drafts and structured references', () => {
  const m = mount(undefined, 'dsh-optimize-prompt');
  assert.equal(m.render().props.disabled, true);
  m.input.draft = '帮我写个页面'; m.input.occurrences = [{}];
  assert.equal(m.render().props.disabled, true);
  assert.match(m.render().props.title, /引用/);
  assert.equal(m.calls(), 0); m.dispose();
});
test('optimizer replaces only the draft, preserves attachments, blocks duplicate clicks, and never sends', async () => {
  let resolve; const response = new Promise(r => { resolve = r; });
  const m = mount(response, 'dsh-optimize-prompt');
  m.input.draft = '添加和删除任务，界面简洁'; m.input.draftRev = 1; m.input.attachmentIds = ['file-1'];
  const pending = m.render().props.onClick();
  const button = m.render(); assert.equal(button.props.disabled, true); assert.equal(button.props['aria-busy'], true);
  assert.equal(button.children[1].children[0], '优化中…');
  await button.props.onClick(); assert.equal(m.calls(), 1);
  assert.equal(m.requests[0].payload.action, 'optimize');
  assert.equal(m.requests[0].payload.draft, '添加和删除任务，界面简洁');
  resolve({ ok: true, value: { prompt: '请实现任务的添加与删除，保持界面简洁。' } }); await pending;
  assert.equal(m.input.draft, '请实现任务的添加与删除，保持界面简洁。');
  assert.deepEqual(m.input.attachmentIds, ['file-1']); assert.equal(m.sends(), 0); assert.equal(m.focus(), 1);
  assert.equal(m.notices.length, 0);
  assert.equal(m.render().props['aria-busy'], false); m.dispose();
});

test('mount removes only the obsolete optimization success notice', () => {
  for (const notice of [
    { level: 'info', text: '提示词已优化，请确认后发送。' },
    { level: 'info', text: '来自其他插件的提示' },
    { level: 'error', text: '模型请求失败' },
  ]) {
    const m = mount(undefined, 'dsh-optimize-prompt'); m.setNotice(notice); m.render();
    assert.equal(m.currentNotice(), notice.text === '提示词已优化，请确认后发送。' ? null : notice);
    m.dispose();
  }
});

test('unchanged optimization reports completion without rewriting the draft or incrementing its revision', async () => {
  const m = mount(Promise.resolve({ ok: true, value: { prompt: '我需要开发一个风格极致独特的网站。' } }), 'dsh-optimize-prompt');
  m.input.draft = '我需要开发一个风格极致独特的网站。'; m.input.draftRev = 3;
  await m.render().props.onClick();
  assert.equal(m.input.draftRev, 3); assert.equal(m.sends(), 0); assert.equal(m.focus(), 1);
  assert.equal(m.notices[0].text, '模型未建议修改，已保留原文。');
  assert.equal(m.render().props.disabled, false); m.dispose();
});
test('editing the draft aborts optimization and rejects even a late successful result', async () => {
  let resolve; const m = mount(new Promise(r => { resolve = r; }), 'dsh-optimize-prompt');
  m.input.draft = '原草稿'; m.input.draftRev = 1;
  const pending = m.render().props.onClick();
  m.input.draft = '新的草稿'; m.input.draftRev = 2; m.render();
  assert.equal(m.requests[0].signal.aborted, true);
  resolve({ ok: true, value: { prompt: '过期结果' } }); await pending;
  assert.equal(m.input.draft, '新的草稿'); assert.equal(m.focus(), 0); assert.equal(m.sends(), 0); m.dispose();
});
test('optimizer revision guard rejects an edit that returns to the same text before a render', async () => {
  let resolve; const m = mount(new Promise(r => { resolve = r; }), 'dsh-optimize-prompt');
  m.input.draft = '原草稿'; m.input.draftRev = 1;
  const pending = m.render().props.onClick();
  m.input.draftRev = 3;
  resolve({ ok: true, value: { prompt: '过期结果' } }); await pending;
  assert.equal(m.input.draft, '原草稿'); assert.equal(m.notices[0].level, 'info'); m.dispose();
});
test('optimization errors preserve the draft; unmounting prevents a late replacement', async () => {
  const m = mount(Promise.resolve({ ok: false }), 'dsh-optimize-prompt'); m.input.draft = '保留我';
  await m.render().props.onClick(); assert.equal(m.input.draft, '保留我'); assert.equal(m.notices[0].level, 'error'); m.dispose();
  let resolve; const other = mount(new Promise(r => { resolve = r; }), 'dsh-optimize-prompt'); other.input.draft = '切换前';
  const pending = other.render().props.onClick(); other.dispose();
  resolve({ ok: true, value: { prompt: '不该写入' } }); await pending;
  assert.equal(other.input.draft, '切换前'); assert.equal(other.requests[0].signal.aborted, true);
});

test('optimizer explains failures, keeps drafts editable and never displays raw provider messages', async () => {
  for (const [error, expected] of [
    [{ code: 'timeout', details: { timeoutMs: 25000 } }, /超时（25 秒）/],
    [{ code: 'missing-model' }, /配置可用模型/],
    [{ code: 'authentication-failed', details: { status: 401 } }, /认证失败.*HTTP 401/],
    [{ code: 'quota-exceeded' }, /额度已用尽/],
    [{ code: 'rate-limited' }, /请求过于频繁/],
    [{ code: 'service-unavailable' }, /服务暂时不可用/],
    [{ code: 'request-rejected' }, /拒绝了请求/],
    [{ code: 'network-error' }, /网络或代理/],
    [{ code: 'output-truncated' }, /输出被截断/],
    [{ code: 'empty-output' }, /未返回优化文本/],
    [{ code: 'invalid-output' }, /格式不符合要求/],
    [{ code: 'incomplete-output' }, /未完整返回/],
    [{ code: 'context-exceeded' }, /上下文限制/],
    [{ code: 'request-interrupted' }, /被中断/],
    [{ code: '__proto__' }, /优化请求失败/],
  ]) {
    const m = mount(Promise.resolve({ ok: false, error: { ...error, message: 'secret provider response' } }), 'dsh-optimize-prompt');
    m.input.draft = '请保留原草稿';
    await m.render().props.onClick();
    assert.equal(m.input.draft, '请保留原草稿'); assert.equal(m.sends(), 0);
    assert.match(m.notices[0].text, expected); assert.match(m.notices[0].text, /原草稿已保留/);
    assert.doesNotMatch(m.notices[0].text, /secret/);
    assert.equal(m.render().props.disabled, false); m.dispose();
  }
});

test('transport failures are actionable and deliberate cancellation stays silent', async () => {
  const m = mount(Promise.reject(new Error('private transport payload')), 'dsh-optimize-prompt'); m.input.draft = '保留';
  await m.render().props.onClick();
  assert.match(m.notices[0].text, /与 DSH 的通信/); assert.doesNotMatch(m.notices[0].text, /private/);
  assert.equal(m.input.draft, '保留'); assert.equal(m.render().props.disabled, false); m.dispose();
  const cancelled = mount(Promise.resolve({ ok: false, error: { code: 'cancelled' } }), 'dsh-optimize-prompt'); cancelled.input.draft = '保留';
  await cancelled.render().props.onClick(); assert.equal(cancelled.notices.length, 0); cancelled.dispose();
});
