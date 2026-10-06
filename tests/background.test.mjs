import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './load-module.mjs';

const storageArea = () => {
  const data = {};
  return {
    data,
    get: async key => (key === null ? { ...data } : key in data ? { [key]: data[key] } : {}),
    set: async items => { Object.assign(data, items); },
    remove: async keys => { for (const key of [keys].flat()) delete data[key]; },
  };
};

async function setUp(t) {
  let listener, behavior;
  const opened = [];
  const previousChrome = globalThis.chrome;
  t.after(() => { globalThis.chrome = previousChrome; });
  const local = storageArea(), session = storageArea();
  globalThis.chrome = {
    sidePanel: {
      setPanelBehavior: async value => { behavior = value; },
      open: async options => { opened.push(options); },
    },
    runtime: { onMessage: { addListener: value => { listener = value; } } },
    storage: { local, session },
  };
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const { query } = JSON.parse(options.body);
    requests.push(query);
    return Response.json({ data: query.includes('SchoolSearchQuery!')
      ? { newSearch: { schools: { edges: [{ node: { id: 'sfu', name: 'Simon Fraser University' } }] } } }
      : { search: { teachers: { edges: [], pageInfo: { hasNextPage: false } } } },
    });
  });
  const { initBackground } = await loadModule('src/background/background.ts');
  initBackground();
  const send = (message, sender = {}) => new Promise(resolve => {
    const keepAlive = listener(message, sender, resolve);
    assert.equal(keepAlive, true);
  });
  return { send, listener: (...args) => listener(...args), behavior: () => behavior, opened, local, session, requests };
}

test('background configures the toolbar and handles search, validation, and schedule messages', async t => {
  const { send, listener, behavior } = await setUp(t);
  assert.deepEqual(behavior(), { openPanelOnActionClick: true });
  assert.deepEqual(await send({ type: 'SEARCH_PROFESSORS', payload: { query: 'john' } }), {
    status: 'Success', data: { professors: [], hasMore: false, cursor: null },
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

test('schedule lookups are cached across messages, including "not found"', async t => {
  const { send, requests, local } = await setUp(t);
  await send({ type: 'FETCH_DATA', payload: { name: 'John Edgar' } });
  const teacherRequests = () => requests.filter(q => !q.includes('SchoolSearchQuery!')).length;
  assert.equal(teacherRequests(), 1);
  assert.deepEqual(await send({ type: 'FETCH_DATA', payload: { name: 'john  edgar' } }), { status: 'Success', data: null });
  assert.equal(teacherRequests(), 1);
  assert.ok(Object.keys(local.data).some(key => key.startsWith('professor:v2:')));
});

test('lookup failures are not cached', async t => {
  const { send, local } = await setUp(t);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Offline'); });
  assert.equal((await send({ type: 'FETCH_DATA', payload: { name: 'John Edgar' } })).status, 'Error');
  assert.equal(Object.keys(local.data).length, 0);
});

test('OPEN_SEARCH opens the side panel synchronously and hands over the query', async t => {
  const { listener, opened, session } = await setUp(t);
  const response = new Promise(resolve => {
    assert.equal(listener({ type: 'OPEN_SEARCH', payload: { query: ' Bobby Chan ' } }, { tab: { windowId: 7 } }, resolve), true);
    // Must be called before the listener yields, to keep the click's user gesture.
    assert.deepEqual(opened, [{ windowId: 7 }]);
  });
  assert.deepEqual(await response, { status: 'Success' });
  assert.equal(session.data.pendingSearch.query, 'Bobby Chan');

  let invalid;
  listener({ type: 'OPEN_SEARCH', payload: { query: 'x' } }, {}, value => { invalid = value; });
  assert.equal(invalid.status, 'Error');
});
