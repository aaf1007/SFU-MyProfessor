import "./style.css";
import {
  COURSE_INSTRUCTORS_MESSAGE_TYPE,
  type CourseInstructor,
  type CourseInstructorsData,
  type CourseInstructorsRequest,
  type CourseInstructorsResponse,
  type CourseSection,
  isPendingSearch,
  PENDING_SEARCH_KEY,
  rmpProfileUrl,
  SEARCH_PROFESSORS_MESSAGE_TYPE,
  type ProfessorSearchResult,
  type SearchProfessorsRequest,
  type SearchProfessorsResponse,
} from "../../shared/professor";
import { formatCourseCode, parseCourseCode, termLabel, termOptions } from "../../shared/course";
import { FEW_RATINGS, formatRatingCount, formatScoreValue, type ScoreKind } from "../../shared/format";
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
const label = document.querySelector<HTMLLabelElement>("#search-label")!;
const examples = document.querySelector<HTMLParagraphElement>("#examples")!;
const termSelect = document.querySelector<HTMLSelectElement>("#course-term")!;
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>(".tabs [data-mode]")];
const courseSummary = document.querySelector<HTMLDivElement>("#course-summary")!;
const courseTitle = document.querySelector<HTMLHeadingElement>("#course-title")!;
const courseMeta = document.querySelector<HTMLParagraphElement>("#course-meta")!;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: string) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

const formatScore = (score: number | null, kind: ScoreKind) => {
  const value = formatScoreValue(score, kind);
  return value === null ? "–" : kind === "takeAgain" ? `${value}%` : value;
};

function buildStat(label: string, value: string) {
  const stat = element("div", "stat", "");
  stat.append(element("dt", "", label), element("dd", "", value));
  return stat;
}

function buildSections(sections: CourseSection[]) {
  const list = element("ul", "sections", "");
  list.setAttribute("aria-label", "Sections");
  for (const { section, campus, deliveryMethod } of sections) {
    const item = element("li", "", "");
    const where = [campus, deliveryMethod && deliveryMethod !== "In Person" ? deliveryMethod.toLowerCase() : null]
      .filter(Boolean).join(", ");
    item.append(element("b", "", section), where ? ` ${where}` : "");
    list.append(item);
  }
  return list;
}

interface RowOptions { rank?: number; sfuName?: string; sections?: CourseSection[] }

function buildRow(professor: ProfessorSearchResult | null, options: RowOptions = {}): HTMLLIElement {
  const row = element("li", "result", "");
  if (options.rank) {
    const rank = element("span", "rank", String(options.rank));
    rank.setAttribute("aria-label", `Rank ${options.rank}`);
    row.append(rank);
  }

  const body = element("div", "result-body", "");
  const name = professor?.name ?? options.sfuName ?? "";
  const heading = element("h2", "result-name", "");
  if (professor?.legacyId) {
    // The link's ::after covers the whole row, so the row is one click target.
    const link = element("a", "", name);
    link.href = rmpProfileUrl(professor.legacyId);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `${name} on Rate My Professors (opens in a new tab)`);
    heading.append(link);
  } else heading.textContent = name;
  body.append(heading);
  // In a course every instructor shares a department, so the sections they teach replace it.
  if (options.sections?.length) body.append(buildSections(options.sections));
  else if (professor) body.append(element("p", "result-dept", professor.department));
  if (!professor) body.append(element("p", "result-count", "No Rate My Professors profile found."));

  if (professor && professor.numRatings > 0) {
    const stats = element("dl", "stats", "");
    stats.append(buildStat("Difficulty", formatScore(professor.avgDifficulty, "difficulty")),
      buildStat("Would retake", formatScore(professor.wouldTakeAgainPercent, "takeAgain")));
    body.append(stats);
  }
  if (professor) {
    const few = professor.numRatings > 0 && professor.numRatings < FEW_RATINGS;
    const count = professor.numRatings === 0 ? "No student ratings yet."
      : few ? `Based on only ${professor.numRatings} ${professor.numRatings === 1 ? "rating" : "ratings"}.`
      : formatRatingCount(professor.numRatings);
    body.append(element("p", few ? "result-count few" : "result-count", count));
  }
  row.append(body);

  if (professor) {
    const rating = professor.avgRating;
    const score = element("div", rating === null ? "score empty" : "score", "");
    score.setAttribute("aria-label", rating === null ? "No overall rating" : `Rated ${rating.toFixed(1)} out of 5`);
    const value = element("span", "score-value", formatScore(rating, "rating"));
    const meter = element("span", "score-meter", "");
    if (rating !== null) meter.style.setProperty("--fill", `${(rating / 5) * 100}%`);
    for (const child of [value, meter]) child.setAttribute("aria-hidden", "true");
    score.append(value, meter);
    row.append(score);
  }
  return row;
}

function buildCourseRow(instructor: CourseInstructor, index: number): HTMLLIElement {
  return buildRow(instructor.professor, { rank: index + 1, sfuName: instructor.name, sections: instructor.sections });
}

function resetView(state: { status: string }) {
  clear.hidden = input.value.length === 0;
  loading.hidden = state.status !== "loading";
  results.setAttribute("aria-busy", String(state.status === "loading"));
  results.replaceChildren();
  results.hidden = true;
  more.hidden = true;
  courseSummary.hidden = true;
  status.classList.remove("visually-hidden");
  examples.hidden = true;
  results.classList.toggle("ranked", mode === "course");
  retry.hidden = state.status !== "error";
  empty.hidden = state.status === "loading";
}

function showEmpty(heading: string, text: string) {
  title.textContent = heading;
  description.textContent = text;
}

function renderProfessors(state: SearchState) {
  resetView(state);
  if (state.status === "idle") {
    status.textContent = "";
    showEmpty("Look up an SFU instructor", "Type a first or last name to see their Rate My Professors scores.");
  } else if (state.status === "loading") {
    status.textContent = `Searching SFU for “${state.query}”…`;
  } else if (state.status === "error") {
    status.textContent = "";
    showEmpty("Rate My Professors didn’t respond", "Check your connection, then try again.");
  } else if (state.status === "success") {
    const { professors, hasMore } = state.data;
    more.hidden = !hasMore;
    loadMore.disabled = state.loadingMore;
    loadMore.textContent = state.loadingMore ? "Loading more…" : "Show more professors";
    loadMoreStatus.textContent = state.loadMoreFailed ? "Couldn’t load more professors. Try again." : "";
    if (!professors.length) {
      status.textContent = "";
      showEmpty(`No SFU instructors match “${state.query}”`, "Try another spelling, or search by last name only.");
      return;
    }
    empty.hidden = true;
    results.hidden = false;
    status.textContent = `${hasMore ? "First " : ""}${professors.length} ${professors.length === 1 ? "match" : "matches"} for “${state.query}”`;
    results.append(...professors.map(professor => buildRow(professor)));
  }
}

function renderCourse(state: SearchState<CourseInstructorsData | null>) {
  resetView(state);
  const code = parseCourseCode(state.query);
  const course = code ? formatCourseCode(code) : state.query;
  const term = selectedTerm();
  if (state.status === "idle") {
    status.textContent = "";
    showEmpty("Compare who’s teaching a course", "Enter a course code to see every instructor for the term, best rated first.");
    examples.hidden = false;
  } else if (state.status === "loading") {
    status.textContent = `Looking up ${course} for ${termLabel(term)}…`;
  } else if (state.status === "error") {
    status.textContent = "";
    showEmpty("Couldn’t load this course", "SFU course outlines or Rate My Professors didn’t respond. Check your connection, then try again.");
  } else if (state.status === "success") {
    const data = state.data;
    if (!data) {
      status.textContent = "";
      showEmpty(`${course} isn’t offered in ${termLabel(term)}`, "Switch the term, or check the course code.");
      return;
    }
    if (!data.instructors.length) {
      status.textContent = "";
      showEmpty("No instructors listed yet", `SFU hasn’t posted instructors for ${data.course} in ${data.term}. Check back closer to the start of term.`);
      return;
    }
    empty.hidden = true;
    results.hidden = false;
    courseSummary.hidden = false;
    status.classList.add("visually-hidden");
    const count = `${data.instructors.length} ${data.instructors.length === 1 ? "instructor" : "instructors"}`;
    status.textContent = `${count} teaching ${data.course} in ${data.term}, ranked by rating.`;
    courseTitle.textContent = data.title || data.course;
    const unassigned = data.unassignedSections.length === 0 ? "" : ` ${data.unassignedSections.join(", ")} ${data.unassignedSections.length === 1 ? "has" : "have"} no instructor listed yet.`;
    courseMeta.textContent = `${data.course}, ${data.term}. ${count}, best rated first.${unassigned}`;
    results.append(...data.instructors.map(buildCourseRow));
  }
}

type Mode = "professor" | "course";
let mode: Mode = "professor";
const drafts: Record<Mode, string> = { professor: "", course: "" };
let lastProfessorState: SearchState | undefined;
let lastCourseState: SearchState<CourseInstructorsData | null> | undefined;

const terms = termOptions();
termSelect.append(...terms.map((term, index) => {
  const option = element("option", "", termLabel(term));
  option.value = String(index);
  return option;
}));
const selectedTerm = () => terms[Number(termSelect.value)] ?? terms[0];

const professorSearch = createProfessorSearch(async (query, after) => {
  const request: SearchProfessorsRequest = {
    type: SEARCH_PROFESSORS_MESSAGE_TYPE, payload: after ? { query, after } : { query },
  };
  const response: SearchProfessorsResponse | undefined = await chrome.runtime.sendMessage(request);
  if (!response || response.status !== "Success" || !Array.isArray(response.data?.professors)) {
    throw new Error("Professor search is unavailable.");
  }
  return response.data;
}, state => {
  lastProfessorState = state;
  if (mode === "professor") renderProfessors(state);
});

const courseSearch = createProfessorSearch<CourseInstructorsData | null>(async query => {
  const code = parseCourseCode(query)!;
  const request: CourseInstructorsRequest = {
    type: COURSE_INSTRUCTORS_MESSAGE_TYPE, payload: { ...code, ...selectedTerm() },
  };
  const response: CourseInstructorsResponse | undefined = await chrome.runtime.sendMessage(request);
  if (!response || response.status !== "Success" ||
    (response.data !== null && !Array.isArray(response.data?.instructors))) {
    throw new Error("Course lookup is unavailable.");
  }
  return response.data;
}, state => {
  lastCourseState = state;
  if (mode === "course") renderCourse(state);
}, { isReady: query => parseCourseCode(query) !== null, paging: null });

const activeSearch = () => mode === "professor" ? professorSearch : courseSearch;

function setMode(next: Mode) {
  if (next === mode) return;
  drafts[mode] = input.value;
  mode = next;
  for (const button of modeButtons) {
    const checked = button.dataset.mode === mode;
    button.setAttribute("aria-checked", String(checked));
    button.tabIndex = checked ? 0 : -1;
  }
  const course = mode === "course";
  input.value = drafts[mode];
  input.placeholder = course ? "Course code" : "First or last name";
  label.textContent = course ? "Course code" : "Professor name";
  termSelect.hidden = !course;
  // Re-show this mode's last results instead of searching again.
  const last = course ? lastCourseState : lastProfessorState;
  if (last) {
    if (course) renderCourse(last as SearchState<CourseInstructorsData | null>);
    else renderProfessors(last as SearchState);
  } else activeSearch().update(input.value);
  input.focus();
}

for (const button of modeButtons) {
  button.tabIndex = button.dataset.mode === mode ? 0 : -1;
  button.addEventListener("click", () => setMode(button.dataset.mode as Mode));
  button.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    setMode(mode === "professor" ? "course" : "professor");
    modeButtons.find(b => b.dataset.mode === mode)?.focus();
  });
}
for (const code of ["CMPT 120", "MATH 151", "ECON 103"]) {
  const button = element("button", "example", code);
  button.type = "button";
  button.addEventListener("click", () => {
    input.value = code;
    courseSearch.update(code, true);
    input.focus();
  });
  examples.append(button);
}
examples.prepend("Try ");
termSelect.addEventListener("change", () => courseSearch.update(input.value, true));

let composing = false;
input.addEventListener("compositionstart", () => { composing = true; activeSearch().update(""); });
input.addEventListener("compositionend", () => { composing = false; activeSearch().update(input.value); });
input.addEventListener("input", () => {
  if (!composing) activeSearch().update(input.value);
});
form.addEventListener("submit", event => {
  event.preventDefault();
  if (!composing) activeSearch().update(input.value, true);
});
function clearSearch() {
  input.value = "";
  activeSearch().update("");
  input.focus();
}
clear.addEventListener("click", clearSearch);
input.addEventListener("keydown", event => {
  if (event.key === "Escape" && input.value) {
    event.preventDefault();
    clearSearch();
  }
});
retry.addEventListener("click", () => {
  input.focus();
  activeSearch().update(input.value, true);
});
loadMore.addEventListener("click", () => void professorSearch.loadMore());

// "Search ↗" buttons on MySchedule rating rows hand their query over through session
// storage: read on load (the panel was just opened) and watched while the panel is open.
const PENDING_SEARCH_MAX_AGE_MS = 10_000;
function applyPendingSearch(value: unknown) {
  if (!isPendingSearch(value) || Date.now() - value.requestedAt > PENDING_SEARCH_MAX_AGE_MS) return;
  setMode("professor");
  input.value = value.query;
  professorSearch.update(value.query, true);
  input.focus();
  void chrome.storage.session.remove(PENDING_SEARCH_KEY);
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes[PENDING_SEARCH_KEY]?.newValue) {
    applyPendingSearch(changes[PENDING_SEARCH_KEY].newValue);
  }
});

activeSearch().update(input.value);
chrome.storage.session.get(PENDING_SEARCH_KEY)
  .then(stored => applyPendingSearch(stored[PENDING_SEARCH_KEY]))
  .catch((error: unknown) => console.error("Could not read the pending search:", error));
