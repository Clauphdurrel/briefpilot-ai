import { expect, it } from "vitest";
import { httpsOrigin, validateStagingReadiness } from "../../../../scripts/staging-preflight.mjs";
const values: Record<string,string>={APP_ENV:"staging",NODE_ENV:"production",DATABASE_URL:"postgresql://synthetic:synthetic@ep-test-123-pooler.eu-central-1.aws.neon.tech/briefpilot_staging?sslmode=require",DIRECT_URL:"postgresql://synthetic:synthetic@ep-test-123.eu-central-1.aws.neon.tech/briefpilot_staging?sslmode=require",AUTH_SECRET:"synthetic-auth-secret-at-least-32-characters",AUTH_GOOGLE_ID:"synthetic-google-id",AUTH_GOOGLE_SECRET:"synthetic-google-secret",AUTH_URL:"https://staging.example.invalid",OPENAI_API_KEY:"synthetic-only",OPENAI_MODEL:"synthetic-model",LEMONSQUEEZY_API_KEY:"synthetic-only",LEMONSQUEEZY_STORE_ID:"100",LEMONSQUEEZY_WEBHOOK_SECRET:"synthetic-only",LEMONSQUEEZY_PRO_VARIANT_ID:"200",LEMONSQUEEZY_AGENCY_VARIANT_ID:"300",LEMONSQUEEZY_TEST_MODE:"true",PDF_RENDER_MODE:"worker",PDF_WORKER_URL:"https://worker.example.invalid",PDF_WORKER_SECRET:"synthetic-worker-secret-at-least-32-characters"};
it("distinguishes static readiness from actual online evidence and telemetry",()=>{
  const result=validateStagingReadiness(values,{branch:"develop",projectLinked:true});expect(result.staticConfigurationReady).toBe(true);expect(result.monitoringConfigured).toBe(false);expect(result).not.toHaveProperty("fullyValidatedOnline",true);
});
it("requires develop, project linkage, independent auth secret and test payments",()=>{
  const result=validateStagingReadiness({...values,LEMONSQUEEZY_TEST_MODE:"false"},{branch:"main",developmentSecret:values.AUTH_SECRET});
  expect(result.blockers).toEqual(expect.arrayContaining(["DEVELOP_BRANCH_REQUIRED","VERCEL_PROJECT_NOT_LINKED","AUTH_SECRET_REUSED_FROM_DEVELOPMENT","LEMON_TEST_MODE_REQUIRED"]));expect(result.staticConfigurationReady).toBe(false);
});
it.each(["http://localhost:3000","https://u:p@staging.example.invalid","https://staging.example.invalid?token=PRIVATE","https://staging.example.invalid/callback"])("refuses unsafe staging origins %s",url=>{expect(httpsOrigin(url)).toBeNull();});
it("reports missing variable names without leaking configured secrets",()=>{
  const result=validateStagingReadiness({...values,AUTH_GOOGLE_ID:"",OPENAI_MODEL:""},{branch:"develop",projectLinked:true});expect(result.missingVariables).toEqual(["AUTH_GOOGLE_ID","OPENAI_MODEL"]);expect(JSON.stringify(result)).not.toContain(values.PDF_WORKER_SECRET);
});
it("refuses local Chromium and non-HTTPS worker configuration",()=>{
  const result=validateStagingReadiness({...values,PDF_RENDER_MODE:"local",PDF_WORKER_URL:"http://127.0.0.1:3193"},{branch:"develop",projectLinked:true});expect(result.blockers).toContain("HTTPS_PDF_WORKER_REQUIRED");
});
