import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './load-module.mjs';

test('metricTone applies the good/mid/bad thresholds per metric', async () => {
  const { metricTone } = await loadModule('src/shared/format.ts');
  assert.deepEqual([4, 3.9, 3, 2.9].map(v => metricTone(v, 'rating')), ['good', 'mid', 'mid', 'bad']);
  assert.deepEqual([2.5, 2.6, 3.5, 3.6].map(v => metricTone(v, 'difficulty')), ['good', 'mid', 'mid', 'bad']);
  assert.deepEqual([80, 79, 60, 59].map(v => metricTone(v, 'takeAgain')), ['good', 'mid', 'mid', 'bad']);
});
