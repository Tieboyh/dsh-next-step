# English launch copy

## Headline

Find your next step. Refine your prompt. — dsh-next-step

## One sentence

Inline next-message suggestions and one-click prompt improvement for DSH: Tab to accept a suggestion, click the wand to refine a draft, and decide what to send.

## Launch post

I built **dsh-next-step**, a plugin for DeepSeek Harness.

After a reply finishes, a possible follow-up appears as gray text inside the composer. Press **Tab** to make it an editable draft. Press **Esc** to dismiss it, or write your own message.

Already have a draft? Click the **magic-wand icon** in the composer toolbar to improve its wording. The model is instructed to preserve your intent, language, and explicit constraints. Review the result, edit it, and send when ready. Errors keep the original draft, and a late response cannot overwrite new text you type while waiting.

Neither feature sends a message automatically. Both work on desktop and web, using your existing DSH model configuration and credentials. No separate API key is needed.

Start and stop the plugin in **DSH’s Plugin Manager**. Enable dsh-next-step for both features; disable the plugin to stop. The composer has the action icon without a separate next-step toggle.

Predictions and each improvement request use your configured model service’s normal quota or billing.

[Source, installation, and demos](https://github.com/Tieboyh/dsh-next-step) · [Downloads and videos](https://github.com/Tieboyh/dsh-next-step/releases/tag/v0.3.0)

## Short post

Two small additions to DSH:

- A gray next-message suggestion. **Tab to accept. Esc to dismiss.**
- A **magic-wand icon** to refine the draft you already wrote.

Everything stays editable. Nothing sends automatically. Desktop + web, controlled from Plugin Manager.

[Source and installation](https://github.com/Tieboyh/dsh-next-step)

## Screenshot captions

1. Composer text detail: the suggestion has not changed the draft.
2. Tab turns it into ordinary, editable text.
3. Add your own requirements before sending.
4. Esc dismisses the current suggestion.
5. Actual v0.3.0 UI: the magic-wand icon and an improved draft, still unsent.
6. Plugin Manager: dsh-next-step is enabled; both features follow the plugin state.

Prediction text details reuse crops from an earlier demo. The improvement screenshot comes from v0.3.0 verification; Plugin Manager comes from the current client. See [media provenance](MEDIA.md).

## Video caption

A little help with the next step. A clearer draft when you have one.

**Tab to accept. Click the wand to refine. Edit, then send.**

Enable dsh-next-step in Plugin Manager to get started.

#DeepSeekHarness #DSH #PromptEngineering #OpenSource #DeveloperTools

The 36-second film is an edit of real UI screenshots with synthetic examples and scripted model responses. It makes no live-model quality or speed claim. Model requests use the configured service’s normal quota or billing.
