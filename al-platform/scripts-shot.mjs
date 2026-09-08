import { chromium } from "playwright-core";
import { execSync } from "node:child_process";

const OUT = "/tmp/claude-0/-home-user-AL/8a2d7dd0-65e7-5519-bb23-5b010373ef0b/scratchpad";
const exe = execSync("ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1").toString().trim();
if (!exe) { console.error("no chromium exe"); process.exit(1); }

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1120, height: 920 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto("http://localhost:8093/", { waitUntil: "networkidle" });
await page.waitForSelector("#rows tr");
await page.screenshot({ path: `${OUT}/dashboard-light.png` });
await page.click("#rows tr");
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/dashboard-transcript.png` });
await browser.close();
console.log("shots done");
