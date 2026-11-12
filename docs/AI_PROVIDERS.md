# AI providers

Swear Jar talks to the AI through one OpenAI-compatible client. The provider is set only by environment variables in `.env`. No code changes are needed.

| Option | Used by | Status in this build |
|---|---|---|
| **Groq** | The hosted demo | Used by the hosted demo. Free tier, no credit card |
| **No key (word-list mode)** | Local runs with no key | Built in. About 85 English and Italian roots, no context |
| **LM Studio** (local server) | Local runs | Should work, not tested in this build |
| **Ollama** (local server) | Local runs | Should work, not tested in this build |
| **Other OpenAI-compatible endpoint** | Any | Should work, not tested in this build |

Only text is sent to the AI: finished sentences, the house rules and the fines. Audio is never sent by the app.

## Groq (hosted demo)

1. Create a key at [console.groq.com](https://console.groq.com).
2. In `.env`:

```
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=gsk_...
AI_MODEL_FAST=openai/gpt-oss-20b
AI_MODEL_SMART=openai/gpt-oss-120b
```

- `AI_MODEL_FAST` is the live judge. It runs about once every 3 seconds for the whole session, with `reasoning_effort: "low"`.
- `AI_MODEL_SMART` compiles the rules and writes the end-of-session report.
- Groq moved `llama-3.1-8b-instant` to enterprise-only, so it is no longer the default. Check the models page in the Groq console for current model names and free-tier limits.
- If Groq rate-limits or times out, that judge batch falls back to the word list and the screen shows **AI busy**.

## LM Studio (local)

Should work, not tested in this build.

1. Install [LM Studio](https://lmstudio.ai) and download an instruct model.
2. Start the local server (default `http://localhost:1234`).
3. In `.env`:

```
AI_BASE_URL=http://localhost:1234/v1
AI_API_KEY=lm-studio
AI_MODEL_FAST=<model id shown in LM Studio>
AI_MODEL_SMART=<same, or a larger model>
```

The app must be able to reach the LM Studio server, so use it with `npm run dev` on the same machine. It is not usable with the hosted Render demo.

## Ollama (local)

Should work, not tested in this build.

```
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL_FAST=<model you pulled with ollama pull>
AI_MODEL_SMART=<same, or a larger model>
```

## Other OpenAI-compatible endpoints

Set `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL_FAST` and `AI_MODEL_SMART`. The endpoint must support chat completions. The app validates every answer with zod, so a malformed answer is rejected.

## Which provider is active

The jar screen shows a badge:

- **AI judge: Groq** when the Groq endpoint is active.
- **Word-list mode** when no AI is configured, or when the word list is the only judge.
- **AI busy** next to the badge when the AI is rate-limited or timed out and the current batch used the word list.

`GET /api/health` returns the AI mode and model name, never the key.
