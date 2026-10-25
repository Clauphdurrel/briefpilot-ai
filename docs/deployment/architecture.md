# Architecture d'hébergement — étape 24

Cible : Next.js App Router sur Vercel, PostgreSQL Neon séparé pour staging et production, moteur PDF dans un worker Docker approuvé. La préparation ne crée aucune ressource cloud et n'active aucun déploiement.

Le navigateur appelle les routes Next.js avec sa session. Next.js vérifie l'utilisateur, l'ownership des versions choisies et les quotas, construit les templates HTML existants puis appelle le worker. Le worker n'a ni accès PostgreSQL, ni clé OpenAI, ni session utilisateur. Les PDF reviennent en mémoire à Next.js ; aucun document n'est stocké dans une URL publique ou sur disque persistant. Le serveur ne retourne un téléchargement qu'après validation du type, du préfixe et de la taille.

## Audit de compatibilité Vercel

Versions constatées : Next 16.4.1, Prisma 7.10.1, Playwright 1.64.1, Node 24.18.0, pnpm 11.9.0. Les routes critiques déclarent Node.js ; les délais existants de 60 s sont conservés. OpenAI a déjà un timeout de 45 s sans retry automatique ; PDF est limité à 35 s et le transport worker à 40 s. Pas d'Edge pour Prisma/crypto/PDF.

Le code initial lançait Chromium dans Next.js : il est désormais isolé dans `pdf-engine.mjs` et appelé localement uniquement hors Vercel. Sur Vercel, `PDF_RENDER_MODE=worker` est obligatoire ; aucune panne du worker ne déclenche de fallback Chromium local. Le traçage exclut Playwright et infra de l'artefact Vercel. Le build génère Prisma mais ne migre aucune base.

La limite applicative PDF locale est 8 Mio ; en transit via une fonction Vercel le client refuse au-delà de 4 Mio avant commit du quota, sous la limite plateforme de 4,5 MB. Les documents plus grands nécessiteront ultérieurement un téléchargement privé par stockage approuvé ou streaming validé. [Limites officielles Vercel](https://vercel.com/docs/functions/limitations).

Les slots PDF locaux ne constituent pas une limite distribuée entre instances. Le worker impose deux rendus par processus et un par pseudonyme utilisateur, sans queue ; dimensionner les réplicas en tenant compte des quotas et de cette limite. La sonde HTTP est une liveness, pas un test de dépendance. Pool PostgreSQL, région et capacité du worker restent à vérifier sur les comptes réels.

## Sécurité avant staging

- Séparer comptes, bases et clés development/staging/production ; aucun partage automatique avec les PR externes.
- Worker HTTPS, secret serveur aléatoire distinct, liste des opérateurs autorisés, pas de port renderer public sans authentification.
- Cookies/session Auth.js, ownership, CSRF/origin et signatures des webhooks restent actifs.
- Aucune production, migration distante, souscription payante ou donnée client n'est activée par cette préparation.

Voir [worker](pdf-worker.md), [base](database.md), [Vercel](vercel.md), [variables](environment-variables.md), [rollback](rollback.md) et [coûts](cost-estimation.md).
