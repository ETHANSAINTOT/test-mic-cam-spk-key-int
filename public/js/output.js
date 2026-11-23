// Sortie audio choisie dans la carte Son, partagée avec la réécoute du micro.

let sinkId = '';
const listeners = new Set();

/** Identifiant de la sortie choisie ('' = sortie par défaut). */
export function getSinkId() {
  return sinkId;
}

export function setSharedSinkId(id) {
  sinkId = id || '';
  for (const fn of listeners) fn(sinkId);
}

export function onSinkChange(fn) {
  listeners.add(fn);
}

/** Dirige un élément audio vers la sortie choisie, si le navigateur le permet. */
export async function applySink(el) {
  if (typeof el.setSinkId !== 'function' || el.sinkId === sinkId) return;
  try {
    await el.setSinkId(sinkId);
  } catch (err) {
    console.warn('Impossible de changer la sortie audio :', err);
  }
}
