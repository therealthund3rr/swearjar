# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

Hackathon build for the PayPal AI Hackathon 2026 (submission 12 November 2026). Version 0.1.0 in `package.json`.

### Added

- _Fill in at the end of the build, listing only what works._
- Jars with house rules written in plain language and compiled by AI into a reviewed rule set.
- PayPal sandbox authorization holds per player, partial capture of the exact fines at the end, void for clean players.
- Live AI judge on per-player speech (Web Speech API) or typed text, with a lexicon fallback.
- Objections and votes on uncertain fines.
- End-of-session report and receipt page.

### Known limitations

- Speech recognition works best in Chrome and Edge.
- In-memory sessions on a single server instance.
- Sandbox only.
