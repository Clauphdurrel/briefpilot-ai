import {randomUUID} from 'node:crypto';
// Explicit DB-only entitlement fixture, never a payment or production activation path.
export async function grantTestPlan(pool, userId) {
  await pool.query(`INSERT INTO "Subscription" (id,"userId",plan,status,provider,"providerSubscriptionId","currentPeriodStart","currentPeriodEnd","updatedAt") VALUES ($1,$2,'PRO','TRIALING','STRIPE',$3,date_trunc('month',NOW() AT TIME ZONE 'UTC'),date_trunc('month',NOW() AT TIME ZONE 'UTC')+INTERVAL '1 month',NOW())`,[randomUUID(),userId,`fixture_${randomUUID()}`]);
}
