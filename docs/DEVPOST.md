# Devpost submission draft

Paste into the Devpost form. Before submitting, **delete every claim the build does not actually do.**

---

## Name
Swear Jar

## Tagline (short)
A swear jar that listens. Put a PayPal hold on the jar, talk, and pay only for what you said.

## Inspiration
Every Italian family, office and Discord server has someone who promises to stop swearing. The swear jar is the oldest commitment device there is, and it never works: nobody counts, nobody pays, and arguing about whether "porca miseria" counts ruins the fun. We wanted a jar that counts fairly, understands context and dialect, and collects the money without anyone chasing anyone.

## What it does
Two ways to play on the same engine: **Party** (friends, fines fund the dinner, worst mouth pays the most) and **Family** (a parent covers the kids, fines go to a cause the family chose, every fine suggests a cleaner word; always visible, never a spy tool).

- A group creates a jar and writes its house rules in plain language, in any language ("bestemmie 2€, parolacce 50 cent, 'cavolo' is free, double during penalties").
- AI compiles the rules into a typed rule set; the creator confirms it as a table.
- Each player joins from their own phone and approves a **PayPal authorization hold** for the cap (e.g. $10). Nothing is charged.
- During the session each player's own device (the PC they game on, next to any voice chat, or their phone on the desk) transcribes only its owner's speech, locally. No bot listens to the call, and muting yourself in the call doesn't hide you from the jar. An **AI judge** reads every sentence in context and decides whether it is a swear, a mere mention, a dodge or an allowed word, and how bad it is. Code prices it from the rules. Coins drop into the jar live; anyone can raise an **Objection!** and the group votes on uncertain fines.
- When the session ends, PayPal **captures exactly what each player owes from their own hold** (partial capture, never above the cap) and **voids** the hold of anyone who stayed clean. The money goes to the beneficiary: a charity or the group's fund.
- Everyone gets a short, kind AI report: top word, worst minute, a title, and cleaner alternatives for next time.

## How we built it
- **PayPal (sandbox):** Orders v2 with `intent: AUTHORIZE` and the PayPal JS SDK buttons for the hold; Payments v2 to capture a partial amount with `final_capture: true` or to void; `PayPal-Request-Id` on every write for idempotency; OAuth client-credentials token cached server-side.
- **AI (open models, free):** an OpenAI-compatible client pointed at Groq's free tier for the hosted demo, or at a local model in LM Studio so nothing leaves the house. A fast model is the live judge (structured JSON, temperature 0, batched every few seconds); a stronger one compiles the rules and writes the report. All outputs are validated with zod; the AI never sets an amount and never calls PayPal. A built-in lexicon is a fallback when no AI key is configured.
- **App:** Next.js + TypeScript, server routes for PayPal and AI, Server-Sent Events for the live jar, Web Speech API in the browser (type mode as fallback). Hosted on **Render**. Postman collection of our API included.

## Challenges we ran into
_Fill in honestly at the end (e.g. speech recognition on mobile, sandbox payee setup, mentions vs uses)._

## Accomplishments that we're proud of
- The money logic is boring on purpose: integer cents, a hard cap equal to the hold, one idempotent capture or void per player.
- The judge tells "che cazzo fai" from "the word 'cazzo' comes from Latin".

## What we learned
_Fill in._

## What's next
Announcements in Discord and voice-chat channels, week-long office jars with reauthorization, more languages, and a proper evaluation set for the judge.

## Built with
paypal, paypal-orders-v2, paypal-payments-v2, paypal-js-sdk, groq, lm-studio, llama, gpt-oss, nextjs, typescript, tailwindcss, zod, web-speech-api, server-sent-events, render, postman, vitest

## Links
- Repo: https://github.com/therealthund3rr/swearjar
- Live demo: _<Render URL>_ (free instance: the first load can take up to a minute while it wakes up)
- Video: _<YouTube URL>_

## Note for judges (testing)
- Sandbox only. To test the payment flow, log in at the PayPal button with a sandbox buyer account: _<sandbox buyer email / password, created only for judging>_.
- Microphone: Chrome or Edge. On other browsers use type mode, or add `?demo=1` to the session URL for a scripted conversation.
