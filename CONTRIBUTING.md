# Contributing to Swear Jar

Thanks for your interest. Swear Jar started as a one-day hackathon project maintained by one person, so replies may be slow. Please be kind: see the [Code of Conduct](CODE_OF_CONDUCT.md).

## Set up

You need Node.js 20+ and a free PayPal developer account (sandbox). An AI endpoint is optional: a free Groq key, or a local model in LM Studio. Without one the app runs in lexicon mode.

```
git clone https://github.com/therealthund3rr/swearjar.git
cd swearjar
npm install
cp .env.example .env
npm run dev
```

## Tests and checks

Run these before opening a pull request:

```
npm test
npm run typecheck
npm run lint
npm run build
```

A change should come with a test where the code is testable. The money logic (`src/lib/money.ts`, `src/lib/fines.ts`, `src/server/settle.ts`) is written as pure functions with a mocked PayPal client precisely so it can be.

## Conventions

- **English** for code, identifiers, comments, commit messages and docs. User-visible strings live in `src/lib/i18n.ts` (English and Italian).
- **Money is integer cents.** No floating-point math on amounts. Amounts become `"1.75"` strings only at the PayPal boundary.
- **The AI never decides money.** It returns JSON that is validated with zod; prices, caps and captures are computed by code.
- **Every PayPal write call is idempotent** (`PayPal-Request-Id`). Keep it that way.
- Comments explain *why*, briefly.
- Keep it small: no new heavy dependency, database or architecture change without opening an issue first.

## Rules a contribution must keep

1. A player can never be charged more than the hold they approved.
2. No audio is recorded, stored or uploaded by the app.
3. Sentences without a fine are not stored.
4. No secrets in the browser or in logs.
5. Hateful slurs are never turned into a joke, a badge or a leaderboard entry.

## Proposing changes

1. For anything beyond a small fix, open an issue first (use the templates).
2. Fork, create a branch, make the change in small commits with clear English messages.
3. Open a pull request describing what changed and how you tested it. For changes to payments, say which sandbox flow you ran (capture, void, retry).

Never attach real PayPal credentials, access tokens or recordings of other people to an issue or pull request. To report a vulnerability, follow [SECURITY.md](SECURITY.md).
