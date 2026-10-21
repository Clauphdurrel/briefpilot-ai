import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {before,after,test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import dotenv from 'dotenv';
import pg from 'pg';
import {chromium} from 'playwright';
dotenv.config({quiet:true});
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const port=3161,base=`http://localhost:${port}`,owners=Array.from({length:3},()=>randomUUID()),tokens=owners.map(()=>randomUUID()),projects=owners.map(()=>randomUUID());
const briefIds=Array.from({length:3},()=>randomUUID());
let server,provider,calls=0,state;
const categories=['context','problem','objectives','users','features','pages','journeys','roles','content','branding','integrations','data','technical','regulatory','budget','timeline','success'];
function storedBrief(version){return{schemaVersion:'brief.v1',document:JSON.parse(readFileSync('docs/prompts/brief-generator.example.json','utf8')),generation:{version,requestId:randomUUID(),sourceRevision:'a'.repeat(64),projectName:'Projet quotas',projectType:'WEBSITE',language:'fr',draft:true,generatedAt:'2026-10-21T10:00:00Z',model:'test-model'}};}
before(async()=>{
  for(let i=0;i<owners.length;i++){
    await pool.query('INSERT INTO "User" (id,email,"updatedAt") VALUES ($1,$2,NOW())',[owners[i],`billing-${owners[i]}@example.invalid`]);
    await pool.query('INSERT INTO "Session" (id,"sessionToken","userId",expires) VALUES ($1,$2,$3,NOW()+INTERVAL \'1 hour\')',[randomUUID(),tokens[i],owners[i]]);
    await pool.query('INSERT INTO "Project" (id,name,type,"ownerId","updatedAt") VALUES ($1,$2,\'WEBSITE\',$3,NOW())',[projects[i],i===1?'Provider failure':'Projet quotas',owners[i]]);
  }
  for(let i=0;i<3;i++)await pool.query('INSERT INTO "Brief" (id,title,content,json,"projectId","createdAt","updatedAt") VALUES ($1,\'Document quota\',\'stale\',$2,$3,$4,NOW())',[briefIds[i],storedBrief(i+1),projects[0],new Date(Date.now()+i*1000)]);
  provider=createServer(async(req,res)=>{
    calls++;const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());const context=JSON.parse(body.input[1].content);
    if(context.project.name==='Provider failure'){res.writeHead(429,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'private-provider-error',type:'insufficient_quota',code:'insufficient_quota'}}));return;}
    await delay(100);
    const question=`Précise le besoin ${calls} ?`,data={summary:'Projet de test',message:question,knownInformation:[],missingInformation:['Budget'],assumptions:[],completionScore:0,nextQuestion:{id:`q-${calls}`,question,category:'budget',priority:'high',required:true,helpText:null},coverage:categories.map(category=>({category,status:'missing',evidence:null}))};
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({id:`resp_${randomUUID()}`,object:'response',created_at:Math.floor(Date.now()/1000),status:'completed',model:'test-model',output:[{id:`msg_${randomUUID()}`,type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(data),annotations:[],logprobs:[]}]}],error:null,incomplete_details:null,metadata:{}}));
  });
  await new Promise(resolve=>provider.listen(port+1,'127.0.0.1',resolve));
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{detached:true,stdio:'ignore',env:{...process.env,OPENAI_API_KEY:'local-test-only',OPENAI_MODEL:'test-model',OPENAI_BASE_URL:`http://127.0.0.1:${port+1}/v1`}});
  for(let i=0;i<100;i++){try{if((await fetch(`${base}/pricing`)).ok)return;}catch{}await delay(100);}throw new Error('Next server not ready');
});
after(async()=>{if(server?.exitCode===null)process.kill(-server.pid,'SIGTERM');if(provider)await new Promise(resolve=>provider.close(resolve));try{await pool.query('DELETE FROM "User" WHERE id=ANY($1::text[])',[owners]);}finally{await pool.end();}});
function request(path,{owner=0,method='GET',body,headers={}}={}){return fetch(base+path,{method,redirect:'manual',headers:{...headers,...(owner===null?{}:{Cookie:`authjs.session-token=${tokens[owner]}`}),...(method==='POST'?{'Content-Type':'application/json',Origin:base}:{})},body:body?JSON.stringify(body):undefined});}
async function usage(owner=0){const response=await request('/api/billing/usage',{owner});assert.equal(response.status,200);return(await response.json()).data;}
function row(data,resource){return data.usage.find(item=>item.resource===resource);}
async function relax(owner=0){await pool.query('UPDATE "InterviewMessage" SET "createdAt"=NOW()-INTERVAL \'5 seconds\' WHERE "projectId"=$1 AND role=\'system\'',[projects[owner]]);}
test('private usage API derives Free from session and never trusts a requested plan',async()=>{
  assert.equal((await request('/api/billing/usage',{owner:null})).status,401);
  const response=await request('/api/billing/usage?plan=ENTERPRISE&userId=other');assert.equal(response.headers.get('cache-control'),'private, no-store');const data=(await response.json()).data;
  assert.equal(data.plan,'FREE');assert.equal(row(data,'AI_INTERVIEW').used,0);assert.equal(row(data,'AI_INTERVIEW').limit,3);assert.equal(row(data,'ACTIVE_PROJECTS').used,1);
  assert.equal((await request('/api/billing/usage',{method:'POST',body:{plan:'ENTERPRISE'}})).status,405);
  assert.equal((await request('/dashboard/settings/subscription',{owner:null})).status,307);
});
test('an actual SDK response charges once and replay does not call the provider',async()=>{
  const body={requestId:randomUUID(),language:'fr'};const response=await request(`/api/projects/${projects[0]}/interview`,{method:'POST',body});assert.equal(response.status,200,await response.clone().text());state=(await response.json()).data;
  assert.equal(calls,1);assert.equal(row(await usage(),'AI_INTERVIEW').used,1);
  const replay=await request(`/api/projects/${projects[0]}/interview`,{method:'POST',body});assert.equal(replay.status,200);assert.equal(calls,1);assert.equal(row(await usage(),'AI_INTERVIEW').used,1);
});
test('concurrent final-unit replies never exceed the Free quota and denial has upgrade details',async()=>{
  for(let i=0;i<2;i++){
    await relax();const body={requestId:randomUUID(),language:'fr',content:'Une précision client',expectedLastMessageId:state.messages.at(-1).id};
    const path=`/api/projects/${projects[0]}/interview/messages`;
    const responses=i===1?await Promise.all([request(path,{method:'POST',body}),request(path,{method:'POST',body:{...body,requestId:randomUUID()}})]):[await request(path,{method:'POST',body})];
    const success=responses.find(response=>response.status===200);assert.ok(success);state=(await success.json()).data;
    for(const response of responses)assert.ok([200,409,429].includes(response.status));
  }
  assert.equal(calls,3);assert.equal(row(await usage(),'AI_INTERVIEW').used,3);
  await relax();const response=await request(`/api/projects/${projects[0]}/interview/messages`,{method:'POST',body:{requestId:randomUUID(),language:'fr',content:'Pas de quatrième appel',expectedLastMessageId:state.messages.at(-1).id,plan:'ENTERPRISE'}});
  // Unknown fields cannot grant entitlements, whether stripped by input validation or rejected.
  assert.ok([400,429].includes(response.status));
  const denied=await request(`/api/projects/${projects[0]}/interview/messages`,{method:'POST',body:{requestId:randomUUID(),language:'fr',content:'Quota atteint',expectedLastMessageId:state.messages.at(-1).id}});
  assert.equal(denied.status,429);const error=(await denied.json()).error;assert.equal(error.code,'QUOTA_EXCEEDED');assert.equal(error.resource,'AI_INTERVIEW');assert.equal(error.limit,3);assert.equal(error.used,3);assert.equal(error.upgradeUrl,'/pricing');assert.equal(calls,3);
});
test('a real simulated provider error remains technical and consumes one attempted unit',async()=>{
  const response=await request(`/api/projects/${projects[1]}/interview`,{owner:1,method:'POST',body:{requestId:randomUUID(),language:'fr'}});assert.equal(response.status,503);
  const error=(await response.json()).error;assert.equal(error.code,'AI_QUOTA');assert.notEqual(error.code,'QUOTA_EXCEEDED');assert.ok(!error.message.includes('private-provider-error'));
  assert.equal(row(await usage(1),'AI_INTERVIEW').used,1);assert.equal(row(await usage(1),'AI_INTERVIEW').reserved,0);
});
test('Free history and both export engines enforce version access server-side',async()=>{
  const root=`/api/projects/${projects[0]}`;
  for(const path of [`/briefs/${briefIds[0]}`,`/exports/brief/${briefIds[0]}`,`/exports/pdf/brief/${briefIds[0]}`])assert.equal((await request(root+path)).status,403);
  assert.equal((await request(root+`/exports/brief/${briefIds[2]}`)).status,200);
  assert.equal((await request(root+`/exports/brief/${briefIds[2]}`,{owner:1})).status,404);
});
test('Free PDF limit is enforced without consuming AI quota or calling OpenAI',async()=>{
  const before=calls,path=`/api/projects/${projects[0]}/exports/pdf/brief/${briefIds[2]}`;
  for(let i=0;i<3;i++){const operationId=randomUUID();const response=await request(path,{headers:{'Idempotency-Key':operationId}});assert.equal(response.status,200,await response.clone().text());assert.equal(response.headers.get('content-type'),'application/pdf');await response.arrayBuffer();if(i===0){const replay=await request(path,{headers:{'Idempotency-Key':operationId}});assert.equal(replay.status,409);assert.equal(row(await usage(),'PDF_EXPORT').used,1);}}
  const denied=await request(path);assert.equal(denied.status,429);assert.equal((await denied.json()).error.resource,'PDF_EXPORT');assert.equal(row(await usage(),'PDF_EXPORT').used,3);assert.equal(calls,before);assert.equal(row(await usage(),'AI_BRIEF').used,0);
});
test('Chrome shows real quotas, disables paid activation, and guards project reactivation',async()=>{
  const browser=await chromium.launch({chromiumSandbox:true});
  try{
    const context=await browser.newContext();await context.addCookies([{name:'authjs.session-token',value:tokens[2],url:base}]);const page=await context.newPage();
    for(const width of [375,1440]){
      await page.setViewportSize({width,height:1000});await page.goto(base+'/pricing');await page.getByRole('heading',{name:'Un plan adapté à vos projets'}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Passer à Pro',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Choisir Agency',exact:true}).isDisabled(),true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.goto(base+'/dashboard/settings/subscription');await page.getByRole('heading',{name:'Abonnement Free',exact:true}).waitFor();assert.equal(await page.getByRole('progressbar').count(),5);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await page.goto(base+'/dashboard/projects');await page.getByLabel('Nom du projet').fill('Deuxième projet quota');await page.getByRole('button',{name:'Créer le projet',exact:true}).click();await page.waitForURL(/\/dashboard\/projects\/[^/]+$/);
    const second=page.url();await page.goto(base+'/dashboard/projects');await page.getByLabel('Nom du projet').fill('Troisième interdit');await page.getByRole('button',{name:'Créer le projet',exact:true}).click();await page.getByText('La limite de projets actifs est atteinte.',{exact:false}).waitFor();assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM "Project" WHERE "ownerId"=$1',[owners[2]])).rows[0].n,2);
    await page.goto(second);await page.getByRole('button',{name:'Archiver le projet',exact:true}).click();await page.getByRole('button',{name:'Réactiver le projet',exact:true}).waitFor();
    await page.goto(base+'/dashboard/projects');await page.getByLabel('Nom du projet').fill('Remplacement actif');await page.getByRole('button',{name:'Créer le projet',exact:true}).click();await page.waitForURL(/\/dashboard\/projects\/[^/]+$/);
    await page.goto(second);await page.getByRole('button',{name:'Réactiver le projet',exact:true}).click();await page.getByText('La limite de projets actifs est atteinte.',{exact:false}).waitFor();
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM "Subscription" WHERE "userId"=ANY($1::text[])',[owners])).rows[0].n,0);
  }finally{await browser.close();}
});
