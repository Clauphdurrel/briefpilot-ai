import { test as base, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ quiet: true });
export const origin = 'http://localhost:3181';
export const answer = 'Les clients réservent les créneaux disponibles du restaurant. Le gestionnaire modifie les disponibilités. Un créneau indisponible ne peut pas être réservé. Nous fournissons horaires et coordonnées.';
type Account = { id: string; token: string; pool: pg.Pool; project: string; seedInterview: () => Promise<void>; generateBrief: () => Promise<string>; free: () => Promise<void> };
export const test = base.extend<{ account: Account }>({
  account: async ({ page, request }, runFixture) => {
    const state=JSON.parse(readFileSync(process.env.E2E_STATE_FILE!, 'utf8'));
    if (!/^briefpilot_test_[a-f0-9]{32}$/.test(state.database)) throw new Error('Invalid isolated test database');
    const url=new URL(process.env.DATABASE_URL!); url.pathname=`/${state.database}`;
    const pool=new pg.Pool({connectionString:url.href});
    const id=randomUUID(), token=randomUUID(), project=randomUUID();
    await pool.query('INSERT INTO "User" (id,email,"updatedAt") VALUES ($1,$2,NOW())',[id,`e2e-${id}@example.invalid`]);
    await pool.query('INSERT INTO "Session" (id,"sessionToken","userId",expires) VALUES ($1,$2,$3,NOW()+INTERVAL \'1 hour\')',[randomUUID(),token,id]);
    await pool.query('INSERT INTO "Subscription" (id,"userId",plan,status,provider,"providerSubscriptionId","currentPeriodStart","currentPeriodEnd","updatedAt") VALUES ($1,$2,\'PRO\',\'TRIALING\',\'STRIPE\',$3,date_trunc(\'month\',NOW()),date_trunc(\'month\',NOW())+INTERVAL \'1 month\',NOW())',[randomUUID(),id,`fixture_${randomUUID()}`]);
    await pool.query('INSERT INTO "Project" (id,name,type,description,"ownerId","updatedAt") VALUES ($1,\'Restaurant E2E\',\'WEBSITE\',\'Réservation de tables\',$2,NOW())',[project,id]);
    await page.context().route('**/*', route => {
      const host = new URL(route.request().url()).hostname;
      return ['localhost', '127.0.0.1', '[::1]'].includes(host) ? route.continue() : route.abort();
    });
    await page.context().addCookies([{name:'authjs.session-token',value:token,url:origin,httpOnly:true,sameSite:'Lax'}]);
    const seedInterview=async()=>{
      await pool.query('INSERT INTO "InterviewMessage" (id,"projectId",role,content) VALUES ($1,$2,\'user\',$3)',[randomUUID(),project,answer]);
      await pool.query('UPDATE "Project" SET status=\'INTERVIEW\' WHERE id=$1',[project]);
    };
    const generateBrief=async()=>{
      await seedInterview();
      const result=await request.post(`/api/projects/${project}/briefs`,{headers:{Cookie:`authjs.session-token=${token}`,Origin:origin},data:{requestId:randomUUID(),allowDraft:true}});
      expect(result.ok(),await result.text()).toBeTruthy(); return (await result.json()).data.briefId as string;
    };
    try { await runFixture({id,token,pool,project,seedInterview,generateBrief,free:async()=>{await pool.query('DELETE FROM "Subscription" WHERE "userId"=$1',[id]);}}); }
    finally { await pool.query('DELETE FROM "User" WHERE id=$1',[id]); await pool.end(); }
  },
});
export { expect };
export async function noOverflow(page: Page) { expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy(); }
