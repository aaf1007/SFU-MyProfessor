import "./content.css";

// processed: caches professor objects keyed by name after a successful fetch.
// Prevents duplicate RMP API calls — rating data is reused across multiple sections
// taught by the same professor.
const processed = new Map();

// processing: tracks in-flight fetch requests by professor name.
// Prevents duplicate messages being sent while an async request is pending.
const processing = new Set();

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
  const professorsArr = document.querySelectorAll(
    'div.rightnclear[title="Instructor(s)"]',
  );

  professorsArr.forEach((prof) => {
    //  Adds 'Staff' into processed
    if (prof.textContent === "Staff") {
      processed.set("Staff", null);
      return;
    }

    //  If professor is already is processed just get data from Map
    if (processed.has(prof.textContent)) {
      console.log(`${prof.textContent} Duplicate Handled`);
      const professorObj = processed.get(prof.textContent);
      if (!prof.isBuilt) {
        prof.isBuilt = true;
        console.log("Data row not connected Handled");
        renderProfessorRatings(prof, professorObj);
      }
      return;
    }

    // Handles getting and building professor information and data
    if (!processed.has(prof.textContent) && !processing.has(prof.textContent)) {
      // Adds prof to processing set to avoid multiple calls when async function is processing
      processing.add(prof.textContent);

      chrome.runtime.sendMessage(
        {
          type: "FETCH_DATA",
          payload: {
            name: prof.textContent,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error:", chrome.runtime.lastError.message);
            processing.delete(prof.textContent);
            return;
          }
          // Remove from processing set
          processing.delete(prof.textContent);
          console.log("Background received message", response.status);

          let data = response.data;

          const professorObj = buildProfessor(prof, data); // Create obj

          // Add Prof Object to HashMap
          processed.set(prof.textContent, professorObj);

          prof.isBuilt = true;
          // Render Ratings on page
          professorObj.name !== "Staff" &&
            renderProfessorRatings(prof, professorObj);
        },
      );
    }
  });
};

// Inital Call for findProfessors()
findProfessors();

/**
 * Builds a professor data object from a DOM element and RMP API response.
 * @param {Element} profElement - The DOM element containing the professor's name.
 * @param {Object} data - The professor data returned from the background script.
 * @returns {{ name: string, avgRating: number, avgDifficulty: number, wouldTakeAgainPercent: number }}
 */
const buildProfessor = (profElement, data) => {
  return {
    name: profElement.textContent,
    avgRating: data.avgRating,
    avgDifficulty: data.avgDifficulty,
    wouldTakeAgainPercent: data.wouldTakeAgainPercent,
  };
};

/**
 * Builds and returns a new <tr> containing the professor's rating card.
 * Called once per render — each section gets its own independent row.
 * Does not insert the row into the DOM — that is renderProfessorRatings' responsibility.
 * @param {Object} professorObj - The professor object returned by buildProfessor.
 * @returns {HTMLTableRowElement} A <tr> element populated with the professor's ratings.
 */
const buildDataRow = (professorObj) => {
  const newRow = document.createElement("tr");
  const ratingsInfo = document.createElement("td");
  ratingsInfo.setAttribute("colspan", "99");
  newRow.appendChild(ratingsInfo);

  ratingsInfo.innerHTML = `
    <div class="tw:flex tw:gap-4 tw:py-1 tw:text-sm">
      <p class="tw:font-semibold">${professorObj.name}</p>
      <p>Rating: <span class="tw:font-medium">${professorObj.avgRating}</span></p>
      <p>Difficulty: <span class="tw:font-medium">${professorObj.avgDifficulty}</span></p>
      <p>Would Take Again: <span class="tw:font-medium">${professorObj.wouldTakeAgainPercent}%</span></p>
    </div>
  `;

  return newRow;
};

/**
 * Builds a fresh rating card row and inserts it into the DOM directly after the professor's table row.
 * Calls buildDataRow on each invocation so each section gets its own independent card.
 * @param {Element} profElement - The DOM element containing the professor's name.
 * @param {Object} professorObj - The professor object returned by buildProfessor.
 */
const renderProfessorRatings = (profElement, professorObj) => {
  const tableRow = profElement.closest("tr");
  const newRow = buildDataRow(professorObj);
  tableRow.after(newRow);
};

/**
 * Returns a debounced version of a function that delays execution until
 * waitTime ms have elapsed since the last invocation. Resets the timer on each call.
 * @param {Function} func - The function to debounce.
 * @param {number} waitTime - Delay in milliseconds.
 * @returns {Function} Debounced function.
 */
const debounce = (func, waitTime) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
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
  const container = document.querySelector("#under_header > table");
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

bodyObserver.observe(document.body, { childList: true, subtree: true });
