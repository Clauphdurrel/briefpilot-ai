import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { withIsolatedDatabase } from './test-database.mjs';
let interrupted=false;
const children=new Set();
for (const signal of ['SIGTERM','SIGINT']) process.once(signal,()=>{interrupted=true;for(const child of children)child.kill('SIGTERM');});
function launch(args,env,quiet=false) {
  if(interrupted)throw new Error('Test run interrupted');
  const child=spawn(process.execPath,args,{env,stdio:quiet?'ignore':'inherit'});children.add(child);
  child.once('exit',()=>children.delete(child));return child;
}
async function run(args,env) {
  const child=launch(args,env);
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('Integration command failed')));});
}
async function stop(child) {
  if(child.exitCode!==null)return;
  child.kill('SIGTERM');await new Promise(resolve=>{child.once('exit',resolve);setTimeout(()=>{child.kill('SIGKILL');resolve();},5000).unref();});
}
try {
  await withIsolatedDatabase(async({env:databaseEnv})=>{
    const preload=fileURLToPath(new URL('./test-fetch-local.mjs',import.meta.url));
    const env={...databaseEnv,NODE_OPTIONS:`--import=${preload}`,AUTH_SECRET:'local-integration-auth-secret-no-production-value',AUTH_GOOGLE_ID:'local-integration-google',AUTH_GOOGLE_SECRET:'local-integration-google-secret',AUTH_URL:'http://localhost:3109',AUTH_TEST_URL:'http://localhost:3109',OPENAI_API_KEY:'local-integration-no-external-key',OPENAI_MODEL:'test-model',BILLING_INTEGRATION:'1',LEMON_BILLING_INTEGRATION:'1',SECURITY_INTEGRATION:'1',INTERVIEW_VISUAL_TEST:'1',BRIEF_VISUAL_TEST:'1',BACKLOG_VISUAL_TEST:'1',MARKDOWN_VISUAL_TEST:'1'};
    await run(['node_modules/vitest/vitest.mjs','run','src/server/services/__tests__/usage.postgres.test.ts','src/server/services/__tests__/history-access.postgres.test.ts','src/server/billing/__tests__/billing.postgres.test.ts'],env);
    const server=launch(['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3109'],env,true);
    try {
      let ready=false;
      for(let i=0;i<150;i++) {
        if(server.exitCode!==null || interrupted)throw new Error('Integration server stopped');
        try {if((await fetch(env.AUTH_TEST_URL+'/api/auth/providers')).ok){ready=true;break;}}catch{}
        await delay(100);
      }
      if(!ready)throw new Error('Integration server not ready');
      await run(['--test','tests/auth.integration.test.mjs','tests/dashboard.integration.test.mjs','tests/projects.integration.test.mjs','tests/security.integration.test.mjs'],env);
    } finally {await stop(server);}
    for (const suite of ['interview','briefs','backlogs','markdown-exports','pdf-exports','subscriptions','lemon-billing']) await run(['--test',`tests/${suite}.integration.test.mjs`],env);
  });
} catch { console.error('Isolated integration campaign failed; see the failing test above.');process.exitCode=1; }
