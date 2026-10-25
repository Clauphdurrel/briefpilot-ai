# Premier staging Vercel — étape 26

## État et périmètre

L'infrastructure Docker est validée et Neon staging est migré. Ce guide prépare le premier Preview ; il ne déclenche aucun déploiement. La fin de l'étape 26 exige une vraie URL HTTPS, un worker distant fonctionnel et les parcours authentifiés en ligne. Une CLI installée, un build ou une base migrée ne suffisent pas.

Les secrets staging sont dans `.env.staging.local` privé (600), jamais dans Git/chat. AUTH_SECRET, PDF_WORKER_SECRET et ANALYTICS_HMAC_SECRET distincts ont été générés localement sans être affichés ; les clés des fournisseurs doivent être obtenues dans leurs projets staging. Les notes personnelles et fichiers `.env*` sont exclus des uploads CLI par `.vercelignore` ; `.vercel` reste ignoré par Git.

## Créer et relier le projet sans déployer

CLI officielle Vercel 65.2.0 préparée dans `/tmp/briefpilot-vercel-cli` sur la machine de validation. Pour une installation reproductible ailleurs, utiliser cette version explicitement plutôt qu'un latest silencieux.

```bash
cd /var/www/html/vision2/briefpilot-ai
nvm use
/tmp/briefpilot-vercel-cli/node_modules/.bin/vercel login
/tmp/briefpilot-vercel-cli/node_modules/.bin/vercel link
```

Dans link, choisir le compte/équipe prévu, créer ou sélectionner `briefpilot-ai`, framework Next.js, root `./`. Cette commande crée/lit la liaison locale `.vercel/project.json` ; elle ne déploie pas. Ne pas sélectionner d'offre payante ou autre équipe sans intervention de l'opérateur. [Documentation CLI officielle](https://vercel.com/docs/projects/deploy-from-cli).

Conserver production branch main ; utiliser develop pour staging Preview. Les PR #2 à #6 ont été revues puis fusionnées dans develop après autorisation explicite ; le premier Preview utilise leur commit fusionné 5cdb0a1. Ne pas forcer une fusion/reset pour contourner les contrôles. L’intégration Git est connectée ; createDeployments=disabled est vérifié sur les deux projets et vercel.json désactive les déploiements Git automatiques. Conserver ces protections jusqu’à intervention explicite.

## Configuration Preview

Renseigner les variables [documentées](environment-variables.md) uniquement pour Preview/develop. DATABASE_URL = Neon staging poolée ; DIRECT_URL reste réservée aux migrations contrôlées et n'est pas nécessaire aux fonctions web. Ne pas importer aveuglément tout un `.env` local : cela pourrait réutiliser les clés de développement/production ou exposer des secrets à d'autres branches.

Staging exige APP_ENV=staging, un secret Auth distinct, les vrais identifiants Google staging, une clé OpenAI limitée au projet staging et un modèle accessible, Lemon Squeezy test uniquement, puis PDF_RENDER_MODE=worker et l'URL HTTPS du worker. Le build génère Prisma sans migration. Node 24.x, pnpm 11.9.0 ; ne pas modifier les deadlines 60 s ou désactiver la sécurité pour faire passer le déploiement.

Dans Google Cloud, déclarer le callback `https://DOMAINE-STAGING-STABLE/api/auth/callback/google`. Utiliser un alias de branche develop stable ou un domaine détenu par l'opérateur, vérifié dans Vercel ; aucun domaine temporaire n'est codé dans l'application. AUTH_URL est défini si nécessaire pour retenir cette origine stable. Les cookies restent Secure en HTTPS et les sessions sont stockées dans Neon.

## Vérifications sans déploiement

```bash
pnpm staging:preflight
pnpm staging:preflight --check-database
pnpm db:staging:prisma-check
```

Le préflight ne modifie aucune donnée et n'affiche que les noms de variables manquantes, les blocages et des statuts. Sans flags, il n'envoie aucune requête réseau. Il vérifie la paire Neon, develop, la liaison de projet locale, les secrets, HTTPS et le mode paiement test. Une liaison locale ne prouve pas encore les droits du compte Vercel : vérifier aussi whoami/project inspect.

Après hébergement approuvé du worker, autoriser son probe synthétique :

```bash
pnpm staging:preflight --check-database --probe-worker
```

Ce probe signe un document fictif, attend un vrai PDF borné et ne consomme pas de quota utilisateur, d'API OpenAI ou de paiement. Il ne prouve pas à lui seul le parcours export authentifié dans l'application. La sandbox Chromium doit rester opérationnelle chez l'hébergeur ; sinon choisir une plateforme compatible, pas --no-sandbox. Voir [worker PDF](pdf-worker.md).

## Déploiement Preview — intervention explicite

Lorsque les cibles, variables, migrations, worker et contrôles CI sont vérifiés, l'opérateur peut lancer sur develop :

```bash
vercel deploy
```

Ne jamais ajouter --prod à cette étape. Une intégration Git peut aussi déployer develop automatiquement après sa configuration explicite ; ne pas la considérer activée sans vérification. L'opérateur doit contrôler le compte, le plan/coût, la branche et le projet avant de lancer cette action. Aucun hébergement worker payant ni déploiement n'est créé automatiquement par les scripts livrés.

Après un statut Vercel Ready, contrôler l'URL et son lien au SHA attendu. Le probe optionnel ci-dessous lit uniquement `/api/health` :

```bash
pnpm staging:preflight --check-database --probe-worker --check-http
```

Un health check positif valide seulement la liveness. Le script conserve fullyValidatedOnline=false : les parcours Google, projets, agents, exports et paiements nécessitent les vérifications authentifiées ci-dessous.

## Tests en ligne et protection

Avec données fictives et deux utilisateurs autorisés : login/logout Google, dashboard, projet A inaccessible à B, interviews/briefs/backlogs, persistance, exports Markdown/PDF, quotas Free et compteurs. Les appels OpenAI réels et un paiement Lemon de test sont des actions séparées de l'audit statique : ne pas les exécuter en prétendant utiliser un mock sur un staging réel. Les clés de production et paiements réels restent interdits.

Configurer l'endpoint webhook test `/api/webhooks/lemonsqueezy`, les seuls événements utilisés et le bon secret de signature. Vérifier les retries/idempotence, les statuts canoniques et l'absence de premium sur simple retour checkout. Une protection Preview globale peut bloquer webhook/OAuth : prévoir une exception restreinte autorisée par le plan tout en conservant les signatures et Auth.js ; ne pas ouvrir tout le staging par commodité.

Sentry/PostHog utilisent leurs projets staging et les préférences de consentement. Ne pas envoyer de données clients pendant l'audit. Vérifier une erreur/événement synthétique dans les comptes réels avant d'annoncer leur réception. Conserver dans [staging-validation.md](staging-validation.md) la preuve, le SHA, la date et les tests non effectués. Aucun secret dans les artifacts, logs ou tickets.

## Diagnostic et retour arrière

Client Prisma absent : génération au build. Connexion refusée : cibles privées, TLS, pooling, compute Neon et droits. PDF indisponible : configuration du worker, signature, HTTPS, sandbox/ressources et délai. OAuth : origine/callback stable, secret et protection Preview. Ne pas afficher les erreurs fournisseur brutes dans les réponses publiques.

Conserver la version précédente de l'app et le digest du worker. En incident, revenir à une version compatible avec le schéma actuel ; ne pas reset la base. Une restauration se fait sur une branche/base séparée avec validation avant bascule. Voir [rollback](rollback.md).

## État du compte préparé

Au 25 octobre 2026, compte duramite32-3695, équipe duramite32-3695s-projects (Hobby), deux projets créés en lhr1 : briefpilot-ai et briefpilot-pdf-worker-staging. App liée au dépôt GitHub ; premier Preview technique Ready et automatisation Git désactivée. Les quatre secrets initiaux et les deux variables Google autorisées sont sensibles et limités à Preview/develop ; seul PDF_WORKER_SECRET est partagé avec le worker Preview. DIRECT_URL reste local. AUTH_URL utilise l’alias stable ; OpenAI/Lemon et les parcours authentifiés restent à configurer/valider.

La cible worker Vercel utilise le paquet isolé décrit dans [pdf-worker.md](pdf-worker.md), sans Dockerfile à la racine Next.js. La protection Preview est conservée ; préparer un accès serveur restreint avant l’appel app → worker. Ne pas désactiver globalement la protection pour faire passer un probe. Hobby accepte techniquement Docker en bêta ; son usage personnel/non commercial et les coûts éventuels du registre doivent être vérifiés avant lancement. Aucune offre payante n’est activée automatiquement.

## Premier Preview technique autorisé

Origine stable : https://briefpilot-ai-git-develop-duramite32-3695s-projects.vercel.app

URI à enregistrer dans Google Cloud (client OAuth Web) :

```text
https://briefpilot-ai-git-develop-duramite32-3695s-projects.vercel.app/api/auth/callback/google
```

AUTH_URL utilise cette origine en Preview/develop. Accéder à l’alias depuis le navigateur connecté au compte Vercel autorisé avant de tester Google. Les probes publics renvoient 302 vers Vercel ; ils vérifient la protection, pas le health applicatif ni le succès OAuth. Aucun bypass créé pour ces probes. Si l’application Google est en mode test, utiliser un compte autorisé dans son audience de test.

Le déploiement CLI n’a pas créé d’alias de branche automatiquement avec le remote SSH personnalisé ; l’alias stable a été associé explicitement. Après chaque futur Preview autorisé, vérifier Ready puis réassigner cet alias au nouveau déploiement. Ne jamais l’associer à main/production dans cette procédure. Les SHA et résultats exacts figurent dans [le rapport](staging-validation.md).
