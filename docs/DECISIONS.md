# Decisions

One line per decision taken during the build that `CLAUDE.md` did not settle. Newest at the bottom.

- 2026-11-12: Stack is Next.js + TypeScript on Render; state in memory with JSON snapshots, no database (one-day build).
- 2026-11-12: One device per player instead of speaker diarization.
- 2026-11-12: The AI classifies, code prices; the hold amount is the hard cap.
- 2026-11-12: Build started at 15:05 instead of 13:00, so the spec time boxes shift by ~2 h; cut order of CLAUDE.md §9 applied early: share card PNG, OG image and hero GIF are last and optional.
- 2026-11-12: Groq lists `llama-3.1-8b-instant` as Enterprise/contact-sales now; defaults are `openai/gpt-oss-20b` (judge) and `openai/gpt-oss-120b` (rules, report) with `reasoning_effort: "low"`.
- 2026-11-12: No login: each browser keeps its `playerId` in localStorage. Good enough for a sandbox demo; a stolen playerId can only post utterances/votes in that jar, never move money beyond the holds the player approved.
- 2026-11-12: SSE sends the full public session state on every change instead of granular events: sessions are tiny and it removes a whole class of client sync bugs.
- 2026-11-12: Base tier ids (mild, strong, blasphemy, slur) are always present in a RuleSet, so the lexicon fallback can price a hit under any custom house rules.
- 2026-11-12: Family-mode sponsored players are covered by one parent hold of cap × (1 + sponsored players); settlement captures the sum of each covered player's fines (each clamped to the per-player cap) from that one authorization.
- 2026-11-12: Render free instances have an ephemeral disk and sleep after inactivity: snapshots to DATA_DIR only survive process restarts, not redeploys. Accepted for a demo.
- 2026-11-12: Background test (Chrome tab hidden behind full-screen Minecraft, Windows 11): Web Speech kept delivering final results while hidden. Recommended setup: the Swear Jar tab open in Chrome next to the game; phone on the desk as the alternative.
