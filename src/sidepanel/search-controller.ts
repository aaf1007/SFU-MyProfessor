import type { ProfessorSearchData } from "../shared/professor";

export type SearchState =
  | { status: "idle" | "loading" | "error"; query: string }
  | { status: "success"; query: string; data: ProfessorSearchData };

export function createProfessorSearch(
  request: (query: string) => Promise<ProfessorSearchData>,
  onState: (state: SearchState) => void,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;

  function update(value: string, immediate = false) {
    clearTimeout(timer);
    // Invalidate immediately, including the interval before the next request starts.
    const current = ++generation;
    const query = value.trim().replace(/\s+/g, " ");
    if (query.length < 2) {
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
