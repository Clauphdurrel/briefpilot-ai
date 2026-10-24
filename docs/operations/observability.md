# Observabilité — étape 22

## État et architecture

Pino produit des logs JSON côté serveur. Sentry reçoit uniquement des erreurs reconstruites depuis une liste de champs autorisés. Les durées des opérations et des appels IA sont mesurées localement ; tracing, profiling et replay Sentry restent désactivés. PostHog reçoit des événements métier serveur après vérification du consentement enregistré, sans SDK navigateur, pageviews, autocapture, session replay ni profils personnels.

Les intégrations distantes sont désactivées par défaut. **Aucune alerte distante ni réception dans un compte Sentry/PostHog n'a été vérifiée dans cet environnement.** Les tests utilisent des transports simulés, des identités synthétiques et PostgreSQL temporaire. Les tests ne nécessitent aucune clé fournisseur réelle.

## Configuration

Voir `.env.example`. Définir explicitement `OBSERVABILITY_ENABLED=true`, `OBSERVABILITY_ENVIRONMENT=development|staging|production`, et `LOG_LEVEL=info`. Les logs sont alors actifs. Configurer séparément :

- Sentry serveur : `SENTRY_DSN` ; navigateur : `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_OBSERVABILITY_ENABLED=true`, `NEXT_PUBLIC_OBSERVABILITY_ENVIRONMENT`. Les variables publiques sont figées au build. Les DSN doivent utiliser HTTPS. `SENTRY_AUTH_TOKEN` reste secret ; l'upload de source maps n'est pas activé par cette implémentation.
- PostHog : `POSTHOG_ENABLED=true`, `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST=https://eu.i.posthog.com` ou `https://us.i.posthog.com`, `ANALYTICS_HMAC_SECRET` aléatoire d'au moins 32 caractères. Utiliser un projet et une clé HMAC distincts par environnement. Les variables publiques PostHog historiques sont acceptées en repli serveur, mais aucun client PostHog n'est lancé.
- IA : `AI_MONITORING_ENABLED=true`, tarification et rétention décrites dans [ai-cost-monitoring.md](ai-cost-monitoring.md).

Ne jamais activer les services distants en tests. `NODE_ENV=test` ou l'un des drapeaux `OBSERVABILITY_TEST_MODE`, `E2E_TEST`, `PLAYWRIGHT_TEST` bloque PostHog/Sentry serveur. `NEXT_PUBLIC_OBSERVABILITY_TEST_MODE=true` bloque Sentry navigateur. Les harnesses imposent ces valeurs. Un `next start` de staging utilise aussi `NODE_ENV=production` : c'est `OBSERVABILITY_ENVIRONMENT` qui distingue les destinations. Ne pas partager un token PostHog entre staging et production.

## Corrélation et confidentialité

`withOperation` crée des UUID locaux requestId/operationId ; les appels imbriqués réutilisent leur contexte via AsyncLocalStorage. Aucun identifiant de requête fourni par le client n'est copié. Les services projet/interview/brief/backlog/export/facturation/quota sont instrumentés. Les opérations réussies ou échouées donnent durationMs, module, opération et code technique. Les erreurs techniques sont transmises à Sentry ; les erreurs de validation et quotas ne déclenchent pas d'incident serveur. Un WeakSet évite de signaler deux fois le même objet erreur dans une requête.

Les logs acceptent uniquement les champs définis dans `logger.ts`. Aucun corps HTTP, prompt, réponse IA, email, cookie, jeton, nom de projet ou donnée de paiement n'est fourni. Sentry élimine messages originaux, contextes, breadcrumbs, utilisateurs et requêtes ; seuls les emplacements source explicitement connus peuvent rester. Ce filtrage réduit volontairement la précision du diagnostic.

PostHog utilise `usr_` + HMAC SHA-256 de l'identifiant utilisateur et de l'environnement. Les propriétés autorisées sont plan/resource/documentKind/durationMs et environnement. Les UUID d'événement déterministes permettent la déduplication d'ingestion des retries pour une même ressource. Les générations réutilisées n'émettent pas de nouvel événement ; les transitions d'abonnement sont déterminées sous verrou transactionnel. Aucun mécanisme ne garantit une livraison exactement une fois : sans outbox, un crash après commit peut perdre un événement. Les exports volontaires successifs ont chacun leur événement.

Le consentement est refusé par défaut et modifiable dans `/dashboard/settings`. Chaque envoi relit la préférence en base ; une révocation bloque les futurs envois, sans supprimer les événements déjà reçus. Les utilisateurs HMAC restent pseudonymes, pas anonymes. Une suppression historique éventuelle doit être traitée dans le fournisseur avec les accès appropriés. Ne pas publier la clé HMAC.

## Défaillances et performance

Les envois PostHog sont attendus au plus une seconde, sans retry réseau, avec timeout SDK de 800 ms. Une lecture de consentement terminée après expiration ne déclenche aucun envoi. Le monitoring IA attend au plus une seconde de persistance et conserve le résultat métier même en panne de télémétrie. Une requête base déjà démarrée peut terminer après le délai : contrôler aussi les limites de connexion/requête du pool en exploitation. Les appels de télémétrie n'appellent jamais OpenAI et ne modifient pas les quotas.

`GET /api/health` renvoie uniquement `{ "status": "ok" }`, sans cache ni appel externe. C'est une sonde de **liveness**, pas une garantie de disponibilité PostgreSQL/OpenAI/Lemon Squeezy. Surveiller séparément les parcours critiques depuis un contrôle interne authentifié ; aucun endpoint readiness détaillé public n'est ajouté.

## Alertes à créer manuellement

Aucune règle distante n'est actuellement confirmée. Dans Sentry, sélectionner le projet et l'environnement exacts, puis créer des règles sur les tags `module` et `errorCode` :

| Priorité | Signal | Seuil initial | Action |
| --- | --- | --- | --- |
| Critique | auth technique (`AUTH_ADAPTER_ERROR`, `AUTH_SESSION_ERROR`, `AUTH_CONFIGURATION_ERROR`) | 5 erreurs / 5 min | notification opérateur ; vérifier DB/config OAuth |
| Critique | billing/webhook technique | 3 erreurs / 5 min | contrôler fournisseur, signatures et relecture du ledger |
| Critique | santé HTTP | 3 échecs successifs à 1 min | moniteur HTTP externe sur `/api/health` |
| Critique | erreurs serveur globales | 20 événements / 5 min | comparer trafic et journaux par requestId |
| Warning | `AI_TIMEOUT`, `AI_UNAVAILABLE`, équivalents brief/backlog | 5 erreurs / 10 min | contrôler fournisseur et latence |
| Warning | `PDF_TIMEOUT`, `PDF_UNAVAILABLE` | 3 erreurs / 10 min | vérifier Chromium et ressources |
| Warning | durées | IA > 30 s, PDF > 15 s sur 15 min | agrégation des logs Pino |
| Warning | consommation IA | estimation journalière > budget fixé par l'opérateur ou 2× moyenne 7 jours | rapport IA + dashboard officiel OpenAI |

Ces seuils sont des points de départ, à ajuster au trafic. Les nombres absolus Sentry ne sont pas un taux : un taux d'erreur nécessite un dénominateur de requêtes dans le collecteur HTTP/logs. Les durées/coûts ne sont pas exportés en métriques Sentry ; ces alertes nécessitent un collecteur de logs ou une tâche opérateur. Choisir le canal d'alerte et confirmer sa réception par une erreur synthétique en développement, puis vérifier une résolution. Ne pas ajouter de route publique de déclenchement d'erreur. Consigner date, environnement, règle et destinataire validés avant de marquer les alertes actives.

## Rétention et validation

Configurer côté Sentry/PostHog une durée minimale adaptée au besoin (point de départ : 30 jours d'erreurs, 90 jours d'événements selon le plan disponible). La rétention locale IA par défaut est 90 jours avec purge explicite ; aucun cron destructif n'est installé. Les logs stdout sont conservés par l'hébergeur/collecteur : régler rotation, accès et durée à cet endroit.

Commandes : `pnpm prisma validate`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test:unit`, `pnpm build`, `pnpm test:integration`, `pnpm test:e2e`. Les deux dernières commandes créent et détruisent leur propre base locale. Voir [incident-response.md](incident-response.md) pour le diagnostic et les preuves à conserver.
