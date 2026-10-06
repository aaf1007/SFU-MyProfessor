import "./style.css";
import { formatScoreValue, type ScoreKind, scoreUnit } from "../../shared/format";
import {
  isPendingSearch,
  PENDING_SEARCH_KEY,
  rmpProfileUrl,
  SEARCH_PROFESSORS_MESSAGE_TYPE,
  type ProfessorSearchResult,
  type SearchProfessorsRequest,
  type SearchProfessorsResponse,
} from "../../shared/professor";
import { createProfessorSearch, type SearchState } from "../../sidepanel/search-controller";

const input = document.querySelector<HTMLInputElement>("#professor-search")!;
const form = document.querySelector<HTMLFormElement>("#search-form")!;
const clear = document.querySelector<HTMLButtonElement>("#clear-search")!;
const retry = document.querySelector<HTMLButtonElement>("#retry-search")!;
const status = document.querySelector<HTMLParagraphElement>("#search-status")!;
const empty = document.querySelector<HTMLElement>("#empty-state")!;
const title = document.querySelector<HTMLHeadingElement>("#state-title")!;
const description = document.querySelector<HTMLParagraphElement>("#state-description")!;
const loading = document.querySelector<HTMLDivElement>("#loading-state")!;
const results = document.querySelector<HTMLUListElement>("#search-results")!;
const more = document.querySelector<HTMLDivElement>("#more-results")!;
const loadMore = document.querySelector<HTMLButtonElement>("#load-more")!;
const loadMoreStatus = document.querySelector<HTMLParagraphElement>("#load-more-status")!;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: string) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function buildProfessorCard(professor: ProfessorSearchResult): HTMLLIElement {
  const card = element("li", "professor-card", "");
  const heading = element("h2", "professor-name", "");
  if (professor.legacyId) {
    const link = element("a", "profile-link", professor.name);
    link.href = rmpProfileUrl(professor.legacyId);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `${professor.name} on Rate My Professors (opens in a new tab)`);
    const arrow = element("span", "profile-arrow", "↗");
    arrow.setAttribute("aria-hidden", "true");
    link.append(arrow);
    heading.append(link);
  } else heading.textContent = professor.name;

  const metrics = element("dl", "metrics", "");
  const scores: Array<[string, number | null, ScoreKind]> = [
    ["Rating", professor.avgRating, "rating"],
    ["Difficulty", professor.avgDifficulty, "difficulty"],
    ["Would retake", professor.wouldTakeAgainPercent, "takeAgain"],
  ];
  for (const [label, score, kind] of scores) {
    const metric = element("div", "metric", "");
    const formatted = formatScoreValue(score, kind);
    const value = element("dd", "metric-value", formatted ?? "—");
    if (formatted === null) value.setAttribute("aria-label", "Not available");
    else value.append(element("span", "metric-unit", scoreUnit(kind)));
    metric.append(element("dt", "metric-label", label), value);
    metrics.append(metric);
  }
  card.append(heading, element("p", "department", professor.department), metrics,
    element("p", "rating-count", professor.numRatings === 0 ? "No student ratings yet" :
      `${professor.numRatings.toLocaleString()} student ${professor.numRatings === 1 ? "rating" : "ratings"}`));
  return card;
}

function render(state: SearchState) {
  clear.hidden = input.value.length === 0;
  loading.hidden = state.status !== "loading";
  results.setAttribute("aria-busy", String(state.status === "loading"));
  results.replaceChildren();
  results.hidden = true;
  more.hidden = true;
  retry.hidden = state.status !== "error";
  empty.hidden = state.status === "loading";

  if (state.status === "idle") {
    status.textContent = "Type at least 2 characters to start.";
    title.textContent = "Know who’s teaching.";
    description.textContent = "Find ratings, difficulty, and student feedback for SFU professors.";
  } else if (state.status === "loading") {
    status.textContent = `Searching SFU for “${state.query}”…`;
  } else if (state.status === "error") {
    status.textContent = "Professor search is unavailable.";
    title.textContent = "Couldn’t load professors.";
    description.textContent = "Check your connection and try again. Rate My Professors may be temporarily unavailable.";
  } else if (state.status === "success") {
    const { professors, hasMore } = state.data;
    more.hidden = !hasMore;
    loadMore.disabled = state.loadingMore;
    loadMore.textContent = state.loadingMore ? "Loading more…" : "Show more professors";
    loadMoreStatus.textContent = state.loadMoreFailed ? "Couldn’t load more professors. Try again." : "";
    if (!professors.length) {
      status.textContent = `No SFU matches for “${state.query}”.`;
      title.textContent = "No professors found.";
      description.textContent = "Try a different spelling or just a last name. Only professors listed on SFU’s Rate My Professors page appear here.";
      return;
    }
    empty.hidden = true;
    results.hidden = false;
    status.textContent = `${hasMore ? "Showing " : ""}${professors.length} ${professors.length === 1 ? "professor" : "professors"} for “${state.query}”`;
    results.append(...professors.map(buildProfessorCard));
  }
}

const search = createProfessorSearch(async (query, after) => {
  const request: SearchProfessorsRequest = {
    type: SEARCH_PROFESSORS_MESSAGE_TYPE, payload: after ? { query, after } : { query },
  };
  const response: SearchProfessorsResponse | undefined = await chrome.runtime.sendMessage(request);
  if (!response || response.status !== "Success" || !Array.isArray(response.data?.professors)) {
    throw new Error("Professor search is unavailable.");
  }
  return response.data;
}, render);

let composing = false;
input.addEventListener("compositionstart", () => { composing = true; search.update(""); });
input.addEventListener("compositionend", () => { composing = false; search.update(input.value); });
input.addEventListener("input", () => {
  if (!composing) search.update(input.value);
});
form.addEventListener("submit", event => {
  event.preventDefault();
  if (!composing) search.update(input.value, true);
});
clear.addEventListener("click", () => {
  input.value = "";
  search.update("");
  input.focus();
});
retry.addEventListener("click", () => {
  input.focus();
  search.update(input.value, true);
});
loadMore.addEventListener("click", () => void search.loadMore());

// "Search ↗" buttons on MySchedule rating rows hand their query over through session
// storage: read on load (the panel was just opened) and watched while the panel is open.
const PENDING_SEARCH_MAX_AGE_MS = 10_000;
function applyPendingSearch(value: unknown) {
  if (!isPendingSearch(value) || Date.now() - value.requestedAt > PENDING_SEARCH_MAX_AGE_MS) return;
  input.value = value.query;
  search.update(value.query, true);
  input.focus();
  void chrome.storage.session.remove(PENDING_SEARCH_KEY);
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes[PENDING_SEARCH_KEY]?.newValue) {
    applyPendingSearch(changes[PENDING_SEARCH_KEY].newValue);
  }
});

search.update(input.value);
chrome.storage.session.get(PENDING_SEARCH_KEY)
  .then(stored => applyPendingSearch(stored[PENDING_SEARCH_KEY]))
  .catch((error: unknown) => console.error("Could not read the pending search:", error));
