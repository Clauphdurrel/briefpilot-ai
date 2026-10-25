import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import pg from 'pg';
import { stagingConnections, DatabaseConfigurationError } from '../src/server/database/connection.mjs';

export function loadStagingEnvironment(path = resolve('.env.staging.local')) {
  try {
    const stat=lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new Error();
    const values=dotenv.parse(readFileSync(path));
    return { values, connections:stagingConnections(values), path };
  } catch { throw new DatabaseConfigurationError(); }
}
export function localMigrations(root=resolve('prisma/migrations')) {
  return readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory()&&/^\d{14}_[a-z0-9_]+$/.test(x.name)).map(x=>{
    const sql=readFileSync(resolve(root,x.name,'migration.sql'),'utf8');
    return { name:x.name, checksum:createHash('sha256').update(sql).digest('hex'), destructive: /(?:^|;)\s*(?:--[^\n]*\n\s*)*(?:DROP|DELETE|TRUNCATE|UPDATE)\b|\bDROP\s+(?:COLUMN|TABLE|CONSTRAINT|INDEX|TYPE|SCHEMA)\b/i.test(sql) };
  }).sort((a,b)=>a.name.localeCompare(b.name));
}
export function compareMigrations(local, rows) {
  const known=new Map(local.map(x=>[x.name,x])),applied=new Set();
  for(const row of rows) {
    if(row.rolled_back_at)continue;
    const expected=known.get(row.migration_name);
    if(!expected || expected.checksum!==row.checksum || !row.finished_at)throw new DatabaseConfigurationError();
    applied.add(row.migration_name);
  }
  return local.filter(x=>!applied.has(x.name));
}
async function inspect(connectionString) {
  const client=new pg.Client({connectionString,connectionTimeoutMillis:10000,query_timeout:5000});
  try {
    await client.connect(); await client.query('BEGIN READ ONLY');
    if((await client.query('SELECT 1 AS ok')).rows[0].ok!==1)throw new DatabaseConfigurationError();
    const current=await client.query('SELECT current_database() AS name');
    if(current.rows[0].name!=='briefpilot_staging')throw new DatabaseConfigurationError();
    // Neon terminates TLS at its proxy; inspect our actual client socket.
    if(client.connection.stream.encrypted!==true || client.connection.stream.authorized!==true)throw new DatabaseConfigurationError();
    const tables=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    const names=tables.rows.map(x=>x.tablename);
    const rows=names.includes('_prisma_migrations')?(await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations')).rows:[];
    let hasData=false;
    for(const name of names.filter(x=>x!=='_prisma_migrations')) {
      const quoted='"'+name.replaceAll('"','""')+'"';
      if((await client.query(`SELECT EXISTS(SELECT 1 FROM public.${quoted} LIMIT 1) AS present`)).rows[0].present)hasData=true;
    }
    await client.query('ROLLBACK');
    return { names, rows, hasData };
  } finally { await client.end().catch(()=>{}); }
}
function cliEnvironment(config) {
  const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL','SSL_CERT_FILE','SSL_CERT_DIR'].flatMap(k=>process.env[k]?[[k,process.env[k]]]:[]));
  return {...env,APP_ENV:'staging',NODE_ENV:'production',DATABASE_URL:config.connections.pooled,DIRECT_URL:config.connections.direct,DOTENV_CONFIG_PATH:config.path};
}
export async function runStagingDatabase(action,args=[]) {
  if(!['check','status','deploy','seed'].includes(action) || args.some(x=>!['--apply','--confirm-staging=briefpilot_staging'].includes(x)))throw new DatabaseConfigurationError();
  const config=loadStagingEnvironment(),local=localMigrations();
  const [pooled,direct]=await Promise.all([inspect(config.connections.pooled),inspect(config.connections.direct)]);
  const pending=compareMigrations(local,direct.rows);
  if(pooled.names.slice().sort().join()!==direct.names.slice().sort().join())throw new DatabaseConfigurationError();
  const summary={ environment:'staging',database:'briefpilot_staging',connection:'ok',tlsVerified:true,tables:direct.names.length,migrationsApplied:local.length-pending.length,migrationsPending:pending.length,migrationPlan:pending.map(({name,destructive})=>({name,destructive})) };
  if(action==='check')return summary;
  if(action==='status') {
    const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','status'],{env:cliEnvironment(config),encoding:'utf8',timeout:60000});
    if(result.error || result.status===null || (result.status!==0 && !pending.length))throw new DatabaseConfigurationError();
    return {...summary,prismaStatus:pending.length?'pending':'up-to-date'};
  }
  const apply=args.includes('--apply')&&args.includes('--confirm-staging=briefpilot_staging');
  if(action==='deploy') {
    if(pending.some(x=>x.destructive) || (!direct.rows.length&&direct.names.length) || (pending.length&&direct.hasData))throw new DatabaseConfigurationError();
    if(!apply)return {...summary,mode:'dry-run',changesApplied:false};
    const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env:cliEnvironment(config),encoding:'utf8',timeout:120000});
    if(result.error||result.status!==0)throw new DatabaseConfigurationError();
    const after=await inspect(config.connections.direct);
    if(compareMigrations(local,after.rows).length)throw new DatabaseConfigurationError();
    return {...summary,tables:after.names.length,migrationsApplied:local.length,migrationsPending:0,migrationPlan:[],mode:'apply',changesApplied:true};
  }
  if(pending.length)throw new DatabaseConfigurationError();
  if(!apply)return {...summary,mode:'dry-run',seedApplied:false};
  const client=new pg.Client({connectionString:config.connections.direct,connectionTimeoutMillis:10000,query_timeout:5000});
  const owner='00000000-0000-4000-8000-000000002501',project='00000000-0000-4000-8000-000000002502';
  try {
    await client.connect();await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(2500250025)');
    const existing=await client.query('SELECT id,email FROM "User" WHERE id=$1 OR email=$2',[owner,'staging-demo@example.invalid']);
    if(existing.rows.some(x=>x.id!==owner||x.email!=='staging-demo@example.invalid'))throw new DatabaseConfigurationError();
    await client.query('INSERT INTO "User" (id,name,email,"updatedAt") VALUES ($1,$2,$3,NOW()) ON CONFLICT (id) DO NOTHING',[owner,'Staging Demo','staging-demo@example.invalid']);
    const old=await client.query('SELECT "ownerId" FROM "Project" WHERE id=$1',[project]);
    if(old.rows.some(x=>x.ownerId!==owner))throw new DatabaseConfigurationError();
    await client.query('INSERT INTO "Project" (id,name,type,description,"ownerId","updatedAt") VALUES ($1,$2,\'WEBSITE\',$3,$4,NOW()) ON CONFLICT (id) DO NOTHING',[project,'Démonstration staging','Projet fictif sans donnée client ni génération IA.',owner]);
    await client.query('COMMIT');return {...summary,mode:'apply',seedApplied:true};
  } finally {await client.end().catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {console.log(JSON.stringify(await runStagingDatabase(process.argv[2],process.argv.slice(3))));}
  catch {console.error('Staging database check failed. Verify .env.staging.local (mode 600), Neon staging targets, TLS, permissions and migration state. No secret or provider error is printed.');process.exitCode=1;}
}
