import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpolate, subScores, computeScore, verdictFor, CURVES, WEIGHTS } from '../public/js/score.js';

test('interpolate suit la courbe du débit montant', () => {
  assert.equal(interpolate(0.65, CURVES.up), 2);
  assert.equal(interpolate(1.5, CURVES.up), 5);
});

test('interpolate borne aux extrémités', () => {
  assert.equal(interpolate(0.1, CURVES.up), 0);
  assert.equal(interpolate(10, CURVES.up), 10);
  assert.equal(interpolate(10, CURVES.ping), 10);
  assert.equal(interpolate(1000, CURVES.ping), 0);
});

test('interpolate gère une courbe décroissante (ping)', () => {
  assert.equal(interpolate(75, CURVES.ping), 8);
});

test('les courbes et poids reprennent les valeurs du design', () => {
  assert.deepEqual(CURVES.up, [[0.3, 0], [1, 4], [2, 6], [3, 8], [5, 10]]);
  assert.deepEqual(CURVES.down, [[0.5, 0], [1.5, 4], [3, 6], [5, 8], [10, 10]]);
  assert.deepEqual(CURVES.ping, [[30, 10], [50, 9], [100, 7], [150, 5], [300, 2], [500, 0]]);
  assert.deepEqual(CURVES.jitter, [[5, 10], [15, 8], [30, 5], [50, 2], [100, 0]]);
  assert.deepEqual(WEIGHTS, { up: 0.35, down: 0.25, ping: 0.25, jitter: 0.15 });
});

test('une excellente connexion obtient 10 et Excellent', () => {
  const r = computeScore({ down: 100, up: 50, ping: 10, jitter: 1 });
  assert.equal(r.score, 10);
  assert.equal(r.verdict, 'Excellent');
  assert.equal(r.advice, '');
});

test('une connexion inutilisable obtient 0 et Insuffisant', () => {
  const r = computeScore({ down: 0.1, up: 0.1, ping: 600, jitter: 200 });
  assert.equal(r.score, 0);
  assert.equal(r.verdict, 'Insuffisant');
});

test('un seul maillon faible plafonne le score à pire sous-note + 3', () => {
  const r = computeScore({ down: 100, up: 0.3, ping: 20, jitter: 2 });
  assert.equal(r.score, 3);
  assert.equal(r.weakest, 'up');
  assert.equal(r.verdict, 'Faible');
  assert.match(r.advice, /montant|envoi/i);
});

test('une connexion moyenne obtient la moyenne pondérée arrondie', () => {
  const r = computeScore({ down: 5, up: 2, ping: 100, jitter: 15 });
  assert.deepEqual(r.sub, { down: 8, up: 6, ping: 7, jitter: 8 });
  assert.equal(r.score, 7);
  assert.equal(r.weakest, 'up');
  assert.equal(r.verdict, 'Bon');
});

test('les mesures invalides donnent une sous-note de 0', () => {
  assert.deepEqual(
    subScores({ down: NaN, up: -1, ping: Infinity, jitter: undefined }),
    { down: 0, up: 0, ping: 0, jitter: 0 },
  );
});

test('verdictFor suit les paliers du design', () => {
  const expected = {
    10: 'Excellent', 9: 'Excellent', 8: 'Bon', 7: 'Bon', 6: 'Correct', 5: 'Correct',
    4: 'Faible', 3: 'Faible', 2: 'Insuffisant', 1: 'Insuffisant', 0: 'Insuffisant',
  };
  for (const [score, verdict] of Object.entries(expected)) {
    assert.equal(verdictFor(Number(score)), verdict, `score ${score}`);
  }
});
