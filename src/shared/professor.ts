export const FETCH_DATA_MESSAGE_TYPE = "FETCH_DATA";
export const SEARCH_PROFESSORS_MESSAGE_TYPE = "SEARCH_PROFESSORS";
export const COURSE_INSTRUCTORS_MESSAGE_TYPE = "COURSE_INSTRUCTORS";

export interface ProfessorSearchResult {
  name: string;
  department: string;
  legacyId: string | null;
  avgRating: number | null;
  avgDifficulty: number | null;
  wouldTakeAgainPercent: number | null;
  numRatings: number;
}

export interface ProfessorSearchData {
  professors: ProfessorSearchResult[];
  hasMore: boolean;
}

export interface SearchProfessorsRequest {
  type: typeof SEARCH_PROFESSORS_MESSAGE_TYPE;
  payload: { query: string };
}

export type SearchProfessorsResponse =
  | { status: "Success"; data: ProfessorSearchData }
  | FetchDataErrorResponse;

export const isSearchProfessorsRequest = (
  value: unknown,
): value is SearchProfessorsRequest => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown; payload?: { query?: unknown } };
  return candidate.type === SEARCH_PROFESSORS_MESSAGE_TYPE &&
    typeof candidate.payload?.query === "string" &&
    candidate.payload.query.length <= 100;
};

export interface ProfessorData {
  name: string;
  avgRating: number;
  avgDifficulty: number;
  wouldTakeAgainPercent: number;
  numRatings: number;
  legacyId: string | null;
  topTags: string[];
}

export interface FetchDataRequest {
  type: typeof FETCH_DATA_MESSAGE_TYPE;
  payload: {
    name: string;
  };
}

export interface FetchDataSuccessResponse {
  status: "Success";
  data: ProfessorData | null;
}

export interface FetchDataErrorResponse {
  status: "Error";
  message: string;
}

export type FetchDataResponse =
  | FetchDataSuccessResponse
  | FetchDataErrorResponse;

export const isFetchDataRequest = (
  value: unknown,
): value is FetchDataRequest => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    type?: unknown;
    payload?: {
      name?: unknown;
    };
  };

  return (
    candidate.type === FETCH_DATA_MESSAGE_TYPE &&
    typeof candidate.payload?.name === "string"
  );
};

export interface CourseSection {
  section: string;
  campus: string | null;
  deliveryMethod: string | null;
}

export interface CourseInstructor {
  /** The instructor's name as SFU lists it. */
  name: string;
  sections: CourseSection[];
  /** The matching SFU profile on Rate My Professors, or null when none matches the name. */
  professor: ProfessorSearchResult | null;
}

export interface CourseInstructorsData {
  /** e.g. "CMPT 225" */
  course: string;
  title: string;
  /** e.g. "Fall 2026" */
  term: string;
  /** Ranked best-rated first. */
  instructors: CourseInstructor[];
  /** Enrollment sections that have no instructor listed yet. */
  unassignedSections: string[];
}

export interface CourseInstructorsRequest {
  type: typeof COURSE_INSTRUCTORS_MESSAGE_TYPE;
  payload: { dept: string; number: string; year: number; season: "spring" | "summer" | "fall" };
}

/** `data` is null when the course isn't offered in that term. */
export type CourseInstructorsResponse =
  | { status: "Success"; data: CourseInstructorsData | null }
  | FetchDataErrorResponse;

export const isCourseInstructorsRequest = (
  value: unknown,
): value is CourseInstructorsRequest => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown; payload?: Record<string, unknown> };
  const payload = candidate.payload;
  return candidate.type === COURSE_INSTRUCTORS_MESSAGE_TYPE && !!payload &&
    typeof payload.dept === "string" && /^[a-z]{2,5}$/.test(payload.dept) &&
    typeof payload.number === "string" && /^\d{3}[a-z]?$/.test(payload.number) &&
    Number.isInteger(payload.year) && (payload.year as number) >= 2000 && (payload.year as number) <= 2100 &&
    (payload.season === "spring" || payload.season === "summer" || payload.season === "fall");
};
