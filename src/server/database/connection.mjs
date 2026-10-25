import { z } from "zod";

/** Shared operational guards. Errors never contain input URLs or credentials. */
export class DatabaseConfigurationError extends Error {
  constructor() { super('Database configuration is invalid. Check the selected environment and secret settings.'); }
}
const loopback = new Set(['localhost','127.0.0.1','[::1]']);
export function securePgUrl(value, { neon = false, pooled } = {}) {
  try {
    const url = new URL(value);
    if (!['postgres:','postgresql:'].includes(url.protocol) || !url.username || !url.password || url.hash) throw new Error();
    if (loopback.has(url.hostname)) { if (neon) throw new Error(); return url.href; }
    if (!['require','verify-full'].includes(url.searchParams.get('sslmode'))) throw new Error();
    const allowed = new Set(['sslmode','channel_binding','connect_timeout','schema']);
    for (const key of url.searchParams.keys()) if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) throw new Error();
    if (neon) {
      if (!/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(url.hostname) || url.pathname !== '/briefpilot_staging' || (url.port && url.port !== '5432')) throw new Error();
      if (pooled !== undefined && url.hostname.includes('-pooler.') !== pooled) throw new Error();
    }
    // pg 8 must validate the server certificate and hostname, not merely encrypt.
    url.searchParams.set('sslmode','verify-full');
    return url.href;
  } catch { throw new DatabaseConfigurationError(); }
}
export function stagingConnections(values) {
  const checked=z.object({APP_ENV:z.literal('staging'),NODE_ENV:z.literal('production'),DATABASE_URL:z.string().min(1),DIRECT_URL:z.string().min(1)}).safeParse(values);
  if (!checked.success) throw new DatabaseConfigurationError();
  const pooled = securePgUrl(values.DATABASE_URL, {neon:true,pooled:true});
  const direct = securePgUrl(values.DIRECT_URL, {neon:true,pooled:false});
  const a = new URL(pooled), b = new URL(direct);
  if (a.hostname.replace('-pooler.','.') !== b.hostname || a.pathname !== b.pathname || a.username !== b.username || a.password !== b.password) throw new DatabaseConfigurationError();
  return { pooled, direct };
}
/** @param {Record<string, string | undefined>} [values] */
export function runtimePoolConfig(values = process.env) {
  const max = Number(values.DATABASE_POOL_MAX ?? 5);
  if (!Number.isInteger(max) || max < 1 || max > 20) throw new DatabaseConfigurationError();
  const value = values.DATABASE_URL;
  const connectionString = value ? securePgUrl(value, values.APP_ENV === 'staging' ? {neon:true,pooled:true} : {}) : undefined;
  if (values.APP_ENV === 'staging' && !connectionString) throw new DatabaseConfigurationError();
  return { connectionString, max, connectionTimeoutMillis:10000, idleTimeoutMillis:30000, allowExitOnIdle:true };
}
