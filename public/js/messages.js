// Messages d'erreur d'accès au micro / à la caméra (logique pure).

const WORDS = {
  micro: {
    The: 'Le micro', to: 'au micro', none: 'Aucun micro détecté', one: 'un',
    chosen: 'Le micro choisi', e: '',
  },
  caméra: {
    The: 'La caméra', to: 'à la caméra', none: 'Aucune caméra détectée', one: 'une',
    chosen: 'La caméra choisie', e: 'e',
  },
};

/**
 * @param {{name?: string} | null | undefined} err erreur levée par getUserMedia
 * @param {'micro' | 'caméra'} device
 */
export function mediaErrorMessage(err, device) {
  const w = WORDS[device] ?? WORDS.micro;
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return `Accès ${w.to} refusé. Autorisez-le dans les réglages du navigateur (icône à gauche de l'adresse du site), puis réessayez.`;
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return `${w.none}. Branchez-en ${w.one} puis réessayez.`;
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return `${w.The} est déjà utilisé${w.e} par une autre application ou bloqué${w.e} par le système. Fermez les autres applications puis réessayez.`;
    case 'OverconstrainedError':
      return `${w.chosen} n'est plus disponible. Choisissez-en ${w.one} autre dans la liste.`;
    case 'InsecureContext':
      return `L'accès ${w.to} n'est possible que sur une page sécurisée (HTTPS).`;
    case 'Unsupported':
      return `Ce navigateur ne permet pas d'accéder ${w.to}. Essayez une version récente de Chrome, Edge, Firefox ou Safari.`;
    default:
      return `Impossible d'accéder ${w.to}. Réessayez ou rechargez la page.`;
  }
}
