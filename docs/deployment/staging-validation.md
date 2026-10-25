# Audit du staging — étape 26

État au 25 octobre 2026 : **premier Preview technique de l’application déployé après autorisation explicite. L’étape 26 reste en cours : la connexion Google et la session Neon sont validées ; les parcours IA, paiement, PDF distant et monitoring restent à valider en ligne.**

## Déploiement et preuves

- PR #2 à #6 fusionnées dans `develop`, dans l’ordre et avec les SHA vérifiés ; `main` reste inchangée.
- Commit déployé : `5cdb0a1af61bc48a43dc2134c2ad3cf2882ba4d1`. Son arbre est identique au code de la PR #6 validé avant fusion.
- Les six jobs CI du commit fusionné réussissent : [run 40212326189](https://github.com/Clauphdurrel/briefpilot-ai/actions/runs/40212326189).
- Premier Preview CLI `dpl_CE846Ma5UAxWm3617LLqLVujADuu` : build **READY**, mais variables Preview/develop absentes du déploiement ; authentification non fonctionnelle.
- Deuxième Preview CLI `dpl_3icT8peVdkNKBaUo2VCfZdMEJsA8` : même défaut malgré le statut **READY**. La présence des secrets dans le projet ne prouvait pas leur application au déploiement.
- Preview réparé `dpl_EpUn269r5kNRJM33H3qwxbw3Pn1U` : **READY**, créé par gitSource GitHub natif, repoId vérifié, ref develop et SHA épinglé au même commit validé. Présence effective vérifiée par noms uniquement : AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_URL, APP_ENV, DATABASE_URL. L’alias staging pointe sur ce Preview.
- Preview avec OpenAI `dpl_HULHP8Zs2KVemazkxqLgsQ5rWuJu` : **READY**, même gitSource develop/SHA validé. Présence de OPENAI_API_KEY et OPENAI_MODEL vérifiée par noms uniquement, en plus des six variables Auth/Neon. Alias staging réassigné à ce Preview. Aucun appel OpenAI exécuté par l’agent.
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
| Google OAuth | L’opérateur confirme l’accès au dashboard après connexion Google ; lecture seule Neon : 1 compte Google lié et 1 session active, sans affichage d’identité ou token. Logout et second compte restent à tester |
| Worker local | 7 contrats HTTP et vrai PDF Docker : accents, sandbox, non-root, rootfs read-only, authentification/signature/rejeu, concurrence et arrêt propre |
| Worker distant | Paquet Vercel isolé construit et testé localement ; aucun déploiement worker, URL et sandbox cloud non vérifiées |
| IA / paiement | Clé OpenAI staging sensible et modèle gpt-4.1-mini appliqués au Preview ; aucune génération exécutée par l’agent, première réponse réelle à valider. Configuration Lemon Squeezy staging manquante, aucun paiement exécuté |
| Monitoring / BOLA | Réception Sentry/PostHog et isolation de deux comptes en ligne non testées ; collecte externe désactivée |

Aucun jeton de bypass n’a été créé pour ces probes. La protection Preview `all_except_custom_domains` est conservée. Le compte Vercel connecté dans le navigateur doit autoriser l’accès au Preview avant le test Google ; ne pas ouvrir globalement le staging pour contourner cette étape.

## Configuration distante autorisée

Dans l’app, uniquement Preview/develop : DATABASE_URL poolée, AUTH_SECRET, PDF_WORKER_SECRET, ANALYTICS_HMAC_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET et OPENAI_API_KEY sont sensibles et non lisibles. DIRECT_URL reste local. AUTH_URL est un paramètre non secret défini à l’origine stable ci-dessus et enregistré dans le fichier privé local. OPENAI_MODEL=gpt-4.1-mini est non secret et limité à Preview/develop. Les autres paramètres imposent staging, rendu worker, paiement test et observabilité désactivée.

Le projet `briefpilot-pdf-worker-staging` possède seulement le secret PDF partagé, plus PORT et APP_ENV ; aucun secret Neon, OAuth ou OpenAI. Il n’a pas été déployé. L’autorisation du Preview app n’autorise pas un hébergement worker payant ni un déploiement production.

## Points bloquants pour terminer l’étape 26

1. Login Google et dashboard confirmés ; tester logout puis une nouvelle connexion, ainsi que les parcours métier avec deux comptes autorisés.
2. Valider les trois agents par des essais réels avec données fictives ; clé/modèle staging appliqués, mais validité de la clé, crédit API disponible et réponses structurées restent à confirmer. La dernière autorisation couvre le stockage des paramètres, sans génération ni achat de crédits.
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

## Incident OAuth et correction

Le premier essai utilisateur renvoyait « Server error / There is a problem with the server configuration ». Les journaux récents exposent uniquement le code autorisé AUTH_CONFIGURATION_ERROR. La lecture des métadonnées du déploiement confirme l’absence de toutes les variables de branche Auth/Neon ; elles étaient pourtant correctement enregistrées dans le projet Preview/develop. Les métadonnées Git génériques du déploiement CLI avec le remote SSH personnalisé n’avaient pas appliqué la configuration de branche.

Correction : création manuelle autorisée via POST /v13/deployments, gitSource type github, repoId 1234938895, ref develop, sha 5cdb0a1af61bc48a43dc2134c2ad3cf2882ba4d1. Target omis conformément à l’API (Preview), production branch main inchangée. Le nouveau déploiement Ready reçoit les six variables vérifiées ; alias staging réassigné. Aucun secret réexposé, aucune portée élargie à toutes les branches, aucun bypass créé et aucune modification du code nécessaire.

Le statut Ready est donc une preuve de build, pas une preuve de configuration OAuth ou de parcours fonctionnel. Le nouvel essai utilisateur a ensuite confirmé l’accès au dashboard ; voir la vérification readonly ci-dessous. Sur Hobby, la requête de logs avec --since 1h dépassait la rétention disponible ; --since 5m a permis de consulter les codes récents sans afficher de messages sensibles.

Nouvel essai après correction des variables : l’opérateur atteint Google et signale `Erreur 400 : redirect_uri_mismatch`. AUTH_URL a été relu comme paramètre non secret et correspond exactement à l’origine stable. La valeur redirect_uri des détails Google est demandée pour comparaison ; vérifier aussi que le callback a été ajouté au client correspondant à AUTH_GOOGLE_ID. Aucune connexion réussie ni session créée n’est déduite de ce seul message. Ne pas modifier les callbacks ni les secrets sans identifier l’écart exact.

## Connexion Google validée

Le 25 octobre 2026, l’opérateur confirme avoir atteint le dashboard après connexion Google sur l’alias staging. La vérification indépendante Neon s’exécute dans une transaction READ ONLY et retourne seulement deux compteurs : 1 Account avec provider google et 1 Session non expirée. Aucun email, nom, identifiant, cookie ou token lu/affiché ; aucune mutation de test. Cela confirme la persistance de la connexion OAuth réelle.

La connexion Google n’est plus bloquante. Le logout, un second compte, l’isolation entre comptes et les parcours métier restent distincts et non validés. Les variables OpenAI, Lemon Squeezy et PDF_WORKER_URL sont toujours absentes du fichier privé au moment de ce contrôle ; aucun appel IA ou paiement n’a été exécuté.

## Paramètres OpenAI staging appliqués

Après autorisation explicite, OPENAI_API_KEY a été transféré comme variable sensible et OPENAI_MODEL comme paramètre non secret vers briefpilot-ai, uniquement Preview/develop. Les portées ont été relues sans afficher de valeur de clé. Le modèle retenu est gpt-4.1-mini ; il prend en charge Responses et les sorties structurées requises par les agents selon la documentation officielle consultée. Aucun SDK OpenAI ou endpoint OpenAI n’a été appelé pour ce transfert.

Le Preview GitHub natif a été recréé et atteint Ready ; présence des deux noms de variables vérifiée dans le déploiement, alias stable réassigné et protection conservée. Cela ne prouve pas encore la validité de la clé auprès d’OpenAI ni le succès d’une génération. Un premier test volontaire depuis le dashboard, avec un projet fictif, est proposé à l’opérateur en précisant sa consommation de crédit API ; aucune génération ou recharge automatique.

Documentation : [modèle](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [protection des clés](https://developers.openai.com/api/docs/guides/production-best-practices#api-keys), [tarification](https://developers.openai.com/api/docs/pricing).

L’opérateur a ensuite accepté un premier test réel volontaire depuis le dashboard, sur le projet fictif « Café Démo ». L’action Démarrer l’interview déclenchera un appel API utilisant son crédit OpenAI ; aucun achat/rechargement ni génération par un script de l’agent. Le résultat de ce premier essai reste attendu.
