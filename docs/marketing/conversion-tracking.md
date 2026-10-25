# Mesure de conversion

Le service réutilise PostHog côté serveur et la configuration existante de l’observabilité. Aucun SDK PostHog navigateur, auto-capture, replay, enregistrement de formulaire, texte client ou URL complète n’est transmis.

## Activation

Par défaut, `MARKETING_ANALYTICS_ENABLED=false`. Le service exige aussi OBSERVABILITY_ENABLED, POSTHOG_ENABLED et une configuration PostHog/HMAC valide. Les garde-fous existants bloquent les transports externes pendant les tests. Aucune variable cloud, projet PostHog ou collecte externe n’est activé par l’étape 27.

Quand l’opérateur active le suivi, une préférence spécifique à la vitrine permet d’autoriser/refuser/retirer l’accord. Sans accord, aucun événement n’est envoyé. La préférence est conservée en localStorage ; l’identifiant aléatoire de session n’est créé en sessionStorage qu’après accord, puis pseudonymisé par HMAC côté serveur. La préférence produit du dashboard reste distincte. DNT et Global Privacy Control empêchent l’envoi côté navigateur.

## Événements implémentés

| Événement        | Déclencheur                                                                    |
| ---------------- | ------------------------------------------------------------------------------ |
| landing_viewed   | Accueil consulté après accord                                                  |
| hero_cta_clicked | Clic sur le CTA principal du hero                                              |
| pricing_viewed   | Section tarifs visible ou page /pricing consultée                              |
| signup_started   | Clic sur un CTA menant à la connexion ; ce n’est pas une inscription confirmée |

`waitlist_joined` n’est pas émis : aucune liste d’attente n’existe. Une navigation vers Google ou un clic de CTA ne prouve jamais la création d’un compte. Les statistiques serveur d’authentification existantes restent séparées.

## Données et fiabilité

La server action reçoit uniquement l’accord explicite, deux UUID aléatoires, et les enums event/page/placement. Zod strict rejette tout champ additionnel (email, texte, paramètres ou URL). Le transport PostHog réécrit les propriétés avec une allowlist ; identité HMAC, géolocalisation désactivée et aucun profil personne demandé.

Le client déduplique chaque événement/placement par vue, y compris lors du rejeu des effets React. Le serveur génère un UUID déterministe et utilise un cache borné, temporaire et par processus. La déduplication entre instances repose également sur l’UUID envoyé ; aucune garantie globale exactement-une-fois n’est revendiquée. Les événements sont déclaratifs, non des preuves d’achat. L’échec du fournisseur ne bloque pas la navigation ; délai d’attente et file sont bornés.

Les tests unitaires utilisent des mocks et vérifient désactivation, consentement, allowlist, suppression des champs sensibles, doublons et indisponibilité. Les tests navigateur vérifient l’absence de requêtes tierces en configuration de test. La réception réelle dans un projet PostHog reste un contrôle opérateur après activation autorisée.
