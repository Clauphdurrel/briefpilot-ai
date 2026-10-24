# Matrice sécurité

| Cas | Résultat requis |
|---|---|
| Anonyme / session inconnue / expirée / révoquée | aucun accès privé |
| CompteA vers projet/document/abonnementB | 404 ou refus sans fuite |
| ServerAction étrangère / origine externe | mutation refusée |
| Déconnexion sans CSRF | session conservée |
| Corps malformé/surdimensionné | 400/413 avant opération coûteuse |
| Injection HTML / lien hostile | texte échappé, aucune exécution |
| PDF avec ressource réseau/fichier | aucun chargement, sandbox conservée |
| Navigation PDF cross-site | refus avant quota/renderer |
| Concurrence dernière unité | aucune surconsommation autorisée |
| Replay requête connue | pas de nouvel appel IA ni débit |
| Nombreux alias UUID | volume borné,429 |
| Webhook invalide / rejoué / ancien | aucune activation arbitraire, idempotence |
| Paramètres URL de retour payant | aucun changement de droits |
| Contenus/prompts et données sensibles | absents des logs/télémétrie |

Exécution du 24 octobre 2026 uniquement sur base locale jetable ; Google/OpenAI/Lemon externes simulés. Unitaires : 536 réussis ; PostgreSQL : 32 réussis ; HTTP/navigateur : 93 réussis. Aucun scénario de la campagne d'intégration n'est ignoré. Détail et limites : `../audits/test-matrix.md`. Les contrôles de télémétrie sont unitaires ; les comptes externes ne sont pas vérifiés.
