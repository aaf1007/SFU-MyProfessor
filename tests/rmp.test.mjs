import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './load-module.mjs';

const schoolId = 'U2Nob29sLTE0ODI=';
const teacher = (overrides = {}) => ({
  firstName: 'John', lastName: 'Edgar', department: 'Computer Science',
  school: { id: schoolId, name: 'Simon Fraser University' },
  legacyId: 21748, avgRating: 3.3, avgDifficulty: 3.4,
  wouldTakeAgainPercent: 52.8846, numRatings: 152,
  ...overrides,
});

function mockRmp(t, nodes, hasNextPage = false) {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    if (body.query.includes('SchoolSearchQuery!')) {
      return Response.json({ data: { newSearch: { schools: { edges: [
        { node: { id: 'wrong', name: 'Other University' } },
        { node: { id: schoolId, name: 'Simon Fraser University' } },
      ] } } } });
    }
    return Response.json({ data: { search: { teachers: {
      edges: nodes.map(node => ({ node })), pageInfo: { hasNextPage, endCursor: hasNextPage ? 'cursor-1' : null },
    } } } });
  });
  return requests;
}

test('search returns actual names and excludes other or unverified schools', async t => {
  const requests = mockRmp(t, [teacher(), teacher({ firstName: 'Jane', legacyId: 22 }),
    teacher({ school: { id: 'other' } }), teacher({ school: null }), null], true);
  const rmp = await loadModule('src/background/rmp.ts');
  assert.equal(typeof rmp.searchProfessors, 'function');
  const result = await rmp.searchProfessors('  jo  ');
  assert.deepEqual(result.professors.map(p => [p.name, p.legacyId, p.department]), [
    ['John Edgar', '21748', 'Computer Science'], ['Jane Edgar', '22', 'Computer Science'],
  ]);
  assert.equal(result.hasMore, true);
  assert.equal(result.cursor, 'cursor-1');
  assert.deepEqual(requests[1].variables.query, {
    text: 'jo', schoolID: schoolId, fallback: false, departmentID: null,
  });
  assert.equal(requests[1].variables.after, '');
});

test('search preserves missing scores and a real zero percent', async t => {
  mockRmp(t, [teacher({ avgRating: null, avgDifficulty: '', wouldTakeAgainPercent: -1 }),
    teacher({ legacyId: 23, wouldTakeAgainPercent: 0 }),
    teacher({ legacyId: 24, numRatings: 0, avgRating: 0, avgDifficulty: 0 })]);
  const rmp = await loadModule('src/background/rmp.ts');
  assert.equal(typeof rmp.searchProfessors, 'function');
  const { professors } = await rmp.searchProfessors('john');
  assert.equal(professors[0].avgRating, null);
  assert.equal(professors[0].avgDifficulty, null);
  assert.equal(professors[0].wouldTakeAgainPercent, null);
  assert.equal(professors[1].wouldTakeAgainPercent, 0);
  assert.equal(professors[2].avgRating, null);
  assert.equal(professors[2].avgDifficulty, null);
});

test('short queries avoid network requests; empty results are successful', async t => {
  const requests = mockRmp(t, []);
  const rmp = await loadModule('src/background/rmp.ts');
  assert.equal(typeof rmp.searchProfessors, 'function');
  assert.deepEqual(await rmp.searchProfessors(' a '), { professors: [], hasMore: false, cursor: null });
  assert.equal(requests.length, 0);
  assert.deepEqual(await rmp.searchProfessors('missing'), { professors: [], hasMore: false, cursor: null });
});

test('search exposes server failures and can retry failed school discovery', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  const rmp = await loadModule('src/background/rmp.ts');
  assert.equal(typeof rmp.searchProfessors, 'function');
  await assert.rejects(rmp.searchProfessors('john'), /503/);
  mockRmp(t, [teacher()]);
  assert.equal((await rmp.searchProfessors('john')).professors.length, 1);
});

test('GraphQL errors do not masquerade as no results', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ errors: [{ message: 'Unavailable' }] }));
  const rmp = await loadModule('src/background/rmp.ts');
  assert.equal(typeof rmp.searchProfessors, 'function');
  await assert.rejects(rmp.searchProfessors('john'), /Unavailable/);
});

test('search passes the cursor through to fetch the next page', async t => {
  const requests = mockRmp(t, [teacher()]);
  const rmp = await loadModule('src/background/rmp.ts');
  const result = await rmp.searchProfessors('john', 'cursor-1');
  assert.equal(requests.at(-1).variables.after, 'cursor-1');
  assert.equal(result.cursor, null);
});

test('RMP requests do not send the user\'s RMP cookies', async t => {
  const options = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    options.push(init);
    return Response.json({ data: { newSearch: { schools: { edges: [{ node: { id: schoolId, name: 'Simon Fraser University' } }] } },
      search: { teachers: { edges: [], pageInfo: { hasNextPage: false } } } } });
  });
  const rmp = await loadModule('src/background/rmp.ts');
  await rmp.searchProfessors('john');
  assert.ok(options.length > 0);
  for (const init of options) assert.equal(init.credentials, undefined);
});

test('schedule lookup returns its data contract with the RMP name', async t => {
  mockRmp(t, [teacher({ teacherRatingTags: [
    { tagName: 'Clear grading', tagCount: 3 }, { tagName: 'Helpful', tagCount: 8 },
  ] })]);
  const { fetchProfessorData } = await loadModule('src/background/rmp.ts');
  assert.deepEqual(await fetchProfessorData('  John   Edgar  '), {
    name: 'John Edgar', avgRating: 3.3, avgDifficulty: 3.4,
    wouldTakeAgainPercent: 52.8846, numRatings: 152, legacyId: '21748',
    topTags: ['Helpful', 'Clear grading'],
  });
});

test('schedule lookup rejects fuzzy matches for a different professor', async t => {
  // RMP's fallback search really returns "Bobby Chan" for "Bobby Chanowski".
  mockRmp(t, [teacher({ firstName: 'Bobby', lastName: 'Chan' })]);
  const { fetchProfessorData } = await loadModule('src/background/rmp.ts');
  assert.equal(await fetchProfessorData('Bobby Chanowski'), null);
});

test('schedule lookup picks the first candidate that matches, skipping other schools', async t => {
  const requests = mockRmp(t, [
    teacher({ firstName: 'Jane', legacyId: 1 }),
    teacher({ legacyId: 2, school: { id: 'other' } }),
    teacher({ firstName: 'Johnathan', legacyId: 3 }),
  ]);
  const { fetchProfessorData } = await loadModule('src/background/rmp.ts');
  assert.equal((await fetchProfessorData('John A. Edgar')).legacyId, '3');
  assert.match(requests.at(-1).query, /first: 5/);
});

test('schedule lookup reports missing scores as null instead of 0 or -1', async t => {
  mockRmp(t, [teacher({ numRatings: 0, avgRating: 0, avgDifficulty: 0, wouldTakeAgainPercent: -1 })]);
  const { fetchProfessorData } = await loadModule('src/background/rmp.ts');
  const data = await fetchProfessorData('John Edgar');
  assert.equal(data.numRatings, 0);
  assert.equal(data.avgRating, null);
  assert.equal(data.avgDifficulty, null);
  assert.equal(data.wouldTakeAgainPercent, null);
});
