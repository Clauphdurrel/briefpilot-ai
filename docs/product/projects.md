# Module Project — étape 9

Un utilisateur connecté peut créer un projet, consulter sa liste et ouvrir son détail.
Les types disponibles sont : site vitrine, e-commerce, SaaS, application mobile,
outil interne, automatisation et autre. Chaque nouveau projet est un brouillon.

Le nom est obligatoire (2 à 120 caractères après suppression des espaces de début
et de fin). La description est facultative et limitée à 2 000 caractères.
Les données sont validées côté serveur avec Zod ; le propriétaire provient de la
session et ne peut pas être choisi par le formulaire.

La liste présente uniquement les projets du propriétaire, du plus récent au plus
ancien. Le détail d’un projet absent ou appartenant à un autre compte affiche le
même écran « Projet introuvable ». Les compteurs de messages et de briefs sont lus
dans Prisma. L’interview IA sera disponible lors d’une prochaine étape.

Le chargement et les erreurs de lecture utilisent les écrans communs du dashboard.
Les erreurs de création sont affichées dans le formulaire sans détails techniques.

## Vérification locale

Avec Node.js sélectionné par `nvm use` :

```sh
pnpm lint
pnpm build
pnpm start --hostname 127.0.0.1 --port 3109
```

Dans un autre terminal :

```sh
AUTH_TEST_URL=http://localhost:3109 node --test tests/*.integration.test.mjs
```

Les tests utilisent la base de développement configurée et des comptes temporaires
supprimés en fin d’exécution. Ils couvrent l’authentification, la navigation, la
création et la séparation des projets entre utilisateurs.

La modification, la suppression, l’interview et les générations IA sont hors du
périmètre de cette étape.
