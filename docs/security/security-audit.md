# Audit de sécurité approfondi — étape 21

Date : **24 octobre 2026**. Base examinée : `b409221` (étape 20). Branche : `security/preproduction-hardening`. Rapport initial conservé dans le commit `2f54ecc`, avant enregistrement des correctifs ; correctif Auth.js séparé dans `366a676`.

## Résumé exécutif et décision

**Étape 21 terminée : prêt pour l'étape 22, observabilité et supervision.** Aucun constat CRITICAL ou HIGH identifié dans le périmètre local examiné. Le problème MEDIUM de journalisation brute et les quatre améliorations préventives LOW sont corrigés et vérifiés. Aucun accès horizontal aux données, activation premium arbitraire, dépassement de quota ou SSRF PDF confirmé par cette revue.

Cette conclusion concerne les chemins examinés et les tests réalisés. Elle ne certifie pas l'absence de vulnérabilités et ne signifie pas que l'environnement de production est prêt : comptes externes, proxy, TLS, déploiement et restauration doivent encore être validés.

| Gravité | Constats initiaux | Constats initiaux encore ouverts |
|---|---:|---:|
| CRITICAL | 0 | 0 |
| HIGH | 0 | 0 |
| MEDIUM | 1 confirmé | 0 |
| LOW | 4 préventifs | 0 |
| INFORMATIONAL | 1 risque conditionnel de lecture lente | 0 dans les lecteurs applicatifs ; limites d'entrée de l'hébergement encore à vérifier |

## Périmètre, méthode et référentiels

Six agents spécialisés distincts ont réalisé la phase initiale **en lecture seule**, avant correction : authentification, autorisations, API, IA, paiements, infrastructure. La consolidation, les reproductions, les correctifs et la campagne finale ont été réalisés ensuite. Les conclusions des agents sans test exécuté ont été traitées comme une revue de code, pas comme une preuve dynamique.

Référentiels consultés : [OWASP ASVS 5.0](https://asvs.owasp.org/), [OWASP API Security Top 10 2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/), [contrôles d'authentification/autorisation Next.js](https://nextjs.org/docs/app/guides/authentication) et [logger Auth.js](https://authjs.dev/reference/core#logger). Il s'agit d'une revue ciblée des thèmes de ces référentiels ; aucune conformité exhaustive ou certification n'est revendiquée.

L'audit couvre Auth.js/Google, routes et Server Actions, objets Prisma, agents IA, prompts, quotas, billing, exports Markdown/PDF, logs et configuration locale. Les tests réseau applicatifs utilisent uniquement le loopback et des fournisseurs simulés. Les consultations de documentation et du registre npm ne reçoivent aucun secret ou contenu client. Aucun service de production n'a été testé.

## Vulnérabilité confirmée

### AUTH-LOG-21 — MEDIUM — journalisation brute des erreurs d'authentification

**Fichiers/fonctions initiales :** `src/auth.ts`, configuration `NextAuth` sans logger spécifique ; logger par défaut d'Auth.js 0.41.3 (`lib/utils/logger.js`) et enveloppement des erreurs d'adaptateur dans `lib/init.js`.

**Cause et preuve :** un appel local au vrai moteur Auth.js, avec un cookie fictif et un adaptateur dont `getSessionAndUser` lève une erreur contenant un marqueur synthétique, retrouvait ce marqueur dans `console.error`. La réponse de session restait HTTP 200/null. Le défaut de journalisation est confirmé ; une fuite de vraie clé ou donnée client n'a pas été observée. L'impact est la transmission possible de données sensibles lorsqu'une erreur fournisseur/Prisma les contient.

**Correction :** `src/server/auth/logger.ts` fournit les trois méthodes error/warn/debug et n'émet que des événements/codes fixes par liste autorisée. Aucun message, stack, cause, argument ou métadonnée n'est transmis. Les Server Actions interceptent les `AuthError` et redirigent vers des messages fixes, afin de ne pas laisser Next journaliser leurs causes comme exceptions non gérées ; les exceptions de contrôle de navigation restent intactes.

**Preuve après correction :** `auth-security.test.ts` utilise le handler réel de `src/auth.ts` avec adaptateur simulé. Le marqueur d'erreur, le jeton et l'adresse fictifs restent absents des logs, le code autorisé apparaît et la réponse de session reste inchangée. `auth-actions.test.ts` vérifie les redirections fixes et la conservation des signaux de navigation. Les destinations de logs défaillantes et propriétés d'erreur hostiles ne changent pas le comportement d'authentification.

## Améliorations préventives et risque conditionnel corrigés

| ID / gravité | Cause et impact initial | Correction et preuve |
|---|---|---|
| ENV-MODE-21 / LOW | `.env` local mode 0664, répertoires traversables : lecture possible par d'autres comptes locaux et écriture par le groupe. Aucun contenu lu ou accès tiers observé. | Mode local passé à **0600**, vérifié par `stat`, sans lire ni changer les valeurs. README et runbook décrivent `chmod 600`/`umask 077`. À répéter sur chaque environnement. |
| ENV-GIT-21 / LOW | `.gitignore` n'excluait pas `.env.production`, `.env.test`, `.env.staging` ; risque d'ajout accidentel futur. Aucun de ces fichiers versionné. | `.env.*` ignoré avec exception `!.env.example`. Vérification `git check-ignore` et maintien de l'exemple versionné. |
| API-MIME-21 / LOW | `readInterviewBody` utilisait une comparaison par préfixe, acceptant `application/jsonp`. Pas de bypass CSRF établi : contrôle d'Origin distinct. | Comparaison exacte du type média, casse normalisée et paramètres charset acceptés ; tests des suffixes refusés avant lecture et appel au service IA. |
| BILLING-BODY-21 / LOW | `LemonSqueezyProvider.api` vérifiait 512 Ko après `response.text()` ; une réponse fournisseur excessive était déjà allouée. Origine fixe de confiance, aucune exploitation client démontrée. | Lecture bornée du flux avant concaténation, annulation à dépassement ; test transport multi-chunks et erreur publique 503 assainie. |
| API-TIME-21 / INFORMATIONAL | Les lecteurs JSON/webhook limitaient les octets mais attendaient sans deadline propre un flux non terminé. Risque probable dépendant du runtime/proxy. | Lecteur partagé `readBodyBytes` : annulation après **10 secondes**, limites 20 000/256 000/512 000 octets, sans confiance dans Content-Length. Tests avec flux bloqué, annulation qui ne résout pas, faux Content-Length et absence de verrou restant. |

Les octets bruts du webhook sont conservés exactement, y compris Unicode et espaces, avant vérification HMAC. Les erreurs de taille restent 413 ; une lecture entrante expirée retourne un code public 408. Les erreurs du fournisseur restent génériques.

## Contrôles examinés et vérifiés

| Domaine | Revue de code | Preuve dynamique de cette campagne |
|---|---|---|
| Authentification | Session en base, expiration/révocation, redirections fixes, cookies et protections du SDK | Sessions inconnues/expirées/révoquées, déconnexion avec/sans CSRF ; handler réel HTTPS vérifiant HttpOnly/Secure/SameSite=Lax ; callback externe refusé ; callback OAuth sans cookie PKCE refusé avant échange de jetons, découverte simulée |
| Autorisations | Identité résolue côté serveur, ownership des projets avant accès documents, loaders réutilisés par exports | Comptes A/B ; nouveau cas A Pro historique illimité/B Free : B lit ses deux documents, A reçoit 404 sur briefs/backlogs et cinq chemins d'export, sans donnée privée ni quota débité |
| API/BDD | Zod strict, paramètres contrôlés, SQL paramétré, absence d'eval/HTML brut, verrous et FK composite brief/backlog | Entrées invalides, origine étrangère, actions directes, quotas atomiques, idempotence et test avec pool à une connexion |
| IA | Instructions système séparées des données JSON, aucun outil, sortie structurée puis validations métier, tailles/tokens/délais bornés, quotas avant dispatch | Séparation système/données des trois agents, sorties invalides/refusées, sources inventées et graphes incohérents rejetés ; erreurs simulées et tentatives facturées |
| Paiements | HMAC brut constant-time, token de liaison de checkout hashé, boutique/mode/variant vérifiés, révision distante et écriture atomique | Signature invalide, body altéré, replay, ordre, concurrence, annulation/reprise/expiration, échec/rétablissement, retour URL sans activation |
| Exports | Échappement HTML, CSP PDF, sandbox Chromium, offline/routes bloquées, JS/serviceworkers désactivés, env par liste autorisée | PDF réels avec HTML hostile, URL locale et iframe fichier ; texte/pagination vérifiés, appels réseau/IA évités, quota et concurrence contrôlés |
| Secrets/infrastructure | `.env` non versionné, secrets côté serveur, logs/Sentry par listes autorisées, Compose loopback et secret injecté | Modes/exclusions Git vérifiés ; scan local de l'historique ; audit des dépendances ; build et tests complets |

## Historique et dépendances

Le scan local de **437 blobs texte** de l'historique accessible avant les commits de cette tâche a recherché les formes OpenAI, Google OAuth, AWS et clés privées. Seuls les marqueurs synthétiques du test backlog ont été identifiés. L'historique des noms de fichiers d'environnement/credentials ne révèle que `.env.example`. Les valeurs de `.env` n'ont pas été lues. Un scan par motifs ne garantit pas de reconnaître tous formats de secrets.

`pnpm audit --json` : **0 avis critique, élevé, modéré ou faible**. `pnpm outdated --format json` identifie 24 paquets avec une version plus récente ; ce n'est pas une preuve de vulnérabilité. Les patches candidats, par exemple Next/eslint-config-next 16.4.3 ou l'adaptateur Auth 2.11.3, peuvent être examinés dans une PR de maintenance avec lecture des changements et régressions. Aucune compatibilité non testée n'est affirmée ; les versions majeures/RC ne sont pas appliquées automatiquement. Aucune dépendance n'a été changée pendant cette étape.

## Vérifications exécutées

| Commande | Résultat réel |
|---|---|
| `pnpm prisma validate` | Schéma valide |
| `pnpm lint` | Réussi |
| `pnpm exec tsc --noEmit` | Réussi |
| `pnpm build` | Compilation, TypeScript et génération des pages réussis |
| `pnpm exec vitest run` | **563 tests réussis**, 37 fichiers ; 32 tests PostgreSQL ignorés par défaut puis tous exécutés ci-dessous |
| `pnpm test:integration` | **32 PostgreSQL + 94 HTTP/navigateur réussis**, aucun échec ni scénario ignoré |
| `pnpm test:e2e` | **24 réussis en 41,2 secondes**, trois tailles d'écran, sans retry ni scénario ignoré |
| Nettoyage E2E | Manifeste supprimé et **0 base locale `briefpilot_test_*` restante** |
| `pnpm audit --json` / `pnpm outdated --format json` | Aucun avis ; versions disponibles évaluées séparément |
| `git diff --check` | Aucun problème d'espaces |

Total : **713 exécutions de tests réussies**, avec recouvrement volontaire de scénarios entre niveaux. Les 27 tests unitaires et le scénario d'intégration ajoutés complètent les suites de l'étape 20. Les exemples PDF régénérés ont été restaurés. Logs locaux de cette session : `/tmp/briefpilot-step21-{build,unit,integration,e2e}.log` ; ils ne constituent pas une CI distante durable. Matrice détaillée : [security-test-matrix.md](security-test-matrix.md).

## Tests non exécutés, risques résiduels et limites

- Pas de connexion Google réelle, de paiement ou webhook d'une boutique distante, d'appel OpenAI facturable, ni de test des comptes Sentry/PostHog. Le callback PKCE utilise des métadonnées fictives et aucun échange réel de jetons.
- Pas de pentest externe, scan réseau de production, test de charge distribué, vérification du rôle/TLS PostgreSQL de production, restauration de sauvegarde ou contrôle des permissions OS de la cible. Les délais de lecture du handler ne couvrent pas des connexions bloquées avant ce handler : proxy, limites de connexions et en-têtes restent à valider au déploiement.
- Les plafonds PDF sont par processus. Le rate limiting d'entrée partagé et la protection des endpoints publics Auth.js/webhook doivent être configurés pour un déploiement à plusieurs instances. La CSP applicative anti-framing n'est pas une politique anti-XSS exhaustive.
- Les tests de séparation des messages ne démontrent pas une résistance sémantique exhaustive à la prompt injection. Le modèle n'a pas d'outil ni de droit applicatif ; une instruction hostile peut dégrader un document et un prompt Codex exporté doit être relu avant emploi dans un outil d'exécution.
- Les secrets volontairement saisis par un utilisateur dans l'interview/brief peuvent être transmis au fournisseur. `store:false` et les filtres heuristiques ne constituent pas une DLP exhaustive. Appliquer la minimisation des données décrite au runbook.
- Ni conformité ASVS/WCAG complète ni absence totale de défaut ne sont garanties. Ces limites sont des conditions de livraison et risques résiduels ; elles ne sont pas présentées comme des failles critiques exploitées.

## Fichiers et suite recommandée

Créés : `src/server/auth/logger.ts`, `src/server/auth/__tests__/{auth-security,auth-actions}.test.ts`, `src/server/http/read-body.ts`, `src/server/http/__tests__/read-body.test.ts`.

Modifiés : `src/auth.ts`, actions d'authentification, lecteurs HTTP JSON/webhook, provider Lemon Squeezy et tests associés, `tests/security.integration.test.mjs`, `vitest.config.ts`, `.gitignore`, README, runbook et les trois rapports de sécurité. Le mode local de `.env` est corrigé sans versionner son contenu. Les notes personnelles non suivies restent intactes.

Les correctifs de préparation issus de l'étape 20 restent documentés dans [le rapport précédent](../audits/step20-final-report.md). **Prochaine étape : 22**, intégration et validation de l'observabilité, des logs, de la rétention et des alertes. Aucun déploiement ou paiement réel n'a été effectué.
