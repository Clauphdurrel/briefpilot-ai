import {grantTestPlan} from "./helpers/billing-fixture.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ quiet: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.BACKLOG_TEST_PORT ?? 3131), base = `http://localhost:${port}`;
const owners = [randomUUID(), randomUUID(), randomUUID()], tokens = owners.map(() => randomUUID());
const projects = owners.map(() => randomUUID()), briefs = owners.map(() => randomUUID()), completeBrief = randomUUID();
let child, mock, calls = 0, mode = "normal", firstId, secondId, original;
const sourceJson = (draft = true) => {
  const document = JSON.parse(readFileSync("docs/prompts/brief-generator.example.json", "utf8"));
  if (!draft) {
    document.missingInformation = [];
    document.budgetAndTimeline.budget = { text: "5000 EUR", status: "confirmed", sourceIds: ["message:answer-1"] };
    document.budgetAndTimeline.deadlines = [{ text: "15 janvier 2027", status: "confirmed", sourceIds: ["message:answer-1"] }];
  }
  return { schemaVersion: "brief.v1", document, generation: { version: draft ? 1 : 2, requestId: randomUUID(), sourceRevision: "a".repeat(64), projectName: "Restaurant intégration", projectType: "WEBSITE", language: "fr", draft, generatedAt: new Date().toISOString(), model: "fixture" } };
};
before(async () => {
  for (let i = 0; i < owners.length; i++) {
    await pool.query('INSERT INTO "User" (id,email,"updatedAt") VALUES ($1,$2,NOW())', [owners[i], `backlog-test-${owners[i]}@example.invalid`]);
    await grantTestPlan(pool, owners[i]);
    await pool.query('INSERT INTO "Session" (id,"sessionToken","userId",expires) VALUES ($1,$2,$3,NOW()+INTERVAL \'1 hour\')', [randomUUID(), tokens[i], owners[i]]);
    await pool.query('INSERT INTO "Project" (id,name,type,description,status,"ownerId","updatedAt") VALUES ($1,\'Restaurant intégration\',\'WEBSITE\',\'Réservation de tables\',\'BRIEF_GENERATED\',$2,NOW())', [projects[i], owners[i]]);
    await pool.query('INSERT INTO "Brief" (id,title,content,json,"projectId","updatedAt") VALUES ($1,\'Cahier des charges\',\'fixture\',$2,$3,NOW())', [briefs[i], sourceJson(), projects[i]]);
  }
  await pool.query('INSERT INTO "Brief" (id,title,content,json,"projectId","updatedAt") VALUES ($1,\'Cahier des charges complet\',\'fixture\',$2,$3,NOW())', [completeBrief, sourceJson(false), projects[0]]);
  const newerThird = sourceJson(); newerThird.generation.version = 2;
  await pool.query('INSERT INTO "Brief" (id,title,content,json,"projectId","createdAt","updatedAt") VALUES ($1,\'Version récente\',\'fixture\',$2,$3,NOW()+INTERVAL \'1 second\',NOW())', [randomUUID(), newerThird, projects[2]]);
  mock = createServer(async (request, response) => {
    try {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      assert.equal(request.url, "/v1/responses"); assert.equal(body.text.format.name, "project_backlog"); assert.equal(body.store, false);
      const context = JSON.parse(body.input[1].content); calls++;
      await delay(250);
      if (mode === "quota") { response.writeHead(429, { "Content-Type": "application/json" }); response.end(JSON.stringify({ error: { message: "private-provider-details", code: "insufficient_quota" } })); return; }
      let document = JSON.parse(readFileSync("docs/prompts/backlog-generator.example.json", "utf8"));
      document.summary.projectName = context.project.name;
      document.summary.missingInformation = context.brief.missingInformation.map((item) => item.description);
      if (!document.summary.missingInformation.length) document.summary.technicalAssumptions = [];
      if (mode === "invalid") document = {};
      if (mode === "cycle") document.tasks[0].dependencies = ["T-002"];
      if (mode === "secret") document.tasks[0].description = "api_key=privatecredential123456";
      const content = mode === "refusal" ? [{ type: "refusal", refusal: "Refus simulé" }] : [{ type: "output_text", text: JSON.stringify(document), annotations: [], logprobs: [] }];
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ id: `resp_${randomUUID()}`, object: "response", created_at: Math.floor(Date.now()/1000), status: "completed", model: "test-model", output: [{ id: `msg_${randomUUID()}`, type: "message", role: "assistant", status: "completed", content }], error: null, incomplete_details: null, metadata: {} }));
    } catch { response.writeHead(500, { "Content-Type": "application/json" }); response.end(JSON.stringify({ error: { message: "Local mock failure" } })); }
  });
  await new Promise((resolve) => mock.listen(port + 1, "127.0.0.1", resolve));
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { detached: true, stdio: "ignore", env: { ...process.env, OPENAI_API_KEY: "local-mock-key", OPENAI_MODEL: "test-model", OPENAI_BASE_URL: `http://127.0.0.1:${port+1}/v1` } });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/login`)).ok) return; } catch {} await delay(100); }
  throw new Error("Next.js test server did not start");
});
after(async () => {
  if (child && child.exitCode === null) process.kill(-child.pid, "SIGTERM");
  if (mock) await new Promise((resolve) => mock.close(resolve));
  try { await pool.query('DELETE FROM "User" WHERE id = ANY($1::text[])', [owners]); } finally { await pool.end(); }
});
async function api(projectId = projects[0], method = "GET", body, session = tokens[0], backlogId) {
  return fetch(`${base}/api/projects/${projectId}/backlogs${backlogId ? `/${backlogId}` : ""}`, { method, redirect: "manual", headers: { ...(session ? { Cookie: `authjs.session-token=${session}` } : {}), ...(method === "POST" ? { Origin: base, "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
}
const request = (extra = {}) => ({ requestId: randomUUID(), sourceBriefId: briefs[0], allowDraft: true, ...extra });
async function ageRequests(projectId = projects[0]) {
  await pool.query('UPDATE "BacklogGeneration" SET "chargedAt"=ARRAY(SELECT d-INTERVAL \'2 minutes\' FROM unnest("chargedAt") AS d), "lastAttemptAt"="lastAttemptAt"-INTERVAL \'2 minutes\' WHERE "projectId"=$1', [projectId]);
}

test("API requires sessions, ownership, selected owned brief and explicit draft consent", async () => {
  assert.equal((await api(projects[0], "GET", undefined, null)).status, 401);
  assert.equal((await api(projects[0], "POST", request(), null)).status, 401);
  assert.equal((await api(projects[1])).status, 404);
  assert.equal((await api(projects[1], "POST", request({ sourceBriefId: briefs[1] }))).status, 404);
  assert.equal((await api(projects[0], "POST", request({ sourceBriefId: briefs[1] }))).status, 404);
  assert.equal((await api(projects[0], "POST", request({ allowDraft: false }))).status, 422);
  assert.equal((await api(projects[0], "POST", { ...request(), ownerId: "intruder" })).status, 400);
  assert.equal(calls, 0);
});
test("real SDK and PostgreSQL persist one validated backlog for concurrent/repeated requests", async () => {
  const input = request();
  const responses = await Promise.all([api(projects[0], "POST", input), api(projects[0], "POST", input)]);
  assert.ok(responses.every((response) => [200,409].includes(response.status)));
  const success = responses.find((response) => response.status === 200); assert.ok(success);
  firstId = (await success.json()).data.backlogId;
  original = (await pool.query('SELECT * FROM "Backlog" WHERE id=$1', [firstId])).rows[0];
  assert.equal(original.status, "DRAFT"); assert.equal(original.version, 1); assert.equal(original.sourceBriefId, briefs[0]);
  assert.match(original.data.document.tasks[0].codexPrompt, /AGENTS.md/); assert.match(original.data.document.tasks[0].codexPrompt, /existence non garantie/);
  assert.equal((await (await api(projects[0], "POST", input)).json()).data.backlogId, firstId);
  assert.equal((await (await api(projects[0], "POST", request())).json()).data.backlogId, firstId);
  assert.equal(calls, 1);
  assert.equal((await api(projects[0], "POST", { ...input, regenerate: true })).status, 409);
});
test("controlled regeneration retains versions and selected complete brief generates READY", async () => {
  await ageRequests();
  const response = await api(projects[0], "POST", request({ sourceBriefId: completeBrief, allowDraft: false, regenerate: true }));
  assert.equal(response.status, 200, await response.clone().text()); secondId = (await response.json()).data.backlogId;
  const saved = (await pool.query('SELECT * FROM "Backlog" WHERE id=$1', [secondId])).rows[0];
  assert.equal(saved.version, 2); assert.equal(saved.status, "READY"); assert.equal(saved.sourceBriefId, completeBrief);
  assert.deepEqual((await pool.query('SELECT * FROM "Backlog" WHERE id=$1', [firstId])).rows[0], original);
  assert.equal((await (await api()).json()).data.length, 2);
  assert.equal((await api(projects[1], "GET", undefined, tokens[1], firstId)).status, 404);
  assert.equal((await api(projects[0], "GET", undefined, tokens[1], firstId)).status, 404);
});
test("database rejects duplicate project versions and a brief belonging to another project", async () => {
  await assert.rejects(pool.query('INSERT INTO "Backlog" (id,"projectId","sourceBriefId",version,status,data,"sourceRevision","updatedAt") VALUES ($1,$2,$3,1,\'DRAFT\',\'{}\',\'fixture\',NOW())', [randomUUID(), projects[0], briefs[0]]), (error) => error.code === "23505");
  await assert.rejects(pool.query('INSERT INTO "Backlog" (id,"projectId","sourceBriefId",version,status,data,"sourceRevision","updatedAt") VALUES ($1,$2,$3,3,\'DRAFT\',\'{}\',\'fixture\',NOW())', [randomUUID(), projects[0], briefs[1]]), (error) => error.code === "23503");
});
test("changing the project while generation runs prevents stale persistence", async () => {
  await ageRequests(); const beforeCalls = calls;
  const pending = api(projects[0], "POST", request({ regenerate: true }));
  for (let i = 0; i < 100 && calls === beforeCalls; i++) await delay(10);
  await pool.query('UPDATE "Project" SET description=\'Nouveau périmètre\' WHERE id=$1', [projects[0]]);
  const response = await pending; assert.equal(response.status, 409); assert.equal((await response.json()).error.code, "BACKLOG_SOURCE_CHANGED");
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM "Backlog" WHERE "projectId"=$1', [projects[0]])).rows[0].count, 2);
});
test("invalid output, cycles, secrets, refusals and quota errors never persist or leak details", async () => {
  for (const [failure, status] of [["invalid",502],["cycle",502],["secret",502],["refusal",422],["quota",503]]) {
    mode = failure; await ageRequests(projects[1]);
    const response = await api(projects[1], "POST", request({ sourceBriefId: briefs[1] }), tokens[1]);
    assert.equal(response.status, status, await response.clone().text());
    const body = await response.text(); assert.doesNotMatch(body, /private-provider-details|privatecredential/);
  }
  mode = "normal";
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM "Backlog" WHERE "projectId"=$1', [projects[1]])).rows[0].count, 0);
});
test("authenticated readers show source/version and anonymous readers are redirected", async () => {
  const url = `${base}/dashboard/projects/${projects[0]}/backlogs/${secondId}`;
  assert.equal((await fetch(url, { redirect: "manual" })).status, 307);
  const response = await fetch(url, { headers: { Cookie: `authjs.session-token=${tokens[0]}` } });
  assert.equal(response.status, 200); const html = (await response.text()).replace(/<!--.*?-->/gs, "");
  for (const text of ["Version 2", "Épics et user stories", "Tâches techniques", "Cahier des charges source", "Copier le prompt Codex"]) assert.ok(html.includes(text), text);
});
test("Chrome supports generation, task filters, copy and retained version navigation", { skip: process.env.BACKLOG_VISUAL_TEST !== "1" }, async () => {
  const { checkBacklogBrowser } = await import("./helpers/backlog-browser.mjs");
  await checkBacklogBrowser({ base, token: tokens[2], projectId: projects[2], briefId: briefs[2], beforeRegenerate: () => ageRequests(projects[2]) });
  const saved = await pool.query('SELECT "sourceBriefId",data FROM "Backlog" WHERE "projectId"=$1 ORDER BY version', [projects[2]]);
  assert.equal(saved.rows.length, 2);
  for (const row of saved.rows) { assert.equal(row.sourceBriefId, briefs[2]); assert.equal(row.data.generation.sourceBriefVersion, 1); }
});
