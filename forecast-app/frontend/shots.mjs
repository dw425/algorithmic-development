import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage();
await p.setViewportSize({width:1400,height:900});
await p.goto("http://127.0.0.1:5173/",{waitUntil:"networkidle",timeout:30000}); await p.waitForTimeout(2500);
for (const [tab,png] of [["Forecast","shot_forecast.png"],["Cluster consensus","shot_cluster.png"],["Repository","shot_repo.png"],["Multi-horizon","shot_horizon.png"]]) {
  await p.getByRole("button",{name:tab,exact:true}).click(); await p.waitForTimeout(3500);
  await p.screenshot({path:png,fullPage:false}); console.log("shot:",tab);
}
await b.close();
