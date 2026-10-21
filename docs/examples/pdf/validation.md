# Validation visuelle PDF — 21 octobre 2026

Documents fictifs de réservation de restaurant, produits par les routes authentifiées avec les versions enregistrées. Chromium Playwright avec sandbox activée, format A4 (594,96 × 841,92 points), PDF balisé, sans JavaScript embarqué.

| Exemple | Pages | Vérifications |
|---|---:|---|
| [Petit cahier des charges](brief-small.pdf) | 7 | Couverture, accents, 17 sections, sommaire, brouillon, version 1 |
| [Cahier des charges long](brief-long.pdf) | 16 | Titre de 112 caractères, 18 fonctionnalités supplémentaires, longues descriptions, version 2 |
| [Backlog](backlog.pdf) | 6 | Phases, épic, story, tâches, dépendances, effort inconnu explicite |
| [Backlog long](backlog-long.pdf) | 22 | Cellules longues, répétition de l’en-tête du tableau sur les pages 4–5, 14 tâches dépendantes supplémentaires |
| [Dossier projet](project.pdf) | 12 | Brief v1 + backlog v1, sommaire commun, passage entre chapitres, conclusion |

Les pages des trois exemples obligatoires (petit brief, long brief, backlog) ont été rendues en PNG via `pdftoppm` et inspectées en planches de contact. Des pages ont également été ouvertes individuellement pour examiner couverture, corps de texte et tableau étendu. Le dossier projet a été inspecté en planche complète.

Résultat : alignements et marges réguliers, texte français lisible, absence de chevauchement ou de texte coupé observé, numéros de pages cohérents. Les grands tableaux passent à la page suivante avec répétition des en-têtes. Les petites fiches de tâches restent sur une page.

Correction effectuée après la première inspection : regroupement des blocs de fonctionnalités, stories et tâches pour éviter de laisser le titre et la description sur une page avec leur tableau sur la suivante. Les PDF ci-joints ont été régénérés et réinspectés après correction. Le regroupement accepte un peu plus d’espace libre en bas de page pour préserver la lecture ; les blocs dépassant une page restent sécables par Chromium.

Le sommaire contient uniquement des sections réellement produites, avec liens PDF internes. Il n’affiche pas de numéros de page calculés approximativement. Les pieds de page sont générés par Chromium (`pageNumber`/`totalPages`) ; le test extrait et contrôle tous les numéros du petit brief.

Aperçus : [couverture](cover-preview.png), [backlog complet](backlog-preview.png).

Validation automatique : 11 tests d’intégration PDF, avec fichiers réels, versions et permissions, injections inertes, absence de requête vers le faux serveur OpenAI, absence de modification des documents et téléchargements depuis le menu à 375 et 1440 pixels. Les limites, timeouts, fermeture après erreur et contention sont aussi vérifiés en tests unitaires.

L’hébergement local et sa sandbox sont vérifiés. Un futur environnement de production devra exécuter ces mêmes tests avec ses propres polices, dépendances et limites de ressources ; aucune compatibilité Vercel implicite n’est annoncée.
