import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

export async function checkBriefBrowser({ base, token, projectId, onNewAnswers }) {
  const profile = mkdtempSync("/tmp/briefpilot-brief-chrome-");
  const debugPort = Number(process.env.BRIEF_BROWSER_PORT ?? 9331);
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
      throw new Error(`Browser condition timed out: ${expression}`);
    };
    await cdp("Network.enable");
    await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await cdp("Network.setCookie", { name: "authjs.session-token", value: token, url: base, httpOnly: true, sameSite: "Lax" });
    await cdp("Emulation.setDeviceMetricsOverride", { width: 375, height: 1100, deviceScaleFactor: 1, mobile: false });
    await cdp("Page.navigate", { url: `${base}/dashboard/projects/${projectId}/interview` });
    await waitFor("document.readyState === 'complete' && !!document.querySelector('input[type=checkbox]')");
    await delay(300);
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Suivi du projet')?.click(); true");
    await evaluate("document.querySelector('input[type=checkbox]').click(); true");
    await waitFor("!![...document.querySelectorAll('button')].find(b => b.textContent === 'Générer mon cahier des charges' && !b.disabled)");
    await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent === 'Générer mon cahier des charges').click(); true");
    await waitFor("location.pathname.includes('/briefs/') && !!document.querySelector('#brief-features') && document.body.textContent.includes('Brouillon — à compléter')");
    const firstPath = await evaluate('location.pathname');
    assert.equal(await evaluate("document.querySelectorAll('main [id^=brief-]').length"),17);
    assert.ok(!(await evaluate('document.body.innerText')).includes('message:'));
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Sommaire')).click(); true");
    await waitFor("getComputedStyle(document.querySelector('#document-toc')).display!=='none'");
    await evaluate("document.querySelector('nav[aria-label=\"Sommaire du cahier des charges\"] a[href=\"#brief-features\"]').click(); true");
    await waitFor("location.hash==='#brief-features' && document.activeElement.id==='brief-features' && !!document.querySelector('nav[aria-label=\"Sommaire du cahier des charges\"] a[href=\"#brief-features\"][aria-current=location]')");
    await evaluate("Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(document.querySelector('#feature-search'),'introuvable'); document.querySelector('#feature-search').dispatchEvent(new Event('input',{bubbles:true})); true");
    await waitFor("document.querySelector('#brief-features').textContent.includes('Aucune fonctionnalité ne correspond')");
    await evaluate("Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(document.querySelector('#feature-search'),'gestion'); document.querySelector('#feature-search').dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#feature-priority').value='SHOULD'; document.querySelector('#feature-priority').dispatchEvent(new Event('change',{bubbles:true})); true");
    await waitFor("document.querySelector('#brief-features').textContent.includes('Aucune fonctionnalité ne correspond')");
    await evaluate("document.querySelector('#feature-priority').value='MUST'; document.querySelector('#feature-priority').dispatchEvent(new Event('change',{bubbles:true})); true");
    await waitFor("document.querySelectorAll('[data-feature-id]').length===1");
    await evaluate("document.querySelector('[data-feature-id] details').open=true; true");
    assert.ok((await evaluate("document.querySelector('[data-feature-id] details').textContent")).includes('Un client ne peut choisir'));
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Analyse et actions').click(); true");
    await waitFor("getComputedStyle(document.querySelector('#document-insights')).display!=='none'");
    assert.equal(await evaluate("document.querySelector('[data-stat=features]').textContent"),'1');
    assert.ok((await evaluate("document.querySelector('#document-insights').textContent")).includes('Hypothèse (1)'));
    assert.ok((await evaluate("document.querySelector('#document-insights').textContent")).includes('Budget non communiqué'));
    await evaluate("[...document.querySelectorAll('#document-insights input[type=checkbox]')].forEach(input=>{if(!input.checked)input.click()}); true");
    await waitFor("!![...document.querySelectorAll('button')].find(b=>b.textContent==='Générer le backlog'&&!b.disabled) && !![...document.querySelectorAll('button')].find(b=>b.textContent==='Régénérer'&&!b.disabled)");
    await evaluate(`window.__generationCalls=[]; window.__savedFetch=window.fetch.bind(window); window.fetch=async(url,init)=>{
      if(init?.method==='POST' && (String(url).endsWith('/briefs') || String(url).endsWith('/backlogs'))) { window.__generationCalls.push(String(url)); await new Promise(resolve=>setTimeout(resolve,300)); return new Response(JSON.stringify({error:{code:'BACKLOG_QUOTA',message:'Service local en pause.'}}),{status:503,headers:{'Content-Type':'application/json'}}); }
      return window.__savedFetch(url,init);
    }; [...document.querySelectorAll('button')].find(b=>b.textContent==='Générer le backlog').click(); [...document.querySelectorAll('button')].find(b=>b.textContent==='Régénérer').click(); true`);
    await waitFor("!!document.querySelector('#document-insights [role=alert]') && !![...document.querySelectorAll('button')].find(b=>b.textContent==='Régénérer'&&!b.disabled)");
    assert.equal(await evaluate('window.__generationCalls.length'),1);
    await evaluate('window.fetch=window.__savedFetch; true');
    await evaluate("document.querySelector('#brief-budget').scrollIntoView(); true");
    await waitFor("!!document.querySelector('nav[aria-label=\"Sommaire du cahier des charges\"] a[href=\"#brief-budget\"][aria-current=location]')");
    const links = await evaluate("[...document.querySelectorAll('nav[aria-label=\"Navigation depuis le brief\"] a')].map(a=>a.getAttribute('href'))");
    assert.ok(links.includes(`/dashboard/projects/${projectId}/interview`)); assert.ok(links.includes(`/dashboard/projects/${projectId}/backlogs`));
    await evaluate("window.scrollTo(0,0); true");

    for (const width of [375,768,1440]) {
      await cdp('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
      await delay(200);
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`No overflow at ${width}px`);
      const screenshot=await cdp('Page.captureScreenshot',{format:'png'});
      writeFileSync(`/tmp/briefpilot-brief-${width}.png`,Buffer.from(screenshot.data,'base64'));
    }
    await onNewAnswers();
    await cdp('Page.navigate',{url:`${base}/dashboard/projects/${projectId}/briefs`});
    await waitFor("document.readyState==='complete' && !![...document.querySelectorAll('button')].find(b => b.textContent === 'Régénérer' && !b.disabled)");
    await delay(300);
    await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent === 'Régénérer').click(); true");
    await waitFor(`location.pathname !== ${JSON.stringify(firstPath)} && location.pathname.includes('/briefs/') && document.body.textContent.includes('Version 2') && !!document.querySelector('#brief-features')`);
    assert.notEqual(await evaluate('location.pathname'),firstPath);
    await evaluate("[...document.querySelectorAll('nav[aria-label=\"Versions du cahier des charges\"] a')].find(a => a.textContent === 'Version 1').click(); true");
    await waitFor(`location.pathname === ${JSON.stringify(firstPath)} && document.body.textContent.includes('Brouillon — à compléter')`);

  } finally {
    socket?.close(); browser.kill("SIGTERM"); await delay(300);
    rmSync(profile, { recursive: true, force: true });
  }
}
