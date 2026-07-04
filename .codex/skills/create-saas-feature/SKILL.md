---
name: create-saas-feature
description: Crée une fonctionnalité SaaS complète pour BriefPilot AI avec données, validation, API, UI, tests et documentation.
---

# Skill: Create SaaS Feature

## Objectif

Ce skill sert à créer une fonctionnalité complète dans BriefPilot AI.

## Quand utiliser ce skill

Utiliser ce skill quand la tâche demande de :

- créer un module produit
- ajouter une fonctionnalité SaaS
- créer un workflow complet
- connecter DB + API + UI
- ajouter une fonctionnalité dashboard

## Processus obligatoire

1. Lire `AGENTS.md`.
2. Comprendre le besoin métier.
3. Proposer un plan avant modification importante.
4. Identifier les fichiers à créer ou modifier.
5. Créer ou modifier les modèles de données si nécessaire.
6. Ajouter les validations Zod.
7. Créer les services serveur.
8. Créer les routes ou server actions.
9. Créer l’interface utilisateur.
10. Ajouter loading state, empty state, error state.
11. Ajouter les tests nécessaires.
12. Mettre à jour la documentation si nécessaire.

## Règles de qualité

- Une fonctionnalité doit être découpée si elle est trop grande.
- Ne pas mettre de logique métier lourde dans l’UI.
- Ne pas exposer les secrets côté client.
- Toujours valider les entrées.
- Toujours gérer les erreurs.
- Toujours penser aux permissions utilisateur/workspace.
- Garder le design clair, premium et responsive.

## Sortie attendue en fin de tâche

- fichiers créés
- fichiers modifiés
- tests ajoutés
- commandes exécutées
- risques restants
- prochaine étape recommandée
