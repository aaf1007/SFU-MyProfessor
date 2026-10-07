import type { ProfessorSearchData } from "../shared/professor";

export type SearchState<T = ProfessorSearchData> =
  | { status: "idle" | "loading" | "error"; query: string }
  | { status: "success"; query: string; data: T };

export function createProfessorSearch<T = ProfessorSearchData>(
  request: (query: string) => Promise<T>,
  onState: (state: SearchState<T>) => void,
  isReady: (query: string) => boolean = query => query.length >= 2,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;

  function update(value: string, immediate = false) {
    clearTimeout(timer);
    // Invalidate immediately, including the interval before the next request starts.
    const current = ++generation;
    const query = value.trim().replace(/\s+/g, " ");
    if (!isReady(query)) {
      onState({ status: "idle", query });
      return;
    }
    onState({ status: "loading", query });
    const run = async () => {
      try {
        const data = await request(query);
        if (current === generation) onState({ status: "success", query, data });
      } catch {
        if (current === generation) onState({ status: "error", query });
      }
    };
    if (immediate) void run();
    else timer = setTimeout(() => void run(), 300);
  }

  return { update };
}
