# dsh-next-step

**下一步，按下 Tab。**

[English](README.md) · [下载安装包](https://github.com/Tieboyh/dsh-next-step/releases/latest) · [中文宣传视频](media/zh/promo-zh.mp4) · [English video](media/en/promo-en.mp4)

![dsh-next-step：输入框里的下一步建议](media/zh/cover-zh.png)

为 **DeepSeek Harness 桌面端和 Web 端**制作的社区插件。回复结束后，下一条消息的建议会以灰字出现在输入框里。按 **Tab** 变成可编辑草稿，再由你决定是否发送。

## 看看实际交互

[![查看插件演示](media/zh/demo-zh.gif)](https://github.com/Tieboyh/dsh-next-step/releases/download/v0.2.0/promo-zh.mp4)

- **建议就在输入框里**：沿用原生字体和行高，不额外占一块面板。
- **Tab 接受**：灰字变为普通草稿，不会自动发送。
- **Esc 忽略**：随时写自己的下一条消息。
- **草稿优先**：开始输入、有附件、有排队消息或开启新一轮时，建议隐藏。
- **随插件启用**：输入框没有独立开关。要关闭建议，请在 DSH 插件管理中停用插件。
- **沿用现有模型**：复用 DSH 已配置的模型与凭据，无需另外填写 API Key。

| 输入框内的灰字建议 | Tab 接受后的草稿 |
| --- | --- |
| ![灰字建议](media/zh/01-inline-prediction.png) | ![接受后仍可编辑](media/zh/02-tab-accepted.png) |

[更多中文截图](media/zh/) · [英文截图](media/en/)

## 安装

无需编译，无运行时 npm 依赖。

**桌面端：**下载[源码压缩包](https://github.com/Tieboyh/dsh-next-step/archive/refs/tags/v0.2.1.zip)，解压后，在 DSH 插件管理页添加该插件目录。

macOS 也可以使用桌面应用自带的 CLI：

```sh
'/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh' \
  plugin --profile desktop add link:/absolute/path/to/dsh-next-step
```

**Web 端：**直接安装固定版本：

```sh
dsh plugin --profile web add 'dsh-next-step@github:Tieboyh/dsh-next-step#v0.2.1'
```

本地开发可改用 `link:/absolute/path/to/dsh-next-step`。插件自带 bundle patch，会自动注册；无法热加载的环境刷新或重启 DSH 即可。

## 快捷键

| 按键 | 功能 |
| --- | --- |
| Tab | 将当前灰字建议填入草稿 |
| Esc | 忽略本次建议 |
| Shift + Tab | 保留原有焦点导航 |

建议只在会话空闲、草稿为空且没有附件或排队消息时出现。中文输入法组合输入期间不会接受建议。灰字只是显示层，按 Tab 前不会写入编辑器文档。

## 模型调用与数据

生成建议会**额外调用已配置的模型服务**，按该服务正常计费或消耗额度。安装插件不代表推理在本地运行，也不代表免费。

仅提取最近最多 10 条用户/助手消息的正文，合计不超过 12,000 字符；不提交思考块、工具结果或附件。建议与辅助提示词不写入会话正文。每个已完成回合的结果缓存在宿主内存中，重启后缓存清空。失败、超时或没有合适建议时保持输入框原状。

## 可选配置

默认沿用当前会话的 provider 和 model，使用该模型的默认推理设置。需要固定其他已配置的模型时，在 profile 的 `cordis.patch.yml` 添加：

```yaml
- id: next-step
  config:
    timeoutMs: 25000
    # provider: 已配置的provider-id
    # model: 对应模型ID
    # reasoningEffort: 模型支持的推理等级ID
```

`provider` 和 `model` 必须同时指定。超时范围 1–60 秒，默认 25 秒；响应上限 512 tokens，建议最多 280 字符。生成建议时不会调用工具或运行 Agent。

## 兼容与开发

已验证 **macOS 桌面版 DSH 0.2.1-rc.2**；演示素材使用相同版本的 Web 运行时。其他版本可能存在插件接口变化。

```sh
npm run build  # JavaScript 语法检查
npm test       # 13 项行为测试
npm pack
```

- `index.js`：受 Connection 认证保护的 Fetch RPC，支持桌面 IPC 与 Web HTTP。
- `engine.js`：上下文筛选、模型请求、去重及失效检查。
- `client.js`：原生客户端模块与输入框灰字提示。

宣传截图和视频使用**真实 DSH 前端与本插件**，会话及模型响应为固定演示数据，不代表真实模型的预测质量。详见[素材说明](docs/MEDIA.md)。

[中文宣传文案](docs/PROMO.zh-CN.md) · [English launch copy](docs/PROMO.en.md)

MIT 开源。社区项目，非 DeepSeek 或 OpenAI 官方产品。
