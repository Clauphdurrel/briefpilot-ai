# Validation de l’étape 27

Contrôles locaux du 25 octobre 2026. Aucun déploiement, appel OpenAI réel, paiement, ressource payante ou écriture de données distantes. Les parcours dynamiques utilisent une base PostgreSQL locale jetable et des fournisseurs simulés. Les captures ne contiennent que le projet fictif Café Aube.

## Résultats

| Contrôle | Résultat |
| --- | --- |
| Lint | Réussi : pnpm lint |
| Build de production | Réussi : Prisma generate + Next.js build, Turbopack et TypeScript |
| Vitest | 663 tests réussis, 39 ignorés par les garde-fous de suites d’intégration opt-in |
| Intégration PostgreSQL/API complète | 133 tests réussis sur base locale jetable : quotas, concurrence, auth, documents, exports PDF/Markdown et Lemon simulé ; cinq exemples PDF existants restaurés octet par octet |
| Playwright complet | 37 réussis ; 2 matrices de captures redondantes ignorées, les cinq tailles étant vérifiées dans le projet desktop |
| Revalidation marketing après corrections | 10 réussis, 2 matrices redondantes ignorées |
| Responsive | 320, 375, 768, 1280, 1440 px ; pas de débordement horizontal, CTA principaux ≥ 40 px, reduced motion vérifié |
| Navigation | Header desktop/mobile, Escape et focus du menu, CTA vers login, ancre workflow, FAQ au clavier, six pages complémentaires |
| SEO | H1 unique, title/canonical/OG, image OG PNG 200, JSON-LD sans avis/prix inventés, staging noindex, robots interdisant / et sitemap vide |
| Dashboard | Parcours existants exécutés avec sessions réelles locales, isolation entre comptes, briefs/backlogs, exports, quotas et checkout simulés |
| Axe | Aucune violation détectée aux cinq tailles après corrections ; certaines vérifications de contraste de l’illustration transformée restent automatiques incomplètes |

Les assertions spécifiques sur le nom accessible du logo et X-Robots-Tag des API ont également été ajoutées aux tests navigateur.

## Lighthouse réel

Mesure sur le serveur local du build optimisé, Chrome headless, simulation mobile par défaut et preset desktop. Résumés et version exacte dans [lighthouse.json](validation/lighthouse.json).

| Indicateur | Mobile | Desktop |
| --- | ---: | ---: |
| Performance | 93 | 100 |
| Accessibilité | 100 | 100 |
| Best Practices | 100 | 100 |
| SEO | 66 | 66 |
| LCP | 1,9 s | 0,5 s |
| CLS | 0 | 0 |
| Total Blocking Time | 310 ms | 30 ms |

Le score SEO est pénalisé par `is-crawlable` : le staging doit rester non indexable. L’objectif SEO ≥95 sur un domaine commercial réellement indexable n’est **pas** annoncé atteint. Aucune protection n’a été retirée pour améliorer un score. Le TBT n’est pas l’INP : aucune mesure terrain INP ni validation des Core Web Vitals réels n’est disponible. Ces diagnostics varient selon la machine et ne garantissent pas les performances d’un futur déploiement.

## Inspection visuelle et accessibilité

Les captures du hero ont été réellement inspectées aux cinq tailles, ainsi que la page complète desktop. Hiérarchie, espacement, intégrité des cartes, navigation et libellés ont été examinés. Aucun faux dashboard présenté comme une capture réelle. Deux défauts constatés ont été corrigés : repère violet trop clair sur fond lavande, et nom accessible du logo. Voir [revue détaillée](review.md).

Pour les textes de la miniature dont le contraste est difficile à calculer automatiquement à cause de la transformation CSS, les paires de couleurs opaques ont été vérifiées : ratios de 4,64:1 à 7,17:1 ; repère corrigé 5,67:1. Cela ne vaut pas certification WCAG 2.2 AA. Une validation humaine plus large reste souhaitable pour le lancement.

Captures réelles : [hero desktop](validation/hero-1440.png), [hero mobile](validation/hero-375.png), [page 320](validation/landing-320.png), [375](validation/landing-375.png), [768](validation/landing-768.png), [1280](validation/landing-1280.png), [1440](validation/landing-1440.png). Rapport [axe](validation/accessibility.json).

## Reproduction et limites de l’environnement

Node 24, pnpm 11.9. Commandes demandées exécutées : pnpm lint ; pnpm build ; pnpm exec vitest run ; pnpm exec playwright test. Le lanceur pnpm build local a rencontré une interdiction de port dans son sous-processus ; l’exécution directe des mêmes commandes Prisma/Next a réussi avec deux workers (`CIRCLE_NODE_TOTAL=3`). Aucune modification du build de l’application n’a été faite pour contourner la validation de types. La première exécution Vitest très parallèle a subi trois timeouts ; relance avec `--maxWorkers=2` : suite exécutée entièrement réussie, sans augmentation des délais des tests.

Lighthouse, axe et Prettier ont été installés uniquement dans /tmp, sans ajout de dépendance runtime ou de plugin. Les fonctionnalités privées restent protégées par leurs contrôles serveur existants. La collecte PostHog externe n’a pas été activée ; ses transports sont mockés dans les tests.

## Validation opérateur

L’opérateur a explicitement validé l’apparence et les textes le 25 octobre 2026, ainsi que la fusion de la PR #8 après réussite de tous ses contrôles. Les résultats distants sont consultables dans les [contrôles de la PR #8](https://github.com/Clauphdurrel/briefpilot-ai/pull/8/checks). La fusion reste conditionnée à leur réussite ; aucun déploiement ni étape 28/29 n’est autorisé par cette validation. Le domaine, le contact et les pages légales sont volontairement préparés sans information inventée.
