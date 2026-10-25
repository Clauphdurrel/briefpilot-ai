# Réponse aux incidents

1. Confirmer environnement et heure UTC, étendue et parcours touchés. Consulter la sonde `/api/health`, les erreurs Sentry si activées et les logs JSON. Une sonde positive ne valide pas PostgreSQL ou les fournisseurs.
2. Rechercher requestId/operationId dans Pino, puis module/errorCode/durationMs. Ne jamais copier les secrets, corps HTTP, prompts ou documents dans un ticket. Les identifiants techniques et métriques restent à accès restreint.
3. Qualifier : auth/DB (pool, connexions, migrations, OAuth), IA (état fournisseur, quotas fournisseur, timeouts), PDF (Chromium sandbox, mémoire, concurrence), paiement (signature, mode test/prod, état canonique fournisseur et ledger). Ne pas rejouer un paiement ou modifier un abonnement en SQL pour faire disparaître une erreur.
4. Contenir : si seule la télémétrie est défaillante, désactiver `POSTHOG_ENABLED`, `AI_MONITORING_ENABLED` ou `OBSERVABILITY_ENABLED` selon le composant. Les options NEXT_PUBLIC nécessitent un nouveau build. Préserver la génération et les contrôles d'accès. Une panne de collecte peut perdre des événements ; vérifier la fonction métier indépendamment.
5. Réparer avec une branche, un correctif ciblé et les tests du parcours. Ne pas relancer aveuglément une génération qui a expiré : une tentative peut avoir consommé du quota et avoir été facturée par le fournisseur. Examiner la réservation et l'état du document avant une nouvelle tentative volontaire.
6. Vérifier le rétablissement avec des données synthétiques, puis vérifier la réception et la résolution des alertes dans l'environnement voulu. Documenter impact, plage horaire, cause, preuve de récupération et action préventive.

## Diagnostic sans fuite

Sentry reçoit des erreurs techniques filtrées, pas les messages originaux. Les rejets de connexion utilisateur attendus et erreurs de validation ne sont pas des incidents techniques. Les détails confidentiels restent dans les systèmes de référence sous accès autorisé. En cas de suspicion de secret exposé, révoquer le secret auprès du fournisseur, vérifier son périmètre et nettoyer les artefacts exposés sans le recopier.

## Alertes et exercice

Les règles proposées figurent dans [observability.md](observability.md). **Aucune alerte distante n'est vérifiée active à la livraison locale.** L'opérateur doit créer les règles, choisir un destinataire, tester une erreur volontaire uniquement en développement avec du contenu synthétique et enregistrer la réception. Ne pas rendre un endpoint d'erreur accessible en production. Répéter l'exercice après changement d'environnement ou de canal d'alerte.
