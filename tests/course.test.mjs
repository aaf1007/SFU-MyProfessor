import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './load-module.mjs';

test('parseCourseCode accepts common spellings and rejects partial input', async () => {
  const { parseCourseCode } = await loadModule('src/shared/course.ts');
  assert.deepEqual(parseCourseCode(' CMPT 225 '), { dept: 'cmpt', number: '225' });
  assert.deepEqual(parseCourseCode('cmpt225'), { dept: 'cmpt', number: '225' });
  assert.deepEqual(parseCourseCode('engl-199W'), { dept: 'engl', number: '199w' });
  for (const value of ['CMPT', 'CMPT 22', 'C 225', 'CMPT 2255', '225']) assert.equal(parseCourseCode(value), null, value);
});

test('termOptions returns the current and next SFU term', async () => {
  const { termOptions, termLabel } = await loadModule('src/shared/course.ts');
  assert.deepEqual(termOptions(new Date(2026, 9, 6)), [{ year: 2026, season: 'fall' }, { year: 2027, season: 'spring' }]);
  assert.deepEqual(termOptions(new Date(2026, 0, 15)), [{ year: 2026, season: 'spring' }, { year: 2026, season: 'summer' }]);
  assert.deepEqual(termOptions(new Date(2026, 4, 1)), [{ year: 2026, season: 'summer' }, { year: 2026, season: 'fall' }]);
  assert.equal(termLabel({ year: 2026, season: 'fall' }), 'Fall 2026');
});

test('isSameInstructor requires the full last name and a known first name', async () => {
  const { isSameInstructor } = await loadModule('src/shared/course.ts');
  const mirza = { firstName: 'Mirza Zaeem', lastName: 'Baig', commonName: '' };
  assert.equal(isSameInstructor(mirza, 'Mirza Baig'), true);
  assert.equal(isSameInstructor(mirza, 'Zaeem Baig'), true);
  assert.equal(isSameInstructor(mirza, 'Mirza Zaeem Baig'), true);
  assert.equal(isSameInstructor(mirza, 'Mirza Baigent'), false);
  assert.equal(isSameInstructor(mirza, 'Ali Baig'), false);
  assert.equal(isSameInstructor({ firstName: 'Robert', lastName: 'Chanowski', commonName: 'Bobby' }, 'Bobby Chan'), false);
  assert.equal(isSameInstructor({ firstName: 'Robert', lastName: 'Chan', commonName: 'Bobby' }, 'Bobby Chan'), true);
  assert.equal(isSameInstructor({ firstName: 'José', lastName: 'Ramírez-Soto', commonName: '' }, 'Jose Ramirez Soto'), true);
  assert.equal(isSameInstructor({ firstName: 'Ann', lastName: 'Lee', commonName: '' }, 'Lee'), false);
});

test('rankInstructors puts the best-rated first and unmatched last', async () => {
  const { rankInstructors } = await loadModule('src/shared/course.ts');
  const prof = (avgRating, numRatings = 10) => ({ avgRating, numRatings });
  const ranked = rankInstructors([
    { name: 'Unmatched', professor: null },
    { name: 'Unrated', professor: prof(null, 0) },
    { name: 'Low', professor: prof(2.1) },
    { name: 'High few', professor: prof(4.5, 3) },
    { name: 'High many', professor: prof(4.5, 40) },
  ]);
  assert.deepEqual(ranked.map(i => i.name), ['High many', 'High few', 'Low', 'Unrated', 'Unmatched']);
});

test('isSameSfuInstructor merges first-name variants of one person only', async () => {
  const { isSameSfuInstructor } = await loadModule('src/shared/course.ts');
  const name = (firstName, lastName, commonName = '') => ({ firstName, lastName, commonName });
  assert.equal(isSameSfuInstructor(name('Vijay', 'Singh'), name('Vijaykumar', 'Singh', 'Vijaykumar')), true);
  assert.equal(isSameSfuInstructor(name('Amir', 'Aghasharif'), name('Amir', 'Aghasharif', 'Amir')), true);
  assert.equal(isSameSfuInstructor(name('Robert', 'Chan', 'Bobby'), name('Bobby', 'Chan')), true);
  assert.equal(isSameSfuInstructor(name('Vijay', 'Singh'), name('Amrit', 'Singh')), false);
  assert.equal(isSameSfuInstructor(name('Vijay', 'Singh'), name('Vijay', 'Sing')), false);
});
