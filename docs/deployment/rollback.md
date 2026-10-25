# Retour arrière et incidents d'hébergement

Aucun déploiement n'est activé dans cette préparation. Le futur staging doit conserver le SHA applicatif, le digest du worker, les noms des configurations et la version de migrations associée, sans secrets.

1. Identifier l'environnement, le parcours touché et les requestId. Vérifier liveness puis parcours authentifié ; ne pas attribuer une panne DB à un health check HTTP positif.
2. Si l'incident suit une livraison applicative, revenir au déploiement précédent connu via le mécanisme de l'hébergeur après vérification de sa compatibilité avec le schéma actuel.
3. Pour le worker, restaurer le digest précédent et sa configuration coordonnée ; revalider auth, sandbox, santé et PDF synthétique. Éviter une rotation désynchronisée du secret.
4. Ne pas inverser automatiquement une migration destructive. Préférer un correctif compatible en avant ; si restauration nécessaire, restaurer vers une base/branche distincte, contrôler les données et les droits avant bascule explicitement validée.
5. Vérifier ownership, quotas, sessions, webhooks idempotents et documents après rétablissement. Documenter impact, preuve et action préventive.

Les coûts inconnus après un timeout IA ne sont pas gratuits ; ne pas relancer aveuglément la génération. Une indisponibilité du worker libère la réservation PDF selon le service existant et affiche une erreur publique générique. Voir [runbook incidents](../operations/incident-response.md).
