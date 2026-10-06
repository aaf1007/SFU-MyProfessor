import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './load-module.mjs';

test('instructor cells parse into names, staff, TBD, or empty', async () => {
  const { parseInstructorCell } = await loadModule('src/content/instructors.ts');
  assert.deepEqual(parseInstructorCell('  John   Edgar '), { kind: 'names', names: ['John Edgar'] });
  assert.deepEqual(parseInstructorCell('Staff'), { kind: 'staff' });
  assert.deepEqual(parseInstructorCell('TBD'), { kind: 'tbd' });
  assert.deepEqual(parseInstructorCell('. TBD'), { kind: 'tbd' });
  assert.deepEqual(parseInstructorCell('   '), { kind: 'empty' });
});

test('multiple instructors are split on unambiguous separators', async () => {
  const { parseInstructorCell } = await loadModule('src/content/instructors.ts');
  const both = { kind: 'names', names: ['John Edgar', 'Jane Doe'] };
  assert.deepEqual(parseInstructorCell('John Edgar\nJane Doe'), both);
  assert.deepEqual(parseInstructorCell('John Edgar; Jane Doe'), both);
  assert.deepEqual(parseInstructorCell('John Edgar & Jane Doe'), both);
  assert.deepEqual(parseInstructorCell('John Edgar, Jane Doe'), both);
  assert.deepEqual(parseInstructorCell('John Edgar\nJohn Edgar'), { kind: 'names', names: ['John Edgar'] });
  assert.deepEqual(parseInstructorCell('John Edgar\nStaff'), { kind: 'names', names: ['John Edgar'] });
});

test('"Last, First" stays one name', async () => {
  const { parseInstructorCell } = await loadModule('src/content/instructors.ts');
  assert.deepEqual(parseInstructorCell('Edgar, John'), { kind: 'names', names: ['Edgar, John'] });
});
