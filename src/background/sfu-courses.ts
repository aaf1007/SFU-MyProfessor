import type { CourseSection } from "../shared/professor";
import type { CourseCode, InstructorName, Term } from "../shared/course";

// SFU's public course outlines API. It sends `Access-Control-Allow-Origin: *`,
// so it needs no host permission.
const OUTLINES_ENDPOINT = "https://www.sfu.ca/bin/wcm/course-outlines";
const MAX_CONCURRENT = 4;

export interface SectionOutline extends CourseSection {
  instructors: InstructorName[];
}

export interface CourseOffering {
  title: string;
  sections: SectionOutline[];
}

class NotFoundError extends Error {}

const getOutline = async (path: string[]): Promise<unknown> => {
  const response = await fetch(`${OUTLINES_ENDPOINT}?${path.map(encodeURIComponent).join("/")}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) throw new NotFoundError();
  if (!response.ok) throw new Error(`SFU course outlines request failed with status ${response.status}.`);
  return response.json();
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

const parseSection = (section: string, data: unknown): SectionOutline => {
  const outline = (data && typeof data === "object" ? data : {}) as {
    info?: { deliveryMethod?: unknown };
    instructor?: unknown;
    courseSchedule?: unknown;
  };
  const schedule = Array.isArray(outline.courseSchedule) ? outline.courseSchedule : [];
  const campus = schedule.map(entry => text((entry as { campus?: unknown })?.campus)).find(Boolean) || null;
  const instructors = (Array.isArray(outline.instructor) ? outline.instructor : [])
    .map(entry => entry as Record<string, unknown>)
    // PI is the primary instructor; TAs and other roles don't belong in a comparison.
    .filter(entry => entry && text(entry.roleCode) === "PI" && text(entry.lastName))
    .map(entry => ({ firstName: text(entry.firstName), lastName: text(entry.lastName), commonName: text(entry.commonName) }));
  return { section, campus, deliveryMethod: text(outline.info?.deliveryMethod) || null, instructors };
};

export async function mapLimited<T, R>(items: T[], limit: number, map: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await map(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Returns null when the course isn't offered in that term. */
export async function fetchCourseOffering(term: Term, code: CourseCode): Promise<CourseOffering | null> {
  const base = [String(term.year), term.season, code.dept, code.number];
  let list: unknown;
  try {
    list = await getOutline(base);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
  if (!Array.isArray(list)) throw new Error("SFU returned an invalid course listing.");

  // Enrollment sections ("e") are the lectures/seminars you pick; labs and tutorials hang off them.
  const enrollment = list
    .map(entry => entry as { value?: unknown; text?: unknown; title?: unknown; classType?: unknown })
    .filter(entry => entry.classType === "e" && text(entry.value));
  const title = text(enrollment[0]?.title) || text((list[0] as { title?: unknown })?.title);

  const sections = await mapLimited(enrollment, MAX_CONCURRENT, async entry => {
    const label = text(entry.text) || text(entry.value).toUpperCase();
    try {
      const outline = await getOutline([...base, text(entry.value)]);
      return parseSection(label, outline);
    } catch (error) {
      // A section can be listed before its outline is published.
      if (error instanceof NotFoundError) return parseSection(label, null);
      throw error;
    }
  });
  return { title, sections };
}
