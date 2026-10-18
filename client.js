window.__ModuleLoader__.load({
  id: 'dsh-next-step',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const CSS = `
[data-composer-input][data-dsh-next-step]{position:relative;--dsh-composer-hint:none!important}
[data-composer-input][data-dsh-next-step]::before{content:attr(data-dsh-next-step);position:absolute;inset:4px 48px auto 14px;color:var(--dsw-alias-label-caption,#929292);font:inherit;line-height:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;user-select:none}
[data-composer-input][data-dsh-next-step]::after{content:"Tab";position:absolute;right:12px;top:7px;font:10px/16px var(--dsw-font-family,inherit);color:var(--dsw-alias-label-caption,#929292);border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.22));border-radius:4px;padding:0 4px;pointer-events:none;user-select:none}
[data-composer-input][data-dsh-next-step]~[data-composer-placeholder]{visibility:hidden}
[data-composer-input][data-dsh-next-step][data-composer-composing]::before,[data-composer-input][data-dsh-next-step][data-composer-composing]::after{display:none}
.dsh-optimize-prompt{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;flex:none;padding:0;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.dsh-optimize-prompt:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-optimize-prompt:disabled{opacity:.4;cursor:default}
.dsh-optimize-prompt:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#5685ed);outline-offset:2px}
.dsh-optimize-prompt[data-busy] svg{animation:dsh-optimize-spin 1.2s linear infinite}
@keyframes dsh-optimize-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.dsh-optimize-prompt[data-busy] svg{animation:none}}

`;
    function Prediction({ sessionId, useSession, useInput, inputActions, call, focusInput }) {
      const running = useSession(s => s.running);
      const pending = useSession(s => s.pendingSubmissions.length > 0);
      const input = useInput(s => s);
      const [prediction, setPrediction] = React.useState(null);
      const tried = React.useRef(false);
      const dismissed = React.useRef(new Set());
      const composing = React.useRef(false);
      const root = React.useRef(null);
      const allowed = !running && !pending && input.phase === 'plain'
        && input.draft === '' && input.attachmentIds.length === 0 && input.queue.length === 0;

      React.useEffect(() => { tried.current = false; dismissed.current.clear(); setPrediction(null); }, [sessionId]);
      React.useEffect(() => { if (running) { tried.current = false; setPrediction(null); } }, [running]);
      React.useEffect(() => {
        if (!allowed) { setPrediction(null); return; }
        if (tried.current) return;
        let active = true;
        const abort = new AbortController();
        const timer = setTimeout(async () => {
          tried.current = true;
          try {
            const result = await call(sessionId, abort.signal);
            if (active && result.ok && result.value?.suggestion && !dismissed.current.has(result.value.revision)) setPrediction(result.value);
          } catch { /* Auxiliary request failures never interrupt the conversation. */ }
        }, 350);
        return () => { active = false; clearTimeout(timer); abort.abort(); };
      }, [sessionId, allowed, running, call]);

      const dismiss = React.useCallback(() => {
        if (prediction) dismissed.current.add(prediction.revision);
        setPrediction(null);
      }, [prediction]);
      const accept = React.useCallback(() => {
        if (!allowed || !prediction) return;
        inputActions.setDraft(prediction.suggestion);
        dismissed.current.add(prediction.revision);
        setPrediction(null);
        focusInput();
      }, [allowed, prediction, inputActions, focusInput]);
      React.useEffect(() => {
        if (!allowed || !prediction) return;
        const editor = root.current?.closest('[data-composer-seat]')?.querySelector('[data-composer-input]');
        if (!editor) return;
        const description = `建议：${prediction.suggestion} 按 Tab 接受，Esc 忽略。`;
        const previousDescription = editor.getAttribute('aria-description');
        editor.setAttribute('data-dsh-next-step', prediction.suggestion);
        editor.setAttribute('aria-description', description);
        return () => {
          if (editor.getAttribute('data-dsh-next-step') === prediction.suggestion) editor.removeAttribute('data-dsh-next-step');
          if (editor.getAttribute('aria-description') === description) {
            if (previousDescription === null) editor.removeAttribute('aria-description');
            else editor.setAttribute('aria-description', previousDescription);
          }
        };
      }, [allowed, prediction, sessionId]);
      React.useEffect(() => {
        const onStart = () => { composing.current = true; };
        const onEnd = () => { composing.current = false; };
        const onKey = event => {
          if (!allowed || !prediction || event.isComposing || composing.current || event.keyCode === 229) return;
          if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
          if (!(event.target instanceof HTMLElement) || !event.target.closest('[data-input-scroll]')) return;
          const seat = root.current?.closest('[data-composer-seat]');
          const editor = event.target.closest('[data-composer-input]');
          if (!seat || event.target.closest('[data-composer-seat]') !== seat || !editor || editor.getClientRects().length === 0) return;
          if (editor.getAttribute('data-dsh-next-step') !== prediction.suggestion) return;
          if (event.key !== 'Tab' && event.key !== 'Escape') return;
          event.preventDefault(); event.stopImmediatePropagation();
          event.key === 'Tab' ? accept() : dismiss();
        };
        window.addEventListener('compositionstart', onStart, true);
        window.addEventListener('compositionend', onEnd, true);
        window.addEventListener('keydown', onKey, true);
        return () => {
          window.removeEventListener('compositionstart', onStart, true);
          window.removeEventListener('compositionend', onEnd, true);
          window.removeEventListener('keydown', onKey, true);
        };
      }, [allowed, prediction, accept, dismiss]);
      // A non-layout marker locates this session's real editor. The prediction
      // is CSS-generated text, never a Lexical document node or draft content.
      return h('span', { ref: root, hidden: true, 'data-dsh-next-step-anchor': sessionId });
    }
    function PromptOptimizer({ sessionId, useSession, useInput, inputActions, optimize, getInput, focusInput, notify }) {
      const running = useSession(s => s.running);
      const pending = useSession(s => s.pendingSubmissions.length > 0);
      const input = useInput(s => s);
      const [busy, setBusy] = React.useState(false);
      const request = React.useRef(null);
      React.useEffect(() => () => {
        request.current?.controller.abort();
        request.current = null;
      }, [sessionId]);
      React.useEffect(() => {
        const active = request.current;
        if (active && (input.draftRev !== active.revision || input.draft !== active.draft || input.phase !== 'plain' || running || pending)) {
          active.controller.abort(); request.current = null; setBusy(false);
        }
      }, [input.draftRev, input.draft, input.phase, running, pending]);
      const hasReferences = input.occurrences.length > 0;
      const disabled = busy || running || pending || input.phase !== 'plain' || !input.draft.trim() || input.draft.length > 12000 || hasReferences;
      const title = busy ? '正在优化提示词…' : hasReferences ? '含文件或会话引用的草稿暂不支持优化' : input.draft.length > 12000 ? '提示词超过 12000 字符' : '优化提示词 · 保留原意，不会自动发送';
      async function onClick() {
        if (disabled || request.current) return;
        const before = getInput();
        if (before.phase !== 'plain' || !before.draft.trim() || before.occurrences.length > 0 || before.draft.length > 12000) return;
        const active = { controller: new AbortController(), revision: before.draftRev, draft: before.draft };
        request.current = active; setBusy(true);
        try {
          const result = await optimize(sessionId, before.draft, active.controller.signal);
          if (request.current !== active || active.controller.signal.aborted) return;
          if (!result.ok || typeof result.value?.prompt !== 'string' || !result.value.prompt.trim()) {
            notify('error', '提示词优化失败，原草稿已保留。'); return;
          }
          const current = getInput();
          if (current.draftRev !== active.revision || current.draft !== active.draft || current.phase !== 'plain' || current.occurrences.length > 0) {
            notify('info', '草稿已更新，未替换你的新内容。'); return;
          }
          inputActions.setDraft(result.value.prompt);
          focusInput();
        } catch {
          if (request.current === active && !active.controller.signal.aborted) notify('error', '提示词优化失败，原草稿已保留。');
        } finally {
          if (request.current === active) { request.current = null; setBusy(false); }
        }
      }
      return h('button', {
        type: 'button', className: 'dsh-optimize-prompt', 'aria-label': busy ? '正在优化提示词' : '优化提示词',
        title, disabled, 'aria-busy': busy, 'data-busy': busy ? '' : undefined, onClick,
      }, h('svg', { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('path', { d: 'm4 20 11-11 3 3L7 23ZM13 11l3 3M5 3l.8 2.2L8 6l-2.2.8L5 9l-.8-2.2L2 6l2.2-.8ZM19 2l.8 2.2L22 5l-2.2.8L19 8l-.8-2.2L16 5l2.2-.8Z' })));
    }
    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style');
        style.dataset.pluginCss = 'dsh-next-step'; style.textContent = CSS; document.head.append(style);
        return () => style.remove();
      });
      const call = (sessionId, signal) => ctx.connection.rpc.call('/api', 'dsh-next-step', { sessionId }, signal);
      const optimize = (sessionId, draft, signal) => ctx.connection.rpc.call('/api', 'dsh-next-step', { action: 'optimize', sessionId, draft }, signal);
      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
        name: 'conversation.input.dock', id: 'dsh-next-step', order: 90,
        inject(sessionId) {
          const scope = ctx.sessions.scope(sessionId);
          const facade = ctx.conversation.input.for(scope);
          return { call, focusInput: () => facade.focus() };
        },
      }, Prediction));
      ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
        name: 'conversation.input.left', id: 'dsh-optimize-prompt', order: 90,
        inject(sessionId) {
          const scope = ctx.sessions.scope(sessionId);
          const facade = ctx.conversation.input.for(scope);
          return { optimize, getInput: () => facade.state.getSnapshot(), focusInput: () => facade.focus(), notify: (level, text) => facade.notify(level, text) };
        },
      }, PromptOptimizer));
    }
    return { inject: ['slots', 'sessions', 'conversation', 'connection'], apply };
  },
});
