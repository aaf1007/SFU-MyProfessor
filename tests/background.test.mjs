import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './load-module.mjs';

test('background configures the toolbar and handles search, validation, and schedule messages', async t => {
  let listener, behavior;
  const previousChrome = globalThis.chrome;
  t.after(() => { globalThis.chrome = previousChrome; });
  globalThis.chrome = {
    sidePanel: { setPanelBehavior: async value => { behavior = value; } },
    runtime: { onMessage: { addListener: value => { listener = value; } } },
  };
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const { query } = JSON.parse(options.body);
    return Response.json({ data: query.includes('SchoolSearchQuery!')
      ? { newSearch: { schools: { edges: [{ node: { id: 'sfu', name: 'Simon Fraser University' } }] } } }
      : { search: { teachers: { edges: [], pageInfo: { hasNextPage: false } } } },
    });
  });
  const { initBackground } = await loadModule('src/background/background.ts');
  initBackground();
  assert.deepEqual(behavior, { openPanelOnActionClick: true });
  const send = message => new Promise(resolve => {
    const keepAlive = listener(message, {}, resolve);
    assert.equal(keepAlive, true);
  });
  assert.deepEqual(await send({ type: 'SEARCH_PROFESSORS', payload: { query: 'john' } }), {
    status: 'Success', data: { professors: [], hasMore: false },
  });
  assert.deepEqual(await send({ type: 'FETCH_DATA', payload: { name: 'John' } }), {
    status: 'Success', data: null,
  });
  let invalid;
  listener({ type: 'SEARCH_PROFESSORS', payload: { query: 123 } }, {}, response => { invalid = response; });
  assert.equal(invalid.status, 'Error');
  assert.equal(listener({ type: 'unrelated' }, {}, () => assert.fail('Unrelated message handled')), undefined);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Offline'); });
  assert.equal((await send({ type: 'SEARCH_PROFESSORS', payload: { query: 'john' } })).status, 'Error');
});
