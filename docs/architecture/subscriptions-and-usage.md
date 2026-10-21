# Abonnements et quotas du MVP

## Plans et accès

`src/config/plans.ts` centralise les tarifs indicatifs, capacités et fonctionnalités de FREE, PRO, AGENCY et ENTERPRISE. `null` signifie explicitement sans limite de plan ; zéro signifie aucune unité autorisée. Les plafonds de sécurité techniques existants restent applicables.

Sans abonnement éligible, le compte utilise FREE. Aucun abonnement payant ni paiement n’est créé par Auth.js, une page ou une API du MVP. La table Subscription contient au plus une ligne par utilisateur. L’accès payant exige une ligne serveur ACTIVE ou TRIALING, une période valide, un fournisseur STRIPE et une référence fournisseur. Ces champs seront alimentés exclusivement par une intégration fournisseur vérifiée à l’étape 19. Une référence seule ne constitue pas une preuve de paiement : les droits reposent sur la confiance dans la base serveur et ses futurs webhooks, jamais sur une valeur navigateur.

PAST_DUE, CANCELED, EXPIRED, une période expirée/future ou une configuration non éligible donnent immédiatement FREE. Aucune suppression de projet, version ou événement n’accompagne une rétrogradation. Un compte au-dessus de sa nouvelle capacité conserve ses projets ; il doit en archiver avant de créer/réactiver. Une annulation en fin de période devra être représentée par ACTIVE jusqu’à l’échéance, puis CANCELED par le futur fournisseur.

Enterprise accepte `limitOverrides` (JSON strict validé) pour les cinq ressources : entiers de 0 à 1 000 000 ou null. Cette configuration est uniquement administrée côté serveur ; aucune route publique de modification n’existe. Une configuration invalide produit une erreur technique et ne donne pas un quota illimité.

Les fonctions de collaboration, de support opérationnel et de personnalisation avancée sont annoncées comme futures. Les métadonnées du plan ne les implémentent pas. Aucun paiement Stripe ni activation fictive n’est présent.

## Unités et périodes

- AI_INTERVIEW : une réponse IA envoyée au fournisseur, première question comprise. Le texte utilisateur seul et les lectures d’historique ne consomment rien.
- AI_BRIEF et AI_BACKLOG : un appel réel, régénération comprise. La réutilisation d’un résultat enregistré ne débite pas une nouvelle unité.
- PDF_EXPORT : un PDF rendu avec succès. FREE dispose de 3 PDF par mois ; les autres plans n’ont pas de plafond mensuel commercial. Un nouveau clic de téléchargement constitue un nouveau rendu PDF. Le menu envoie une clé UUID `Idempotency-Key` : une répétition de transport avec cette même clé est refusée en 409 avant rendu/débit supplémentaire. Les clients API qui réessaient une requête doivent conserver cette clé ; sans clé, chaque requête explicite constitue un nouveau rendu. Aucun PDF privé n’est mis en cache partagé. Un rendu échoué libère sa réservation. Aucun export ne consomme d’unité IA.
- ACTIVE_PROJECTS : capacité calculée en base sur les statuts autres que ARCHIVED, sans compteur mensuel ni remise à zéro.

FREE utilise les mois calendaires UTC `[début inclus, fin exclue)`. Les bornes sont déterminées par le serveur et stockées dans UsageCounter. Un abonnement éligible utilise ses bornes fournisseur enregistrées. Les événements sont datés explicitement au moment de la réservation pour correspondre à la période choisie, même à une frontière de mois.

Les totaux consultent les événements datés dans la fenêtre active, indépendamment du compteur auquel ils sont rattachés. Ainsi, un changement de période ou une rétrogradation ne fait pas disparaître les consommations qui appartiennent encore au mois courant. Une nouvelle période ne supprime pas l’historique ; les anciens événements sont simplement exclus. Le module démarre son suivi à son installation : les appels historiques antérieurs ne sont pas inventés ni reconstitués à partir d’approximations.

## Transactions, idempotence et reprise

`reserveUsage` prend un verrou transactionnel PostgreSQL par propriétaire (`billing:<userId>`), récupère les réservations expirées, détermine le plan puis contrôle `used + reserved < limit`. La création de l’événement et l’incrément du compteur sont atomiques. La contrainte unique `(userId, resource, operationId)` empêche un deuxième événement pour la même tentative. Les fonctions `canPerformAction` et `getRemainingQuota` servent uniquement à l’affichage/prévision ; elles ne remplacent jamais la réservation atomique.

Les orchestrateurs existants conservent leurs verrous/idempotence et leurs résultats en cache. La réservation commerciale est ajoutée à leur transaction de claim, après validation de propriété et de contexte. L’identifiant d’opération combine le ledger et le numéro de tentative serveur. Une répétition réseau d’une opération terminée rend le résultat déjà enregistré ; une nouvelle tentative après échec fournisseur représente un nouvel appel et une nouvelle unité.

L’ordre des verrous est toujours orchestration `interview:<userId>`, puis quota `billing:<userId>`. Les transactions de quotas/projets ne prennent jamais le verrou d’orchestration. Aucun verrou ni transaction de base n’est gardé pendant un appel OpenAI ou un rendu Chromium.

`runMetered` transmet la réservation via AsyncLocalStorage. Le client SDK enveloppe uniquement `responses.parse` lorsqu’il existe un contexte de quota. La transition RESERVED → STARTED est confirmée avant dispatch. La configuration et les arguments sont évalués avant cette transition ; leurs erreurs libèrent RESERVED. La consommation est confirmée après l’appel SDK, succès ou échec. Les agents eux-mêmes restent indépendants de la facturation. Ce point unique devra aussi envelopper tout futur nouveau mode d’appel SDK : un agent appelé directement hors orchestrateur n’est pas une API autorisée pour les utilisateurs.

États :

1. RESERVED : quota immobilisé, bail de 120 secondes.
2. STARTED : envoi autorisé ; issue potentiellement facturable.
3. COMMITTED : une unité consommée, confirmation idempotente.
4. RELEASED : réservation annulée, libération idempotente.

Les erreurs du fournisseur (timeout, réseau, refus, format invalide, quota de la clé serveur) comptent dès que l’envoi est possible. Elles gardent leur code technique d’origine et ne deviennent pas de faux QUOTA_EXCEEDED. Une erreur de persistance après l’appel compte également. Le MVP adopte une politique conservatrice : une interruption entre STARTED et le dispatch peut immobiliser une unité alors que l’envoi n’est pas certain ; elle empêche de profiter d’une issue inconnue pour dépasser les quotas. Ce quota mesure les tentatives applicatives, pas la facture du fournisseur.

À la prochaine consultation ou réservation du propriétaire, les baux expirés sont récupérés : RESERVED est libéré ; STARTED IA devient COMMITTED ; STARTED PDF est libéré. La reprise est paresseuse, sans cron obligatoire. Un bail expiré ne peut pas être démarré. Les bornes (SDK 45 s sans retry automatique, PDF 35 s, claims 90 s) sont inférieures au bail de quota. Les compteurs sont mis à jour sous le même verrou à chaque transition ; aucune double libération ni décrément négatif ne découle d’une répétition.

## Projets, versions et exports

Création et réactivation prennent le même verrou de capacité avant comptage/écriture. ARCHIVED est exclu ; aucune autre mutation existante ne réactive implicitement un projet archivé. L’interface permet d’archiver et de réactiver via une action serveur authentifiée et validée. La réactivation revient à DRAFT ; les documents et messages sont conservés.

FREE peut consulter les deux dernières versions de chaque type de document par projet. Listes et lectures directes contrôlent cette limite côté serveur ; Markdown et PDF passent par les mêmes contrôles, y compris une URL saisie à la main. Le brief source d’un backlog courant peut être chargé en interne pour valider les références, sans ouvrir un endpoint de lecture d’ancien brief. Le dossier projet contenant un ancien brief reste soumis au droit d’accès à cette version.

## Interfaces et erreurs

`GET /api/billing/usage` répond uniquement pour le propriétaire de la session et ignore toute identité/plan fourni dans l’URL. Aucune méthode de mutation ni d’upgrade n’est exposée. La réponse privée exclut les références fournisseur et la configuration interne.

`/dashboard/settings/subscription` présente plan effectif, statut, périodes UTC, consommations, réservations, limites et quantités restantes. Les zéros sont des valeurs réelles ; les plans illimités n’affichent pas de barre de progression. Chargement et erreur ont des composants dédiés.

`/pricing` affiche Free 0 €, Pro 19 €, Agency 59 €, Enterprise sur devis. Ces prix sont des hypothèses commerciales. Les boutons payants sont désactivés avec la mention de disponibilité future ; aucun checkout factice ni modification d’abonnement.

Les refus commerciaux exposent seulement code QUOTA_EXCEEDED, resource, limit, used, reserved et un lien `/pricing`. Les erreurs techniques restent distinctes. Les formulaires/générations/exports proposent une consultation des offres.

## Migration et vérifications

Migration additive : `20261021100032_add_subscriptions_and_usage`, déjà créée et appliquée localement. Ne pas la régénérer ni réexécuter `migrate dev` si elle est appliquée. Pour les autres environnements, appliquer les migrations versionnées avec `pnpm prisma migrate deploy`, puis générer le client.

```sh
pnpm prisma validate
pnpm prisma generate
pnpm exec vitest run
BILLING_INTEGRATION=1 pnpm exec vitest run src/server/services/__tests__/usage.postgres.test.ts
pnpm lint
pnpm build
node --test tests/subscriptions.integration.test.mjs
```

Les tests PostgreSQL créent/suppriment leurs comptes et vérifient concurrence, reprise, échéances, rétrogradation, capacité et idempotence. Les intégrations HTTP lancent Next local sur 3161 et un faux serveur OpenAI sur 3162 ; aucune clé réelle ni crédit n’est utilisé. Les suites antérieures qui testent les générations ou les rendus nombreux disposent maintenant d’une souscription TRIALING explicitement fictive insérée uniquement par leur fixture SQL, supprimée avec leur utilisateur. Les tests commerciaux restent sur de vrais comptes FREE sans abonnement.

Test manuel : connexion Google, ouvrir le dashboard abonnement (tous compteurs nouveaux à zéro), créer deux projets, constater le refus du troisième, archiver/réactiver, consulter les offres sans activation. Privilégier les intégrations simulées pour épuiser les quotas IA. Les PDF FREE sont limités à trois rendus réussis dans la période.

Référence des verrous : [PostgreSQL — Advisory Locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS). Le projet reste sur Prisma 7 avec son API locale `$transaction`, sans migration de version de l’ORM.
