# Interview client — étape 11

## Configuration et essai manuel

Copier les variables utiles de `.env.example` dans le fichier local `.env`.
Configurer `OPENAI_API_KEY` et `OPENAI_MODEL` avec une clé du projet API et un modèle
disponible sur ce compte prenant en charge Responses et Structured Outputs.
Aucun modèle de repli n’est choisi automatiquement. Ne jamais placer la clé dans
une variable `NEXT_PUBLIC_*`, une conversation ou un fichier versionné.

```sh
nvm use
pnpm dev
```

Se connecter, ouvrir `/dashboard/projects`, créer ou sélectionner un projet puis
cliquer sur « Lancer l’interview IA ». Démarrer l’interview, répondre à la question
et actualiser la page pour vérifier la reprise. Les échanges réels consomment des
crédits API ; l’abonnement ChatGPT/Codex ne configure pas cette facturation.

Le chat affiche la conversation, un indicateur d’attente, les erreurs publiques,
la complétude estimée et les informations à préciser. Aucun appel payant n’est
déclenché par la simple ouverture de la page. Une actualisation de l’historique
n’entraîne pas de génération. Les réponses sont textuelles, limitées à 4 000
caractères. L’interface est française ; l’agent et l’API acceptent `fr` ou `en`.

## Architecture

- `server/ai/openai.ts` : client SDK exclusivement serveur, timeout 45 secondes,
  sans relance automatique. Les variables sont vérifiées au moment de l’appel,
  sans bloquer la compilation lorsqu’une clé n’est pas encore configurée.
- `server/prompts/interview-client.ts` : instructions système.
- `server/agents/interview-client.agent.ts` : validation de l’entrée, contexte,
  `responses.parse`, helper officiel `zodTextFormat`, validation Zod de la sortie,
  contrôle de la couverture et calcul du score. `store: false` désactive le
  stockage de la réponse pour la reprise chez OpenAI ; la mémoire de l’application
  est dans PostgreSQL. Cela n’est pas une garantie de rétention nulle du fournisseur.
- `server/services/interview.service.ts` : propriété du projet, historique,
  idempotence, quotas et écritures atomiques.
- `server/http/interview.ts` : session, origine des mutations, taille du corps JSON
  et erreurs publiques sans détails du SDK.

Les refus, sorties invalides/incomplètes, erreurs réseau, timeouts et erreurs de
quota sont traités explicitement. Le chat conserve le brouillon après échec.

## Endpoints

| Méthode | Route | Corps |
| --- | --- | --- |
| GET | `/api/projects/[projectId]/interview` | Aucun ; historique et état public |
| POST | `/api/projects/[projectId]/interview` | `requestId` UUID, `language` facultatif |
| POST | `/api/projects/[projectId]/interview/messages` | `requestId` UUID, `content`, `expectedLastMessageId`, `language` facultatif |

Toutes les opérations identifient l’utilisateur et vérifient le propriétaire.
Un projet absent et un projet d’un autre compte renvoient le même 404.
Les mutations nécessitent une origine autorisée et un corps JSON de 20 000 octets
maximum. Les réponses API sont marquées `Cache-Control: no-store`.

Les réponses utiles sont enveloppées dans `{ data }`, les erreurs dans
`{ error: { code, message } }`. Le public ne reçoit ni ledger d’idempotence,
ni preuves internes de couverture, ni métadonnées du fournisseur.

## Persistance et concurrence

Les modèles Prisma existants sont réutilisés, sans migration. Les messages visibles
ont le rôle `user` ou `assistant`. Le résultat validé et le modèle utilisé sont
enregistrés dans les métadonnées du message assistant. Le compteur de messages de
la page projet exclut les lignes système techniques.

Un ledger technique utilise `InterviewMessage` avec le rôle `system` et une clé
primaire déterministe issue du projet et du `requestId`. Il conserve le hash du
contenu, la tentative, l’état et une réservation de 90 secondes. Un verrou
transactionnel PostgreSQL par propriétaire protège la réservation, les quotas et
la finalisation. L’appel OpenAI se déroule hors transaction.

Une demande terminée est relue sans appel IA ni message en double. Réutiliser la
même clé avec un autre contenu renvoie 409. Une demande en cours bloque un autre
envoi sur le même projet ; une réservation expirée peut être retentée et une
ancienne tentative ne peut plus finaliser de messages. Le corps utilisateur et la
réponse IA sont écrits ensemble après succès. En cas d’échec, le brouillon n’est
pas persisté comme message confirmé. Le statut passe de `DRAFT` à `INTERVIEW`
uniquement au premier succès ; les autres statuts sont préservés.

Le navigateur conserve la clé de demande tant qu’il retente le même contenu.
Après une interruption, actualiser l’historique avant de recommencer. L’identifiant
du dernier message attendu protège aussi les réponses envoyées depuis un onglet
dépassé.

## Limites MVP

- 40 tentatives par propriétaire sur 24 heures, 5 par minute, 3 secondes entre
  appels sur un même projet, 3 tentatives par clé de demande.
- Au plus 200 messages visibles par interview, 30 messages récents et 32 000
  caractères d’historique envoyés au modèle, contexte total limité à 64 000
  caractères et sortie limitée à 8 000 tokens. Le dernier état validé conserve la
  mémoire synthétique des échanges plus anciens.
- Les limites sont persistantes, partagées entre processus ; elles ne constituent
  pas un plafonnement monétaire exact. Fixer aussi un budget/une alerte dans le
  compte fournisseur. Un timeout peut avoir consommé des crédits ; les relances
  explicites sont bornées, sans garantie de facturation exactement une fois.
- Pas de streaming, de pièce jointe ni de portail client public dans cette étape.
- Aucune garantie de vérité des déclarations du modèle : vérifier le cadrage avec
  le client. Les générations de cahier des charges relèvent de l’étape 12.

## Tests

```sh
pnpm test
pnpm lint
pnpm build
node --test tests/interview.integration.test.mjs
# Chrome local requis pour le contrôle du chat :
INTERVIEW_VISUAL_TEST=1 node --test tests/interview.integration.test.mjs
```

Vitest simule OpenAI et Prisma, sans clé ni accès réseau. Le test intégré utilise
la base de développement, des comptes temporaires supprimés à la fin, un serveur
Next.js local (port 3111) et un faux fournisseur OpenAI local (port 3112). Il
remplace les variables OpenAI uniquement dans ce processus de test. Il n’émet
aucune requête vers OpenAI et ne modifie pas `.env`. Les captures Chrome sont
écrites dans `/tmp/briefpilot-interview-375.png` et `1440.png`.
