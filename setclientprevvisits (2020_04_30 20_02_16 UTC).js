const axios = require('axios')
const fs = require('file-system');
const moment = require('moment');
// const COUCHDB_URI = "http://admin:GBP%40ck3rs%231@localhost:5984";
let EXCLUDE_ID_LIST = require('./updatedfamilies').excludeIDs;
const COUCHDB_URI = "https://admin:wK0mI55ghBU9pp@www.hfatracking.net/couchdb";
const OS_NAME = 'os-amcclanahan';
const FAMILY_ID = '5216';
// const FAMILIES_TO_USE = [
//     "4777",
//     "4758",
//     "4838",
//     "4870",
//     "4892",
//     "4976",
//     "5044",
//     "5129",
//     "5138",
//     "5198",
//     "5026",
//     "4928",
//     "5032",
//     "5005",
//     "3511",
//     "4126",
//     "4903",
//     "5018",
//     "5052",
//     "5089",
//     "5109",
//     "5111",
//     "5150",
//     "5167",
//     "5168",
//     "5185",
//     "3987",
//     "4635",
//     "4767",
//     "5041",
//     "5055",
//     "5097",
//     "5139",
//     "5203",
//     "5204",
//     "5205",
//     "3393",
//     "4982",
//     "5045",
//     "5046",
//     "5054",
//     "5100",
//     "5133",
//     "5134",
//     "5160",
//     "5164",
//     "5180",
//     "5187",
//     "5194",
//     "4126",
//     "5199",
//     "8299",
//     "4972",
//     "4426",
//     "5047",
//     "5175",
//     "5176",
//     "5179",
//     "5186",
//     "5195",
//     "5196",
//     "40841",
//     "3017",
//     "4604",
//     "4768",
//     "4894",
//     "4993",
//     "5013",
//     "5069",
//     "5079",
//     "5086",
//     "5096",
//     "5131",
//     "5140",
//     "5170",
//     "5172",
//     "5183",
//     "4888",
//     "4934",
//     "5034",
//     "5039",
//     "5118",
//     "5121",
//     "5122",
//     "5124",
//     "5142",
//     "5163",
//     "5169",
//     "5173",
//     "5184",
//     "5188",
//     "5192",
//     "5193",
//     "5057",
//     "5058",
//     "5061",
//     "5062",
//     "5065",
//     "5083",
//     "5084",
//     "5110",
//     "5125",
//     "5128",
//     "5146",
//     "5103",
//     "5148",
//     "5155",
//     "5157",
//     "5161",
//     "5182",
//     "5191",
//     "5200"
// ]
const FAMILIES_TO_USE = [
    FAMILY_ID
]
async function families() {
    const requestURI = COUCHDB_URI + "/families/_all_docs?include_docs=true";

    const response = await axios.get(requestURI);
    return response.data.rows.filter(row => {
        if(!row || row.id.startsWith('_design')) {
            return false;
        }

        if (EXCLUDE_ID_LIST.indexOf(row.id) < 0) {
            return true;
        }

        return false;
    }).filter(row => {
        return FAMILIES_TO_USE.indexOf(row.id) >= 0;
    }).map(row => {return row.doc});
}

function writeNewExcludeList(excludeList) {
    const jsonContent = JSON.stringify({excludeIDs: excludeList});
    try {
        fs.writeFileSync('updatedfamilies.json', jsonContent);
        console.log("DONE WRITING NEW EXCLUDE LIST");
    } catch(e) {
        console.log(e);
    }

}
function osNames() {
    const requestURI = COUCHDB_URI + "/_users/_all_docs?include_docs=true";
    return axios.get(requestURI).then(res => {
        return res.data.rows.filter((row) => {
            return row.doc._id.startsWith("org.couchdb.user:") && row.doc.roles.indexOf("OS") > -1
        }).map((row)=> {
            return row.doc.name
        })
    }).catch(err => {throw err});
}
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
function combineOsVisitsOfCurrentType(visitName, visitTemplate, clientID) {
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
                return orderedForms.map(doc => {
                    if (isCompressed(doc)) {
                        return expand(visitTemplate, doc)
                    } else {
                        return doc
                    }
                });
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

function uncompressedPrevVisitFromArchive(clientID, visitName, visitTemplate) {
    const requestURI = COUCHDB_URI + "/formarchive/_design/archiveFormsDesign/_view/byClientAndName?include_docs=true&key=%5B%22"+encodeURI(clientID)+"%22%2C%22"+encodeURI(visitName)+"%22%5D"
    return axios.get(requestURI,{timeout: 1200000, maxContentLength: 400000000}).then(res => {

            const visitDocs = res.data.rows.filter((row) => {
                return row.doc._id !== this.formID
            }).map((row) => {
                return row.doc
            });

            if (visitDocs.length === 0) {
                return null;
            } else {
                const orderedForms = orderFormsByDate(visitDocs);
                if (isCompressed(orderedForms[orderedForms.length - 1])) {
                    return expand(visitTemplate, orderedForms[orderedForms.length - 1])
                } else {
                    return orderedForms[orderedForms.length - 1]
                }
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
            return 1;
        } else if (aDate.isBefore(bDate)) {
            return -1;
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
        const prevVisitPromises = [];
        const prevVisitsObj = {};
        forms.forEach((form) => {
            prevVisitPromises.push(
                Promise.all([combineOsVisitsOfCurrentType(form.form.name, form, clientID), uncompressedPrevVisitFromArchive(clientID, form.form.name, form)]).then(([activeVisits, archivedVisit]) => {
                    if (activeVisits && activeVisits.length > 0) {
                        const index = indexQuestionGroup(activeVisits[0].form, 'Visit Date');
                        const q = findFormPartByIndex(activeVisits[0].form, index);
                        console.log("ACTIVE FORM DATE: ", q.input);
                        const activeDate = moment(q.input);
                        let archivedDate;
                        if (archivedVisit) {
                            const index = indexQuestionGroup(archivedVisit.form, 'Visit Date');
                            const q = findFormPartByIndex(archivedVisit.form, index);
                            archivedDate = moment(q.input);
                            console.log("ARCHIVED FORM DATE: ", q.input);

                            if (activeDate.isSameOrAfter(archivedDate) || q.input === null) {
                                prevVisitsObj[form.form.name] = activeVisits[0];
                            } else {
                                prevVisitsObj[form.form.name] = archivedVisit;
                            }
                        } else {
                            prevVisitsObj[form.form.name] = activeVisits[0];
                        }

                    } else if (archivedVisit) {
                        console.log(archivedVisit._id);
                        prevVisitsObj[form.form.name] = archivedVisit
                    } else {
                        prevVisitsObj[form.form.name] = null;
                    }

                })
            )
        });

        return Promise.all(prevVisitPromises).then(() => {
            return prevVisitsObj;
        })
    })
}
function putPrevVisitsToAdult(adult) {
    console.log("Putting Visits For: ", adult.clientID);
    return Promise.all([getClientPreviousForms(adult.clientID)]).then(([prevVisitsByType]) => {
        adult.previousVisits = prevVisitsByType;
        return true;
    }).catch(err => {throw err});
}
function putPrevVisitsToChild(child) {
    console.log("Putting Visits For: ", child.clientID);
    console.log
    return Promise.all([getClientPreviousForms(child.clientID)]).then(([prevVisitsByType]) => {
        child.previousVisits = prevVisitsByType;
        return true;
    }).catch(err => {throw err});
}
function addPrevVisitsToFamily(family) {
    const adultPromises = [];
    const childPromises = [];
    for (const adult in family.adult) {
        adultPromises.push(putPrevVisitsToAdult(family.adult[adult]));
    }
    for (const child in family.child) {
        childPromises.push(putPrevVisitsToChild(family.child[child]));
    }
    return Promise.all(adultPromises.concat(childPromises)).then(([reses]) => {
        return reses;
    })
}
(() => {
   families().then(families => {
       const promises = [];
       // const familyBatch = families.splice(0, 5);
       // EXCLUDE_ID_LIST = EXCLUDE_ID_LIST.concat(familyBatch.map(family => {return family._id}));
       // familyBatch.forEach(family => {promises.push(addPrevVisitsToFamily(family))});
       const useFamily = families.find(family => {return family._id === FAMILY_ID});
       console.log("Updating Family: ", useFamily._id);
       promises.push(addPrevVisitsToFamily(useFamily));
       //console.log(promises.length);
       Promise.all(promises).then(([useFamilyRes]) => {
           let combinedRes = [];
           if (useFamilyRes) {
               const requestURI = COUCHDB_URI + "/families/_bulk_docs"
               axios.post(requestURI, {docs: [useFamily]}, {maxContentLength: 4100000000, timeout: 1200000}).then((res) => {
                   EXCLUDE_ID_LIST.push(FAMILY_ID);
                   // writeNewExcludeList(EXCLUDE_ID_LIST);
               }).catch(err => console.log(err));
           }
       });
   });
})()
