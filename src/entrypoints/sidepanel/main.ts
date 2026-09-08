import "./style.css";
import {
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
const more = document.querySelector<HTMLParagraphElement>("#more-results")!;

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
    link.href = `https://www.ratemyprofessors.com/professor/${professor.legacyId}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `${professor.name} on Rate My Professors (opens in a new tab)`);
    const arrow = element("span", "profile-arrow", "↗");
    arrow.setAttribute("aria-hidden", "true");
    link.append(arrow);
    heading.append(link);
  } else heading.textContent = professor.name;

  const metrics = element("dl", "metrics", "");
  const scores: Array<[string, number | null, string]> = [
    ["Rating", professor.avgRating, "/ 5"],
    ["Difficulty", professor.avgDifficulty, "/ 5"],
    ["Would retake", professor.wouldTakeAgainPercent, "%"],
  ];
  for (const [label, score, unit] of scores) {
    const metric = element("div", "metric", "");
    const value = element("dd", "metric-value", score === null ? "—" :
      unit === "%" ? String(Math.round(score)) : score.toFixed(1));
    if (score === null) value.setAttribute("aria-label", "Not available");
    else value.append(element("span", "metric-unit", unit));
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

const search = createProfessorSearch(async query => {
  const request: SearchProfessorsRequest = {
    type: SEARCH_PROFESSORS_MESSAGE_TYPE, payload: { query },
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
search.update(input.value);
