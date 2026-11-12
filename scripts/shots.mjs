// npm run shots — screenshots of every screen into docs/media/screens/.
// Needs `npm run dev` running (the dev-only /api/dev/seed route fakes the PayPal holds; it is disabled in production)
// and a local Google Chrome (playwright-core drives the installed browser, nothing is downloaded).
import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.SHOTS_BASE || "http://localhost:3000";
const OUT = "docs/media/screens";
fs.mkdirSync(OUT, { recursive: true });

const post = async (path, body) => (await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();

const live = await post("/api/dev/seed", {});
const lines = [
  [0, "Oh shit, he flanked us from behind!"],
  [0, "Fun fact: the word fuck probably comes from an old Germanic verb."],
  [0, "Holy f*** I lost again!"],
  [1, "Nice shot, well played everyone."],
  [0, "What a crappy move, damn it."],
];
for (const [who, text] of lines) await post(`/api/sessions/${live.code}/utterances`, { playerId: live.playerIds[who], text, ts: Date.now() });
await new Promise((r) => setTimeout(r, 6000)); // let the judge batch land
const ended = await post("/api/dev/seed", { ended: true });

const browser = await chromium.launch({ channel: "chrome" });
async function shoot(name, path, { width, height }, storage = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  await ctx.addInitScript((items) => { for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v); }, storage);
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await ctx.close();
  console.log("saved", name);
}

const phone = { width: 390, height: 844 };
const desk = { width: 1440, height: 900 };
const me = (s) => ({ [`swearjar:player:${s.code}`]: s.playerIds[0] });

await shoot("01-home", "/", phone);
await shoot("01-home-desktop", "/", desk);
await shoot("02-create", "/new", phone);
await shoot("04-live", `/s/${live.code}`, phone, me(live));
await shoot("04-live-desktop", `/s/${live.code}`, desk, me(live));
await shoot("05-end", `/s/${ended.code}/end`, phone, me(ended));
await shoot("05-end-desktop", `/s/${ended.code}/end`, desk, me(ended));
await browser.close();
