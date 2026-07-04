---
name: create-briefpilot-agent
description: Crée ou modifie un agent IA BriefPilot avec prompt système, schéma d’entrée, schéma de sortie, validation Zod, service serveur et tests.
---

# Skill: Create BriefPilot Agent

## Objectif

Ce skill sert à créer des agents IA internes pour BriefPilot AI.

Un agent BriefPilot doit transformer des informations projet en sortie structurée, fiable et validée.

## Agents prévus

- InterviewClientAgent
- MissingQuestionsAgent
- BriefGeneratorAgent
- TechArchitectAgent
- BacklogGeneratorAgent
- EstimationAgent
- ValidationAgent
- ExportAgent

## Quand utiliser ce skill

Utiliser ce skill quand la tâche demande de :

- créer un agent IA
- créer un prompt système
- structurer une sortie IA
- valider une sortie IA
- créer un workflow IA
- ajouter un agent métier à BriefPilot

## Structure obligatoire d’un agent

Chaque agent doit avoir :

1. un nom clair
2. un rôle métier
3. un prompt système
4. un schéma d’entrée Zod
5. un schéma de sortie Zod
6. un service serveur
7. une gestion d’erreurs
8. au moins un exemple d’entrée
9. au moins un exemple de sortie
10. des tests

## Règles IA

- Les agents vivent dans `src/server/agents`.
- Les validations vivent dans `src/server/validators`.
- Les prompts peuvent vivre dans `docs/prompts` ou `src/server/prompts`.
- Les sorties doivent être JSON quand elles sont utilisées par le système.
- Les sorties doivent être validées avec Zod.
- Si l’IA retourne un format invalide, prévoir une stratégie de correction ou d’erreur.
- Ne pas inventer les informations client.
- Distinguer faits, hypothèses et informations manquantes.

## Format de sortie minimal recommandé

```json
{
  "summary": "",
  "known_information": [],
  "missing_information": [],
  "questions": [],
  "recommendations": [],
  "assumptions": [],
  "confidence_score": 0
}
