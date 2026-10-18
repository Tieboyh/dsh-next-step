# Media / 素材说明

## What is included

- Two 28-second promotional videos: Simplified Chinese and English, 1920×1080, 24 fps, H.264/AAC MP4.
- Two GIF previews for GitHub READMEs.
- Two 1920×1080 launch covers.
- Eight original 2400×1500 screenshots: inline prediction, Tab acceptance, editing, and Esc dismissal, in Chinese and English.
- Chinese and English launch posts in this directory.

## Provenance

The screenshots were captured from the actual **DSH 0.2.1-rc.2 web frontend** running `dsh-next-step 0.2.0` in an isolated local profile. The UI and plugin behaviors are real. The conversation and model output are fixed synthetic examples supplied by a demo-only scripted provider; they do not measure live-model suggestion quality or speed.

The provider is not included in the distributed plugin. Normal installations call the user's configured model service.

The promotional films use edited crops of those screenshots, title cards, crossfades, and keyboard callouts. They are screenshot-based product films, not continuous desktop recordings. The original screenshot files are preserved without annotations or retouching. The sound consists of simple synthesized chimes created for this project, with no third-party music or voice-over.

No private conversations, account credentials, API keys, or local authentication URLs are included. These assets show v0.2.0. Version 0.2.1 removes the composer toggle visible in the screenshots; predictions are now controlled only by enabling or disabling the plugin.

## Re-render the films

Install Pillow and ffmpeg, then run from any working directory:

```sh
python tools/render-media.py --lang both --work-dir /path/to/scratch-directory
```

The renderer uses the screenshot files under `media/en` and `media/zh`. On platforms without the default fonts, set `PROMO_FONT` and `PROMO_FONT_CJK` to installed TrueType/OpenType font paths.

## 中文说明

截图来自隔离环境中的真实 DSH 前端和真实插件，使用固定示例会话与脚本化模型响应。宣传视频由原始截图裁切、字幕卡、键盘提示和转场组成，并非连续录屏；截图原文件保持不变。示例不代表真实模型的建议质量或响应速度。

演示用模型未随插件发布。正常使用时，插件调用用户在 DSH 中配置的模型服务，并消耗该服务对应的额度。

现有素材展示 v0.2.0；v0.2.1 已删除图中输入框旁的独立开关，建议只随插件启用或停用。

音效为本项目合成的简单提示音，没有第三方音乐或配音。素材中不包含私人聊天、凭据或本地认证链接。

DeepSeek Harness UI and trademarks belong to their respective owners. This is a community plugin, not an official DeepSeek or OpenAI product.
