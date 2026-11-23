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
