import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './load-module.mjs';

test('scores are rounded consistently and missing scores show a dash', async () => {
  const { formatScore, formatScoreValue } = await loadModule('src/shared/format.ts');
  assert.equal(formatScore(52.8846, 'takeAgain'), '53%');
  assert.equal(formatScore(0, 'takeAgain'), '0%');
  assert.equal(formatScore(3.3, 'rating'), '3.3/5');
  assert.equal(formatScore(4, 'difficulty'), '4.0/5');
  assert.equal(formatScore(null, 'rating'), '—');
  assert.equal(formatScoreValue(null, 'takeAgain'), null);
});

test('tones use the existing thresholds and are null for missing scores', async () => {
  const { scoreTone } = await loadModule('src/shared/format.ts');
  assert.deepEqual([4, 3, 2.9].map(v => scoreTone(v, 'rating')), ['good', 'mid', 'bad']);
  assert.deepEqual([2.5, 3.5, 3.6].map(v => scoreTone(v, 'difficulty')), ['good', 'mid', 'bad']);
  assert.deepEqual([80, 60, 59].map(v => scoreTone(v, 'takeAgain')), ['good', 'mid', 'bad']);
  assert.equal(scoreTone(null, 'rating'), null);
});
