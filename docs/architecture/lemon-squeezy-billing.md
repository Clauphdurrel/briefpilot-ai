# Lemon Squeezy — facturation en mode test

## État livré et limites

L’intégration comprend un provider HTTP officiel, le checkout Pro/Agency, les webhooks signés, la synchronisation transactionnelle des abonnements, le portail client, l’annulation/reprise et la page de retour. Aucun paiement réel, compte marchand, tunnel public ou déploiement n’a été créé automatiquement.

La boutique n’est pas encore configurée : l’utilisateur a demandé de préparer le code et les tests simulés. Les parcours sont vérifiés avec une API locale simulant les contrats Lemon Squeezy, PostgreSQL et Chromium. Leur validation contre une vraie boutique en mode test reste à réaliser après renseignement des variables. L’éligibilité et l’approbation de la boutique restent des démarches du titulaire du compte. Le Sénégal figure dans la [liste officielle des pays de versement bancaire pris en charge](https://docs.lemonsqueezy.com/help/getting-started/supported-countries).

Le code exige littéralement `LEMONSQUEEZY_TEST_MODE=true`, même avec un build Next de production. `false`, une valeur absente ou une configuration incomplète empêchent le checkout et le traitement des webhooks. Aucun simple changement de variable ne permet de démarrer une facturation réelle.

## Configuration de la boutique

Créer un compte et une boutique avec les informations réelles du titulaire. Utiliser le mode test de Lemon Squeezy. Préparer des variantes fixes **mensuelles**, intervalle 1 mois, sans prix libre : Pro 19 EUR et Agency 59 EUR. La devise de la boutique doit être EUR. Pour permettre un changement d’offre dans le portail, configurer les variantes et options de changement selon les possibilités Lemon Squeezy ; l’application n’effectue aucune mutation arbitraire de prix ou de variant.

Le prix attendu provient de `src/config/plans.ts`, également utilisé par Pricing. Avant le checkout, le serveur vérifie la devise, le prix, l’intervalle mensuel, le mode test et l’appartenance produit/boutique via l’API. Configurer des variantes simples avec quantité 1 et les options du portail adaptées au SaaS. Les anciens/custom domaines de checkout ne sont pas autorisés par ce MVP : utiliser le domaine standard `*.lemonsqueezy.com`.

Renseigner **localement**, sans committer ni partager les valeurs :

```env
LEMONSQUEEZY_API_KEY=""
LEMONSQUEEZY_STORE_ID=""
LEMONSQUEEZY_WEBHOOK_SECRET=""
LEMONSQUEEZY_PRO_VARIANT_ID=""
LEMONSQUEEZY_AGENCY_VARIANT_ID=""
LEMONSQUEEZY_TEST_MODE="true"
```

Le secret du webhook doit comporter au moins 16 caractères aléatoires. `AUTH_URL` désigne l’origine publique de l’application ; HTTPS est requis hors localhost/127.0.0.1. Les deux variants doivent être distincts et leurs identifiants numériques compatibles avec un entier sûr JavaScript. Les valeurs manquantes produisent BILLING_NOT_CONFIGURED ; aucune fausse URL de checkout n’est retournée.

Redémarrer l’application après modification de l’environnement. `/pricing` est dynamique et reçoit seulement un indicateur de disponibilité ; aucune clé ni référence privée de fournisseur n’est envoyée au navigateur.

## Architecture et endpoints

`BillingProvider` définit createCheckout, getSubscription, cancelSubscription, resumeSubscription et getCustomerPortalUrl. Seul LemonSqueezyProvider est implémenté ; aucune fausse implémentation Stripe/Paddle. Les services acceptent une dépendance de provider pour les tests et une évolution future. Les appels utilisent une origine fixe `https://api.lemonsqueezy.com/v1`, des IDs validés, aucun redirect HTTP, des délais bornés et des erreurs publiques assainies. Les relations/URLs fournies dans un webhook ne sont jamais suivies.

- `POST /api/billing/checkout` : session Auth.js, origine autorisée, JSON strict `{ "plan": "PRO" | "AGENCY" }`. Prix, userId, variantId ou redirect fournis par le client sont refusés.
- `GET /api/billing/subscription` : plan effectif, statut et métadonnées publiques du compte connecté. Les paramètres d’URL ne changent aucun droit.
- `POST /api/billing/subscription` : JSON strict `{ "action": "cancel" | "resume" | "portal" }`. La référence distante vient exclusivement du compte de la session, jamais du navigateur. Mode et boutique distants sont vérifiés avant modification.
- `POST /api/webhooks/lemonsqueezy` : corps brut borné à 256 Ko, signature `X-Signature` HMAC-SHA256, comparaison constante et JSON Zod après vérification. Le header X-Event-Name doit correspondre au payload s’il est fourni.

Les réponses utilisateur sont privées/no-store. Les erreurs n’exposent aucune clé, signature, adresse client, URL interne ou détail brut du fournisseur. Aucune donnée bancaire n’est enregistrée. Les URLs signées du portail sont obtenues à la demande, validées puis retournées au seul utilisateur propriétaire.

## Checkout et association sûre au compte

Une intention de checkout liée au userId est créée sous le même verrou PostgreSQL propriétaire que les quotas. Elle possède un token aléatoire de 256 bits dont seul le hash est conservé en base. Le checkout reçoit `user_id`, `checkout_intent_id` et `checkout_token` via custom_data, ainsi qu’un variant unique autorisé et une expiration de 30 minutes.

Une intention READY est réutilisée pour le même plan, sans nouvel appel de création ; une intention PENDING ou d’un autre plan empêche un deuxième checkout. Une erreur de configuration de variant permet de corriger puis de réessayer ; une erreur réseau laisse l’intention en attente jusqu’à expiration, car une requête distante ayant expiré peut malgré tout avoir créé un lien payable. Cette politique évite de multiplier les liens en cas d’issue inconnue.

Le checkout ne crée ni abonnement local ni droit premium. Au premier webhook, la signature seule et le simple user_id ne suffisent pas : le token doit correspondre à l’intention serveur et au propriétaire. La date de création distante doit correspondre à la fenêtre de l’intention (avec tolérance d’horloge/délai). L’intention est ensuite liée de manière unique à l’abonnement distant, et l’URL du checkout est retirée de cette intention.

Une souscription existante ou une période encore valable bloque un nouvel achat : utiliser le portail ou reprendre le renouvellement. Une seconde souscription distante inattendue ne remplace pas silencieusement une souscription encore valable ; elle est journalisée comme ignorée et nécessite une vérification manuelle de la boutique. La création locale est protégée contre la concurrence ; le fournisseur reste l’autorité sur ses transactions externes.

## Webhooks, ordre et reprise

Événements à configurer :

- subscription_created, subscription_updated
- subscription_cancelled, subscription_resumed, subscription_expired
- subscription_payment_success, subscription_payment_failed, subscription_payment_recovered
- subscription_paused, subscription_unpaused

Les événements payment transportent un objet `subscription-invoices` avec subscription_id ; les autres transportent `subscriptions`. Le payload doit être en mode test. Chaque événement pertinent relit **l’état actuel** de l’abonnement via l’API officielle avec vérification de l’identifiant, du mode et de la boutique. Un événement ancien ne peut donc pas restaurer un ancien plan simplement parce qu’il arrive en retard.

Le hash SHA256 des octets bruts sert de clé d’idempotence. Les doublons déjà traités ne déclenchent pas de nouvel appel API. Les événements sémantiquement équivalents avec des octets différents restent sûrs : sous le verrou billing propriétaire, la révision updated_at distante est comparée sans perdre ses microsecondes. La ligne Subscription et le journal BillingWebhookEvent sont écrits atomiquement. Aucune transaction PostgreSQL n’est gardée ouverte pendant un appel réseau.

Le journal minimal contient hash, nom d’événement, référence d’abonnement, résultat et date, sans payload, token ni donnée de carte. En cas d’échec réseau ou de base, aucun événement n’est marqué comme traité : la réponse d’erreur permet une nouvelle livraison. Lemon Squeezy prévoit un nombre borné de retries ; si ces tentatives sont épuisées, renvoyer le webhook depuis le dashboard du prestataire après correction. Surveiller les erreurs HTTP et les résultats ignored_other_subscription ; ne pas considérer un HTTP 200 avec un événement ignoré comme une preuve d’activation.

## Statuts, périodes et quotas

- active → ACTIVE ; on_trial → TRIALING. L’accès exige une période actuelle valide et une synchronisation fournisseur vérifiée.
- cancelled → CANCELED, cancelAtPeriodEnd=true. Les droits continuent jusqu’à ends_at ; une date passée donne FREE même si le webhook d’expiration est retardé.
- expired → EXPIRED, sans premium.
- past_due, unpaid, paused → PAST_DUE, accès FREE selon la politique prudente du MVP.
- un variant non autorisé sur un abonnement déjà lié retire les droits premium au lieu d’inventer un plan. Une nouvelle association pour un variant non autorisé est refusée.

L’annulation et la reprise utilisent les capacités réelles de l’API et ne sont annoncées comme confirmées que si l’état distant confirme la modification. La reprise exige une annulation dont ends_at est encore futur. Les variantes annuelles et les changements manuels d’anchor hors du modèle mensuel ne sont pas proposés par ce MVP.

Pour les abonnements mensuels, la fin de fenêtre provient de renews_at, ou ends_at pour l’annulation/expiration, ou trial_ends_at pour l’essai. Le début correspond à l’ancre mensuelle précédente (jour plafonné à la fin du mois, sans reculer avant created_at) ; l’essai commence à created_at. Le cas d’une ancre 31 passant par février est testé. Les périodes ne sont jamais déduites du fuseau du navigateur ni d’un paramètre de retour.

La synchronisation emploie `lockUsage` : un quota ne peut être réservé au même moment qu’une modification de droits sans passer par le même verrou. Les données, projets et événements d’usage existants restent conservés. Les limites et compteurs de l’étape 18 restent en place ; une modification de plan dans la même période conserve les unités déjà utilisées. Les subscriptions Stripe préexistantes sont préservées, sans nouvel adaptateur Stripe.

## UI

Pricing ouvre un checkout de test pour Pro/Agency quand la configuration est disponible. Sinon le bouton explique l’indisponibilité. Le plan Free reste gratuit, Enterprise sur devis sans faux formulaire de vente.

Le dashboard affiche mode test, renouvellement ou fin d’accès, consommations et contrôles du portail. Les moyens de paiement et changements d’offre restent dans le portail selon les options réellement configurées. Aucun prix ni statut ne sont modifiables localement par une requête publique.

`/dashboard/billing/success` ne modifie aucune donnée : le composant interroge le backend pendant une durée bornée, affiche l’attente du webhook, puis une confirmation d’abonnement synchronisé. Les paramètres `plan`/`paid` sont ignorés. Un bouton permet une nouvelle vérification ; les états d’erreur et de webhook retardé sont explicites.

La régression du parcours de quotas a aussi révélé un blocage intermittent du rafraîchissement React après archivage. L’action retourne désormais un accusé de succès, puis le navigateur recharge la page dynamique. Les erreurs de quota restent dans le formulaire ; les contrôles serveur restent identiques.

## Migration et tests automatisés

Migration additive `20261021144417_add_lemon_squeezy_billing`, déjà appliquée localement. Pour un autre environnement, appliquer les migrations versionnées avec `pnpm prisma migrate deploy`, puis générer le client. Ne pas recréer une migration déjà appliquée.

```sh
pnpm prisma validate
pnpm exec vitest run
LEMON_BILLING_INTEGRATION=1 pnpm exec vitest run src/server/billing/__tests__/billing.postgres.test.ts
BILLING_INTEGRATION=1 pnpm exec vitest run src/server/services/__tests__/usage.postgres.test.ts
pnpm lint
pnpm build
node --test tests/lemon-billing.integration.test.mjs
```

Les tests unitaires mockent le transport. Les tests PostgreSQL utilisent de vrais verrous/transactions et des états distants simulés. L’intégration HTTP lance Next sur 3171 et une API simulée sur 3172. Un preload **uniquement dans le processus de test** redirige l’origine API fixe vers localhost ; aucun sélecteur d’URL arbitraire n’est ajouté au code de production. Les navigations Chrome vers le checkout sont interceptées et affichent une page locale. Aucun appel Lemon Squeezy, achat test externe, paiement réel, appel OpenAI ou déploiement n’est effectué par ces suites.

## Validation à réaliser avec la boutique de test

1. Compléter les variables locales et créer les variantes en mode test, EUR/mensuel, avec leurs prix correspondants.
2. Configurer un webhook HTTPS vers `/api/webhooks/lemonsqueezy` avec le même secret et la liste ci-dessus. Un tunnel de développement peut être utilisé après choix explicite de son périmètre ; aucun tunnel n’est créé par le code.
3. Se connecter, choisir Pro, vérifier que le checkout indique Test mode. Utiliser les moyens de paiement de test documentés par Lemon Squeezy. Constater FREE avant confirmation, puis Pro après webhook vérifié.
4. Renvoyer le même webhook ; constater un seul abonnement et aucun changement de consommation.
5. Simuler un échec de paiement, son rétablissement, un renouvellement et une expiration dans le dashboard Lemon Squeezy. Vérifier les dates, statuts et limites.
6. Annuler le renouvellement : vérifier le maintien des droits jusqu’à la date ends_at. Reprendre avant cette date et vérifier le retour de l’état distant.
7. Tester le changement de variant dans le portail si activé, ainsi qu’un utilisateur différent ne pouvant gérer l’abonnement du premier.
8. Vérifier aussi une livraison retardée et un retour navigateur précédant le webhook.

Le passage commercial réel constitue une étape distincte : approbation du marchand, configuration fiscale et de versement par le titulaire, variantes réelles et revue explicite de la politique d’accès/live mode. Ce commit ne déploie rien et ne permet pas de basculer automatiquement vers des paiements réels.

## Sources officielles consultées

- [Checkout API](https://docs.lemonsqueezy.com/api/checkouts/create-checkout)
- [Signature HMAC des webhooks](https://docs.lemonsqueezy.com/help/webhooks/signing-requests)
- [Synchronisation et événements](https://docs.lemonsqueezy.com/guides/developer-guide/webhooks)
- [Statuts, annulation et dates d’abonnement](https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object)
- [Mise à jour/reprise et portail](https://docs.lemonsqueezy.com/api/subscriptions/update-subscription)
- [Variantes](https://docs.lemonsqueezy.com/api/variants/the-variant-object), [devise de la boutique](https://docs.lemonsqueezy.com/api/stores/the-store-object)
