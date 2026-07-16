"use strict";

global.window = {};
require("../question-banks.js");

const banks = window.EPA_QUESTION_BANKS;
const failures = [];
const multiMarker = /(select all that apply|choose all that apply|select two)/i;
const ocrPatterns = [
  /\bAscrap\b/i, /\bQAll\b/, /\bcompieted\b/i, /\brefrigerent\b/i,
  /\bO psig\b/, /\bIb\b/, /\bAdda\b/, /\bAsteady\b/, /\bItreduces\b/,
  /\bToremove\b/, /\bTokeep\b/, /\bAhouse\b/, /\bStand ard\b/i, /\bnon- condensables\b/i,
  /\b5psig\b/i, /\bHg i\b/,
  /\btemperature pf\b/i, /\bmand atory\b/i, /correctly selected/i
];

for (const [group, questions] of Object.entries(banks)) {
  for (const question of questions) {
    const prefix = `${group}/${question.id}`;
    const answers = question.answers || [question.answer];
    if (multiMarker.test(question.question) !== Boolean(question.multiple)) failures.push(`${prefix}: multi-answer marker/schema mismatch`);
    if (!answers.length || new Set(answers).size !== answers.length) failures.push(`${prefix}: missing or duplicate answer indices`);
    if (answers.some(index => !Number.isInteger(index) || index < 0 || index >= question.choices.length)) failures.push(`${prefix}: answer index is outside the choice list`);
    if (question.answer !== answers[0]) failures.push(`${prefix}: legacy answer does not match answers[0]`);
    const content = [question.question, ...question.choices, question.explanation].join("\n");
    for (const pattern of ocrPatterns) if (pattern.test(content)) failures.push(`${prefix}: suspicious OCR text ${pattern}`);
  }
}

const summary = Object.fromEntries(Object.entries(banks).map(([group, questions]) => [group, {
  questions:questions.length,
  multiple:questions.filter(question => question.multiple).length
}]));

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify(summary));
