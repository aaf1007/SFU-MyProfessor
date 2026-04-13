import type { ProfessorData } from "../shared/professor";

const GRAPHQL_ENDPOINT = "https://www.ratemyprofessors.com/graphql";
const SCHOOL_NAME = "Simon Fraser University";

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
      teachers(query: $query, first: 1, after: "") {
        edges {
          node {
            legacyId
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
    credentials: "include",
    mode: "cors",
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

export const fetchProfessorData = async (
  professorName: string,
): Promise<ProfessorData | null> => {
  const normalizedName = professorName.trim();

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

  const teacher = data.search?.teachers?.edges?.[0]?.node;

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

  const legacyId =
    teacher.legacyId != null ? String(teacher.legacyId) : null;

  return {
    name: normalizedName,
    avgRating: parseNumber(teacher.avgRating),
    avgDifficulty: parseNumber(teacher.avgDifficulty),
    wouldTakeAgainPercent: parseNumber(teacher.wouldTakeAgainPercent),
    numRatings: parseNumber(teacher.numRatings),
    legacyId,
    topTags,
  };
};
