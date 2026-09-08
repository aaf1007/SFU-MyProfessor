export const FETCH_DATA_MESSAGE_TYPE = "FETCH_DATA";
export const SEARCH_PROFESSORS_MESSAGE_TYPE = "SEARCH_PROFESSORS";

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
