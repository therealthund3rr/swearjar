# Devpost submission draft

Paste into the Devpost form. Before submitting, **delete every claim the build does not actually do.**

---

## Name
Swear Jar

## Tagline (short)
A swear jar that listens. Put a PayPal hold on the jar, talk, and pay only for what you said.

## Inspiration
A swear jar is a commitment device, but in practice nobody counts, nobody pays, and arguing about whether a word counts ruins the game. We wanted a jar that counts the words, understands whether a word was a swear or just a mention, and collects the money from a hold that each player approved in advance.

## What it does
- A group creates a jar and writes its house rules in plain language (for example: "blasphemy 2 euros, swears 50 cents, 'damn' is free, double during overtime").
- AI compiles the rules into a price list. The creator checks it as a table and confirms it.
- Every player approves a **PayPal authorization hold** for the jar's cap (for example $10). Nothing is charged. A session cannot start until every player has a hold.
- During the session each player's browser transcribes only that player's speech, on that player's device. An **AI judge** reads each sentence in context: it tells a swear from a mention of a word, and it catches asterisk-masked and leetspeak words. Code prices each fine from the approved rules. Fines appear in the jar live. Any player can raise an **Objection!** within 30 seconds, and the other players vote keep or drop.
- When the session ends, PayPal **captures exactly what each player owes from their own hold** (one partial capture, never above the cap) and **voids** the hold of each player who had no fines. The money goes to the beneficiary account set on the server, a sandbox business account standing in for a charity or group fund.
- Each player gets a short AI report at the end, and a public receipt page shows the amounts and statuses.

## How we built it
- **PayPal (sandbox):** Orders v2 `POST /v2/checkout/orders` with `intent: AUTHORIZE` and the beneficiary as `payee`, approved with the PayPal JS SDK buttons, then `POST /v2/checkout/orders/{id}/authorize`. At the end, `POST /v2/payments/authorizations/{id}/capture` with `final_capture: true` for the fines total, or `POST /v2/payments/authorizations/{id}/void` for a clean player. Every write sends a `PayPal-Request-Id` idempotency key. OAuth tokens are fetched on the server, and the client secret never reaches the browser.
- **Money:** integer cents everywhere. A session's total for a player can never exceed that player's hold.
- **AI:** an OpenAI-compatible client. The hosted demo uses Groq's free tier with `openai/gpt-oss-20b` as the live judge (one batched call about every 3 seconds for the whole session) and `openai/gpt-oss-120b` for the rule compiler and the report. The AI classifies and never sets an amount and never calls PayPal. Every AI answer is validated with zod. With no AI key, a built-in word list of about 85 English and Italian roots does the judging, and the screen says so.
- **App:** Next.js 15 (App Router) with TypeScript. API routes for PayPal and AI. Server-Sent Events push the full session state to the jar screen on each change. The browser uses the Web Speech API (Chrome and Edge, English only), with a type mode as fallback. GSAP animates the coin drop. Tests: 71 unit tests with vitest. Hosted on **Render** (free instance). A Postman collection of the API is in the repo.

## Challenges we ran into
- **A model was withdrawn on build day.** Groq moved `llama-3.1-8b-instant` to enterprise-only, so we switched the judge to `openai/gpt-oss-20b` and the rules and report to `openai/gpt-oss-120b`.
- **A player without a hold could be fined.** In the first real test, a player with no hold collected fines that could never be captured. Now every player must have an approved hold before the session starts, and utterances from a player without a hold are rejected.
- **Idempotency keys had to include the order id.** A replayed `PayPal-Request-Id` returns the old order, so the key is built from the order or authorization id it protects.
- **Live updates through the proxy.** Server-Sent Events needed gzip disabled and a 2 KB padding comment sent with the stream, so that the proxy flushed each event.
- **Browsers write swears with asterisks.** Speech recognition often outputs "sh*t" or "f**k", so the judge has to recognise masked words.
- **Ties in a two-player jar.** With two players, an objection always tied (one vote each) until the objector's own vote counted.

## Accomplishments that we're proud of
- The money logic is simple on purpose: integer cents, a hard cap equal to the hold, one capture or one void per player, retries per player if a capture fails.
- The judge separates a swear from a mention of the same word.

## What we learned
- Let the AI classify and let code price. The price is then checkable, and the cap can never be exceeded by a model's answer.
- Check the money state at the start of the session, not only at the end. The hold check at start is what stopped unbilled fines.
- An idempotency key has to identify the exact request it protects, not just the operation.
- Speech recognition needs a fallback (type mode) and the judge needs to read what the recognizer writes, not what people meant to say.

## What's next
Family mode in the UI (a parent covers sponsored players, and every fine suggests a cleaner word), more UI and speech languages, a shareable card, webhooks for capture status, Discord posting, and an evaluation set for the judge.

## Built with
paypal, paypal-orders-v2, paypal-payments-v2, paypal-js-sdk, groq, gpt-oss, nextjs, typescript, tailwindcss, zod, gsap, web-speech-api, server-sent-events, render, postman, vitest

## Links
- Repo: https://github.com/therealthund3rr/swearjar
- Live demo: https://swearjar-4wsb.onrender.com (free instance: the first load can take about a minute while it wakes up)
- Video: https://www.youtube.com/watch?v=5XaYjLzjvic

## Testing instructions for judges
- **Sandbox only. No real money moves.**
- Log in at the PayPal button with the sandbox buyer account: email `SANDBOX_BUYER_EMAIL`, password `SANDBOX_BUYER_PASSWORD`. The account was created only for judging.
- Create a jar, and **leave the payee email empty** when creating it.
- Microphone: use **Chrome or Edge**. On other browsers, use type mode. Or add `?demo=1` to the session URL for a scripted conversation.
- **Cold start:** the free Render instance sleeps when idle. The first load can take about **1 minute**. Wait for the page before you create a jar.
- To try the whole flow alone, use one buyer account and press **Start a solo test run**.
