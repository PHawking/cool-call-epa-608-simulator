"use strict";

const { chromium } = require("playwright");

const url = process.env.COOL_CALL_URL || "file:///D:/CodeX/AC_Repair_Game/index.html";
const groups = ["core", "type1", "type2", "type3"];

async function answerBankQuestion(page) {
  await page.waitForSelector("#quizDialog[open]");
  const question = await page.evaluate(() => {
    const text = document.getElementById("quizQuestion").textContent;
    const question = Object.values(window.EPA_QUESTION_BANKS).flat().find(item => item.question === text);
    if (!question) throw new Error(`Question not found in bank: ${text}`);
    return { answers:question.answers, multiple:question.multiple };
  });
  for (const answer of question.answers) await page.click(`#quizChoices [data-i="${answer}"]`);
  if (question.multiple) await page.click("#quizSubmit");
  await page.click("#quizContinue");
}

async function verifyMultiAnswerFlow(page) {
  const question = await page.evaluate(() => Object.values(window.EPA_QUESTION_BANKS).flat().find(item => item.multiple && item.answers.length > 1));
  if (!question) throw new Error("No multi-answer question with at least two correct choices was found");

  await page.evaluate(item => {
    window.multiAnswerResult = null;
    window.CoolCall.openChoiceDialog(item, correct => { window.multiAnswerResult = correct; }, "MULTI-ANSWER TEST");
  }, question);
  await page.click(`#quizChoices [data-i="${question.answers[0]}"]`);
  const beforeSubmit = await page.evaluate(() => ({
    feedbackHidden:document.getElementById("quizFeedback").hidden,
    continueHidden:document.getElementById("quizContinue").hidden,
    submitHidden:document.getElementById("quizSubmit").hidden,
    checkboxCount:document.querySelectorAll("#quizChoices input[type=checkbox]").length
  }));
  if (!beforeSubmit.feedbackHidden || !beforeSubmit.continueHidden || beforeSubmit.submitHidden || beforeSubmit.checkboxCount !== question.choices.length) {
    throw new Error(`Multi-answer question was graded before Submit: ${JSON.stringify(beforeSubmit)}`);
  }
  await page.click("#quizSubmit");
  if (!(await page.locator("#quizFeedback").textContent()).startsWith("Not quite.")) throw new Error("A partial multi-answer selection was accepted");
  await page.click("#quizContinue");
  if (await page.evaluate(() => window.multiAnswerResult) !== false) throw new Error("Partial multi-answer callback was not false");

  await page.evaluate(item => {
    window.multiAnswerResult = null;
    window.CoolCall.openChoiceDialog(item, correct => { window.multiAnswerResult = correct; }, "MULTI-ANSWER TEST");
  }, question);
  for (const answer of question.answers) await page.click(`#quizChoices [data-i="${answer}"]`);
  await page.click("#quizSubmit");
  if (!(await page.locator("#quizFeedback").textContent()).startsWith("Correct.")) throw new Error("The complete multi-answer selection was rejected");
  await page.click("#quizContinue");
  if (await page.evaluate(() => window.multiAnswerResult) !== true) throw new Error("Complete multi-answer callback was not true");
}

async function chooseScenarioAnswer(page, field) {
  await page.waitForSelector("#quizDialog[open]");
  const answer = await page.evaluate(key => window.CoolCall.state.scenario.focus[key], field);
  const buttons = page.locator("#quizChoices .quiz-choice");
  const count = await buttons.count();
  for (let index = 0; index < count; index++) {
    const text = await buttons.nth(index).textContent();
    if (text.includes(answer)) {
      await buttons.nth(index).click();
      await page.click("#quizContinue");
      return;
    }
  }
  throw new Error(`Correct ${field} choice not found: ${answer}`);
}

async function completeCall(page, group) {
  await page.selectOption("#certificationGroup", group);
  const optionCount = await page.locator("#scenarioSelect option").count();
  if (optionCount !== 20) throw new Error(`${group} has ${optionCount} scenarios instead of 20`);
  await page.selectOption("#scenarioSelect", "19");
  await page.click("#startButton");
  const expectedTitle = await page.evaluate(() => window.CoolCall.state.scenario.title);
  await page.click('[data-scene="truck"]');
  await page.click('[data-action="ppe"]');
  await page.click('[data-scene="customer"]');
  await page.click('[data-action="interview"]');
  await page.click('[data-action="identify"]');
  await answerBankQuestion(page);
  await page.click('[data-scene="indoor"]');
  await page.click('[data-action="inspect"]');
  await answerBankQuestion(page);
  await page.click('[data-scene="outdoor"]');
  await page.click('[data-action="measure"]');
  await answerBankQuestion(page);
  await page.click('[data-action="confirm"]');
  await answerBankQuestion(page);
  await page.click('[data-action="diagnose"]');
  await chooseScenarioAnswer(page, "diagnosis");
  await page.click('[data-action="repair"]');
  await chooseScenarioAnswer(page, "repair");
  await page.waitForSelector("#resultDialog[open]");
  const result = await page.locator("#resultText").textContent();
  if (!result.includes(expectedTitle)) throw new Error(`${group} result does not name its scenario`);
  await page.click("#resultButton");
}

(async () => {
  const browser = await chromium.launch({ headless:true, executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe" });
  const failures = [];
  const page = await browser.newPage({ viewport:{ width:1365, height:900 } });
  page.on("console", message => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  page.on("pageerror", error => failures.push(`page: ${error.message}`));
  page.on("response", response => { if (response.status() >= 400) failures.push(`HTTP ${response.status()}: ${response.url()}`); });
  await page.goto(url, { waitUntil:"load" });
  await page.click("#soundButton");
  await page.waitForTimeout(350);
  const musicOn = await page.evaluate(() => ({
    enabled:window.CoolCall.audioState.enabled,
    running:Boolean(window.CoolCall.audioState.musicTimer),
    contextState:window.CoolCall.audioState.context?.state,
    contextTime:window.CoolCall.audioState.context?.currentTime,
    tonesStarted:window.CoolCall.audioState.tonesStarted,
    error:window.CoolCall.audioState.lastError,
    label:document.getElementById("soundButton").getAttribute("aria-label")
  }));
  if (!musicOn.enabled || !musicOn.running || musicOn.contextState !== "running" || musicOn.contextTime <= 0 || musicOn.tonesStarted < 2 || musicOn.error || !musicOn.label.includes("off")) {
    failures.push(`Sound-on state did not produce active audio: ${JSON.stringify(musicOn)}`);
  }
  await page.click("#soundButton");
  await page.waitForTimeout(50);
  const musicOff = await page.evaluate(() => ({ enabled:window.CoolCall.audioState.enabled, running:Boolean(window.CoolCall.audioState.musicTimer), contextState:window.CoolCall.audioState.context?.state }));
  if (musicOff.enabled || musicOff.running || musicOff.contextState !== "suspended") failures.push(`Sound-off state did not stop audio: ${JSON.stringify(musicOff)}`);
  const curriculumCheck = await page.evaluate(() => {
    const repetition = Object.fromEntries(Object.entries(window.COOL_CALL_CURRICULUM.scenarios).map(([group, scenarios]) => {
      const counts = scenarios.reduce((result, scenario) => ({ ...result, [scenario.focus.name]:(result[scenario.focus.name] || 0) + 1 }), {});
      return [group, Object.values(counts).every(count => count === 2)];
    }));
    const missed = window.EPA_QUESTION_BANKS.type3.at(-1);
    window.CoolCall.state.mastery[missed.id] = { seen:1, correct:0, lastCorrect:false };
    const reinforcement = window.CoolCall.selectScenarioQuestions("type3").some(question => question.id === missed.id);
    delete window.CoolCall.state.mastery[missed.id];
    return { repetition, reinforcement };
  });
  if (!Object.values(curriculumCheck.repetition).every(Boolean)) failures.push("A scenario focus is not repeated exactly twice in its group");
  if (!curriculumCheck.reinforcement) failures.push("A missed question was not prioritized for reinforcement");
  await verifyMultiAnswerFlow(page);
  for (const group of groups) await completeCall(page, group);
  const counts = await page.evaluate(() => Object.fromEntries(Object.entries(window.COOL_CALL_CURRICULUM.scenarios).map(([group, scenarios]) => [group, scenarios.length])));
  console.log(JSON.stringify({ url, counts, music:{ on:musicOn, off:musicOff }, curriculumCheck, multiAnswerFlow:true, fullCallsCompleted:groups.length }));
  await page.close();

  const phone = await browser.newPage({ viewport:{ width:390, height:844 } });
  phone.on("console", message => { if (message.type() === "error") failures.push(`phone console: ${message.text()}`); });
  phone.on("pageerror", error => failures.push(`phone page: ${error.message}`));
  await phone.goto(url, { waitUntil:"load" });
  await phone.selectOption("#certificationGroup", "type3");
  const pickerBox = await phone.locator(".dispatch-picker").boundingBox();
  await phone.click("#startButton");
  const playWidth = await phone.locator("#playScreen").evaluate(element => element.scrollWidth);
  console.log(JSON.stringify({ phone:{ pickerBox, playWidth, viewportWidth:390 } }));
  if (playWidth > 390) failures.push(`phone layout overflows horizontally: ${playWidth}px`);
  await phone.close();
  await browser.close();
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
})();
