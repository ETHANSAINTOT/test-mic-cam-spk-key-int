// Carte Micro : choix du micro, vumètre, enregistrement de 10 s max et réécoute.
import { role, setStatus, listDevices, fillSelect, onDeviceChange, unsupportedReason } from './ui.js';
import { mediaErrorMessage } from './messages.js';
import { applySink, onSinkChange } from './output.js';

const MAX_RECORD_MS = 10_000;
const PLACEHOLDER = 'Activez le micro pour voir la liste';
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function initMic(card) {
  const el = {};
  for (const name of ['select', 'meter', 'meter-fill', 'start', 'record', 'record-label', 'stop',
    'rec-box', 'rec-fill', 'rec-time', 'playback-box', 'playback', 'status']) {
    el[name] = role(card, name);
  }
  const canRecord = typeof window.MediaRecorder === 'function';

  let stream = null;
  let ctx = null;
  let source = null;
  let analyser = null;
  let buffer = null;
  let raf = 0;
  let level = 0;
  let lastAria = 0;
  let opening = 0;           // jeton de la dernière ouverture, pour ignorer les réponses périmées
  let recorder = null;
  let recTimer = 0;
  let recStart = 0;
  let recGen = 0;            // incrémenté à chaque suppression : invalide un enregistrement en cours de finalisation
  let recUrl = null;

  // ---------- États de l'interface ----------
  function showActive(active) {
    el.start.hidden = active;
    el.stop.hidden = !active;
    el.record.hidden = !active || !canRecord;
  }

  function resetSelect() {
    el.select.replaceChildren(new Option(PLACEHOLDER, ''));
    el.select.disabled = true;
  }

  // ---------- Flux micro ----------
  async function open(deviceId) {
    const reason = unsupportedReason();
    if (reason) {
      setStatus(el.status, mediaErrorMessage({ name: reason }, 'micro'), 'error');
      return;
    }
    const token = ++opening;
    el.start.disabled = true;
    setStatus(el.status, '');
    closeStream();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      });
      if (token !== opening) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      const track = s.getAudioTracks()[0];
      track.addEventListener('ended', onTrackEnded);
      await startMeter(s);
      showActive(true);
      if (!canRecord) setStatus(el.status, "L'enregistrement n'est pas disponible dans ce navigateur, mais la barre de niveau fonctionne.", 'warn');
      fillSelect(el.select, await listDevices('audioinput'), track.getSettings().deviceId || deviceId, 'Micro');
    } catch (err) {
      if (token !== opening) return;
      setStatus(el.status, mediaErrorMessage(err, 'micro'), 'error');
      showActive(false);
    } finally {
      if (token === opening) el.start.disabled = false;
    }
  }

  function closeStream() {
    stopMeter();
    if (stream) {
      for (const t of stream.getTracks()) {
        t.removeEventListener('ended', onTrackEnded);
        t.stop();
      }
      stream = null;
    }
  }

  function onTrackEnded() {
    stopRecording(true);
    closeStream();
    showActive(false);
    setStatus(el.status, 'Le micro a été déconnecté. Rebranchez-le ou choisissez-en un autre, puis réactivez-le.', 'warn');
    refreshList();
  }

  async function refreshList() {
    if (el.select.disabled && !stream) return; // liste jamais affichée : rien à rafraîchir
    const current = stream?.getAudioTracks()[0]?.getSettings().deviceId || el.select.value;
    fillSelect(el.select, await listDevices('audioinput'), current, 'Micro');
  }

  // ---------- Vumètre ----------
  async function startMeter(s) {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    source = ctx.createMediaStreamSource(s);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    buffer = new Float32Array(analyser.fftSize);
    source.connect(analyser);
    raf = requestAnimationFrame(drawMeter);
  }

  function drawMeter(now) {
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (const v of buffer) sum += v * v;
    const rms = Math.sqrt(sum / buffer.length);
    const db = 20 * Math.log10(rms || 1e-8);
    const target = Math.min(1, Math.max(0, (db + 60) / 60)); // −60 dB → 0 %, 0 dB → 100 %
    level = target > level ? target : level * 0.9 + target * 0.1; // monte vite, redescend doucement
    renderLevel(now);
    raf = requestAnimationFrame(drawMeter);
  }

  function renderLevel(now = 0) {
    el['meter-fill'].style.clipPath = `inset(0 ${(100 - level * 100).toFixed(1)}% 0 0)`;
    if (now - lastAria > 250 || level === 0) {
      el.meter.setAttribute('aria-valuenow', String(Math.round(level * 100)));
      lastAria = now;
    }
  }

  function stopMeter() {
    cancelAnimationFrame(raf);
    source?.disconnect();
    source = null;
    analyser = null;
    level = 0;
    renderLevel();
  }

  // ---------- Enregistrement ----------
  function startRecording() {
    discardRecording();
    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
    let r;
    try {
      r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (err) {
      console.error(err);
      setStatus(el.status, "Impossible de lancer l'enregistrement dans ce navigateur.", 'error');
      return;
    }
    const chunks = [];
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.chunks = chunks;
    recorder = r;
    r.start();
    recStart = performance.now();
    el.record.dataset.recording = 'true';
    el['record-label'].textContent = "Arrêter l'enregistrement";
    el['rec-box'].hidden = false;
    tick();
    recTimer = setInterval(tick, 100);
  }

  function tick() {
    const elapsed = performance.now() - recStart;
    const left = Math.max(0, MAX_RECORD_MS - elapsed);
    el['rec-fill'].style.width = `${Math.min(100, (elapsed / MAX_RECORD_MS) * 100)}%`;
    el['rec-time'].textContent = `${Math.ceil(left / 1000)} s`;
    if (elapsed >= MAX_RECORD_MS) stopRecording(true);
  }

  /** Arrête l'enregistrement en cours ; `keep` = proposer la réécoute. */
  function stopRecording(keep) {
    if (!recorder) return;
    const r = recorder;
    recorder = null;
    clearInterval(recTimer);
    el.record.dataset.recording = 'false';
    el['record-label'].textContent = 'Enregistrer (10 s max)';
    el['rec-box'].hidden = true;
    const gen = recGen;
    r.onstop = keep ? () => showRecording(new Blob(r.chunks, { type: r.mimeType || 'audio/webm' }), gen) : null;
    if (r.state !== 'inactive') r.stop();
  }

  function showRecording(blob, gen) {
    if (gen !== recGen) return; // supprimé entre-temps
    if (blob.size === 0) {
      setStatus(el.status, "Aucun son n'a été enregistré. Vérifiez le micro puis réessayez.", 'warn');
      return;
    }
    recUrl = URL.createObjectURL(blob);
    el.playback.src = recUrl;
    el['playback-box'].hidden = false;
    applySink(el.playback);
  }

  function discardRecording() {
    recGen++;
    stopRecording(false);
    el.playback.pause();
    el.playback.removeAttribute('src');
    el.playback.load();
    if (recUrl) URL.revokeObjectURL(recUrl);
    recUrl = null;
    el['playback-box'].hidden = true;
  }

  // Chrome ne connaît pas la durée des enregistrements WebM : on la fait calculer.
  el.playback.addEventListener('loadedmetadata', () => {
    if (el.playback.duration !== Infinity) return;
    el.playback.addEventListener('timeupdate', () => { el.playback.currentTime = 0; }, { once: true });
    el.playback.currentTime = 1e101;
  });

  // ---------- Événements ----------
  el.start.addEventListener('click', () => open(el.select.disabled ? '' : el.select.value));
  el.stop.addEventListener('click', () => {
    stopRecording(true);
    closeStream();
    showActive(false);
  });
  el.record.addEventListener('click', () => {
    if (recorder) stopRecording(true);
    else if (stream) startRecording();
  });
  el.select.addEventListener('change', () => {
    discardRecording();
    if (stream) open(el.select.value);
  });
  onDeviceChange(refreshList);
  onSinkChange(() => applySink(el.playback));

  resetSelect();

  return {
    reset() {
      opening++;
      discardRecording();
      closeStream();
      ctx?.close().catch(() => {});
      ctx = null;
      showActive(false);
      el.start.disabled = false;
      setStatus(el.status, '');
      resetSelect();
    },
  };
}
