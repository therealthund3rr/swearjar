# Presentation playbook

Everything needed to present Swear Jar to the PayPal AI Hackathon jury: the demo video, the media, the repo, and the Devpost page. **Everything is in English.** The jury is PayPal (a US company) plus sponsors; they will skim the Devpost page, open the video, and maybe click the demo. Assume each judge gives the project **3–5 minutes in total**.

What the jury must understand in the first 20 seconds:
1. **What it is:** a swear jar that listens and collects.
2. **Why PayPal is central:** authorization hold → partial capture of the exact fines → void for clean players. Not a checkout button bolted on.
3. **Why AI is central:** it understands context (swear vs mention), dodges, dialect, and house rules written in plain language. And it runs on free/local models.

Keep repeating one sentence everywhere (video, README, Devpost, thumbnail): **"A swear jar that listens. Pay only for what you said."**

---

## 1. The demo video ("showreel")

Hard rules: **under 3:00** (aim 2:30–2:45), **public** on YouTube (not unlisted, not private), shows the **real app working** (judges penalize mockups), English voice-over or English captions burned in.

### 1.1 Recording setup
- **Two players, two screens:** Chrome profile A and Chrome profile B side by side on one monitor (each logged into a different **sandbox buyer** account at the PayPal step), or laptop + Android phone mirrored with `scrcpy`. Side by side is clearer: the jury sees both jars react.
- A third tab: **PayPal sandbox dashboard** (developer.paypal.com → Testing tools → Sandbox accounts / the business account's activity) to prove the capture and the void happened.
- **OBS**: 1920×1080, 60 fps, two scenes ("full screen" and "zoom on one browser"). Record the voice on a separate track (your mic), and app sounds on another (coin drop).
- Clean browser: hide bookmarks bar, 110–125% zoom so text is readable on a phone, dark mode on, notifications off.
- Use the **hosted Render URL** in the recording (it proves it is deployed), not localhost. Wake the free instance 2 minutes before recording.
- Pre-write the lines each player says so every take produces: one real fine, one mention that is **not** fined, one dodge/dialect that **is** fined, one clean player.

### 1.2 Shot list and voice-over (English, ~330 words at a calm pace)

| Time | Shot | Voice-over |
|---|---|---|
| 0:00–0:08 | **Cold open:** real footage of friends at a table/console, someone swears, a real glass jar with coins. Hard cut to the app logo. | "Every group has a swear jar. Nobody counts. Nobody pays." |
| 0:08–0:15 | Home screen, tagline animates in | "So we built one that listens, and lets PayPal collect. Swear Jar: pay only for what you said." |
| 0:15–0:40 | `/new`: choose 🍕 Party, type house rules **in Italian** (show EN subtitle), press *Compile*, rules table appears, *Looks right*, QR + code | "We write the house rules the way we talk, even in Italian. The AI turns them into a price list, and we approve it. The AI never sets prices on its own." |
| 0:40–1:00 | Player A and B scan/join, PayPal popup (sandbox), approve, "🔒 $15.00 on hold" on both | "Each player puts a PayPal authorization on the jar. Fifteen dollars held, nothing charged. That's the most anyone can lose." |
| 1:00–1:45 | **Live session**, split screen. A swears → coin drops, fine card with AI reason. A says *"the word … comes from Latin"* → card: "mention, no fine". A dodges with a euphemism/dialect → fined. B raises **Objection!** on a borderline one → vote → dropped. B stays clean. | "The judge reads context. Swearing costs money; talking about a word doesn't. Dodges and dialect don't get past it. And if you disagree with a fine… objection. The group votes." |
| 1:45–2:10 | *End session.* A: "Captured $2.75 — capture ID …". B: "Voided — clean mouth 😇". Then the sandbox dashboard with both transactions. | "When the game ends, PayPal captures exactly what each player said, from their own hold, never more. The clean player's hold is voided. These are real sandbox transactions: one partial capture, one void." |
| 2:10–2:25 | AI report card ("The Sailor"), share card. Then 5 s of 🏡 Family mode: parent adds a sponsored kid, a fine card shows "try *mannaggia* instead". | "Everyone gets a report. And at home, Family mode lets a parent cover the kids, and every fine teaches a better word. Always visible, never a spy tool." |
| 2:25–2:38 | Architecture slide (one image, see 1.4) | "Under the hood: PayPal Orders and Payments v2 with idempotent calls, and open AI models: free on Groq, or fully local in LM Studio, so nothing leaves your house." |
| 2:38–2:45 | End card: logo, tagline, repo URL, demo URL | "Swear Jar. Open source. Pay only for what you said." |

### 1.3 Editing (Premiere Pro / After Effects)
- **Bleep every real swear** with a classic 1 kHz beep and a small animated "BLEEP" sticker over the mouth/subtitle. It is funnier and keeps the video brand-safe for a corporate jury.
- **Burned-in English captions** for the whole video (many judges watch muted). Italian lines get English subtitles.
- **Zoom-ins** (scale 100→140%, ease) on: the PayPal approval, the "$15 on hold" badge, each fine card, the capture/void result. The jury must read amounts without pausing.
- **Callout labels** (lower-thirds) the first time each PayPal concept appears: `Orders v2 · intent AUTHORIZE`, `Partial capture · final_capture: true`, `Void`. This is what PayPal engineers want to see.
- Coin sound on every fine (from the app or a royalty-free SFX). Music: royalty-free only (YouTube Audio Library), low under the voice, no copyrighted tracks.
- Pace: no shot longer than ~6 s without movement or a zoom. Cut dead time while the AI thinks, but leave **one** uncut moment of live judging to prove it is real-time.
- Export: H.264, 1080p, 2-pass or high bitrate, -14 LUFS audio.

### 1.4 The architecture image (also used in README and Devpost)
One clean 16:9 diagram, readable on a phone:
```
Phone A ─┐  speech → text (browser)          ┌── PayPal Orders v2: create (AUTHORIZE) → authorize
Phone B ─┼─► Swear Jar server (Next.js) ─────┤── PayPal Payments v2: capture (partial, final) | void
Phone C ─┘   rules · fines · cap · SSE        └── AI (OpenAI-compatible): Groq free  |  LM Studio local
                                                   rule compiler · live judge · report
```
Agents generate it as an SVG in `docs/media/architecture.svg` and export a PNG.

### 1.5 YouTube upload
- **Title:** `Swear Jar — a swear jar that listens (PayPal AI Hackathon 2026)`
- **Visibility: Public.** Check it opens in an incognito window.
- **Description:** the tagline, 3 bullet points (hold / judge / capture-void), links to repo and live demo, "Built with PayPal sandbox (Orders v2, Payments v2, JS SDK) and open AI models (Groq / LM Studio)", chapters:
  ```
  0:00 The problem
  0:15 House rules → AI price list
  0:40 PayPal authorization hold
  1:00 Live AI judge
  1:45 Partial capture & void
  2:10 Report & Family mode
  2:25 How it's built
  ```
- **Thumbnail** (1280×720): glass jar full of coins, a bleeped speech bubble `#$@&!`, big text "PAY ONLY FOR WHAT YOU SAID", small PayPal-blue accent. Do **not** use the PayPal logo as if it were an official product; write "Built on PayPal" in text if needed.

---

## 2. Media for the repo and Devpost (`docs/media/`)

| File | What | Notes |
|---|---|---|
| `hero.gif` | 6–8 s loop: coins dropping into the jar, a fine card appearing | ~800 px wide, < 10 MB. Top of the README |
| `screens/01-home.png` … `05-end.png` | home, create (rules table), join (PayPal hold), live, end (capture + void) | Mobile frames (390×844) and one desktop shot. Generated with `npm run shots` (Playwright) |
| `architecture.svg` / `.png` | the diagram in 1.4 | |
| `thumbnail.png` | 1280×720 YouTube thumbnail | |
| `devpost-cover.png` | Devpost thumbnail, **3:2** (e.g. 1500×1000) | Same art as the YouTube thumbnail, re-framed |
| `devpost-gallery/` | 4–6 images, 3:2: the five screens with a one-line caption each, plus the architecture | Captions in English |
| `social-preview.png` | GitHub social preview, 1280×640 | Repo → Settings → Social preview |

---

## 3. What the repo must contain at submission

- [ ] **Public** repo `therealthund3rr/swearjar`, MIT `LICENSE` at the root (Devpost checks the license).
- [ ] GitHub **About**: description = tagline, website = Render URL, topics: `paypal`, `paypal-api`, `hackathon`, `ai`, `llm`, `groq`, `lm-studio`, `nextjs`, `typescript`, `speech-recognition`.
- [ ] README top: hero GIF, one-line pitch, **Live demo** and **Video** links, the two modes, "How it works" in 3 steps. Then: status (honest), how PayPal is used, how the AI decides, AI providers (free / local / bring your own), privacy, run locally, deploy, layout, roadmap, license, credits.
- [ ] `docs/AI_PROVIDERS.md` (Groq / LM Studio / Ollama / any OpenAI-compatible key).
- [ ] `docs/media/` filled (section 2), architecture diagram in the README.
- [ ] `postman/swearjar.postman_collection.json` (Postman sponsor prize) and `render.yaml` (Render sponsor prize).
- [ ] `.env.example` complete, **no secrets** anywhere in history (`git log -p | grep -i secret` before going public; rotate any key that was ever committed).
- [ ] Tests green; `CHANGELOG.md` and the README "What works" list match reality.
- [ ] A tag `v0.1.0-hackathon` on the submitted commit, so judges see exactly what was submitted even if you keep working later.

---

## 4. Devpost page

Text draft: [`DEVPOST.md`](DEVPOST.md). Additionally:
- **Cover image:** `devpost-cover.png` (3:2).
- **Gallery:** the 3:2 images with captions, in story order (rules → hold → live → capture/void → report → architecture).
- **"Try it out" links:** live demo URL first, GitHub second.
- **Video:** the YouTube link.
- **Built with:** the tags in DEVPOST.md.
- **Testing instructions for judges** (important, judges get stuck on PayPal logins):
  - one dedicated **sandbox buyer** email + password created only for judging (never your real PayPal);
  - "Use Chrome or Edge for the mic, or type mode, or `?demo=1`";
  - "The free Render instance can take ~1 minute to wake up";
  - "To run fully locally with no API key: LM Studio, see docs/AI_PROVIDERS.md".
- Fill in "Challenges" and "What we learned" with **true** specifics from the build day (e.g. "the browser writes swears with asterisks", "free-tier rate limits forced batching"). Concrete beats generic.
- Sponsor prizes to tick on the form: **Render** (hosted there) and **Postman** (collection in repo), only if actually done.

---

## 5. Final hour checklist (Rome time)

- 19:45 video exported and uploaded **public**; link copied.
- 20:00 README links filled (demo + video), media committed, repo public, tag pushed.
- 20:10 Devpost: all fields, images, links, judge test account. **Submit.**
- 20:20 Open the Devpost page in incognito: video plays, demo opens, repo opens.
- Deadline 21:00. Edits are allowed until then; after that nothing.
