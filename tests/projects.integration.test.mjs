import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ quiet: true });
const baseUrl = process.env.AUTH_TEST_URL ?? "http://localhost:3109";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const ownerId = randomUUID();
const otherId = randomUUID();
const token = randomUUID();
const foreignProjectId = randomUUID();
const foreignName = `Projet privé ${randomUUID()}`;
const cookie = `authjs.session-token=${token}`;
let createdId;

before(async () => {
  for (const id of [ownerId, otherId]) {
    await pool.query('INSERT INTO "User" (id,email,"updatedAt") VALUES ($1,$2,NOW())',
      [id, `projects-test-${id}@example.invalid`]);
  }
  await pool.query('INSERT INTO "Session" (id,"sessionToken","userId",expires) VALUES ($1,$2,$3,NOW()+INTERVAL \'10 minutes\')',
    [randomUUID(), token, ownerId]);
  await pool.query('INSERT INTO "Project" (id,name,type,"ownerId","updatedAt") VALUES ($1,$2,\'SAAS\',$3,NOW())',
    [foreignProjectId, foreignName, otherId]);
});

after(async () => {
  try {
    await pool.query('DELETE FROM "User" WHERE id = ANY($1::text[])', [[ownerId, otherId]]);
  } finally { await pool.end(); }
});

async function get(path, authenticated = true) {
  return fetch(new URL(path, baseUrl), {
    headers: authenticated ? { cookie } : {}, redirect: "manual",
  });
}

function decode(value) {
  return value.replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// Submit the actual server-rendered form, including React's bound action fields.
async function projectForm() {
  const response = await get("/dashboard/projects");
  assert.equal(response.status, 200);
  const html = await response.text();
  const form = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)]
    .find((match) => match[1].includes('name="name"'))?.[1];
  assert.ok(form, "project creation form is present");
  const data = new FormData();
  for (const match of form.matchAll(/<input\b[^>]*>/g)) {
    const tag = match[0];
    if (!tag.includes('type="hidden"')) continue;
    const name = tag.match(/\bname="([^"]*)"/)?.[1];
    const value = tag.match(/\bvalue="([^"]*)"/)?.[1] ?? "";
    if (name) data.append(decode(name), decode(value));
  }
  assert.ok([...data.keys()].some((key) => key.startsWith("$ACTION_")));
  return data;
}

async function submit(data, authenticated = true) {
  return fetch(new URL("/dashboard/projects", baseUrl), {
    method: "POST", body: data, redirect: "manual",
    headers: { Origin: new URL(baseUrl).origin, ...(authenticated ? { cookie } : {}) },
  });
}

test("a new account sees an empty list without other users' projects", async () => {
  const response = await get("/dashboard/projects");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes("Aucun projet pour l’instant"));
  assert.ok(!html.includes(foreignName));
});

for (const [label, fields] of [
  ["short name", { name: "x" }],
  ["whitespace name", { name: "   " }],
  ["long name", { name: "x".repeat(121) }],
  ["unknown type", { type: "ADMIN" }],
  ["long description", { description: "x".repeat(2001) }],
  ["file as name", { name: new Blob(["bad"]), }],
]) {
  test(`server rejects ${label} without creating a project`, async () => {
    const data = await projectForm();
    for (const [key, value] of Object.entries({ name: "Projet valide", type: "WEBSITE", description: "", ...fields })) data.set(key, value);
    const response = await submit(data);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Vérifie les champs du formulaire/);
    const count = await pool.query('SELECT COUNT(*)::int AS n FROM "Project" WHERE "ownerId"=$1', [ownerId]);
    assert.equal(count.rows[0].n, 0);
  });
}

test("creation requires authentication even when called directly", async () => {
  const data = await projectForm();
  data.set("name", "Projet interdit"); data.set("type", "WEBSITE");
  const response = await submit(data, false);
  assert.equal(response.status, 303);
  assert.equal(new URL(response.headers.get("location"), baseUrl).pathname, "/login");
  const count = await pool.query('SELECT COUNT(*)::int AS n FROM "Project" WHERE "ownerId"=$1', [ownerId]);
  assert.equal(count.rows[0].n, 0);
});

test("creation assigns the session owner, trims inputs and redirects to detail", async () => {
  const data = await projectForm();
  data.set("name", "  Projet de test  ");
  data.set("type", "ECOMMERCE");
  data.set("description", "  Première ligne\nDeuxième ligne  ");
  data.set("ownerId", otherId);
  const response = await submit(data);
  assert.equal(response.status, 303);
  const location = new URL(response.headers.get("location"), baseUrl).pathname;
  assert.match(location, /^\/dashboard\/projects\/[^/]+$/);
  createdId = location.split("/").at(-1);
  const result = await pool.query('SELECT name,type,status,description,"ownerId" FROM "Project" WHERE id=$1', [createdId]);
  assert.deepEqual(result.rows[0], {
    name: "Projet de test", type: "ECOMMERCE", status: "DRAFT",
    description: "Première ligne\r\nDeuxième ligne", ownerId,
  });
  const detail = await get(location);
  assert.equal(detail.status, 200);
  const html = await detail.text();
  assert.match(html, /Projet de test/);
  assert.match(html, /Brouillon/);
  assert.match(html, /E-commerce/);
});

test("optional description is stored as null and newest projects appear first", async () => {
  const data = await projectForm();
  data.set("name", "Projet récent"); data.set("type", "SAAS");
  const response = await submit(data);
  assert.equal(response.status, 303);
  const id = new URL(response.headers.get("location"), baseUrl).pathname.split("/").at(-1);
  const result = await pool.query('SELECT description FROM "Project" WHERE id=$1', [id]);
  assert.equal(result.rows[0].description, null);
  const html = await (await get("/dashboard/projects")).text();
  assert.ok(html.includes(`href="/dashboard/projects/${createdId}"`));
  assert.ok(html.indexOf("Projet récent") < html.indexOf("Projet de test"));
  assert.ok(!html.includes(foreignName));
});

test("detail shows the persisted interview and brief counts", async () => {
  assert.ok(createdId);
  for (const content of ["Question", "Réponse"]) {
    await pool.query('INSERT INTO "InterviewMessage" (id,role,content,"projectId") VALUES ($1,\'user\',$2,$3)',
      [randomUUID(), content, createdId]);
  }
  await pool.query('INSERT INTO "Brief" (id,title,content,"projectId","updatedAt") VALUES ($1,\'Brief test\',\'Contenu\',$2,NOW())',
    [randomUUID(), createdId]);
  const response = await get(`/dashboard/projects/${createdId}`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h2>Interview IA<\/h2>[\s\S]*?>2<\/p>/);
  assert.match(html, /<h2>Briefs<\/h2>[\s\S]*?>1<\/p>/);
});

test("foreign, unknown and malformed project identifiers reveal no project", async () => {
  for (const id of [foreignProjectId, randomUUID(), "bad%20id"]) {
    const response = await get(`/dashboard/projects/${id}`);
    const html = await response.text();
    // Next.js can send 200 for a streamed not-found response; check the rendered boundary.
    assert.ok([200, 404].includes(response.status));
    assert.match(html, /Projet introuvable/);
    assert.ok(!html.includes(foreignName));
  }
});

test("anonymous visitors cannot open a project detail", async () => {
  const response = await get(`/dashboard/projects/${foreignProjectId}`, false);
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location"), baseUrl).pathname, "/login");
});
