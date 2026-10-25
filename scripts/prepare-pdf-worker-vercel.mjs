import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export function preparePdfWorkerVercel() {
  const directory=mkdtempSync(join(tmpdir(),'briefpilot-pdf-vercel-'));
  const files=['infra/pdf-worker/package.json','infra/pdf-worker/package-lock.json','infra/pdf-worker/server.mjs','src/server/exports/pdf/pdf-engine.mjs','src/server/exports/pdf/pdf-protocol.mjs'];
  for(const file of files){const target=join(directory,file);mkdirSync(dirname(target),{recursive:true});copyFileSync(resolve(file),target);}
  const docker=readFileSync('infra/pdf-worker/Dockerfile','utf8').replace('ENV NODE_ENV=production','ENV NODE_ENV=production PORT=8080 VERCEL=1 PDF_RENDER_TIMEOUT_MS=25000 PDF_WORKER_SHUTDOWN_MS=29000');
  writeFileSync(join(directory,'Dockerfile.vercel'),docker);
  const ignore=readFileSync('infra/pdf-worker/Dockerfile.dockerignore','utf8')+'\n!Dockerfile.vercel\n';
  writeFileSync(join(directory,'Dockerfile.vercel.dockerignore'),ignore);
  writeFileSync(join(directory,'vercel.json'),JSON.stringify({framework:'container',git:{deploymentEnabled:false}},null,2)+'\n');
  writeFileSync(join(directory,'DEPLOYMENT.txt'),'Worker source only. No secret or deployment included. Set Preview PORT=8080, PDF_WORKER_SECRET and VERCEL=1. Non-root Chromium sandbox remains required; validate on the actual Vercel runtime before claiming compatibility.\n');
  return {directory,files:[...files,'Dockerfile.vercel','Dockerfile.vercel.dockerignore','vercel.json','DEPLOYMENT.txt'],deployed:false,secretsIncluded:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(preparePdfWorkerVercel(),null,2));
