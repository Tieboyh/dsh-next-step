import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
const pause = ms => new Promise(r => setTimeout(r, ms));
function mount(response = Promise.resolve({ ok: true, value: { revision: '1:3', suggestion: '补上边界测试。' } })) {
  const entries = new Map(), listeners = new Map(), states = [], effects = [];
  let plugin, cursor = 0, dirty = false, tree, calls = 0, focus = 0, sends = 0, storageReads = 0;
  const session = { running: false, pendingSubmissions: [] };
  const input = { draft: '', phase: 'plain', attachmentIds: [], queue: [] };
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
    sessions: { scope() { return {}; } }, conversation: { input: { for() { return { focus() { focus++; } }; } } },
    connection: { rpc: { call() { calls++; return response; } } },
  });
  const entry = entries.get('dsh-next-step');
  const props = {
    ...entry.def.inject('session'), sessionId: 'session',
    useSession: select => select(session), useInput: select => select(input),
    inputActions: { setDraft(text) { input.draft = text; }, submit() { sends++; } },
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
  return { render, key, dispose, input, session, window, editor, entries, listeners, storageReads: () => storageReads, calls: () => calls, focus: () => focus, sends: () => sends };
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
  assert.equal(m.entries.size, 1);
  assert.equal(m.entries.has('dsh-next-step-toggle'), false);
  assert.equal(m.storageReads(), 0);
  assert.equal(m.listeners.has('storage'), false);
  assert.equal(m.listeners.has('dsh-next-step/toggle'), false);
  assert.equal(m.calls(), 1);
  assert.equal(m.editor.getAttribute('data-dsh-next-step'), '补上边界测试。');
  m.dispose();
});
