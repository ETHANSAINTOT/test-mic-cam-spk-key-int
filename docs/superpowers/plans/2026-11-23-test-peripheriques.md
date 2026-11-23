# Test de périphériques — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un site statique « Test de périphériques » (micro, webcam, sortie audio, clavier, débit) déployable sur Vercel.

**Architecture:** Une page `public/index.html` avec 5 cartes. Chaque carte est pilotée par un module ES (`public/js/<carte>.js`) qui expose `init<Carte>(card) → { reset() }`. La logique pure (score, statistiques, messages d'erreur, noms de touches) vit dans des modules sans DOM, testés avec `node --test`. `main.js` initialise les cartes et appelle `reset()` de chacune au départ de la page.

**Tech Stack:** HTML, CSS, JavaScript (modules ES natifs), Web Audio, MediaDevices, MediaRecorder, Fetch/XHR. Aucune dépendance. Tests : `node --test`. Vérification navigateur : Playwright préinstallé (script hors dépôt).

**Spec:** `docs/superpowers/specs/2026-11-23-test-peripheriques-design.md`

## Global Constraints

- Français uniquement ; nom du site : « Test de périphériques ».
- Aucune dépendance npm, aucun build ; fichiers servis depuis `public/` (`vercel.json` → `outputDirectory: "public"`).
- Aucun `localStorage` / `sessionStorage` / cookie ; rien envoyé hors de l'appareil sauf le test de débit vers `https://speed.cloudflare.com`.
- Aucune demande d'accès micro/caméra avant un clic de l'utilisateur.
- Pas de débordement horizontal de 320 px à 2560 px de large, portrait et paysage.
- Police système, icônes SVG en ligne, thème clair/sombre via `prefers-color-scheme`, respect de `prefers-reduced-motion`.
- Enregistrement micro : 10 s max ; jeté au changement de micro, à un nouvel enregistrement, au départ de la page.
- Zone clavier vidée au départ de la page (y compris retour via cache navigateur).

## Review Focus

1. Autorisation refusée / aucun périphérique / périphérique occupé → message clair en français et bouton pour réessayer (tests `messages.test.js`, Task 1).
2. Périphérique débranché pendant l'usage (piste `ended`) → message + retour à l'état inactif, listes rafraîchies sur `devicechange` (Task 3 et 4, vérif navigateur Task 8).
3. Clavier virtuel Android (`key === "Unidentified"`/`"Process"`) → l'indicateur n'affiche pas de valeur absurde (test `keys.test.js`, Task 6).
4. Test de débit bloqué (pare-feu, bloqueur) ou arrêté en cours → message d'erreur, bouton revient à « Go », aucun score affiché (vérif navigateur avec requêtes bloquées, Task 8).
5. Écrans étroits (320 px) et téléphone en paysage → pas de défilement horizontal (vérif navigateur Task 8).

---

### Task 1: Logique pure (score, statistiques, messages, touches)

**Files:**
- Create: `package.json` (`"private": true, "type": "module", "scripts": {"test": "node --test tests/"}`)
- Create: `public/js/score.js`, `public/js/stats.js`, `public/js/messages.js`, `public/js/keys.js`
- Test: `tests/score.test.js`, `tests/stats.test.js`, `tests/messages.test.js`, `tests/keys.test.js`

**Interfaces:**
- Produces:
  - `interpolate(x: number, points: [number, number][]): number` — linéaire par morceaux, borné aux extrémités, `points` triés par x croissant.
  - `subScores({down, up, ping, jitter}): {down, up, ping, jitter}` — chaque sous-note 0–10 ; entrée non finie ou négative → 0.
  - `computeScore(metrics): {score: number, sub, verdict: string, weakest: 'down'|'up'|'ping'|'jitter', advice: string}` — `score` entier 0–10.
  - `verdictFor(score: number): string`
  - `median(values: number[]): number` (`NaN` si vide), `jitter(values: number[]): number` (moyenne des écarts absolus consécutifs, 0 si < 2 valeurs), `mbps(bytes: number, ms: number): number`.
  - `mediaErrorMessage(err: {name?: string} | null, device: 'micro' | 'caméra'): string`
  - `formatKey(e: {key, code?, ctrlKey?, shiftKey?, altKey?, metaKey?}, opts?: {mac?: boolean}): string | null`

- [ ] **Step 1: Write the failing tests**

`tests/score.test.js` (valeurs du spec) :
```js
interpolate(0.65, UP) === 2; interpolate(0.1, UP) === 0; interpolate(10, UP) === 10; interpolate(1.5, UP) === 5
interpolate(10, PING) === 10; interpolate(75, PING) === 8; interpolate(1000, PING) === 0
computeScore({down:100, up:50, ping:10, jitter:1}).score === 10 && verdict === 'Excellent'
computeScore({down:0.1, up:0.1, ping:600, jitter:200}).score === 0 && verdict === 'Insuffisant'
computeScore({down:100, up:0.3, ping:20, jitter:2}) → score 3 (plafond pire+3), weakest 'up', verdict 'Faible'
computeScore({down:5, up:2, ping:100, jitter:15}) → score 7, weakest 'up', verdict 'Bon'
subScores({down:NaN, up:-1, ping:Infinity, jitter:undefined}) → toutes à 0
verdictFor: 10,9 → 'Excellent' · 8,7 → 'Bon' · 6,5 → 'Correct' · 4,3 → 'Faible' · 2,1,0 → 'Insuffisant'
```
où `UP = [[0.3,0],[1,4],[2,6],[3,8],[5,10]]`, `PING = [[30,10],[50,9],[100,7],[150,5],[300,2],[500,0]]` (exportés par `score.js` comme `CURVES.up`, `CURVES.ping`, avec `CURVES.down = [[0.5,0],[1.5,4],[3,6],[5,8],[10,10]]`, `CURVES.jitter = [[5,10],[15,8],[30,5],[50,2],[100,0]]`, `WEIGHTS = {up:.35, down:.25, ping:.25, jitter:.15}`).

`tests/stats.test.js` : `median([5,1,3]) === 3`, `median([4,1,3,2]) === 2.5`, `Number.isNaN(median([]))`, `jitter([10,20,10,20]) === 10`, `jitter([10]) === 0`, `mbps(1_000_000, 1000) === 8`.

`tests/messages.test.js` : `NotAllowedError` → contient « refusé » et « micro » ; `NotFoundError` → contient « Aucun » ; `NotReadableError` → contient « déjà utilisé » ; `OverconstrainedError` → contient « n'est plus disponible » ; `{name:'InsecureContext'}` → contient « HTTPS » ; `null` / nom inconnu → message générique non vide contenant le nom du périphérique.

`tests/keys.test.js` :
```js
formatKey({key:'a', code:'KeyA'}) === 'A'
formatKey({key:'A', code:'KeyA', shiftKey:true}) === 'Maj + A'
formatKey({key:'c', code:'KeyC', ctrlKey:true}) === 'Ctrl + C'
formatKey({key:'v', code:'KeyV', metaKey:true}, {mac:true}) === 'Cmd + V'
formatKey({key:' ', code:'Space'}) === 'Espace'
formatKey({key:'Enter'}) === 'Entrée'; formatKey({key:'Backspace'}) === 'Retour arrière'
formatKey({key:'Escape'}) === 'Échap'; formatKey({key:'ArrowLeft'}) === '← (flèche gauche)'
formatKey({key:'Shift', shiftKey:true}) === 'Maj'   // pas « Maj + Maj »
formatKey({key:'Control', ctrlKey:true}) === 'Ctrl'
formatKey({key:'F5'}) === 'F5'; formatKey({key:'Dead'}) === 'Touche morte'
formatKey({key:'Unidentified'}) === null; formatKey({key:'Process'}) === null
```

- [ ] **Step 2: Run** `npm test` → FAIL (modules absents).
- [ ] **Step 3: Implement** les quatre modules. `computeScore` : moyenne pondérée des sous-notes, plafonnée à `min(sous-notes) + 3`, arrondie, bornée 0–10 ; `weakest` = sous-note la plus basse (à égalité, ordre up, down, ping, jitter) ; `advice` = phrase ciblant `weakest` (vide si score ≥ 9).
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: logique de score, statistiques, messages et touches`.

### Task 2: Coquille de la page

**Files:**
- Create: `public/index.html`, `public/css/style.css`, `public/js/main.js`, `public/js/ui.js`, `public/favicon.svg`, `vercel.json`

**Interfaces:**
- Produces (`ui.js`):
  - `setStatus(el: HTMLElement, text: string, kind?: 'info'|'ok'|'error'): void` (élément `aria-live="polite"`)
  - `listDevices(kind: 'audioinput'|'videoinput'|'audiooutput'): Promise<MediaDeviceInfo[]>`
  - `fillSelect(select: HTMLSelectElement, devices: MediaDeviceInfo[], selectedId: string|undefined, fallbackLabel: string): void` (libellé vide → `${fallbackLabel} n°${i+1}`)
  - `mediaSupported(): boolean`
- Produces (`index.html`) : cartes `<section class="card" id="micro|webcam|son|clavier|debit">`, menu `<nav>` avec liens d'ancre, pied de page confidentialité. Chaque module trouve ses éléments par `[data-role="…"]` dans sa carte.
- `main.js` : importe `initMic`, `initCamera`, `initSpeaker`, `initKeyboard`, `initSpeedtest`, appelle chacun avec sa carte, et appelle `reset()` de tous sur `pagehide` ; sur `pageshow` avec `persisted`, appelle aussi `reset()`.
- `vercel.json` : `outputDirectory: "public"`, `cleanUrls: true`, en-têtes `Content-Security-Policy` (`default-src 'self'; connect-src 'self' https://speed.cloudflare.com; media-src 'self' blob: mediastream:; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.

- [ ] **Step 1:** Écrire HTML + CSS (grille `repeat(auto-fit, minmax(min(100%, 340px), 1fr))`, webcam sur 2 colonnes quand ≥ 1100 px, menu collant défilant horizontalement).
- [ ] **Step 2: Verify** : servir `public/` localement, ouvrir à 320 px et 1440 px → aucune erreur console, `document.documentElement.scrollWidth <= innerWidth`.
- [ ] **Step 3: Commit** `feat: coquille responsive de la page`.

### Task 3: Carte Micro

**Files:** Create `public/js/mic.js`

**Interfaces:**
- Consumes: `setStatus`, `listDevices`, `fillSelect` (ui.js) ; `mediaErrorMessage` (messages.js) ; `applySink(el: HTMLMediaElement): Promise<void>` (speaker.js, Task 5 — tant que Task 5 n'existe pas, importer une fonction no-op).
- Produces: `initMic(card: HTMLElement): { reset(): void }`

- [ ] **Step 1:** Activer → `getUserMedia({audio: deviceId ? {deviceId: {exact: id}} : true})`, remplir la liste, sélectionner le micro réel (`track.getSettings().deviceId`). Vumètre : `AnalyserNode` (`fftSize 1024`), RMS → dB, plage −60…0 dB → 0–100 %, lissage (montée rapide, descente lente), boucle `requestAnimationFrame`.
- [ ] **Step 2:** Enregistrer : `MediaRecorder` (préférence `audio/webm;codecs=opus`, puis `audio/mp4`, sinon défaut), arrêt auto à 10 000 ms, barre de progression + secondes restantes ; à l'arrêt, `URL.createObjectURL` → `<audio controls>` + `applySink`. `discardRecording()` (révoque l'URL, cache le lecteur) appelé au changement de micro, au démarrage d'un enregistrement, dans `reset()`. Enregistrement en cours + changement de micro → arrêt sans conserver.
- [ ] **Step 3:** Couper le micro (n'efface pas l'enregistrement). Piste `ended` → message « Le micro a été déconnecté » et retour à l'état inactif. `devicechange` → rafraîchir la liste.
- [ ] **Step 4: Verify** dans Chromium avec `--use-fake-device-for-media-stream` : la barre bouge, l'enregistrement s'arrête seul à 10 s, le lecteur apparaît, changer de micro le fait disparaître.
- [ ] **Step 5: Commit** `feat: test du micro`.

### Task 4: Carte Webcam

**Files:** Create `public/js/camera.js`

**Interfaces:**
- Consumes: `setStatus`, `listDevices`, `fillSelect`, `mediaErrorMessage`.
- Produces: `initCamera(card: HTMLElement): { reset(): void }`

- [ ] **Step 1:** Activer → `getUserMedia({video: {deviceId?, width: {ideal: 1280}, height: {ideal: 720}}})` dans `<video autoplay playsinline muted>`. Changement de caméra : arrêter l'ancienne piste puis ouvrir la nouvelle. Interrupteur « Miroir » (coché par défaut, `transform: scaleX(-1)`). Infos `largeur×hauteur · N i/s` depuis `getSettings()` (rafraîchies sur `resize` de la vidéo).
- [ ] **Step 2:** Couper ; piste `ended` → message + état inactif ; `devicechange` → liste.
- [ ] **Step 3: Verify** (caméra factice) : la vidéo joue, les infos s'affichent, le miroir s'inverse.
- [ ] **Step 4: Commit** `feat: test de la webcam`.

### Task 5: Carte Son

**Files:** Create `public/js/speaker.js`

**Interfaces:**
- Consumes: `setStatus`, `listDevices`, `fillSelect`.
- Produces: `initSpeaker(card): { reset(): void }`, `getSinkId(): string` (`''` = défaut), `applySink(el: HTMLMediaElement): Promise<void>` (no-op si `setSinkId` absent).

- [ ] **Step 1:** Détection : `canPickOutput = 'setSinkId' in HTMLMediaElement.prototype`. Si oui : liste des `audiooutput` ; libellés vides → lien « Afficher les noms (autorisation du micro) » qui fait un `getUserMedia({audio:true})` puis arrête aussitôt la piste ; si `navigator.mediaDevices.selectAudioOutput` existe, bouton « Choisir une sortie ». Sinon : texte « Sortie par défaut du système » + explication.
- [ ] **Step 2:** Lecture : `AudioContext` créé au premier clic ; chaîne `oscillateurs → gain → ChannelMergerNode(2)` (entrée 0 = gauche, 1 = droite, les deux pour Stéréo). Sortie : `ctx.setSinkId` si dispo ; sinon si `canPickOutput`, `MediaStreamAudioDestinationNode` → `<audio>` + `setSinkId` ; sinon `ctx.destination`. Carillon : 3 notes (C5, E5, G5 ; sinus + triangle léger, enveloppe attaque 10 ms / déclin ~450 ms), ~1,5 s, gain max 0,25. Un nouveau clic coupe le son en cours. Bouton actif `aria-pressed="true"` pendant la lecture. Badge « Sortie mono » si `ctx.destination.maxChannelCount === 1`.
- [ ] **Step 3:** Brancher `applySink` dans mic.js (remplace le no-op de Task 3).
- [ ] **Step 4: Verify** : clic Gauche/Droite/Stéréo sans erreur console ; en Chromium, la liste contient les sorties factices.
- [ ] **Step 5: Commit** `feat: test des haut-parleurs`.

### Task 6: Carte Clavier

**Files:** Create `public/js/keyboard.js`

**Interfaces:**
- Consumes: `formatKey` (keys.js).
- Produces: `initKeyboard(card): { reset(): void }` (`reset` vide la zone et l'indicateur).

- [ ] **Step 1:** `<textarea autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">`. `keydown` → `formatKey(e, {mac})` ; `null` → ne rien changer, et sur l'événement `input` suivant afficher le caractère inséré (`e.data`) s'il existe. Bouton « Effacer » (vide + remet le focus). Compteur de caractères.
- [ ] **Step 2: Verify** : taper `Maj+A` → « Maj + A » ; `pagehide` simulé → zone vide.
- [ ] **Step 3: Commit** `feat: test du clavier`.

### Task 7: Carte Débit

**Files:** Create `public/js/speedtest.js`

**Interfaces:**
- Consumes: `median`, `jitter`, `mbps` (stats.js) ; `computeScore` (score.js) ; `setStatus`.
- Produces: `initSpeedtest(card): { reset(): void }` ; en interne `runSpeedTest({signal, onProgress}) → Promise<{ping, jitter, down, up}>`.

- [ ] **Step 1: Ping** : 11 requêtes `GET __down?bytes=0` (`cache: 'no-store'`), séquentielles, la 1re ignorée ; temps = `responseStart − requestStart` via Resource Timing quand l'entrée existe et est non nulle, sinon durée du `fetch`. `ping = median`, `jitter = jitter(samples)`.
- [ ] **Step 2: Descendant** : 4 connexions parallèles qui enchaînent `GET __down?bytes=25000000` et lisent le corps en flux, compteur d'octets partagé ; durée 8 s ; débit = octets reçus après 1,5 s de chauffe ÷ temps écoulé depuis la chauffe ; affichage live toutes les 200 ms ; `AbortController` à la fin.
- [ ] **Step 3: Montant** : 3 connexions parallèles, `XMLHttpRequest` `POST __up` d'un `Blob` de 4 Mo aléatoires (sans `Content-Type` → pas de pré-requête CORS), compteur via `upload.onprogress` ; mêmes 8 s / 1,5 s de chauffe ; `abort()` à la fin.
- [ ] **Step 4:** UI : Go ↔ Arrêter ; étape en cours mise en évidence ; à la fin, score `/10` + verdict + conseil. Arrêt ou erreur réseau → résultats partiels effacés, message, bouton « Go », pas de score.
- [ ] **Step 5: Verify** (navigateur, requêtes Cloudflare simulées par interception Playwright) : un test complet affiche les 4 valeurs et un score ; requêtes bloquées → message d'erreur et pas de score.
- [ ] **Step 6: Commit** `feat: test de débit et score visio`.

### Task 8: Vérification finale et README

**Files:** Create `README.md` (présentation, lancer en local `npx serve public` ou `python3 -m http.server -d public`, déployer sur Vercel, `npm test`).

- [ ] **Step 1:** Script Playwright hors dépôt : Chromium avec médias factices, viewports 320×640, 375×812, 844×390, 768×1024, 1440×900, 2560×1440 → pas de défilement horizontal, aucune erreur console, captures d'écran ; parcours micro, webcam, son, clavier, débit (Cloudflare simulé), débranchement simulé (`track.stop()` + événement `ended`).
- [ ] **Step 2:** `npm test` → PASS.
- [ ] **Step 3: Commit** `docs: README` puis push sur `claude/focused-ramanujan-nqqds3`.
