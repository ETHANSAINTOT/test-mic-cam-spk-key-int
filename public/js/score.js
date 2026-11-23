// Score de compatibilité visio sur 10 (logique pure, sans DOM).

/** Courbes [mesure, sous-note] triées par mesure croissante. */
export const CURVES = {
  up: [[0.3, 0], [1, 4], [2, 6], [3, 8], [5, 10]],          // Mb/s
  down: [[0.5, 0], [1.5, 4], [3, 6], [5, 8], [10, 10]],     // Mb/s
  ping: [[30, 10], [50, 9], [100, 7], [150, 5], [300, 2], [500, 0]], // ms
  jitter: [[5, 10], [15, 8], [30, 5], [50, 2], [100, 0]],   // ms
};

export const WEIGHTS = { up: 0.35, down: 0.25, ping: 0.25, jitter: 0.15 };

/** Ordre de priorité en cas d'égalité pour désigner le point faible. */
const ORDER = ['up', 'down', 'ping', 'jitter'];

const ADVICE = {
  up: 'Le débit montant (envoi) est le point faible : les autres risquent de vous voir flou ou figé. Rapprochez-vous de la box, branchez un câble Ethernet ou mettez en pause les envois en cours (sauvegardes, cloud).',
  down: 'Le débit descendant est le point faible : la vidéo des autres peut être floue ou saccadée. Fermez les téléchargements et streamings en cours, ou rapprochez-vous de la box.',
  ping: 'Le ping est élevé : attendez-vous à un petit décalage dans la conversation. Préférez une connexion filaire et évitez les VPN si possible.',
  jitter: 'La connexion est instable (gigue élevée) : le son peut hacher. Rapprochez-vous de la box ou branchez un câble Ethernet.',
};

/** Interpolation linéaire par morceaux, bornée aux extrémités. */
export function interpolate(x, points) {
  const first = points[0];
  const last = points[points.length - 1];
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      const y = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      return Math.round(y * 1e6) / 1e6;
    }
  }
  return last[1];
}

/** Sous-notes 0–10 ; une mesure absente, infinie ou négative vaut 0. */
export function subScores(metrics) {
  const sub = {};
  for (const key of ['down', 'up', 'ping', 'jitter']) {
    const value = metrics?.[key];
    sub[key] = Number.isFinite(value) && value >= 0 ? interpolate(value, CURVES[key]) : 0;
  }
  return sub;
}

export function verdictFor(score) {
  if (score >= 9) return 'Excellent';
  if (score >= 7) return 'Bon';
  if (score >= 5) return 'Correct';
  if (score >= 3) return 'Faible';
  return 'Insuffisant';
}

/**
 * @param {{down:number, up:number, ping:number, jitter:number}} metrics Mb/s et ms
 * @returns {{score:number, sub:object, verdict:string, weakest:string, advice:string}}
 */
export function computeScore(metrics) {
  const sub = subScores(metrics);
  const weighted = ORDER.reduce((sum, key) => sum + WEIGHTS[key] * sub[key], 0);
  const weakest = ORDER.reduce((low, key) => (sub[key] < sub[low] ? key : low), ORDER[0]);
  const capped = Math.min(weighted, sub[weakest] + 3);
  const score = Math.max(0, Math.min(10, Math.round(capped)));
  return {
    score,
    sub,
    verdict: verdictFor(score),
    weakest,
    advice: score >= 9 ? '' : ADVICE[weakest],
  };
}
