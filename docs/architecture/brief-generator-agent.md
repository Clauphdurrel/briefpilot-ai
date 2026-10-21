# Génération et versions des cahiers des charges

## Parcours

Depuis l’interview ou la liste des cahiers des charges d’un projet, l’utilisateur lance la génération. Une interview insuffisante impose un consentement explicite au brouillon. Le service recharge les réponses enregistrées et ne reçoit jamais un historique fourni par le navigateur.

`BriefGeneratorAgent` génère un JSON structuré, validé par Zod. `brief.service.ts` conserve ce document canonique dans `Brief.json` avec une enveloppe `brief.v1` et ses métadonnées de génération. `Brief.content` contient le Markdown dérivé. Chaque nouvelle révision des sources crée une version ; les anciennes restent consultables.

## Routes

- `POST /api/projects/[projectId]/briefs` : `{ requestId: UUID, allowDraft: boolean, language: "fr" | "en" }`.
- `GET /api/projects/[projectId]/briefs` : versions et état de préparation de l’interview.
- `GET /api/projects/[projectId]/briefs/[briefId]` : document validé.
- `/dashboard/projects/[projectId]/briefs` : génération et historique.
- `/dashboard/projects/[projectId]/briefs/[briefId]` : lecteur des 17 sections et navigation entre versions.
- `/dashboard/briefs` : derniers documents de l’utilisateur.

Les opérations vérifient la session, l’utilisateur en base et la propriété du projet. Les mutations vérifient aussi l’origine et limitent le corps JSON. Les erreurs publiques ne contiennent pas les détails du fournisseur.

## Concurrence, coûts et versions

Un verrou transactionnel par propriétaire, partagé avec l’interview, protège les prises de demande et la sauvegarde. L’appel OpenAI s’exécute hors transaction. Un registre technique `InterviewMessage` de rôle `system` associe chaque UUID à sa demande, ses tentatives et son résultat ; ces messages sont exclus du contexte client.

Une répétition de demande retourne le même document. Des sources inchangées réutilisent la dernière version sans appel payant ; les alias gratuits n’effacent jamais les tentatives payantes antérieures. Une modification des sources pendant l’appel annule la sauvegarde. Les versions sont numérotées sous verrou et ne sont pas écrasées.

Limites : 10 tentatives par jour et par propriétaire, 2 par minute, intervalle de 10 secondes par projet, 3 tentatives par UUID, 50 versions par projet. Le client OpenAI a un timeout de 45 secondes et ne réessaie pas automatiquement. L’historique et le contexte sont bornés ; une troncature impose un brouillon. Les listes affichent les 50 versions/documents les plus récents.

Un document complet peut passer le projet à `BRIEF_GENERATED`. Un brouillon conserve le statut courant ; les statuts `VALIDATED` et `ARCHIVED` sont préservés. Les anciens documents non conformes à `brief.v1` affichent une erreur explicite sans être modifiés.

## Vérification

Avec Node 24 et les dépendances installées :

```bash
pnpm test
pnpm lint
pnpm build
BRIEF_VISUAL_TEST=1 node --test tests/briefs.integration.test.mjs
```

Le test d’intégration utilise la base de développement configurée, crée puis supprime ses propres utilisateurs/projets et démarre Next ainsi qu’un faux fournisseur OpenAI local (ports 3121/3122). Le contrôle visuel optionnel requiert Google Chrome et utilise le port 9331. Aucun crédit OpenAI n’est consommé.

Pour une vérification réelle, configurer `OPENAI_API_KEY` et `OPENAI_MODEL` côté serveur, ouvrir un projet ayant une interview, puis choisir « Générer mon cahier des charges ». Vérifier les besoins confirmés, les manques et les 17 sections. Compléter l’interview, régénérer et consulter à nouveau la version précédente. Les exports PDF et le téléchargement Markdown sont réservés aux étapes suivantes.
