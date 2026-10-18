# Media / 素材说明

## Included in this refresh

- Two 36-second promotional films, Chinese and English: 1920×1080, 24 fps, H.264/AAC MP4.
- Two 28-second GIF previews and two 1920×1080 covers.
- Eight composer text-detail crops, four per language.
- One original v0.3.0 prompt-improvement verification screenshot, 1440×1000.
- One crop of the user-supplied Plugin Manager screenshot showing only dsh-next-step.
- Chinese and English launch posts in this directory.

The current media contains no old composer next-step toggle. The Plugin Manager switch is the actual enable/disable control and is intentionally shown.

## Sources and limits

All UI pixels come from real DSH screens. The film is a screenshot-based edit with title cards, crops, crossfades, and an annotation around the actual magic-wand icon. It is not a continuous recording of a request completing. The original draft appears as an editorial text label, taken from the verification input; the improved draft is visible in the actual verification screenshot. The English draft in that screenshot is retained in both language versions rather than replaced with invented UI text.

| Files | Source |
| --- | --- |
| `media/en/01…04`, `media/zh/01…04` | Text-only crops of the earlier DSH 0.2.1-rc.2 / plugin v0.2.0 demo. Crop rectangle: `(520,1308,1960,1380)` from the original 2400×1500 image. These show the retained prediction/Tab/edit/Esc interactions and exclude the entire old control row. They are not new v0.3.0 full-interface captures. |
| `media/shared/05-prompt-optimized.png` | Unretouched v0.3.0 verification screenshot from the actual DSH 0.2.1-rc.2 frontend. Shows a first unsent draft after optimization and the real magic-wand icon, without an independent feature toggle. |
| `media/shared/06-plugin-manager.png` | Crop `(20,235,1980,345)` of the user-supplied current client screenshot. Only this plugin’s row is retained. The user enabled it through Plugin Manager. |

The earlier demo and the v0.3.0 verification used isolated local test profiles with a scripted demo provider and synthetic conversations. They make no claim about live-model quality or response speed. The demo provider is not distributed with the plugin. Normal use calls the user’s configured model service and consumes its normal quota or billing.

No DSH instance or plugin was started or reconfigured for this media refresh. Existing captures were reused to respect the requirement that plugin activation happens only through the client’s Plugin Manager. No private chats, credentials, authentication links, or unrelated plugin rows are published.

Sound consists of simple synthesized chimes created for this project. There is no third-party music or voice-over.

## Re-render

With Pillow and ffmpeg installed:

```sh
python tools/render-media.py --lang both --work-dir /path/to/scratch-directory
```

The renderer reads the checked-in image files and never starts DSH or loads a plugin. Set `PROMO_FONT` and `PROMO_FONT_CJK` if the default fonts are unavailable. `media/manifest.json` records the dimensions, sizes, and SHA-256 hashes of all current media assets.

## 中文说明

本次素材展示“Tab 接受灰字建议”“魔法棒优化草稿”“在插件管理中统一启停”。旧版输入框里的独立开关不再出现在当前素材中；插件管理页的开关是实际启停入口，因此保留展示。

灰字、接受、编辑和 Esc 四种文字细节复用早期真实截图的裁切，完整排除了旧工具栏，并非新拍的 v0.3.0 全界面截图。优化画面使用已经保存的 v0.3.0 真实验证截图；插件管理使用用户提供的当前客户端截图，仅保留 dsh-next-step 所在一行。新版优化截图保持英文草稿原文，中英文视频只翻译画面外的说明，不替换界面文字。

视频通过这些真实截图、文字卡和转场制作，不是连续录屏。原始草稿作为画面外的文字展示，来自验证时的输入；优化结果来自实际截图。示例模型响应为脚本化固定数据，不代表真实模型的质量或响应速度。

为遵守“只通过插件管理启停”的要求，本次更新没有另起 DSH 实例、直接加载插件或改动客户端启用状态。没有公开私人会话、凭据或本地认证链接。生成建议和优化草稿都会正常消耗已配置模型服务的额度。

DeepSeek Harness UI and trademarks belong to their respective owners. Community plugin; not an official DeepSeek or OpenAI product.
