// Render gate for every BUILT component page. Add a tab name here as each component lands.
// Fails (exit 1) if any tab errors or its expected content is missing.
import { chromium } from "playwright";
const TABS = [
  ["Data clean", "Data clean"],
  ["Stationarity", "Stationarity"],
  ["Multi-scale", "Multi-scale"],
  ["Predictability", "Predictability"],
  ["Base models", "Base models"],
];
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
p.on("pageerror", (e) => errs.push("PE:" + e.message));
await p.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 30000 });
await p.waitForTimeout(2000);
let fail = false;
for (const [tab, expect] of TABS) {
  await p.getByRole("button", { name: tab, exact: true }).click();
  await p.waitForTimeout(3000);
  const txt = await p.innerText("body");
  const ok = txt.includes(expect);
  console.log(`${tab}: ${ok ? "PASS" : "MISSING CONTENT"}`);
  if (!ok) fail = true;
}
await b.close();
console.log("ERRORS:", errs.length ? errs.join("\n") : "(none)");
if (errs.length || fail) { console.log("COMPONENT RENDER GATE FAIL"); process.exit(1); }
console.log("COMPONENT RENDER GATE PASS");
