import { searchProfessors } from "./rmp";
import { fetchCourseOffering, mapLimited } from "./sfu-courses";
import {
  formatCourseCode, isSameInstructor, isSameSfuInstructor, rankInstructors, termLabel,
  type CourseCode, type InstructorName, type Term,
} from "../shared/course";
import type { CourseInstructor, CourseInstructorsData, ProfessorSearchResult } from "../shared/professor";

const CACHE_TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; promise: Promise<CourseInstructorsData | null> }>();

async function findProfessor(names: InstructorName[]): Promise<ProfessorSearchResult | null> {
  // Full names first; the last name alone catches RMP profiles listed under another first name.
  const queries = new Set(names.map(name => `${(name.commonName || name.firstName).split(/\s+/)[0]} ${name.lastName}`));
  queries.add(names[0].lastName);
  for (const query of queries) {
    if (query.trim().length < 2) continue;
    const { professors } = await searchProfessors(query);
    const matches = professors.filter(p => names.some(name => isSameInstructor(name, p.name)));
    // Duplicate RMP profiles happen; the one with more ratings is the real one.
    if (matches.length) return matches.sort((a, b) => b.numRatings - a.numRatings)[0];
  }
  return null;
}

async function loadCourseInstructors(term: Term, code: CourseCode): Promise<CourseInstructorsData | null> {
  const offering = await fetchCourseOffering(term, code);
  if (!offering) return null;

  const found: Array<{ names: InstructorName[]; entry: CourseInstructor }> = [];
  const unassignedSections: string[] = [];
  for (const { instructors, ...section } of offering.sections) {
    if (!instructors.length) unassignedSections.push(section.section);
    for (const instructor of instructors) {
      let item = found.find(f => f.names.some(name => isSameSfuInstructor(name, instructor)));
      if (!item) {
        const name = `${instructor.commonName || instructor.firstName} ${instructor.lastName}`.trim();
        item = { names: [], entry: { name, sections: [], professor: null } };
        found.push(item);
      }
      item.names.push(instructor);
      if (!item.entry.sections.some(s => s.section === section.section)) item.entry.sections.push(section);
    }
  }

  await mapLimited(found, 4, async item => { item.entry.professor = await findProfessor(item.names); });
  return {
    course: formatCourseCode(code),
    title: offering.title,
    term: termLabel(term),
    instructors: rankInstructors(found.map(item => item.entry)),
    unassignedSections,
  };
}

export function getCourseInstructors(term: Term, code: CourseCode): Promise<CourseInstructorsData | null> {
  const key = `${term.year}/${term.season}/${code.dept}/${code.number}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = loadCourseInstructors(term, code);
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}
