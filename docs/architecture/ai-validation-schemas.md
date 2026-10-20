# Contrats des futurs agents IA — étape 10

Cette étape définit uniquement des schémas Zod et les types TypeScript qui en sont
dérivés. Elle ne crée ni agent, ni service IA, ni prompt, ni appel réseau. Les modèles
Prisma existants restent inchangés.

## Interview

`src/server/validators/interview.schema.ts` expose :

- `projectTypeSchema` : les sept types partagés avec le module Project. Un test les
  compare directement à l’enum `ProjectType` du schéma Prisma.
- `prioritySchema` : `low`, `medium`, `high`.
- `questionSchema` : `id`, `question`, `category`, `priority`, `required` et
  `helpText` facultatif.
- `clientAnswerSchema` : `questionId`, réponse textuelle `answer` et `answeredAt`
  facultatif au format ISO 8601 avec fuseau (`Z` ou décalage explicite).
- `interviewInputSchema` : `projectType`, `questions`, `answers` et `locale`
  facultatif (par exemple `fr` ou `en-US`).
- `interviewAnalysisSchema` : `summary`, `knownInformation`, `missingInformation`,
  `assumptions`, `completionScore` entre 0 et 100 inclus et `nextQuestion`.
  Une valeur `null` indique qu’aucune question suivante n’est proposée.
- `interviewSchema` : combinaison des entrées et de l’analyse.

Les informations connues, manquantes et les hypothèses sont des listes de textes.
Elles sont explicites et peuvent être vides. Aucun défaut ne remplit les réponses,
les scores ou les hypothèses. Le score est validé, jamais calculé par les schémas.

## Cahier des charges

`src/server/validators/brief.schema.ts` expose `briefSchema` avec les quinze champs
demandés. `projectSummary` et `projectScope` sont des textes. Les fonctionnalités
sont des objets `featureSchema` ; les pages sont des objets `pageSchema` avec
`id`, `name` et `description`. Les autres champs sont des listes de textes.

Une fonctionnalité contient `id`, `name`, `description`, `priority`, `complexity`
et une liste `acceptanceCriteria`. Sa priorité utilise le même enum que les
questions. La complexité accepte `low`, `medium`, `high` ou `unknown` ; ce dernier
permet de conserver une estimation inconnue sans en inventer une.

Les listes peuvent être vides pour un brouillon incomplet. Les éléments manquants
doivent alors être consignés dans `missingInformation` par le futur agent.

## Réponse commune

`src/server/validators/agent-response.schema.ts` expose la fabrique
`createAgentResponseSchema(dataSchema)` pour valider aussi le contenu propre à
chaque agent :

```ts
const responseSchema = createAgentResponseSchema(interviewAnalysisSchema);
const response = responseSchema.parse(untrustedOutput);
if (response.success) {
  // response.data est une InterviewAnalysis validée.
}
```

Chaque enveloppe exige `success`, `data`, `warnings`, `errors` et `metadata`.

- Succès : `success: true`, données conformes au schéma fourni, `errors: []`.
- Échec : `success: false`, `data: null`, au moins une erreur.
- Les avertissements et erreurs contiennent `code`, `message` et un `path`
  facultatif (liste de segments textuels).
- La metadata accepte `agentName`, `model`, `executionTimeMs` non négatif et
  `generatedAt` ISO 8601. Ces champs sont facultatifs ; `{}` est autorisé.

`agentResponseSchema` valide l’enveloppe avec des données JSON quelconques. Il ne
remplace pas la fabrique avec un schéma métier pour une sortie IA importante.

Les objets rejettent les clés inattendues. Les textes obligatoires ne peuvent pas
être vides ou composés uniquement d’espaces. Les identifiants et codes restent
stables, tandis que questions, descriptions et messages peuvent être traduits.
Les futurs agents restent responsables de distinguer faits, hypothèses et données
manquantes ; la validation structurelle ne prouve pas leur véracité.

## Tests

```sh
nvm use
pnpm test
pnpm lint
pnpm build
```

Vitest exécute uniquement les tests unitaires des validators, sans base de données,
secret ou accès réseau. Les tests HTTP existants restent séparés. Les exemples des
tests sont fictifs et ne sont pas des sorties générées par l’application.
