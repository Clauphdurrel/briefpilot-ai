# Remédiations de sécurité — étape 21

Date : **24 octobre 2026**. Rapport initial enregistré avant les correctifs ; six missions en lecture seule. Priorité : vulnérabilités confirmées, puis protections préventives ciblées. Aucun refactor massif, migration destructive, accès production ou désactivation d'un contrôle pour faire passer les tests.

| Ordre / ID | Classification initiale | Correction / fichiers | Preuve finale | État |
|---|---|---|---|---|
| 1 AUTH-LOG-21 | MEDIUM confirmé | Logger Auth.js complet à codes fixes (`src/server/auth/logger.ts`, `src/auth.ts`) et erreurs des actions remplacées par redirection fixe | Tests du handler réel avec faux adaptateur, trois niveaux de logs, cause/jeton/adresse fictifs absents ; contrôle des actions et navigation | corrigé |
| 2 ENV-MODE-21 | LOW préventif local | `.env` passé de 0664 à 0600, README/runbook actualisés | `stat` sans lecture des valeurs | corrigé localement ; vérifier sur la cible |
| 3 ENV-GIT-21 | LOW préventif | `.env.*` ignoré, exception `.env.example` | `git check-ignore` et fichiers versionnés contrôlés | corrigé |
| 4 API-MIME-21 | LOW préventif | Type média JSON exact, charset accepté | Tests suffixes refusés avant lecture et service IA | corrigé |
| 5 BILLING-BODY-21 | LOW préventif conditionnel | Limite 512 000 octets pendant lecture du flux, pas après `response.text()` | Transport simulé multi-chunks annulé, erreur 503 assainie | corrigé |
| 6 API-TIME-21 | INFORMATIONAL, risque runtime | Lecture JSON/webhook/fournisseur bornée à 10 s via `readBodyBytes`, limites d'octets conservées | Flux non terminé/annulation bloquée, faux Content-Length, bytes webhook exacts, libération du reader | traité dans les lecteurs applicatifs |

La preuve préventive complémentaire d'isolation A Pro/B Free passe sur briefs, backlogs et exports, sans réservation de quota. Les unitaires, tests PostgreSQL, intégrations et 24 E2E passent. Aucun constat initial CRITICAL/HIGH/MEDIUM/LOW restant ouvert dans ce périmètre.

## Contrôles hérités de l'étape 20

| ID historique | Protection conservée | Vérification rejouée |
|---|---|---|
| DEP-01 | Versions et overrides corrigés | Audit sans avis, build et tests |
| OPS-01 | PostgreSQL loopback, mot de passe injecté, volume conservé | Revue Compose ; aucun changement de volume |
| SEC-01 | Origine/Fetch Metadata des PDF | Tests routes et refus HTTP sans quota |
| DB-01 | Alias de réutilisation limités, replays conservés | Tests services et campagne fonctionnelle |
| WEB-01 | En-têtes défensifs | Tests HTTP public/privé |
| DB-02 | TransactionClient pour l'historique | PostgreSQL avec pool à une connexion |

## Conditions restant à vérifier avant production

1. Proxy/hébergeur : délais avant handler, connexions/en-têtes, limite des Server Actions, rate limiting partagé et protection des endpoints Auth.js/webhook. Les délais de lecture applicatifs ne remplacent pas ces contrôles.
2. Rôle PostgreSQL de production à privilèges limités, TLS, permissions OS, sauvegarde et restauration, Chromium avec sandbox sur la cible.
3. Parcours réels Google/OpenAI autorisés et boutique Lemon Squeezy en mode test ; aucune réponse simulée ne prouve leur configuration.
4. Étape 22 : validation des comptes de monitoring, corrélation, rétention/purge et alertes. Les données personnelles saisies volontairement et la prompt injection sémantique restent des risques à gérer par minimisation et revue humaine.
5. Maintenance : examiner les versions plus récentes dans des PR ciblées. Ne pas confondre `outdated` avec un avis de vulnérabilité ; ne pas appliquer automatiquement des mises à jour majeures/RC.

**Décision : passage à l'étape 22 autorisé au vu des preuves locales ; lancement commercial non validé par cet audit seul.**
