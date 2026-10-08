export const FETCH_DATA_MESSAGE_TYPE = "FETCH_DATA";
export const SEARCH_PROFESSORS_MESSAGE_TYPE = "SEARCH_PROFESSORS";
export const COURSE_INSTRUCTORS_MESSAGE_TYPE = "COURSE_INSTRUCTORS";
export const OPEN_SEARCH_MESSAGE_TYPE = "OPEN_SEARCH";

/** RMP's numeric ID for Simon Fraser University (GraphQL ID "School-1482"). */
export const SFU_RMP_LEGACY_SCHOOL_ID = "1482";

export const MAX_QUERY_LENGTH = 100;
const MAX_CURSOR_LENGTH = 200;

/** chrome.storage.session key the background uses to hand a query to the side panel. */
export const PENDING_SEARCH_KEY = "pendingSearch";

export interface PendingSearch {
  query: string;
  requestedAt: number;
}

export const rmpProfileUrl = (legacyId: string) =>
  `https://www.ratemyprofessors.com/professor/${legacyId}`;

export const rmpSchoolSearchUrl = (name: string) =>
  `https://www.ratemyprofessors.com/search/professors/${SFU_RMP_LEGACY_SCHOOL_ID}?q=${encodeURIComponent(name)}`;

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
  /** Pass back as `after` to fetch the next page; null when there is none. */
  cursor: string | null;
}

export interface SearchProfessorsRequest {
  type: typeof SEARCH_PROFESSORS_MESSAGE_TYPE;
  payload: { query: string; after?: string };
}

export type SearchProfessorsResponse =
  | { status: "Success"; data: ProfessorSearchData }
  | FetchDataErrorResponse;

export const isSearchProfessorsRequest = (
  value: unknown,
): value is SearchProfessorsRequest => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown; payload?: { query?: unknown; after?: unknown } };
  const after = candidate.payload?.after;
  return candidate.type === SEARCH_PROFESSORS_MESSAGE_TYPE &&
    typeof candidate.payload?.query === "string" &&
    candidate.payload.query.length <= MAX_QUERY_LENGTH &&
    (after === undefined || (typeof after === "string" && after.length <= MAX_CURSOR_LENGTH));
};

export interface ProfessorData {
  /** The name as listed on RMP (verified to match the SFU name). */
  name: string;
  /** Scores are null when RMP has no usable value (e.g. zero ratings). */
  avgRating: number | null;
  avgDifficulty: number | null;
  wouldTakeAgainPercent: number | null;
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
    typeof candidate.payload?.name === "string" &&
    candidate.payload.name.length <= MAX_QUERY_LENGTH
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

export interface OpenSearchRequest {
  type: typeof OPEN_SEARCH_MESSAGE_TYPE;
  payload: { query: string };
}

export type OpenSearchResponse = { status: "Success" } | FetchDataErrorResponse;

export const isOpenSearchRequest = (value: unknown): value is OpenSearchRequest => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown; payload?: { query?: unknown } };
  return candidate.type === OPEN_SEARCH_MESSAGE_TYPE &&
    typeof candidate.payload?.query === "string" &&
    candidate.payload.query.trim().length > 0 &&
    candidate.payload.query.length <= MAX_QUERY_LENGTH;
};

export const isPendingSearch = (value: unknown): value is PendingSearch => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { query?: unknown; requestedAt?: unknown };
  return typeof candidate.query === "string" && typeof candidate.requestedAt === "number";
};
