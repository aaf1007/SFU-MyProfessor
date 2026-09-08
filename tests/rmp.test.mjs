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
      edges: nodes.map(node => ({ node })), pageInfo: { hasNextPage },
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
  assert.deepEqual(requests[1].variables.query, {
    text: 'jo', schoolID: schoolId, fallback: false, departmentID: null,
  });
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
  assert.deepEqual(await rmp.searchProfessors(' a '), { professors: [], hasMore: false });
  assert.equal(requests.length, 0);
  assert.deepEqual(await rmp.searchProfessors('missing'), { professors: [], hasMore: false });
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

test('existing schedule lookup still returns its original data contract', async t => {
  mockRmp(t, [teacher({ teacherRatingTags: [
    { tagName: 'Clear grading', tagCount: 3 }, { tagName: 'Helpful', tagCount: 8 },
  ] })]);
  const { fetchProfessorData } = await loadModule('src/background/rmp.ts');
  assert.deepEqual(await fetchProfessorData('  John Edgar  '), {
    name: 'John Edgar', avgRating: 3.3, avgDifficulty: 3.4,
    wouldTakeAgainPercent: 52.8846, numRatings: 152, legacyId: '21748',
    topTags: ['Helpful', 'Clear grading'],
  });
});
