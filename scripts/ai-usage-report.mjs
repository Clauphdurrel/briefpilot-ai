import dotenv from 'dotenv';
import pg from 'pg';
import { z } from 'zod';
dotenv.config({ quiet: true });
let database;
try {
  const days = z.coerce.number().int().min(1).max(365).parse(process.env.AI_USAGE_REPORT_DAYS ?? 30);
  if (!process.env.DATABASE_URL) throw new Error('Database required');
  database = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000, query_timeout: 5000 });
  const since = new Date(Date.now() - days * 86400000);
  const result = await database.query(`SELECT agent, model, "pricingVersion", COUNT(*)::int AS attempts,
    SUM("inputTokens")::text AS "measuredInputTokens", SUM("cachedInputTokens")::text AS "measuredCachedTokens",
    SUM("outputTokens")::text AS "measuredOutputTokens", SUM("estimatedCost")::text AS "estimatedUSD",
    COUNT(*) FILTER (WHERE "usageStatus" <> 'KNOWN')::int AS "unknownOrPartialUsage",
    COUNT(*) FILTER (WHERE "estimatedCost" IS NULL)::int AS "unknownCostAttempts"
    FROM "AIUsageLog" WHERE "createdAt" >= $1 GROUP BY agent, model, "pricingVersion" ORDER BY agent, model`, [since]);
  console.log(JSON.stringify({ since: since.toISOString(), estimatesOnly: true, rows: result.rows }, null, 2));
} catch { console.error('AI usage report unavailable. Check database access, migrations and AI_USAGE_REPORT_DAYS.'); process.exitCode = 1; }
finally { await database?.end(); }
