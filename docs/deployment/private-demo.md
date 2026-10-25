# Démo privée avec quelques amis

État : connexion Google et session Neon validées sur le Preview ; clé/modèle OpenAI configurés mais génération réelle non validée, crédit API non encore chargé selon l’opérateur. L’étape 26 reste en cours.

## Budget et données de test

Prévoir un budget initial de 5 USD de crédit API, ou 10 USD pour davantage de séries. Cette recommandation repose sur le tarif standard de gpt-4.1-mini et des hypothèses de volume ; ce n’est pas une capacité garantie. Voir [l’estimation détaillée](cost-estimation.md). Aucun achat ni appel OpenAI n’est effectué automatiquement par les scripts de préparation.

Tous les testeurs utilisent le backend et la clé OpenAI du propriétaire. Ne jamais transmettre la clé aux amis. Les abonnements Lemon Squeezy en mode test ne financent pas le compte OpenAI : ils testent seulement le comportement des offres et webhooks de BriefPilot.

Utiliser uniquement des projets fictifs sans données clients : par exemple « Café Démo », site vitrine avec accueil, présentation, carte, horaires et contact, sans paiement en ligne. Commencer par quelques testeurs puis mesurer les volumes réels avant d’élargir.

## Donner accès au Preview protégé

Adresse stable de l’application : https://briefpilot-ai-git-develop-duramite32-3695s-projects.vercel.app

La simple adresse ne donne pas automatiquement accès aux personnes extérieures à Vercel. Dans le dashboard Vercel, ouvrir le Preview et **Share** : inviter les personnes prévues ou créer un lien partageable selon les options du compte. Privilégier les accès individuels pour un petit groupe. Si un lien partageable est utilisé, le garder privé et le révoquer après les tests ; il donne accès au Preview à son détenteur. Ne pas copier un jeton Automation serveur dans un message pour les testeurs.

Un partage de branche suit ses nouveaux déploiements, un partage de commit reste lié au déploiement choisi. Toujours vérifier que l’accès partagé et les redirections Google fonctionnent ensemble sur l’origine stable retenue. Ne pas ouvrir globalement la protection ni changer le callback vers un domaine de commit pour contourner un problème.

L’agent n’a créé aucun partage, envoyé aucune invitation, transmis aucun lien privé à des tiers ni désactivé la protection. [Partage officiel Vercel](https://vercel.com/docs/deployments/sharing-deployments).

## Comptes Google et quotas

Chaque testeur utilise son propre compte Google. Une application Google configurée Internal ne peut pas accueillir des amis extérieurs à l’organisation. En mode External/Testing, vérifier l’audience et les éventuels utilisateurs de test. La documentation Google prévoit une exception à la liste de testeurs pour les seuls scopes d’identité de base openid/email/profile ; ne pas supposer que tous les comptes sont autorisés si des scopes supplémentaires ou des restrictions d’organisation s’appliquent.

Les quotas Free actuels ne sont pas supprimés : 2 projets actifs, 3 réponses IA d’interview, 2 briefs, 1 backlog et 3 exports PDF mensuels par compte. Un quota produit atteint ne signifie pas nécessairement que le crédit OpenAI est épuisé. Tester les offres supérieures via un vrai parcours Lemon Squeezy **en mode test**, après configuration et validation des signatures ; ne pas forcer les droits premium directement en base.

## Parcours à vérifier

1. Connexion Google, création d’un projet fictif et nouvelle consultation après rechargement.
2. Première réponse d’interview, puis interview complète avec informations fictives explicites.
3. Brief et backlog réellement générés et persistés, export Markdown et PDF distant après validation du worker.
4. Deux testeurs distincts : le compte B ne doit pas ouvrir le projet/document du compte A, même avec son URL.
5. Quotas Free, paiement test et mise à jour de l’offre par webhook signé, jamais par simple retour checkout.
6. Déconnexion/reconnexion et contrôle des événements staging Sentry/PostHog une fois les projets configurés.

Noter les résultats dans [le rapport](staging-validation.md). Un modèle configuré, un build Ready ou des tests locaux ne prouvent pas tous ces parcours en ligne.
