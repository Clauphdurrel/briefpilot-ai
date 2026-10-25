# Audit du staging — étape 26

État au 25 octobre 2026 : **application Preview et connexion Google validées, worker PDF Preview fonctionnel sur document synthétique et configuration de connexion appliquée à l’application. L’étape 26 reste en cours : générations IA différées faute de crédit, paiements Test, monitoring et parcours entre deux comptes non encore validés en ligne.**

## Déploiements de référence

| Composant | Source et preuve |
| --- | --- |
| App | Commit develop `5cdb0a1af61bc48a43dc2134c2ad3cf2882ba4d1`, arbre identique à la PR #6 validée ; PR #2 à #6 fusionnées dans l’ordre ; main inchangée |
| CI du code app | Six jobs réussis : [run 40212326189](https://github.com/Clauphdurrel/briefpilot-ai/actions/runs/40212326189) |
| Preview app avec connexion PDF et Lemon Test | `dpl_5NrSUN5eg6tTb5h5szGT9YM7mKB7`, **READY**, target non-production, ref develop ; noms Auth/Neon/OpenAI/PDF et six paramètres Lemon effectivement présents |
| Alias app | https://briefpilot-ai-git-develop-duramite32-3695s-projects.vercel.app |
| Worker Preview | `dpl_8Zf4f9uk3YCSAXJHrT9wfh41CHtP`, **READY**, target non-production, secret PDF Preview présent |
| Source worker | Branche de livraison `deploy/pdf-worker-staging`, commit `0ca72df65052d730a5b5ca32abe4d6827bdb6304` ; 9 fichiers publics ; cinq fichiers source/package comparés octet par octet à l’app validée 5cdb0a1, configuration de livraison Git explicitement manuelle |
| Alias worker | https://briefpilot-pdf-worker-staging-duramite32-3695s-projects.vercel.app |

La branche worker est un **artefact isolé**, pas une fonctionnalité à fusionner dans develop/main : son Dockerfile.vercel racine sélectionne le runtime conteneur. L’application garde son framework Next.js. Aucun fichier .env, note personnelle ou credential n’a été publié dans cet artefact.

Compte Vercel duramite32-3695, équipe duramite32-3695s-projects, offre Hobby. Aucun passage à Pro, achat de crédits OpenAI, paiement réel ou modification du schéma Neon pour ces déploiements.

## Contrôles réellement exécutés

| Contrôle | Résultat / limites |
| --- | --- |
| Code / tests | 641 tests unitaires locaux, lint, TypeScript et build VERCEL=1 réussis ; CI app six jobs réussis, dont PostgreSQL/API, navigateur et worker |
| Neon staging | TLS client/certificat vérifiés ; 6 migrations autorisées appliquées, 16 tables, historique up-to-date ; aucun reset, db push ni seed |
| Prisma réel | Test opt-in readonly réussi : SELECT 1 et lectures de modèles sans fixtures distantes |
| Google / session | L’opérateur atteint le dashboard après Google ; transaction READ ONLY indépendante : 1 compte Google lié, 1 session non expirée ; aucun identifiant personnel ni token affiché |
| HTTPS app | Accès public toujours protégé (302) ; après autorisation du jeton app, GET /api/health répond 200 avec seulement status=ok ; TLS accepté |
| Worker cloud — santé | GET /health avec accès serveur autorisé : 200 et seulement status=ok ; alias public protégé |
| Worker cloud — auth | POST /render avec bypass Vercel mais sans auth worker : 401 ; corps modifié avec signature invalide : 401 |
| Worker cloud — PDF réel | 200, type application/pdf, magic %PDF-, PDF borné à 4 Mio ; texte/accents vérifiés avec pdftotext ; script inerte et absence du marqueur /etc/passwd |
| Worker cloud — rejeu | Même requête signée refusée avec 409 sur l’instance testée ; cache et concurrence restent par processus, pas globaux sous autoscaling |
| Sandbox | Le moteur et l’image conservent chromiumSandbox=true et USER pwuser ; aucun --no-sandbox ni capability hôte ajoutée. Docker local valide également non-root, read-only, seccomp, concurrence et arrêt |
| Connexion app → worker | PDF_WORKER_URL stable et PDF_WORKER_VERCEL_BYPASS_SECRET sensible appliqués au Preview app ; aucune valeur de secret affichée |
| Export PDF métier | Non testé avec un document authentifié depuis l’app : les documents IA réels restent à générer quand le compte OpenAI aura du crédit |
| OpenAI | Clé/modèle présents, modèle gpt-4.1-mini ; opérateur sans crédit API pour l’instant, aucune génération exécutée par l’agent |
| Lemon Squeezy | Catalogue distant vérifié : EUR, variantes Test mensuelles fixes 19/59 EUR ; six variables actives en Preview/develop. Webhook Test 146164 créé avec dix événements après accord distinct ; signature absente refusée 401, JSON invalide signé reconnu puis refusé 400. Livraison fournisseur, checkout et synchronisation canonique encore à vérifier ; aucun paiement lancé |
| Sentry/PostHog / BOLA | Projets/réception d’événements distants et isolation entre deux comptes non vérifiés ; collecte externe désactivée |

Pour la modification du générateur d’artefact et des guides : le test Docker de l’artefact Vercel a réussi, ainsi que le lint et git diff --check. La nouvelle tentative de build local n’a pas abouti : Turbopack rencontre une interdiction d’ouvrir un port dans cet environnement ; la tentative Webpack échoue à lire la sortie TypeScript --showConfig. Ces tentatives ne remplacent pas le build précédent réussi ni la CI ; ne pas les annoncer comme réussies. Aucun fichier applicatif n’a été modifié dans cette mise à jour documentaire et de livraison.

## Secrets et autorisations

Fichier .env.staging.local ignoré et protégé 600. Dans l’app, uniquement Preview/develop : DATABASE_URL poolée, AUTH_SECRET, PDF_WORKER_SECRET, ANALYTICS_HMAC_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, OPENAI_API_KEY et PDF_WORKER_VERCEL_BYPASS_SECRET sont sensibles. AUTH_URL, PDF_WORKER_URL et OPENAI_MODEL sont non secrets ; mode staging, rendu worker et Lemon Test imposés. DIRECT_URL reste local.

Le worker reçoit son seul secret métier PDF_WORKER_SECRET en Preview. Un jeton Automation dédié au **projet worker** a été créé après autorisation et stocké côté serveur dans l’app Preview/develop et le fichier privé de probe. Sa portée couvre les déploiements du projet worker, pas seulement /render. Aucun token de compte Vercel, identifiant Neon, clé OpenAI ou secret Google transmis au worker. Signatures HMAC et contrôle d’accès du worker restent actifs après le bypass de la protection Vercel.

Le secret de signature Lemon Squeezy a été généré sans affichage ; le catalogue Test a été vérifié et les paramètres stockés chez Vercel après consentement. Les deux secrets Lemon sont sensibles, les quatre identifiants/mode Test non secrets, tous limités à Preview/develop. Un accord distinct a ensuite autorisé la création d’un jeton Automation dédié au projet app et sa transmission dans l’URL privée à Lemon Squeezy avec le secret de signature, puis la création du webhook Test. Le jeton couvre tous les déploiements du projet app ; il est distinct du jeton worker et ne remplace ni Auth.js ni la signature. Aucun achat/paiement réel ni activation Live autorisé ou exécuté. L’URL contenant ce jeton reste privée, sans publication dans les guides, logs ou PR.

## Incident : premier déploiement Vercel et déploiements automatiques

La règle a été confirmée dans [la documentation Vercel](https://vercel.com/docs/deployments/environments#first-deployment) : le premier déploiement d’un projet est classé Production même avec une cible Preview ou une branche différente. Un enregistrement ERROR/CANCELED compte ; un déploiement supprimé ne compte plus. Les premiers essais worker, retirés par précaution avant autorisation d’exception, remettaient donc le projet à zéro et reproduisaient cette règle.

Le contrôle étendu a aussi identifié un ancien déploiement automatique app issu de la fusion PR #2 (421349e…), étiqueté Production, et un Preview de l’artefact worker dans le projet app. Ces déploiements identifiés comme issus de nos actions ont été supprimés ; les Preview validés ont été conservés. Aucun secret applicatif n’a été ajouté aux variables Production et aucune donnée Neon n’a été supprimée. Le simple réglage projet createDeployments=disabled n’a pas suffi dans ce parcours ; le paquet worker contient désormais git.deploymentEnabled=false, comme la configuration app.

Après accord explicite de l’opérateur pour une unique initialisation technique du seul worker, un paquet sans code applicatif, FROM scratch avec une commande inexistante, a créé `dpl_81zvZ3zU9DzdWMHKSf1TQSd5nFdf`. Il s’est arrêté en **ERROR** avant de produire une image exécutable. Conservé temporairement, il a permis le vrai Preview 8Zf4… avec ses variables Preview. Une fois le PDF réel vérifié, l’initialisation échouée a été supprimée ; le worker Preview restant évite de réinitialiser le cas « premier déploiement ».

Ne pas recréer un bootstrap sans autorisation ni copier les secrets staging dans Production pour contourner cette règle. Ne pas supprimer tous les déploiements d’un projet actif sans comprendre l’effet sur le prochain déploiement.

## Incident OAuth résolu

Les premiers Preview CLI app étaient Ready sans les variables Preview/develop : les logs récents indiquaient AUTH_CONFIGURATION_ERROR. Le déploiement GitHub natif sur le SHA/ref réels a appliqué ces variables. Le callback exact a ensuite été comparé au redirect_uri envoyé ; après correction côté client Google, l’opérateur a atteint le dashboard et Neon a confirmé la session.

```text
https://briefpilot-ai-git-develop-duramite32-3695s-projects.vercel.app/api/auth/callback/google
```

Un statut Ready ne prouve ni l’application des variables ni un parcours fonctionnel. Sur Hobby, la lecture des logs a été limitée à une fenêtre récente (--since 5m) après refus d’une fenêtre hors rétention.

## Ce qui reste pour terminer l’étape 26

1. Charger le crédit OpenAI à l’initiative de l’opérateur, puis valider les trois agents, leur persistance et les quotas sur données fictives. Voir [budget de démo](cost-estimation.md).
2. Terminer [Lemon Squeezy Test](lemonsqueezy-staging.md) : effectuer un checkout fictif depuis le compte utilisateur, vérifier la livraison fournisseur au webhook configuré, l’idempotence et le statut canonique de l’offre.
3. Tester l’export Markdown et PDF authentifié avec un document réel de test, les refus/erreurs et le respect des quotas.
4. Configurer les projets Sentry/PostHog staging et vérifier une réception synthétique autorisée.
5. Tester logout/reconnexion, deux comptes distincts, l’isolation projet/documents et l’accès privé des amis. Voir [démo privée](private-demo.md).

Aucun feu vert production commerciale. Le rejeu/concurrence entre plusieurs instances, le budget exact des services, sauvegardes/RPO/RTO et limites du compte restent à traiter avant lancement.
