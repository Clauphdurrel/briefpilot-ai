# Revue de l’étape 27

Revue effectuée selon le skill local `review-code`, sur code, tests et captures réelles. Les observations ci-dessous distinguent corrections réalisées et limites. Aucun audit indépendant par un autre agent ni certification WCAG n’est revendiqué.

## Bloquants

Aucun défaut bloquant confirmé restant dans les parcours marketing testés. Publication commerciale non autorisée par cette étape ; domaine, contact et textes légaux restent à compléter.

## Importants — corrigés

1. **Contraste du repère violet sur le fond showcase** : axe mesurait 4,21:1 pour un petit texte, sous 4,5:1. Correction dans marketing.css : utilisation du violet foncé. Nouvelle analyse aux cinq tailles : aucune violation détectée.
2. **Nom accessible du logo** : le texte visible concaténé ne correspondait pas à aria-label. Correction dans marketing-header.tsx : espace explicite entre le nom et AI. Contrôle clavier et nouvelle mesure.
3. **Indexation involontaire du staging** : les routes marketing héritent d’un défaut noindex ; l’activation production exige une origine validée et plusieurs conditions concordantes. Robots, sitemap, métadonnées privées et X-Robots-Tag testés. Auth.js et l’autorisation serveur restent les protections des données.
4. **Couplage au checkout** : les cartes partagent la configuration canonique des plans. La landing ne déclenche aucun checkout ; /pricing conserve le mode Test existant et l’état indisponible lorsque la configuration manque.
5. **Données sensibles dans la télémétrie** : entrée Zod stricte, enums, HMAC, propriétés réécrites, accord préalable et désactivation par défaut. Aucun texte libre, email ou URL accepté. Le replay et l’autocapture ne sont pas ajoutés.

6. **noindex public masqué par robots.txt en production** : les brouillons légaux, le contact et login doivent rester explorables pour que leur directive noindex soit lue. Ils sont exclus du sitemap et gardent leurs métadonnées noindex ; dashboard/API restent disallowed. Le staging reste intégralement bloqué. Un test vérifie ce cas.

7. **Repère obsolète du test navigateur d’abonnement** : le test attendait l’ancien titre de /pricing. Il utilise désormais la région « Comparaison des offres » ; les assertions des quotas, boutons de paiement désactivés et réactivation des projets sont conservées. Toute la campagne PostgreSQL/API locale a été relancée avec succès.

## Améliorations réalisées

- Préchargement désactivé pour les liens de connexion afin d’éviter des requêtes d’authentification inutiles depuis la vitrine.
- Déduplication côté navigateur par vue et identifiant déterministe côté serveur ; cache borné et délais de transport explicites.
- FAQ HTML native, navigation mobile Escape avec retour du focus, lien d’évitement et reduced motion.
- Visuels construits en code et identifiés comme fictifs ; composant réel de statuts réutilisé sans simuler des fonctions non livrées.
- Pages contact et légales avec états explicites, sans formulaire inopérant ni coordonnées inventées.

## Mineurs / limites

- Les textes de la miniature produit sont volontairement réduits ; le contenu commercial reste lisible hors miniature. Les vérifications automatiques incomplètes de contraste sur la composition transformée ont été complétées par inspection et vérification des couleurs opaques utilisées ; aucune conformité complète n’est certifiée.
- Les mesures Lighthouse sont locales et variables. Un score SEO élevé n’est pas attendu tant que le staging interdit l’indexation ; ne pas enlever cette protection pour augmenter le score.
- Les statistiques de conversion sont déclaratives et dépendantes de l’accord ; elles ne constituent pas une preuve de création de compte ou de paiement. Leur réception distante n’est pas testée ici.
- La déduplication en mémoire n’est pas globale sous autoscaling. Les capacités futures d’équipe, de personnalisation et de support prioritaire restent hors MVP.

## Recommandations de conversion

Valider les textes et l’apparence avec l’opérateur avant fusion de la landing. Après autorisation d’une phase ultérieure, mesurer les parcours consentis et clarifier les objections réellement observées. Ajouter témoignages ou preuves chiffrées uniquement lorsqu’ils existent et sont vérifiables. Ne pas ouvrir une liste d’attente fictive ou une inscription différente du parcours disponible.
