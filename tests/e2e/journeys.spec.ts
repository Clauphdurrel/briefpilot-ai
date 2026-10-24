import { randomUUID, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, expect, origin, answer, noOverflow } from './fixtures';

test('01 · session réelle, navigation et déconnexion', async ({ page, account }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('main')).toBeVisible();
  await noOverflow(page);
  await page.getByRole('button', { name: 'Déconnexion', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(`/dashboard/projects/${account.project}`);
  await expect(page).toHaveURL(/\/login/);
});

test('02 · création projet, formulaire et isolation propriétaire', async ({ page, account, request }) => {
  await page.goto('/dashboard/projects');
  await page.getByLabel('Nom du projet').fill('Projet créé dans le navigateur');
  await page.getByLabel('Description courte').fill('Un besoin client de test.');
  await page.getByRole('button', { name: 'Créer le projet', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/projects\/[a-zA-Z0-9_-]+$/);
  await expect(page.getByRole('heading', { name: 'Projet créé dans le navigateur', exact: true })).toBeVisible();
  const foreign=randomUUID();
  await account.pool.query('INSERT INTO "User" (id,email,"updatedAt") VALUES ($1,$2,NOW())',[foreign,`foreign-${foreign}@example.invalid`]);
  try {
    const project=randomUUID();
    await account.pool.query('INSERT INTO "Project" (id,name,type,"ownerId","updatedAt") VALUES ($1,\'Projet autre compte\',\'SAAS\',$2,NOW())',[project,foreign]);
    const result=await request.get(`/api/projects/${project}/interview`,{headers:{Cookie:`authjs.session-token=${account.token}`}});
    expect(result.status()).toBe(404);
    await page.goto(`/dashboard/projects/${project}`);
    await expect(page.getByText('Projet autre compte', {exact:true})).toHaveCount(0);
  } finally { await account.pool.query('DELETE FROM "User" WHERE id=$1',[foreign]); }
  await noOverflow(page);
});

test('03 · interview IA simulée, réponse persistée et rechargement', async ({ page, account }) => {
  await page.goto(`/dashboard/projects/${account.project}/interview`);
  await page.getByRole('button',{name:'Démarrer l’interview',exact:true}).click();
  await expect(page.getByText('Quels contenus pouvez-vous fournir ?', {exact:true}).first()).toBeVisible();
  // Simulate the elapsed human reading time on this fixture only. The real
  // three-second server cooldown stays enabled, as do its integration tests.
  const aged = await account.pool.query('UPDATE "InterviewMessage" SET "createdAt"=NOW()-INTERVAL \'4 seconds\' WHERE "projectId"=$1 AND role=\'system\' AND metadata->>\'kind\'=\'interview_request\'', [account.project]);
  expect(aged.rowCount).toBe(1);
  await page.locator('#interview-answer').fill(answer);
  await page.getByRole('button', {name:'Envoyer', exact:true}).click();
  await expect(page.getByText('Quel budget prévoyez-vous ?', {exact:true}).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(answer, {exact:true})).toBeVisible();
  await noOverflow(page);
});

test('04 · consentement brouillon et génération cahier des charges', async ({ page, account }) => {
  await account.seedInterview();
  await page.goto(`/dashboard/projects/${account.project}/briefs`);
  const generate=page.getByRole('button',{name:'Générer le cahier des charges',exact:true});
  await expect(generate).toBeDisabled();
  await page.getByLabel('Autoriser un brouillon si des informations manquent').check();
  await generate.click();
  await expect(page).toHaveURL(/\/briefs\/[a-zA-Z0-9_-]+$/);
  await expect(page.getByText('Brouillon — à compléter',{exact:true})).toBeVisible();
  await expect(page.locator('#brief-features')).toBeVisible();
  await noOverflow(page);
});

test('05 · backlog lié au brief sélectionné et tâches Codex', async ({ page, account }) => {
  const brief=await account.generateBrief();
  await page.goto(`/dashboard/projects/${account.project}/briefs/${brief}`);
  const actions=page.getByRole('button',{name:'Analyse et actions',exact:true});
  // isVisible() does not wait for streamed content. At compact breakpoints,
  // wait for the disclosure before opening the controls used below.
  if (page.viewportSize()!.width < 1280) {
    await expect(actions).toBeVisible();
    await actions.click();
    await expect(page.locator('#document-insights')).toBeVisible();
  }
  await page.getByLabel('J’accepte de générer un backlog brouillon.').check();
  await page.getByRole('button',{name:'Générer le backlog',exact:true}).click();
  await expect(page).toHaveURL(/\/backlogs\/[a-zA-Z0-9_-]+$/);
  await expect(page.getByRole('link',{name:/Cahier des charges source/})).toHaveAttribute('href',`/dashboard/projects/${account.project}/briefs/${brief}`);
  await expect(page.getByRole('heading',{name:/Tâches techniques/})).toBeVisible();
  await noOverflow(page);
});

test('06 · téléchargement Markdown et PDF réels sans génération supplémentaire', async ({ page, account }) => {
  const brief=await account.generateBrief();
  await page.goto(`/dashboard/projects/${account.project}/briefs/${brief}`);
  for (const [label,extension] of [['Télécharger le cahier des charges','md'],['Télécharger le cahier des charges PDF','pdf']]) {
    await page.getByRole('button',{name:'Exporter',exact:true}).click();
    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('menuitem',{name:label,exact:true}).click();
    const download=await downloadPromise;
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`));
    const path=await download.path(); expect(path).toBeTruthy();
    const content=await readFile(path!);
    expect(content.length).toBeGreaterThan(100);
    if (extension==='pdf') expect(content.subarray(0,5).toString()).toBe('%PDF-');
    else expect(content.toString()).toContain('restaurant');
    await expect(page.getByRole('button',{name:'Exporter',exact:true})).toBeEnabled();
  }
  const count=await account.pool.query('SELECT COUNT(*)::int AS n FROM "Brief" WHERE "projectId"=$1',[account.project]);
  expect(count.rows[0].n).toBe(1);
});

test('07 · quota Free, message actionnable et archivage', async ({ page, account }) => {
  await account.free();
  await account.pool.query('INSERT INTO "Project" (id,name,type,"ownerId","updatedAt") VALUES ($1,\'Deuxième projet\',\'SAAS\',$2,NOW())',[randomUUID(),account.id]);
  await page.goto('/dashboard/projects');
  await page.getByLabel('Nom du projet').fill('Projet au-delà du quota');
  await page.getByRole('button',{name:'Créer le projet',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:/quota|limite|projets actifs/i})).toBeVisible();
  await expect(page.getByRole('link',{name:'Voir les offres',exact:true}).first()).toBeVisible();
  await page.goto(`/dashboard/projects/${account.project}`);
  await page.getByRole('button',{name:'Archiver le projet',exact:true}).click();
  await expect(page.getByRole('button',{name:'Réactiver le projet',exact:true})).toBeVisible();
  await noOverflow(page);
});

test('08 · checkout test, webhook signé, annulation et reprise vérifiées', async ({ page, account, request }) => {
  await account.free();
  await page.goto('/dashboard/billing/success?plan=AGENCY&success=true');
  let status=await request.get('/api/billing/subscription',{headers:{Cookie:`authjs.session-token=${account.token}`}});
  expect((await status.json()).data.plan).toBe('FREE');
  await page.route('https://briefpilot.lemonsqueezy.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Checkout local simulé</h1>'}));
  await page.goto('/pricing'); await noOverflow(page);
  await page.getByRole('button',{name:'Passer à Pro',exact:true}).click();
  await expect(page).toHaveURL(/lemonsqueezy\.com\/checkout\//);
  const checkoutId=new URL(page.url()).pathname.split('/').at(-1)!;
  const checkout=await (await request.get(`http://127.0.0.1:3182/__checkout/${checkoutId}`)).json();
  const id=String(7000000000000000+Math.floor(Math.random()*1000000000));
  const now=new Date(),end=new Date(now);end.setUTCMonth(end.getUTCMonth()+1);
  await request.post('http://127.0.0.1:3182/__state',{data:{data:{type:'subscriptions',id,attributes:{store_id:100,customer_id:123,variant_id:200,test_mode:true,status:'active',cancelled:false,billing_anchor:now.getUTCDate(),renews_at:end.toISOString(),ends_at:null,trial_ends_at:null,created_at:now.toISOString(),updated_at:now.toISOString(),urls:{customer_portal:'https://briefpilot.lemonsqueezy.com/billing?signature=e2e'}}}}});
  const payload=JSON.stringify({meta:{event_name:'subscription_created',custom_data:checkout.data.attributes.checkout_data.custom},data:{type:'subscriptions',id,attributes:{test_mode:true}}});
  const signature=createHmac('sha256','local-e2e-webhook-secret').update(payload).digest('hex');
  const hook=await request.post('/api/webhooks/lemonsqueezy',{headers:{'Content-Type':'application/json','X-Signature':signature,'X-Event-Name':'subscription_created'},data:payload});
  expect(hook.ok(),await hook.text()).toBeTruthy();
  await page.goto(`${origin}/dashboard/settings/subscription`);
  await expect(page.getByRole('heading',{name:'Abonnement Pro',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Annuler le renouvellement',exact:true}).click();
  await expect(page.getByRole('button',{name:'Reprendre le renouvellement',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Reprendre le renouvellement',exact:true}).click();
  await expect(page.getByRole('button',{name:'Annuler le renouvellement',exact:true})).toBeVisible();
  status=await request.get('/api/billing/subscription',{headers:{Cookie:`authjs.session-token=${account.token}`}});
  expect((await status.json()).data.plan).toBe('PRO');
  await noOverflow(page);
});


test('09 · consentement analytics enregistré et révocable', async ({ page, account }) => {
  await page.goto('/dashboard/settings');
  const consent = page.getByRole('checkbox', { name: /Autoriser les statistiques/ });
  await expect(consent).not.toBeChecked();
  for (const allowed of [true, false]) {
    await consent.setChecked(allowed);
    await page.getByRole('button', { name: 'Enregistrer ma préférence' }).click();
    await expect(page.getByRole('status')).toBeVisible();
    const stored = await account.pool.query('SELECT "analyticsConsent" FROM "User" WHERE id=$1', [account.id]);
    expect(stored.rows[0].analyticsConsent).toBe(allowed);
    await page.reload();
    if (allowed) await expect(consent).toBeChecked();
    else await expect(consent).not.toBeChecked();
  }
  await noOverflow(page);
});
