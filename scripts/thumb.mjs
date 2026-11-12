// node scripts/thumb.mjs <html file> <out png> — renders a 1280x720 thumbnail with the local Chrome.
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
const [, , html, out] = process.argv;
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
await p.waitForTimeout(800);
await p.screenshot({ path: out });
await b.close();
