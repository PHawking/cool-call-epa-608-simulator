# Cool Call: EPA 608 Service Simulator

A responsive, dependency-free prototype of a technical HVAC diagnostic training game.

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

## First playable call

- Residential four-ton R-410A split system with a TXV
- Complaint: long runtime and inadequate cooling
- Root fault: leaking suction service-port valve core and resulting undercharge
- Technical evidence: airflow, static pressure, voltage, amperage, capacitance, refrigerant pressures, saturation temperatures, line temperatures, superheat, subcooling, electronic leak detection, and bubble confirmation
- Correct resolution: replace the leaking core with a valve-core removal tool while minimizing refrigerant release, verify the repair, accurately restore charge, and recommission the system

## Mentor modes

- **Guided:** instruction and safety/regulatory context before important actions, plus feedback afterward
- **Coach:** feedback after actions and optional hints
- **Expert:** no mentor panel or knowledge checks; higher XP multiplier

## Current training content

The project currently contains:

- 147 Core question blocks
- 114 Type I question blocks (including 25 groups of exact duplicate question text)
- 57 Type II question blocks
- No Type III source file was found as of July 16, 2026

The prototype includes two contextual knowledge checks adapted from the supplied Core bank. The next content pass should normalize all question banks into structured JSON, remove exact duplicates, add stable IDs and topic tags, and flag time-sensitive regulatory items for review.

## Regulatory content policy

Regulatory dialogue should include a `verifiedOn` date and an authoritative source before release. “Natural refrigerant” must not be used as a synonym for “exempt from the venting prohibition”; exemptions can depend on both the substance and its end use.

Primary references checked July 16, 2026:

- https://www.epa.gov/section608/stationary-refrigeration-prohibition-venting-refrigerants
- https://www.epa.gov/section608/regulatory-updates-section-608-refrigerant-management-regulations
- https://www.epa.gov/sites/production/files/2016-09/documents/608_fact_sheet_technicians_0.pdf

## Suggested next calls

1. Residential electrical fault: weak dual capacitor with normal refrigeration circuit
2. Residential airflow fault: loaded evaporator and incorrect blower setup
3. Type I small-appliance recovery call
4. Type II commercial rooftop call
5. Type III low-pressure chiller call after its question bank is added
