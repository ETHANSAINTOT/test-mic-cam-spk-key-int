// Carte Son : choix de la sortie audio et sons gauche / stéréo / droite.
import { role, setStatus, listDevices, fillSelect, onDeviceChange, mediaSupported } from './ui.js';
import { getSinkId, setSharedSinkId } from './output.js';

/** Entrées du ChannelMergerNode à alimenter : 0 = canal gauche, 1 = canal droit. */
export const CHANNEL_INPUTS = { left: [0], right: [1], both: [0, 1] };

const NOTES = [523.25, 659.25, 783.99]; // do, mi, sol (5e octave)
const NOTE_GAP = 0.22;                   // s entre deux notes
const NOTE_LENGTH = 0.95;                // s par note
const VOLUME = 0.25;
const SOUND_MS = Math.round((NOTE_GAP * (NOTES.length - 1) + NOTE_LENGTH) * 1000) + 100;

const EXPLAIN_NO_LIST = "Ce navigateur ne donne pas la liste des sorties audio. Le son sort par la sortie active de l'appareil : changez-la dans les réglages du système si besoin.";
const EXPLAIN_UNSUPPORTED = "Ce navigateur ne permet pas à un site de choisir la sortie audio (c'est le cas de Safari et de la plupart des téléphones). Le son sort par la sortie active de l'appareil : changez-la dans les réglages du système si besoin.";

export function initSpeaker(card) {
  const el = {};
  for (const name of ['select-field', 'select', 'default-note', 'unlock', 'pick', 'explain', 'mono', 'status']) {
    el[name] = role(card, name);
  }
  const buttons = [...card.querySelectorAll('[data-channel]')];

  const canPick = typeof HTMLMediaElement !== 'undefined' && typeof HTMLMediaElement.prototype.setSinkId === 'function';
  const ctxCanPick = typeof AudioContext !== 'undefined' && typeof AudioContext.prototype.setSinkId === 'function';
  const canSelectOutput = typeof navigator.mediaDevices?.selectAudioOutput === 'function';

  let ctx = null;
  let out = null;       // nœud de sortie du graphe audio
  let mediaEl = null;   // élément <audio> utilisé quand AudioContext.setSinkId n'existe pas
  let current = null;   // son en cours { master, merger, timer, button }
  let playToken = 0;
  let needsNames = false;
  let unlockTried = false;

  // ---------- Liste des sorties ----------
  function showDefault(explain) {
    el['select-field'].hidden = true;
    el['default-note'].hidden = false;
    el.explain.hidden = !explain;
    el.explain.textContent = explain || '';
  }

  async function refreshOutputs() {
    el.pick.hidden = !canSelectOutput;
    if (!canPick) {
      el.unlock.hidden = true;
      showDefault(EXPLAIN_UNSUPPORTED);
      return;
    }
    const devices = await listDevices('audiooutput');
    needsNames = !devices.some((d) => d.label);
    if (needsNames) {
      showDefault(unlockTried ? EXPLAIN_NO_LIST : '');
      el.unlock.hidden = unlockTried || !mediaSupported();
      return;
    }
    el.unlock.hidden = true;
    el['default-note'].hidden = true;
    el.explain.hidden = true;
    el['select-field'].hidden = false;
    const wanted = getSinkId();
    fillSelect(el.select, devices, wanted, 'Sortie');
    if (!wanted || el.select.value !== wanted) setSharedSinkId(el.select.value);
  }

  // Chrome et Firefox ne donnent le nom des sorties qu'après une autorisation du micro.
  async function unlockNames() {
    unlockTried = true;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setStatus(el.status, '');
    } catch {
      setStatus(el.status, "Sans l'autorisation du micro, le navigateur ne donne pas le nom des sorties. Le test fonctionne quand même sur la sortie par défaut.", 'warn');
    }
    await refreshOutputs();
  }

  // Firefox : sélecteur de sortie fourni par le navigateur.
  async function pickOutput() {
    try {
      const device = await navigator.mediaDevices.selectAudioOutput();
      await refreshOutputs();
      if (![...el.select.options].some((o) => o.value === device.deviceId)) {
        el.select.append(new Option(device.label || 'Sortie choisie', device.deviceId));
        el['select-field'].hidden = false;
        el['default-note'].hidden = true;
        el.unlock.hidden = true;
      }
      el.select.value = device.deviceId;
      await chooseOutput(device.deviceId);
    } catch (err) {
      if (err?.name !== 'NotAllowedError' && err?.name !== 'AbortError') console.warn(err);
    }
  }

  async function chooseOutput(id) {
    setSharedSinkId(id);
    setStatus(el.status, '');
    if (ctx) await applySinkToOutput();
  }

  // ---------- Graphe audio ----------
  async function ensureContext() {
    if (!ctx) {
      ctx = new AudioContext();
      if (ctxCanPick || !canPick) {
        out = ctx.destination;
      } else {
        const dest = ctx.createMediaStreamDestination();
        mediaEl = new Audio();
        mediaEl.srcObject = dest.stream;
        out = dest;
      }
    }
    if (ctx.state === 'suspended') await ctx.resume();
    await applySinkToOutput();
  }

  async function applySinkToOutput() {
    const id = getSinkId();
    try {
      if (ctxCanPick) {
        if (ctx.sinkId !== id) await ctx.setSinkId(id);
      } else if (mediaEl) {
        if (mediaEl.sinkId !== id) await mediaEl.setSinkId(id);
        await mediaEl.play();
      }
    } catch (err) {
      console.warn(err);
      setStatus(el.status, "Impossible d'utiliser cette sortie audio. Choisissez-en une autre.", 'error');
    }
    el.mono.hidden = ctx.destination.maxChannelCount !== 1;
  }

  // ---------- Lecture ----------
  async function play(channel, button) {
    stopSound();
    const token = ++playToken;
    button.setAttribute('aria-pressed', 'true');
    try {
      await ensureContext();
    } catch (err) {
      console.error(err);
      button.setAttribute('aria-pressed', 'false');
      setStatus(el.status, 'Impossible de jouer un son dans ce navigateur.', 'error');
      return;
    }
    if (token !== playToken) return;

    const merger = ctx.createChannelMerger(2);
    const master = ctx.createGain();
    master.gain.value = VOLUME;
    for (const input of CHANNEL_INPUTS[channel]) master.connect(merger, 0, input);
    merger.connect(out);

    const t0 = ctx.currentTime + 0.03;
    NOTES.forEach((freq, i) => {
      const start = t0 + i * NOTE_GAP;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(1, start + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, start + NOTE_LENGTH - 0.05);
      const tone = new OscillatorNode(ctx, { type: 'sine', frequency: freq });
      const shine = new OscillatorNode(ctx, { type: 'triangle', frequency: freq * 2 });
      const shineGain = new GainNode(ctx, { gain: 0.15 });
      tone.connect(env);
      shine.connect(shineGain).connect(env);
      env.connect(master);
      for (const osc of [tone, shine]) {
        osc.start(start);
        osc.stop(start + NOTE_LENGTH);
      }
    });

    current = {
      master,
      merger,
      button,
      timer: setTimeout(stopSound, SOUND_MS),
    };
  }

  function stopSound() {
    playToken++;
    for (const b of buttons) b.setAttribute('aria-pressed', 'false');
    if (!current) return;
    clearTimeout(current.timer);
    current.master.disconnect();
    current.merger.disconnect();
    current = null;
  }

  // ---------- Événements ----------
  for (const button of buttons) {
    button.addEventListener('click', () => play(button.dataset.channel, button));
  }
  el.select.addEventListener('change', () => chooseOutput(el.select.value));
  el.unlock.addEventListener('click', unlockNames);
  el.pick.addEventListener('click', pickOutput);
  onDeviceChange(refreshOutputs);
  // L'autorisation du micro a pu être donnée dans la carte Micro : on récupère alors les noms.
  const refreshIfNeeded = () => { if (needsNames) refreshOutputs(); };
  card.addEventListener('pointerenter', refreshIfNeeded);
  card.addEventListener('focusin', refreshIfNeeded);

  refreshOutputs();

  return {
    reset() {
      stopSound();
      mediaEl?.pause();
      mediaEl = null;
      ctx?.close().catch(() => {});
      ctx = null;
      out = null;
      setStatus(el.status, '');
    },
  };
}
