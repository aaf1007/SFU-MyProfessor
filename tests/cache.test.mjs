import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './load-module.mjs';

const storage = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    get: async key => (key === null ? { ...data } : key in data ? { [key]: data[key] } : {}),
    set: async items => { Object.assign(data, items); },
    remove: async keys => { for (const key of [keys].flat()) delete data[key]; },
  };
};

const professor = { name: 'John Edgar', avgRating: 3.3, avgDifficulty: 3.4,
  wouldTakeAgainPercent: 53, numRatings: 152, legacyId: '1', topTags: [] };

test('entries are keyed by normalized name and expire by result type', async () => {
  const { createProfessorCache, FOUND_TTL_MS, NOT_FOUND_TTL_MS } = await loadModule('src/background/cache.ts');
  let now = 1_000;
  const cache = createProfessorCache(storage(), () => now);
  assert.equal(await cache.get('John Edgar'), undefined);
  await cache.set('John Edgar', professor);
  await cache.set('Some TA', null);
  assert.deepEqual(await cache.get('  john   EDGAR '), professor);
  assert.equal(await cache.get('Some TA'), null);
  now += NOT_FOUND_TTL_MS;
  assert.equal(await cache.get('Some TA'), undefined);
  assert.deepEqual(await cache.get('John Edgar'), professor);
  now += FOUND_TTL_MS;
  assert.equal(await cache.get('John Edgar'), undefined);
});

test('prune removes expired and old-version entries only', async () => {
  const { createProfessorCache } = await loadModule('src/background/cache.ts');
  const area = storage({
    'professor:v2:fresh': { data: null, expiresAt: 5_000 },
    'professor:v2:stale': { data: null, expiresAt: 500 },
    'professor:v1:old': { data: null, expiresAt: 5_000 },
    unrelated: 1,
  });
  await createProfessorCache(area, () => 1_000).prune();
  assert.deepEqual(Object.keys(area.data).sort(), ['professor:v2:fresh', 'unrelated']);
});

test('storage failures degrade to cache misses', async t => {
  const { createProfessorCache } = await loadModule('src/background/cache.ts');
  t.mock.method(console, 'warn', () => {});
  const broken = { get: async () => { throw new Error('quota'); }, set: async () => { throw new Error('quota'); }, remove: async () => {} };
  const cache = createProfessorCache(broken);
  await cache.set('John Edgar', professor);
  assert.equal(await cache.get('John Edgar'), undefined);
});
