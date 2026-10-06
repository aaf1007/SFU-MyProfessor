import { isSameProfessor } from "./name-match";
import type { ProfessorData, ProfessorSearchData, ProfessorSearchResult } from "../shared/professor";

const GRAPHQL_ENDPOINT = "https://www.ratemyprofessors.com/graphql";
const SCHOOL_NAME = "Simon Fraser University";
// Candidates checked for a name match on schedule lookups (RMP's ranking is fuzzy).
const SCHEDULE_CANDIDATES = 5;

const PROFESSOR_SEARCH_QUERY = `
  query SearchSFUProfessors($query: TeacherSearchQuery!, $after: String) {
    search: newSearch {
      teachers(query: $query, first: 20, after: $after) {
        edges {
          node {
            legacyId
            firstName
            lastName
            department
            school { id }
            avgRating
            avgDifficulty
            wouldTakeAgainPercent
            numRatings
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const HEADERS = {
  Accept: "*/*",
  Authorization: "Basic dGVzdDp0ZXN0",
  "Content-Type": "application/json",
} as const;

const SCHOOL_SEARCH_QUERY = `
  query NewSearchSchoolsQuery($query: SchoolSearchQuery!) {
    newSearch {
      schools(query: $query) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  }
`;

const TEACHER_SEARCH_QUERY = `
  query TeacherSearchResultsPageQuery(
    $query: TeacherSearchQuery!
    $schoolID: ID
    $includeSchoolFilter: Boolean!
  ) {
    search: newSearch {
      teachers(query: $query, first: ${SCHEDULE_CANDIDATES}, after: "") {
        edges {
          node {
            legacyId
            firstName
            lastName
            school { id }
            avgRating
            avgDifficulty
            wouldTakeAgainPercent
            numRatings
            teacherRatingTags {
              tagName
              tagCount
            }
          }
        }
      }
    }
    school: node(id: $schoolID) @include(if: $includeSchoolFilter) {
      __typename
      ... on School {
        id
      }
    }
  }
`;

interface GraphQLError {
  message: string;
}

interface GraphQLResponse<TData> {
  data?: TData;
  errors?: GraphQLError[];
}

interface SchoolSearchNode {
  id?: string | null;
  name?: string | null;
}

interface SchoolSearchResponse {
  newSearch?: {
    schools?: {
      edges?: Array<{
        node?: SchoolSearchNode | null;
      }>;
    };
  };
}

interface TeacherRatingTag {
  tagName?: string | null;
  tagCount?: number | string | null;
}

interface TeacherSearchNode {
  firstName?: string | null;
  lastName?: string | null;
  department?: string | null;
  school?: { id?: string | null } | null;
  legacyId?: number | string | null;
  avgRating?: number | string | null;
  avgDifficulty?: number | string | null;
  wouldTakeAgainPercent?: number | string | null;
  numRatings?: number | string | null;
  teacherRatingTags?: TeacherRatingTag[] | null;
}

interface TeacherSearchResponse {
  search?: {
    teachers?: {
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      edges?: Array<{
        node?: TeacherSearchNode | null;
      }>;
    };
  };
}

interface SchoolSearchVariables {
  query: {
    text: string;
  };
}

interface TeacherSearchVariables {
  query: {
    text: string;
    schoolID: string;
    fallback: boolean;
    departmentID: null;
  };
  schoolID: string;
  includeSchoolFilter: boolean;
}

type SearchVariables = Pick<TeacherSearchVariables, "query"> & { after: string };

let schoolIdPromise: Promise<string> | null = null;

const parseNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const postGraphQL = async <TData, TVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> => {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ query, variables }),
    mode: "cors",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`RMP request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as GraphQLResponse<TData>;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(", "));
  }

  if (!payload.data) {
    throw new Error("RMP response did not include any data.");
  }

  return payload.data;
};

const fetchSchoolId = async (): Promise<string> => {
  const data = await postGraphQL<SchoolSearchResponse, SchoolSearchVariables>(
    SCHOOL_SEARCH_QUERY,
    {
      query: {
        text: SCHOOL_NAME,
      },
    },
  );

  const school = data.newSearch?.schools?.edges
    ?.map((edge) => edge.node)
    .find(
      (node): node is { id: string; name: string } =>
        typeof node?.id === "string" && node.name === SCHOOL_NAME,
    );

  if (!school) {
    throw new Error(`Could not find the Rate My Professors school ID for ${SCHOOL_NAME}.`);
  }

  return school.id;
};

const getSchoolId = async (): Promise<string> => {
  if (!schoolIdPromise) {
    schoolIdPromise = fetchSchoolId().catch((error: unknown) => {
      schoolIdPromise = null;
      throw error;
    });
  }

  return schoolIdPromise;
};

const parseScore = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
};

/**
 * Normalizes RMP's loosely typed score fields. RMP reports 0 or -1 for scores it has no
 * data for, so anything out of range — or any score on a teacher with no ratings — is null.
 */
const parseScores = (teacher: TeacherSearchNode) => {
  const numRatings = Math.max(0, Math.floor(parseNumber(teacher.numRatings)));
  return {
    numRatings,
    avgRating: numRatings ? parseScore(teacher.avgRating, 1, 5) : null,
    avgDifficulty: numRatings ? parseScore(teacher.avgDifficulty, 1, 5) : null,
    wouldTakeAgainPercent: numRatings ? parseScore(teacher.wouldTakeAgainPercent, 0, 100) : null,
  };
};

const parseLegacyId = (value: unknown): string | null => {
  const raw = value == null ? "" : String(value);
  return /^[1-9]\d*$/.test(raw) ? raw : null;
};

const fullName = (teacher: TeacherSearchNode): string =>
  [teacher.firstName, teacher.lastName]
    .filter((part): part is string => typeof part === "string" && !!part.trim())
    .map(part => part.trim()).join(" ");

export const fetchProfessorData = async (
  professorName: string,
): Promise<ProfessorData | null> => {
  const normalizedName = professorName.trim().replace(/\s+/g, " ");

  if (!normalizedName) {
    return null;
  }

  const schoolId = await getSchoolId();
  const data = await postGraphQL<TeacherSearchResponse, TeacherSearchVariables>(
    TEACHER_SEARCH_QUERY,
    {
      query: {
        text: normalizedName,
        schoolID: schoolId,
        fallback: true,
        departmentID: null,
      },
      schoolID: schoolId,
      includeSchoolFilter: true,
    },
  );

  // Only accept a candidate that is at SFU and whose name actually matches; otherwise a
  // fuzzy hit would show another professor's ratings under this instructor's name.
  const teacher = data.search?.teachers?.edges
    ?.map(edge => edge?.node)
    .find((node): node is TeacherSearchNode =>
      !!node &&
      node.school?.id === schoolId &&
      isSameProfessor(normalizedName, node.firstName ?? "", node.lastName ?? ""),
    );

  if (!teacher) {
    return null;
  }

  const topTags = (teacher.teacherRatingTags ?? [])
    .filter((t): t is { tagName: string; tagCount: number | string } =>
      typeof t.tagName === "string" && t.tagName.length > 0,
    )
    .sort((a, b) => parseNumber(b.tagCount) - parseNumber(a.tagCount))
    .slice(0, 3)
    .map((t) => t.tagName);

  return {
    name: fullName(teacher) || normalizedName,
    ...parseScores(teacher),
    legacyId: parseLegacyId(teacher.legacyId),
    topTags,
  };
};

export const searchProfessors = async (query: string, after = ""): Promise<ProfessorSearchData> => {
  const text = query.trim().replace(/\s+/g, " ");
  if (text.length < 2) return { professors: [], hasMore: false, cursor: null };
  if (text.length > 100) throw new Error("Search names must be 100 characters or fewer.");

  const schoolId = await getSchoolId();
  const data = await postGraphQL<TeacherSearchResponse, SearchVariables>(
    PROFESSOR_SEARCH_QUERY,
    { query: { text, schoolID: schoolId, fallback: false, departmentID: null }, after },
  );

  const teachers = data.search?.teachers;
  // A malformed response is a service error, not a successful empty search.
  if (!Array.isArray(teachers?.edges)) throw new Error("RMP returned an invalid search response.");

  const professors: ProfessorSearchResult[] = [];
  const seen = new Set<string>();
  for (const edge of teachers.edges) {
    const teacher = edge?.node;
    // Fail closed even if the upstream search unexpectedly ignores its school filter.
    if (!teacher || teacher.school?.id !== schoolId) continue;
    const name = fullName(teacher);
    if (!name) continue;
    const legacyId = parseLegacyId(teacher.legacyId);
    if (legacyId && seen.has(legacyId)) continue;
    if (legacyId) seen.add(legacyId);
    professors.push({
      name, legacyId,
      department: teacher.department?.trim() || "Department unavailable",
      ...parseScores(teacher),
    });
  }
  const hasMore = teachers.pageInfo?.hasNextPage === true;
  const endCursor = teachers.pageInfo?.endCursor;
  return {
    professors,
    hasMore,
    cursor: hasMore && typeof endCursor === "string" && endCursor ? endCursor : null,
  };
};
