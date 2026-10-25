# Coûts et capacité

Vérification documentaire le 25 octobre 2026 ; aucun abonnement ni budget réel n'est activé.

| Option | Coût fixe | Coûts variables | Exploitation |
| --- | --- | --- | --- |
| A — Vercel + Neon + worker Docker | Vercel Pro 20 USD/mois de plateforme, 1 siège inclus ; worker selon fournisseur à choisir | Dépassements Vercel, Neon, calcul/egress worker, OpenAI, monitoring | Deux runtimes, PDF isolé, services managés |
| B — VPS Docker + Neon | VPS non chiffré sans devis vérifié | Ressources, egress, Neon, IA et monitoring | Contrôle sandbox complet, OS/TLS/patches/backup à opérer |
| C — tout Vercel | Plan selon compte | CPU/mémoire/egress, DB, IA et monitoring | Packaging Chromium et sandbox à démontrer ; pas validé ici |

[Tarifs Vercel Pro](https://vercel.com/docs/plans/pro-plan) : base 20 USD/mois, 20 USD de crédit d'usage, consommation supplémentaire et sièges additionnels facturables ; taxes et coûts des autres services non inclus. Ne pas interpréter ce montant comme un budget total.

[Neon](https://neon.com/pricing) propose Free à 0 USD avec limites ; la page vérifiée indique notamment 100 CU-h/mois et 1 Gio de stockage par projet. Les plans payants sont à l'usage. Vérifier les quotas, sauvegardes et fenêtre de restauration du compte avant de choisir ; Free peut servir à préparer staging mais ne prouve pas l'adéquation production.

Le fournisseur Docker n'est pas choisi : aucun montant Railway/Render/VPS n'est inventé. Comparer sa capacité réelle à maintenir la sandbox, ses régions, RAM/CPU/limites, disponibilité, scaling, stockage éphémère et egress. Tester deux rendus concurrents avec les plus gros documents synthétiques avant de dimensionner. Prévoir alertes de budget, plafond opérateur et suivi des estimations IA distinct des factures.
