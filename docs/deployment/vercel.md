# Préparation Vercel

Aucun projet Vercel ni déploiement n'est créé automatiquement. Préparer un projet Next.js avec root `./`, Node 24.x et pnpm 11.9.0 (packageManager), production branch main, staging sur develop uniquement. Vérifier les limites et la disponibilité du runtime dans le compte sélectionné. [Runtime Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

`pnpm build` exécute `prisma generate && next build`, sans migrate deploy. Le build ne doit pas contacter une base Docker locale ni un fournisseur réel. Des valeurs synthétiques suffisent aux checks de build ; les vrais secrets staging sont fournis uniquement au runtime/Preview approprié. Ne pas lancer de migration depuis install/build.

Sur Vercel, le renderer local est interdit et les packages Playwright sont exclus du traçage. Configurer PDF_RENDER_MODE=worker et une URL HTTPS approuvée ; sans worker, le PDF échoue explicitement. Ne pas remplacer ce contrôle par un faux succès ou un conteneur Chromium embarqué sans audit.

Conserver les budgets applicatifs 60 s existants plutôt que de choisir la durée maximale commerciale. Vérifier les paramètres effectifs Fluid Compute, région, mémoire et plan avant le déploiement. Les chiffres dépendant du compte/bêta doivent être relus dans le dashboard ; le code ne compte pas sur une extension bêta.

Avant de connecter Git pour des déploiements automatiques, intégrer après revue les PR préparatoires sur develop et configurer uniquement les variables Preview de cette branche. Ne pas démarrer main sans configuration production. Vercel Authentication peut bloquer OAuth et webhooks : prévoir une exception restreinte appropriée au plan, sans retirer la signature Lemon ni les contrôles Auth.js.

Voir [variables](environment-variables.md), [base](database.md) et [rollback](rollback.md). L'audit staging de l'étape 26 doit consigner une URL réelle et les tests exécutés ; un build seul n'est pas une validation en ligne.
