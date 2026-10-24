# Matrice des tests de sécurité — étape 21

Campagne du **24 octobre 2026**, base `b409221` puis correctifs de la branche `security/preproduction-hardening`. « Testé » signifie exécuté avec succès dans cette campagne ; les limites ci-dessous restent applicables.

| Risque / acteur | Test exécuté | Preuve principale |
|---|---|---|
| Anonyme, session inconnue/expirée/révoquée | Accès privé refusé, révocation effective | `tests/security.integration.test.mjs`, suites auth/dashboard |
| Cookie volé par script / transport HTTP | HTTPS réel du handler : cookies de session, CSRF et callback HttpOnly/Secure/Lax | `src/server/auth/__tests__/auth-security.test.ts` ; pas de proxy HTTPS externe |
| Redirection hors origine | Callback externe non conservé | `auth-security.test.ts` |
| Callback OAuth sans preuve PKCE | Refus avant échange de jetons et création de session | `auth-security.test.ts`, métadonnées fournisseur simulées, aucun réseau externe |
| CSRF / Server Action externe | Création et déconnexion illégitimes refusées ; session légitime supprimée | `security.integration.test.mjs` |
| Compte A vers projet/document B | 404, aucun contenu privé | Suites projets/briefs/backlogs/exports |
| A Pro historique illimité vers B Free | B lit ses briefs/backlogs ; A refusé sur les deux documents et cinq chemins d'exports, aucun quota consommé | Nouveau scénario `premium unlimited history...`, intégration avec PostgreSQL réel |
| Gestion d'abonnement tiers | Identifiant client arbitraire refusé | Tests billing routes/PostgreSQL/HTTP |
| Dernière unité concurrente | Aucun dépassement de quota, débit atomique | Tests PostgreSQL et HTTP abonnements |
| Replays/alias de génération | Pas de nouvel appel pour clé connue, créations d'alias bornées | Tests services et intégrations interview/brief/backlog |
| JSON malformé / suffixe MIME trompeur | 400/415 ; rejet MIME avant lecture/service coûteux | `read-body.test.ts`, tests routes interview |
| Corps chunké et Content-Length falsifié | 413 sur octets réellement lus, annulation du flux | `read-body.test.ts` |
| Flux JSON/webhook qui ne termine pas | Annulation à 10 s, réponse 408, pas d'attente sur cancel bloqué | `read-body.test.ts`, horloge contrôlée ; pas de slowloris réseau réel |
| Réponse fournisseur excessive | Annulation avant concaténation, erreur publique 503 | `lemonsqueezy.test.ts` avec transport simulé |
| Signature webhook / octets bruts | Mauvaise signature/body altéré refusés, Unicode/espaces préservés | Tests webhook et `read-body.test.ts` |
| Webhook répété/ancien/concurrent | Pas d'activation arbitraire, état distant courant, idempotence | Billing PostgreSQL et HTTP |
| URL de retour payant | FREE avant confirmation, aucun droit à partir d'un paramètre | Tests billing HTTP et E2E |
| Injection HTML / ressource PDF externe ou fichier | Texte échappé, aucune ressource réseau/fichier chargée, sandbox conservée | Unitaires templates/renderer, 12 intégrations PDF réelles |
| Navigation PDF hostile | 403 sur les trois routes, aucun débit de quota | Tests routes et intégration PDF |
| Prompt injection | Séparation système/données, absence d'outils, sorties non fiables validées | Unitaires des trois agents ; pas de garantie de résistance sémantique |
| Fuites dans logs Auth.js | Cause/message/jeton/adresse synthétiques absents, codes fixes présents | Handler réel et faux adaptateur dans `auth-security.test.ts` |
| Erreur Auth.js remontée par Server Action | Message fixe, causes non propagées à Next ; navigation préservée | `auth-actions.test.ts` |
| Logs/Sentry métier | Listes autorisées et absence de contenus clients | Tests unitaires d'observabilité existants |
| Environnement et Git | Mode 0600, variantes .env ignorées, exemple conservé, scan historique par motifs | `stat`, `git check-ignore`, `git ls-files`, analyse locale de 437 blobs texte |
| Dépendances | Aucun avis signalé ; obsolescence analysée séparément | `pnpm audit --json`, `pnpm outdated --format json` |

## Résultats globaux exécutés

- Prisma, lint, TypeScript et build réussis.
- Vitest : **563 réussis**, 37 fichiers ; les 32 tests PostgreSQL ignorés par défaut sont rejoués dans la commande suivante.
- Campagne d'intégration isolée : **32 PostgreSQL + 94 HTTP/navigateur réussis**, dont 9 scénarios du fichier de sécurité ; aucun test ignoré.
- Playwright : **24 réussis en 41,2 s**, desktop/tablette/mobile, aucun retry ou scénario ignoré.
- Total : **713 exécutions réussies** ; certains scénarios sont testés à plusieurs niveaux.
- Manifeste E2E supprimé, zéro base de test restante. Les PDF d'exemple régénérés ont été restaurés.

27 tests unitaires et un scénario HTTP de sécurité ont été ajoutés. Les services externes sont simulés ; les sessions, transactions PostgreSQL, navigateur et rendus PDF sont réels. Google réel, fournisseur IA réel, boutique distante, infrastructure de production, charge distribuée et restauration non testés. Voir [le rapport](security-audit.md) pour les constats et limites.
