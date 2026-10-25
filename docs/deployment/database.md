# PostgreSQL managé — préparation

Architecture prévue : développement PostgreSQL Docker local, Neon staging indépendant, production indépendante à créer plus tard. Le runtime utilise DATABASE_URL poolée ; Prisma 7 configure la connexion CLI dans prisma.config.ts, à préparer avec DIRECT_URL et fallback local contrôlé. Aucun changement de modèle n'est nécessaire pour cette infrastructure.

À l'étape 25, créer un projet Neon staging (région proche de Vercel), base briefpilot_staging, obtenir ses connexions poolée/directe via le gestionnaire de secrets ou un fichier .env.staging.local ignoré, chmod 600. Ne pas remplacer .env local ni transmettre les URLs dans le chat.

Les migrations versionnées doivent d'abord réussir sur une base locale neuve. Vérifier la cible distante en lecture seule, l'environnement, le schéma et l'absence de données clients avant une application autorisée via migrate deploy. Ne jamais utiliser migrate reset, db push ou migrate dev sur la base partagée. Garder la migration hors du build Vercel.

Les sauvegardes, fenêtres de restauration, quotas de connexion et droits dépendent du plan Neon sélectionné : vérifier les paramètres réels, consigner RPO/RTO et tester une restauration sur une branche séparée. Une branche dérivée de production copie ses données : ne pas la confondre avec un staging sans données clients. Aucun backup cloud n'est déclaré actif par cette préparation.

[Neon et Prisma](https://neon.com/docs/guides/prisma), [connexions Prisma 7](https://www.prisma.io/docs/postgres/database/connecting-to-your-database). Le guide sera enrichi avec les commandes staging dédiées à l'étape 25.
