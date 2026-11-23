import { test } from 'node:test';
import assert from 'node:assert/strict';
import { median, jitter, mbps } from '../public/js/stats.js';

test('median d\'un nombre impair de valeurs', () => {
  assert.equal(median([5, 1, 3]), 3);
});

test('median d\'un nombre pair de valeurs', () => {
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test('median d\'une liste vide vaut NaN', () => {
  assert.ok(Number.isNaN(median([])));
});

test('median ne modifie pas la liste reçue', () => {
  const values = [3, 1, 2];
  median(values);
  assert.deepEqual(values, [3, 1, 2]);
});

test('jitter = moyenne des écarts absolus consécutifs', () => {
  assert.equal(jitter([10, 20, 10, 20]), 10);
  assert.equal(jitter([10, 12, 18]), 4);
});

test('jitter vaut 0 avec moins de deux mesures', () => {
  assert.equal(jitter([10]), 0);
  assert.equal(jitter([]), 0);
});

test('mbps convertit octets et millisecondes en mégabits par seconde', () => {
  assert.equal(mbps(1_000_000, 1000), 8);
  assert.equal(mbps(0, 1000), 0);
});

test('mbps vaut 0 si la durée est nulle', () => {
  assert.equal(mbps(1000, 0), 0);
});
