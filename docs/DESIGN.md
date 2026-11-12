# Design: "Yellow card"

A swear costs you a card. The whole app looks like a referee's yellow card crossed with a censored comic strip: loud, physical, a little cheeky, and never like a SaaS dashboard.

## Tokens (all defined in `src/app/globals.css`)

| Name | Hex | Use |
|---|---|---|
| Yolk | `#FFD21F` | The page. Always yellow, no dark mode |
| Paper | `#FFFAF0` | Panels (stickers on the page) |
| Ink | `#17120A` | Text, 2.5 px outlines, hard 4 px shadows, censor bars |
| Bleep | `#E5252A` | Fines, the live-mic dot, destructive actions |
| Hold | `#0B4FD6` | Everything PayPal: "on hold", "captured" |
| Clean | `#12855A` | "Voided", clean mouth |

Type: **Archivo** variable, one family. Display = condensed (`font-stretch: 68%`), weight 900, uppercase, tight (class `.display`, and every `h1–h3`). Text = normal width, 500–700. Amounts use `.money` (condensed, tabular numbers). No monospace face anywhere.

## Signature

**The censor bar.** A swear is never printed: it is a black bar with yellow asterisks, slightly rotated (`.censor`). It appears in the hero, on every fine card and in the report. Nothing else on a screen competes with it.

## Rules

- Panels are `.card`: paper, ink outline, hard offset shadow, no soft grey shadows, no gradients.
- Buttons are pills that physically press down (`.btn`, `.btn.primary` = ink on yellow).
- One screen, one job, one big thing: the headline on Home, the code on "jar ready", the hold amount in the lobby, the jar on Live, the bill on End.
- Left-aligned text. Centre only the single big thing on a screen.
- Money is always huge and always formatted (`$1.50`).
- PayPal states are always blue badges with the exact words: `On hold`, `Captured $1.50`, `Voided`.
- Sentence case in body copy; only display type is uppercase. No eyebrow labels, no "01 / 02 / 03" unless it is a real sequence (Hold, Talk, Settle is one).
- Motion: only when something happens. A coin drops into the jar when a fine lands (GSAP: fall, bounce, settle), the amount counts up, a dropped fine gets struck through. No entrance animations on scroll, no hover effects beyond the button press. Respect `prefers-reduced-motion`.
- Copy is short and cheeky, never corporate: "Put your money where your mouth is", "Clean mouth. Nothing charged."
