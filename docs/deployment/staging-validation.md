# Audit du staging — étape 26

État au 25 octobre 2026 : **premier Preview technique de l’application déployé après autorisation explicite. L’étape 26 reste en cours : les parcours Google authentifiés, IA, paiement, PDF distant et monitoring ne sont pas validés en ligne.**

## Déploiement et preuves

- PR #2 à #6 fusionnées dans `develop`, dans l’ordre et avec les SHA vérifiés ; `main` reste inchangée.
- Commit déployé : `5cdb0a1af61bc48a43dc2134c2ad3cf2882ba4d1`. Son arbre est identique au code de la PR #6 validé avant fusion.
- Les six jobs CI du commit fusionné réussissent : [run 40212326189](https://github.com/Clauphdurrel/briefpilot-ai/actions/runs/40212326189).
- Premier Preview `dpl_CE846Ma5UAxWm3617LLqLVujADuu` : **READY**, branche develop, cible non-production, build cloud réussi.
- Actualisation de configuration OAuth `dpl_3icT8peVdkNKBaUo2VCfZdMEJsA8` : **READY**, même commit et même environnement Preview ; configuration AUTH_URL stable appliquée. L’alias staging pointe sur cette actualisation.
- Origine stable : https://briefpilot-ai-git-develop-duramite32-3695s-projects.vercel.app ; alias dédié au Preview, sans achat de domaine ni promotion en production.
- Projet app `briefpilot-ai`, compte duramite32-3695, équipe duramite32-3695s-projects, plan Hobby. Aucun passage à Pro, aucune publication d’image ou déploiement du worker.
- Les déploiements Git automatiques restent désactivés. Inspection avant upload : 371 entrées, environ 3,9 Mo ; aucun fichier .env, credential ou note personnelle dans le paquet.

## Contrôles réellement exécutés

| Contrôle | Preuve / état |
| --- | --- |
| Code / CI | 641 tests unitaires locaux, lint, TypeScript et build VERCEL=1 réussis ; six jobs GitHub réussis, dont PostgreSQL/API, navigateur et worker |
| Neon staging | Connexions poolée/directe, TLS client et certificat vérifiés ; 6 migrations autorisées appliquées, 16 tables, historique up-to-date ; contrôle readonly répété avec succès |
| Prisma réel | Test opt-in Neon réussi : transaction READ ONLY, SELECT 1 et lectures de modèles ; aucun seed ni mutation de test |
| Secrets | Fichier staging privé 600 et ignoré ; métadonnées Vercel relues sans affichage de valeur ; aucun secret versionné |
| HTTPS / protection | Requêtes sans session sur /api/health, /login et /api/auth/providers : 302 vers l’authentification Vercel, également sur l’alias stable ; TLS accepté par le client |
| Santé applicative | Non validée derrière la protection : le 302 ne prouve pas le contenu de /api/health ni le démarrage d’une session Auth.js |
| Google OAuth | Identifiants sensibles présents en Preview/develop ; AUTH_URL stable configuré ; callback Google Cloud et connexion réelle restent à confirmer par l’opérateur |
| Worker local | 7 contrats HTTP et vrai PDF Docker : accents, sandbox, non-root, rootfs read-only, authentification/signature/rejeu, concurrence et arrêt propre |
| Worker distant | Paquet Vercel isolé construit et testé localement ; aucun déploiement worker, URL et sandbox cloud non vérifiées |
| IA / paiement | Aucun appel OpenAI ni paiement exécuté ; clés/modèle et configuration Lemon Squeezy staging manquants |
| Monitoring / BOLA | Réception Sentry/PostHog et isolation de deux comptes en ligne non testées ; collecte externe désactivée |

Aucun jeton de bypass n’a été créé pour ces probes. La protection Preview `all_except_custom_domains` est conservée. Le compte Vercel connecté dans le navigateur doit autoriser l’accès au Preview avant le test Google ; ne pas ouvrir globalement le staging pour contourner cette étape.

## Configuration distante autorisée

Dans l’app, uniquement Preview/develop : DATABASE_URL poolée, AUTH_SECRET, PDF_WORKER_SECRET, ANALYTICS_HMAC_SECRET, AUTH_GOOGLE_ID et AUTH_GOOGLE_SECRET sont sensibles et non lisibles. DIRECT_URL reste local. AUTH_URL est un paramètre non secret défini à l’origine stable ci-dessus et enregistré dans le fichier privé local. Les autres paramètres imposent staging, rendu worker, paiement test et observabilité désactivée.

Le projet `briefpilot-pdf-worker-staging` possède seulement le secret PDF partagé, plus PORT et APP_ENV ; aucun secret Neon, OAuth ou OpenAI. Il n’a pas été déployé. L’autorisation du Preview app n’autorise pas un hébergement worker payant ni un déploiement production.

## Points bloquants pour terminer l’étape 26

1. Ajouter/enregistrer dans Google Cloud le callback exact ci-dessous, puis tester login/logout dans le navigateur connecté au compte Vercel autorisé.
2. Configurer une clé et un modèle OpenAI staging ; autoriser séparément les appels réels nécessaires aux parcours IA.
3. Configurer Lemon Squeezy test : boutique, variantes, API, webhook signé et réception sous protection Preview ; aucun paiement réel.
4. Autoriser et valider l’hébergement du worker : coûts éventuels, HTTPS, sandbox distante, accès serveur et limites entre instances. Le cache de nonces/concurrence actuel est par processus, pas global sous autoscaling.
5. Configurer/vérifier les projets monitoring et réception synthétique, puis les parcours authentifiés avec deux comptes et les quotas.

```text
https://briefpilot-ai-git-develop-duramite32-3695s-projects.vercel.app/api/auth/callback/google
```

Aucun domaine temporaire n’est codé dans l’application. L’alias stable doit être réassigné après les prochains déploiements CLI tant que l’automatisation Git reste désactivée. Conserver le précédent Preview comme point de retour ; aucune migration supplémentaire n’a été exécutée pour ce déploiement.

## Limites de la validation locale

Le build local VERCEL=1/APP_ENV=staging utilise uniquement des paramètres fournisseurs fictifs. Les 36 manifests ne contiennent aucun fichier du package navigateur Playwright ni le moteur local ; le nom d’un peer Playwright dans le chemin pnpm de Next ne désigne pas le package embarqué. Aucun secret serveur staging détecté dans les 33 fichiers statiques contrôlés.

Le client/probe prennent en charge PDF_WORKER_VERCEL_BYPASS_SECRET comme en-tête HTTPS optionnel, séparé du secret HMAC et du jeton système de l’app ; aucun jeton réel créé ou envoyé. Les tests couvrent cette séparation et le refus des jetons mal formés/HTTP. Toute activation d’accès au worker reste à autoriser. Voir [worker PDF](pdf-worker.md) et [procédure staging](vercel-staging.md).

Aucun feu vert production. Les sauvegardes/RPO/RTO, le budget et les garanties du runtime cloud restent à confirmer avant lancement.
