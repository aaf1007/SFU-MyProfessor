console.log("SFU ProfessorView content script loaded");
console.log(document.querySelectorAll('div.rightnclear[title="Instructor(s)"]'));

const seen = new Set();

const findProfessors = () => {
    const professorsArr = document.querySelectorAll('div.rightnclear[title="Instructor(s)"]');

    professorsArr.forEach(prof => {
        if (!seen.has(prof)) {
            seen.add(prof);
            console.log(prof);
        }
    });
}

findProfessors();

const observer = new MutationObserver(() => {
    findProfessors();
});

observer.observe(document.body, { childList: true, subtree: true });