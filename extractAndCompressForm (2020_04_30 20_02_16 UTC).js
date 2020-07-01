const fs = require('file-system');
const expanded = require('./expanded');
const template = require('./adulttemplate')

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

function compress(form, compressedForm = {}) {
    if (Object.keys(compressedForm).length === 0) {
        for (const prop in form) {
            if (prop !== "tabs") {
                compressedForm[prop] = form[prop];
            }
        }
        compressedForm.contents = [];
    }
    if (form.tabs) {
        for (const tabControl of form.tabs) {
            compress(tabControl, compressedForm);
        }
    } else if (form.sections) {
        for (const sectionControl of form.sections) {
            compress(sectionControl, compressedForm);
        }
    } else if (form.rows && form.type === "question-array") {
        // (form as form).addControl('initialLoad', new FormControl(true));

        for (const inputControl of form.controls.input.controls) {
            for (const rowControl of inputControl.rows) {
                compress(rowControl, compressedForm);
            }
        }
    } else if (form.rows && form.type !== "question-array") {
        for (const rowControl of form.rows) {
            compress(rowControl, compressedForm);
        }
    } else if (form.columns) {
        for (const columnControl of form.columns) {

            compress(columnControl, compressedForm);
        }
    } else if (form.options) {
        for (const optionControl of form.options) {
            compress(optionControl, compressedForm);
        }
    } else if (form.questions) {
        form.questions.forEach((question) => {
            if (question.key === "Income") {
                let compressValue;
                if (question.indices.yearly && question.indices.yearly !== "") {
                    compressValue = `yearly ${question.indices.yearly}`;
                } else if (question.indices.monthly && question.indices.monthly !== "") {
                    compressValue = `monthly ${question.indices.monthly}`;
                } else if (question.indices.weekly && question.indices.weekly !== "") {
                    compressValue = `weekly ${question.indices.weekly}`;
                } else {
                    compressValue = "";
                }
                compressedForm.contents.push({
                    key: question.key,
                    value: compressValue,
                    notes: question.notes || [],
                    usePreviousValue: question.usePreviousValue
                });
            } else {
                compressedForm.contents.push({
                    key: question.key,
                    value: question.input,
                    notes: question.notes || [],
                    usePreviousValue: question.usePreviousValue
                });
            }
            if (question.options) {
                for (const optionControl of question.options) {
                    if (optionControl.rows.length > 0) {
                        compress(optionControl, compressedForm);
                    }
                }
            } else if (question.rows && question.type === "question-array") {
                for (const inputControl of question.input) {
                    for (const rowControl of inputControl.rows) {
                        compress(rowControl, compressedForm);
                    }
                }
            } else if (question.rows && question.type !== "question-array") {
                for (const rowControl of question.rows) {
                    compress(rowControl, compressedForm);
                }
            }
        });
    }
    return compressedForm;
}

expanded.form = compress(expanded.form);
console.log(expanded)
fs.writeFileSync('compressed.json', JSON.stringify(expanded));
