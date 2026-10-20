import assert from "node:assert/strict";
import test from "node:test";

// Run against a local Next.js server: AUTH_TEST_URL=http://localhost:3107 node --test tests/auth.integration.test.mjs
const baseUrl = process.env.AUTH_TEST_URL ?? "http://localhost:3107";

for (const path of [
  "/dashboard",
  "/dashboard/projects",
  "/dashboard/briefs",
  "/dashboard/settings",
]) {
  test(`anonymous visitors are redirected from ${path} to login`, async () => {
    const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });

    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location"), baseUrl).pathname, "/login");
  });
}

test("login is public and offers Google sign-in", async () => {
  const response = await fetch(new URL("/login", baseUrl));

  assert.equal(response.status, 200);
  assert.match(await response.text(), /Continuer avec Google/);
});

test("Auth.js exposes the Google OAuth provider", async () => {
  const response = await fetch(new URL("/api/auth/providers", baseUrl));
  assert.equal(response.status, 200);

  const providers = await response.json();
  assert.equal(providers.google.id, "google");
  assert.equal(providers.google.type, "oidc");
  assert.equal(new URL(providers.google.callbackUrl).pathname, "/api/auth/callback/google");
});

test("anonymous requests do not have a session", async () => {
  const response = await fetch(new URL("/api/auth/session", baseUrl));

  assert.equal(response.status, 200);
  assert.equal(await response.json(), null);
});
