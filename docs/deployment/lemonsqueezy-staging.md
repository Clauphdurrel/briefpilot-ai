# Lemon Squeezy staging — préparation sans paiement réel

État au 25 octobre 2026 : le catalogue distant a été vérifié en lecture seule : boutique EUR, deux variantes Test à prix fixe de 19 et 59 EUR, récurrence mensuelle. Les six paramètres Lemon ont été stockés et leur portée Preview/develop vérifiée chez Vercel après autorisation, puis activés dans un nouveau Preview Ready. Le webhook Test a été créé après un accord distinct ; sa réception d’un événement fournisseur réel reste à vérifier. Aucun checkout ni paiement n’a été créé par l’agent.

## Boutique et offres

Utiliser une boutique dédiée au staging, nom suggéré BriefPilot AI Staging, avec devise **EUR**. Le serveur vérifie la devise et les prix ; des produits en USD ou à un autre prix seront refusés même si leurs noms correspondent.

En mode Test, créer deux abonnements à prix fixe, récurrence mensuelle, interval_count=1 :

| Offre BriefPilot | Nom conseillé du produit test | Prix mensuel | Montant API en centimes |
| --- | --- | --- | --- |
| PRO | BriefPilot Pro – Staging | 19 EUR | 1900 |
| AGENCY | BriefPilot Agency – Staging | 59 EUR | 5900 |

Désactiver pay_what_you_want. Publier uniquement dans l’environnement Test. Ne pas copier ces produits vers Live ni activer des ventes réelles pendant l’étape 26. Les prix ci-dessus proviennent de src/config/plans.ts ; le fournisseur est interrogé pour confirmer devise, période, montant, boutique et test_mode avant de créer un checkout.

Sources : [création de boutique](https://docs.lemonsqueezy.com/guides/getting-started), [produits](https://docs.lemonsqueezy.com/help/products/adding-products), [mode Test](https://docs.lemonsqueezy.com/help/getting-started/test-mode).

## Identifiants privés

Créer une clé API depuis l’interface avec le mode Test actif. Les clés Test sont séparées des clés Live. La conserver uniquement dans .env.staging.local, privé 600 et ignoré ; ne jamais la coller dans le chat, les logs ou un ticket. [Authentification API](https://docs.lemonsqueezy.com/api/getting-started/requests).

Variables attendues :

```dotenv
LEMONSQUEEZY_API_KEY="CLE_TEST_PRIVEE"
LEMONSQUEEZY_STORE_ID="IDENTIFIANT_BOUTIQUE"
LEMONSQUEEZY_PRO_VARIANT_ID="IDENTIFIANT_VARIANTE_PRO_TEST"
LEMONSQUEEZY_AGENCY_VARIANT_ID="IDENTIFIANT_VARIANTE_AGENCY_TEST"
LEMONSQUEEZY_TEST_MODE="true"
```

Ne pas confondre product_id et variant_id. Les deux variantes doivent être distinctes et appartenir à la boutique sélectionnée. Avant toute mutation fournisseur, lire/valider les objets Test avec l’API. Ne pas deviner un identifiant absent. Le stockage éventuel de la clé et du secret de webhook chez Vercel doit être autorisé explicitement et limité à l’app Preview/develop.

Un LEMONSQUEEZY_WEBHOOK_SECRET aléatoire de 32 caractères a été préparé sans affichage et stocké comme variable sensible Vercel Preview/develop, avec LEMONSQUEEZY_API_KEY. Il est distinct des secrets Auth, PDF et Vercel. Il a été transmis uniquement à Lemon Squeezy pour signer le webhook Test, après accord. Les quatre autres paramètres sont non secrets ; leur portée reste Preview/develop.

## Webhook et protection Preview

Chemin de l’app : /api/webhooks/lemonsqueezy. Origine stable : https://briefpilot-ai-git-develop-duramite32-3695s-projects.vercel.app

Les requêtes publiques sont redirigées vers Vercel Authentication. Après accord distinct, un jeton Automation dédié au projet app a été créé et conservé dans le fichier privé sous LEMONSQUEEZY_WEBHOOK_VERCEL_BYPASS_SECRET. L’URL de webhook contenant ce jeton en query est conservée sous LEMONSQUEEZY_WEBHOOK_URL et transmise uniquement à Lemon Squeezy ; ne jamais publier cette URL, ses paramètres ni les réponses brutes de l’API webhooks. Sa portée couvre tous les déploiements du projet app, pas seulement ce chemin. Les contrôles d’authentification applicative et la signature HMAC restent actifs. Le jeton worker n’est pas réutilisé et la protection globale n’est pas désactivée. [Accès Automation Vercel](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

Webhook Test vérifié : identifiant 146164, dix événements ci-dessous, boutique attendue et URL privée exacte. Sur le Preview dpl_5NrSUN5eg6tTb5h5szGT9YM7mKB7 : health protégé 200, absence de signature 401 INVALID_WEBHOOK_SIGNATURE ; corps vide JSON signé avec le secret partagé 400 INVALID_WEBHOOK. Ce dernier contrôle prouve la reconnaissance du secret sans simuler un abonnement ni écrire de droit premium. Il ne prouve pas encore une livraison effective de Lemon Squeezy.

Conserver la vérification cryptographique X-Signature sur les octets bruts, l’idempotence et le mode test strict. Aucun droit premium accordé sur un simple retour checkout. Le serveur relit l’abonnement distant et vérifie son lien avec l’intention de checkout et l’utilisateur.

Événements traités par l’implémentation :

```text
subscription_created
subscription_updated
subscription_cancelled
subscription_expired
subscription_resumed
subscription_payment_success
subscription_payment_failed
subscription_payment_recovered
subscription_paused
subscription_unpaused
```

Configurer uniquement les événements disponibles et utilisés. Les événements de paiement invoice exigent subscription_id ; respecter le format réel du fournisseur. [Webhooks](https://docs.lemonsqueezy.com/help/webhooks), [signatures et synchronisation](https://docs.lemonsqueezy.com/guides/developer-guide/webhooks).

## Vérifications après raccordement

Avec données fictives et consentement de l’opérateur, effectuer un checkout Test depuis BriefPilot, vérifier webhook signé et offre canonique, puis idempotence, renouvellement/annulation simulés et isolation entre deux utilisateurs. Ne pas changer l’offre directement en base pour remplacer ce test.

Utiliser uniquement les cartes de test de la documentation Lemon Squeezy et aucun moyen de paiement réel. Les mails de test peuvent être envoyés au propriétaire/aux membres de la boutique par le prestataire ; aucun test n’est lancé automatiquement par ce guide. Voir [cartes et mode Test](https://docs.lemonsqueezy.com/help/getting-started/test-mode).

Aucun de ces contrôles en ligne n’est annoncé réussi avant sa preuve dans [le rapport staging](staging-validation.md).
