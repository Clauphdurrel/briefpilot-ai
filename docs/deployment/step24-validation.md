# Étape 24 — infrastructure préparée et validée localement

Validation le 25 octobre 2026, branche chore/production-infrastructure. Aucun déploiement cloud, abonnement payant ou changement de production n'a été effectué.

## Résultats

- Build ciblant Vercel réussi avec Prisma généré, Node.js applicatif 24.18.0, routes Node existantes et délais 60 s conservés.
- 38 manifests de traçage Next.js contrôlés : aucune référence Playwright/playwright-core dans l'artefact Vercel.
- 616 tests unitaires réussis (dont 16 nouveaux tests du client worker), 38 tests PostgreSQL et 95 HTTP/navigateur réussis sur base jetable ; 27 E2E desktop/tablette/mobile réussis.
- 7 tests HTTP du worker : santé minimale, auth, signature, TTL, rejeu, validation stricte, erreurs et limites.
- Docker réellement construit et exécuté : PDF valide avec accents, scripts inertes, pas de contenu de fichier local, secret absent de l'image/logs, utilisateur non-root, rootfs read-only, refus des rejeux, limite par owner et arrêt SIGTERM propre.
- Sandbox Chromium active, toutes les capabilities du conteneur retirées. Le seul ajustement de profil seccomp au profil Playwright est l'autorisation chroot requise dans son user namespace interne. Aucun --no-sandbox ni privileged n'est ajouté.
- Image officielle linux/amd64 Playwright 1.64.1 verrouillée par digest ; Node de l'image constaté 24.22.1. Les autres architectures ne sont pas validées.
- ESLint, TypeScript, vérification syntaxique Node et actionlint réussis. Les exemples PDF écrits par les intégrations ont été restaurés.

Les commandes exécutées incluent Prisma validate/generate, Vitest, lint, build Next.js avec VERCEL=1, test-integration.mjs, Playwright, les tests HTTP du worker et le script Docker. Les fournisseurs IA/paiement/analytics sont simulés ou désactivés ; aucun crédit OpenAI ni paiement réel n'est consommé. Les sorties locales sont sous /tmp/briefpilot-step24-* ; un job CI pdf-worker reproduit les contrats et le test Docker.

## Revue et limites

Le rendu local conserve les protections et les templates existants. Le mode distant impose une URL HTTPS en staging/production/Vercel, refuse les redirections et ne retombe pas sur Chromium local. Les PDF dépassant 4 Mio sont refusés avant commit de quota sur Vercel ; la limite reste 8 Mio en local/worker. Les autres règles métier ne sont pas modifiées.

Le cache anti-rejeu et les slots sont locaux à un processus. Un redémarrage efface les nonces ; une topologie multi-instance ou une garantie durable exigera un stockage partagé. Une seule instance staging est prévue à ce stade. Le worker n'a pas de stockage documentaire ni d'accès base de données.

Restent à fournir/vérifier : comptes Neon/Vercel, choix d'un hébergeur worker qui conserve sandbox/seccomp/namespaces, URLs HTTPS, secrets staging et configuration OAuth/webhook/monitoring. Les régions, quotas, sauvegardes et budgets du compte réel ne sont pas vérifiés. L'étape 25 doit établir Neon staging ; l'étape 26 exige une application réellement accessible et des tests en ligne avant toute déclaration de succès.
