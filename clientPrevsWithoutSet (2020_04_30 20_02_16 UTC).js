const axios = require('axios')
const fs = require('file-system');
const moment = require('moment');
// const COUCHDB_URI = "http://admin:GBP%40ck3rs%231@localhost:5984";
let EXCLUDE_ID_LIST = require('./updatedfamilies').excludeIDs;
const VISIT_NAME = 'Adult Visit';
const CLIENT_ID = '545026%004adult%0040%00%00';
const COUCHDB_URI = "https://admin:wK0mI55ghBU9pp@www.hfatracking.net/couchdb";
const OS_NAME = 'os-jdelong';

function expand(templateFormDoc, compressedForm) {
    const formCopy = JSON.parse(JSON.stringify(templateFormDoc));
    for (const prop in formCopy.form) {
        if (prop !== "tabs") {
            formCopy.form[prop] = compressedForm.form[prop];
        }
    }

    for (const question of compressedForm.form.contents) {
        const index = indexQuestionGroup(formCopy.form, question.key);
        if (index) {
            const formPart = findFormPartByIndex(formCopy.form, index);
            if (question.key === "Income") {
                const income = question.value.split(" ");
                if (income[0] === "yearly") {
                    formPart.indices.yearly = income[1];
                } else if (income[0] === "monthly") {
                    formPart.indices.monthly = income[1];
                } else if (income[0] === "weekly") {
                    formPart.indices.weekly = income[1];
                }
            } else {
                formPart.input = question.value;
            }
            formPart.notes = question.notes;
            formPart.usePreviousValue = question.usePreviousValue;
        }

    }
    formCopy._id = compressedForm._id;
    formCopy._rev = compressedForm._rev;
    return formCopy;
}
function combineOsVisitsOfCurrentType(visitName, clientID) {
    const promises = [];
    // return Promise.all([osNames()]).then(([osNames]) => {
    const osAllDocPromises = []
    // osNames.forEach((name) => {
    const visitsURI = COUCHDB_URI + "/" + OS_NAME + "/_all_docs?include_docs=true"
    return axios.get(visitsURI, {timeout: 1200000, maxContentLength: 400000000}).then(res => {
        const visitDocs = res.data.rows.filter((row) => {
            if (!row.doc._id.startsWith('_design') && !row.doc._id.startsWith('clients')) {
                return (
                    (row.doc.form.name === visitName) &&
                    (!row.doc._id.startsWith("54blankForm")) &&
                    (row.doc.form.client === clientID)
                );
            }
            return false;
        }).map((row) => {
            return row.doc;
        })
        const orderedForms = orderFormsByDate(visitDocs);
        return orderedForms;
    }).catch(err => {
        console.log(err);
    });
    // })
    // let visitsResult = []
    // return Promise.all(osAllDocPromises).then(allDocsOfeachOs => {
    //     allDocsOfeachOs.forEach(osVisits => {
    //         visitsResult = visitsResult.concat(osVisits);
    //     })
    //     visitsResult = visitsResult.filter(visitRes => {
    //         return visitRes !== undefined;
    //     })
    //     // const orderedForms = orderFormsByDate(visitsResult);
    //     // return orderedForms.map(doc => {
    //     //     if (isCompressed(doc)) {
    //     //         return expand(visitTemplate, doc)
    //     //     } else {
    //     //         return doc
    //     //     }
    //     // });
    // }).catch(err => {console.log(err)})
    // }).catch(err => {console.log(err)})
}

function uncompressedPrevVisitFromArchive(clientID, visitName) {
    const requestURI = COUCHDB_URI + "/formarchive/_design/archiveFormsDesign/_view/byClientAndName?include_docs=true&key=%5B%22"+encodeURI(clientID)+"%22%2C%22"+encodeURI(visitName)+"%22%5D"
    return axios.get(requestURI,{timeout: 1200000, maxContentLength: 400000000}).then(res => {

        const visitDocs = res.data.rows.filter((row) => {
            return row.doc._id !== this.formID
        }).map((row) => {
            return row.doc
        });

        if (visitDocs.length === 0) {
            return visitDocs;
        } else {
            const orderedForms = orderFormsByDate(visitDocs);
            return orderedForms;
        }
    }).catch( err => {console.log(err)})
}
function isCompressed(visitDoc) {
    return visitDoc.form.contents ? true : false;
}
function getCompressedFormVisitDate(visitDoc) {
    const visitDateQ = visitDoc.form.contents.find((question) => {
        return question.key === 'Visit Date';
    })
    return moment(visitDateQ.value);
}
function getFormVisitDate(visitDoc) {
    const visDateIndex = indexQuestionGroup(visitDoc.form, 'Visit Date');
    const visitDateQ = findFormPartByIndex(visitDoc.form, visDateIndex);
    return moment(visitDateQ.input);
}
function orderFormsByDate(visitDocs) {
    return visitDocs.sort((a, b) => {
        let aDate;
        let bDate;

        if (isCompressed(a)) {
            aDate = getCompressedFormVisitDate(a);
        } else {
            aDate = getFormVisitDate(a);
        }

        if (isCompressed(b)) {
            bDate = getCompressedFormVisitDate(b);
        } else {
            bDate = getFormVisitDate(b);
        }
        if (aDate.isAfter(bDate)) {
            return -1;
        } else if (aDate.isBefore(bDate)) {
            return 1;
        } else {
            return 0;
        }
    })
}
function indexFormPartChildren(formPartChildren, key, index){
    for (const childIndex in formPartChildren) {
        let tempIndex = index;
        tempIndex[tempIndex.length - 1].index = childIndex;
        const temp = indexQuestionGroup(formPartChildren[childIndex], key, tempIndex);
        if (temp) {
            return temp;
        }
    }
    return null;
}
function indexQuestionGroup(fgValue, key, indexc = []) {
    const index = JSON.parse(JSON.stringify(indexc));
    if (fgValue.key === key) {
        return index;
    }

    if (fgValue.tabs) {
        index.push({ type: "tab" });
        return indexFormPartChildren(fgValue.tabs, key, index);
    } else if (fgValue.sections) {
        index.push({ type: "section" });
        return indexFormPartChildren(fgValue.sections, key, index);
    } else if (fgValue.rows && fgValue.type !== "question-array") {
        index.push({ type: "row" });
        return indexFormPartChildren(fgValue.rows, key, index);
    } else if (fgValue.input && fgValue.type === "question-array") {
        index.push({ type: "input" });
        return indexFormPartChildren(fgValue.input, key, index);
        // return this.indexFormPartChildren(fgValue.input[0].rows, key, index);
    } else if (fgValue.columns) {
        index.push({ type: "column" });
        return indexFormPartChildren(fgValue.columns, key, index);
    } else if (fgValue.options) {
        index.push({ type: "option" });
        return indexFormPartChildren(fgValue.options, key, index);
    } else if (fgValue.questions) {
        index.push({ type: "question" });
        return indexFormPartChildren(fgValue.questions, key, index);
    } else {
        return null;
    }
}

function findFormPartByIndex(fgValue, indexc = []) {
    const index = JSON.parse(JSON.stringify(indexc));
    const itype = index[0].type;

    if (itype === "tab") {
        const tabIndex = index.splice(0, 1);
        if (index.length === 0) {
            return fgValue.questions[tabIndex[0].index];
        } else {
            return findFormPartByIndex(fgValue.tabs[tabIndex[0].index], index);
        }
    } else if (itype === "section") {
        const sectIndex = index.splice(0, 1);
        if (index.length === 0) {
            return fgValue.questions[sectIndex[0].index];
        } else {
            return findFormPartByIndex(fgValue.sections[sectIndex[0].index], index);
        }
    } else if (itype === "input") {
        const inputIndex = index.splice(0, 1);
        const rowIndex = index.splice(0, 1);
        if (index.length === 0) {
            return fgValue.questions[inputIndex[0].index];
        } else {
            return findFormPartByIndex(fgValue.input[inputIndex[0].index].rows[rowIndex[0].index], index);
        }
    } else if (itype === "row") {
        const rowIndex = index.splice(0, 1);
        if (index.length === 0) {
            return fgValue.questions[rowIndex[0].index];
        } else {
            return findFormPartByIndex(fgValue.rows[rowIndex[0].index], index);
        }
    } else if (itype === "option") {
        const optIndex = index.splice(0, 1);
        if (index.length === 0) {
            return fgValue.questions[optIndex[0].index];
        } else {
            return findFormPartByIndex(fgValue.options[optIndex[0].index], index);
        }
    } else if (itype === "column") {
        const colIndex = index.splice(0, 1);
        if (index.length === 0) {
            return fgValue.questions[colIndex[0].index];
        } else {
            return findFormPartByIndex(fgValue.columns[colIndex[0].index], index);
        }
    } else if (itype === "question") {
        const queIndex = index.splice(0, 1);
        if (index.length === 0) {
            return fgValue.questions[queIndex[0].index];
        } else {
            return findFormPartByIndex(fgValue.questions[queIndex[0].index], index);
        }
    } else {
        return null;
    }
}

function getClientPreviousForms(clientID) {
    const requestURI = COUCHDB_URI + "/forms/_all_docs?include_docs=true"
    return axios.get(requestURI, {timeout: 1200000, maxContentLength: 400000000}).then(res => {
        const forms = res.data.rows.filter((row) => {
            if (!row || row.id.startsWith('_design')) {
                return false;
            }
            return true;
        }).map((row) => {return row.doc});
                return Promise.all([combineOsVisitsOfCurrentType(VISIT_NAME, clientID), uncompressedPrevVisitFromArchive(clientID, VISIT_NAME)]).then(([activeVisits, archivedVisits]) => {
                    return {active: activeVisits, archived: archivedVisits}
                });
    })
}

(() => {
    getClientPreviousForms(CLIENT_ID).then(visits => {
        const activeDates = visits.active.map(visit => {
            return visit.form.contents.find(q => {return q.key === 'Visit Date'}).value
        });
        const archivedDates = visits.archived.map(visit => {
            return visit.form.contents.find(q => {return q.key === 'Visit Date'}).value
        });

        console.log(archivedDates);
    }).catch();
})()
