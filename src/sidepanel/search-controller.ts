import type { ProfessorSearchData } from "../shared/professor";

export type SearchState<T = ProfessorSearchData> =
  | { status: "idle" | "loading" | "error"; query: string }
  | {
    status: "success";
    query: string;
    data: T;
    /** A next page is being fetched; current results stay visible. */
    loadingMore: boolean;
    /** The last "load more" failed; current results stay visible. */
    loadMoreFailed: boolean;
  };

/** How to page through results: where the next page starts and how to append it. */
export interface Paging<T> {
  cursor: (data: T) => string | null;
  append: (data: T, page: T) => T;
}

export const professorPaging: Paging<ProfessorSearchData> = {
  cursor: data => data.cursor,
  append: (data, page) => {
    const seen = new Set(data.professors.flatMap(p => (p.legacyId ? [p.legacyId] : [])));
    const added = page.professors.filter(p => !p.legacyId || !seen.has(p.legacyId));
    return { professors: [...data.professors, ...added], hasMore: page.hasMore, cursor: page.cursor };
  },
};

export interface SearchOptions<T> {
  /** Whether a normalized query is complete enough to send. Defaults to 2+ characters. */
  isReady?: (query: string) => boolean;
  /** Defaults to professor paging; null disables loadMore(). */
  paging?: Paging<T> | null;
}

export function createProfessorSearch<T = ProfessorSearchData>(
  request: (query: string, after?: string) => Promise<T>,
  onState: (state: SearchState<T>) => void,
  {
    isReady = query => query.length >= 2,
    paging = professorPaging as unknown as Paging<T>,
  }: SearchOptions<T> = {},
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let state: SearchState<T> = { status: "idle", query: "" };

  const emit = (next: SearchState<T>) => {
    state = next;
    onState(next);
  };

  function update(value: string, immediate = false) {
    clearTimeout(timer);
    // Invalidate immediately, including the interval before the next request starts.
    const current = ++generation;
    const query = value.trim().replace(/\s+/g, " ");
    if (!isReady(query)) {
      emit({ status: "idle", query });
      return;
    }
    emit({ status: "loading", query });
    const run = async () => {
      try {
        const data = await request(query);
        if (current === generation) {
          emit({ status: "success", query, data, loadingMore: false, loadMoreFailed: false });
        }
      } catch {
        if (current === generation) emit({ status: "error", query });
      }
    };
    if (immediate) void run();
    else timer = setTimeout(() => void run(), 300);
  }

  async function loadMore() {
    if (!paging || state.status !== "success" || state.loadingMore) return;
    const cursor = paging.cursor(state.data);
    if (!cursor) return;
    // A new query (or clearing) bumps the generation and discards this page.
    const current = generation;
    const base = state;
    emit({ ...base, loadingMore: true, loadMoreFailed: false });
    try {
      const page = await request(base.query, cursor);
      if (current !== generation) return;
      emit({ ...base, data: paging.append(base.data, page), loadingMore: false, loadMoreFailed: false });
    } catch {
      if (current === generation) emit({ ...base, loadingMore: false, loadMoreFailed: true });
    }
  }

  return { update, loadMore };
}
