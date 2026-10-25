import { expect, it } from "vitest";
import { securePgUrl, stagingConnections, runtimePoolConfig } from "../connection.mjs";
import { compareMigrations, loadStagingEnvironment, localMigrations } from "../../../../scripts/staging-database.mjs";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const direct="postgresql://synthetic:syntheticpass@ep-example-123.eu-central-1.aws.neon.tech/briefpilot_staging?sslmode=require";
const pooled=direct.replace("ep-example-123.","ep-example-123-pooler.");
const values={APP_ENV:"staging",NODE_ENV:"production",DATABASE_URL:pooled,DIRECT_URL:direct};
it("separates pooled runtime and direct CLI connections with verified TLS",()=>{
  const result=stagingConnections(values);expect(new URL(result.pooled).searchParams.get("sslmode")).toBe("verify-full");expect(new URL(result.direct).hostname).not.toContain("-pooler");
});
it.each(["postgresql://u:p@localhost/briefpilot_staging?sslmode=require",direct.replace("briefpilot_staging","production"),direct.replace("sslmode=require","sslmode=disable"),direct+"&uselibpqcompat=true",direct+"&sslrootcert=/etc/passwd",direct+"&sslmode=disable",direct.replace(".neon.tech",".neon.tech.attacker.invalid")])("refuses unsafe staging target without disclosing credentials: %#",value=>{
  expect(()=>stagingConnections({...values,DIRECT_URL:value})).toThrow("Database configuration is invalid");
});
it("refuses mismatched endpoints, credentials, environments and swapped pool modes",()=>{
  for(const patch of [{DIRECT_URL:direct.replace("example-123","other-123")},{DIRECT_URL:direct.replace("syntheticpass","otherpass")},{APP_ENV:"production"},{NODE_ENV:"development"},{DIRECT_URL:pooled,DATABASE_URL:direct}])expect(()=>stagingConnections({...values,...patch})).toThrow();
});
it("keeps local development and bounds runtime connection capacity",()=>{
  expect(runtimePoolConfig({DATABASE_URL:"postgresql://local:synthetic@localhost/app"})).toMatchObject({max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
  expect(runtimePoolConfig({APP_ENV:"staging",DATABASE_URL:pooled,DATABASE_POOL_MAX:"2"}).max).toBe(2);
  for(const max of ["0","21","NaN","1.5"])expect(()=>runtimePoolConfig({DATABASE_POOL_MAX:max})).toThrow();
  expect(()=>runtimePoolConfig({APP_ENV:"staging"})).toThrow();expect(()=>securePgUrl("postgresql://u:p@example.invalid/app")).toThrow();
});
it("loads only a private regular staging file and rejects symlinks and public file permissions",()=>{
  const dir=mkdtempSync(join(tmpdir(),"briefpilot-config-test-")),path=join(dir,"stage.env");
  try{
    writeFileSync(path,Object.entries(values).map(([k,v])=>`${k}=${v}`).join("\n"),{mode:0o600});expect(loadStagingEnvironment(path).connections.pooled).toContain("verify-full");
    chmodSync(path,0o644);expect(()=>loadStagingEnvironment(path)).toThrow();chmodSync(path,0o600);
    symlinkSync(path,join(dir,"link.env"));expect(()=>loadStagingEnvironment(join(dir,"link.env"))).toThrow();
  }finally{rmSync(dir,{recursive:true,force:true});}
});
it("audits the current migration order and detects missing, changed or failed histories",()=>{
  const local=localMigrations();expect(local.length).toBeGreaterThan(0);expect(local.every(x=>!x.destructive)).toBe(true);
  const rows=local.map(x=>({migration_name:x.name,checksum:x.checksum,finished_at:new Date(),rolled_back_at:null}));expect(compareMigrations(local,rows)).toHaveLength(0);expect(compareMigrations(local,[])).toHaveLength(local.length);
  expect(()=>compareMigrations(local,[{...rows[0],checksum:"changed"}])).toThrow();expect(()=>compareMigrations(local,[{...rows[0],finished_at:null}])).toThrow();expect(()=>compareMigrations(local,[{...rows[0],migration_name:"unknown"}])).toThrow();
});
