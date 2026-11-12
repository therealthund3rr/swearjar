# Swear Jar

[![PayPal Sandbox](https://img.shields.io/badge/PayPal-sandbox-003087)](https://developer.paypal.com)
[![AI: open models](https://img.shields.io/badge/AI-Groq%20%7C%20local%20LM%20Studio-F55036)](#how-the-ai-decides)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**The swear jar, rebuilt: an AI that actually listens, and PayPal that actually collects. Put a hold on the jar, talk, and pay only for what you said.**

Two ways to play:
- 🍕 **Party:** friends before a game night. Everyone's fines go to the dinner fund, so the worst mouth pays most of the pizza.
- 🏡 **Family:** a parent covers the kids (no PayPal needed for them), fines go to a cause the family picked, and every fine comes with a cleaner word to use next time. Everyone sees the jar: it is a game you play together, not a spy tool.

<!-- HERO: replace with docs/media/hero.gif (jar filling with coins during a session, ~800 px wide, 5-10 s loop). See docs/media/README.md. -->

**Live demo:** _<Render URL goes here>_ · **Video (under 3 min):** _<YouTube link goes here>_

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com) 2026. **Sandbox only: no real money moves.**

<!-- ARCHITECTURE: docs/media/architecture.png goes in "How PayPal is used" once generated. SCREENSHOTS: add a 5-column table of docs/media/screens/*.png under "How it works". -->

## How it works

1. **Hold.** Everyone joining a jar approves a PayPal authorization for the cap, say $10. Nothing is charged yet.
2. **Talk.** Each player's own phone or browser transcribes only their speech. An AI judge reads every sentence in context, using house rules the group wrote in plain language ("blasphemy $2, swears 50¢, 'damn' is free, double during penalty kicks"). Fines drop into the jar live, and anyone can shout **Objection!**
3. **Settle.** When the session ends, PayPal captures exactly what each player owes from their own hold, never more than the cap. Anyone with a clean mouth gets their hold voided. The money goes to the jar's beneficiary: a charity or the group's pizza fund.

### Playing in a voice chat

Made for friends gaming in a voice chat (Discord, in-game voice, any call) with headsets. Each player keeps the Swear Jar page open on the PC they play on, or on their phone next to them. It listens only to its owner, locally, so everyone is judged on their own voice, no bot hears the call, and muting yourself in the call does not hide you from the jar. In the same room, keep phones close: if two phones catch the same word, only the first one is fined and the group can contest it.

### "The worst mouth pays the dinner"

Fines are proportional: everyone pays exactly what they said into the dinner fund, so the worst mouth pays most of the pizza and the clean ones eat almost free. There is deliberately no "loser pays everything" mode: Swear Jar is a commitment device for your own words, not a prize game.

## Status: hackathon build

Swear Jar was built in one day for a hackathon. Be realistic about what that means.

What works:

- _Fill in at the end of the build: only list what was tested end to end._

What is rough or not proven:

- Speech recognition uses the browser's Web Speech API: it works in Chrome and Edge, it is unreliable on Safari/iOS (use type mode there), and it mishears words, especially in dialect.
- The AI judge was checked on a small set of Italian and English sentences, not benchmarked.
- The server keeps sessions in memory with a JSON snapshot. One instance, no database. Fine for a demo, not for production.
- Sandbox only. Moving to live PayPal would need a review of the payee model, fees and terms.

## How PayPal is used

The whole money flow is PayPal's **authorize, then capture or void** model (Orders v2 + Payments v2):

| When | Call | Why |
|---|---|---|
| A player joins | `POST /v2/checkout/orders` with `intent: AUTHORIZE`, amount = cap, approved with the PayPal JS SDK buttons | The player sees and approves the maximum they can lose up front |
| After approval | `POST /v2/checkout/orders/{id}/authorize` | Funds are held, not taken |
| Session ends, fines > 0 | `POST /v2/payments/authorizations/{id}/capture` with the exact total and `final_capture: true` | One partial capture; the rest of the hold is released |
| Session ends, no fines | `POST /v2/payments/authorizations/{id}/void` | Clean mouth, nothing charged |

Every write call carries a `PayPal-Request-Id`, so retries and double clicks cannot charge twice. Amounts are integer cents in the code. The client secret never leaves the server.

## How the AI decides

The AI classifies; **code decides the money.**

- **Rule compiler.** The group's rules, written in any language, are turned into a typed rule set (tiers, prices, free words, multipliers). The jar creator reviews it as a table and confirms it before anyone can join. Prices are clamped by code to the cap.
- **Live judge.** Every finished sentence is checked in context with the previous ones from the same player. It tells a swear from a mention ("the word 'cazzo' comes from Latin"), sees through dodges ("p0rc0 d**"), respects allowed words, and handles dialects and mixed languages. It returns JSON with a confidence score. Code drops mentions and low-confidence hits, sends uncertain ones to a player vote, prices the rest from the rules and never lets a player's total pass their cap.
- **Report.** At the end, a short, kind recap per player: top word, worst minute, a title, and two cleaner alternatives for next time.
- **Free and local-capable.** The AI is any OpenAI-compatible endpoint: the hosted demo uses open models on Groq's free tier; at home you can point it at a local model in LM Studio so nothing leaves your PC. With no AI configured, a built-in Italian/English word list does the judging, with a visible "lexicon mode" badge.

Hateful slurs are not treated as a game: they are hidden from the feed, charged at the top tier, and never joked about.

## AI providers

No paid AI is required. The app speaks to any OpenAI-compatible endpoint, set in `.env`:

- **Groq free tier** (used by the hosted demo),
- **LM Studio or Ollama on your own machine**, so not even text leaves your computer,
- **your own key** for any compatible provider,
- or **nothing**: lexicon mode.

Setup for each: [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md).

## Privacy

- Swear Jar never records or uploads audio. Transcription happens in the browser. Note that Chrome's and Edge's speech recognition sends audio to the browser vendor's speech service; that is outside this app's control.
- Only finished text sentences reach the server. Sentences without a fine are not stored (only the last three are kept in memory as context for the judge). Fined words are shown masked to other players.
- Everyone in a jar sees everyone's fines; the lobby says so before you join.
- Session data is deleted 24 hours after the session ends. Receipts keep only amounts, statuses and PayPal IDs.

## Run it locally

Prerequisites: Node.js 20+, a [PayPal developer account](https://developer.paypal.com) (free), and optionally a free [Groq API key](https://console.groq.com) or [LM Studio](https://lmstudio.ai) running a local model.

1. In the PayPal Developer Dashboard, sandbox mode: create an app (REST API) and copy its client ID and secret. Under **Sandbox accounts**, make sure you have at least one **personal** (buyer) account and one **business** account to act as the beneficiary.
2. Clone and configure:

```
git clone https://github.com/therealthund3rr/swearjar.git
cd swearjar
npm install
cp .env.example .env      # fill in the PayPal keys, the beneficiary email and (optionally) the AI endpoint
npm run dev               # http://localhost:3000
```

3. Create a jar, open the join link in a second browser profile, and approve the hold with a sandbox buyer account. Use Chrome or Edge for the microphone, or type mode anywhere. Add `?demo=1` to the session URL to play a scripted conversation instead of speaking.

Checks:

```
npm test            # unit tests (vitest): money, lexicon, fines, settlement
npm run typecheck
npm run lint
npm run build
```

A Postman collection of the app's API is in [`postman/`](postman/).

## Deploy

`render.yaml` deploys the app as a single Node web service on [Render](https://render.com). Set the same variables as in `.env.example` in the Render dashboard.

## Project layout

```
src/app/          pages and API routes (jars, players, PayPal, sessions, SSE events, receipts)
src/lib/          pure logic: money, lexicon, rules schema, fines, i18n, demo script
src/server/       PayPal client, AI calls, in-memory store, settlement
src/components/   jar animation, fine cards, PayPal hold button, scoreboard, mic
tests/            vitest unit tests
postman/          API collection
docs/             Devpost text, demo script, decisions, media
```

## Roadmap

Nothing here is a promise.

- Optional announcements in a Discord or voice-chat channel ("💸 Marco: $0.50, jar at $3.25").
- PayPal webhooks instead of polling for capture status.
- Shared jars that run for a week (a "no-swearing month" for an office), using reauthorization.
- More languages and a proper evaluation set for the judge.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Please be kind: see the [Code of Conduct](CODE_OF_CONDUCT.md). Security problems go through [SECURITY.md](SECURITY.md).

## License

MIT, see [LICENSE](LICENSE).

## Credits

Swear Jar is made by THUND3RR.

- [PayPal REST APIs](https://developer.paypal.com/api/rest/) (Orders v2, Payments v2) and the [PayPal JS SDK](https://developer.paypal.com/sdk/js/), sandbox environment.
- Open models served by [Groq](https://groq.com) (free tier) or run locally with [LM Studio](https://lmstudio.ai), for the rule compiler, the live judge and the report.
- [Next.js](https://nextjs.org), [Tailwind CSS](https://tailwindcss.com), [zod](https://zod.dev) and the other dependencies in `package.json`.
- Hosted on [Render](https://render.com).
