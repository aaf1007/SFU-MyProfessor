import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './load-module.mjs';

test('matching accepts the same person written differently', async () => {
  const { isSameProfessor } = await loadModule('src/background/name-match.ts');
  assert.ok(isSameProfessor('John Edgar', 'John', 'Edgar'));
  assert.ok(isSameProfessor('John A. Edgar', 'John', 'Edgar'));
  assert.ok(isSameProfessor('J. Edgar', 'John', 'Edgar'));
  assert.ok(isSameProfessor('Rob Edgar', 'Robert', 'Edgar'));
  assert.ok(isSameProfessor('José Núñez-Ruiz', 'Jose', 'Nunez-Ruiz'));
  assert.ok(isSameProfessor('Mary van der Berg', 'Mary', 'van der Berg'));
  assert.ok(isSameProfessor("Kate O'Neil", 'Kate', "O'Neil"));
});

test('matching rejects different people and incomplete names', async () => {
  const { isSameProfessor } = await loadModule('src/background/name-match.ts');
  assert.equal(isSameProfessor('Bobby Chanowski', 'Bobby', 'Chan'), false);
  assert.equal(isSameProfessor('Jane Edgar', 'John', 'Edgar'), false);
  assert.equal(isSameProfessor('Jo Edgar', 'John', 'Edgar'), false);
  assert.equal(isSameProfessor('Edgar', 'John', 'Edgar'), false);
  assert.equal(isSameProfessor('John Edgar', '', 'Edgar'), false);
});

test('normalizeName folds case, accents, and punctuation', async () => {
  const { normalizeName } = await loadModule('src/background/name-match.ts');
  assert.equal(normalizeName('  José   NÚÑEZ-Ruiz '), 'jose nunez ruiz');
});
