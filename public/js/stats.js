// Petites statistiques pour le test de débit (logique pure).

export function median(values) {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Gigue : moyenne des écarts absolus entre mesures consécutives. */
export function jitter(values) {
  if (values.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < values.length; i++) total += Math.abs(values[i] - values[i - 1]);
  return total / (values.length - 1);
}

/** Octets reçus/envoyés en `ms` millisecondes → mégabits par seconde. */
export function mbps(bytes, ms) {
  if (!(ms > 0)) return 0;
  return (bytes * 8) / ms / 1000;
}

/**
 * Débit (Mb/s) mesuré à partir de relevés cumulés `{t (ms), total (octets)}`,
 * en ignorant les `warmupMs` premières millisecondes (montée en charge de la connexion).
 */
export function windowMbps(samples, warmupMs) {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let base = samples.find((s) => s.t >= warmupMs);
  if (!base || base === last) base = samples[0];
  return mbps(last.total - base.total, last.t - base.t);
}

/** Ping (médiane) et gigue, sans la première mesure qui inclut l'ouverture de connexion. */
export function pingStats(samples) {
  const kept = samples.length > 1 ? samples.slice(1) : samples;
  return { ping: median(kept), jitter: jitter(kept) };
}
