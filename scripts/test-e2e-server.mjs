import { spawn } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createMockProvider } from '../tests/e2e/mock-provider.mjs';
import { withIsolatedDatabase } from './test-database.mjs';
if (!process.env.E2E_STATE_FILE) throw new Error('Run through playwright.config.ts');
try {
  await withIsolatedDatabase(async ({database,env:databaseEnv})=>{
    let next, mock, stateWritten=false;
    let release;
    const stopped=new Promise(resolve=>{release=resolve;});
    for (const signal of ['SIGTERM','SIGINT']) process.once(signal,release);
    try {
      const env={...databaseEnv,AUTH_URL:'http://localhost:3181',AUTH_SECRET:'local-e2e-auth-secret-with-no-production-value',AUTH_GOOGLE_ID:'local-e2e-google',AUTH_GOOGLE_SECRET:'local-e2e-google-secret',OPENAI_API_KEY:'local-e2e-key',OPENAI_MODEL:'test-model',OPENAI_BASE_URL:'http://127.0.0.1:3182/v1',LEMONSQUEEZY_API_KEY:'local-e2e-api-key',LEMONSQUEEZY_STORE_ID:'100',LEMONSQUEEZY_PRO_VARIANT_ID:'200',LEMONSQUEEZY_AGENCY_VARIANT_ID:'300',LEMONSQUEEZY_WEBHOOK_SECRET:'local-e2e-webhook-secret',LEMONSQUEEZY_TEST_MODE:'true'};
      mock=createMockProvider(); await new Promise((resolve,reject)=>{mock.once('error',reject);mock.listen(3182,'127.0.0.1',resolve);});
      await writeFile(process.env.E2E_STATE_FILE,JSON.stringify({database}),{mode:0o600,flag:'wx'}); stateWritten=true;
      next=spawn(process.execPath,['--import',fileURLToPath(new URL('../tests/e2e/fetch-preload.mjs',import.meta.url)),'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3181'],{env,stdio:['ignore','ignore','ignore']});
      next.once('exit',release); next.once('error',release);
      await stopped;
    } finally {
      if (next?.exitCode===null) {next.kill('SIGTERM');await new Promise(resolve=>{next.once('exit',resolve);setTimeout(()=>{next.kill('SIGKILL');resolve();},5000).unref();});}
      if (mock) {mock.closeAllConnections();await new Promise(resolve=>mock.close(resolve));}
      if (stateWritten) await unlink(process.env.E2E_STATE_FILE).catch(()=>{});
    }
  });
} catch { console.error('E2E startup failed; local database permission, migrations and free ports are required.'); process.exitCode=1; }
