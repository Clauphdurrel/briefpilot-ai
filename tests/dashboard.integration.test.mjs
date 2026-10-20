import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import dotenv from "dotenv";
import pg from "pg";

// Run against a local server and development database only.
// AUTH_TEST_URL=http://localhost:3108 node --test tests/dashboard.integration.test.mjs
dotenv.config({ quiet: true });
const baseUrl = process.env.AUTH_TEST_URL ?? "http://localhost:3108";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const userId = randomUUID();
const token = randomUUID();
const email = `dashboard-test-${userId}@example.invalid`;
const cookie = `authjs.session-token=${token}`;

before(async () => {
  // The fixture owns only these temporary rows; existing accounts are untouched.
  await pool.query(
    `WITH test_user AS (
      INSERT INTO "User" (id, name, email, "updatedAt")
      VALUES ($1, 'Dashboard test', $2, NOW()) RETURNING id
    )
    INSERT INTO "Session" (id, "sessionToken", "userId", expires)
    SELECT $3, $4, id, NOW() + INTERVAL '10 minutes' FROM test_user`,
    [userId, email, randomUUID(), token],
  );
});

after(async () => {
  try {
    await pool.query('DELETE FROM "User" WHERE id = $1', [userId]);
  } finally {
    await pool.end();
  }
});

for (const path of [
  "/dashboard",
  "/dashboard/projects",
  "/dashboard/briefs",
  "/dashboard/settings",
]) {
  test(`authenticated ${path} shares the dashboard layout and marks its active link`, async () => {
    const response = await fetch(new URL(path, baseUrl), {
      headers: { cookie }, redirect: "manual",
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Navigation du dashboard/);
    assert.match(html, /Espace de travail/);
    assert.ok(html.includes(email));
    assert.match(html, /Déconnexion/);
    for (const href of ["/dashboard", "/dashboard/projects", "/dashboard/briefs", "/dashboard/settings"]) {
      assert.ok(html.includes(`href="${href}"`), `missing navigation link ${href}`);
    }
    const activeLinks = [...html.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)];
    assert.equal(activeLinks.length, 1);
    assert.ok(activeLinks[0][0].includes(`href="${path}"`));
  });
}

test("authenticated visitors are redirected away from login", async () => {
  const response = await fetch(new URL("/login", baseUrl), {
    headers: { cookie }, redirect: "manual",
  });
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location"), baseUrl).pathname, "/dashboard");
});
