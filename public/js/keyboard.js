// Carte Clavier : zone de texte brut et indicateur de la dernière touche.
import { role } from './ui.js';
import { formatKey, labelFromInput } from './keys.js';

const EMPTY = '–';
const IS_MAC = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent);

export function initKeyboard(card) {
  const input = role(card, 'input');
  const last = role(card, 'last');
  const count = role(card, 'count');
  const clear = role(card, 'clear');
  let unidentified = false; // dernier keydown sans nom exploitable (clavier virtuel)

  function updateCount() {
    count.textContent = String([...input.value].length);
  }

  function empty() {
    input.value = '';
    last.textContent = EMPTY;
    unidentified = false;
    updateCount();
  }

  input.addEventListener('keydown', (e) => {
    const label = formatKey(e, { mac: IS_MAC });
    unidentified = label === null;
    if (label) last.textContent = label;
  });

  input.addEventListener('input', (e) => {
    updateCount();
    if (!unidentified) return;
    unidentified = false;
    const label = labelFromInput(e);
    if (label) last.textContent = label;
  });

  clear.addEventListener('click', () => {
    empty();
    input.focus();
  });

  // Certains navigateurs restaurent le contenu des champs : on part toujours d'une zone vide.
  empty();

  return { reset: empty };
}
