import type { ProfessorSearchData } from "../shared/professor";

export type SearchState =
  | { status: "idle" | "loading" | "error"; query: string }
  | {
    status: "success";
    query: string;
    data: ProfessorSearchData;
    /** A next page is being fetched; current results stay visible. */
    loadingMore: boolean;
    /** The last "load more" failed; current results stay visible. */
    loadMoreFailed: boolean;
  };

export function createProfessorSearch(
  request: (query: string, after?: string) => Promise<ProfessorSearchData>,
  onState: (state: SearchState) => void,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let state: SearchState = { status: "idle", query: "" };

  const emit = (next: SearchState) => {
    state = next;
    onState(next);
  };

  function update(value: string, immediate = false) {
    clearTimeout(timer);
    // Invalidate immediately, including the interval before the next request starts.
    const current = ++generation;
    const query = value.trim().replace(/\s+/g, " ");
    if (query.length < 2) {
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
    if (state.status !== "success" || state.loadingMore || !state.data.cursor) return;
    // A new query (or clearing) bumps the generation and discards this page.
    const current = generation;
    const base = state;
    emit({ ...base, loadingMore: true, loadMoreFailed: false });
    try {
      const page = await request(base.query, base.data.cursor ?? undefined);
      if (current !== generation) return;
      const seen = new Set(base.data.professors.flatMap(p => (p.legacyId ? [p.legacyId] : [])));
      const added = page.professors.filter(p => !p.legacyId || !seen.has(p.legacyId));
      emit({
        ...base,
        data: { professors: [...base.data.professors, ...added], hasMore: page.hasMore, cursor: page.cursor },
        loadingMore: false,
        loadMoreFailed: false,
      });
    } catch {
      if (current === generation) emit({ ...base, loadingMore: false, loadMoreFailed: true });
    }
  }

  return { update, loadMore };
}
