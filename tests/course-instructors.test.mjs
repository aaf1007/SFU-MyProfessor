import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './load-module.mjs';

const SFU = 'https://www.sfu.ca/bin/wcm/course-outlines?';
const pi = (firstName, lastName, commonName = '') => ({ firstName, lastName, commonName, roleCode: 'PI' });
const teacher = (firstName, lastName, avgRating, numRatings = 20, legacyId = numRatings) => ({
  firstName, lastName, legacyId, avgRating, numRatings, avgDifficulty: 3, wouldTakeAgainPercent: 70,
  department: 'Computing Science', school: { id: 'sfu', name: 'Simon Fraser University' },
});

function mockFetch(t, { outlines, rmp }) {
  const sfuRequests = [], rmpQueries = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.startsWith(SFU)) {
      const path = url.slice(SFU.length);
      sfuRequests.push(path);
      return path in outlines ? Response.json(outlines[path]) : Response.json({ errorMessage: 'nope' }, { status: 404 });
    }
    const { query, variables } = JSON.parse(options.body);
    if (query.includes('SchoolSearchQuery!')) {
      return Response.json({ data: { newSearch: { schools: { edges: [{ node: { id: 'sfu', name: 'Simon Fraser University' } }] } } } });
    }
    rmpQueries.push(variables.query.text);
    const teachers = rmp[variables.query.text] ?? [];
    return Response.json({ data: { search: { teachers: { edges: teachers.map(node => ({ node })), pageInfo: { hasNextPage: false } } } } });
  });
  return { sfuRequests, rmpQueries };
}

const fall = { year: 2026, season: 'fall' };
const cmpt225 = { dept: 'cmpt', number: '225' };

test('course lookup groups sections by instructor, matches RMP strictly, and ranks', async t => {
  const { sfuRequests, rmpQueries } = mockFetch(t, {
    outlines: {
      '2026/fall/cmpt/225': [
        { text: 'D100', value: 'd100', title: 'Data Structures and Programming', classType: 'e' },
        { text: 'D101', value: 'd101', classType: 'n' },
        { text: 'D200', value: 'd200', classType: 'e' },
        { text: 'D300', value: 'd300', classType: 'e' },
        { text: 'D400', value: 'd400', classType: 'e' },
      ],
      '2026/fall/cmpt/225/d100': {
        info: { deliveryMethod: 'In Person' }, courseSchedule: [{ campus: 'Burnaby' }],
        instructor: [pi('Amir', 'Aghasharif'), pi('Amir', 'Aghasharif', 'Amir'), { ...pi('Tim', 'Ta'), roleCode: 'TA' }],
      },
      '2026/fall/cmpt/225/d200': { info: {}, courseSchedule: [{ campus: 'Surrey' }], instructor: [pi('Robert', 'Chanowski', 'Bobby'), pi('Amir', 'Aghasharif')] },
      '2026/fall/cmpt/225/d300': { info: {}, courseSchedule: [], instructor: [] },
      // d400's outline isn't published yet (404).
    },
    rmp: {
      'Amir Aghasharif': [teacher('Amir', 'Aghasharif', 3.1, 5, 1), teacher('Amir', 'Aghasharif', 3.9, 50, 2)],
      'Bobby Chanowski': [teacher('Bobby', 'Chan', 4.9)],
      'Chanowski': [],
    },
  });
  const { getCourseInstructors } = await loadModule('src/background/course-instructors.ts');
  const data = await getCourseInstructors(fall, cmpt225);

  assert.equal(data.course, 'CMPT 225');
  assert.equal(data.title, 'Data Structures and Programming');
  assert.equal(data.term, 'Fall 2026');
  assert.deepEqual(data.unassignedSections, ['D300', 'D400']);
  assert.deepEqual(data.instructors.map(i => [i.name, i.sections.map(s => s.section), i.professor?.legacyId ?? null]), [
    ['Amir Aghasharif', ['D100', 'D200'], '2'],
    // "Bobby Chan" must not be accepted for Chanowski.
    ['Bobby Chanowski', ['D200'], null],
  ]);
  assert.deepEqual(data.instructors[0].sections[0], { section: 'D100', campus: 'Burnaby', deliveryMethod: 'In Person' });
  assert.ok(!sfuRequests.includes('2026/fall/cmpt/225/d101'), 'non-enrollment sections are skipped');
  assert.deepEqual(rmpQueries.sort(), ['Amir Aghasharif', 'Bobby Chanowski', 'Chanowski']);

  // Cached for repeat lookups.
  const before = sfuRequests.length;
  assert.equal(await getCourseInstructors(fall, cmpt225), data);
  assert.equal(sfuRequests.length, before);
});

test('course lookup returns null when the course is not offered and does not cache errors', async t => {
  mockFetch(t, { outlines: {}, rmp: {} });
  const { getCourseInstructors } = await loadModule('src/background/course-instructors.ts');
  assert.equal(await getCourseInstructors(fall, { dept: 'cmpt', number: '999' }), null);

  t.mock.restoreAll();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('down', { status: 503 }); });
  await assert.rejects(getCourseInstructors(fall, cmpt225), /status 503/);
  await assert.rejects(getCourseInstructors(fall, cmpt225), /status 503/);
  assert.equal(calls, 2);
});

test('isCourseInstructorsRequest validates the payload', async () => {
  const { isCourseInstructorsRequest } = await loadModule('src/shared/professor.ts');
  const ok = { type: 'COURSE_INSTRUCTORS', payload: { dept: 'cmpt', number: '225', year: 2026, season: 'fall' } };
  assert.equal(isCourseInstructorsRequest(ok), true);
  for (const payload of [{ dept: 'CMPT' }, { number: '22' }, { year: 26 }, { season: 'winter' }, { dept: '../x' }]) {
    assert.equal(isCourseInstructorsRequest({ ...ok, payload: { ...ok.payload, ...payload } }), false);
  }
});
