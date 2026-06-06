import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 30000 });
// wait for the forecast to auto-load (coverage badge text)
await page.waitForTimeout(6000);

const bodyText = (await page.innerText("body")).slice(0, 700);
const hasChart = await page.locator(".js-plotly-plot").count();
const tabs = await page.locator(".tabs button").allInnerTexts();

await page.screenshot({ path: "render.png", fullPage: true });
await browser.close();

console.log("=== CONSOLE ERRORS ===");
console.log(errors.length ? errors.join("\n") : "(none)");
console.log("=== TABS RENDERED ===");
console.log(JSON.stringify(tabs));
console.log("=== PLOTLY CHARTS ON PAGE ===", hasChart);
console.log("=== VISIBLE TEXT (first 700 chars) ===");
console.log(bodyText);
