console.log(document.querySelectorAll('div.rightnclear[title="Instructor(s)"]'));
console.log("SFU ProfessorView content script loaded");

const seen = new Set();

const findProfessors = () => {
    const professorsArr = document.querySelectorAll('div.rightnclear[title="Instructor(s)"]');

    professorsArr.forEach(prof => {
        if (!seen.has(prof.textContent) && prof.textContent != "Staff") {
            seen.add(prof.textContent);
            console.log(prof.textContent);

            chrome.runtime.sendMessage({
                type: "FETCH_DATA",
                payload: {
                    name: prof.textContent
                }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error:", chrome.runtime.lastError.message);
                    return;
                }
                console.log("Background received message", response.status);
                console.log(response.data);
            });
        }
    });
}

findProfessors();

const observer = new MutationObserver(() => {
    findProfessors();
});

observer.observe(document.body, { childList: true, subtree: true });