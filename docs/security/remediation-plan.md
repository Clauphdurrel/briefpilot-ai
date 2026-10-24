# Remédiation

| ID | Correction | Preuve de validation du 24 octobre 2026 | Statut étape 20 |
|---|---|---|---|
| DEP-01 | Versions corrigées compatibles et overrides ciblés | Audit pnpm sans avis, build réussi, régressions unitaires et intégration réussies | corrigé |
| OPS-01 | PostgreSQL loopback, mot de passe local injecté | Configuration Compose revue ; aucun volume existant supprimé ; changement de mot de passe d'un volume existant documenté | corrigé pour la configuration versionnée |
| SEC-01 | Garde Fetch Metadata/origine des PDF GET | Tests unitaires des trois routes et intégration HTTP : 403, aucun événement de quota créé | corrigé |
| DB-01 | Borne durable des nouveaux alias | Tests services : limite à 100 alias/24 h/propriétaire, 429, concurrence, replay et nouvelle fenêtre | corrigé |
| WEB-01 | Anti-framing/nosniff/referrer/permissions | Test HTTP des en-têtes sur /login anonyme et /dashboard/projects authentifié | corrigé |
| DB-02 | Propager client transactionnel | Test PostgreSQL réel avec pool à une connexion et régressions backlog | corrigé |

Ces résultats concernent la campagne locale de l'étape 20. Ils ne remplacent pas l'audit de sécurité approfondi de l'étape 21 ni la validation de l'infrastructure réelle. Aucun contrôle de sécurité n'a été désactivé pour faire passer une suite.
