// Carte Webcam : choix de la caméra et aperçu en direct.
import { role, setStatus, listDevices, fillSelect, onDeviceChange, unsupportedReason } from './ui.js';
import { mediaErrorMessage } from './messages.js';

const PLACEHOLDER = 'Activez la webcam pour voir la liste';

export function initCamera(card) {
  const el = {};
  for (const name of ['select', 'video-box', 'video', 'placeholder', 'info', 'start', 'stop', 'mirror', 'status']) {
    el[name] = role(card, name);
  }

  let stream = null;
  let opening = 0; // jeton de la dernière ouverture, pour ignorer les réponses périmées

  function showActive(active) {
    el.start.hidden = active;
    el.stop.hidden = !active;
    el.placeholder.hidden = active;
    el.info.hidden = !active;
  }

  function resetSelect() {
    el.select.replaceChildren(new Option(PLACEHOLDER, ''));
    el.select.disabled = true;
  }

  function applyMirror() {
    el['video-box'].dataset.mirror = String(el.mirror.checked);
  }

  function updateInfo() {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    const s = track.getSettings();
    const w = el.video.videoWidth || s.width;
    const h = el.video.videoHeight || s.height;
    if (!w || !h) return;
    const fps = s.frameRate ? ` · ${Math.round(s.frameRate)} i/s` : '';
    el.info.textContent = `${w}×${h}${fps}`;
  }

  async function open(deviceId) {
    const reason = unsupportedReason();
    if (reason) {
      setStatus(el.status, mediaErrorMessage({ name: reason }, 'caméra'), 'error');
      return;
    }
    const token = ++opening;
    el.start.disabled = true;
    setStatus(el.status, '');
    closeStream();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (token !== opening) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      const track = s.getVideoTracks()[0];
      track.addEventListener('ended', onTrackEnded);
      el.video.srcObject = s;
      el.video.play().catch(() => {});
      el.info.textContent = '';
      showActive(true);
      updateInfo();
      fillSelect(el.select, await listDevices('videoinput'), track.getSettings().deviceId || deviceId, 'Caméra');
    } catch (err) {
      if (token !== opening) return;
      setStatus(el.status, mediaErrorMessage(err, 'caméra'), 'error');
      showActive(false);
    } finally {
      if (token === opening) el.start.disabled = false;
    }
  }

  function closeStream() {
    if (stream) {
      for (const t of stream.getTracks()) {
        t.removeEventListener('ended', onTrackEnded);
        t.stop();
      }
      stream = null;
    }
    el.video.srcObject = null;
  }

  function onTrackEnded() {
    closeStream();
    showActive(false);
    setStatus(el.status, 'La caméra a été déconnectée. Rebranchez-la ou choisissez-en une autre, puis réactivez-la.', 'warn');
    refreshList();
  }

  async function refreshList() {
    if (el.select.disabled && !stream) return;
    const current = stream?.getVideoTracks()[0]?.getSettings().deviceId || el.select.value;
    fillSelect(el.select, await listDevices('videoinput'), current, 'Caméra');
  }

  el.start.addEventListener('click', () => open(el.select.disabled ? '' : el.select.value));
  el.stop.addEventListener('click', () => {
    closeStream();
    showActive(false);
  });
  el.select.addEventListener('change', () => { if (stream) open(el.select.value); });
  el.mirror.addEventListener('change', applyMirror);
  el.video.addEventListener('resize', updateInfo);
  el.video.addEventListener('loadedmetadata', updateInfo);
  onDeviceChange(refreshList);

  applyMirror();
  resetSelect();

  return {
    reset() {
      opening++;
      closeStream();
      showActive(false);
      el.start.disabled = false;
      setStatus(el.status, '');
      resetSelect();
    },
  };
}
