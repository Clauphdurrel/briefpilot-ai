# Stratégie SEO — BriefPilot AI

## Configuration et garde-fous

`SITE_URL` définit une origine canonique explicite (HTTPS, sans credentials, chemin, paramètres ou fragment). Faute de domaine définitif fourni par l’opérateur, aucun domaine commercial n’est inventé. Repli : `AUTH_URL` si son origine est valide, sinon localhost pour le développement. La validation Zod empêche de refléter un secret d’URL dans les métadonnées.

L’indexation nécessite simultanément : `SITE_INDEXING_ENABLED=true`, `APP_ENV=production`, `NODE_ENV=production`, une origine SITE_URL HTTPS valide hors localhost/vercel.app et, sur Vercel, `VERCEL_ENV=production`. Tout autre cas reste noindex. Ne pas activer ces valeurs pour le staging. Ces variables sont lues lors du build des routes statiques : reconstruire après une modification.

Hors production approuvée : robots.txt interdit `/`, sitemap vide et métadonnées/headers X-Robots-Tag noindex. Les pages privées conservent leurs vérifications Auth.js et d’autorisation ; robots.txt ne contrôle jamais les accès. Le layout dashboard, login et les routes API sont explicitement exclus de l’indexation. Aucun identifiant de projet/document n’entre dans le sitemap.

## Routes publiques prévues

| Route                    | Intention                                                        | Indexation après configuration production |
| ------------------------ | ---------------------------------------------------------------- | ----------------------------------------- |
| /                        | Assistant de cadrage et générateur de cahier des charges IA      | Oui                                       |
| /features                | Logiciel de brief client, collecte de besoins, backlog technique | Oui                                       |
| /how-it-works            | Préparation de projet SaaS/site web, méthode de cadrage          | Oui                                       |
| /pricing                 | Plans et quotas                                                  | Oui                                       |
| /contact                 | Canal non défini                                                 | Non pour l’instant                        |
| /privacy, /terms         | Brouillons à compléter                                           | Non                                       |
| /login, /dashboard, /api | Accès compte et données privées                                  | Non                                       |

## Métadonnées

Les Metadata APIs Next.js fournissent title, description, metadataBase, canonical, Open Graph et Twitter Card. `src/app/opengraph-image.tsx` génère une image 1200×630 sans ressource distante. Chaque page a un H1 unique, des H2 de section et des liens internes. Pas de multiplication artificielle de pages ni de répétition forcée de mots-clés.

JSON-LD : `SoftwareApplication`, nom du produit, catégorie BusinessApplication, plateforme Web, langue, origine et description. Aucun avis, note, prix commercial actif ou société juridique inventé. Pas de promesse de résultat enrichi Google : les propriétés exigées pour certains enrichissements (notamment avis/notes) ne sont pas fabriquées. Organization et BreadcrumbList ne sont pas ajoutés sans besoin/informations appropriés.

## Avant une publication commerciale ultérieure

Renseigner le domaine réellement détenu et validé, compléter les pages légales/contact, vérifier les liens et autorisations d’inscription, puis décider explicitement d’autoriser l’indexation. Les étapes 28/29 et la publication ne sont pas réalisées par cette tâche.

Références : [Metadata et OG Next.js](https://nextjs.org/docs/app/getting-started/metadata-and-og-images), [robots.ts](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots), [sitemap.ts](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap), [SoftwareApplication — Google Search Central](https://developers.google.com/search/docs/appearance/structured-data/software-app).

En production explicitement approuvée, login, contact et brouillons légaux restent explorables pour que les robots puissent lire leur noindex ; ils sont absents du sitemap. Seuls dashboard et API sont disallowed. Ne pas confondre blocage d’exploration et non-indexation : un robot bloqué ne lit pas la directive noindex. Le staging conserve son blocage global et sa protection d’accès. [Consigne Google sur noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
