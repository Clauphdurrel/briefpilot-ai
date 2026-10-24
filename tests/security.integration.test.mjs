import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import pg from "pg";

// Explicit isolated fixtures only; never load the application's .env implicitly.
// SECURITY_INTEGRATION=1 AUTH_TEST_URL=http://localhost:PORT DATABASE_URL=... node --test tests/security.integration.test.mjs
describe('authentication and project access security', { skip: process.env.SECURITY_INTEGRATION !== '1' }, () => {
  let pool, base;
  const users = [randomUUID(), randomUUID()], projects = users.map(() => randomUUID());
  const valid = randomUUID(), expired = randomUUID(), revoked = randomUUID(), logoutToken = randomUUID();
  const cookie = (token) => `authjs.session-token=${token}`;
  before(async () => {
    assert.ok(process.env.AUTH_TEST_URL, 'Provide an isolated local test server explicitly');
    base = new URL(process.env.AUTH_TEST_URL);
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) && base.protocol === 'http:', 'Only a local HTTP test server is permitted');
    assert.ok(process.env.DATABASE_URL, 'Provide the isolated test database explicitly');
    const db = new URL(process.env.DATABASE_URL);
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(db.hostname), 'Only a local test database is permitted');
    assert.match(db.pathname.slice(1), /^briefpilot_test_[a-z0-9_]+$/, 'Use a dedicated briefpilot_test_* database');
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    for (let index = 0; index < users.length; index++) {
      await pool.query('INSERT INTO "User" (id,email,"updatedAt") VALUES ($1,$2,NOW())', [users[index], `security-${users[index]}@example.invalid`]);
      await pool.query('INSERT INTO "Project" (id,name,type,"ownerId","updatedAt") VALUES ($1,$2,\'WEBSITE\',$3,NOW())', [projects[index], `Security project ${index}`, users[index]]);
    }
    for (const token of [valid, expired, revoked, logoutToken]) {
      await pool.query('INSERT INTO "Session" (id,"sessionToken","userId",expires) VALUES ($1,$2,$3,$4)', [randomUUID(), token, users[0], new Date(Date.now() + (token === expired ? -60000 : 600000))]);
    }
  });
  after(async () => { if (pool) { try { await pool.query('DELETE FROM "User" WHERE id=ANY($1::text[])', [users]); } finally { await pool.end(); } } });
  const request = (path, token = valid, options = {}) => fetch(new URL(path, base), { redirect: 'manual', ...options, headers: { Cookie: cookie(token), ...options.headers } });
  const decode = (value) => value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  async function actionForm(path, field) {
    const response = await request(path); assert.equal(response.status, 200);
    const html = await response.text();
    const form = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].find((match) => match[1].includes(`name="${field}"`));
    assert.ok(form, `Missing action form ${field}`);
    const data = new FormData();
    for (const [tag] of form[1].matchAll(/<input\b[^>]*>/g)) {
      if (!tag.includes('type="hidden"')) continue;
      const name = tag.match(/\bname="([^"]*)"/)?.[1], value = tag.match(/\bvalue="([^"]*)"/)?.[1] ?? '';
      if (name) data.append(decode(name), decode(value));
    }
    assert.ok([...data.keys()].some((key) => key.startsWith('$ACTION_')));
    return data;
  }
  test('unknown and expired sessions cannot read private pages or APIs', async () => {
    for (const token of [randomUUID(), expired]) {
      assert.equal(await (await request('/api/auth/session', token)).json(), null);
      const page = await request('/dashboard/projects', token);
      assert.equal(page.status, 307); assert.equal(new URL(page.headers.get('location'), base).pathname, '/login');
      assert.equal((await request(`/api/projects/${projects[0]}/interview`, token)).status, 401);
    }
  });
  test('public and private pages carry defensive browser headers', async () => {
    for (const path of ['/login', '/dashboard/projects']) {
      const response = path === '/login'
        ? await fetch(new URL(path, base), { redirect: 'manual' })
        : await request(path);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-security-policy'), "frame-ancestors 'none'");
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      assert.equal(response.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=(), payment=()');
    }
  });
  test('revoking a database session immediately denies the same cookie', async () => {
    assert.ok((await (await request('/api/auth/session', revoked)).json())?.user);
    await pool.query('DELETE FROM "Session" WHERE "sessionToken"=$1', [revoked]);
    assert.equal(await (await request('/api/auth/session', revoked)).json(), null);
    assert.equal((await request('/api/billing/usage', revoked)).status, 401);
  });
  test('cross-origin direct project actions cannot create a project', async () => {
    const data = await actionForm('/dashboard/projects', 'name');
    data.set('name', 'Cross-origin forbidden'); data.set('type', 'WEBSITE');
    const response = await request('/dashboard/projects', valid, { method: 'POST', headers: { Origin: 'https://attacker.invalid' }, body: data });
    assert.ok(response.status >= 400);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM "Project" WHERE "ownerId"=$1', [users[0]])).rows[0].n, 1);
  });
  test('direct archive action cannot modify a foreign project', async () => {
    const path = `/dashboard/projects/${projects[0]}`, data = await actionForm(path, 'projectId');
    data.set('projectId', projects[1]); data.set('archived', 'true');
    const response = await request(path, valid, { method: 'POST', headers: { Origin: base.origin }, body: data });
    assert.equal(response.status, 200); assert.match(await response.text(), /Impossible de modifier ce projet/);
    assert.equal((await pool.query('SELECT status FROM "Project" WHERE id=$1', [projects[1]])).rows[0].status, 'DRAFT');
    assert.equal((await request(`/api/projects/${projects[1]}/interview`)).status, 404);
  });
  test('sign-out without a valid CSRF token leaves the session usable', async () => {
    await request('/api/auth/signout', logoutToken, { method: 'POST', headers: { Origin: 'https://attacker.invalid', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'csrfToken=invalid&callbackUrl=%2Flogin' });
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM "Session" WHERE "sessionToken"=$1', [logoutToken])).rows[0].n, 1);
    assert.ok((await (await request('/api/auth/session', logoutToken)).json())?.user);
  });
  test('legitimate sign-out deletes the database session', async () => {
    const csrf = await request('/api/auth/csrf', logoutToken), { csrfToken } = await csrf.json();
    const csrfCookies = csrf.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    const body = new URLSearchParams({ csrfToken, callbackUrl: new URL('/login', base).href });
    await request('/api/auth/signout', logoutToken, { method: 'POST', headers: { Origin: base.origin, Cookie: `${cookie(logoutToken)}; ${csrfCookies}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM "Session" WHERE "sessionToken"=$1', [logoutToken])).rows[0].n, 0);
    assert.equal(await (await request('/api/auth/session', logoutToken)).json(), null);
  });
  test('login errors never reflect arbitrary query text or prototype names', async () => {
    for (const error of ['__proto__', 'constructor', 'private-marker-<script>']) {
      const response = await fetch(new URL(`/login?error=${encodeURIComponent(error)}`, base));
      assert.equal(response.status, 200); const html = await response.text();
      assert.match(html, /La connexion n’a pas abouti/);
      // Next may serialize the searchParams in its RSC payload; the alert itself must be fixed text.
      assert.match(html, /role="alert"[^>]*>La connexion n’a pas abouti\. Réessaie\.<\/p>/);
    }
  });
});
