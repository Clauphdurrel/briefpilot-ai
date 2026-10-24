# Plan de stabilisation — étape 20

1. Audits initiaux en lecture seule — terminé.
2. Garantir une base E2E jetable locale et simuler les services externes.
3. Corriger dépendances signalées, exposition Compose et protections PDF.
4. Borner les alias de réutilisation et propager le client transactionnel.
5. Corriger messages OAuth/pending ; compléter runbooks et headers.
6. Exécuter Prisma, lint, build, unitaires, PostgreSQL, intégrations et Playwright.
7. Vérifier que les fondations d'observabilité déjà présentes restent désactivables et n'affectent pas le métier ; terminer leur intégration et leur validation externe à l'étape 22.
8. Revoir les changements et consigner preuves/limites avant chaque commit.

Aucune migration destructive, suppression de base existante, connexion Google réelle, paiement réel ou appel OpenAI facturable. Une base de test ne peut être supprimée que si elle a été créée par le runner courant. Les faux résultats d'API ne valent pas validation de compte externe.

## Compléments de stabilisation du 24 octobre 2026

- Corriger l'identifiant local `module` interdit par ESLint dans le filtre Sentry, sans changer les champs publics des événements.
- Actualiser Next/eslint-config-next vers 16.4.1, Zod vers 4.6.7 et appliquer les correctifs transitifs de l'audit via des overrides ciblés. Audit initial de cette campagne : 3 avis critiques, 29 élevés, 8 modérés et 3 faibles ; il s'agit d'avis de dépendances, pas de 43 vulnérabilités applicatives démontrées.
- Rétablir shadcn comme dépendance de construction : `globals.css` importe son CSS et sa suppression empêchait un build reproductible. Ne pas retirer cet import et ses variantes d'état pour masquer le problème.
- Compléter README, `.env.example`, exclusions des artefacts locaux et runbook Node/Chromium/PostgreSQL/sauvegardes. Retirer le script `observability:prune` qui référençait un fichier inexistant ; la rétention de télémétrie reste à terminer à l'étape 22.
- Ajouter deux scénarios d'intégration : en-têtes défensifs sur les pages publiques/privées et refus des navigations PDF hostiles sans création d'événement de quota.
- Corriger le détail projet sur tablette : le groupe de boutons empêchait le titre de disposer d'une largeur lisible. Donner toute la largeur au titre et laisser les actions revenir à la ligne.
- Corriger les fixtures E2E : simuler le temps de lecture dans le seul registre de test avant la réponse d'interview, sans désactiver le cooldown serveur ; sélectionner l'alerte de quota par son contenu pour éviter l'annonceur de route Next.
- Activer `webServer.gracefulShutdown` dans Playwright : le SIGKILL par défaut empêchait le `finally` du runner de nettoyer sa base. Rejouer la campagne et vérifier après terminaison la suppression du manifeste et l'absence de base de test restante.
- Attendre explicitement le panneau d'actions du brief aux tailles compactes : `isVisible()` ne patiente pas pour le contenu diffusé progressivement et pouvait sauter l'ouverture, laissant la case de consentement masquée.
- Rejouer la campagne finale et publier les résultats dans `test-matrix.md` et `step20-final-report.md`.
