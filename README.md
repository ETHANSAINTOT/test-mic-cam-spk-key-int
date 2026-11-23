# Test de périphériques

Un site simple, gratuit et sans inscription pour vérifier son matériel avant une visioconférence :

- **Micro** : choix du micro, barre de niveau en direct, enregistrement de 10 secondes maximum et réécoute.
  L'enregistrement reste sur l'appareil et est supprimé dès qu'on change de micro, qu'on relance un
  enregistrement ou qu'on quitte la page.
- **Webcam** : choix de la caméra et aperçu en direct (miroir activable, résolution affichée).
- **Casque et haut-parleurs** : choix de la sortie audio (quand le navigateur le permet) et sons
  Gauche / Stéréo / Droite. Sur une sortie mono, les trois boutons diffusent le même son.
- **Clavier** : zone de texte brut (écrire, copier, couper, coller…) avec l'indication de la dernière
  touche pressée. Le texte est effacé quand on quitte la page.
- **Débit internet** : ping, gigue, débit descendant et montant, puis un score de compatibilité visio
  sur 10 avec un conseil.

Rien n'est enregistré ni envoyé : tout se passe dans le navigateur. Seul le test de débit échange des
données de test avec les serveurs publics de Cloudflare (`speed.cloudflare.com`).

## Structure

```
public/            site servi tel quel (aucune étape de build)
  index.html
  css/style.css
  js/main.js       initialise les cartes, nettoie tout au départ de la page
  js/mic.js        carte Micro
  js/camera.js     carte Webcam
  js/speaker.js    carte Son
  js/keyboard.js   carte Clavier
  js/speedtest.js  carte Débit (mesures + affichage)
  js/score.js      calcul du score visio (logique pure)
  js/stats.js      médiane, gigue, débits (logique pure)
  js/keys.js       noms des touches (logique pure)
  js/messages.js   messages d'erreur micro/caméra (logique pure)
  js/output.js     sortie audio partagée entre les cartes Son et Micro
  js/ui.js         petites aides communes
tests/             tests unitaires de la logique pure
vercel.json        dossier publié + en-têtes de sécurité
```

## Lancer en local

Le micro et la caméra ne fonctionnent que sur `https://` ou `http://localhost`.

```bash
python3 -m http.server 8080 -d public
```

Puis ouvrir http://localhost:8080.

## Tests

Aucune dépendance à installer (Node.js 20 ou plus) :

```bash
npm test
```

## Déployer sur Vercel

1. Importer ce dépôt dans Vercel (« Add New… → Project »).
2. Laisser les réglages par défaut : pas de framework, pas de commande de build.
   `vercel.json` indique de publier le dossier `public/`.
3. Déployer. Vercel fournit le HTTPS nécessaire au micro et à la caméra.

## Compatibilité

Versions récentes de Chrome, Edge, Firefox et Safari, sur ordinateur et sur mobile.
Le choix de la sortie audio n'est possible que sur Chrome, Edge et Firefox sur ordinateur : ailleurs
(Safari, la plupart des téléphones), le son sort par la sortie active de l'appareil, et le site l'explique.
