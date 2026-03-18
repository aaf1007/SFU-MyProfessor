const findProfessors = () => {
    const professorsArr = document.querySelectorAll('div.rightnclear[title="Instructor(s)"]');

    professorsArr.forEach(prof => console.log(prof));

}