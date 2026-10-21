import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import dotenv from "dotenv";
import pg from "pg";

// Requires a production build and the development database. All OpenAI calls stay on localhost.
dotenv.config({ quiet: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.INTERVIEW_TEST_PORT ?? 3111);
const providerPort = port + 1;
const base = `http://localhost:${port}`;
const owner = randomUUID(), other = randomUUID();
const project = randomUUID(), foreignProject = randomUUID(), failureProject = randomUUID();
const token = randomUUID(), otherToken = randomUUID();
const categories = ["context", "problem", "objectives", "users", "features", "pages", "journeys", "roles", "content", "branding", "integrations", "data", "technical", "regulatory", "budget", "timeline", "success"];
let child, mock, calls = 0, state, startId;

before(async () => {
  for (const [id, session] of [[owner, token], [other, otherToken]]) {
    await pool.query('INSERT INTO "User" (id,email,"updatedAt") VALUES ($1,$2,NOW())', [id, `interview-test-${id}@example.invalid`]);
    await pool.query('INSERT INTO "Session" (id,"sessionToken","userId",expires) VALUES ($1,$2,$3,NOW()+INTERVAL \'1 hour\')', [randomUUID(), session, id]);
  }
  for (const [id, userId, name] of [[project, owner, "Immo test"], [foreignProject, other, "Projet privé"], [failureProject, other, "Quota fixture"]]) {
    await pool.query('INSERT INTO "Project" (id,name,type,description,"ownerId","updatedAt") VALUES ($1,$2,\'SAAS\',\'Plateforme immobilière au Sénégal\',$3,NOW())', [id, name, userId]);
  }
  mock = createServer(async (request, response) => {
    try {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      assert.equal(request.url, "/v1/responses");
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      calls++;
      const context = JSON.parse(body.input[1].content);
      if (context.project.name === "Quota fixture") {
        response.writeHead(429, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: { type: "insufficient_quota", code: "insufficient_quota", message: "private-provider-details" } }));
        return;
      }
      await delay(200);
      const answerCount = context.conversation.filter((item) => item.role === "user").length;
      const answered = answerCount > 0;
      const question = ["Quels profils utiliseront la plateforme ?", "Quelles fonctionnalités sont prioritaires pour les agences ?", "Quel budget souhaitez-vous prévoir ?", "Quels contenus pouvez-vous fournir ?"][answerCount] ?? `Quel autre point souhaitez-vous préciser (${answerCount}) ?`;
      const data = {
        summary: "Plateforme immobilière au Sénégal", message: question,
        knownInformation: answered ? ["Les agences immobilières utiliseront la plateforme."] : [],
        missingInformation: answered ? ["Fonctionnalités prioritaires"] : ["Utilisateurs cibles"],
        assumptions: [], completionScore: 99,
        nextQuestion: { id: answered ? "priority_features" : "target_users", question, category: answered ? "features" : "users", priority: "high", required: true, helpText: null },
        coverage: categories.map((category) => ({ category, status: answered && category === "users" ? "confirmed" : "missing", evidence: answered && category === "users" ? "Agences immobilières" : null })),
      };
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        id: `resp_${randomUUID()}`, object: "response", created_at: Math.floor(Date.now() / 1000), status: "completed", model: "test-model",
        output: [{ id: `msg_${randomUUID()}`, type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(data), annotations: [], logprobs: [] }] }],
        error: null, incomplete_details: null, metadata: {},
      }));
    } catch {
      response.writeHead(500, { "Content-Type": "application/json" }); response.end(JSON.stringify({ error: { message: "Invalid local mock request" } }));
    }
  });
  await new Promise((resolve) => mock.listen(providerPort, "127.0.0.1", resolve));
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: { ...process.env, OPENAI_API_KEY: "local-mock-key", OPENAI_MODEL: "test-model", OPENAI_BASE_URL: `http://127.0.0.1:${providerPort}/v1` },
    stdio: "ignore", detached: true,
  });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error("Local Next.js server exited");
    try { if ((await fetch(`${base}/api/auth/providers`)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error("Local Next.js server did not start");
});

after(async () => {
  if (child && child.exitCode === null) process.kill(-child.pid, "SIGTERM");
  if (mock) await new Promise((resolve) => mock.close(resolve));
  try { await pool.query('DELETE FROM "User" WHERE id = ANY($1::text[])', [[owner, other]]); }
  finally { await pool.end(); }
});

async function api(id, method = "GET", body, session = token, messages = false) {
  return fetch(`${base}/api/projects/${id}/interview${messages ? "/messages" : ""}`, {
    method, redirect: "manual", headers: {
      ...(session ? { Cookie: `authjs.session-token=${session}` } : {}),
      ...(method === "POST" ? { "Content-Type": "application/json", Origin: base } : {}),
    }, body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("real API enforces sessions, ownership and empty history without an AI call", async () => {
  assert.equal((await api(project, "GET", undefined, null)).status, 401);
  assert.equal((await api(project, "POST", { requestId: randomUUID() }, null)).status, 401);
  assert.equal((await api(foreignProject)).status, 404);
  assert.equal((await api(foreignProject, "POST", { requestId: randomUUID() })).status, 404);
  assert.equal((await api(randomUUID())).status, 404);
  assert.deepEqual((await (await api(project)).json()).data, { analysis: null, messages: [], completionScore: null, missingInformation: [] });
  assert.equal(calls, 0);
});

test("real SDK parsing and PostgreSQL persist an idempotent first interview", async () => {
  startId = randomUUID();
  const response = await api(project, "POST", { requestId: startId });
  assert.equal(response.status, 200, await response.clone().text());
  state = (await response.json()).data;
  assert.equal(state.messages.length, 1);
  assert.equal(state.completionScore, 0);
  assert.equal(state.messages[0].role, "assistant");
  assert.equal(calls, 1);
  assert.equal((await pool.query('SELECT status FROM "Project" WHERE id=$1', [project])).rows[0].status, "INTERVIEW");
  assert.deepEqual((await (await api(project, "POST", { requestId: startId })).json()).data, state);
  assert.deepEqual((await (await api(project, "POST", { requestId: randomUUID() })).json()).data, state);
  assert.equal(calls, 1);
  assert.equal((await api(project, "POST", { requestId: startId, language: "en" })).status, 409);
});

test("PostgreSQL serializes concurrent replies and a replay creates no duplicate messages", async () => {
  await delay(3100);
  const body = { requestId: randomUUID(), content: "Agences immobilières", expectedLastMessageId: state.messages.at(-1).id };
  const responses = await Promise.all([api(project, "POST", body, token, true), api(project, "POST", body, token, true)]);
  assert.ok(responses.some((response) => response.status === 200));
  assert.ok(responses.every((response) => [200, 409].includes(response.status)));
  state = (await responses.find((response) => response.status === 200).json()).data;
  assert.deepEqual(state.messages.map((item) => item.role), ["assistant", "user", "assistant"]);
  assert.equal(state.completionScore, 6);
  assert.equal(calls, 2);
  assert.deepEqual((await (await api(project, "POST", body, token, true)).json()).data, state);
  assert.equal(calls, 2);
  const counts = await pool.query('SELECT role,COUNT(*)::int AS n FROM "InterviewMessage" WHERE "projectId"=$1 GROUP BY role', [project]);
  assert.equal(counts.rows.find((row) => row.role === "user").n, 1);
  assert.equal(counts.rows.find((row) => row.role === "assistant").n, 2);
});

test("history survives fresh requests and stale answers are rejected before the provider call", async () => {
  assert.deepEqual((await (await api(project)).json()).data, state);
  assert.equal((await api(project, "GET", undefined, otherToken)).status, 404);
  await delay(3100);
  assert.equal((await api(project, "POST", { requestId: randomUUID(), content: "Ancienne réponse", expectedLastMessageId: state.messages[0].id }, token, true)).status, 409);
  assert.equal(calls, 2);
});

test("quota errors are sanitized and do not change project status or persist half a turn", async () => {
  const response = await api(failureProject, "POST", { requestId: randomUUID() }, otherToken);
  assert.equal(response.status, 503);
  const text = await response.text(); assert.ok(!text.includes("private-provider-details"));
  assert.equal(JSON.parse(text).error.code, "AI_QUOTA");
  assert.equal((await pool.query('SELECT status FROM "Project" WHERE id=$1', [failureProject])).rows[0].status, "DRAFT");
  assert.deepEqual((await (await api(failureProject, "GET", undefined, otherToken)).json()).data.messages, []);
});

test("durable owner quota blocks generation before the provider is charged", async () => {
  for (let i = 0; i < 40; i++) {
    const metadata = { kind: "interview_request", requestId: randomUUID(), hash: "test", status: "failed", attempts: 1, leaseUntil: new Date(Date.now() - 3600000).toISOString() };
    await pool.query('INSERT INTO "InterviewMessage" (id,"projectId",role,content,metadata,"createdAt") VALUES ($1,$2,\'system\',\'\',$3,NOW()-INTERVAL \'1 hour\')', [randomUUID(), project, metadata]);
  }
  const before = calls;
  assert.equal((await api(project, "POST", { requestId: randomUUID(), content: "Réponse", expectedLastMessageId: state.messages.at(-1).id }, token, true)).status, 429);
  assert.equal(calls, before);
});

test("chat works in Chrome at mobile and desktop sizes without external API calls", { skip: process.env.INTERVIEW_VISUAL_TEST !== "1" }, async () => {
  const { checkInterviewBrowser } = await import("./helpers/interview-browser.mjs");
  await checkInterviewBrowser({ base, token: otherToken, projectId: foreignProject });
});
