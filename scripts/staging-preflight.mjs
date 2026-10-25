import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';
import { loadStagingEnvironment, runStagingDatabase } from './staging-database.mjs';
import { stagingConnections } from '../src/server/database/connection.mjs';
import { readLimited, workerHeaders, workerProtectionHeaders } from '../src/server/exports/pdf/pdf-protocol.mjs';

export function httpsOrigin(value) {
  try {
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')return null;
    return url.origin;
  }catch{return null;}
}
const required = ['AUTH_SECRET','AUTH_GOOGLE_ID','AUTH_GOOGLE_SECRET','AUTH_URL','OPENAI_API_KEY','OPENAI_MODEL','LEMONSQUEEZY_API_KEY','LEMONSQUEEZY_STORE_ID','LEMONSQUEEZY_WEBHOOK_SECRET','LEMONSQUEEZY_PRO_VARIANT_ID','LEMONSQUEEZY_AGENCY_VARIANT_ID','PDF_WORKER_URL','PDF_WORKER_SECRET'];
/** @param {Record<string,string>} values
 * @param {{branch?:string, projectLinked?:boolean, developmentSecret?:string}} [context] */
export function validateStagingReadiness(values,{branch,projectLinked=false,developmentSecret}={}) {
  const missing=required.filter(key=>!values[key]||/^(?:your_|placeholder|replace_|CONNEXION_|CLE_|SECRET_STAGING|MODELE_CONFIGURE)/i.test(values[key]));
  const blockers=[];
  try{stagingConnections(values);}catch{blockers.push('NEON_CONFIGURATION_INVALID');}
  if(branch!=='develop')blockers.push('DEVELOP_BRANCH_REQUIRED');
  if(!projectLinked)blockers.push('VERCEL_PROJECT_NOT_LINKED');
  if(!z.string().min(32).safeParse(values.AUTH_SECRET).success)blockers.push('AUTH_SECRET_INVALID');
  if(developmentSecret&&values.AUTH_SECRET===developmentSecret)blockers.push('AUTH_SECRET_REUSED_FROM_DEVELOPMENT');
  if(!httpsOrigin(values.AUTH_URL))blockers.push('STABLE_HTTPS_AUTH_URL_REQUIRED');
  if(values.LEMONSQUEEZY_TEST_MODE!=='true')blockers.push('LEMON_TEST_MODE_REQUIRED');
  if(values.PDF_RENDER_MODE!=='worker'||!httpsOrigin(values.PDF_WORKER_URL)||!z.string().min(32).max(256).safeParse(values.PDF_WORKER_SECRET).success)blockers.push('HTTPS_PDF_WORKER_REQUIRED');
  const monitoring=values.OBSERVABILITY_ENABLED==='true'&&values.OBSERVABILITY_ENVIRONMENT==='staging'&&values.SENTRY_DSN&&values.POSTHOG_ENABLED==='true'&&values.POSTHOG_PROJECT_TOKEN&&values.ANALYTICS_HMAC_SECRET?.length>=32;
  return { missingVariables:missing,blockers,staticConfigurationReady:missing.length===0&&blockers.length===0,monitoringConfigured:!!monitoring };
}
export async function runStagingPreflight(args=[]) {
  if(args.some(x=>!['--check-database','--probe-worker','--check-http'].includes(x)))throw new Error('Unknown option');
  let config;
  try{config=loadStagingEnvironment();}catch{return {status:'blocked',blocking:['PRIVATE_NEON_STAGING_CONFIGURATION_REQUIRED'],remoteChecksPerformed:false};}
  const {values}=config;
  const branch=execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim();
  let projectLinked=false;
  try{const project=JSON.parse(readFileSync(resolve('.vercel/project.json'),'utf8'));projectLinked=!!project.projectId&&!!project.orgId;}catch{/* No linked project. */}
  let developmentSecret;
  if(existsSync('.env'))developmentSecret=dotenv.parse(readFileSync('.env')).AUTH_SECRET;
  const result=validateStagingReadiness(values,{branch,projectLinked,developmentSecret});
  const checks={database:'not_checked',worker:'not_checked',http:'not_checked',googleOAuth:'manual_test_required',ai:'not_called',payment:'not_attempted',telemetryReception:'not_checked'};
  if(args.includes('--check-database'))try{const status=await runStagingDatabase('status');checks.database=status.migrationsPending===0?'passed':'migrations_pending';}catch{checks.database='failed';}
  if(args.includes('--probe-worker')) {
    const origin=httpsOrigin(values.PDF_WORKER_URL);
    if(origin&&values.PDF_WORKER_SECRET?.length>=32)try{
      const body=JSON.stringify({html:'<h1>BriefPilot staging synthetic probe</h1>',owner:createHmac('sha256',values.PDF_WORKER_SECRET).update('synthetic-staging-probe').digest('hex')});
      const response=await fetch(origin+'/render',{method:'POST',headers:{...workerHeaders(body,values.PDF_WORKER_SECRET),...workerProtectionHeaders(values.PDF_WORKER_VERCEL_BYPASS_SECRET)},body,redirect:'error',signal:AbortSignal.timeout(40000)});
      const pdf=await readLimited(response.body,4*1024*1024);
      checks.worker=response.ok&&response.headers.get('content-type')?.startsWith('application/pdf')&&pdf.subarray(0,5).toString()==='%PDF-'?'passed':'failed';
    }catch{checks.worker='failed';}else checks.worker='not_configured';
  }
  if(args.includes('--check-http')) {
    const origin=httpsOrigin(values.AUTH_URL);
    if(origin)try{
      const response=await fetch(origin+'/api/health',{redirect:'error',signal:AbortSignal.timeout(10000)});
      const data=JSON.parse((await readLimited(response.body,1024)).toString());
      checks.http=response.ok&&data.status==='ok'&&Object.keys(data).length===1?'passed':'failed';
    }catch{checks.http='failed';}else checks.http='not_configured';
  }
  const failed=Object.values(checks).some(value=>value==='failed'||value==='migrations_pending');
  return {status:result.staticConfigurationReady&&!failed?'prepared':'blocked',...result,checks,readyForPreview:result.staticConfigurationReady&&checks.database==='passed'&&checks.worker==='passed',fullyValidatedOnline:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {const result=await runStagingPreflight(process.argv.slice(2));console.log(JSON.stringify(result,null,2));if(result.status==='blocked')process.exitCode=1;}
  catch{console.error('Staging preflight failed. Inspect private configuration and selected account; no secret is displayed.');process.exitCode=1;}
}
