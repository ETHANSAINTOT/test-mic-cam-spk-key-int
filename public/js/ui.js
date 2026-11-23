// Petites aides partagées par les cartes.

/** Élément `[data-role="name"]` dans `root`. */
export function role(root, name) {
  return root.querySelector(`[data-role="${name}"]`);
}

/** Affiche (ou masque si `text` est vide) un message de statut. */
export function setStatus(el, text, kind = 'info') {
  el.textContent = text || '';
  el.dataset.kind = text ? kind : '';
  el.hidden = !text;
}

export function mediaSupported() {
  return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/** Raison pour laquelle caméra/micro sont inaccessibles, ou null. */
export function unsupportedReason() {
  if (!window.isSecureContext) return 'InsecureContext';
  if (!mediaSupported()) return 'Unsupported';
  return null;
}

/** Périphériques d'un type donné (libellés vides tant qu'aucune autorisation n'a été donnée). */
export async function listDevices(kind) {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === kind && d.deviceId !== '');
}

/** Remplit une liste déroulante avec des périphériques. */
export function fillSelect(select, devices, selectedId, fallbackLabel) {
  select.replaceChildren();
  if (devices.length === 0) {
    select.append(new Option('Aucun périphérique détecté', ''));
    select.disabled = true;
    return;
  }
  devices.forEach((d, i) => {
    select.append(new Option(d.label || `${fallbackLabel} n°${i + 1}`, d.deviceId));
  });
  if (selectedId && devices.some((d) => d.deviceId === selectedId)) select.value = selectedId;
  select.disabled = false;
}

/** Appelle `cb` quand un périphérique est branché ou débranché. */
export function onDeviceChange(cb) {
  navigator.mediaDevices?.addEventListener?.('devicechange', cb);
}
