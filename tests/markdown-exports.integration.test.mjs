import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { before, after, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ quiet: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.MARKDOWN_TEST_PORT ?? 3141), base = `http://localhost:${port}`;
const owners = [randomUUID(), randomUUID()], tokens = owners.map(() => randomUUID()), projects = owners.map(() => randomUUID());
const briefs = [randomUUID(),randomUUID()], backlogs = [randomUUID(),randomUUID()];
let child, provider, calls = 0, beforeDigest;
const originalPrompt = 'Lire AGENTS.md.\r\n```ts\nconst réservation = "test | données";\n```\n`````\nPrésenter les tests et les risques.\n';
function briefData(version) {
  const document = JSON.parse(readFileSync('docs/prompts/brief-generator.example.json','utf8'));
  if (version === 2) {
    document.missingInformation=[];
    document.budgetAndTimeline.budget={text:'5 000 EUR',status:'confirmed',sourceIds:['message:answer-1']};
    document.budgetAndTimeline.deadlines=[{text:'15 janvier 2027',status:'confirmed',sourceIds:['message:answer-1']}];
  }
  return {schemaVersion:'brief.v1',document,generation:{version,requestId:randomUUID(),sourceRevision:'a'.repeat(64),projectName:'Réservations à Évry',projectType:'WEBSITE',language:'fr',draft:version===1,generatedAt:`2026-10-${19+version}T10:00:00Z`,model:'private-model-marker'}};
}
function backlogData(version) {
  const document=JSON.parse(readFileSync('docs/prompts/backlog-generator.example.json','utf8'));
  document.tasks[0].codexPrompt=originalPrompt;
  return {schemaVersion:'backlog.v1',document,generation:{model:'private-model-marker',language:'fr',generatedAt:`2026-10-${19+version}T11:00:00Z`,projectName:'Réservations à Évry',sourceBriefVersion:version}};
}
async function digest() {
  const b=await pool.query('SELECT id,json,content,"updatedAt" FROM "Brief" WHERE "projectId"=$1 ORDER BY id',[projects[0]]);
  const k=await pool.query('SELECT id,data,"updatedAt" FROM "Backlog" WHERE "projectId"=$1 ORDER BY id',[projects[0]]);
  return createHash('sha256').update(JSON.stringify([b.rows,k.rows])).digest('hex');
}
before(async()=>{
  for(let i=0;i<owners.length;i++) {
    await pool.query('INSERT INTO "User" (id,email,"updatedAt") VALUES ($1,$2,NOW())',[owners[i],`export-test-${owners[i]}@example.invalid`]);
    await pool.query('INSERT INTO "Session" (id,"sessionToken","userId",expires) VALUES ($1,$2,$3,NOW()+INTERVAL \'1 hour\')',[randomUUID(),tokens[i],owners[i]]);
    await pool.query('INSERT INTO "Project" (id,name,type,"ownerId","updatedAt") VALUES ($1,\'Réservations à Évry\',\'WEBSITE\',$2,NOW())',[projects[i],owners[i]]);
  }
  for(let i=0;i<2;i++) {
    await pool.query('INSERT INTO "Brief" (id,title,content,json,"projectId","createdAt","updatedAt") VALUES ($1,\'Brief export\',\'DO NOT EXPORT STALE CONTENT\',$2,$3,$4,NOW())',[briefs[i],briefData(i+1),projects[0],`2026-10-${20+i}T10:00:00Z`]);
    await pool.query('INSERT INTO "Backlog" (id,"projectId","sourceBriefId",version,status,data,"sourceRevision","createdAt","updatedAt") VALUES ($1,$2,$3,$4,\'DRAFT\',$5,$6,$7,NOW())',[backlogs[i],projects[0],briefs[i],i+1,backlogData(i+1),'a'.repeat(64),`2026-10-${20+i}T11:00:00Z`]);
  }
  beforeDigest=await digest();
  provider=createServer((request,response)=>{calls++;response.writeHead(500);response.end('Export must not call OpenAI');});
  await new Promise(resolve=>provider.listen(port+1,'127.0.0.1',resolve));
  child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{detached:true,stdio:'ignore',env:{...process.env,OPENAI_API_KEY:'server-configuration-must-not-export',OPENAI_MODEL:'private-model-marker',OPENAI_BASE_URL:`http://127.0.0.1:${port+1}/v1`}});
  for(let i=0;i<100;i++){try{if((await fetch(`${base}/login`)).ok)return;}catch{}await delay(100);}
  throw new Error('Next test server did not start');
});
after(async()=>{
  if(child&&child.exitCode===null)process.kill(-child.pid,'SIGTERM');
  if(provider)await new Promise(resolve=>provider.close(resolve));
  try{await pool.query('DELETE FROM "User" WHERE id=ANY($1::text[])',[owners]);}finally{await pool.end();}
});
async function download(kind,id,{session=tokens[0],projectId=projects[0],query=''}={}) {
  return fetch(`${base}/api/projects/${projectId}/exports/${kind}/${id}${query}`,{redirect:'manual',headers:session?{Cookie:`authjs.session-token=${session}`}:{}});
}
test('exports reject anonymous, missing, foreign-owner and cross-project access',async()=>{
  for(const [kind,id] of [['brief',briefs[0]],['backlog',backlogs[0]]]) {
    assert.equal((await download(kind,id,{session:null})).status,401);
    assert.equal((await download(kind,id,{session:tokens[1]})).status,404);
    assert.equal((await download(kind,id,{session:tokens[1],projectId:projects[1]})).status,404);
    assert.equal((await download(kind,randomUUID())).status,404);
    assert.equal((await download(kind,id,{projectId:randomUUID()})).status,404);
  }
});
test('brief downloads use canonical JSON, real selected versions and UTF-8 private attachment headers',async()=>{
  for(let i=0;i<2;i++) {
    const response=await download('brief',briefs[i]); assert.equal(response.status,200,await response.clone().text());
    assert.equal(response.headers.get('content-type'),'text/markdown; charset=utf-8');
    assert.equal(response.headers.get('content-disposition'),`attachment; filename="reservations-a-evry-brief-v${i+1}.md"`);
    assert.equal(response.headers.get('cache-control'),'private, no-store'); assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    const body=await response.text();assert.ok(body.includes('Réservations à Évry'));assert.ok(body.includes(`Version : ${i+1}`));assert.equal(body.match(/^## /gm).length,17);
    assert.ok(body.includes(i===0?'Brouillon':'Document généré'));assert.ok(!body.includes('DO NOT EXPORT STALE CONTENT'));
    assert.doesNotMatch(body,/server-configuration-must-not-export|private-model-marker|authjs|sessionToken/);
    assert.equal(await(await download('brief',briefs[i])).text(),body);
  }
});
test('backlog and Codex exports retain dependencies and nested prompt bytes from the old version',async()=>{
  const response=await download('backlog',backlogs[0]);assert.equal(response.status,200);assert.ok(response.headers.get('content-disposition').includes('backlog-v1.md'));
  const body=await response.text();for(const value of ['Foundation','MVP','T-001','T-002','Tests attendus','source : version 1'])assert.ok(body.includes(value),value);
  const codex=await download('backlog',backlogs[0],{query:'?format=codex-tasks'});assert.equal(codex.status,200);assert.ok(codex.headers.get('content-disposition').includes('codex-tasks-v1.md'));
  const text=await codex.text();assert.ok(text.includes(originalPrompt));assert.ok(text.includes(`\`\`\`\`\`\`text\n${originalPrompt}\`\`\`\`\`\``));
});
test('export modes are controlled and filenames resist header injection',async()=>{
  assert.equal((await download('backlog',backlogs[0],{query:'?format=pdf'})).status,400);
  assert.equal((await download('backlog',backlogs[0],{query:'?format=backlog&format=codex-tasks'})).status,400);
  const original=(await pool.query('SELECT json FROM "Brief" WHERE id=$1',[briefs[0]])).rows[0].json;
  try {
    const changed=structuredClone(original);changed.generation.projectName='Évry ../../\r\nX-Injected: yes';
    await pool.query('UPDATE "Brief" SET json=$2 WHERE id=$1',[briefs[0],changed]);
    const response=await download('brief',briefs[0]);assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/^attachment; filename="[a-z0-9-]+\.md"$/);assert.equal(response.headers.get('x-injected'),null);
  } finally {await pool.query('UPDATE "Brief" SET json=$2 WHERE id=$1',[briefs[0],original]);}
});
test('invalid documents, cycles and credential-like data are refused without disclosure',async()=>{
  const original=(await pool.query('SELECT data FROM "Backlog" WHERE id=$1',[backlogs[0]])).rows[0].data;
  try {
    for(const mode of ['invalid','cycle','secret']) {
      const data=structuredClone(original);
      if(mode==='invalid')data.document={};
      if(mode==='cycle')data.document.tasks[0].dependencies=['T-002'];
      if(mode==='secret')data.document.tasks[0].codexPrompt='api_key=privatecredential123456';
      await pool.query('UPDATE "Backlog" SET data=$2 WHERE id=$1',[backlogs[0],data]);
      const response=await download('backlog',backlogs[0],{query:'?format=codex-tasks'});assert.equal(response.status,422);assert.doesNotMatch(await response.text(),/privatecredential|server-configuration/);
    }
  } finally {await pool.query('UPDATE "Backlog" SET data=$2 WHERE id=$1',[backlogs[0],original]);}
});
test('exports neither mutate documents nor call OpenAI',async()=>{assert.equal(await digest(),beforeDigest);assert.equal(calls,0);});
test('Chrome downloads all three Markdown files and reports errors safely', {skip:process.env.MARKDOWN_VISUAL_TEST!=='1'},async()=>{
  const {checkMarkdownBrowser}=await import('./helpers/markdown-browser.mjs');
  await checkMarkdownBrowser({base,token:tokens[0],projectId:projects[0],briefId:briefs[0],backlogId:backlogs[0],expectedPrompt:originalPrompt});
  assert.equal(await digest(),beforeDigest);assert.equal(calls,0);
});
