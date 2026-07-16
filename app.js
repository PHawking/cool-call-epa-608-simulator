"use strict";

const curriculum = window.COOL_CALL_CURRICULUM;
const questionBanks = window.EPA_QUESTION_BANKS;
if (!curriculum || !questionBanks) throw new Error("Cool Call curriculum files did not load.");

const TASK_IDS = ["intake", "identify", "safety", "inspect", "procedure", "diagnose", "repair"];
const $ = id => document.getElementById(id);
const els = {
  briefing: $("briefingPanel"), play: $("playScreen"), taskList: $("taskList"), actionGrid: $("actionGrid"),
  actionHeading: $("actionHeading"), scene: $("scene"), sceneLabel: $("sceneLabel"), mentorFeed: $("mentorFeed"),
  timer: $("timer"), quiz: $("quizDialog"), notes: $("notesDialog"), result: $("resultDialog")
};

function loadNumber(key, fallback=0) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  } catch { return fallback; }
}

function loadObject(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}"); }
  catch { return {}; }
}

function saveValue(key, value) {
  try { localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)); }
  catch { /* Storage can be blocked in embedded previews. */ }
}

const state = {
  mode: "guide", group: "core", scenarioIndex: 0, scenario: null, actions: {}, questions: [], scene: "customer",
  completed: new Set(), notes: [], scores: { safety: 100, accuracy: 100, efficiency: 100 }, seconds: 0,
  started: false, xp: loadNumber("coolcall-xp"), mastery: loadObject("coolcall-question-mastery"), quizCallback: null
};
const audioState = { enabled: false, context: null, musicTimer: null, musicStartTimer: null, musicStep: 0 };
const MUSIC_STEP_MS = 190;
// Original major-key chiptune written for Cool Call; intentionally not based on a recognizable song.
const MUSIC_MELODY = [
  1046.5,659.25,783.99,880,783.99,659.25,587.33,659.25,
  783.99,0,880,783.99,659.25,587.33,523.25,0,
  659.25,783.99,987.77,880,783.99,659.25,587.33,783.99,
  1046.5,987.77,880,783.99,659.25,587.33,523.25,0
];
const MUSIC_BASS = [261.63,261.63,349.23,392,261.63,349.23,392,392];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[character]);
}

function audioContext() {
  if (audioState.context) return audioState.context;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  audioState.context = new AudioContext();
  return audioState.context;
}

function tone(frequency, duration=.08, delay=0, type="sine", volume=.035) {
  if (!audioState.enabled) return;
  const context = audioContext();
  if (!context) return;
  if (context.state === "suspended") context.resume();
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .01);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .02);
}

function playSound(kind="click") {
  const patterns = {
    click: [[440,.05,0,"sine",.025]], good: [[523,.08,0],[659,.11,.07]],
    warning: [[230,.13,0,"triangle",.035]], complete: [[523,.1,0],[659,.1,.09],[784,.18,.18]]
  };
  (patterns[kind] || patterns.click).forEach(notes => tone(...notes));
}

function musicTick() {
  if (!audioState.enabled || document.hidden) return;
  const step = audioState.musicStep % MUSIC_MELODY.length;
  const melody = MUSIC_MELODY[step];
  if (melody) tone(melody, .14, 0, "square", .011);
  if (step % 4 === 0) {
    const bass = MUSIC_BASS[Math.floor(step / 4) % MUSIC_BASS.length];
    tone(bass, .22, 0, "triangle", .009);
  }
  audioState.musicStep = (step + 1) % MUSIC_MELODY.length;
}

function startMusic() {
  if (!audioState.enabled || document.hidden || audioState.musicTimer) return;
  musicTick();
  audioState.musicTimer = window.setInterval(musicTick, MUSIC_STEP_MS);
}

function stopMusic(reset=true) {
  if (audioState.musicStartTimer) window.clearTimeout(audioState.musicStartTimer);
  if (audioState.musicTimer) window.clearInterval(audioState.musicTimer);
  audioState.musicStartTimer = null;
  audioState.musicTimer = null;
  if (reset) audioState.musicStep = 0;
}

function queueMusicStart() {
  if (audioState.musicStartTimer) window.clearTimeout(audioState.musicStartTimer);
  audioState.musicStartTimer = window.setTimeout(() => {
    audioState.musicStartTimer = null;
    startMusic();
  }, 240);
}

function renderSoundButton() {
  const button = $("soundButton");
  button.textContent = audioState.enabled ? "🔊" : "🔇";
  button.setAttribute("aria-pressed", String(audioState.enabled));
  button.setAttribute("aria-label", audioState.enabled ? "Turn sound and music off" : "Turn sound and music on");
  button.title = audioState.enabled ? "Sound and music on" : "Sound and music off";
}

function toggleSound() {
  audioState.enabled = !audioState.enabled;
  renderSoundButton();
  if (audioState.enabled) {
    playSound("good");
    queueMusicStart();
  } else stopMusic();
}

function openModal(dialog) {
  if (!dialog || dialog.open) return;
  try {
    if (typeof dialog.showModal === "function") { dialog.showModal(); return; }
  } catch { /* Embedded previews can expose dialog without allowing showModal. */ }
  dialog.setAttribute("open", "");
  dialog.classList.add("dialog-fallback");
  document.body.classList.add("dialog-open");
}

function closeModal(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === "function") {
    try { dialog.close(); } catch { dialog.removeAttribute("open"); }
  } else dialog.removeAttribute("open");
  dialog.classList.remove("dialog-fallback");
  if (!document.querySelector(".dialog-fallback[open]")) document.body.classList.remove("dialog-open");
}

function renderCareer() {
  const ranks = [[0,"APPRENTICE"],[100,"JUNIOR TECH"],[250,"EPA CERTIFIED"],[500,"SENIOR TECH"]];
  const rank = [...ranks].reverse().find(([minimum]) => state.xp >= minimum);
  const next = ranks.find(([minimum]) => minimum > state.xp) || [750,"MASTER TECH"];
  $("rankLabel").textContent = rank[1];
  $("xpLabel").textContent = `${state.xp} / ${next[0]} XP`;
  $("xpBar").style.width = `${Math.min(100, ((state.xp - rank[0]) / (next[0] - rank[0])) * 100)}%`;
}

function shuffled(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function masteryFor(id) {
  return state.mastery[id] || { seen: 0, correct: 0 };
}

function masteryStatus(progress) {
  if (!progress.seen) return 1;
  const lastCorrect = progress.lastCorrect ?? progress.seen === progress.correct;
  return lastCorrect ? 2 : 0;
}

function pickQuestions(bank, count, excluded=new Set()) {
  return shuffled(bank.filter(question => !excluded.has(question.id)))
    .sort((left, right) => {
      const a = masteryFor(left.id), b = masteryFor(right.id);
      return masteryStatus(a) - masteryStatus(b) || a.seen - b.seen || a.correct - b.correct;
    })
    .slice(0, count);
}

function selectScenarioQuestions(group) {
  if (group === "core") return pickQuestions(questionBanks.core, 4);
  const selected = pickQuestions(questionBanks[group], 3);
  const excluded = new Set(selected.map(question => question.id));
  return [...selected, ...pickQuestions(questionBanks.core, 1, excluded)];
}

function recordQuestion(question, correct) {
  const progress = masteryFor(question.id);
  state.mastery[question.id] = { seen: progress.seen + 1, correct: progress.correct + (correct ? 1 : 0), lastCorrect: correct };
  saveValue("coolcall-question-mastery", state.mastery);
}

function groupMastery(group) {
  const bank = questionBanks[group];
  const mastered = bank.filter(question => {
    const progress = masteryFor(question.id);
    return progress.seen > 0 && (progress.lastCorrect ?? progress.seen === progress.correct);
  }).length;
  return { mastered, total: bank.length };
}

function renderScenarioOptions() {
  const group = $("certificationGroup").value;
  const scenarios = curriculum.scenarios[group];
  $("scenarioSelect").innerHTML = scenarios.map((scenario, index) => `<option value="${index}">${String(index + 1).padStart(2,"0")} · ${escapeHtml(scenario.title)}</option>`).join("");
  state.group = group;
  state.scenarioIndex = 0;
  updateBriefing();
}

function updateBriefing() {
  const group = $("certificationGroup").value;
  const scenarioIndex = Number($("scenarioSelect").value || 0);
  const scenario = curriculum.scenarios[group][scenarioIndex];
  const progress = groupMastery(group);
  state.group = group;
  state.scenarioIndex = scenarioIndex;
  $("briefingEyebrow").textContent = `${curriculum.groups[group].label.toUpperCase()} · CALL ${String(scenarioIndex + 1).padStart(2,"0")} OF ${curriculum.scenarios[group].length}`;
  $("briefingTitle").textContent = scenario.title;
  $("briefingDescription").textContent = `${scenario.site}: ${scenario.complaint} Diagnose and complete the call using ${curriculum.groups[group].name} practices.`;
  $("systemTags").innerHTML = scenario.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("");
  $("scenarioSummary").textContent = `${curriculum.scenarios[group].length} scenarios · ${questionBanks[group].length} unique questions · ${progress.mastered} mastered`;
}

function randomScenario() {
  const select = $("scenarioSelect");
  const count = select.options.length;
  let next = Math.floor(Math.random() * count);
  if (count > 1 && next === Number(select.value)) next = (next + 1) % count;
  select.value = String(next);
  updateBriefing();
  playSound("click");
}

function currentTasks() {
  return curriculum.groups[state.group].tasks.map((label, index) => ({ id: TASK_IDS[index], label }));
}

function renderTasks() {
  els.taskList.innerHTML = currentTasks().map((task, index) => `<li data-step="${index + 1}" class="${state.completed.has(task.id) ? "done" : ""}">${escapeHtml(task.label)}</li>`).join("");
}

function actionNames(group) {
  if (group === "core") return { inspect:"Review service conditions", measure:"Check rule & equipment", confirm:"Verify compliant plan", location:"Service area" };
  if (group === "type1") return { inspect:"Inspect sealed system", measure:"Perform recovery checks", confirm:"Confirm recovery endpoint", location:"Recovery station" };
  if (group === "type3") return { inspect:"Inspect chiller & purge", measure:"Test low-pressure system", confirm:"Confirm chiller evidence", location:"Machine room" };
  return { inspect:"Inspect heat-transfer path", measure:"Measure operating circuit", confirm:"Confirm the fault", location:"Mechanical area" };
}

function buildActions(scenario) {
  const focus = scenario.focus;
  const names = actionNames(scenario.group);
  const equipmentNote = `${scenario.equipment}; ${scenario.refrigerant}; nameplate charge ${scenario.charge}.`;
  return {
    customer: [
      { id:"interview", icon:"💬", title:"Review work order", detail:"Confirm the complaint and service history", task:"intake", note:["Service request", `${scenario.site}: ${scenario.complaint}`], message:"Start with the reported symptom, but keep multiple causes open until the evidence agrees." },
      { id:"identify", icon:"🏷️", title:"Identify equipment", detail:"Read the nameplate and classify the appliance", requires:"interview", task:"identify", note:["Equipment identification", equipmentNote], message:`This is a ${curriculum.groups[scenario.group].label.toLowerCase()} scenario. Appliance and refrigerant identification determine the safe procedure.`, quizSlot:0 }
    ],
    indoor: [
      { id:"inspect", icon:"👁️", title:names.inspect, detail:"Look for physical evidence before connecting tools", requires:"identify", task:"inspect", note:["Physical inspection", focus.visual], message:"Physical evidence narrows the call, but it still needs operating or procedural confirmation.", quizSlot:1 }
    ],
    outdoor: [
      { id:"measure", icon:"🎛️", title:names.measure, detail:"Collect the decisive operating or compliance evidence", requires:"inspect", note:["Operating evidence", focus.operating], message:"Use the complete pattern—not a single pressure, temperature, or rule fragment.", quizSlot:2 },
      { id:"confirm", icon:"📡", title:names.confirm, detail:"Use an independent check before deciding", requires:"measure", task:"procedure", note:["Confirmation", focus.confirm], message:"The independent check now supports a defensible decision.", quizSlot:3 },
      { id:"diagnose", icon:"📝", title:"Submit decision", detail:"Choose the conclusion supported by all evidence", requires:"confirm", diagnosis:true },
      { id:"repair", icon:"🔧", title:"Complete & document", detail:"Choose the compliant corrective procedure", requires:"diagnose", repair:true }
    ],
    truck: [
      { id:"inventory", icon:"🧰", title:"Check service equipment", detail:"Verify recovery, test, and commissioning tools", note:["Service equipment", `Certified recovery equipment, compatible cylinder, scale, test instruments, dry nitrogen, evacuation tools, and manufacturer information prepared for ${scenario.refrigerant}.`], message:"Tool selection is part of the procedure. Confirm compatibility before making a connection." },
      { id:"ppe", icon:"🥽", title:"Establish safe conditions", detail:"Review the SDS, PPE, ventilation, and energy controls", task:"safety", note:["Safety setup", `SDS reviewed for ${scenario.refrigerant}; eye and hand protection, ventilation, ignition controls, and lockout needs addressed.`], message:"Safe conditions are established before the refrigerant circuit is opened or pressurized." }
    ]
  };
}

function renderActions() {
  const actions = state.actions[state.scene] || [];
  const activeTab = document.querySelector(`.location-tabs [data-scene="${state.scene}"]`);
  els.actionHeading.textContent = activeTab ? activeTab.textContent : state.scene;
  els.actionGrid.innerHTML = actions.map(action => {
    const complete = state.completed.has(action.id);
    const locked = action.requires && !state.completed.has(action.requires);
    return `<button class="action-card ${complete ? "complete" : ""}" data-action="${action.id}" ${locked ? "disabled" : ""}><span class="action-icon">${action.icon}</span><b>${complete ? "✓ " : ""}${escapeHtml(action.title)}</b><small>${locked ? "Complete the previous step first" : escapeHtml(action.detail)}</small></button>`;
  }).join("");
  els.actionGrid.querySelectorAll("button").forEach(button => button.addEventListener("click", () => doAction(actions.find(action => action.id === button.dataset.action))));
}

function renderSceneTabs() {
  const scenes = curriculum.groups[state.group].scenes;
  const sceneIds = ["customer", "indoor", "outdoor", "truck"];
  sceneIds.forEach((sceneId, index) => {
    const button = document.querySelector(`.location-tabs [data-scene="${sceneId}"]`);
    button.textContent = scenes[index][0];
  });
}

function switchScene(scene) {
  state.scene = scene;
  playSound("click");
  els.scene.dataset.scene = scene;
  els.scene.dataset.group = state.group;
  document.querySelectorAll(".location-tabs button").forEach(button => button.classList.toggle("active", button.dataset.scene === scene));
  const index = ["customer", "indoor", "outdoor", "truck"].indexOf(scene);
  const label = curriculum.groups[state.group].scenes[index];
  els.sceneLabel.innerHTML = `<b>${escapeHtml(label[0])}</b><span>${escapeHtml(label[1])}</span>`;
  renderActions();
}

function mentor(text, kind="") {
  if (state.mode === "expert" && kind !== "system") return;
  const message = document.createElement("div");
  message.className = `mentor-message ${kind}`;
  message.innerHTML = `${escapeHtml(text)}<small>RAY · JUST NOW</small>`;
  els.mentorFeed.append(message);
  els.mentorFeed.scrollTop = els.mentorFeed.scrollHeight;
}

function addNote(note) {
  if (!note || state.notes.some(existing => existing[0] === note[0])) return;
  state.notes.push(note);
  $("noteCount").textContent = state.notes.length;
}

function complete(id) {
  state.completed.add(id);
  renderTasks();
  renderActions();
}

function penalize(type, amount, why) {
  state.scores[type] = Math.max(0, state.scores[type] - amount);
  $(`${type}Score`).textContent = state.scores[type];
  mentor(why, "warning");
}

function doAction(action) {
  if (state.completed.has(action.id) && !action.diagnosis && !action.repair) {
    mentor("You already have that evidence in your field notes.");
    return;
  }
  if (action.diagnosis) return showDiagnosis();
  if (action.repair) return showRepair();
  if (["inspect", "measure", "confirm"].includes(action.id) && !state.completed.has("ppe")) {
    penalize("safety", 6, "You began equipment-side work before documenting PPE, refrigerant hazards, and energy controls.");
  }
  complete(action.id);
  playSound(action.task ? "good" : "click");
  if (action.task) complete(action.task);
  addNote(action.note);
  if (state.mode !== "expert") mentor(action.message, action.task ? "good" : "");
  if (Number.isInteger(action.quizSlot) && state.mode !== "expert") showQuiz(state.questions[action.quizSlot]);
}

function choiceQuestion(question, correct, distractors, explanation) {
  const choices = shuffled([correct, ...distractors.slice(0, 3)]);
  return { question, choices, answer: choices.indexOf(correct), explanation };
}

function showDiagnosis() {
  const focus = state.scenario.focus;
  const question = choiceQuestion("Which diagnosis or service decision best fits all collected evidence?", focus.diagnosis, focus.distractors, focus.explanation);
  openChoiceDialog(question, correct => {
    if (correct) {
      complete("diagnose");
      mentor("Decision supported. Now choose the corrective procedure that controls refrigerant and verifies the result.", "good");
    } else penalize("accuracy", 15, "That choice conflicts with the collected evidence. Review the field notebook and use the complete pattern.");
  }, `${curriculum.groups[state.group].name} SCENARIO DECISION`);
}

function showRepair() {
  const focus = state.scenario.focus;
  const question = choiceQuestion("Choose the best corrective and commissioning plan.", focus.repair, focus.repairDistractors, focus.explanation);
  openChoiceDialog(question, correct => {
    if (correct) finishCall();
    else {
      penalize("safety", 15, "That procedure does not adequately control the refrigerant or service hazard.");
      penalize("accuracy", 10, "The repair must correct the verified cause and include final verification.");
    }
  }, `${curriculum.groups[state.group].name} SERVICE PROCEDURE`);
}

function openChoiceDialog(question, callback, label="EPA 608 KNOWLEDGE CHECK") {
  els.quiz.querySelector(".eyebrow").textContent = label;
  $("quizQuestion").textContent = question.question;
  $("quizFeedback").hidden = true;
  $("quizContinue").hidden = true;
  const submit = $("quizSubmit");
  const correctAnswers = question.answers?.length ? question.answers : [question.answer];
  const isMulti = question.multiple === true;
  submit.hidden = !isMulti;
  submit.disabled = true;
  submit.onclick = null;
  state.quizCallback = callback;

  const showResult = (correct, selected) => {
    playSound(correct ? "good" : "warning");
    $("quizChoices").querySelectorAll(".quiz-choice").forEach((choiceElement, index) => {
      const input = choiceElement.querySelector("input");
      if (input) input.disabled = true;
      else choiceElement.disabled = true;
      if (correctAnswers.includes(index)) choiceElement.classList.add("correct");
      if (selected.includes(index) && !correctAnswers.includes(index)) choiceElement.classList.add("wrong");
    });
    $("quizFeedback").textContent = `${correct ? "Correct. " : "Not quite. "}${question.explanation}`;
    $("quizFeedback").hidden = false;
    $("quizContinue").hidden = false;
    submit.hidden = true;
    state.quizCallback = () => callback(correct);
  };

  if (isMulti) {
    $("quizChoices").innerHTML = question.choices.map((choice, index) => `<label class="quiz-choice multi-choice" data-i="${index}"><input type="checkbox" value="${index}"><span>${String.fromCharCode(65 + index)}. ${escapeHtml(choice)}</span></label>`).join("");
    $("quizChoices").querySelectorAll("input").forEach(input => input.onchange = () => {
      input.closest(".quiz-choice").classList.toggle("selected", input.checked);
      submit.disabled = !$("quizChoices").querySelector("input:checked");
    });
    submit.onclick = () => {
      const selected = [...$("quizChoices").querySelectorAll("input:checked")].map(input => Number(input.value));
      const correct = selected.length === correctAnswers.length && selected.every(index => correctAnswers.includes(index));
      showResult(correct, selected);
    };
  } else {
    $("quizChoices").innerHTML = question.choices.map((choice, index) => `<button type="button" class="quiz-choice" data-i="${index}">${String.fromCharCode(65 + index)}. ${escapeHtml(choice)}</button>`).join("");
    $("quizChoices").querySelectorAll("button").forEach(button => button.onclick = () => {
      const chosen = Number(button.dataset.i);
      showResult(correctAnswers.includes(chosen), [chosen]);
    });
  }
  openModal(els.quiz);
}

function showQuiz(question) {
  if (!question) return;
  openChoiceDialog(question, correct => {
    recordQuestion(question, correct);
    if (correct) {
      state.xp += 5;
      renderCareer();
      mentor("Knowledge check passed: +5 XP.", "good");
    } else penalize("accuracy", 5, "That question is marked for reinforcement and will return in a later call.");
  }, `${curriculum.groups[question.group].name.toUpperCase()} KNOWLEDGE CHECK · ${question.id.toUpperCase()}`);
}

function finishCall() {
  complete("repair");
  playSound("complete");
  const average = Math.round((state.scores.safety + state.scores.accuracy + state.scores.efficiency) / 3);
  const earned = Math.max(25, Math.round(average * (state.mode === "expert" ? .8 : state.mode === "coach" ? .65 : .5)));
  state.xp += earned;
  saveValue("coolcall-xp", String(state.xp));
  renderCareer();
  $("resultTitle").textContent = average >= 90 ? "Clean work, technician!" : average >= 75 ? "Call completed" : "Repair complete—review needed";
  $("resultText").textContent = `${state.scenario.title}: ${state.scenario.focus.diagnosis} You completed the corrective plan and earned ${earned} XP.`;
  $("resultScores").innerHTML = Object.entries(state.scores).map(([key, value]) => `<div><b>${value}</b><span>${escapeHtml(key)}</span></div>`).join("");
  setTimeout(() => openModal(els.result), 250);
}

function resetCall() {
  state.completed.clear();
  state.notes = [];
  state.seconds = 0;
  state.scores = { safety: 100, accuracy: 100, efficiency: 100 };
  ["safety", "accuracy", "efficiency"].forEach(key => $(`${key}Score`).textContent = 100);
  $("noteCount").textContent = 0;
  els.mentorFeed.innerHTML = "";
  renderTasks();
  renderSceneTabs();
  switchScene("customer");
  if (state.mode !== "expert") mentor(`${state.scenario.title}. Start with identification and safety, then make every decision from evidence.`, "system");
  if (state.mode === "guide") {
    const reminders = {
      core:"Identify the refrigerant, appliance category, hazards, and required recovery method before opening the circuit.",
      type1:"Small-appliance recovery depends on recovery-equipment age and whether the appliance compressor operates; four inches Hg vacuum is an alternative endpoint.",
      type2:"Prove load, airflow, and heat transfer before interpreting refrigerant pressures or changing charge.",
      type3:"A low-pressure chiller normally operates below atmospheric pressure, so leaks can pull air and moisture inward."
    };
    mentor(reminders[state.group], "warning");
  }
}

function prepareScenario() {
  state.group = $("certificationGroup").value;
  state.scenarioIndex = Number($("scenarioSelect").value);
  state.scenario = curriculum.scenarios[state.group][state.scenarioIndex];
  state.actions = buildActions(state.scenario);
  state.questions = selectScenarioQuestions(state.group);
  document.body.dataset.trainingGroup = state.group;
  $("jobTitle").textContent = state.scenario.site;
  $("customerAvatar").textContent = state.scenario.avatar;
  $("customerName").textContent = state.scenario.customer;
  $("customerQuote").textContent = `“${state.scenario.quote}”`;
  $("activeScenarioLabel").textContent = `${curriculum.groups[state.group].name} · ${String(state.scenarioIndex + 1).padStart(2,"0")}/${curriculum.scenarios[state.group].length}`;
}

function start() {
  state.mode = document.querySelector('input[name="mentor"]:checked').value;
  prepareScenario();
  state.started = true;
  els.briefing.hidden = true;
  els.play.hidden = false;
  requestAnimationFrame(() => els.play.scrollIntoView({ behavior:"smooth", block:"start" }));
  $("mentorModeLabel").textContent = ({ guide:"Guided mentor", coach:"After-action coach", expert:"Expert mode" })[state.mode];
  $("mentorPanel").hidden = state.mode === "expert";
  resetCall();
}

function advanceDispatch() {
  closeModal(els.result);
  els.play.hidden = true;
  els.briefing.hidden = false;
  state.started = false;
  const scenarios = curriculum.scenarios[state.group];
  $("scenarioSelect").value = String((state.scenarioIndex + 1) % scenarios.length);
  updateBriefing();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("certificationGroup").onchange = renderScenarioOptions;
$("scenarioSelect").onchange = updateBriefing;
$("randomScenario").onclick = randomScenario;
$("startButton").onclick = start;
$("resetButton").onclick = resetCall;
$("soundButton").onclick = toggleSound;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopMusic(false);
  else if (audioState.enabled) startMusic();
});
$("quizContinue").onclick = () => {
  closeModal(els.quiz);
  if (state.quizCallback) state.quizCallback();
  state.quizCallback = null;
};
$("notebookButton").onclick = () => {
  $("notesList").innerHTML = state.notes.length
    ? state.notes.map(note => `<div class="note-item"><b>${escapeHtml(note[0])}</b><span>${escapeHtml(note[1])}</span></div>`).join("")
    : "<p>No evidence collected yet.</p>";
  openModal(els.notes);
};
$("hintButton").onclick = () => {
  const focus = state.scenario.focus;
  const hints = [state.scenario.complaint, focus.visual, focus.operating, focus.confirm, focus.repair];
  const completedTasks = currentTasks().filter(task => state.completed.has(task.id)).length;
  mentor(hints[Math.min(completedTasks, hints.length - 1)], "warning");
  state.scores.efficiency = Math.max(0, state.scores.efficiency - 2);
  $("efficiencyScore").textContent = state.scores.efficiency;
};
$("resultButton").onclick = advanceDispatch;
document.querySelectorAll(".dialog-close").forEach(button => button.addEventListener("click", event => {
  const dialog = button.closest("dialog");
  if (dialog && typeof dialog.close !== "function") {
    event.preventDefault();
    closeModal(dialog);
  }
}));
document.querySelectorAll(".location-tabs button").forEach(button => button.onclick = () => switchScene(button.dataset.scene));
setInterval(() => {
  if (!state.started || els.play.hidden) return;
  state.seconds++;
  const minutes = String(Math.floor(state.seconds / 60)).padStart(2,"0");
  const seconds = String(state.seconds % 60).padStart(2,"0");
  els.timer.textContent = `${minutes}:${seconds}`;
}, 1000);

window.CoolCall = { state, audioState, curriculum, questionBanks, buildActions, selectScenarioQuestions, openChoiceDialog };
renderCareer();
renderScenarioOptions();
renderSoundButton();
