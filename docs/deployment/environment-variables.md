# Variables de déploiement

`.env.example` décrit les noms ; `.env` reste local et tous les `.env.*` réels sont ignorés. Ne jamais copier un fichier de secrets dans une image ni utiliser ARG Docker pour un secret. Les variables NEXT_PUBLIC sont incluses au build et doivent rester publiques.

| Groupe | Serveur | Public / remarques |
| --- | --- | --- |
| Environnement | APP_ENV=development/staging/production, NODE_ENV défini par l'hébergement | NODE_ENV=production ne signifie pas base de production |
| PostgreSQL | DATABASE_URL poolée ; DIRECT_URL réservée aux opérations CLI contrôlées | Aucun accès DB navigateur |
| Auth.js | AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_URL si requis | Secret distinct pour staging, callback HTTPS stable |
| IA | OPENAI_API_KEY, OPENAI_MODEL | Ne pas utiliser la clé de production en Preview ; pas d'appel réel pendant l'audit |
| Lemon Squeezy | LEMONSQUEEZY_API_KEY, STORE_ID, WEBHOOK_SECRET, PRO_VARIANT_ID, AGENCY_VARIANT_ID préfixés LEMONSQUEEZY_ ; TEST_MODE=true | Le provider refuse déjà le mode live dans le périmètre actuel |
| PDF app | PDF_RENDER_MODE=worker, PDF_WORKER_URL=https://hote-approuve, PDF_WORKER_SECRET (32..256 caractères) | Aucune variable PDF publique, aucune URL provenant de l'utilisateur |
| PDF worker | PDF_WORKER_SECRET_FILE de préférence, sinon PDF_WORKER_SECRET ; PORT=8080 | Pas de DATABASE_URL ni secret OAuth/IA/paiement |
| Observabilité | OBSERVABILITY_ENABLED, OBSERVABILITY_ENVIRONMENT, AI_MONITORING_ENABLED, LOG_LEVEL, SENTRY_DSN, POSTHOG_ENABLED, POSTHOG_PROJECT_TOKEN, POSTHOG_HOST, ANALYTICS_HMAC_SECRET | Options par défaut désactivées |
| Sentry navigateur | aucun secret | NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_OBSERVABILITY_ENABLED, NEXT_PUBLIC_OBSERVABILITY_ENVIRONMENT |

Staging : APP_ENV=staging, Neon staging, checkout test, worker staging, projets monitoring staging. Production sera indépendante et ne sera pas créée ici. Cibler les variables Vercel Preview sur develop ; ne pas les offrir à toutes les branches/forks. DIRECT_URL n'est pas nécessaire au runtime web et peut rester dans un contexte d'opération de migrations distinct.

En tests : OBSERVABILITY_TEST_MODE=true, NEXT_PUBLIC_OBSERVABILITY_TEST_MODE=true, E2E_TEST=true et collecte distante désactivée. Les harnesses imposent les valeurs synthétiques et n'utilisent pas Neon partagé. Voir le [guide d'observabilité](../operations/observability.md).

Pour un worker Preview protégé sur Vercel : `PDF_WORKER_VERCEL_BYPASS_SECRET` est optionnel et strictement serveur. Il désigne un jeton Automation du **projet worker**, jamais un token de compte ou celui du projet app. Stockage éventuel dans l’app Preview/develop uniquement après autorisation explicite ; le client l’envoie comme en-tête HTTPS en conservant l’auth HMAC, sans redirection ni paramètre d’URL. Ce jeton contourne la protection de tous les déploiements du projet worker, pas uniquement /render ; voir [worker PDF](pdf-worker.md).
