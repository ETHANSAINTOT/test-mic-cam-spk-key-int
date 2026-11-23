import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaErrorMessage } from '../public/js/messages.js';

test('autorisation refusée', () => {
  const msg = mediaErrorMessage({ name: 'NotAllowedError' }, 'micro');
  assert.match(msg, /refusé/);
  assert.match(msg, /micro/);
});

test('aucun périphérique', () => {
  assert.match(mediaErrorMessage({ name: 'NotFoundError' }, 'caméra'), /Aucun/);
});

test('périphérique déjà utilisé', () => {
  assert.match(mediaErrorMessage({ name: 'NotReadableError' }, 'caméra'), /déjà utilisé/);
});

test('périphérique choisi indisponible', () => {
  assert.match(mediaErrorMessage({ name: 'OverconstrainedError' }, 'micro'), /n'est plus disponible/);
});

test('contexte non sécurisé', () => {
  assert.match(mediaErrorMessage({ name: 'InsecureContext' }, 'micro'), /HTTPS/);
});

test('navigateur sans accès aux périphériques', () => {
  assert.match(mediaErrorMessage({ name: 'Unsupported' }, 'caméra'), /navigateur/);
});

test('erreur inconnue ou absente : message générique avec le périphérique', () => {
  for (const err of [null, undefined, { name: 'WeirdError' }]) {
    const msg = mediaErrorMessage(err, 'caméra');
    assert.ok(msg.length > 0);
    assert.match(msg, /caméra/);
  }
});
