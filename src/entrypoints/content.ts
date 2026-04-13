import { defineContentScript } from "wxt/utils/define-content-script";

import "../content/content.css";
import {
  FETCH_DATA_MESSAGE_TYPE,
  type FetchDataRequest,
  type FetchDataResponse,
  type ProfessorData,
} from "../shared/professor";

const initContentScript = () => {
  // processed: caches professor objects keyed by name after a successful fetch.
  // Prevents duplicate RMP API calls — rating data is reused across multiple sections
  // taught by the same professor.
  const processed = new Map<string, ProfessorData | null>();

  // processing: tracks in-flight fetch requests by professor name.
  // Prevents duplicate messages being sent while an async request is pending.
  const processing = new Set<string>();

  // rendered: tracks which instructor elements already received their own rating row.
  const rendered = new WeakSet<Element>();

  /**
   * Scrapes professor names from the page and fetches their data from the background script.
   * * @function findProfessors
   * @description Iterates over DOM elements matching instructor titles. For each unique,
   * unprocessed professor, it sends a message to the Chrome background script to fetch their data.
   * * @sideeffects
   * - Reads from the DOM (`div.rightnclear[title="Instructor(s)"]`).
   * - Mutates the global `processing` Set to track in-flight requests.
   * - Mutates the global `processed` Map to cache successfully fetched professor data.
   */
  const findProfessors = () => {
    const professorsArr = document.querySelectorAll<HTMLDivElement>(
      'div.rightnclear[title="Instructor(s)"]',
    );

    professorsArr.forEach((prof) => {
      const professorName = prof.textContent?.trim();

      if (!professorName) {
        return;
      }

      //  Adds 'Staff' into processed
      if (professorName === "Staff") {
        processed.set("Staff", null);
        return;
      }

      //  If professor is already is processed just get data from Map
      if (processed.has(professorName)) {
        const professorObj = processed.get(professorName) ?? null;

        if (
          !rendered.has(prof) &&
          renderProfessorRatings(prof, professorObj, professorName)
        ) {
          rendered.add(prof);
        }

        return;
      }

      // Handles getting and building professor information and data
      if (!processing.has(professorName)) {
        // Adds prof to processing set to avoid multiple calls when async function is processing
        processing.add(professorName);

        const request: FetchDataRequest = {
          type: FETCH_DATA_MESSAGE_TYPE,
          payload: {
            name: professorName,
          },
        };

        chrome.runtime.sendMessage(
          request,
          (response?: FetchDataResponse) => {
            if (chrome.runtime.lastError) {
              console.error("Error:", chrome.runtime.lastError.message);
              processing.delete(professorName);
              return;
            }

            processing.delete(professorName);

            if (!response) {
              return;
            }

            if (response.status === "Error") {
              console.error("Background error:", response.message);
              return;
            }

            const professorObj = response.data;
            processed.set(professorName, professorObj);

            if (
              !rendered.has(prof) &&
              renderProfessorRatings(prof, professorObj, professorName)
            ) {
              rendered.add(prof);
            }
          },
        );
      }
    });
  };

  type RatingKind = "rating" | "difficulty" | "takeAgain";

  const ratingColorClass = (value: number, kind: RatingKind): string => {
    let isGood: boolean;
    let isMid: boolean;

    if (kind === "rating") {
      isGood = value >= 4;
      isMid = value >= 3;
    } else if (kind === "difficulty") {
      // low difficulty is good
      isGood = value <= 2.5;
      isMid = value <= 3.5;
    } else {
      // takeAgain percentage
      isGood = value >= 80;
      isMid = value >= 60;
    }

    if (isGood) {
      return "tw:bg-green-100 tw:text-green-800 tw:ring-green-200";
    }
    if (isMid) {
      return "tw:bg-yellow-100 tw:text-yellow-800 tw:ring-yellow-200";
    }
    return "tw:bg-red-100 tw:text-red-800 tw:ring-red-200";
  };

  const makePill = (label: string, value: string, colorClass: string): HTMLSpanElement => {
    const pill = document.createElement("span");
    pill.className = `tw:inline-flex tw:items-center tw:gap-1 tw:rounded-full tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium tw:ring-1 tw:ring-inset ${colorClass}`;
    const labelNode = document.createTextNode(`${label} `);
    const valueEl = document.createElement("span");
    valueEl.className = "tw:font-bold";
    valueEl.textContent = value;
    pill.appendChild(labelNode);
    pill.appendChild(valueEl);
    return pill;
  };

  const buildDataRow = (professorObj: ProfessorData): HTMLTableRowElement => {
    const newRow = document.createElement("tr");
    const td = document.createElement("td");
    td.setAttribute("colspan", "99");
    newRow.appendChild(td);

    // Card wrapper
    const card = document.createElement("div");
    card.className = "tw:my-1 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:px-3 tw:py-2 tw:shadow-sm";
    td.appendChild(card);

    // --- First line: name + stat pills + sample size ---
    const firstLine = document.createElement("div");
    firstLine.className = "tw:flex tw:flex-wrap tw:items-center tw:gap-2";
    card.appendChild(firstLine);

    // Professor name (link if legacyId available)
    if (professorObj.legacyId) {
      const anchor = document.createElement("a");
      anchor.href = `https://www.ratemyprofessors.com/professor/${professorObj.legacyId}`;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.className = "tw:text-sm tw:font-semibold tw:text-slate-900 tw:underline-offset-2 tw:hover:underline";
      anchor.textContent = professorObj.name;
      firstLine.appendChild(anchor);
    } else {
      const nameSpan = document.createElement("span");
      nameSpan.className = "tw:text-sm tw:font-semibold tw:text-slate-900";
      nameSpan.textContent = professorObj.name;
      firstLine.appendChild(nameSpan);
    }

    // Stat pills
    firstLine.appendChild(
      makePill("Rating", `${professorObj.avgRating}/5`, ratingColorClass(professorObj.avgRating, "rating")),
    );
    firstLine.appendChild(
      makePill("Difficulty", `${professorObj.avgDifficulty}/5`, ratingColorClass(professorObj.avgDifficulty, "difficulty")),
    );
    firstLine.appendChild(
      makePill("Would retake", `${professorObj.wouldTakeAgainPercent}%`, ratingColorClass(professorObj.wouldTakeAgainPercent, "takeAgain")),
    );

    // Sample size
    const sampleSpan = document.createElement("span");
    sampleSpan.className = "tw:text-xs tw:text-slate-400";
    sampleSpan.textContent = `(${professorObj.numRatings} rating${professorObj.numRatings === 1 ? "" : "s"})`;
    firstLine.appendChild(sampleSpan);

    // --- Second line: tags ---
    if (professorObj.topTags.length > 0) {
      const tagsLine = document.createElement("div");
      tagsLine.className = "tw:mt-1 tw:flex tw:flex-wrap tw:gap-1";
      for (const tag of professorObj.topTags) {
        const chip = document.createElement("span");
        chip.className = "tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:text-xs tw:text-slate-500 tw:ring-1 tw:ring-inset tw:ring-slate-200";
        chip.textContent = tag;
        tagsLine.appendChild(chip);
      }
      card.appendChild(tagsLine);
    }

    return newRow;
  };

  const buildEmptyRow = (professorName: string): HTMLTableRowElement => {
    const newRow = document.createElement("tr");
    const td = document.createElement("td");
    td.setAttribute("colspan", "99");
    newRow.appendChild(td);

    const card = document.createElement("div");
    card.className = "tw:my-1 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50/60 tw:px-3 tw:py-1.5 tw:text-xs tw:italic tw:text-slate-400";
    const prefix = document.createTextNode("No Rate My Professors data for ");
    const nameSpan = document.createElement("span");
    nameSpan.className = "tw:font-medium tw:not-italic";
    nameSpan.textContent = professorName;
    card.appendChild(prefix);
    card.appendChild(nameSpan);
    td.appendChild(card);

    return newRow;
  };

  /**
   * Builds a fresh rating card row (or empty-state row) and inserts it into the DOM
   * directly after the professor's table row. Dispatches to buildDataRow when data is
   * available, or buildEmptyRow when RMP returned no match.
   * @param {Element} profElement - The DOM element containing the professor's name.
   * @param {ProfessorData | null} professorObj - Professor data, or null when not found on RMP.
   */
  const renderProfessorRatings = (
    profElement: Element,
    professorObj: ProfessorData | null,
    professorName: string,
  ): boolean => {
    const tableRow = profElement.closest("tr");

    if (!tableRow) {
      return false;
    }

    const newRow = professorObj
      ? buildDataRow(professorObj)
      : buildEmptyRow(professorName);
    tableRow.after(newRow);
    return true;
  };

  /**
   * Returns a debounced version of a function that delays execution until
   * waitTime ms have elapsed since the last invocation. Resets the timer on each call.
   * @param {Function} func - The function to debounce.
   * @param {number} waitTime - Delay in milliseconds.
   * @returns {Function} Debounced function.
   */
  const debounce = <TArgs extends unknown[]>(
    func: (...args: TArgs) => void,
    waitTime: number,
  ) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    return (...args: TArgs) => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        func(...args);
      }, waitTime);
    };
  };

  const debounceFindProfessors = debounce(findProfessors, 500);

  // bodyObserver: temporary observer on document.body that waits for the specific
  // schedule container to appear in the DOM (since the SFU schedule is a SPA and
  // the container may not exist on initial load). Once found, it disconnects itself
  // and hands off to the targeted `observer` to reduce the scope of DOM watching.
  const bodyObserver = new MutationObserver(() => {
    const container = document.querySelector<HTMLTableElement>(
      "#under_header > table",
    );

    if (container) {
      bodyObserver.disconnect(); // stop watching body
      observer.observe(container, {
        childList: true,
        subtree: true,
      });
    }
  });

  // observer: watches the specific schedule container for DOM changes and triggers
  // a debounced findProfessors() call to catch professors added by SPA navigation.
  const observer = new MutationObserver(() => {
    debounceFindProfessors();
  });

  findProfessors();
  bodyObserver.observe(document.body, { childList: true, subtree: true });
};

export default defineContentScript({
  matches: ["https://myschedule.erp.sfu.ca/*"],
  runAt: "document_end",
  main() {
    initContentScript();
  },
});
