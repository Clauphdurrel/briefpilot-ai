import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { z } from 'zod';

const optionsSchema = z.object({ days: z.coerce.number().int().min(7).max(365).default(90), apply: z.boolean().default(false) });
/** Deletes only old technical metrics. Quota ledgers and documents are untouched. */
export async function pruneAIUsage(database, options = {}, now = new Date()) {
  const { days, apply } = optionsSchema.parse(options);
  const cutoff = new Date(now.getTime() - days * 86400000);
  if (!apply) {
    const result = await database.query('SELECT COUNT(*)::int AS count FROM "AIUsageLog" WHERE "createdAt" < $1', [cutoff]);
    return { mode: 'dry-run', cutoff: cutoff.toISOString(), eligible: result.rows[0].count, deleted: 0 };
  }
  let deleted = 0, batches = 0;
  for (; batches < 10; batches++) {
    const result = await database.query('DELETE FROM "AIUsageLog" WHERE id IN (SELECT id FROM "AIUsageLog" WHERE "createdAt" < $1 ORDER BY "createdAt", id LIMIT 1000)', [cutoff]);
    deleted += result.rowCount ?? 0;
    if ((result.rowCount ?? 0) < 1000) break;
  }
  return { mode: 'apply', cutoff: cutoff.toISOString(), deleted, batchLimitReached: batches === 10 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  dotenv.config({ quiet: true });
  let database;
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => !['--apply', '--help'].includes(arg))) throw new Error('Invalid arguments');
    if (args.includes('--help')) console.log('Usage: pnpm observability:prune [--apply]. Default: dry run, AI_USAGE_RETENTION_DAYS=90 (7..365), max 10,000 old metric rows per run.');
    else {
      const options = optionsSchema.parse({ days: process.env.AI_USAGE_RETENTION_DAYS ?? 90, apply: args.includes('--apply') });
      if (!process.env.DATABASE_URL) throw new Error('Database required');
      database = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000, query_timeout: 5000 });
      console.log(JSON.stringify(await pruneAIUsage(database, options)));
    }
  } catch { console.error('AI metrics retention failed. Check arguments, database access and migrations.'); process.exitCode = 1; }
  finally { await database?.end(); }
}
