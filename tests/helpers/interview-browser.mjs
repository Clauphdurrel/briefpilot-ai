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
    const evaluate = async (expression) => (await cdp("Runtime.evaluate", { expression, returnByValue: true })).result.value;
    const waitFor = async (expression) => {
      for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
      throw new Error(`Browser condition timed out: ${expression}`);
    };
    await cdp("Network.enable");
    await cdp("Network.setCookie", { name: "authjs.session-token", value: token, url: base, httpOnly: true, sameSite: "Lax" });
    await cdp("Emulation.setDeviceMetricsOverride", { width: 375, height: 1100, deviceScaleFactor: 1, mobile: false });
    await cdp("Page.navigate", { url: `${base}/dashboard/projects/${projectId}/interview` });
    await waitFor("document.readyState === 'complete' && !![...document.querySelectorAll('button')].find(b => b.textContent === 'Démarrer l’interview')");
    await delay(250);
    await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent === 'Démarrer l’interview').click(); true");
    await waitFor("document.querySelectorAll('ol[aria-label] li').length === 1 && !document.querySelector('#interview-answer')?.disabled");
    await delay(3100);
    await evaluate("Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(document.querySelector('#interview-answer'), 'Agences immobilières'); document.querySelector('#interview-answer').dispatchEvent(new Event('input', {bubbles: true})); true");
    await waitFor("!![...document.querySelectorAll('button')].find(b => b.textContent === 'Envoyer' && !b.disabled)");
    await evaluate("document.querySelector('#interview-answer').form.requestSubmit(); true");
    await waitFor("document.querySelectorAll('ol[aria-label] li').length === 3 && document.body.textContent.includes('6 %')");
    assert.equal(await evaluate("document.querySelector('#interview-answer').value"), "");
    await cdp("Page.reload");
    await waitFor("document.readyState === 'complete' && document.querySelectorAll('ol[aria-label] li').length === 3 && document.body.textContent.includes('6 %')");
    for (const width of [375, 1440]) {
      await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1100, deviceScaleFactor: 1, mobile: false });
      await delay(200);
      assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `No overflow at ${width}px`);
      const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
      writeFileSync(`/tmp/briefpilot-interview-${width}.png`, Buffer.from(screenshot.data, "base64"));
    }
  } finally {
    socket?.close(); browser.kill("SIGTERM"); await delay(300);
    rmSync(profile, { recursive: true, force: true });
  }
}
