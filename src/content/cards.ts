// DOM builders for the rating rows injected into the MySchedule table.
// Tailwind utilities use the `tw:` prefix (see content.css).

import {
  formatRatingCount,
  formatScore,
  type ScoreKind,
  scoreTone,
  type ScoreTone,
} from "../shared/format";
import { type ProfessorData, rmpProfileUrl, rmpSchoolSearchUrl } from "../shared/professor";

export type LookupResult =
  | { kind: "found"; data: ProfessorData }
  | { kind: "missing" }
  | { kind: "error"; message: string };

export interface CardActions {
  retry(name: string): void;
  openSearch(name: string): void;
}

const CARD_CLASS = "tw:my-1 tw:rounded-lg tw:border-l-4 tw:border-l-[#CC0000] tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:shadow-sm";
const PILL_CLASS = "tw:inline-flex tw:items-center tw:gap-1 tw:rounded-full tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium tw:ring-1 tw:ring-inset";
const LINK_CLASS = "tw:text-xs tw:text-[#CC0000] tw:underline-offset-2 tw:hover:underline";
const BUTTON_CLASS = "tw:cursor-pointer tw:rounded-full tw:border tw:border-slate-200 tw:bg-white tw:px-2 tw:py-0.5 tw:text-xs tw:text-slate-600 tw:hover:border-[#CC0000] tw:hover:text-[#CC0000]";

const TONE_CLASS: Record<ScoreTone | "none", string> = {
  good: "tw:bg-green-100 tw:text-green-800 tw:ring-green-200",
  mid: "tw:bg-yellow-100 tw:text-yellow-800 tw:ring-yellow-200",
  bad: "tw:bg-red-100 tw:text-red-800 tw:ring-red-200",
  none: "tw:bg-slate-100 tw:text-slate-400 tw:ring-slate-200",
};

const SCORES: Array<[string, ScoreKind, keyof ProfessorData]> = [
  ["Rating", "rating", "avgRating"],
  ["Difficulty", "difficulty", "avgDifficulty"],
  ["Would retake", "takeAgain", "wouldTakeAgainPercent"],
];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = "") => {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
};

const externalLink = (href: string, className: string, text: string) => {
  const anchor = el("a", className, text);
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
};

const button = (text: string, label: string, onClick: () => void) => {
  const node = el("button", BUTTON_CLASS, text);
  node.type = "button";
  node.setAttribute("aria-label", label);
  node.addEventListener("click", event => {
    // MySchedule rows can have their own click handlers.
    event.stopPropagation();
    onClick();
  });
  return node;
};

const pill = (label: string, value: number | null, kind: ScoreKind) => {
  const node = el("span", `${PILL_CLASS} ${TONE_CLASS[scoreTone(value, kind) ?? "none"]}`, `${label} `);
  node.append(el("span", "tw:font-bold", formatScore(value, kind)));
  return node;
};

const searchButton = (name: string, actions: CardActions) =>
  button("Search ↗", `Search for ${name} in the SFU MyProfessor side panel`, () => actions.openSearch(name));

const buildFoundCard = (data: ProfessorData, actions: CardActions) => {
  const card = el("div", `${CARD_CLASS} tw:py-2`);
  const line = el("div", "tw:flex tw:flex-wrap tw:items-center tw:gap-2");
  const nameClass = "tw:text-sm tw:font-semibold tw:text-[#CC0000]";
  line.append(data.legacyId
    ? externalLink(rmpProfileUrl(data.legacyId), `${nameClass} tw:underline-offset-2 tw:hover:underline`, data.name)
    : el("span", nameClass, data.name));
  for (const [label, kind, field] of SCORES) {
    line.append(pill(label, data[field] as number | null, kind));
  }
  line.append(
    el("span", "tw:text-xs tw:text-slate-400",
      data.numRatings ? `(${formatRatingCount(data.numRatings)})` : "(No student ratings yet)"),
    searchButton(data.name, actions),
  );
  card.append(line);

  if (data.topTags.length > 0) {
    const tags = el("div", "tw:mt-1 tw:flex tw:flex-wrap tw:gap-1");
    for (const tag of data.topTags) {
      tags.append(el("span", "tw:rounded-full tw:bg-red-50 tw:px-2 tw:py-0.5 tw:text-xs tw:text-slate-600 tw:ring-1 tw:ring-inset tw:ring-red-100", tag));
    }
    card.append(tags);
  }
  return card;
};

const buildMissingCard = (name: string, actions: CardActions) => {
  const card = el("div", `${CARD_CLASS} tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:py-1.5 tw:text-xs tw:text-slate-400`);
  const message = el("span", "tw:italic", "No Rate My Professors match for ");
  message.append(el("span", "tw:font-medium tw:not-italic", name));
  card.append(
    message,
    externalLink(rmpSchoolSearchUrl(name), LINK_CLASS, "Search RMP ↗"),
    searchButton(name, actions),
  );
  return card;
};

const buildErrorCard = (name: string, message: string, actions: CardActions) => {
  const card = el("div", `${CARD_CLASS} tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:py-1.5 tw:text-xs tw:text-slate-500`);
  card.title = message;
  const text = el("span", "", "Couldn’t load ratings for ");
  text.append(el("span", "tw:font-medium", name));
  card.append(text, button("Retry", `Retry loading ratings for ${name}`, () => actions.retry(name)));
  return card;
};

export const buildTBDCard = () => {
  const card = el("div", `${CARD_CLASS} tw:py-2`);
  const line = el("div", "tw:flex tw:flex-wrap tw:items-center tw:gap-2");
  line.append(el("span", "tw:text-sm tw:font-semibold tw:text-slate-400 tw:italic", "Instructor TBD"));
  for (const [label, kind] of SCORES) line.append(pill(label, null, kind));
  card.append(line);
  return card;
};

export const buildLookupCard = (name: string, result: LookupResult, actions: CardActions) => {
  if (result.kind === "found") return buildFoundCard(result.data, actions);
  if (result.kind === "missing") return buildMissingCard(name, actions);
  return buildErrorCard(name, result.message, actions);
};

/** A full-width table row (colspan 99) holding the given cards. */
export const buildRow = (cards: HTMLElement[]) => {
  const row = document.createElement("tr");
  row.dataset.sfuMyprofessor = "";
  const cell = document.createElement("td");
  cell.setAttribute("colspan", "99");
  cell.append(...cards);
  row.append(cell);
  return row;
};
