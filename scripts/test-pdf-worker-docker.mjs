import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { workerHeaders } from '../src/server/exports/pdf/pdf-protocol.mjs';
const name=`briefpilot-pdf-test-${randomUUID()}`,secret=randomBytes(32).toString('hex'),work=mkdtempSync(join(tmpdir(),'briefpilot-pdf-worker-'));
let created=false;
const docker=(args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
try {
  docker(['build','-f','infra/pdf-worker/Dockerfile','-t','briefpilot-pdf-worker:step24','.']);
  const image=JSON.parse(docker(['image','inspect','briefpilot-pdf-worker:step24']))[0];
  assert.equal(image.Config.User,'pwuser');assert.ok(!image.Config.Env.some(x=>/SECRET|DATABASE_URL|OPENAI_API_KEY|AUTH_SECRET/.test(x)));
  docker(['run','--detach','--name',name,'--init','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges=true','--security-opt',`seccomp=${resolve('infra/pdf-worker/seccomp_profile.json')}`,'--tmpfs','/tmp:rw,nosuid,nodev,size=268435456,mode=1777','--shm-size=256m','--memory=2g','--cpus=2','--pids-limit=256','--publish','127.0.0.1::8080','--env',`PDF_WORKER_SECRET=${secret}`,'briefpilot-pdf-worker:step24']);created=true;
  const state=JSON.parse(docker(['inspect',name]))[0],port=state.NetworkSettings.Ports['8080/tcp'][0].HostPort,base=`http://127.0.0.1:${port}`;
  let ready=false;
  for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}await delay(100);}
  assert.ok(ready,'Worker did not start');
  assert.equal((await fetch(base+'/render',{method:'POST',body:'{}'})).status,401);
  const owner='a'.repeat(64),html='<h1>BriefPilot Docker</h1><p>Accents : Évry, résumé.</p><script>document.body.innerText="EXECUTED_PRIVATE_SCRIPT"</script><img src="https://example.invalid/private"><iframe src="file:///etc/passwd"></iframe>';
  const body=JSON.stringify({owner,html}),headers=workerHeaders(body,secret);
  const response=await fetch(base+'/render',{method:'POST',headers,body,signal:AbortSignal.timeout(45000)});
  assert.equal(response.status,200,await response.clone().text());
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const path=join(work,'result.pdf');writeFileSync(path,bytes);
  const text=execFileSync('pdftotext',[path,'-'],{encoding:'utf8'});assert.match(text,/BriefPilot Docker/);assert.match(text,/Évry/);assert.doesNotMatch(text,/EXECUTED_PRIVATE_SCRIPT|root:x:/);
  assert.equal((await fetch(base+'/render',{method:'POST',headers,body})).status,409);
  const results=await Promise.all([1,2].map(()=>fetch(base+'/render',{method:'POST',headers:workerHeaders(body,secret),body})));
  assert.deepEqual(results.map(x=>x.status).sort(),[200,429]);await Promise.all(results.map(x=>x.arrayBuffer()));
  const files=docker(['exec',name,'node','-e',"const fs=require('node:fs');if(fs.existsSync('/app/.env')||fs.existsSync('/app/src/auth.ts'))process.exit(1);console.log(process.getuid())"]);assert.notEqual(files.trim(),'0');
  const logs=docker(['logs',name]);assert.ok(!logs.includes(secret)&&!logs.includes(html)&&!logs.includes(owner));
  docker(['stop','--time','45',name]);
  assert.equal(JSON.parse(docker(['inspect',name]))[0].State.ExitCode,0);
  console.log('Docker worker passed: real sandboxed PDF, non-root, read-only, request authentication, replay rejection, inert HTML, concurrency, sanitized logs and graceful shutdown.');
} catch(error) { console.error('Docker worker validation failed:',error instanceof assert.AssertionError ? error.message : 'Inspect Docker availability and the controlled worker logs locally.');process.exitCode=1; }
finally {if(created)try{docker(['rm','--force',name]);}catch{}rmSync(work,{recursive:true,force:true});}
