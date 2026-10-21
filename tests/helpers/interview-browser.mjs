import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

export async function checkInterviewBrowser({ base, token, projectId }) {
  const profile = mkdtempSync("/tmp/briefpilot-interview-chrome-");
  const debugPort = Number(process.env.INTERVIEW_BROWSER_PORT ?? 9321);
  const browser = spawn("/usr/bin/google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
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
    const evaluate = async (expression) => (await cdp("Runtime.evaluate", { expression, returnByValue: true, userGesture: true, awaitPromise: true })).result.value;
    const waitFor = async (expression) => {
      for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
      throw new Error(`Browser condition timed out: ${expression}; ${await evaluate('document.body.innerText.slice(-1500)')}`);
    };
    await cdp("Network.enable");
    await cdp("Browser.grantPermissions", { origin: base, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] });
    await cdp("Network.setCookie", { name: "authjs.session-token", value: token, url: base, httpOnly: true, sameSite: "Lax" });
    await cdp("Emulation.setDeviceMetricsOverride", { width: 375, height: 1100, deviceScaleFactor: 1, mobile: false });
    await cdp("Page.navigate", { url: `${base}/dashboard/projects/${projectId}/interview` });
    await waitFor("document.readyState === 'complete' && !![...document.querySelectorAll('button')].find(b => b.textContent === 'Démarrer l’interview')");
    await delay(250);
    await evaluate(`window.__uiRequests = []; window.__originalFetch = window.fetch.bind(window); window.fetch = async (url, init) => {
      if (String(url).includes('/interview')) window.__uiRequests.push({url:String(url),method:init?.method??'GET',body:init?.body});
      if (window.__failNext && String(url).endsWith('/interview/messages')) { window.__failNext=false; return new Response(JSON.stringify({error:{code:'AI_QUOTA',message:'private-provider-details'}}),{status:503,headers:{'Content-Type':'application/json'}}); }
      if (window.__mockSnapshot && String(url).endsWith('/interview') && (!init?.method || init.method==='GET')) { const result=window.__mockSnapshot; window.__mockSnapshot=null; return new Response(JSON.stringify({data:result}),{status:200,headers:{'Content-Type':'application/json'}}); }
      return window.__originalFetch(url,init);
    }; true`);
    await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent === 'Démarrer l’interview').click(); true");
    await waitFor("document.querySelectorAll('ol[aria-label] li').length === 1 && !document.querySelector('#interview-answer')?.disabled");
    await delay(3100);
    await evaluate("Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(document.querySelector('#interview-answer'), 'Agences immobilières'); document.querySelector('#interview-answer').dispatchEvent(new Event('input', {bubbles: true})); true");
    await waitFor("!![...document.querySelectorAll('button')].find(b => b.textContent === 'Envoyer' && !b.disabled)");
    await evaluate("document.querySelector('#interview-answer').focus(); true");
    const beforeAnswer = await evaluate("window.__uiRequests.filter(r=>r.method==='POST').length");
    await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await waitFor("document.querySelectorAll('ol[aria-label] li').length === 3 && document.body.textContent.includes('6 %')");
    assert.equal(await evaluate("document.querySelector('#interview-answer').value"), "");
    assert.equal(await evaluate("window.__uiRequests.filter(r=>r.method==='POST').length"), beforeAnswer+1);
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Je ne sais pas encore').click(); true");
    assert.equal(await evaluate("document.querySelector('#interview-answer').value"), 'Je ne sais pas encore.');
    await evaluate("Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(document.querySelector('#interview-answer'),'Réponse à conserver'); document.querySelector('#interview-answer').dispatchEvent(new Event('input',{bubbles:true})); true");
    await waitFor("[...document.querySelectorAll('button')].find(b=>b.textContent==='Je ne sais pas encore').disabled");
    await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,modifiers:8,text:'\r'});
    assert.equal(await evaluate("window.__uiRequests.filter(r=>r.method==='POST').length"), beforeAnswer+1);
    await evaluate("window.__failNext=true; document.querySelector('#interview-answer').form.requestSubmit(); true");
    await waitFor("!!document.querySelector('[role=alert]') && !![...document.querySelectorAll('button')].find(b=>b.textContent==='Réessayer'&&!b.disabled)");
    assert.ok((await evaluate("document.querySelector('#interview-answer').value")).includes('Réponse à conserver'));
    assert.ok(!(await evaluate('document.body.textContent')).includes('private-provider-details'));
    const failedId = await evaluate("JSON.parse(window.__uiRequests.filter(r=>r.url.endsWith('/messages')).at(-1).body).requestId");
    await delay(3100);
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Réessayer').click(); true");
    await waitFor("document.querySelectorAll('ol[aria-label] li').length===5 && !document.querySelector('#interview-answer').disabled");
    assert.equal(await evaluate("JSON.parse(window.__uiRequests.filter(r=>r.url.endsWith('/messages')).at(-1).body).requestId"), failedId);
    const posts = await evaluate("window.__uiRequests.filter(r=>r.method==='POST').length");
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Reprendre l’interview').click(); true");
    await waitFor("document.body.textContent.includes('Historique synchronisé') && !document.querySelector('#interview-answer').disabled");
    assert.equal(await evaluate("window.__uiRequests.filter(r=>r.method==='POST').length"),posts);
    await cdp('Page.bringToFront');
    await evaluate("document.querySelector('button[aria-label=\"Copier le message 1\"]').click(); true");
    await waitFor("document.body.textContent.includes('Message 1 copié.')");
    const clipboard=(await cdp('Runtime.evaluate',{expression:'navigator.clipboard.readText()',awaitPromise:true,returnByValue:true})).result.value;
    assert.ok(clipboard.includes('Quels profils'));
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Suivi du projet').click(); true");
    await waitFor("getComputedStyle(document.querySelector('#interview-followup')).display!=='none'");
    assert.ok((await evaluate("document.querySelector('#interview-followup').innerText")).toLowerCase().includes('agences immobilières'));
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Identifier un contenu')).click(); true");
    await evaluate("document.querySelector('#content-name').value='Logo'; document.querySelector('#content-status').value='available'; document.querySelector('#content-description').value='Identité visuelle validée'; document.querySelector('#content-url').value='https://example.invalid/logo'; document.querySelector('#content-form').requestSubmit(); true");
    await waitFor("document.body.textContent.includes('Fiche prête à envoyer') && ![...document.querySelectorAll('button')].find(b=>b.textContent==='Envoyer').disabled");
    await delay(3100);
    await evaluate("document.querySelector('#interview-answer').form.requestSubmit(); document.querySelector('#interview-answer').form.requestSubmit(); true");
    await waitFor("document.querySelectorAll('ol[aria-label] li').length===7 && !document.querySelector('#interview-answer').disabled");
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Suivi du projet').click(); true");
    await waitFor("!!document.querySelector('ul[aria-label=\"Contenus déclarés\"]')");
    assert.ok((await evaluate("document.querySelector('ul[aria-label=\"Contenus déclarés\"]').textContent")).includes('Disponible'));
    await evaluate(`(async()=>{window.__mockSnapshot = (await (await window.__originalFetch('${base}/api/projects/${projectId}/interview')).json()).data; window.__mockSnapshot.messages.push({id:'remote-test-message',role:'assistant',content:'Nouveau message distant',createdAt:new Date().toISOString()}); document.querySelector('ol[aria-label]').scrollTop=0; document.querySelector('ol[aria-label]').dispatchEvent(new Event('scroll')); return true;})()`);
    await delay(100);
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Reprendre l’interview').click(); true");
    await waitFor("!![...document.querySelectorAll('button')].find(b=>b.textContent==='Voir les nouveaux messages')");
    assert.equal(await evaluate("document.querySelector('ol[aria-label]').scrollTop"),0);
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Voir les nouveaux messages').click(); true");

    await cdp("Page.reload");
    await waitFor("document.readyState === 'complete' && document.querySelectorAll('ol[aria-label] li').length === 7 && document.body.textContent.includes('6 %')");
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Projet et navigation').click(); true");
    assert.equal(await evaluate("document.querySelectorAll('nav[aria-label=\"Navigation du projet\"] a').length"),4);
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Suivi du projet').click(); true");
    await waitFor("!!document.querySelector('ul[aria-label=\"Contenus déclarés\"]')");
    for (const width of [375, 1440]) {
      await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1100, deviceScaleFactor: 1, mobile: false });
      await delay(200);
      assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `No overflow at ${width}px`);
      assert.ok(await evaluate("(()=>{const items=[...document.querySelectorAll('ol[aria-label] > li')].map(el=>el.getBoundingClientRect());return items.every((item,index)=>!index||items[index-1].bottom<=item.top);})()"), `Messages do not overlap at ${width}px`);
      await evaluate("document.querySelector('ol[aria-label]').scrollTop=0; true");
      await delay(200);
      const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
      writeFileSync(`/tmp/briefpilot-interview-${width}.png`, Buffer.from(screenshot.data, "base64"));
    }
  } finally {
    socket?.close(); browser.kill("SIGTERM"); await delay(300);
    rmSync(profile, { recursive: true, force: true });
  }
}
