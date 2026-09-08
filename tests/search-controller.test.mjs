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
