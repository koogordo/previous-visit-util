const axios = require('axios')
const fs = require('file-system');
const moment = require('moment');
const pouchCollate = require('pouchdb-collate');
const visitName = 'Adult Visit';
const clientID = '545026%004adult%0040%00%00';
const COUCHDB_URI = "https://admin:wK0mI55ghBU9pp@www.hfatracking.net/couchdb";
const requestURI = COUCHDB_URI + "/formarchive/_design/archiveFormsDesign/_view/byClientAndName?include_docs=true&key=%5B%22"+encodeURI(clientID)+"%22%2C%22"+encodeURI(visitName)+"%22%5D"
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
        } else if (bDate.isAfter(aDate)) {
            return 1;
        } else {
            return 0;
        }
    })
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
axios.get(requestURI,{timeout: 1200000, maxContentLength: 400000000}).then(res => {
    // PUSH NEW VISITS INTO HERE
    const newDocs = [];
    const visitDocs = res.data.rows.map((row) => {
        return row.doc
    });
    visitDocs.forEach(doc => {
        const date = doc.form.contents.find(q => {return q.key === 'Visit Date'})
        console.log(date.value);
    });
}).catch( err => {console.log(err)});
