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
