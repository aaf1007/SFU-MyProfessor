import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { loadModule } from './load-module.mjs';

const result = { professors: [], hasMore: false };

test('typing is debounced and clearing stops a pending request', async () => {
  const { createProfessorSearch } = await loadModule('src/sidepanel/search-controller.ts');
  const requests = [], states = [];
  const search = createProfessorSearch(async query => { requests.push(query); return result; }, state => states.push(state));
  search.update('jo');
  search.update('john');
  await delay(350);
  assert.deepEqual(requests, ['john']);
  assert.equal(states.at(-1).status, 'success');
  search.update('jane');
  search.update('');
  await delay(350);
  assert.deepEqual(requests, ['john']);
  assert.equal(states.at(-1).status, 'idle');
});

test('an older response cannot replace a newer query during debounce', async () => {
  const { createProfessorSearch } = await loadModule('src/sidepanel/search-controller.ts');
  const pending = [], states = [];
  const search = createProfessorSearch(() => new Promise(resolve => pending.push(resolve)), state => states.push(state));
  search.update('john', true);
  search.update('jane');
  pending[0](result);
  await delay(0);
  assert.equal(states.at(-1).query, 'jane');
  assert.equal(states.at(-1).status, 'loading');
  search.update('');
});

test('clearing invalidates in-flight responses and failures', async () => {
  const { createProfessorSearch } = await loadModule('src/sidepanel/search-controller.ts');
  let reject;
  const states = [];
  const search = createProfessorSearch(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; }), state => states.push(state));
  search.update('john', true);
  search.update('');
  reject(new Error('Offline'));
  await delay(0);
  assert.equal(states.at(-1).status, 'idle');
});

test('failed searches can be retried immediately with Enter or Retry', async () => {
  const { createProfessorSearch } = await loadModule('src/sidepanel/search-controller.ts');
  let attempts = 0;
  const states = [];
  const search = createProfessorSearch(async () => {
    if (++attempts === 1) throw new Error('Offline');
    return result;
  }, state => states.push(state));
  search.update('john', true);
  await delay(0);
  assert.equal(states.at(-1).status, 'error');
  search.update('john', true);
  await delay(0);
  assert.equal(states.at(-1).status, 'success');
});

test('a custom readiness check keeps partial input idle', async () => {
  const { createProfessorSearch } = await loadModule('src/sidepanel/search-controller.ts');
  const requests = [], states = [];
  const search = createProfessorSearch(async query => { requests.push(query); return null; },
    state => states.push(state), { isReady: query => /^[a-z]{2,5}\s*\d{3}$/i.test(query), paging: null });
  search.update('CMPT 22', true);
  assert.equal(states.at(-1).status, 'idle');
  search.update('CMPT 225', true);
  await delay(0);
  assert.deepEqual(requests, ['CMPT 225']);
  assert.deepEqual(states.at(-1), { status: 'success', query: 'CMPT 225', data: null, loadingMore: false, loadMoreFailed: false });
  await search.loadMore();
  assert.deepEqual(requests, ['CMPT 225'], 'loadMore is a no-op without paging');
});

const page = (names, cursor) => ({
  professors: names.map((name, i) => ({ name, legacyId: name === 'dup' ? '1' : `${name}-${i}`, department: 'CS',
    avgRating: null, avgDifficulty: null, wouldTakeAgainPercent: null, numRatings: 0 })),
  hasMore: !!cursor, cursor,
});

test('load more appends the next page, deduplicates, and tracks failure', async () => {
  const { createProfessorSearch } = await loadModule('src/sidepanel/search-controller.ts');
  const calls = [], states = [];
  let fail = true;
  const search = createProfessorSearch(async (query, after) => {
    calls.push([query, after]);
    if (!after) return page(['a', 'dup'], 'c1');
    if (fail) { fail = false; throw new Error('Offline'); }
    return page(['dup', 'b'], null);
  }, state => states.push(state));
  search.update('chan', true);
  await delay(0);
  await search.loadMore();
  assert.equal(states.at(-1).loadMoreFailed, true);
  assert.equal(states.at(-1).data.professors.length, 2);
  await search.loadMore();
  assert.deepEqual(calls, [['chan', undefined], ['chan', 'c1'], ['chan', 'c1']]);
  const last = states.at(-1);
  assert.deepEqual(last.data.professors.map(p => p.name), ['a', 'dup', 'b']);
  assert.equal(last.data.hasMore, false);
  assert.equal(last.loadingMore, false);
  await search.loadMore();
  assert.equal(calls.length, 3);
});

test('a page that arrives after the query changed is discarded', async () => {
  const { createProfessorSearch } = await loadModule('src/sidepanel/search-controller.ts');
  const states = [];
  let resolvePage;
  const search = createProfessorSearch((query, after) => after
    ? new Promise(resolve => { resolvePage = resolve; })
    : Promise.resolve(page(['a'], 'c1')), state => states.push(state));
  search.update('chan', true);
  await delay(0);
  const pending = search.loadMore();
  search.update('');
  resolvePage(page(['b'], null));
  await pending;
  assert.equal(states.at(-1).status, 'idle');
});
