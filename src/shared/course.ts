import type { CourseInstructor } from "./professor";

export type TermSeason = "spring" | "summer" | "fall";
export interface Term { year: number; season: TermSeason }

const SEASONS: TermSeason[] = ["spring", "summer", "fall"];

// SFU terms: spring Jan–Apr, summer May–Aug, fall Sep–Dec. Returns [current, next].
export function termOptions(now = new Date()): [Term, Term] {
  const index = Math.floor(now.getMonth() / 4);
  const year = now.getFullYear();
  const current: Term = { year, season: SEASONS[index] };
  const next: Term = index === 2 ? { year: year + 1, season: "spring" } : { year, season: SEASONS[index + 1] };
  return [current, next];
}

export const termLabel = (term: Term) =>
  `${term.season[0].toUpperCase()}${term.season.slice(1)} ${term.year}`;

export interface CourseCode { dept: string; number: string }

// Accepts "CMPT 225", "cmpt225", "MATH-100", "ENGL 199W".
export function parseCourseCode(input: string): CourseCode | null {
  const match = /^([a-z]{2,5})[\s-]*(\d{3}[a-z]?)$/i.exec(input.trim());
  return match ? { dept: match[1].toLowerCase(), number: match[2].toLowerCase() } : null;
}

export const formatCourseCode = (code: CourseCode) => `${code.dept.toUpperCase()} ${code.number.toUpperCase()}`;

const nameTokens = (value: string) => value
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z\s'-]/g, " ").replace(/['-]/g, " ")
  .split(/\s+/).filter(Boolean);

export interface InstructorName { firstName: string; lastName: string; commonName: string }

// Strict on purpose: RMP fuzzy search returns "Bobby Chan" for "Bobby Chanowski", and a
// wrong professor's ratings are worse than none. The full SFU last name must end the RMP
// name, and the RMP first name must be one of the SFU first or preferred names.
export function isSameInstructor(instructor: InstructorName, rmpName: string): boolean {
  const candidate = nameTokens(rmpName);
  const last = nameTokens(instructor.lastName);
  const firsts = new Set([...nameTokens(instructor.firstName), ...nameTokens(instructor.commonName)]);
  if (!last.length || candidate.length <= last.length) return false;
  const tail = candidate.slice(-last.length);
  return tail.every((token, i) => token === last[i]) && firsts.has(candidate[0]);
}

const firstNames = (name: InstructorName) => [...nameTokens(name.firstName), ...nameTokens(name.commonName)];

// SFU can list one person twice on a section under different first names and emails
// ("Vijay Singh" and "Vijaykumar Singh"), so a first name that prefixes the other counts as the same.
export function isSameSfuInstructor(a: InstructorName, b: InstructorName): boolean {
  if (nameTokens(a.lastName).join(" ") !== nameTokens(b.lastName).join(" ")) return false;
  const bFirsts = firstNames(b);
  return firstNames(a).some(x => bFirsts.some(y => x.startsWith(y) || y.startsWith(x)));
}

// Rated professors first (best rating, then most ratings), then unrated matches, then unmatched.
export function rankInstructors(instructors: CourseInstructor[]): CourseInstructor[] {
  const group = (i: CourseInstructor) => !i.professor ? 2 : i.professor.avgRating === null ? 1 : 0;
  return [...instructors].sort((a, b) =>
    group(a) - group(b) ||
    (b.professor?.avgRating ?? 0) - (a.professor?.avgRating ?? 0) ||
    (b.professor?.numRatings ?? 0) - (a.professor?.numRatings ?? 0) ||
    a.name.localeCompare(b.name));
}
