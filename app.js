"use strict";

const TASKS = [
  { id: "complaint", label: "Confirm the complaint" },
  { id: "airflow", label: "Rule out airflow problems" },
  { id: "electrical", label: "Verify electrical operation" },
  { id: "refrigerant", label: "Evaluate the refrigeration circuit" },
  { id: "leak", label: "Locate the refrigerant leak" },
  { id: "diagnose", label: "Submit a diagnosis" },
  { id: "repair", label: "Complete a compliant repair" }
];

const ACTIONS = {
  customer: [
    { id: "interview", icon: "💬", title: "Interview customer", detail: "Ask when and how the problem began", task: "complaint", note: ["Customer history", "Runs continuously; cooling declined gradually over two weeks. Filter was changed last month."], message: "Good start. A gradual loss of capacity is evidence—not a diagnosis. Keep the airflow, electrical, and refrigerant branches open." },
    { id: "thermostat", icon: "🌡️", title: "Read thermostat", detail: "Check setpoint, room temperature and call", note: ["Thermostat", "79°F room, 72°F setpoint; Y1 and G calls active."], message: "The controls are calling for cooling. Now prove what the equipment is doing." }
  ],
  indoor: [
    { id: "filter", icon: "▦", title: "Inspect filter", detail: "Check condition and installation", note: ["Filter", "Clean MERV 8 filter, correctly oriented."], message: "A clean filter removes the most common restriction, but it does not prove airflow." },
    { id: "temps", icon: "🌡️", title: "Measure air temperatures", detail: "Take return and supply dry-bulb", requires: "filter", note: ["Air temperatures", "Return 79°F DB; supply 67°F DB; temperature split 12°F."], message: "A 12°F split is low for these conditions. That confirms weak sensible capacity, not its cause." },
    { id: "airflow", icon: "💨", title: "Measure total airflow", detail: "Use static pressure and blower data", requires: "filter", task: "airflow", note: ["Airflow", "0.54 in. w.c. total external static; approximately 1,560 CFM."], message: "About 390 CFM per ton is reasonable. Airflow is unlikely to be the root fault." },
    { id: "coil", icon: "🧊", title: "Inspect evaporator", detail: "Look for dirt, ice and oil", requires: "filter", note: ["Evaporator", "Coil is clean. No ice. Distributor feeds appear evenly cool."], message: "No obvious indoor coil restriction. Keep following the evidence." }
  ],
  outdoor: [
    { id: "visual", icon: "👁️", title: "Visual inspection", detail: "Check coil, wiring, oil and service ports", note: ["Outdoor inspection", "Condenser coil is clean. Slight oily dust around suction service-port cap."], message: "That oily residue is worth noting. Oil can travel with refrigerant at a leak, but confirm it with an approved method." },
    { id: "voltage", icon: "⚡", title: "Check voltage & amps", detail: "Use meter and clamp", task: "electrical", note: ["Electrical readings", "243 VAC. Compressor 15.2 A; condenser fan 1.1 A. Both operating."], message: "Electrical operation is normal for the present load. De-energize before resistance or capacitance tests." },
    { id: "capacitor", icon: "🔋", title: "Test capacitor", detail: "Isolate power, discharge, and measure", requires: "voltage", task: "electrical", note: ["Dual capacitor", "Rated 45/5 µF; measured 44.2/4.9 µF. Within tolerance."], message: "Capacitor passes. Restore power only after covers and leads are secure." },
    { id: "gauges", icon: "🎛️", title: "Connect digital manifold", detail: "Use low-loss fittings and purge hoses", requires: "visual", note: ["Refrigerant pressures", "R-410A: 102 psig suction / 300 psig liquid. Saturation temperatures: 32°F / 94°F."], message: "Low suction and low head can fit undercharge, but pressures alone are not enough. Add line temperatures." , quiz: 0},
    { id: "lines", icon: "📏", title: "Clamp line temperatures", detail: "Measure suction and liquid lines", requires: "gauges", task: "refrigerant", note: ["Line temperatures", "Suction line 58°F; liquid line 89°F. Superheat 26°F; subcooling 5°F."], message: "High superheat plus low subcooling, with normal airflow, strongly supports an undercharged TXV system." },
    { id: "detector", icon: "📡", title: "Electronic leak search", detail: "Sweep likely leak points slowly", requires: "lines", task: "leak", note: ["Leak test", "Repeated detector response at suction service-port valve core; bubble test confirms leak."], message: "Leak confirmed at the valve core. Repair the leak before adding refrigerant." , quiz: 1},
    { id: "diagnose", icon: "📝", title: "Submit diagnosis", detail: "Choose the fault supported by evidence", requires: "detector", task: "diagnose", diagnosis: true },
    { id: "repair", icon: "🔧", title: "Repair & commission", detail: "Choose a compliant service procedure", requires: "diagnose", task: "repair", repair: true }
  ],
  truck: [
    { id: "inventory", icon: "🧰", title: "Check truck stock", detail: "Review available service tools", note: ["Truck inventory", "Digital manifold, clamps, meter, leak detector, bubbles, core tool, recovery setup, nitrogen, vacuum pump, micron gauge, scale."], message: "Use the least invasive tool that can produce reliable evidence." },
    { id: "ppe", icon: "🥽", title: "Put on PPE", detail: "Gloves and safety glasses", note: ["Safety", "Safety glasses and refrigerant-rated gloves equipped."], message: "Good. Liquid R-410A can cause severe frostbite, and pressurized work needs eye protection." }
  ]
};

const QUIZZES = [
  { question: "Equipment has to be certified to EPA standards in order to recover which refrigerants?", choices: ["CFCs only", "HCFCs only", "HFCs only", "CFCs, HCFCs, and HFCs"], answer: 3, explanation: "Recovery equipment used for ozone-depleting refrigerants and non-exempt substitutes must meet EPA requirements. This item is adapted from your Core question bank." },
  { question: "Before opening equipment in a way that would release a non-exempt refrigerant, what does the venting prohibition require?", choices: ["Dilute it with nitrogen", "Recover the affected refrigerant", "Release only vapor", "No action for residential systems"], answer: 1, explanation: "Affected refrigerant must be recovered using compliant practices. De minimis releases during a good-faith recovery attempt are treated differently from intentional venting. Adapted from your Core question bank." }
];

function loadXp() {
  try {
    const savedXp = Number(localStorage.getItem("coolcall-xp"));
    return Number.isFinite(savedXp) && savedXp >= 0 ? savedXp : 0;
  } catch {
    // Some local and embedded previews block storage. Progress can still live in memory.
    return 0;
  }
}

function saveXp(xp) {
  try {
    localStorage.setItem("coolcall-xp", String(xp));
  } catch {
    // Do not interrupt a completed call when persistent storage is unavailable.
  }
}

const state = { mode: "guide", scene: "customer", completed: new Set(), notes: [], scores: { safety: 100, accuracy: 100, efficiency: 100 }, seconds: 0, started: false, xp: loadXp(), quizCallback: null };

const $ = (id) => document.getElementById(id);
const els = { briefing: $("briefingPanel"), play: $("playScreen"), taskList: $("taskList"), actionGrid: $("actionGrid"), actionHeading: $("actionHeading"), scene: $("scene"), sceneLabel: $("sceneLabel"), mentorFeed: $("mentorFeed"), timer: $("timer"), quiz: $("quizDialog"), notes: $("notesDialog"), result: $("resultDialog") };
const audioState = { enabled: false, context: null };

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
    click: [[440,.05,0,"sine",.025]],
    good: [[523,.08,0],[659,.11,.07]],
    warning: [[230,.13,0,"triangle",.035]],
    complete: [[523,.1,0],[659,.1,.09],[784,.18,.18]]
  };
  (patterns[kind] || patterns.click).forEach(notes => tone(...notes));
}

function renderSoundButton() {
  const button = $("soundButton");
  button.textContent = audioState.enabled ? "🔊" : "🔇";
  button.setAttribute("aria-pressed", String(audioState.enabled));
  button.setAttribute("aria-label", audioState.enabled ? "Turn sound off" : "Turn sound on");
  button.title = audioState.enabled ? "Sound on" : "Sound off";
}

function toggleSound() {
  audioState.enabled = !audioState.enabled;
  renderSoundButton();
  if (audioState.enabled) playSound("good");
}

function openModal(dialog) {
  if (!dialog || dialog.open) return;
  try {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      return;
    }
  } catch {
    // Embedded previews can expose <dialog> without allowing showModal().
  }
  dialog.setAttribute("open", "");
  dialog.classList.add("dialog-fallback");
  document.body.classList.add("dialog-open");
}

function closeModal(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === "function") {
    try { dialog.close(); } catch { dialog.removeAttribute("open"); }
  } else {
    dialog.removeAttribute("open");
  }
  dialog.classList.remove("dialog-fallback");
  if (!document.querySelector(".dialog-fallback[open]")) document.body.classList.remove("dialog-open");
}

function renderCareer() {
  const ranks = [[0,"APPRENTICE"],[100,"JUNIOR TECH"],[250,"EPA CERTIFIED"],[500,"SENIOR TECH"]];
  const rank = [...ranks].reverse().find(([n]) => state.xp >= n);
  const next = ranks.find(([n]) => n > state.xp) || [750,"MASTER TECH"];
  $("rankLabel").textContent = rank[1];
  $("xpLabel").textContent = `${state.xp} / ${next[0]} XP`;
  const previous = rank[0];
  $("xpBar").style.width = `${Math.min(100, ((state.xp - previous) / (next[0] - previous)) * 100)}%`;
}

function renderTasks() {
  els.taskList.innerHTML = TASKS.map((t,i) => `<li data-step="${i+1}" class="${state.completed.has(t.id) ? "done" : ""}">${t.label}</li>`).join("");
}

function renderActions() {
  const actions = ACTIONS[state.scene];
  els.actionHeading.textContent = document.querySelector(`[data-scene="${state.scene}"]`).textContent;
  els.actionGrid.innerHTML = actions.map(a => {
    const complete = state.completed.has(a.id);
    const locked = a.requires && !state.completed.has(a.requires);
    return `<button class="action-card ${complete ? "complete" : ""}" data-action="${a.id}" ${locked ? "disabled" : ""}><span class="action-icon">${a.icon}</span><b>${complete ? "✓ " : ""}${a.title}</b><small>${locked ? "Complete the previous test first" : a.detail}</small></button>`;
  }).join("");
  els.actionGrid.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => doAction(actions.find(a => a.id === btn.dataset.action))));
}

function switchScene(scene) {
  state.scene = scene;
  playSound("click");
  els.scene.dataset.scene = scene;
  document.querySelectorAll(".location-tabs button").forEach(b => b.classList.toggle("active", b.dataset.scene === scene));
  const labels = { customer:["Front door","Begin with the customer complaint."], outdoor:["Outdoor condenser","Inspect, measure, and follow the refrigeration evidence."], indoor:["Indoor air handler","Airflow must be proven before condemning the charge."], truck:["Service van","Select safe, appropriate tools for the job."] };
  els.sceneLabel.innerHTML = `<b>${labels[scene][0]}</b><span>${labels[scene][1]}</span>`;
  renderActions();
}

function mentor(text, kind="") {
  if (state.mode === "expert" && kind !== "system") return;
  const div = document.createElement("div");
  div.className = `mentor-message ${kind}`;
  div.innerHTML = `${text}<small>RAY · JUST NOW</small>`;
  els.mentorFeed.append(div);
  els.mentorFeed.scrollTop = els.mentorFeed.scrollHeight;
}

function addNote(note) {
  if (!note || state.notes.some(n => n[0] === note[0])) return;
  state.notes.push(note);
  $("noteCount").textContent = state.notes.length;
}

function complete(id) { state.completed.add(id); renderTasks(); renderActions(); }
function penalize(type, amount, why) { state.scores[type] = Math.max(0, state.scores[type] - amount); $(`${type}Score`).textContent = state.scores[type]; mentor(why, "warning"); }

function doAction(action) {
  if (state.completed.has(action.id) && !action.diagnosis && !action.repair) { mentor("You already have that evidence in your field notes."); return; }
  if (state.mode === "guide") {
    const pre = { gauges:"Before connecting, verify the refrigerant and use low-loss fittings. Purge air from hoses without deliberately releasing the system charge.", detector:"Search only after operating data points to a charge issue. Move the probe slowly and confirm any response.", capacitor:"Kill power, verify zero volts, and discharge the capacitor safely before measuring it." }[action.id];
    if (pre) mentor(pre, "warning");
  }
  if (action.diagnosis) return showDiagnosis();
  if (action.repair) return showRepair();
  complete(action.id);
  playSound(action.task ? "good" : "click");
  if (action.task) complete(action.task);
  addNote(action.note);
  if (state.mode !== "expert") mentor(action.message, action.task ? "good" : "");
  if (Number.isInteger(action.quiz) && state.mode !== "expert") showQuiz(action.quiz);
  if (action.id === "gauges" && !state.completed.has("ppe")) penalize("safety", 8, "You connected to a high-pressure system without first documenting PPE. Gloves and eye protection belong on before opening the service kit.");
}

function showDiagnosis() {
  const q = { question:"Which diagnosis best fits all collected evidence?", choices:["Restricted return airflow","Weak run capacitor","Undercharge from a leaking suction service-port core","Overcharged system with a dirty condenser"], answer:2, explanation:"Normal airflow and electrical operation rule out the first two. Low suction, low head, high superheat, low subcooling, oily residue, and a confirmed detector/bubble response identify an undercharge caused by the leaking valve core." };
  openChoiceDialog(q, correct => { if (correct) { complete("diagnose"); mentor("Diagnosis supported. A technician repairs the verified leak before restoring charge.","good"); } else penalize("accuracy",15,"That choice conflicts with at least two measurements. Review the notebook and use all the evidence, not one pressure."); });
}

function showRepair() {
  const q = { question:"Choose the best repair and commissioning plan.", choices:["Add R-410A until suction pressure looks normal; leave the leak for later","Vent the remaining charge, replace the core, and recharge","Use a valve-core removal tool to replace the leaking core with minimal release; verify leak-free operation, weigh in the required R-410A, and confirm final performance","Add leak sealant and tighten the cap"], answer:2, explanation:"A core tool allows the failed core to be replaced while minimizing release. The leak is then verified, charge is restored accurately, caps are installed, and operating performance is confirmed. Intentional venting of R-410A is prohibited." };
  openChoiceDialog(q, correct => { if (correct) finishCall(); else { penalize("safety",20,"That procedure either vents refrigerant or fails to repair the confirmed leak. R-410A is a non-exempt substitute under the venting prohibition."); penalize("accuracy",10,"Charging by pressure alone is not a complete commissioning method."); } });
}

function openChoiceDialog(q, callback) {
  $("quizQuestion").textContent = q.question;
  $("quizFeedback").hidden = true; $("quizContinue").hidden = true;
  $("quizChoices").innerHTML = q.choices.map((c,i) => `<button type="button" class="quiz-choice" data-i="${i}">${String.fromCharCode(65+i)}. ${c}</button>`).join("");
  state.quizCallback = callback;
  $("quizChoices").querySelectorAll("button").forEach(btn => btn.onclick = () => {
    const chosen = Number(btn.dataset.i), correct = chosen === q.answer;
    playSound(correct ? "good" : "warning");
    $("quizChoices").querySelectorAll("button").forEach((b,i) => { b.disabled=true; if(i===q.answer)b.classList.add("correct"); if(i===chosen&&!correct)b.classList.add("wrong"); });
    $("quizFeedback").textContent = `${correct ? "Correct. " : "Not quite. "}${q.explanation}`; $("quizFeedback").hidden=false; $("quizContinue").hidden=false;
    state.quizCallback = () => callback(correct);
  });
  openModal(els.quiz);
}

function showQuiz(index) {
  openChoiceDialog(QUIZZES[index], correct => {
    if (correct) { state.xp += 5; renderCareer(); mentor("EPA knowledge check passed: +5 XP.","good"); }
    else penalize("accuracy",5,"Review that EPA point. The field procedure and the regulation need to agree.");
  });
}

function finishCall() {
  complete("repair");
  playSound("complete");
  const average = Math.round((state.scores.safety + state.scores.accuracy + state.scores.efficiency) / 3);
  const earned = Math.max(25, Math.round(average * (state.mode === "expert" ? .8 : state.mode === "coach" ? .65 : .5)));
  state.xp += earned; saveXp(state.xp); renderCareer();
  $("resultTitle").textContent = average >= 90 ? "Clean work, technician!" : average >= 75 ? "Call completed" : "Repair complete—review needed";
  $("resultText").textContent = `You traced the capacity loss to a leaking suction service-port core, repaired it without intentional venting, restored the charge, and verified operation. You earned ${earned} XP.`;
  $("resultScores").innerHTML = Object.entries(state.scores).map(([k,v]) => `<div><b>${v}</b><span>${k}</span></div>`).join("");
  setTimeout(() => openModal(els.result), 250);
}

function resetCall() {
  state.completed.clear(); state.notes=[]; state.seconds=0; state.scores={safety:100,accuracy:100,efficiency:100};
  ["safety","accuracy","efficiency"].forEach(k => $(`${k}Score`).textContent=100);
  $("noteCount").textContent=0; els.mentorFeed.innerHTML=""; renderTasks(); switchScene("customer");
  if (state.mode !== "expert") mentor("New call. Start with the complaint, establish safe conditions, then diagnose from measured evidence.","system");
  if (state.mode === "guide") mentor("EPA briefing: intentionally venting R-410A can bring serious civil enforcement and penalties. “Natural” does not automatically mean exempt—CO₂, ammonia, water, nitrogen, and certain hydrocarbons are exempt only in the uses specified by EPA rules. Always identify the refrigerant and end use.","warning");
}

function start() {
  state.mode = document.querySelector('input[name="mentor"]:checked').value;
  state.started = true; els.briefing.hidden=true; els.play.hidden=false;
  requestAnimationFrame(() => els.play.scrollIntoView({ behavior: "smooth", block: "start" }));
  $("mentorModeLabel").textContent = ({guide:"Guided mentor",coach:"After-action coach",expert:"Expert mode"})[state.mode];
  $("mentorPanel").hidden = state.mode === "expert";
  resetCall();
}

$("startButton").onclick=start;
$("resetButton").onclick=resetCall;
$("soundButton").onclick=toggleSound;
$("quizContinue").onclick=()=>{ closeModal(els.quiz); if(state.quizCallback) state.quizCallback(); state.quizCallback=null; };
$("notebookButton").onclick=()=>{ $("notesList").innerHTML=state.notes.length ? state.notes.map(n=>`<div class="note-item"><b>${n[0]}</b><span>${n[1]}</span></div>`).join("") : "<p>No evidence collected yet.</p>"; openModal(els.notes); };
$("hintButton").onclick=()=>{ const hints=["Start with the customer's history and thermostat call.","Verify airflow before interpreting refrigerant pressures.","Combine saturation and line temperatures to calculate superheat and subcooling.","The oily service port deserves an electronic and bubble test.","Repair the confirmed leak before restoring charge."]; const done=TASKS.filter(t=>state.completed.has(t.id)).length; mentor(hints[Math.min(done,hints.length-1)],"warning"); state.scores.efficiency=Math.max(0,state.scores.efficiency-2); $("efficiencyScore").textContent=state.scores.efficiency; };
$("resultButton").onclick=()=>{ closeModal(els.result); els.play.hidden=true; els.briefing.hidden=false; };
document.querySelectorAll(".dialog-close").forEach(button => button.addEventListener("click", event => {
  const dialog = button.closest("dialog");
  if (dialog && typeof dialog.close !== "function") {
    event.preventDefault();
    closeModal(dialog);
  }
}));
document.querySelectorAll(".location-tabs button").forEach(b=>b.onclick=()=>switchScene(b.dataset.scene));
setInterval(()=>{ if(!state.started||els.play.hidden)return; state.seconds++; const m=String(Math.floor(state.seconds/60)).padStart(2,"0"),s=String(state.seconds%60).padStart(2,"0"); els.timer.textContent=`${m}:${s}`; },1000);
renderCareer(); renderTasks(); renderActions();
renderSoundButton();
