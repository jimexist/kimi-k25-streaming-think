# kimi-k25-streaming-think

AI SDK example using Moonshot AI's kimi-k2.5 with `ToolLoopAgent`, streaming, and thinking mode.

## Usage

```sh
pn start
```

## Known issue: `<think>` tag leaking in multi-step streams

When using kimi-k2.5 with `@ai-sdk/moonshotai` in thinking mode, the model's `<think>...</think>` reasoning tags can leak into `text-delta` stream events during multi-step calls (e.g. after tool results). The provider correctly extracts reasoning on the first LLM step, but on subsequent steps the opening `<think>` is consumed while the closing `</think>` — along with the reasoning content before it — leaks into text.

This is not specific to `@ai-sdk/moonshotai` — it affects any OpenAI-compatible provider streaming thinking models that use `<think>` tags natively. See [openclaw#47913](https://github.com/openclaw/openclaw/issues/47913).
