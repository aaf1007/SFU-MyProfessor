// RMP's teacher search returns fuzzy matches (e.g. "Bobby Chanowski" → "Bobby Chan"),
// so schedule lookups must confirm the result is the same person before showing it.

/** Lowercased ASCII word tokens with accents and punctuation removed. */
export const nameTokens = (value: string): string[] =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

/** Cache key form of a name: "José  O'Neil" → "jose o neil". */
export const normalizeName = (value: string): string => nameTokens(value).join(" ");

const givenNamesCompatible = (a: string, b: string): boolean => {
  if (a === b) return true;
  // An initial ("J" vs "John").
  if (a.length === 1 || b.length === 1) return a[0] === b[0];
  // A shortened form ("Rob" vs "Robert"), requiring 3+ letters to avoid accidental hits.
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  return shorter.length >= 3 && longer.startsWith(shorter);
};

/**
 * True when an SFU "First [Middle] Last" name plausibly refers to the RMP teacher.
 * The RMP last name must appear in full after at least one given name, and one of the
 * SFU given names must be compatible with the RMP first name.
 */
export const isSameProfessor = (sfuName: string, rmpFirstName: string, rmpLastName: string): boolean => {
  const sfu = nameTokens(sfuName);
  const first = nameTokens(rmpFirstName);
  const last = nameTokens(rmpLastName);
  if (sfu.length < 2 || first.length === 0 || last.length === 0) return false;

  for (let start = 1; start + last.length <= sfu.length; start++) {
    const lastMatches = last.every((token, offset) => sfu[start + offset] === token);
    if (lastMatches && sfu.slice(0, start).some(given => givenNamesCompatible(given, first[0]))) {
      return true;
    }
  }
  return false;
};
