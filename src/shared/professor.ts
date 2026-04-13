export const FETCH_DATA_MESSAGE_TYPE = "FETCH_DATA";

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
