import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage();
const errs=[]; p.on("console",m=>{if(m.type()==="error")errs.push(m.text())}); p.on("pageerror",e=>errs.push("PE:"+e.message));
await p.goto("http://127.0.0.1:5173/",{waitUntil:"networkidle",timeout:30000});
await p.waitForTimeout(2000);
for (const [tab,png,expect] of [["Data clean","rt_clean.png","Data clean"],["Stationarity","rt_stat.png","Stationarity"]]) {
  await p.getByRole("button",{name:tab,exact:true}).click(); await p.waitForTimeout(3500);
  const txt=await p.innerText("body"); await p.screenshot({path:png,fullPage:true});
  console.log(tab,"→ charts:",await p.locator(".js-plotly-plot").count(),"| has:",txt.includes(expect),"| ADF/Hampel:",/Hampel|ADF/.test(txt));
}
await b.close(); console.log("ERRORS:",errs.length?errs.join("\n"):"(none)");
