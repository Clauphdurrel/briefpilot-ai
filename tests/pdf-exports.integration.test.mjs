import {grantTestPlan} from "./helpers/billing-fixture.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync }  from "node:fs";
import { createServer } from "node:http";
import { before, after, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import dotenv from "dotenv";
import pg from "pg";
import {execFileSync} from "node:child_process";
import {chromium} from "playwright";

dotenv.config({ quiet: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.PDF_TEST_PORT ?? 3151), base = `http://localhost:${port}`;
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
    await grantTestPlan(pool, owners[i]);
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
  return fetch(`${base}/api/projects/${projectId}/exports/pdf/${kind}/${id}${query}`,{redirect:'manual',headers:session?{Cookie:`authjs.session-token=${session}`}:{}});
}

function textOf(bytes, name) {
  mkdirSync('docs/examples/pdf', {recursive:true});
  const path=['brief-small','brief-long','backlog','backlog-long','project'].includes(name)?`docs/examples/pdf/${name}.pdf`:`/tmp/briefpilot-${process.pid}-${name}.pdf`;writeFileSync(path,bytes);
  return execFileSync('pdftotext',['-layout',path,'-'],{encoding:'utf8'});
}
async function dossier(briefId,backlogId,session=tokens[0]) {
  return fetch(`${base}/api/projects/${projects[0]}/exports/pdf/project?briefId=${briefId}${backlogId?`&backlogId=${backlogId}`:''}`,{headers:session?{Cookie:`authjs.session-token=${session}`}:{}});
}
test('PDF API rejects anonymous, foreign, cross-project and missing access',async()=>{
  for(const [kind,id] of [['brief',briefs[0]],['backlog',backlogs[0]]]) {
    assert.equal((await download(kind,id,{session:null})).status,401);
    assert.equal((await download(kind,id,{session:tokens[1]})).status,404);
    assert.equal((await download(kind,id,{session:tokens[1],projectId:projects[1]})).status,404);
    assert.equal((await download(kind,randomUUID())).status,404);
    assert.equal((await download(kind,id,{projectId:randomUUID()})).status,404);
  }
  assert.equal((await dossier(briefs[0],backlogs[0],null)).status,401);
  assert.equal((await dossier(briefs[0],backlogs[0],tokens[1])).status,404);
});
test('real old-version brief PDF has A4 pages, accents, cover, linked contents and pagination',async()=>{
  const response=await download('brief',briefs[0]);assert.equal(response.status,200,await response.clone().text());
  assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(response.headers.get('content-disposition'),'attachment; filename="reservations-a-evry-brief-v1.pdf"');
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const text=textOf(bytes,'brief-small');
  for(const word of ['Réservations à Évry','Sommaire','Version 1','Brouillon','Page 1 /','Critères de validation'])assert.ok(text.includes(word),word);
  assert.doesNotMatch(text,/private-model-marker|DO NOT EXPORT STALE CONTENT|server-configuration/);
  const pages=text.split('\f').filter(page=>page.trim());
  pages.forEach((page,index)=>assert.match(page,new RegExp(`Page\\s+${index+1}\\s*/\\s*${pages.length}`)));
  const info=execFileSync('pdfinfo' ,['docs/examples/pdf/brief-small.pdf'],{encoding:'utf8'});assert.match(info,/Page size:.*\(A4\)/);
  const raw=bytes.toString('latin1');assert.ok(raw.includes('/Subtype /Link'));assert.ok(raw.includes('/Dest'));
});
test('long complete brief produces readable multi-page output and keeps selected version',async()=>{
  const original=(await pool.query('SELECT json FROM "Brief" WHERE id=$1',[briefs[1]])).rows[0].json, changed=structuredClone(original);
  changed.generation.projectName='Évry — '+ 'Projet de réservation professionnel '.repeat(3);
  for(let i=0;i<18;i++){
    const feature=structuredClone(changed.document.features[0]);feature.id=`F-LONG-${i}`;
    feature.name=`Parcours de réservation détaillé ${i+1}`;feature.description=('Le client choisit un créneau disponible et confirme sa réservation. ').repeat(14);
    changed.document.features.push(feature);
  }
  try {
    await pool.query('UPDATE "Brief" SET json=$2 WHERE id=$1',[briefs[1],changed]);
    const response=await download('brief',briefs[1]);assert.equal(response.status,200,await response.clone().text());
    const text=textOf(Buffer.from(await response.arrayBuffer()),'brief-long');
    assert.ok(text.includes('Version 2'));assert.ok(text.includes('Parcours de réservation détaillé 18'));
    assert.ok(text.split('\f').length>10);assert.ok(text.includes('Critères de validation'));
  } finally {await pool.query('UPDATE "Brief" SET json=$2 WHERE id=$1',[briefs[1],original]);}
});
test('real backlog PDF retains tables, dependencies, estimates and old source version',async()=>{
  const response=await download('backlog',backlogs[0]);assert.equal(response.status,200,await response.clone().text());
  const text=textOf(Buffer.from(await response.arrayBuffer()),'backlog');
  for(const word of ['T-001','T-002','Dépendances','Complexité','indicatifs','version 1'])assert.ok(text.includes(word),word);
  assert.match(response.headers.get('content-disposition'),/backlog-v1.pdf/);
});
test('large backlog supports long table cells and many dependent tasks',async()=>{
  const original=backlogData(2), changed=structuredClone(original);
  changed.document.phases.forEach(phase=>{phase.objective=('Objectif de livraison détaillé et à confirmer avec le client. ').repeat(18);});
  for(let i=0;i<14;i++){
    const task=structuredClone(changed.document.tasks[0]);task.id=`T-LONG-${i}`;task.title=`Tâche documentaire ${i+1}`;task.dependencies=i?[`T-LONG-${i-1}`]:[];changed.document.tasks.push(task);
  }
  try{
    await pool.query('UPDATE "Backlog" SET data=$2 WHERE id=$1',[backlogs[1],changed]);
    const response=await download('backlog',backlogs[1]);assert.equal(response.status,200,await response.clone().text());
    const text=textOf(Buffer.from(await response.arrayBuffer()),'backlog-long');assert.ok(text.includes('T-LONG-13'));assert.ok(text.split('\f').length>8);
  }finally{await pool.query('UPDATE "Backlog" SET data=$2 WHERE id=$1',[backlogs[1],original]);}
});
test('project dossier assembles only exact compatible versions, with explicit no-backlog support',async()=>{
  assert.equal((await dossier(briefs[1],backlogs[0])).status,422);
  const response=await dossier(briefs[0],backlogs[0]);assert.equal(response.status,200,await response.clone().text());
  const text=textOf(Buffer.from(await response.arrayBuffer()),'project');assert.ok(text.includes('Cahier des charges v1'));assert.ok(text.includes('Backlog v1'));assert.ok(text.includes('Conclusion documentaire'));
  assert.match(response.headers.get('content-disposition'),/project-brief-v1-backlog-v1.pdf/);
  const alone=await dossier(briefs[0]);assert.equal(alone.status,200);const txt=textOf(Buffer.from(await alone.arrayBuffer()),'project-without-backlog');assert.ok(txt.includes('Backlog non disponible'));
});
test('HTML, external URLs and local-file attempts stay literal and never contact the provider',async()=>{
  const original=(await pool.query('SELECT json FROM "Brief" WHERE id=$1',[briefs[0]])).rows[0].json, changed=structuredClone(original);
  changed.document.projectSummary.executiveSummary.text=`<script>fetch('http://127.0.0.1:${port+1}/steal')</script><img src="http://127.0.0.1:${port+1}/leak"><iframe src="file:///etc/passwd"></iframe>`;
  try {
    await pool.query('UPDATE "Brief" SET json=$2 WHERE id=$1',[briefs[0],changed]);
    const response=await download('brief',briefs[0]);assert.equal(response.status,200);
    const text=textOf(Buffer.from(await response.arrayBuffer()),'inert-html');assert.ok(text.includes('<script>'));assert.ok(!text.includes('root:x:'));assert.equal(calls,0);
  } finally {await pool.query('UPDATE "Brief" SET json=$2 WHERE id=$1',[briefs[0],original]);}
});
test('malformed documents, source versions, query fields and sensitive content are refused',async()=>{
  for(const query of ['?url=http://internal','?briefId=x','?format=pdf'])assert.equal((await download('brief',briefs[0],{query})).status,400);
  const original=backlogData(1);
  try {
    for(const mode of ['invalid','version','secret']){
      const changed=structuredClone(original);
      if(mode==='invalid')changed.document={};
      if(mode==='version')changed.generation.sourceBriefVersion=99;
      if(mode==='secret')changed.document.tasks[0].codexPrompt='api_key=privatecredential123456';
      await pool.query('UPDATE "Backlog" SET data=$2 WHERE id=$1',[backlogs[0],changed]);
      const response=await download('backlog',backlogs[0]);assert.equal(response.status,422);assert.doesNotMatch(await response.text(),/privatecredential/);
    }
  } finally {await pool.query('UPDATE "Backlog" SET data=$2 WHERE id=$1',[backlogs[0],original]);}
});
test('export menu downloads all three real PDF documents on mobile and desktop',async()=>{
  const browser=await chromium.launch({chromiumSandbox:true});
  try {
    const context=await browser.newContext({acceptDownloads:true});
    await context.addCookies([{name:'authjs.session-token',value:tokens[0],url:base}]);
    const page=await context.newPage();
    await page.goto(`${base}/dashboard/projects/${projects[0]}/backlogs/${backlogs[0]}`);
    for(const [width,label] of [[1440,'Télécharger le cahier des charges PDF'],[375,'Télécharger le backlog PDF'],[1440,'Télécharger le dossier projet PDF']]){
      await page.setViewportSize({width,height:900});await page.getByRole('button',{name:'Exporter',exact:true}).click();
      const pending=page.waitForEvent('download');await page.getByRole('menuitem',{name:label,exact:true}).click();const file=await pending;
      assert.match(file.suggestedFilename(),/\.pdf$/);const stream=await file.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);assert.equal(Buffer.concat(chunks).subarray(0,5).toString(),'%PDF-');
      await page.getByRole('status').filter({hasText:'Téléchargement lancé'}).waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
  }finally{await browser.close();}
});
test('concurrent PDF requests from one owner are rejected promptly instead of queued',async()=>{
  const responses=await Promise.all([download('brief',briefs[0]),download('brief',briefs[0])]);
  assert.deepEqual(responses.map(response=>response.status).sort(),[200,429]);
  for(const response of responses){if(response.status===429)assert.equal(response.headers.get('retry-after'),'60');await response.arrayBuffer();}
});
test('PDF exports do not mutate stored documents or call OpenAI',async()=>{assert.equal(await digest(),beforeDigest);assert.equal(calls,0);});
