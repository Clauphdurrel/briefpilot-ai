# Worker PDF Docker

Le worker réutilise `pdf-engine.mjs`, extrait du renderer existant : mêmes règles A4, templates générés dans Next.js, contexte offline, JS et service workers désactivés, requêtes réseau bloquées, sandbox Chromium active. Seules les sources nécessaires et trois dépendances (Playwright/Zod/Pino) sont copiées. L'image officielle Playwright 1.64.1 linux/amd64 est verrouillée par digest ; le lock npm du worker est séparé et ses versions doivent rester alignées avec l'app. ARM n'est pas validé.

## Construire et vérifier localement

```bash
pnpm test:pdf-worker
pnpm test:pdf-worker:docker
```

Prérequis : Docker, Node 24 et poppler-utils sur l'hôte du test. Le script construit l'image, crée son propre conteneur à nom aléatoire sur un port loopback libre, teste PDF/accents, non-exécution des scripts/fichiers, auth, rejeu, concurrence et arrêt, puis supprime uniquement son conteneur temporaire. Il ne touche pas aux autres services Docker ni aux bases.

Pour un lancement manuel durable de développement, créer un fichier secret hors dépôt/build context (chmod 600), définir PDF_WORKER_SECRET_FILE vers ce fichier et lancer `docker compose -f docker-compose.pdf.yml up --build -d`. Configurer l'application locale : PDF_RENDER_MODE=worker, PDF_WORKER_URL=http://127.0.0.1:3193 et le même secret côté serveur. L'exception HTTP ne fonctionne qu'en développement loopback ; staging/production/Vercel imposent HTTPS.

## Protocole

GET /health renvoie uniquement status=ok sans cache ; aucune donnée métier ni détail système. POST /render requiert Bearer serveur, timestamp ±60 s, nonce UUID unique et HMAC SHA-256 liant timestamp/nonce/hash du corps. L'app dérive un owner HMAC sans transmettre son ID brut. Une modification du corps, une signature expirée ou un rejeu sont refusés. Le cache de nonces est borné à 10 000, TTL 180 s ; en saturation, refus, pas d'éviction permettant un rejeu. Il est effacé au redémarrage et n'est pas partagé entre réplicas : prévoir une seule instance staging ou un stockage distribué de nonces avant réplication.

Corps strict {html,owner} validé Zod, HTML ≤2 Mio, PDF ≤8 Mio, lecture de corps limitée, délai HTTP entrant 5 s, rendu 35 s, client 40 s, sans retry ni redirection HTTP. Les erreurs publiques sont des codes fixes. Les logs Pino contiennent seulement event/requestId/statusCode/durationMs. Aucun HTML, secret, owner, document ou stack n'est journalisé. Le worker ne persiste pas les documents.

## Conteneur et hébergement

Non-root pwuser, rootfs read-only, tmpfs /tmp 256 Mio, shm 256 Mio, 2 Gio RAM, 2 CPU, 256 PID, deux rendus maximum, arrêt SIGTERM avec délai 45 s. `cap_drop: ALL`, no-new-privileges, profil seccomp dérivé du profil Playwright officiel. L'ajout isolé du syscall chroot permet à Chromium de s'isoler dans son user namespace lorsque toutes les capabilities du conteneur sont retirées ; il n'accorde aucune capability hôte. [Recommandations Playwright Docker](https://playwright.dev/docs/docker).

Le fournisseur doit supporter l'utilisateur non-root, les namespaces/sandbox et ces paramètres. Si sa plateforme empêche la sandbox, choisir une cible compatible ; ne pas ajouter --no-sandbox, privileged ou SYS_ADMIN pour faire passer le test. Le port local est publié uniquement sur loopback ; le staging doit utiliser un ingress HTTPS authentifié, limiter l'accès et ne transmettre de documents qu'à un fournisseur approuvé.

Créer les ressources et configurer le domaine/secret relèvent d'une intervention de l'opérateur. Ne jamais copier la clé OpenAI, les connexions Neon ou OAuth dans ce worker. Rotation : nouveau secret coordonné app/worker, invalider l'ancien, retester auth/rejeu et documents synthétiques. Une réponse 503 du worker ne déclenche aucun fallback local sur Vercel.

## Cible Vercel Container Images (étape 26)

Vercel accepte désormais les fonctions basées sur une image Docker, en bêta sur tous les plans. Le worker peut donc être préparé comme projet séparé ; l'application garde le framework Next.js. Ne jamais placer `Dockerfile.vercel` à la racine de l'application : il changerait sa détection de framework.

```bash
pnpm pdf:worker:prepare-vercel
pnpm test:pdf-worker:vercel-artifact
```

La préparation copie uniquement cinq fichiers source/package dans un répertoire temporaire unique, puis ajoute Dockerfile.vercel, son ignore, vercel.json et une notice. Aucun secret, fichier .env ou déploiement. Le test construit ce paquet réel et vérifie le rendu PDF avec sandbox dans Docker local. Ce résultat ne prouve pas encore la compatibilité du runtime cloud.

Adaptations Vercel : PORT=8080, PDF limité à 4 Mio, corps JSON limité à 4 Mio côté client, rendu limité à 25 s et arrêt à 29 s pour conserver une marge sous les 30 s de terminaison de la plateforme. La limite de réponse Functions documentée est 4,5 MB. Le délai client de 40 s n'est pas allongé. Aucun fallback local ni désactivation de sandbox.

Le projet `briefpilot-pdf-worker-staging` est préparé dans la même équipe et région London que l'application et Neon. Son seul secret est PDF_WORKER_SECRET, dans Preview. Aucun accès Neon, OAuth ou OpenAI. La protection Preview Vercel est conservée ; il faudra prévoir un accès serveur autorisé et limité pour l'appel app → worker, sans transmettre un jeton de compte Vercel dans l'application.

**Limites avant validation cloud :** Vercel ne fournit pas ici les options Docker locales de seccomp, tmpfs, rootfs et capabilities ; le test local les applique mais ne garantit pas ces réglages distants. Vérifier la sandbox Chromium réellement en Preview. L'autoscaling peut créer plusieurs processus : limites de concurrence et cache de nonces actuels sont par processus. Ne pas annoncer une protection anti-rejeu globale ; un stockage partagé est nécessaire si elle est requise sur plusieurs instances. Choisir un hébergement à instance contrôlée si ces contraintes ne peuvent pas être satisfaites.

Sources officielles consultées le 25 octobre 2026 : [annonce Docker](https://vercel.com/changelog/bring-your-dockerfile-to-vercel-functions), [runtime Container Images](https://vercel.com/docs/functions/container-images), [limites Functions](https://vercel.com/docs/functions/limitations), [tarifs du registre](https://vercel.com/docs/container-registry/limits-and-pricing). La disponibilité technique sur Hobby ne suffit pas à autoriser tous les usages commerciaux : [conditions Hobby](https://vercel.com/docs/plans/hobby) et [fair use](https://vercel.com/docs/limits/fair-use-guidelines). Aucun passage à Pro ni ressource payante activés automatiquement.

### Appeler un worker protégé sans ouvrir son Preview

Le client et le probe acceptent `PDF_WORKER_VERCEL_BYPASS_SECRET`, uniquement côté serveur, pour transmettre l’en-tête `x-vercel-protection-bypass` sur HTTPS. Il doit s’agir d’un jeton Automation dédié créé dans le **projet worker**, avec consentement de l’opérateur ; le code n’en crée aucun. Il ne s’agit ni d’un jeton de compte Vercel ni du secret HMAC PDF. Le jeton système du projet app n’est jamais transmis automatiquement. Aucun token dans l’URL, les logs ou le corps ; redirections refusées, signature HMAC/Bearer maintenue.

Un jeton Automation donne accès à tous les déploiements du projet worker jusqu’à révocation ; cette portée n’est pas limitée au chemin /render. Conserver ce projet exclusivement staging, limiter le stockage du jeton à l’app Preview/develop et au fichier privé de probe, puis le révoquer/renouveler séparément. Aucune création, activation ni transmission de ce nouveau secret n’est couverte par l’autorisation précédente des quatre secrets. [Documentation officielle du bypass Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).
