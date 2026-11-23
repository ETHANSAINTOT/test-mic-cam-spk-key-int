import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatKey } from '../public/js/keys.js';

test('lettre simple en majuscule', () => {
  assert.equal(formatKey({ key: 'a', code: 'KeyA' }), 'A');
});

test('combinaisons avec modificateurs', () => {
  assert.equal(formatKey({ key: 'A', code: 'KeyA', shiftKey: true }), 'Maj + A');
  assert.equal(formatKey({ key: 'c', code: 'KeyC', ctrlKey: true }), 'Ctrl + C');
  assert.equal(formatKey({ key: 'v', code: 'KeyV', metaKey: true }, { mac: true }), 'Cmd + V');
  assert.equal(formatKey({ key: 'v', code: 'KeyV', metaKey: true }, { mac: false }), 'Win + V');
});

test('touches nommées en français', () => {
  assert.equal(formatKey({ key: ' ', code: 'Space' }), 'Espace');
  assert.equal(formatKey({ key: 'Enter' }), 'Entrée');
  assert.equal(formatKey({ key: 'Backspace' }), 'Retour arrière');
  assert.equal(formatKey({ key: 'Escape' }), 'Échap');
  assert.equal(formatKey({ key: 'ArrowLeft' }), '← (flèche gauche)');
  assert.equal(formatKey({ key: 'F5' }), 'F5');
  assert.equal(formatKey({ key: 'Dead' }), 'Touche morte');
});

test('un modificateur seul ne se répète pas', () => {
  assert.equal(formatKey({ key: 'Shift', shiftKey: true }), 'Maj');
  assert.equal(formatKey({ key: 'Control', ctrlKey: true }), 'Ctrl');
});

test('touche non identifiée (clavier virtuel Android) → null', () => {
  assert.equal(formatKey({ key: 'Unidentified' }), null);
  assert.equal(formatKey({ key: 'Process' }), null);
  assert.equal(formatKey({}), null);
});
