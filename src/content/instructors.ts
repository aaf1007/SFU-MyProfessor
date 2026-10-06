// Parses the text of a MySchedule "Instructor(s)" cell. Kept DOM-free so it can be tested.

import { MAX_QUERY_LENGTH } from "../shared/professor";

export type InstructorCell =
  | { kind: "empty" }
  | { kind: "staff" }
  | { kind: "tbd" }
  | { kind: "names"; names: string[] };

// Unambiguous separators between instructors: line breaks (from <br>), semicolons,
// " & ", and " / ". Commas are handled separately because "Last, First" is also a comma.
const SEPARATORS = /\s*(?:\n|;|\s&\s|\s\/\s)\s*/;

const clean = (part: string) =>
  part.replace(/^[\s.,;:-]+|[\s.,;:-]+$/g, "").replace(/\s+/g, " ");

const wordCount = (value: string) => value.split(" ").length;

/** "John Smith, Jane Doe" is two people; "Smith, John" is one. */
const splitCommas = (part: string): string[] => {
  const pieces = part.split(",").map(clean).filter(Boolean);
  return pieces.length > 1 && pieces.every(piece => wordCount(piece) >= 2) ? pieces : [clean(part)];
};

export const parseInstructorCell = (text: string): InstructorCell => {
  const parts = text
    .split(SEPARATORS)
    .flatMap(splitCommas)
    .filter(Boolean);
  if (parts.length === 0) return { kind: "empty" };

  const names = [...new Set(parts.filter(part => !/^(staff|tbd|tba)$/i.test(part)))]
    .filter(name => name.length <= MAX_QUERY_LENGTH);
  if (names.length > 0) return { kind: "names", names };
  return parts.some(part => /^(tbd|tba)$/i.test(part)) ? { kind: "tbd" } : { kind: "staff" };
};
