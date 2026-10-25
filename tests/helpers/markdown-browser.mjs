import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

export async function checkMarkdownBrowser({ base, token, projectId, briefId, backlogId, expectedPrompt }) {
  const profile = mkdtempSync("/tmp/briefpilot-markdown-chrome-");
  const downloads = mkdtempSync("/tmp/briefpilot-markdown-downloads-");
  const debugPort = Number(process.env.MARKDOWN_BROWSER_PORT ?? 9351);
  const browser = spawn(chromium.executablePath(), ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  let socket;
  try {
    let pages;
    for (let i = 0; i < 100; i++) {
      try { pages = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json(); break; } catch {}
      await delay(100);
    }
    assert.ok(pages);
    socket = new WebSocket(pages.find((page) => page.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let counter = 0;
    const pending = new Map();
    socket.onmessage = (event) => {
      const result = JSON.parse(event.data);
      if (!pending.has(result.id)) return;
      const call = pending.get(result.id); pending.delete(result.id); clearTimeout(call.timer);
      if (result.error) call.reject(new Error(result.error.message)); else call.resolve(result.result);
    };
    const cdp = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++counter;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 10000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, userGesture: true });
      if (result.exceptionDetails) throw new Error(`Browser evaluation failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
      return result.result.value;
    };
    const waitFor = async (expression) => {
      for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
      throw new Error(`Browser condition timed out: ${expression}; ${await evaluate('document.body.innerText.slice(-1000)')}`);
    };
    await cdp("Network.enable");
    await cdp("Network.setCookie", { name: "authjs.session-token", value: token, url: base, httpOnly: true, sameSite: "Lax" });
    await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,eventsEnabled:true});
    await cdp('Emulation.setDeviceMetricsOverride',{width:375,height:1100,deviceScaleFactor:1,mobile:false});
    await cdp('Page.navigate',{url:`${base}/dashboard/projects/${projectId}/briefs/${briefId}`});
    await waitFor("document.readyState==='complete' && !![...document.querySelectorAll('button')].find(b=>b.textContent==='Exporter')");
    const menu = async () => {
      await delay(300);
      await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Exporter').scrollIntoView({block:'center'}); true");
      const position = await evaluate("(()=>{const r=[...document.querySelectorAll('button')].find(b=>b.textContent==='Exporter').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
      await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...position});
      await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...position});
      await waitFor("!!document.querySelector('[role=menuitem]')");
    };
    async function download(label,suffix) {
      await menu();
      await evaluate(`[...document.querySelectorAll('[role=menuitem]')].find(item=>item.textContent===${JSON.stringify(label)}).click(); true`);
      let file;
      for(let i=0;i<100;i++){file=readdirSync(downloads).find(name=>name.endsWith(suffix));if(file)break;await delay(100);}
      assert.ok(file,`A real browser download exists for ${suffix}`);
      await waitFor("document.body.textContent.includes('Téléchargement lancé')");
      return readFileSync(`${downloads}/${file}`,'utf8');
    }
    const brief=await download('Télécharger le cahier des charges','brief-v1.md');
    assert.ok(brief.includes('Réservations à Évry'));assert.ok(brief.includes('Version : 1'));assert.ok(brief.includes('Brouillon'));
    await cdp('Page.navigate',{url:`${base}/dashboard/projects/${projectId}/backlogs/${backlogId}`});
    await waitFor("document.readyState==='complete' && !![...document.querySelectorAll('button')].find(b=>b.textContent==='Exporter')");
    const backlog=await download('Télécharger le backlog','backlog-v1.md');assert.ok(backlog.includes('Tâches techniques'));
    const prompts=await download('Télécharger les tâches Codex','codex-tasks-v1.md');assert.ok(prompts.includes(expectedPrompt));
    await evaluate(`window.__savedFetch=window.fetch.bind(window); window.fetch=async()=>new Response(JSON.stringify({error:{message:'private-export-details'}}),{status:500,headers:{'Content-Type':'application/json'}}); true`);
    await menu();await evaluate("[...document.querySelectorAll('[role=menuitem]')].find(item=>item.textContent==='Télécharger le backlog').click(); true");
    await waitFor("!!document.querySelector('[aria-label=\"Exports Markdown et PDF\"] [role=alert]')");
    assert.ok(!(await evaluate('document.body.textContent')).includes('private-export-details'));
    await evaluate('window.fetch=window.__savedFetch; true');
    for(const width of [375,1440]) {
      await cdp('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});await delay(100);
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    }
  } finally {
    socket?.close();browser.kill('SIGTERM');await delay(300);
    rmSync(profile,{recursive:true,force:true});rmSync(downloads,{recursive:true,force:true});
  }
}
