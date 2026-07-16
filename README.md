# Cool Call: EPA 608 Service Simulator

A responsive, dependency-free prototype of a technical HVAC diagnostic training game.

The sound control enables both gameplay cues and an original, low-volume 8-bit background melody. Music pauses when the browser tab is hidden and resumes when play returns.

## Run it

Open `index.html` in a modern browser. No build or package installation is required.

For a local web server, run this command in the project folder if Python is installed:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Host it

GitHub Pages is a good fit because the simulator is a dependency-free static site. Publish the repository root and use `index.html` as the entry page; no build command or server-side runtime is required.

Hosting gives players one consistent HTTPS URL and avoids embedded-preview or `file://` differences. It does not replace browser testing, so the standalone `index.html` remains supported for offline use.

## Scenario curriculum

Dispatch includes 80 service calls:

- 20 Core fundamentals scenarios
- 20 Type I small-appliance scenarios
- 20 Type II high-pressure scenarios
- 20 Type III low-pressure chiller scenarios

Each group uses ten major skill patterns in two different service contexts. That creates deliberate reinforcement without repeating the same customer, appliance, and evidence word-for-word. A random-call control is also available.

Every guided or coached call presents four knowledge checks. Selection prioritizes missed questions first, then unseen questions, and finally previously mastered material. Type I, II, and III calls include three questions from their certification group and one Core reinforcement question.

## Mentor modes

- **Guided:** instruction and safety/regulatory context before important actions, plus feedback afterward
- **Coach:** feedback after actions and optional hints
- **Expert:** no mentor panel or knowledge checks; higher XP multiplier

## Question banks

The Markdown sources are normalized into `question-banks.js` by `scripts/build-question-banks.js`. The generated bank currently contains:

- 144 usable, unique Core questions
- 89 usable, unique Type I questions after removing 25 exact duplicate blocks
- 57 Type II questions
- 42 Type III questions

Two malformed Core multi-select OCR blocks remain in `question-bank-report.json` for editorial review and are not presented by the single-answer game interface. Stable IDs preserve the source group and source-block number.

After editing a Markdown question source, rebuild the browser bank:

```powershell
node scripts/build-question-banks.js
```

Run the end-to-end browser smoke test with Playwright available on `NODE_PATH`:

```powershell
node tests/smoke.js
```

## Regulatory content policy

Regulatory dialogue should include a `verifiedOn` date and an authoritative source before release. “Natural refrigerant” must not be used as a synonym for “exempt from the venting prohibition”; exemptions can depend on both the substance and its end use.

Primary references checked July 16, 2026:

- https://www.epa.gov/section608/stationary-refrigeration-prohibition-venting-refrigerants
- https://www.epa.gov/section608/regulatory-updates-section-608-refrigerant-management-regulations
- https://www.epa.gov/section608/section-608-technician-certification-requirements
- https://www.epa.gov/section608/stationary-refrigeration-service-practice-requirements
- https://www.epa.gov/section608/required-level-evacuation-appliances
- https://www.epa.gov/section608/stationary-refrigeration-leak-repair-requirements
- https://www.epa.gov/sites/production/files/2016-09/documents/608_fact_sheet_technicians_0.pdf
