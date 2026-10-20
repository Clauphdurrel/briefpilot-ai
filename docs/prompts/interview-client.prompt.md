# InterviewClientAgent

Le prompt système exécuté par l’application se trouve dans
[`src/server/prompts/interview-client.ts`](../../src/server/prompts/interview-client.ts).
Il est importé côté serveur et versionné avec l’agent. Ce fichier décrit son contrat
sans dupliquer le texte exécuté.

## Rôle et comportement

Business Analyst senior spécialisé dans les projets numériques : site vitrine,
e-commerce, SaaS, mobile, ERP/outil interne, automatisation et autre.

Le contexte initial, les réponses et le précédent état de l’analyse sont fournis
comme données utilisateur distinctes des instructions système. L’agent adapte ses
questions au projet et à l’historique, pose une question principale à la fois,
évite les répétitions et distingue faits confirmés, hypothèses et informations
absentes ou ambiguës. Il ne dispose d’aucun outil ni accès à la base ou aux secrets.

## Couverture et complétude

Les 17 catégories de besoins sont : contexte, problème, objectifs, utilisateurs,
fonctionnalités, pages/écrans, parcours, rôles/permissions, contenus, identité
visuelle, intégrations, données, technique, réglementation, budget, délais et
critères de réussite. La détection des informations manquantes est une analyse
transversale, pas une catégorie supplémentaire.

Chaque catégorie apparaît une seule fois avec `missing`, `partial` ou `confirmed`.
Une donnée partielle ou confirmée doit avoir une preuve textuelle issue des
informations client. Une hypothèse ne constitue pas une preuve.

Le serveur recalcule le pourcentage : `confirmed = 1`, `partial = 0.5`,
`missing = 0`, divisé par 17 puis arrondi. Le nombre de messages n’intervient pas.
Ce score indique une couverture estimée ; il ne certifie ni la véracité des faits
ni la faisabilité du projet.

`message` contient le texte affiché au client. `nextQuestion` décrit la question
posée et n’est nul que lorsque la couverture est complète. Les besoins absents
restent dans `missingInformation`, sans valeur inventée.

## Exemple fictif d’entrée

```json
{
  "project": { "name": "ImmoConnect", "type": "SAAS", "description": "Gestion immobilière pour les agences au Sénégal." },
  "history": [],
  "knownInformation": [],
  "previousAnalysis": null,
  "language": "fr"
}
```

## Exemple fictif de sortie

Le fichier [`interview-client.example.json`](interview-client.example.json) contient
un exemple complet de sortie conforme au schéma réseau. Il sert aux tests et à la
lecture du contrat ; l’application ne l’utilise jamais comme réponse de secours.

Source de l’intégration : [Structured Outputs, documentation OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs).
