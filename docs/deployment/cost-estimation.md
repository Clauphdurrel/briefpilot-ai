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

## Crédit OpenAI pour une démo privée

Modèle staging configuré : gpt-4.1-mini. Tarif standard vérifié le 25 octobre 2026 : 0,40 USD / million de tokens en entrée, 1,60 USD / million en sortie, entrée mise en cache 0,10 USD / million. Pour estimer prudemment, les calculs ci-dessous ignorent la réduction de cache. [Tarification officielle](https://developers.openai.com/api/docs/pricing).

Formule : coût USD = tokens entrée × 0,40 / 1 000 000 + tokens sortie × 1,60 / 1 000 000.

Exemple **théorique, non mesuré** pour l’ensemble d’un parcours : 50 000 tokens d’entrée et 30 000 en sortie donnent 0,020 + 0,048 = **0,068 USD**. Dix parcours strictement identiques coûteraient 0,68 USD ; cinquante 3,40 USD. Ce n’est pas une promesse de capacité : longueurs des échanges et documents, historique renvoyé et régénérations changent les volumes. Aucun parcours réel n’a encore été mesuré, faute de crédit API selon l’opérateur.

Budget conseillé pour commencer : **5 USD de crédit API** pour la démo et un premier petit groupe de testeurs ; **10 USD** pour davantage d’amis ou plusieurs séries, à réévaluer après les premiers parcours mesurés dans OpenAI Usage. Il s’agit d’une recommandation de budget, pas d’un minimum d’achat vérifié ni d’un plafond garanti par le logiciel. Aucun crédit acheté ou rechargement automatique activé par l’agent. Ces montants excluent taxes éventuelles et autres services.

Bornes actuelles par appel dans le code : interview 8 000 tokens de sortie, brief 12 000, backlog 20 000. Un utilisateur peut faire plusieurs appels d’interview ; ces bornes ne représentent pas une consommation moyenne. Le plan Free applique, par mois et par compte : 3 réponses IA d’interview, 2 briefs, 1 backlog et 3 PDF, avec 2 projets actifs. Ces limites produit restent distinctes du crédit global du propriétaire OpenAI ; aucun quota n’a été modifié pour la démo.

L’app staging est actuellement sur Vercel Hobby, sans passage à Pro. Les frais éventuels du worker/registre sont distincts : le registre Vercel affiche 0,10 USD/Go de stockage, sans période précisée dans la page consultée. Ne pas présenter ce tarif comme un coût mensuel garanti ou le coût complet du PDF. [Registre Vercel](https://vercel.com/docs/container-registry/limits-and-pricing).
