---
name: generate-codex-tasks
description: Transforme un brief, cahier des charges ou module produit en tâches Codex petites, testables et exécutables par PR.
---

# Skill: Generate Codex Tasks

## Objectif

Ce skill découpe un besoin produit en tâches prêtes à donner à Codex.

Chaque tâche doit être :

- petite
- claire
- testable
- isolée
- exécutable par une PR
- assignable à un rôle d’agent

## Quand utiliser ce skill

Utiliser ce skill quand la tâche demande de :

- découper un projet en tâches
- générer un backlog technique
- créer des prompts Codex
- préparer le travail pour plusieurs agents
- transformer un brief en PR
- organiser un module SaaS

## Rôles d’agents disponibles

- architect
- backend
- frontend
- ai-engineer
- qa
- devops
- reviewer

## Règles de découpage

1. Une tâche = une PR.
2. Éviter les tâches trop larges.
3. Commencer par la structure de données si nécessaire.
4. Ensuite créer API/services.
5. Ensuite créer UI.
6. Ensuite intégrer IA.
7. Ensuite ajouter tests.
8. Ensuite polish et review.
9. Ne pas mélanger trop de responsabilités.
10. Chaque tâche doit avoir des critères d’acceptation.

## Format de sortie attendu

Pour chaque tâche :

- titre
- rôle d’agent recommandé
- priorité : P0, P1 ou P2
- contexte
- objectif
- fichiers probables
- contraintes
- prompt prêt à copier dans Codex
- critères d’acceptation
- tests à ajouter
- risques

## Exemple de tâche attendue

Titre : Créer le modèle Project

Rôle : backend

Priorité : P0

Objectif :
Créer le modèle Prisma Project avec les champs nécessaires au MVP.

Prompt Codex :
Crée le modèle Project pour BriefPilot AI avec workspaceId, name, type, description, status, createdAt et updatedAt. Ajoute les index nécessaires, prépare la migration et mets à jour les types associés.

Critères d’acceptation :
- Le modèle existe dans Prisma.
- La migration fonctionne.
- Les champs obligatoires sont validés.
- Le projet compile.
