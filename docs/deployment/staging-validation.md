# Audit du staging — étape 26

État au 25 octobre 2026 : **préparation et audit locaux ; aucun déploiement Vercel accessible n'est confirmé. L'étape 26 n'est pas terminée.**

| Contrôle | Preuve / état |
| --- | --- |
| Infrastructure étape 24 | PR #4 ; les 6 jobs GitHub du run 40197078131 réussissent, y compris le vrai worker Docker |
| Neon staging | Connexions poolée/directe vérifiées, TLS client/certificat autorisés, 6 migrations appliquées après consentement, 16 tables et historique up-to-date |
| Prisma Client réel | 1 test opt-in réussi sur Neon, transaction READ ONLY, SELECT 1 et lectures de modèles ; aucun seed ni mutation de test |
| Séparation des secrets | Fichier staging ignoré/protégé 600, secrets locaux staging distincts générés sans affichage ; aucun secret ajouté au dépôt |
| CLI Vercel | Version 65.2.0 ; compte duramite32-3695 vérifié, équipe Hobby duramite32-3695s-projects |
| Projet Vercel/Preview | Projets briefpilot-ai (Next.js) et briefpilot-pdf-worker-staging (container) créés, région lhr1 ; app liée au dépôt ; déploiements Git automatiques désactivés, zéro déploiement |
| Worker local | Docker réel validé : PDF avec accents, sandbox active, non-root, rootfs read-only, auth/signature/rejeu, limites et arrêt propre |
| Worker distant HTTPS | Paquet Vercel Docker isolé construit/testé localement avec sandbox ; aucun déploiement distant, URL et sandbox cloud non vérifiées |
| Google OAuth staging | Identifiants et callback stable non configurés/vérifiés ; login en ligne non testé |
| OpenAI staging | Clé/modèle staging non fournis ; aucun appel réel exécuté pendant cet audit |
| Lemon Squeezy staging | Mode test préparé ; API/variantes/webhook et paiement de test distant non vérifiés ; aucun paiement réel |
| Sentry/PostHog staging | Projets/destinataires et réception d'événements distants non vérifiés ; collecte non activée par défaut |
| Santé HTTPS et BOLA en ligne | Non exécutés, faute de déploiement et de comptes staging connectés |

## Blocages réels

1. Les PR préparatoires restent ouvertes ; develop ne contient pas encore ces changements. Aucun déploiement n’est lancé automatiquement.
2. Worker Vercel préparé, mais URL HTTPS, sandbox réelle, protection Preview pour les appels serveur et limites entre instances restent à valider après intervention explicite. Un conteneur local ne peut pas être appelé depuis Vercel via localhost.
3. Variables fournisseurs staging et origine OAuth stable manquantes dans le fichier privé/Preview develop. Les secrets de développement ne sont pas copiés automatiquement vers un service externe.
4. Aucun parcours utilisateur en ligne vérifié. La validation finale doit distinguer les opérations statiques, probes synthétiques et vrais appels fournisseurs autorisés.

## Validation et reprise

Les vérifications locales du préflight vérifient branche, liaison, clés, HTTPS et paiement test sans déploiement ; les flags explicites ajoutent uniquement des lectures DB, un probe PDF synthétique et un health HTTP. Les tests unitaires du préflight couvrent ces gardes. Le rapport final sera enrichi avec le SHA, l'URL Ready, les résultats authentifiés et les limites réelles du compte après intervention de l'opérateur.

Compte Hobby et région lhr1 vérifiés. Protection Preview conservée (all_except_custom_domains). Budget/usage commercial, accès serveur au worker et sauvegardes restent à confirmer. Aucun feu vert production : cette livraison reste dédiée au staging. Voir [vercel-staging.md](vercel-staging.md) pour la procédure complète, les commandes et les erreurs fréquentes.

## Configuration distante autorisée

Après autorisation explicite de l’opérateur, DATABASE_URL poolée, AUTH_SECRET, PDF_WORKER_SECRET et ANALYTICS_HMAC_SECRET ont été créés comme variables sensibles non lisibles dans briefpilot-ai, uniquement Preview/develop. DIRECT_URL n’a pas été envoyé. PDF_WORKER_SECRET a été créé séparément dans le projet worker, uniquement Preview. Les métadonnées de portée ont été relues ; aucune valeur n’a été affichée. Les paramètres non secrets imposent staging, rendu worker, paiement test et observabilité désactivée.

Les deux projets ont zéro déploiement. Aucun abonnement, build cloud, publication d’image ou déploiement n’est lancé. Hobby n’empêche pas techniquement les fonctions Docker ; sa politique d’usage commercial doit être examinée avant le lancement payant.

## Validation locale du paquet Preview

638 tests unitaires passent ; 38 tests PostgreSQL et 1 test Neon sont exclus de ce run par conception. Lint et TypeScript passent. Le conteneur issu du paquet Vercel produit réellement un PDF avec accents, sous utilisateur non-root et sandbox active dans Docker local, et refuse les requêtes non authentifiées/rejouées. Les nouvelles protections couvrent le délai de rendu Vercel et les limites de corps/réponse. Les garanties de sandbox, de concurrence et de rejeu dans un environnement cloud autoscalé restent distinctes : voir pdf-worker.md.

Dernière reprise : l’opérateur indique avoir créé/configuré le client Google OAuth ; AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET et AUTH_URL restent absents du fichier privé lors du contrôle. Leur création dans Google Cloud ne les synchronise pas avec le projet. La vérification Neon en lecture seule passe toujours ; aucun appel Google/OpenAI/paiement n’a été exécuté.

Build final en mode VERCEL=1 et APP_ENV=staging réussi avec configuration exclusivement fictive, sans connexion fournisseur. Les 36 manifests de traçage ne contiennent aucun fichier des packages navigateur Playwright ni le moteur PDF local ; le nom d’un peer Playwright dans le chemin pnpm de Next ne désigne pas le package embarqué. Vérification de 33 fichiers statiques : aucune correspondance avec les secrets serveur du fichier staging. Les 7 contrats HTTP et le test Docker du paquet Vercel passent. actionlint et git diff --check passent également.
