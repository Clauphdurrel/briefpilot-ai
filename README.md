# BriefPilot AI

SaaS Next.js pour transformer une demande client en interview structurée, cahier des charges, backlog et prompts Codex. Exports Markdown/PDF, authentification Google, plans et quotas ; paiements Lemon Squeezy en mode test uniquement.

## Installation locale

Prérequis : Node.js **24.18.0** (`.nvmrc`), pnpm **11.9.0**, PostgreSQL 16 et un compte système non root pour Chromium avec sa sandbox active.

```sh
nvm use
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
chmod 600 .env
```

Renseigner `.env` localement, sans le versionner. `DATABASE_URL` doit correspondre à PostgreSQL. Pour Compose, définir `COMPOSE_POSTGRES_PASSWORD` avant `docker compose up -d postgres` ; le port est limité au loopback. Changer cette variable ne change pas le mot de passe d'un volume PostgreSQL déjà initialisé : modifier le rôle existant de façon contrôlée et mettre à jour `DATABASE_URL`. Ne pas supprimer le volume.

```sh
docker compose up -d postgres
pnpm db:generate
pnpm db:deploy
pnpm exec playwright install chromium
pnpm dev
```

Configurer le client OAuth Google avec `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `AUTH_URL` et l'URI de retour `/api/auth/callback/google` sur l'origine choisie. Définir `OPENAI_API_KEY` et un `OPENAI_MODEL` prenant en charge Structured Outputs. Les clés restent côté serveur.

Le paiement attend les variables `LEMONSQUEEZY_*` et la configuration de la boutique : voir [le guide billing](docs/architecture/lemon-squeezy-billing.md). Aucun paiement réel n'est activé par cette intégration.

## Validation avant livraison

```sh
pnpm prisma validate
pnpm lint
pnpm build
pnpm test:unit
pnpm test:integration
pnpm test:e2e
```

Construire l'application avant les intégrations/E2E. Ces deux campagnes créent chacune une nouvelle base locale jetable, appliquent les migrations puis suppriment uniquement cette base. Le rôle PostgreSQL doit avoir le droit de créer une base. Ne pas exécuter les campagnes ou un build simultanément. Les services OpenAI et Lemon Squeezy sont simulés ; aucun achat ou appel IA externe n'est effectué. Voir [les instructions E2E](docs/audits/e2e.md), [la matrice de validation](docs/audits/test-matrix.md) et [l'audit de préproduction](docs/audits/preproduction-audit.md).

## Exploitation

Voir [le runbook](docs/operations/runbook.md) pour le runtime PDF, les migrations, la sauvegarde/restauration et les vérifications de déploiement. La CI distante, le choix d'hébergement et la configuration de production appartiennent aux étapes suivantes.

L’observabilité est décrite dans [le guide opérateur](docs/operations/observability.md), avec [suivi des coûts IA](docs/operations/ai-cost-monitoring.md) et [réponse aux incidents](docs/operations/incident-response.md). Les intégrations distantes sont désactivées par défaut et les alertes doivent être configurées et vérifiées dans les comptes correspondants.
