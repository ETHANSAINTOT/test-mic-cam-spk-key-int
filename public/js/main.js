// Point d'entrée : initialise chaque carte et nettoie tout au départ de la page.
import { role, setStatus } from './ui.js';

const CARDS = [
  ['micro', './mic.js', 'initMic'],
  ['webcam', './camera.js', 'initCamera'],
  ['son', './speaker.js', 'initSpeaker'],
  ['clavier', './keyboard.js', 'initKeyboard'],
  ['debit', './speedtest.js', 'initSpeedtest'],
];

const controllers = [];

// Chaque carte est chargée séparément : si l'une échoue, les autres restent utilisables.
await Promise.all(CARDS.map(async ([id, path, init]) => {
  const card = document.getElementById(id);
  try {
    const mod = await import(path);
    controllers.push(mod[init](card));
  } catch (err) {
    console.error(`Carte « ${id} » :`, err);
    const status = role(card, 'status');
    if (status) setStatus(status, "Ce test n'a pas pu se charger dans ce navigateur.", 'error');
  }
}));

function resetAll() {
  for (const c of controllers) {
    try { c.reset(); } catch (err) { console.error(err); }
  }
}

// Départ de la page (fermeture, navigation, mise en cache) : on coupe et on efface tout.
addEventListener('pagehide', resetAll);
// Retour via « Précédent » depuis le cache du navigateur : on repart de zéro.
addEventListener('pageshow', (e) => { if (e.persisted) resetAll(); });

// Met en évidence, dans le menu, la carte visible.
const links = new Map([...document.querySelectorAll('.site-nav a')].map((a) => [a.hash.slice(1), a]));
if ('IntersectionObserver' in window) {
  const visible = new Set();
  const observer = new IntersectionObserver((entries) => {
    for (const e of entries) (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id));
    const current = CARDS.map(([id]) => id).find((id) => visible.has(id));
    for (const [id, a] of links) a.setAttribute('aria-current', String(id === current));
  }, { rootMargin: '-45% 0px -45% 0px' });
  CARDS.forEach(([id]) => observer.observe(document.getElementById(id)));
}
