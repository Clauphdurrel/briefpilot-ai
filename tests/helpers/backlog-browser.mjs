import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

export async function checkBacklogBrowser({ base, token, projectId, briefId, beforeRegenerate }) {
  const profile = mkdtempSync("/tmp/briefpilot-backlog-chrome-");
  const debugPort = Number(process.env.BACKLOG_BROWSER_PORT ?? 9341);
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
    const evaluate = async (expression) => (await cdp("Runtime.evaluate", { expression, returnByValue: true, userGesture: true })).result.value;
    const waitFor = async (expression) => {
      for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
      throw new Error(`Browser condition timed out: ${expression}; ${await evaluate('location.pathname + " " + document.body.innerText.slice(-1500)')}`);
    };
    await cdp("Network.enable");
    await cdp("Browser.grantPermissions", { origin: base, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] });
    await cdp("Network.setCookie", { name: "authjs.session-token", value: token, url: base, httpOnly: true, sameSite: "Lax" });
    await cdp("Page.navigate", { url: `${base}/dashboard/projects/${projectId}/briefs/${briefId}` });
    await waitFor("document.readyState === 'complete' && !!document.querySelector('input[type=checkbox]')");
    await delay(300);
    await evaluate("document.querySelector('input[type=checkbox]').click(); true");
    await waitFor("!![...document.querySelectorAll('button')].find(b => b.textContent === 'Générer le backlog' && !b.disabled)");
    await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent === 'Générer le backlog').click(); true");
    await waitFor("location.pathname.includes('/backlogs/') && document.body.textContent.includes('Tâches techniques (2)')");
    const firstPath = await evaluate('location.pathname');
    await evaluate("document.querySelector('#filter-Phase').value='Future'; document.querySelector('#filter-Phase').dispatchEvent(new Event('change',{bubbles:true})); true");
    await waitFor("document.body.textContent.includes('Aucune tâche ne correspond aux filtres.')");
    await evaluate("document.querySelector('#filter-Phase').value='all'; document.querySelector('#filter-Phase').dispatchEvent(new Event('change',{bubbles:true})); true");
    await evaluate("document.querySelector('#filter-Priorité').value='P1'; document.querySelector('#filter-Priorité').dispatchEvent(new Event('change',{bubbles:true})); true");
    await waitFor("document.body.textContent.includes('Tâches techniques (1)') && document.querySelector('section[aria-label=\"Épics et user stories\"]').textContent.includes('S-001')");
    await evaluate("document.querySelector('#filter-Rôle').value='qa'; document.querySelector('#filter-Rôle').dispatchEvent(new Event('change',{bubbles:true})); true");
    await waitFor("document.body.textContent.includes('Tâches techniques (1)')");
    await evaluate("document.querySelector('section[aria-label=\"Tâches techniques\"] details').open=true; true");
    await cdp('Page.bringToFront');
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Copier le prompt Codex').click(); true");
    await waitFor("document.body.textContent.includes('Prompt T-002 copié.')");
    const clipboard = (await cdp('Runtime.evaluate',{expression:'navigator.clipboard.readText()',awaitPromise:true,returnByValue:true})).result.value;
    assert.ok(clipboard.includes('AGENTS.md')); assert.ok(clipboard.includes('T-002'));
    await evaluate("document.querySelector('#filter-Rôle').value='security'; document.querySelector('#filter-Rôle').dispatchEvent(new Event('change',{bubbles:true})); true");
    await waitFor("document.body.textContent.includes('Aucune tâche ne correspond aux filtres.')");
    await evaluate("document.querySelector('#filter-Rôle').value='all'; document.querySelector('#filter-Rôle').dispatchEvent(new Event('change',{bubbles:true})); true");
    await evaluate("document.querySelector('#filter-Priorité').value='all'; document.querySelector('#filter-Priorité').dispatchEvent(new Event('change',{bubbles:true})); true");
    await waitFor("document.body.textContent.includes('Tâches techniques (2)')");
    for (const width of [375,1440]) {
      await cdp('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
      await delay(200);
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`No overflow at ${width}px`);
      const screenshot=await cdp('Page.captureScreenshot',{format:'png'});
      writeFileSync(`/tmp/briefpilot-backlog-${width}.png`,Buffer.from(screenshot.data,'base64'));
    }
    await beforeRegenerate();
    await evaluate("document.querySelector('input[type=checkbox]').click(); true");
    await waitFor("!![...document.querySelectorAll('button')].find(b => b.textContent === 'Régénérer le backlog' && !b.disabled)");
    await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent === 'Régénérer le backlog').click(); true");
    await waitFor(`location.pathname !== ${JSON.stringify(firstPath)} && location.pathname.includes('/backlogs/') && document.body.textContent.includes('Version 2')`);
    assert.notEqual(await evaluate('location.pathname'),firstPath);
    await evaluate("[...document.querySelectorAll('nav[aria-label=\"Versions du backlog\"] a')].find(a => a.textContent === 'Version 1').click(); true");
    await waitFor(`location.pathname === ${JSON.stringify(firstPath)} && document.body.textContent.includes('Brouillon à valider')`);
  } finally {
    socket?.close(); browser.kill("SIGTERM"); await delay(300);
    rmSync(profile, { recursive: true, force: true });
  }
}
