# Changelog

## 0.5.1

- Remove the prompt-policy exception that still allowed confirmation sections.
- Repair a recognized confirmation section once using the original draft; reject persistent question lists without overwriting the draft.
- Share cancellation and timeout across both requests; a repair consumes one additional model request.
- Show the loaded client version in the optimizer tooltip for reload diagnosis.
- Add regression cases for repair and rejection; not run in this revision per the requested manual validation workflow.

删除待确认章节的规则例外；检测到相应章节时自动整理一次，仍未解决则保留原稿。图标提示包含版本号以识别运行中的旧前端。

## 0.5.0

- Prefer an executable spec with sensible, proportionate defaults instead of a list of questions.
- Label inferred choices as Proposed defaults / 默认方案（可调整）; retain explicit requirements and exclusions.
- Reserve confirmation questions for essential information that cannot safely be defaulted.
- Use labeled placeholder content rather than invented real-world facts; avoid unrelated scope and commitments.
- Per the requested workflow, no additional functional validation was run.

允许自主补充合理默认方案，尽量减少待确认项，直接形成可执行 spec；默认项明确可调整，不伪造事实或覆盖用户已有要求。

## 0.4.1

- Prefer a compact, well-described specification for creation and implementation requests, with task-appropriate sections.
- Separate known requirements, exclusions, behavior, constraints, and evidence-based acceptance criteria.
- Put missing scope and acceptance decisions in To confirm; never fill them with assumed requirements.
- Keep complete one-step requests concise and omit empty boilerplate.
- Functional validation of this revision is delegated to the user; no additional automated or live tests were run.

优先将开发类需求整理成可执行的 spec，未知范围与验收标准列为待确认项，不擅自补全。本版本按要求由用户验证。

## 0.4.0

- Turn vague drafts into actionable requests with explicit goals, known requirements, and appropriate execution steps.
- List materially missing information under “待确认项” or “To confirm” in the draft’s language, as questions rather than assumed answers.
- Require confirmation before decisions that depend on missing information; never invent features, technical choices, dates, budgets, or scope.
- Keep fully specified requests concise and preserve existing language, negations, and explicit constraints.
- Keep the existing draft protections, progress feedback, and classified errors.

把模糊想法整理成可执行提示词，缺失的关键信息单独列为待确认项；已知要求保持明确，不擅自编造需求。信息完整的简单请求不强行扩写。

## 0.3.2

- Show a visible working label beside the wand during optimization.
- Confirm completion for both changed and unchanged model output using DSH-supported info notices.
- Preserve the draft and revision when the returned text is identical.
- Verify with 31 behavior tests.

点击后显示“优化中…”，完成后明确提示已优化或模型未建议修改，避免误以为按钮没有响应。

## 0.3.1

- Explain prompt-improvement failures with actionable categories, including timeout, model configuration, authentication, quota, rate limit, network, and invalid/truncated output.
- Preserve errors carried by DSH terminal stream chunks instead of treating every service failure as incomplete output.
- Distinguish request timeout from deliberate cancellation; keep cancelled requests quiet and preserve draft revision protections.
- Forward only safe categories and HTTP status codes, never raw provider errors, credentials, or prompt text. No plugin-level retries or additional model calls.
- Validate with 30 tests, including real DSH failure-envelope shapes and client notifications.

优化失败提示现在会说明具体类别，并正确识别 DSH 流结束事件中的服务错误。区分超时与主动取消，保留原草稿，不泄露服务原始响应或凭据。插件仍只通过 DSH 插件管理启停。

## 0.3.0

- Add a magic-wand icon to improve the current prompt draft with one click.
- Preserve intent, language, and explicit constraints; never send the result automatically.
- Guard draft revisions, cancel requests after edits or session changes, and keep the original draft on errors.
- Support the first unsent prompt using the configured default model; retain separate attachments.

新增提示词优化图标：点击即可优化当前草稿。保留原意，不自动发送；保护等待期间的新输入，失败时保留原稿。

## 0.2.1

- Remove the composer toggle and its independent local-storage preference.
- Predictions are active whenever the plugin is enabled. Disable the plugin in DSH’s plugin manager to turn them off.
- Keep Tab acceptance, Esc dismissal of one suggestion, and existing draft/IME protections.

删除输入框开关及其独立的本地存储状态。建议随插件启用；要关闭，请在 DSH 插件管理中停用插件。Tab 接受、Esc 忽略当前建议及草稿/输入法保护保持不变。
