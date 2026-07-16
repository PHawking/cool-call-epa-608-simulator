"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sources = {
  core: "EPA608_Core_Questions.md",
  type1: "EPA608_Type1_Questions.md",
  type2: "EPA608_Type2_Questions.md",
  type3: "EPA608_TYPE3_Questions.md"
};

function clean(value) {
  return value
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function key(value) {
  return clean(value)
    .toLowerCase()
    .replace(/^[a-d][.)]\s*/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function section(block, heading, nextHeading) {
  const start = block.indexOf(`**${heading}**`);
  if (start < 0) return "";
  const from = start + heading.length + 4;
  const end = nextHeading ? block.indexOf(`**${nextHeading}**`, from) : block.length;
  return block.slice(from, end < 0 ? block.length : end).trim();
}

function parseChoices(raw) {
  const choices = [];
  let active = null;
  for (const sourceLine of raw.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line) continue;
    const match = line.match(/^([A-D])[.)]\s*(.*)$/i);
    if (match) {
      active = { letter: match[1].toUpperCase(), text: match[2] };
      choices.push(active);
    } else if (active) {
      active.text += ` ${line}`;
    }
  }
  return choices.map(choice => clean(choice.text));
}

function answerIndex(correct, choices) {
  const normalized = key(correct);
  let index = choices.findIndex(choice => key(choice) === normalized);
  if (index >= 0) return index;
  index = choices.findIndex(choice => key(choice).replace(/\s/g, "") === normalized.replace(/\s/g, ""));
  if (index >= 0) return index;
  index = choices.findIndex(choice => key(choice).includes(normalized) || normalized.includes(key(choice)));
  if (index >= 0) return index;
  const letter = clean(correct).match(/^([A-D])[.)]?\s*$/i);
  if (letter) return letter[1].toUpperCase().charCodeAt(0) - 65;
  if (/all of these are true/i.test(correct)) {
    index = choices.findIndex(choice => /none of (these|the above)/i.test(choice));
    if (index >= 0) return index;
  }
  const targetTokens = new Set(normalized.split(" "));
  const scores = choices.map(choice => {
    const candidateTokens = new Set(key(choice).split(" "));
    const shared = [...targetTokens].filter(token => candidateTokens.has(token)).length;
    return (2 * shared) / (targetTokens.size + candidateTokens.size);
  });
  const best = Math.max(...scores);
  return best >= 0.72 ? scores.indexOf(best) : -1;
}

function answerIndices(correct, choices, multiple) {
  if (!multiple) return [answerIndex(correct, choices)].filter(index => index >= 0);

  const explicitLetters = clean(correct).match(/^([A-D](?:\s*(?:&|,|and)\s*[A-D])+)[.)]?$/i);
  if (explicitLetters) {
    return [...new Set(explicitLetters[1].toUpperCase().match(/[A-D]/g).map(letter => letter.charCodeAt(0) - 65))];
  }

  const matchedSegments = clean(correct)
    .split(/\s*,\s*/)
    .map(segment => answerIndex(segment, choices))
    .filter(index => index >= 0);
  if (matchedSegments.length > 1) return [...new Set(matchedSegments)];

  const normalized = key(correct);
  const contained = choices
    .map((choice, index) => ({ index, value: key(choice) }))
    .filter(choice => choice.value && (normalized.includes(choice.value) || normalized.replace(/\s/g, "").includes(choice.value.replace(/\s/g, ""))))
    .map(choice => choice.index);
  return [...new Set(contained.length ? contained : matchedSegments)];
}

function parseBank(group, filename) {
  const markdown = fs.readFileSync(path.join(root, filename), "utf8");
  const blocks = markdown.split(/^## Question.*$/gmi).slice(1);
  const parsed = [];
  const rejected = [];
  for (const [sourceIndex, block] of blocks.entries()) {
    const question = clean(section(block, "Question", "Answer choices"));
    let choices = parseChoices(section(block, "Answer choices", "Correct Answer"));
    const correct = clean(section(block, "Correct Answer", "Explanation"));
    if (!choices.length && /^(true|false)$/i.test(correct)) choices = ["True", "False"];
    const explanation = clean(section(block, "Explanation"));
    const multiple = /(select all that apply|choose all that apply|select two)/i.test(question);
    const answers = answerIndices(correct, choices, multiple);
    if (!question || choices.length < 2 || !answers.length || answers.some(answer => answer < 0 || answer >= choices.length)) {
      rejected.push({ sourceIndex: sourceIndex + 1, question, choices, correct });
      continue;
    }
    parsed.push({
      id: `${group}-${String(sourceIndex + 1).padStart(3, "0")}`,
      group,
      question,
      choices,
      answer: answers[0],
      answers,
      multiple,
      explanation
    });
  }

  const unique = [];
  const seen = new Set();
  for (const question of parsed) {
    const normalized = key(question.question);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(question);
  }

  return { totalBlocks: blocks.length, parsed: parsed.length, rejected, duplicates: parsed.length - unique.length, questions: unique };
}

const result = {};
const report = {};
for (const [group, filename] of Object.entries(sources)) {
  const bank = parseBank(group, filename);
  result[group] = bank.questions;
  report[group] = {
    blocks: bank.totalBlocks,
    usable: bank.questions.length,
    multipleAnswer: bank.questions.filter(question => question.multiple).length,
    duplicatesRemoved: bank.duplicates,
    rejected: bank.rejected.length,
    rejectedItems: bank.rejected
  };
}

const banner = "// Generated by scripts/build-question-banks.js. Edit the Markdown sources, then rebuild.\n";
fs.writeFileSync(
  path.join(root, "question-banks.js"),
  `${banner}window.EPA_QUESTION_BANKS=${JSON.stringify(result)};\n`,
  "utf8"
);
fs.writeFileSync(path.join(root, "question-bank-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

for (const [group, stats] of Object.entries(report)) {
  console.log(`${group}: ${stats.usable} usable / ${stats.blocks} blocks; ${stats.multipleAnswer} multi-answer; ${stats.duplicatesRemoved} duplicates; ${stats.rejected} rejected`);
}
