# Changelog

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
