
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
    const professorsArr = document.querySelectorAll('div.rightnclear[title="Instructor(s)"]');

    professorsArr.forEach(prof => {
        if (!seen.has(prof.textContent) && prof.textContent !== "Staff" && !processing.has(prof.textContent)) {
            // Adds prof to processing set to avoid multiple calls when async function is processing
            processing.add(prof.textContent);
            console.log(prof.textContent);
            
            chrome.runtime.sendMessage({
                type: "FETCH_DATA",
                payload: {
                    name: prof.textContent
                }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error:", chrome.runtime.lastError.message);
                    processing.delete(prof.textContent);
                    return;
                }
                // Remove from processing set
                processing.delete(prof.textContent);
                console.log("Background received message", response.status);
                console.log(response.data);

                let data = response.data;
                // Add Prof Object to HashMap
                (data !== null && (seen.set(prof.textContent, data)));
            });
        }
    });
}

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

// TODO: Implement
const injectRatings = () => {}