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
const port = Number(process.env.BRIEF_TEST_PORT ?? 3121), base = `http://localhost:${port}`;
const owners = [randomUUID(), randomUUID(), randomUUID()], tokens = owners.map(() => randomUUID());
const projects = [randomUUID(), randomUUID(), randomUUID()], failureProject = randomUUID();
const categories = ["context", "problem", "objectives", "users", "features", "pages", "journeys", "roles", "content", "branding", "integrations", "data", "technical", "regulatory", "budget", "timeline", "success"];
const clientAnswer = "Les clients réservent les créneaux disponibles du restaurant. Le gestionnaire modifie les disponibilités. Un créneau indisponible ne peut pas être réservé. Nous fournissons horaires et coordonnées.";
let child, mock, calls = 0, firstId, secondId, firstDocument, mode = "normal";

function analysis(complete) {
  return { summary: "Réservations du restaurant", message: "Merci.", knownInformation: ["Réservation de tables"], assumptions: [], missingInformation: complete ? [] : ["Budget", "Délais"], completionScore: complete ? 100 : 0,
    nextQuestion: complete ? null : { id: "budget", question: "Quel budget ?", category: "budget", priority: "high", required: true },
    coverage: categories.map((category) => ({ category, status: complete ? "confirmed" : "missing", evidence: complete ? "Information client" : null })) };
}
async function seedInterview(projectId, complete = false) {
  const answerId = randomUUID();
  const text = clientAnswer + (complete ? " Budget 5 000 EUR, livraison le 15 janvier 2027." : "");
  await pool.query('INSERT INTO "InterviewMessage" (id,"projectId",role,content,"createdAt") VALUES ($1,$2,\'user\',$3,NOW()-INTERVAL \'2 seconds\')', [answerId, projectId, text]);
  await pool.query('INSERT INTO "InterviewMessage" (id,"projectId",role,content,metadata) VALUES ($1,$2,\'assistant\',\'Merci.\',$3)', [randomUUID(), projectId, { analysis: analysis(complete) }]);
}

before(async () => {
  for (let i = 0; i < owners.length; i++) {
    await pool.query('INSERT INTO "User" (id,email,"updatedAt") VALUES ($1,$2,NOW())', [owners[i], `brief-test-${owners[i]}@example.invalid`]);
    await pool.query('INSERT INTO "Session" (id,"sessionToken","userId",expires) VALUES ($1,$2,$3,NOW()+INTERVAL \'1 hour\')', [randomUUID(), tokens[i], owners[i]]);
    await pool.query('INSERT INTO "Project" (id,name,type,description,status,"ownerId","updatedAt") VALUES ($1,$2,\'WEBSITE\',$3,\'INTERVIEW\',$4,NOW())', [projects[i], `Restaurant test ${i}`, "Réservation de tables pour un restaurant.", owners[i]]);
    await seedInterview(projects[i]);
  }
  await pool.query('INSERT INTO "Project" (id,name,type,status,"ownerId","updatedAt") VALUES ($1,\'Failure fixture\',\'WEBSITE\',\'INTERVIEW\',$2,NOW())', [failureProject, owners[1]]);
  await seedInterview(failureProject);
  mock = createServer(async (request, response) => {
    try {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      assert.equal(request.url, "/v1/responses"); assert.equal(body.text.format.name, "project_brief"); assert.equal(body.store, false);
      const context = JSON.parse(body.input[1].content); calls++;
      await delay(250);
      if (mode === "quota") { response.writeHead(429, { "Content-Type": "application/json" }); response.end(JSON.stringify({ error: { message: "private-provider-details", code: "insufficient_quota" } })); return; }
      let document = JSON.parse(readFileSync("docs/prompts/brief-generator.example.json", "utf8"));
      const source = context.sources.find((item) => item.kind === "answer").id;
      document = JSON.parse(JSON.stringify(document).replaceAll('"message:answer-1"', JSON.stringify(source)));
      if (!context.draftRequested) {
        document.budgetAndTimeline.budget = { text: "5 000 EUR", status: "confirmed", sourceIds: [source] };
        document.budgetAndTimeline.deadlines = [{ text: "15 janvier 2027", status: "confirmed", sourceIds: [source] }];
        document.missingInformation = [];
      }
      if (mode === "invalid") document = { bad: true };
      const content = mode === "refusal" ? [{ type: "refusal", refusal: "Refus simulé" }] : [{ type: "output_text", text: JSON.stringify(document), annotations: [], logprobs: [] }];
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ id: `resp_${randomUUID()}`, object: "response", created_at: Math.floor(Date.now()/1000), status: "completed", model: "test-model", output: [{ id: `msg_${randomUUID()}`, type: "message", role: "assistant", status: "completed", content }], error: null, incomplete_details: null, metadata: {} }));
    } catch { response.writeHead(500, { "Content-Type": "application/json" }); response.end(JSON.stringify({ error: { message: "Local mock failure" } })); }
  });
  await new Promise((resolve) => mock.listen(port + 1, "127.0.0.1", resolve));
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { detached: true, stdio: "ignore",
    env: { ...process.env, OPENAI_API_KEY: "local-mock-key", OPENAI_MODEL: "test-model", OPENAI_BASE_URL: `http://127.0.0.1:${port+1}/v1` } });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error("Next.js test server exited");
    try { if ((await fetch(`${base}/api/auth/providers`)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error("Next.js test server did not start");
});
after(async () => {
  if (child && child.exitCode === null) process.kill(-child.pid, "SIGTERM");
  if (mock) await new Promise((resolve) => mock.close(resolve));
  try { await pool.query('DELETE FROM "User" WHERE id = ANY($1::text[])', [owners]); } finally { await pool.end(); }
});

async function api(projectId, method = "GET", body, session = tokens[0], briefId) {
  return fetch(`${base}/api/projects/${projectId}/briefs${briefId ? `/${briefId}` : ""}`, { method, redirect: "manual",
    headers: { ...(session ? { Cookie: `authjs.session-token=${session}` } : {}), ...(method === "POST" ? { Origin: base, "Content-Type": "application/json" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
}
async function ageRequests(projectId) {
  await pool.query('UPDATE "InterviewMessage" SET "createdAt"=NOW()-INTERVAL \'2 minutes\' WHERE "projectId"=$1 AND role=\'system\'', [projectId]);
}

test("brief API enforces ownership, sessions and explicit draft consent", async () => {
  assert.equal((await api(projects[0], "GET", undefined, null)).status, 401);
  assert.equal((await api(projects[0], "POST", { requestId: randomUUID() }, null)).status, 401);
  assert.equal((await api(projects[1])).status, 404);
  assert.equal((await api(projects[1], "POST", { requestId: randomUUID(), allowDraft: true })).status, 404);
  assert.equal((await api(randomUUID())).status, 404);
  assert.equal((await api(projects[0], "POST", { requestId: randomUUID() })).status, 422);
  assert.equal(calls, 0);
});

test("real SDK and PostgreSQL store one sourced draft under concurrent requests", async () => {
  const requestId = randomUUID();
  const responses = await Promise.all([api(projects[0], "POST", { requestId, allowDraft: true }), api(projects[0], "POST", { requestId, allowDraft: true })]);
  assert.ok(responses.some((response) => response.status === 200), await responses[0].clone().text());
  assert.ok(responses.every((response) => [200,409].includes(response.status)));
  firstId = (await responses.find((response) => response.status === 200).json()).data.briefId;
  const stored = await pool.query('SELECT content,json FROM "Brief" WHERE id=$1', [firstId]);
  assert.equal(stored.rows[0].json.generation.draft, true);
  assert.equal(stored.rows[0].json.generation.version, 1);
  assert.equal(stored.rows[0].json.document.features[0].priority, "MUST");
  assert.match(stored.rows[0].content, /## 17\. Critères de validation/);
  firstDocument = stored.rows[0]; assert.equal(calls, 1);
  assert.equal((await pool.query('SELECT status FROM "Project" WHERE id=$1', [projects[0]])).rows[0].status, "INTERVIEW");
  const replay = await api(projects[0], "POST", { requestId, allowDraft: true });
  assert.equal((await replay.json()).data.briefId, firstId); assert.equal(calls, 1);
  const alias = await api(projects[0], "POST", { requestId: randomUUID(), allowDraft: true });
  assert.equal((await alias.json()).data.briefId, firstId); assert.equal(calls, 1);
});

test("regeneration uses new interview answers while retaining the prior version", async () => {
  await ageRequests(projects[0]); await seedInterview(projects[0], true);
  const response = await api(projects[0], "POST", { requestId: randomUUID(), allowDraft: false });
  assert.equal(response.status, 200, await response.clone().text());
  secondId = (await response.json()).data.briefId; assert.notEqual(secondId, firstId);
  const second = (await (await api(projects[0], "GET", undefined, tokens[0], secondId)).json()).data;
  assert.equal(second.generation.version, 2); assert.equal(second.generation.draft, false);
  assert.equal((await pool.query('SELECT status FROM "Project" WHERE id=$1', [projects[0]])).rows[0].status, "BRIEF_GENERATED");
  const previous = (await pool.query('SELECT content,json FROM "Brief" WHERE id=$1', [firstId])).rows[0]; assert.deepEqual(previous, firstDocument);
  assert.equal((await (await api(projects[0])).json()).data.briefs.length, 2);
  assert.equal((await api(projects[0], "GET", undefined, tokens[1], firstId)).status, 404);
  assert.equal((await api(projects[1], "GET", undefined, tokens[1], firstId)).status, 404);
});

test("a project changed during generation never receives a stale persisted document", async () => {
  await ageRequests(projects[0]);
  await pool.query('UPDATE "Project" SET description=description || \' Nouvelle précision\' WHERE id=$1', [projects[0]]);
  const before = calls;
  const pending = api(projects[0], "POST", { requestId: randomUUID(), allowDraft: true });
  for (let i = 0; i < 100 && calls === before; i++) await delay(10);
  await pool.query('UPDATE "Project" SET description=description || \' Modification concurrente\' WHERE id=$1', [projects[0]]);
  assert.equal((await pending).status, 409);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM "Brief" WHERE "projectId"=$1', [projects[0]])).rows[0].n, 2);
});

test("invalid output, refusal and quota errors preserve documents and hide provider details", async () => {
  for (const [failure, status] of [["invalid",502], ["refusal",422], ["quota",503]]) {
    mode = failure; await ageRequests(failureProject);
    const response = await api(failureProject, "POST", { requestId: randomUUID(), allowDraft: true }, tokens[1]);
    assert.equal(response.status, status); assert.ok(!(await response.text()).includes("private-provider-details"));
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM "Brief" WHERE "projectId"=$1', [failureProject])).rows[0].n, 0);
  }
  mode = "normal";
});

test("brief reader shows both versions, sections and draft labels in the authenticated dashboard", async () => {
  for (const id of [firstId, secondId]) {
    const response = await fetch(`${base}/dashboard/projects/${projects[0]}/briefs/${id}`, { headers: { Cookie: `authjs.session-token=${tokens[0]}` } });
    assert.equal(response.status, 200);
    const html = await response.text(); assert.match(html, /Sommaire/); assert.match(html, /Gestion des disponibilités/); assert.match(html, /Version 1/); assert.match(html, /Version 2/);
  }
  const workspace = await fetch(`${base}/dashboard/briefs`, { headers: { Cookie: `authjs.session-token=${tokens[0]}` } });
  assert.ok((await workspace.text()).includes(firstId));
});

test("brief reader rejects anonymous, foreign-owner and cross-project document access", async () => {
  const path = `/dashboard/projects/${projects[0]}/briefs/${firstId}`;
  assert.equal((await fetch(`${base}${path}`, { redirect: "manual" })).status, 307);
  const foreign = await fetch(`${base}${path}`, { headers: { Cookie: `authjs.session-token=${tokens[1]}` } });
  // A streamed App Router page can send its 200 headers before notFound is resolved.
  assert.ok([200,404].includes(foreign.status));
  const denied = await foreign.text(); assert.ok(denied.includes("Projet introuvable")); assert.ok(!denied.includes("Gestion des disponibilités"));
  assert.equal((await api(projects[0], "GET", undefined, tokens[1], firstId)).status, 404);
  const wrongProject = await fetch(`${base}/dashboard/projects/${projects[1]}/briefs/${firstId}`, { headers: { Cookie: `authjs.session-token=${tokens[1]}` } });
  assert.ok([200,404].includes(wrongProject.status));
  const wrongBody = await wrongProject.text(); assert.ok(wrongBody.includes("Projet introuvable")); assert.ok(!wrongBody.includes("Gestion des disponibilités"));
  assert.equal((await api(projects[1], "GET", undefined, tokens[1], firstId)).status, 404);
});

test("brief generation and reader work in Chrome on mobile and desktop", { skip: process.env.BRIEF_VISUAL_TEST !== "1" }, async () => {
  const { checkBriefBrowser } = await import("./helpers/brief-browser.mjs");
  await checkBriefBrowser({ base, token: tokens[2], projectId: projects[2], onNewAnswers: async () => { await ageRequests(projects[2]); await seedInterview(projects[2], true); } });
});
