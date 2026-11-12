# AI providers: free, local, or bring your own

Swear Jar talks to the AI through **one OpenAI-compatible client**. The provider is only configuration in `.env`; no code changes. Pick one:

| Option | Cost | Privacy | Best for |
|---|---|---|---|
| **Groq** (default for the hosted demo) | Free tier, no credit card | Text sent to Groq | Trying it online, fast live judging |
| **LM Studio** (local) | Free | **Nothing leaves your computer** | Family mode, offline use, no account at all |
| **Ollama** (local) | Free | Nothing leaves your computer | Same as LM Studio, command-line |
| **Your own key** (OpenAI, OpenRouter, any compatible endpoint) | Your plan | Depends on the provider | If you already pay for one |
| **None** | Free | Nothing sent | Lexicon mode: a built-in Italian/English word list, no context understanding |

Only text is ever sent to the AI (finished sentences, the house rules, the fines list). Never audio.

## Groq (free, hosted)

1. Create a key at [console.groq.com](https://console.groq.com).
2. In `.env`:
```
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=gsk_...
AI_MODEL_FAST=llama-3.1-8b-instant
AI_MODEL_SMART=openai/gpt-oss-120b
```
Model names and free limits change: check the models page in the Groq console. Swear Jar batches the judge calls (one every ~3 s for the whole session) to stay inside free rate limits, and falls back to the lexicon if it gets rate-limited.

## LM Studio (local, private)

1. Install [LM Studio](https://lmstudio.ai), download an instruct model with good multilingual support (7–8B is enough; a Qwen instruct model handles Italian well).
2. Developer tab → **Start server** (default `http://localhost:1234`).
3. In `.env`:
```
AI_BASE_URL=http://localhost:1234/v1
AI_API_KEY=lm-studio
AI_MODEL_FAST=<model id shown in LM Studio>
AI_MODEL_SMART=<same or a bigger model>
```
The app must run on the same machine (or LAN) as LM Studio, so this is for `npm run dev` / self-hosting, not for the public Render demo.

## Ollama (local)

```
ollama pull qwen2.5:7b
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL_FAST=qwen2.5:7b
AI_MODEL_SMART=qwen2.5:7b
```

## Any other OpenAI-compatible endpoint

Set `AI_BASE_URL`, `AI_API_KEY` and the two model names. The endpoint must support chat completions; JSON-schema output is used when available, otherwise JSON mode, and every answer is validated by the app anyway.

## How to tell which one is active

The live screen shows a small badge: `AI: Groq · llama-3.1-8b-instant`, `AI: local`, or `Lexicon mode`. `GET /api/health` returns the same information (never the key).
