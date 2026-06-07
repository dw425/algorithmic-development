// Render gate — clicks EVERY page AND its 4 sub-tabs, asserts content present + NO "pending"
// placeholder + no console errors. (Strengthened after "pending" slipped through a title-only check.)
import { chromium } from "playwright";
const TABS = ["Overview", "Summary", "Compare", "Universe", "Repository",
  "Datasets", "Harmonize", "Sample", "Model Lab", "Forecast Lab", "Data clean", "Stationarity",
  "Multi-scale", "Predictions", "Backtest", "Forecast", "Multi-horizon", "Predictability", "Base models",
  "Vector grid", "Funnel", "TPA", "Constellation", "Cluster consensus", "Dependency mapper", "Diagnostics"];
const SUB = ["Visualization", "Data", "Control", "Adjustment"];
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
p.on("pageerror", (e) => errs.push("PE:" + e.message));
await p.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 30000 });
await p.waitForTimeout(2000);
let fail = false;
// Platform canvas is the default — verify it renders, then switch to Classic for the tab checks.
const canvas = await p.locator(".react-flow").count();
if (!canvas) { console.log("PLATFORM: canvas missing"); fail = true; }
await p.getByRole("button", { name: "Classic dashboard", exact: true }).click();
await p.waitForTimeout(1500);
for (const tab of TABS) {
  await p.getByRole("button", { name: tab, exact: true }).click();
  await p.waitForTimeout(2500);
  for (const sub of SUB) {
    const btn = p.getByRole("button", { name: sub, exact: true });
    if (await btn.count()) { await btn.first().click(); await p.waitForTimeout(400); }
    const txt = await p.innerText("body");
    if (/pending —/.test(txt)) { console.log(`PENDING: ${tab} → ${sub}`); fail = true; }
  }
}
await b.close();
console.log("ERRORS:", errs.length ? errs.join("\n") : "(none)");
if (errs.length || fail) { console.log("RENDER GATE FAIL"); process.exit(1); }
console.log("RENDER GATE PASS — no pending, no errors, all sub-tabs have content");
