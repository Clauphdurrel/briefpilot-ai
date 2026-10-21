import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {before,after,test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import dotenv from 'dotenv';
import pg from 'pg';
import {chromium} from 'playwright';
dotenv.config({quiet:true});
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const base='http://localhost:3171', owners=Array.from({length:3},()=>randomUUID()), tokens=owners.map(()=>randomUUID());
const proId=String(8000000000000000+Math.floor(Math.random()*1000000000000)),agencyId=String(8002000000000000+Math.floor(Math.random()*1000000000000));
const secret='local-lemon-test-webhook-secret', env={LEMONSQUEEZY_API_KEY:'local-lemon-test-api-key',LEMONSQUEEZY_STORE_ID:'100',LEMONSQUEEZY_PRO_VARIANT_ID:'200',LEMONSQUEEZY_AGENCY_VARIANT_ID:'300',LEMONSQUEEZY_WEBHOOK_SECRET:secret,LEMONSQUEEZY_TEST_MODE:'true',AUTH_URL:base};
let child,provider,apiCalls=0,checkouts=0,revision=0,failProvider=false;
const inputs=[],remotes=new Map(),ids=[];
function remote(id,variant){const now=new Date(),end=new Date(now);end.setUTCMonth(end.getUTCMonth()+1);return{data:{type:'subscriptions',id,attributes:{store_id:100,customer_id:Number(id)+1000,variant_id:Number(variant),test_mode:true,status:'active',cancelled:false,billing_anchor:now.getUTCDate(),renews_at:end.toISOString(),ends_at:null,trial_ends_at:null,created_at:now.toISOString(),updated_at:new Date(Date.now()+revision++).toISOString(),urls:{customer_portal:'https://briefpilot.lemonsqueezy.com/billing?signature=test'}}}};}
function touch(value){value.data.attributes.updated_at=new Date(Date.now()+1000+(revision++)*100).toISOString();}
before(async()=>{
  const collision=await pool.query('SELECT COUNT(*)::int AS n FROM "Subscription" WHERE "providerSubscriptionId"=ANY($1::text[])',[[proId,agencyId]]);assert.equal(collision.rows[0].n,0,'Test IDs must not overlap stored subscriptions');
  for(let i=0;i<owners.length;i++){
    await pool.query('INSERT INTO "User" (id,email,"updatedAt") VALUES ($1,$2,NOW())',[owners[i],`lemon-${owners[i]}@example.invalid`]);
    await pool.query('INSERT INTO "Session" (id,"sessionToken","userId",expires) VALUES ($1,$2,$3,NOW()+INTERVAL \'1 hour\')',[randomUUID(),tokens[i],owners[i]]);
  }
  provider=createServer(async(req,res)=>{
    apiCalls++;if(failProvider){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({errors:[{detail:'private-provider-error'}]}));return;}
    const url=new URL(req.url,'http://localhost');const respond=value=>{res.writeHead(200,{'Content-Type':'application/vnd.api+json'});res.end(JSON.stringify(value));};
    if(url.pathname==='/v1/stores/100')return respond({data:{id:'100',attributes:{currency:'EUR'}}});
    if(url.pathname.startsWith('/v1/variants/')){const id=url.pathname.split('/').at(-1);return respond({data:{id,attributes:{product_id:10,test_mode:true,is_subscription:true,interval:'month',interval_count:1,price:id==='200'?1900:5900,pay_what_you_want:false}}});}
    if(url.pathname==='/v1/products/10')return respond({data:{attributes:{store_id:100,test_mode:true}}});
    if(url.pathname==='/v1/checkouts'){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());assert.equal(body.data.attributes.test_mode,true);assert.equal(body.data.attributes.custom_price,undefined);
      inputs.push(body);checkouts++;return respond({data:{type:'checkouts',id:`checkout-${checkouts}`,attributes:{test_mode:true,url:`https://briefpilot.lemonsqueezy.com/checkout/test-${checkouts}`}}});
    }
    if(url.pathname.startsWith('/v1/subscriptions/')){
      const id=url.pathname.split('/').at(-1),value=remotes.get(id);if(!value){res.writeHead(404);res.end('{}');return;}
      if(req.method==='DELETE'){value.data.attributes.status='cancelled';value.data.attributes.cancelled=true;value.data.attributes.ends_at=value.data.attributes.renews_at;touch(value);}
      if(req.method==='PATCH'){const chunks=[];for await(const chunk of req)chunks.push(chunk);assert.equal(JSON.parse(Buffer.concat(chunks).toString()).data.attributes.cancelled,false);value.data.attributes.status='active';value.data.attributes.cancelled=false;value.data.attributes.ends_at=null;touch(value);}
      return respond(value);
    }
    res.writeHead(404);res.end('{}');
  });
  await new Promise(resolve=>provider.listen(3172,'127.0.0.1',resolve));
  child=spawn(process.execPath,['--import',fileURLToPath(new URL('./helpers/lemon-fetch-preload.mjs',import.meta.url)),'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3171'],{detached:true,stdio:'ignore',env:{...process.env,...env,BILLING_TEST_API_URL:'http://127.0.0.1:3172'}});
  for(let i=0;i<100;i++){try{if((await fetch(base+'/pricing')).ok)return;}catch{}await delay(100);}throw new Error('Next test server not ready');
});
after(async()=>{if(child?.exitCode===null)process.kill(-child.pid,'SIGTERM');if(provider)await new Promise(resolve=>provider.close(resolve));try{await pool.query('DELETE FROM "BillingWebhookEvent" WHERE "providerSubscriptionId"=ANY($1::text[])',[ids]);await pool.query('DELETE FROM "User" WHERE id=ANY($1::text[])',[owners]);}finally{await pool.end();}});
function request(path,{owner=0,method='GET',body,origin=base}={}){return fetch(base+path,{method,redirect:'manual',headers:{...(owner===null?{}:{Cookie:`authjs.session-token=${tokens[owner]}`}),...(method==='POST'?{'Content-Type':'application/json',Origin:origin}:{})},body:body?JSON.stringify(body):undefined});}
async function status(owner=0){return(await(await request('/api/billing/subscription',{owner})).json()).data;}
function webhookPayload(index,id,name='subscription_created',custom=true){const invoice=name.startsWith('subscription_payment_');return{meta:{event_name:name,...(custom?{custom_data:inputs[index].data.attributes.checkout_data.custom}:{})},data:{type:invoice?'subscription-invoices':'subscriptions',id:invoice?'9901':id,attributes:{test_mode:true,updated_at:remotes.get(id)?.data.attributes.updated_at,...(invoice?{subscription_id:id}:{})}}};}
function hook(payload,{signature=true}={}){const raw=JSON.stringify(payload);return fetch(base+'/api/webhooks/lemonsqueezy',{method:'POST',headers:{'Content-Type':'application/json','X-Signature':signature?createHmac('sha256',secret).update(raw).digest('hex'):'f'.repeat(64),'X-Event-Name':payload.meta.event_name},body:raw});}
test('checkout requires auth, same origin, and only a server-approved plan',async()=>{
  const before=apiCalls;
  assert.equal((await request('/api/billing/checkout',{owner:null,method:'POST',body:{plan:'PRO'}})).status,401);
  assert.equal((await request('/api/billing/checkout',{method:'POST',origin:'https://evil.example',body:{plan:'PRO'}})).status,403);
  for(const body of [{plan:'ENTERPRISE'},{plan:'PRO',variantId:'999'},{plan:'AGENCY',price:1},{plan:'FREE'}])assert.equal((await request('/api/billing/checkout',{method:'POST',body})).status,400);
  assert.equal(apiCalls,before);
});
test('Pro checkout has fixed test settings and creates no premium access',async()=>{
  const response=await request('/api/billing/checkout',{method:'POST',body:{plan:'PRO'}});assert.equal(response.status,200,await response.clone().text());const data=(await response.json()).data;
  assert.equal(data.testMode,true);assert.match(data.url,/^https:\/\/briefpilot\.lemonsqueezy\.com/);assert.equal(checkouts,1);assert.equal((await status()).plan,'FREE');
  const body=inputs[0].data;assert.equal(body.relationships.variant.data.id,'200');assert.deepEqual(body.attributes.product_options.enabled_variants,[200]);assert.equal(body.attributes.checkout_data.custom.user_id,owners[0]);
  assert.equal((await request('/api/billing/checkout',{method:'POST',body:{plan:'PRO'}})).status,200);assert.equal(checkouts,1);
});
test('Agency checkout and concurrent attempts never issue two links for one account',async()=>{
  const responses=await Promise.all([request('/api/billing/checkout',{owner:1,method:'POST',body:{plan:'AGENCY'}}),request('/api/billing/checkout',{owner:1,method:'POST',body:{plan:'AGENCY'}})]);
  assert.ok(responses.some(response=>response.status===200));assert.equal(checkouts,2);assert.equal(inputs[1].data.relationships.variant.data.id,'300');
});
test('invalid, mutated and live-mode webhooks never grant access',async()=>{
  const id=proId;ids.push(id);remotes.set(id,remote(id,'200'));
  const event=webhookPayload(0,id);const before=apiCalls;assert.equal((await hook(event,{signature:false})).status,401);assert.equal(apiCalls,before);assert.equal((await status()).plan,'FREE');
  const live=structuredClone(event);live.data.attributes.test_mode=false;assert.equal((await hook(live)).status,400);
  const bad=structuredClone(event);bad.meta.custom_data.checkout_token='f'.repeat(64);assert.equal((await hook(bad)).status,422);assert.equal((await status()).plan,'FREE');
});
test('signed creation synchronizes premium and quotas; duplicate delivery is a no-op',async()=>{
  const event=webhookPayload(0,proId);const response=await hook(event);assert.equal(response.status,200,await response.clone().text());assert.equal((await status()).plan,'PRO');
  const usage=(await(await request('/api/billing/usage')).json()).data;assert.equal(usage.usage.find(row=>row.resource==='AI_BRIEF').limit,30);
  const before=apiCalls;const duplicate=await hook(event);assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).outcome,'duplicate');assert.equal(apiCalls,before);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM "Subscription" WHERE "userId"=$1',[owners[0]])).rows[0].n,1);
});
test('a delayed older event fetches current authoritative state rather than restoring stale access',async()=>{
  const value=remotes.get(proId);value.data.attributes.variant_id=300;touch(value);
  assert.equal((await hook(webhookPayload(0,proId,'subscription_updated',false))).status,200);assert.equal((await status()).plan,'AGENCY');
  const old=webhookPayload(0,proId,'subscription_created',false);old.data.attributes.status='active';old.data.attributes.variant_id=200;
  assert.equal((await hook(old)).status,200);assert.equal((await status()).plan,'AGENCY');
});
test('payment failure, recovery and renewal follow verified provider status and periods',async()=>{
  const value=remotes.get(proId);value.data.attributes.status='past_due';touch(value);assert.equal((await hook(webhookPayload(0,proId,'subscription_payment_failed',false))).status,200);assert.equal((await status()).plan,'FREE');
  value.data.attributes.status='active';touch(value);assert.equal((await hook(webhookPayload(0,proId,'subscription_payment_success',false))).status,200);assert.equal((await status()).plan,'AGENCY');
  const end=new Date(value.data.attributes.renews_at);end.setUTCMonth(end.getUTCMonth()+1);value.data.attributes.renews_at=end.toISOString();touch(value);
  const event=webhookPayload(0,proId,'subscription_payment_recovered',false);assert.equal((await hook(event)).status,200);const row=(await pool.query('SELECT "currentPeriodEnd" FROM "Subscription" WHERE "userId"=$1',[owners[0]])).rows[0];assert.equal(row.currentPeriodEnd.toISOString(),end.toISOString());
  // Return to the current real-time billing window for subsequent management tests.
  end.setUTCMonth(end.getUTCMonth()-1);value.data.attributes.renews_at=end.toISOString();touch(value);assert.equal((await hook(webhookPayload(0,proId,'subscription_updated',false))).status,200);
});
test('cancel preserves paid-period access, resume works, and portal is private',async()=>{
  assert.equal((await request('/api/billing/subscription',{owner:2,method:'POST',body:{action:'cancel',subscriptionId:proId}})).status,400);
  assert.equal((await request('/api/billing/subscription',{owner:2,method:'POST',body:{action:'cancel'}})).status,404);
  const cancel=await request('/api/billing/subscription',{method:'POST',body:{action:'cancel'}});assert.equal(cancel.status,200,await cancel.clone().text());const current=await status();assert.equal(current.cancelAtPeriodEnd,true);assert.equal(current.plan,'AGENCY');
  assert.equal((await request('/api/billing/subscription',{method:'POST',body:{action:'resume'}})).status,200);assert.equal((await status()).cancelAtPeriodEnd,false);
  const portal=await request('/api/billing/subscription',{method:'POST',body:{action:'portal'}});assert.equal(portal.status,200);assert.match((await portal.json()).data.url,/lemonsqueezy\.com\/billing/);
});
test('expiration returns to Free and does not delete stored account data',async()=>{
  const value=remotes.get(proId);value.data.attributes.status='expired';value.data.attributes.ends_at=new Date().toISOString();touch(value);
  assert.equal((await hook(webhookPayload(0,proId,'subscription_expired',false))).status,200);assert.equal((await status()).plan,'FREE');assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM "User" WHERE id=$1',[owners[0]])).rows[0].n,1);
});
test('provider failure exposes no secrets and webhook remains retryable',async()=>{
  const before=(await pool.query('SELECT COUNT(*)::int AS n FROM "BillingWebhookEvent"')).rows[0].n;failProvider=true;
  try{const payload=webhookPayload(0,proId,'subscription_unpaused',false),response=await hook(payload);assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/local-lemon-test|private-provider-error/);assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM "BillingWebhookEvent"')).rows[0].n,before);}finally{failProvider=false;}
});
test('Chrome shows pending return without URL activation and handles a delayed webhook',async()=>{
  const browser=await chromium.launch({chromiumSandbox:true});
  try{
    const context=await browser.newContext();await context.addCookies([{name:'authjs.session-token',value:tokens[1],url:base}]);const page=await context.newPage();
    for(const width of [375,1440]){
      await page.setViewportSize({width,height:1000});await page.goto(base+'/dashboard/billing/success?plan=ENTERPRISE&paid=true');await page.getByRole('heading',{name:'Confirmation de l’abonnement'}).waitFor();await page.getByRole('status').filter({hasText:'Confirmation du prestataire en cours'}).waitFor();assert.equal((await status(1)).plan,'FREE');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    const id=agencyId;ids.push(id);remotes.set(id,remote(id,'300'));const response=await hook(webhookPayload(1,id));assert.equal(response.status,200,await response.clone().text());await page.getByRole('button',{name:'Vérifier à nouveau'}).click();await page.getByRole('status').filter({hasText:'AGENCY de test synchronisé'}).waitFor();
    await page.goto(base+'/dashboard/settings/subscription');await page.getByRole('button',{name:'Annuler le renouvellement',exact:true}).click();await page.getByRole('button',{name:'Reprendre le renouvellement',exact:true}).waitFor();assert.equal((await status(1)).plan,'AGENCY');await page.getByRole('button',{name:'Reprendre le renouvellement',exact:true}).click();await page.getByRole('button',{name:'Annuler le renouvellement',exact:true}).waitFor();
    await context.addCookies([{name:'authjs.session-token',value:tokens[2],url:base}]);await page.goto(base+'/pricing');const pending=page.waitForRequest('**/api/billing/checkout');
    await page.route('https://briefpilot.lemonsqueezy.com/**',route=>route.fulfill({body:'Local checkout preview',contentType:'text/plain'}));await page.getByRole('button',{name:'Passer à Pro',exact:true}).click();assert.equal((await pending).postDataJSON().plan,'PRO');await page.waitForURL('https://briefpilot.lemonsqueezy.com/**');assert.equal((await status(2)).plan,'FREE');
  }finally{await browser.close();}
});
