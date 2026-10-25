# Mesure des coûts IA

Les appels Responses existants sont enveloppés une seule fois via `getOpenAI` et `monitorAI`. Chaque tentative conserve agent, modèle, durée, statut, IDs de corrélation et consommation réellement renvoyée. Aucun appel fournisseur supplémentaire, prompt ou contenu généré n'est enregistré.

## Tokens et prix

Les champs `usage.input_tokens`, `usage.input_tokens_details.cached_tokens`, `usage.output_tokens` et `usage.total_tokens` sont validés ; une consommation absente/incohérente reste UNKNOWN ou PARTIAL. Un timeout peut avoir été facturé : coût et tokens restent `null`, jamais zéro inventé. Les modèles ou tiers inconnus restent sans estimation.

`src/config/ai-pricing.ts` contient une configuration versionnée `openai-standard-text-2026-10-24.v1` pour `gpt-4.1-mini` et son snapshot connu, au tarif standard USD par million : entrée 0,40 ; entrée en cache 0,10 ; sortie 1,60. Formule : `(input-cached)*0.40/1e6 + cached*0.10/1e6 + output*1.60/1e6`. L'entrée inclut déjà les tokens en cache : ne pas les compter une seconde fois. Se référer au [modèle officiel](https://developers.openai.com/api/docs/models/gpt-4.1-mini) et à la [tarification officielle](https://developers.openai.com/api/docs/pricing) vérifiés le 24 octobre 2026. Réviser la version lors de chaque changement de prix ; conserver la version par ligne pour ne pas réécrire les anciennes estimations.

Le coût est une estimation, sans taxes, crédits, remises contractuelles ni garantie de correspondance avec la facture. Comparer au tableau de bord officiel OpenAI avant toute décision tarifaire.

## Base et quotas

Le modèle AIUsageLog et sa migration existent déjà : aucune migration supplémentaire à l'étape 22. `attemptId` unique empêche une insertion technique en double pour une tentative. Les appels distincts/retries fournisseur peuvent être facturés séparément. UsageCounter/UsageEvent restent le registre des quotas ; ne jamais déduire un quota d'AIUsageLog ou modifier le registre depuis le monitoring.

Une panne de métriques ne doit pas invalider une génération réussie. Les réservations/commits de quotas gardent leur logique existante. Les tests PostgreSQL vérifient qu'un appel mesuré, un timeout ou une panne de métriques ne consomme qu'une unité.

## Rapport et conservation

Avec accès opérateur à la base voulue :

```bash
AI_USAGE_REPORT_DAYS=30 pnpm observability:report
AI_USAGE_RETENTION_DAYS=90 pnpm observability:prune
# Après lecture du dry-run et vérification de la cible :
AI_USAGE_RETENTION_DAYS=90 pnpm observability:prune --apply
```

Le rapport agrège par agent/modèle/version tarifaire, sans utilisateur ni contenu : tentatives, tokens mesurés, estimations connues et nombre de coûts inconnus. Les sommes connues sont un minimum partiel si unknownCostAttempts > 0. Tous les coûts inconnus donnent `null`.

La purge est un dry-run par défaut, limitée à AIUsageLog antérieur au seuil (7 à 365 jours, défaut 90). `--apply` supprime au plus 10 lots de 1 000 lignes ; répéter si batchLimitReached. Elle ne touche ni aux documents, ni aux utilisateurs, ni aux quotas. Aucun ordonnanceur n'est installé : planifier une exécution quotidienne après validation de la politique et de la cible DATABASE_URL. Prévoir logs de résultat, alertes sur échec et limites d'accès aux métriques identifiantes conservées en base.
