---
name: review-code
description: Relit une modification ou PR comme un senior engineer en vérifiant bugs, sécurité, performance, architecture, UX et tests.
---

# Skill: Review Code

## Objectif

Ce skill sert à relire le code avant commit ou merge.

## Quand utiliser ce skill

Utiliser ce skill quand la tâche demande de :

- relire une PR
- vérifier un changement
- trouver des bugs
- auditer la sécurité
- améliorer l’architecture
- vérifier les tests
- vérifier une feature avant merge

## Checklist

Vérifier :

1. Bugs possibles
2. Régressions
3. Sécurité
4. Validation des entrées
5. Permissions utilisateur/workspace
6. Secrets exposés
7. Performance
8. Lisibilité
9. Architecture
10. Responsabilités trop mélangées
11. Tests manquants
12. UX
13. États loading/empty/error
14. Accessibilité de base
15. Erreurs non gérées

## Format de sortie attendu

Classer les remarques en :

- Bloquant
- Important
- Amélioration
- Optionnel

Pour chaque remarque :

- problème
- impact
- fichier concerné
- correction recommandée

## Règles

- Ne pas proposer un refactor massif sans raison.
- Prioriser les vrais risques.
- Être précis et actionnable.
- Proposer des patchs courts si utile.
