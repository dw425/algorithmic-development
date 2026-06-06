// Phase 3 (improved) — render gate: load page, capture console errors, ASSERT expected
// content present, screenshot. Fails if errors OR expected text missing (no silent blanks).
import { chromium } from "playwright";
const url = process.argv[2] || "http://127.0.0.1:5173/";
const out = process.argv[3] || "render.png";
const expect = process.argv[4] || "Algorithmic Forecasting";
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));
await p.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await p.waitForTimeout(2500);
const txt = await p.innerText("body");
await p.screenshot({ path: out, fullPage: true });
await b.close();
const missing = !txt.includes(expect);
console.log("ERRORS:", errs.length ? errs.join("\n") : "(none)");
console.log("EXPECTED CONTENT:", missing ? `MISSING "${expect}"` : "present");
console.log("BODY:", txt.slice(0, 300).replace(/\n+/g, " · "));
if (errs.length || missing) { console.log("RENDER GATE FAIL"); process.exit(1); }
console.log("RENDER GATE PASS");
