import dotenv from 'dotenv';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
dotenv.config({ quiet: true });

// Own one freshly created local database. Never reuse, reset or drop a pre-existing name.
export async function withIsolatedDatabase(callback) {
  const source=new URL(process.env.DATABASE_URL ?? '');
  if (!['postgres:','postgresql:'].includes(source.protocol) || !['localhost','127.0.0.1','[::1]'].includes(source.hostname)) throw new Error('Tests require a local PostgreSQL server');
  const database=`briefpilot_test_${randomUUID().replaceAll('-','')}`;
  const adminUrl=new URL(source); adminUrl.pathname='/postgres'; adminUrl.search='';
  const testUrl=new URL(source); testUrl.pathname=`/${database}`;
  const admin=new pg.Client({connectionString:adminUrl.href});
  let created=false, connected=false, interrupted=false, migration;
  const interrupt=()=>{interrupted=true;migration?.kill('SIGTERM');};
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,interrupt);
  try {
    await admin.connect(); connected=true;
    if(interrupted)throw new Error('Test setup interrupted');
    await admin.query(`CREATE DATABASE "${database}"`); created=true;
    if(interrupted)throw new Error('Test setup interrupted');
    const env={...process.env,DATABASE_URL:testUrl.href,NEXT_TELEMETRY_DISABLED:'1',OBSERVABILITY_ENABLED:'false',OBSERVABILITY_TEST_MODE:'true',NEXT_PUBLIC_OBSERVABILITY_TEST_MODE:'true',NEXT_PUBLIC_OBSERVABILITY_ENABLED:'false',POSTHOG_ENABLED:'false',AI_MONITORING_ENABLED:'false',SENTRY_DSN:'',NEXT_PUBLIC_SENTRY_DSN:'',E2E_TEST:'true'};
    await new Promise((resolve,reject)=>{
      migration=spawn(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env,stdio:['ignore','ignore','pipe']});
      migration.stderr.on('data',()=>{});
      migration.once('error',reject);
      migration.once('exit',code=>code===0?resolve():reject(new Error('Isolated test migration failed')));
    });
    if(interrupted)throw new Error('Test setup interrupted');
    return await callback({database,databaseUrl:testUrl.href,env});
  } finally {
    try {
      if (created) {
        await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[database]);
        await admin.query(`DROP DATABASE "${database}"`);
      }
    } finally {
      if(connected)await admin.end();
      for(const signal of ['SIGTERM','SIGINT'])process.removeListener(signal,interrupt);
    }
  }
}
