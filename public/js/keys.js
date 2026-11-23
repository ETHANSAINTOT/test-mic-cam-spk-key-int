// Nom lisible d'une touche pour l'indicateur « Dernière touche » (logique pure).

const NAMES = {
  ' ': 'Espace',
  Enter: 'Entrée',
  Backspace: 'Retour arrière',
  Delete: 'Suppr',
  Escape: 'Échap',
  Tab: 'Tab',
  CapsLock: 'Verr. Maj',
  NumLock: 'Verr. Num',
  ArrowLeft: '← (flèche gauche)',
  ArrowRight: '→ (flèche droite)',
  ArrowUp: '↑ (flèche haut)',
  ArrowDown: '↓ (flèche bas)',
  Home: 'Début',
  End: 'Fin',
  PageUp: 'Page préc.',
  PageDown: 'Page suiv.',
  Insert: 'Inser',
  Dead: 'Touche morte',
  ContextMenu: 'Menu',
  PrintScreen: 'Impr. écran',
  AltGraph: 'Alt Gr',
  Shift: 'Maj',
  Control: 'Ctrl',
  Alt: 'Alt',
};

const MODIFIERS = [
  { flag: 'ctrlKey', key: 'Control', label: () => 'Ctrl' },
  { flag: 'altKey', key: 'Alt', label: () => 'Alt' },
  { flag: 'shiftKey', key: 'Shift', label: () => 'Maj' },
  { flag: 'metaKey', key: 'Meta', label: (mac) => (mac ? 'Cmd' : 'Win') },
];

/**
 * @param {{key?: string, code?: string, ctrlKey?: boolean, shiftKey?: boolean, altKey?: boolean, metaKey?: boolean}} e
 * @param {{mac?: boolean}} [opts]
 * @returns {string | null} null quand la touche n'est pas identifiable (clavier virtuel)
 */
export function formatKey(e, opts = {}) {
  const key = e?.key;
  if (!key || key === 'Unidentified' || key === 'Process') return null;
  const mac = Boolean(opts.mac);
  const isMeta = key === 'Meta' || key === 'OS';

  const parts = MODIFIERS
    .filter((m) => e[m.flag] && m.key !== key && !(isMeta && m.key === 'Meta'))
    .map((m) => m.label(mac));

  let main;
  if (isMeta) main = mac ? 'Cmd' : 'Win';
  else if (key in NAMES) main = NAMES[key];
  else main = key.length === 1 ? key.toUpperCase() : key;

  return [...parts, main].join(' + ');
}
