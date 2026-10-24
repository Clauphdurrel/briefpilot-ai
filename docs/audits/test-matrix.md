# Matrice fonctionnelle

| Domaine | Preuves existantes à rejouer | Compléments |
|---|---|---|
| Auth | auth/dashboard integration | Sessions inconnues/expirées/révoquées, logout CSRF, E2E session DB |
| Projets | projects integration, quotas PostgreSQL | Création/consultation/liste/archivage E2E, accès tiers |
| Interview | unitaires, HTTP, navigateur | Envoi/rechargement/historique E2E sans API réelle |
| Brief | unitaires agents/services, HTTP/navigateur | Génération, version précédente, manque d'information |
| Backlog | unitaires graphes/agents, HTTP/navigateur | Tâches, dépendances, copie Codex |
| Exports | Markdown et PDF réels locaux | Téléchargement, MIME/nom, accès tiers, navigation hostile |
| Abonnements | PostgreSQL et faux provider Lemon | Checkout test, webhook signé, synchronisation, quotas |
| Responsive | vérifications Chrome existantes | Desktop, tablette, mobile |
| Observabilité | tests unitaires des fondations existantes | Secrets, corrélation, tokens/coûts, échecs indépendants du métier ; intégration complète et comptes externes à valider étape 22 |

## Résultats du 24 octobre 2026

Environnement : Node 24.18.0, pnpm 11.9.0, PostgreSQL local, Next 16.4.1 et Chromium Playwright. Chaque campagne d'intégration/E2E crée sa base propre et applique les migrations ; aucune base de développement n'est réinitialisée.

| Commande / groupe | Résultat réel |
|---|---|
| `pnpm prisma validate` | Schéma valide |
| `pnpm lint` | Aucune erreur ni avertissement |
| `pnpm build` | Compilation, TypeScript et génération des pages réussis |
| `pnpm exec vitest run` | 34 fichiers réussis, 536 tests réussis ; 3 fichiers/32 tests PostgreSQL ignorés par défaut, exécutés dans la campagne suivante |
| `pnpm test:integration` — PostgreSQL | 3 fichiers, 32 tests réussis : quotas atomiques, concurrence billing, historique avec pool à une connexion |
| Auth/dashboard/projets/sécurité | 33 tests réussis |
| Interview | 7 tests réussis, dont parcours Chrome |
| Briefs | 8 tests réussis, dont versions et responsive |
| Backlogs | 8 tests réussis, dont copie Codex et navigation des versions |
| Markdown | 7 tests réussis, dont téléchargements navigateur |
| PDF | 12 tests réussis : vrais PDF A4, texte/accentuation/pagination, sécurité, concurrence et navigation hostile sans quota |
| Abonnements/quotas HTTP | 7 tests réussis |
| Lemon Squeezy simulé | 11 tests réussis : checkout, signature, doublons, ordre, échec/récupération, renouvellement, annulation/reprise et expiration |
| Total HTTP/navigateur de la campagne d'intégration | **93 réussis, 0 échec, 0 ignoré** ; soit **125** avec les 32 tests PostgreSQL |
| `pnpm test:e2e` | **24 réussis, 0 échec, 0 ignoré, 0 retry**, 32,0 s : 8 parcours sur desktop 1440 px, tablette 768 px et mobile 375 px |
| Nettoyage après Playwright | Manifeste supprimé et **0 base `briefpilot_test_*` restante**, contrôle PostgreSQL en lecture seule |
| `pnpm install --frozen-lockfile --offline` | Réussi |
| `pnpm exec tsc --noEmit` | Réussi |
| `pnpm audit --json` | **0 critique, 0 élevé, 0 modéré, 0 faible** |

Total des exécutions de tests réussies : **685** (536 unitaires + 32 PostgreSQL + 93 HTTP/navigateur + 24 Playwright), avec chevauchement volontaire de certains scénarios entre les suites. Les 32 tests ignorés par défaut dans la commande unitaire ont tous été exécutés et réussis dans la campagne PostgreSQL. Les extraits de logs de cette session résident sous `/tmp/briefpilot-step20-{build,unit,integration,e2e}.log` ; ils ne sont pas une CI distante pérenne.

## Limites conservées

Google OAuth externe, OpenAI réel, boutique Lemon Squeezy réelle/test distante, Sentry/PostHog, déploiement Vercel, restauration de sauvegarde et alertes de production non testés. L'authentification navigateur utilise des sessions PostgreSQL réelles de comptes fictifs sans bypass applicatif. Les paiements et réponses IA proviennent de fournisseurs locaux simulés ; Chromium et les fichiers PDF sont réels. Vérifications responsive et d'accessibilité de base, sans audit WCAG exhaustif ni lecteur d'écran réel. Les PDF régénérés par les tests sont restaurés à leur état versionné après la campagne.
