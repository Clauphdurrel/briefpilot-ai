import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createPdfWorker } from '../infra/pdf-worker/server.mjs';
import { workerHeaders, PdfRuntimeError } from '../src/server/exports/pdf/pdf-protocol.mjs';
const secret='synthetic-worker-integration-secret-32-characters';
let worker, base, calls=0;
const body=JSON.stringify({html:'<p>Synthetic</p>',owner:'a'.repeat(64)});
before(async()=>{
  worker=createPdfWorker({secret,log:{info(){}},render:async html=>{
    calls++;
    if(html==='failure')throw new Error('PRIVATE SECRET');
    if(html==='timeout')throw new PdfRuntimeError('PDF_TIMEOUT',503);
    return Buffer.from('%PDF-1.7 synthetic');
  }});
  worker.server.listen(0,'127.0.0.1');await once(worker.server,'listening');base=`http://127.0.0.1:${worker.server.address().port}`;
});
after(async()=>{await worker?.close();});
const post=(content=body,headers=workerHeaders(content,secret))=>fetch(base+'/render',{method:'POST',headers,body:content});
test('health is minimal and unauthenticated rendering is refused',async()=>{
  const health=await fetch(base+'/health');assert.deepEqual(await health.json(),{status:'ok'});
  const n=calls,response=await post(body,{'Content-Type':'application/json'});assert.equal(response.status,401);assert.equal(calls,n);
});
test('signed requests render once, expose no sensitive headers and cannot be replayed',async()=>{
  const headers=workerHeaders(body,secret),response=await post(body,headers);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(response.headers.get('cache-control'),'no-store');assert.match(await response.text(),/^%PDF-/);
  assert.equal((await post(body,headers)).status,409);
});
test('expired, future, forged and tampered signatures never call the renderer',async()=>{
  const n=calls;
  for(const age of [-61000,61000])assert.equal((await post(body,workerHeaders(body,secret,Date.now()+age))).status,401);
  assert.equal((await post(body,workerHeaders(body,'different-synthetic-secret-32-characters'))).status,401);
  assert.equal((await post(body+' ',workerHeaders(body,secret))).status,401);assert.equal(calls,n);
});
test('strict input rejects malformed JSON, arbitrary owner identifiers and extra properties',async()=>{
  const n=calls;
  for(const data of ['{',JSON.stringify({html:'x',owner:'real-user'}),JSON.stringify({html:'x',owner:'a'.repeat(64),url:'file:///etc/passwd'})])assert.equal((await post(data)).status,400);
  assert.equal(calls,n);
});
test('errors are sanitized and timeout remains explicit',async()=>{
  const fail=await post(JSON.stringify({html:'failure',owner:'a'.repeat(64)}));assert.equal(fail.status,503);assert.deepEqual(await fail.json(),{code:'PDF_UNAVAILABLE'});
  const timeout=await post(JSON.stringify({html:'timeout',owner:'a'.repeat(64)}));assert.deepEqual(await timeout.json(),{code:'PDF_TIMEOUT'});
});
test('method and route validation and request size bounds are enforced',async()=>{
  assert.equal((await fetch(base+'/render')).status,404);
  const oversized=JSON.stringify({html:'x'.repeat(2*1024*1024+1),owner:'a'.repeat(64)});assert.equal((await post(oversized)).status,400);
});
test('failed authentication does not reserve a replay nonce',async()=>{
  const nonce=randomUUID(),bad=workerHeaders(body,secret,Date.now(),nonce);bad['X-PDF-Signature']='0'.repeat(64);
  assert.equal((await post(body,bad)).status,401);assert.equal((await post(body,workerHeaders(body,secret,Date.now(),nonce))).status,200);
});
