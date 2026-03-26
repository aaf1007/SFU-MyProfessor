const seen = new Map();
const processing = new Set();

/**
 * Scrapes professor names from the page and fetches their data from the background script.
 * * @function findProfessors
 * @description Iterates over DOM elements matching instructor titles. For each unique,
 * unprocessed professor, it sends a message to the Chrome background script to fetch their data.
 * * @sideeffects
 * - Reads from the DOM (`div.rightnclear[title="Instructor(s)"]`).
 * - Mutates the global `processing` Set to track in-flight requests.
 * - Mutates the global `seen` Map to cache successfully fetched professor data.
 */
const findProfessors = () => {
  const professorsArr = document.querySelectorAll(
    'div.rightnclear[title="Instructor(s)"]',
  );

  professorsArr.forEach((prof) => {
    // Adds 'Staff' into Seen
    if (prof.textContent === "Staff") {
      seen.set("Staff", null);
      return;
    }

    if (!seen.has(prof.textContent) && !processing.has(prof.textContent)) {
      // Adds prof to processing set to avoid multiple calls when async function is processing
      processing.add(prof.textContent);

      // Professor Object
      const professor = {
        name: prof.textContent,
        avgDifficulty: "null",
        avgRating: "null",
        wouldTakeAgainPercent: "null",
        tableRow: prof.closest("tr"),
      };

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

          professor.avgDifficulty = data.avgDifficulty;
          professor.avgRating = data.avgRating;
          professor.wouldTakeAgainPercent = data.wouldTakeAgainPercent;

          console.log(professor);
          // Add Prof Object to HashMap
          seen.set(prof.textContent, professor);

          // Inject Ratings on page
          injectRatings(professor);
        },
      );
    }
  });
};

// Inital Call for findProfessors()
findProfessors();

/**
 * Delays the execution of a function until after a certain wait time
 * has elapsed since the last time it was invoked.
 * returns a debounced @function (...ars)
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

const observer = new MutationObserver(() => {
  debounceFindProfessors();
});

observer.observe(document.body, { childList: true, subtree: true });

/*
 * Inject ratings below professor names on the page
 * @function injectRatings
 * @description takes the professor object and adds HTML into the page displaying
 * professor ratings
 * @args professor : professor.Object
 */
const injectRatings = (professor) => {
  const newRow = document.createElement("tr");
  const ratingsInfo = document.createElement("td");

  ratingsInfo.innerHTML = `
    <div class="flex">
      <p>Name: ${professor.name}</p>
      <p>Rating: ${professor.avgRating}</p>
      <p>Difficulty: ${professor.avgDifficulty}</p>
      <p>Would Take Again: ${professor.wouldTakeAgainPercent}%</p>
    </div>
  `;
  newRow.appendChild(ratingsInfo);

  professor.tableRow.after(newRow); // Adds newRow afer Professor data row
};
