# BriefPilot AI - Instructions pour les agents de code

## Objectif du projet

BriefPilot AI est un SaaS qui aide les développeurs, agences web, consultants et chefs de projet à transformer une demande client vague en livrables structurés :

- cahier des charges
- questions manquantes
- structure de pages ou écrans
- fonctionnalités
- backlog
- estimation
- prompts Codex
- exports Markdown/PDF

## Stack du projet

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- shadcn/ui
- Zod
- PostgreSQL
- Prisma
- OpenAI API
- Stripe plus tard
- Vercel pour le déploiement

## Règles générales

- Toujours lire ce fichier avant de modifier le code.
- Toujours proposer un plan avant une modification importante.
- Faire des changements petits, propres et testables.
- Ne pas toucher aux modules non concernés.
- Ne jamais exposer de clé API côté client.
- Ne jamais mettre de logique métier lourde dans les composants React.
- Séparer clairement :
  - UI
  - services
  - validators
  - agents IA
  - prompts
  - types
  - accès base de données

## Règles Next.js

- Utiliser l’App Router.
- Préférer les Server Components quand c’est possible.
- Utiliser `"use client"` seulement si nécessaire.
- Garder les pages simples.
- Extraire les composants complexes dans `src/components`.
- Les appels serveur doivent rester dans `src/server`.

## Règles UI

- Utiliser Tailwind CSS.
- Utiliser shadcn/ui pour les composants de base.
- Chaque page importante doit prévoir :
  - loading state
  - empty state
  - error state
  - responsive mobile
- Design attendu : SaaS premium, clair, sobre, professionnel.

## Règles validation

- Utiliser Zod pour valider :
  - formulaires
  - entrées API
  - sorties IA
  - paramètres serveur
- Ne jamais faire confiance aux données envoyées par le client.

## Règles IA

- Les agents IA doivent vivre dans `src/server/agents`.
- Les prompts doivent vivre dans `docs/prompts` ou dans un futur dossier `src/server/prompts`.
- Les sorties IA importantes doivent être structurées en JSON.
- Les sorties IA doivent être validées avec Zod.
- Si une information est absente, l’agent doit la marquer comme information manquante au lieu de l’inventer.

## Règles sécurité

- Vérifier l’utilisateur avant toute action sensible.
- Vérifier l’accès au projet ou workspace.
- Ne jamais logger de secret.
- Ne jamais exposer `.env`.
- Les erreurs publiques doivent être claires mais ne pas révéler d’informations sensibles.

## Règles Git

- Une fonctionnalité = une branche.
- Une tâche Codex = une PR claire.
- Faire des commits courts et lisibles.
- Avant commit :
  - `pnpm lint`
  - `pnpm build` si possible

## Format de fin de réponse attendu de Codex

À la fin d’une tâche, toujours résumer :

- fichiers créés
- fichiers modifiés
- tests ajoutés
- commandes exécutées
- risques restants
- prochaine étape recommandée
