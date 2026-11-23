import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHANNEL_INPUTS } from '../public/js/speaker.js';

test('Gauche joue uniquement dans le canal gauche (entrée 0)', () => {
  assert.deepEqual(CHANNEL_INPUTS.left, [0]);
});

test('Droite joue uniquement dans le canal droit (entrée 1)', () => {
  assert.deepEqual(CHANNEL_INPUTS.right, [1]);
});

test('Stéréo joue dans les deux canaux', () => {
  assert.deepEqual(CHANNEL_INPUTS.both, [0, 1]);
});
