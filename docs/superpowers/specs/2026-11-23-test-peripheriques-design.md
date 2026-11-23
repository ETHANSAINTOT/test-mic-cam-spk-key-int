# Test de périphériques — design

Date : 2026-11-23

## Intention

Un site public, gratuit, sans inscription, nommé **« Test de périphériques »**, pour que
n'importe qui puisse vérifier en quelques secondes que son matériel est prêt pour une
visioconférence : micro, webcam, sortie audio (casque / haut-parleurs), clavier et connexion
internet. Le site doit rester **simple** et fonctionner sur **tous les écrans et appareils**
(téléphone, tablette, ordinateur, portrait comme paysage). Il est hébergé sur **Vercel**.

## Objectifs

- 5 tests accessibles sur une seule page, chacun utilisable indépendamment.
- Rien n'est conservé : pas de compte, pas de stockage local, pas d'envoi de données
  personnelles. Seul le test de débit contacte un serveur externe.
- Messages clairs quand quelque chose ne marche pas (autorisation refusée, aucun périphérique,
  périphérique déjà utilisé, navigateur incompatible).

## Non-objectifs

- Pas de multilingue : français uniquement.
- Pas de compte, d'historique, de partage de résultats.
- Pas de parcours guidé ni de bilan global (option C écartée).
- Pas de framework ni d'étape de build.

## Anti-objectifs (ce qui serait un échec même si « ça marche »)

- Demander l'accès au micro ou à la caméra dès l'arrivée sur la page.
- Garder un enregistrement ou du texte après le départ de l'utilisateur.
- Une page qui déborde horizontalement ou devient inutilisable sur téléphone.

## Approches envisagées (organisation de la page)

| Option | Principe | Pour | Contre |
|---|---|---|---|
| **A. Page unique, 5 cartes** ✅ choisie | Grille de cartes sur ordinateur, empilées sur téléphone, menu de raccourcis | Tout visible, caméra + micro ensemble comme en visio | Page un peu longue sur téléphone |
| B. Onglets | Un test à la fois | Plus épuré, la caméra s'éteint en changeant d'onglet | Plus de clics, vue d'ensemble perdue |
| C. Parcours guidé | Étapes + bilan final | Rassurant pour les novices | Impose un ordre, plus lourd, contraire au « simple » |

L'utilisateur a choisi **A**.

## Choix techniques (décisions de Claude)

- **Site statique** HTML / CSS / JavaScript (modules ES natifs), aucune dépendance, aucun build.
  Raison : déployable sur Vercel sans configuration, rapide, rien à maintenir.
- Fichiers servis depuis `public/` ; `vercel.json` fixe `outputDirectory: "public"` et ajoute
  des en-têtes de sécurité (CSP limitant les connexions à `'self'` et `speed.cloudflare.com`,
  `X-Content-Type-Options`, `Referrer-Policy`).
- **Test de débit sur les serveurs publics de Cloudflare** (`speed.cloudflare.com/__down` et
  `/__up`), prévus pour être appelés depuis un navigateur. Raison : tester contre Vercel serait
  limité (corps de requête ≤ 4,5 Mo, quota de bande passante du plan gratuit).
- Police système (pas de police externe), icônes SVG en ligne, thème clair/sombre automatique.
- Tests unitaires de la logique pure (score, statistiques) avec `node --test`, sans dépendance.

## Comportement détaillé

### En-tête et mise en page
- Titre « Test de périphériques » + une phrase d'accroche.
- Menu de raccourcis collant (Micro, Webcam, Son, Clavier, Débit) qui défile horizontalement
  sur petit écran.
- Grille CSS adaptative (`auto-fit`, cartes ≥ ~340 px, une seule colonne sur téléphone).
- Pied de page : rappel de confidentialité (rien n'est enregistré ni envoyé, sauf le test de
  débit vers Cloudflare).

### 1. Micro
- Bouton « Activer le micro » → demande d'autorisation. Ensuite, liste déroulante des micros
  (les noms ne sont disponibles qu'après autorisation) et bouton « Couper le micro ».
- **Barre de niveau** qui réagit à la voix en temps réel (Web Audio, niveau RMS lissé).
- **Enregistrer** : enregistre jusqu'à **10 secondes** (compte à rebours visible), arrêt
  manuel possible avant. Ensuite un lecteur permet de réécouter.
- L'enregistrement est **jeté** (mémoire libérée) quand : on change de micro, on relance un
  enregistrement, on quitte la page. Couper le micro ne le jette pas (décision de Claude :
  ce n'est pas dans la liste et la réécoute reste utile).
- La réécoute sort sur la sortie audio choisie dans la carte Son, si le navigateur le permet
  (décision de Claude, pour la cohérence).
- Réglages audio par défaut du navigateur (annulation d'écho, réduction de bruit), comme dans
  une vraie visio.

### 2. Webcam
- Bouton « Activer la webcam » → autorisation, puis liste des caméras et aperçu en direct.
- Changer de caméra relance le flux sur la nouvelle.
- Bouton « Couper la webcam ».
- Décisions de Claude : image en miroir par défaut (comme le retour vidéo des applis de visio)
  avec un interrupteur « Miroir » ; affichage discret de la résolution et des images/seconde
  réelles (ex. « 1280×720 · 30 i/s »).

### 3. Son (casque / haut-parleurs)
- Liste des sorties audio quand le navigateur sait la fournir (Chrome, Edge, Firefox sur
  ordinateur). Sur Chrome, les noms n'apparaissent qu'après autorisation du micro : un lien
  propose de l'accorder. Sur Firefox, un bouton « Choisir une sortie » ouvre le sélecteur du
  navigateur.
- Si le navigateur ne permet pas de choisir (Safari, la plupart des téléphones) : mention
  « Sortie par défaut du système » avec une explication courte.
- Trois boutons **Gauche**, **Stéréo**, **Droite** : un petit carillon synthétisé (Web Audio,
  ~1,5 s) joué uniquement dans le canal gauche, dans les deux, ou uniquement dans le droit.
  Appuyer sur un autre bouton coupe le son en cours. Le bouton actif est mis en évidence.
- **Sortie mono** : rien de spécial à faire, le système mélange gauche et droite sur le seul
  canal, donc chaque bouton diffuse le son. Si le navigateur indique une sortie à un seul
  canal, un badge « Sortie mono » l'explique.
- Conseil affiché : baisser le volume avant de tester.

### 4. Clavier
- Une grande zone de texte brut : écrire, copier, couper, coller, sélectionner, entrée,
  espace, retour arrière… Le collage n'apporte jamais de mise en forme (texte brut).
- Correcteur, autocorrection et majuscule automatique désactivés (pour tester les touches
  telles quelles).
- Tab garde son comportement normal (passer à l'élément suivant) pour l'accessibilité.
- Décisions de Claude : un indicateur « Dernière touche : Maj + A » pour voir aussi les
  touches qui n'écrivent rien (flèches, Échap, F1…), et un bouton « Effacer ».
- La zone est **vidée quand on quitte la page**, y compris au retour via le bouton
  « Précédent » (cache du navigateur) ; aucune restauration automatique par le navigateur.

### 5. Débit internet
- Bouton **Go** (devient « Arrêter » pendant le test, ~20 s au total).
- Étapes affichées en direct :
  1. **Ping** : ~10 petites requêtes, la première est ignorée (ouverture de connexion),
     on garde la médiane. La **gigue** (variation du ping) est calculée et affichée en petit.
  2. **Descendant** : plusieurs téléchargements en parallèle pendant ~8 s, période de
     chauffe ignorée, débit en Mb/s mis à jour en direct.
  3. **Montant** : plusieurs envois en parallèle (données aléatoires) pendant ~8 s, même
     principe.
- **Score de compatibilité visio sur 10** (entier) avec un verdict et un conseil ciblant le
  point faible. Calcul (décision de Claude, basé sur les recommandations courantes des
  applis de visio) :
  - Sous-notes sur 10 par interpolation linéaire :
    - Montant (Mb/s) : 0,3 → 0 · 1 → 4 · 2 → 6 · 3 → 8 · 5+ → 10
    - Descendant (Mb/s) : 0,5 → 0 · 1,5 → 4 · 3 → 6 · 5 → 8 · 10+ → 10
    - Ping (ms) : ≤30 → 10 · 50 → 9 · 100 → 7 · 150 → 5 · 300 → 2 · 500+ → 0
    - Gigue (ms) : ≤5 → 10 · 15 → 8 · 30 → 5 · 50 → 2 · 100+ → 0
  - Moyenne pondérée : montant 35 %, descendant 25 %, ping 25 %, gigue 15 %.
  - Plafond : le score ne dépasse pas (pire sous-note + 3), car un seul maillon faible suffit
    à gâcher un appel.
  - Verdicts : 9–10 Excellent · 7–8 Bon · 5–6 Correct · 3–4 Faible · 0–2 Insuffisant.
- Si Cloudflare est injoignable (pare-feu, bloqueur) : message d'erreur clair.

## Contraintes

- HTTPS obligatoire pour la caméra et le micro (fourni par Vercel).
- Navigateurs visés : versions récentes de Chrome, Edge, Firefox, Safari, sur ordinateur et
  mobile (iOS, Android). Les fonctions absentes d'un navigateur sont signalées, pas cachées.
- Accessibilité : vrais libellés, zones `aria-live` pour les statuts, focus visible, respect
  de « réduire les animations ».
- Au départ de la page : arrêt de tous les flux caméra/micro, enregistrement jeté, zone de
  texte vidée, contextes audio fermés.

## Laissé au constructeur

- Le style visuel précis (couleurs, espacements), dans l'esprit sobre et lisible.
- Les détails internes de la mesure (taille des blocs, nombre de connexions parallèles), tant
  que les durées et principes ci-dessus sont respectés.
- Le format d'enregistrement (celui que le navigateur supporte).
