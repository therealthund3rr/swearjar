# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-11-12

Hackathon build for the PayPal AI Hackathon 2026. Built in one day. Sandbox only.

### Added

- Jars with house rules written in plain language. The AI compiles them into a rule table that the creator confirms before anyone joins.
- PayPal sandbox holds per player: Orders v2 with `intent: AUTHORIZE`, approval with the PayPal JS SDK, then the authorization.
- Partial capture of the exact fines at the end (`final_capture: true`, never above the hold), and void for clean players.
- Idempotent settlement: a failed capture can be retried per player.
- Live AI judge on per-player speech (Web Speech API in Chrome or Edge, or typed text), with batched calls every ~3 seconds.
- Word-list mode when no AI key is set, and an "AI busy" badge when a batch falls back to the word list.
- Objections (30 s window) and keep/drop votes (20 s), with contested fines.
- Cross-talk guard: the same word from two players within 3 seconds fines only the earliest.
- Creator multiplier toggle, when the rules define one.
- Solo test run with one player.
- `?demo=1` scripted session.
- End-of-session report per player, and a public receipt page with amounts and statuses only.
- Postman collection of the API.

### Known limitations

- Speech recognition works in Chrome and Edge only, in English (en-US) only. Other browsers need type mode.
- One device per player.
- Sessions are in memory on a single instance, with JSON snapshots. They do not survive a redeploy (Render free disk is ephemeral).
- The AI judge is not benchmarked. LM Studio and Ollama are not tested in this build.
- No login: the player id lives in each browser's localStorage.
- Family mode is in the engine and the API but hidden in the UI.
- English-only UI.
- Sandbox only. No real money moves.
