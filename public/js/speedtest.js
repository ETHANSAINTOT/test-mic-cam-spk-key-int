// Carte Débit : ping, débit descendant, débit montant et score visio sur 10.
// Mesure faite avec les serveurs publics de test de Cloudflare.
import { role, setStatus } from './ui.js';
import { windowMbps, pingStats } from './stats.js';
import { computeScore } from './score.js';

const BASE = 'https://speed.cloudflare.com';
const PING_COUNT = 11;            // la 1re mesure est ignorée
const PHASE_MS = 8000;            // durée de chaque mesure de débit
const WARMUP_MS = 1500;           // montée en charge ignorée
const DOWN_CONNECTIONS = 4;
const DOWN_BYTES = 25_000_000;    // taille demandée par téléchargement
const UP_CONNECTIONS = 3;
const UP_BYTES = 4 * 1024 * 1024; // taille de chaque envoi
const MAX_FAILURES = 3;           // échecs consécutifs tolérés par connexion

const PHASE_TEXT = {
  ping: 'Mesure du ping…',
  down: 'Mesure du débit descendant…',
  up: 'Mesure du débit montant…',
};
const IDLE_TEXT = 'Environ 20 secondes.';
const EMPTY = '–';

// ---------- Mesures ----------

function sleep(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

function abortError() {
  return new DOMException('Test arrêté', 'AbortError');
}

async function measurePing(signal, onUpdate) {
  const samples = [];
  for (let i = 0; i < PING_COUNT; i++) {
    const url = `${BASE}/__down?bytes=0&n=${Date.now()}-${i}`;
    const start = performance.now();
    const res = await fetch(url, { cache: 'no-store', signal });
    await res.arrayBuffer();
    let ms = performance.now() - start;
    // Plus précis quand le serveur autorise la lecture des temps (Timing-Allow-Origin).
    const entry = performance.getEntriesByName(url).at(-1);
    if (entry && entry.requestStart > 0 && entry.responseStart > entry.requestStart) {
      ms = entry.responseStart - entry.requestStart;
    }
    samples.push(ms);
    if (i > 0) onUpdate(pingStats(samples));
  }
  performance.clearResourceTimings?.();
  return pingStats(samples);
}

/** Lance `connections` boucles de transfert pendant PHASE_MS et renvoie le débit en Mb/s. */
async function measureThroughput(signal, connections, transferOnce, onRate) {
  const counter = { bytes: 0 };
  const ctrl = new AbortController();
  const stop = () => ctrl.abort();
  signal.addEventListener('abort', stop, { once: true });
  const t0 = performance.now();
  const deadline = t0 + PHASE_MS;
  const samples = [{ t: 0, total: 0 }];
  const sample = () => samples.push({ t: performance.now() - t0, total: counter.bytes });
  const timer = setInterval(() => { sample(); onRate(windowMbps(samples, WARMUP_MS)); }, 200);

  async function loop() {
    let failures = 0;
    while (performance.now() < deadline && !ctrl.signal.aborted) {
      try {
        await transferOnce(ctrl.signal, counter, deadline);
        failures = 0;
      } catch (err) {
        if (ctrl.signal.aborted) return;
        if (++failures >= MAX_FAILURES) throw err;
      }
    }
  }

  try {
    // Une connexion qui échoue trop souvent fait échouer la mesure tout de suite.
    await Promise.race([sleep(PHASE_MS, ctrl.signal), Promise.all(Array.from({ length: connections }, loop))]);
  } finally {
    clearInterval(timer);
    sample();
    ctrl.abort();
    signal.removeEventListener('abort', stop);
  }
  if (signal.aborted) throw abortError();
  if (counter.bytes === 0) throw new Error('Aucune donnée transférée');
  return windowMbps(samples, WARMUP_MS);
}

async function downloadOnce(signal, counter, deadline) {
  const res = await fetch(`${BASE}/__down?bytes=${DOWN_BYTES}&n=${Math.random()}`, { cache: 'no-store', signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) {
    counter.bytes += (await res.arrayBuffer()).byteLength;
    return;
  }
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    counter.bytes += value.byteLength;
    if (performance.now() >= deadline) {
      reader.cancel().catch(() => {});
      return;
    }
  }
}

function randomBlob(size) {
  const block = new Uint8Array(1024 * 1024);
  for (let i = 0; i < block.length; i += 65536) crypto.getRandomValues(block.subarray(i, i + 65536));
  return new Blob(Array.from({ length: Math.ceil(size / block.length) }, () => block));
}

function uploadOnce(blob) {
  return (signal, counter) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let sent = 0;
    const onAbort = () => xhr.abort();
    xhr.open('POST', `${BASE}/__up`);
    xhr.upload.onprogress = (e) => { counter.bytes += e.loaded - sent; sent = e.loaded; };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 400) {
        counter.bytes += blob.size - sent; // complète si les événements de progression ont manqué
        resolve();
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Erreur réseau'));
    xhr.onabort = () => resolve();
    xhr.onloadend = () => signal.removeEventListener('abort', onAbort);
    signal.addEventListener('abort', onAbort, { once: true });
    xhr.send(blob); // Blob sans type : pas de pré-requête CORS
  });
}

/** Test complet. `onProgress(phase, values)` est appelé au fil des mesures. */
export async function runSpeedTest({ signal, onProgress }) {
  onProgress('ping', {});
  const { ping, jitter } = await measurePing(signal, (v) => onProgress('ping', v));
  onProgress('down', { ping, jitter });
  const down = await measureThroughput(signal, DOWN_CONNECTIONS, downloadOnce, (rate) => onProgress('down', { down: rate }));
  onProgress('up', { down });
  const up = await measureThroughput(signal, UP_CONNECTIONS, uploadOnce(randomBlob(UP_BYTES)), (rate) => onProgress('up', { up: rate }));
  return { ping, jitter, down, up };
}

// ---------- Affichage ----------

function formatMbps(value) {
  if (!Number.isFinite(value)) return EMPTY;
  return value.toLocaleString('fr-FR', { maximumFractionDigits: value < 10 ? 1 : 0 });
}

function formatMs(value) {
  return Number.isFinite(value) ? String(Math.round(value)) : EMPTY;
}

export function initSpeedtest(card) {
  const el = {};
  for (const name of ['go', 'phase', 'ping', 'jitter', 'down', 'up', 'score-box', 'score', 'verdict', 'advice', 'status']) {
    el[name] = role(card, name);
  }
  const metrics = Object.fromEntries([...card.querySelectorAll('[data-metric]')].map((m) => [m.dataset.metric, m]));
  let controller = null;

  function setActive(phase) {
    for (const [key, m] of Object.entries(metrics)) m.dataset.active = String(key === phase);
  }

  function setRunning(running) {
    el.go.dataset.running = String(running);
    el.go.textContent = running ? 'Arrêter' : 'Go';
    el.go.setAttribute('aria-label', running ? 'Arrêter le test de débit' : 'Lancer le test de débit');
  }

  function clearResults() {
    el.ping.textContent = EMPTY;
    el.down.textContent = EMPTY;
    el.up.textContent = EMPTY;
    el.jitter.textContent = '';
    el['score-box'].hidden = true;
    el.phase.textContent = IDLE_TEXT;
    setActive(null);
  }

  function show(values) {
    if ('ping' in values) el.ping.textContent = formatMs(values.ping);
    if ('jitter' in values) el.jitter.textContent = `Gigue : ${formatMs(values.jitter)} ms`;
    if ('down' in values) el.down.textContent = formatMbps(values.down);
    if ('up' in values) el.up.textContent = formatMbps(values.up);
  }

  function showScore(result) {
    const { score, verdict, advice } = computeScore(result);
    el.score.textContent = String(score);
    el.verdict.textContent = verdict;
    el.advice.textContent = advice || 'Votre connexion est parfaite pour une visio en haute qualité.';
    el['score-box'].dataset.level = score >= 7 ? 'good' : score >= 5 ? 'mid' : 'bad';
    el['score-box'].hidden = false;
  }

  async function start() {
    const ctrl = new AbortController();
    controller = ctrl;
    clearResults();
    setStatus(el.status, '');
    setRunning(true);
    try {
      if (navigator.onLine === false) throw new Error('Hors ligne');
      const result = await runSpeedTest({
        signal: ctrl.signal,
        onProgress(phase, values) {
          if (controller !== ctrl) return;
          setActive(phase);
          el.phase.textContent = PHASE_TEXT[phase];
          show(values);
        },
      });
      if (controller !== ctrl) return;
      show(result);
      setActive(null);
      el.phase.textContent = 'Test terminé.';
      showScore(result);
    } catch (err) {
      if (controller !== ctrl) return; // remis à zéro entre-temps
      clearResults();
      if (ctrl.signal.aborted) {
        setStatus(el.status, 'Test arrêté.', 'info');
      } else {
        console.warn('Test de débit :', err);
        setStatus(el.status, navigator.onLine === false
          ? 'Vous semblez hors ligne. Vérifiez votre connexion puis relancez le test.'
          : "Impossible de joindre le serveur de test. Vérifiez votre connexion, ou désactivez le bloqueur de publicité ou le pare-feu qui bloque peut-être speed.cloudflare.com.", 'error');
      }
    } finally {
      if (controller === ctrl) {
        controller = null;
        setRunning(false);
      }
    }
  }

  el.go.addEventListener('click', () => {
    if (controller) controller.abort();
    else start();
  });

  setRunning(false);
  clearResults();

  return {
    reset() {
      const ctrl = controller;
      controller = null;
      ctrl?.abort();
      setRunning(false);
      clearResults();
      setStatus(el.status, '');
    },
  };
}
