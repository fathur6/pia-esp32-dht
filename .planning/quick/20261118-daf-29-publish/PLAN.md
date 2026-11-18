---
phase: quick-daf-29-publish
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - platformio.ini
  - examples/blink/main.cpp
  - examples/forward/main.cpp
   - examples/pingpong200/main.cpp
   - examples/pingpong100/main.cpp
   - examples/diag/main.cpp
  - src/main.cpp
  - include/config.example.h
  - apps-script/Code.gs
  - apps-script/appsscript.json
  - .gitignore
  - README.md
   - docs/WIRING.md
   - docs/DEVELOPMENT.md
  - tests/apps-script.test.cjs
  - tests/archive-check.cjs
autonomous: true
requirements: [ARCH-01, ARCH-02, ARCH-03, ARCH-04]
must_haves:
  truths:
    - All four LED stages, diagnostics and the actual sensor logger build without private configuration.
    - Readers can wire GPIO27 and distinguish sampling cadence from upload batching.
    - Documentation separates observed results, reconstructed stages and unresolved causes.
    - Published files contain no real credentials, endpoint IDs or deployment mappings.
    - GitHub main contains the reviewed archive and its description identifies the project.
  artifacts:
    - path: README.md
      provides: Setup, stage/build index and honest status
     - path: docs/DEVELOPMENT.md
      provides: Evidence-qualified development chronology
    - path: src/main.cpp
      provides: Archived sensor firmware
    - path: apps-script/Code.gs
      provides: Sanitized actual server source
    - path: include/config.example.h
      provides: Non-secret build configuration template
  key_links:
    - from: platformio.ini
      to: examples and src/main.cpp
      via: Explicit environment source filters
    - from: README.md
      to: include/config.example.h
      via: Local configuration setup
    - from: src/main.cpp
      to: apps-script/Code.gs
      via: Documented JSON readings contract, not a live endpoint
---

<objective>
Fulfil DAF-29 by publishing the existing ESP32 development as a reproducible, accurately documented, secret-free archive. Do not fix runtime behavior, change the original local projects, flash an MCU, or deploy Apps Script. This is a bounded archival quick workflow, not a new product phase. The planner writes planning files only; the executor performs the implementation and approved publication.
</objective>

<execution_context>
@/Users/aman/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/aman/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

Target: /Users/aman/Documents/PlatformIO/Projects/pia-esp32-dht
Expected origin: https://github.com/fathur6/pia-esp32-dht.git
Issue: DAF-29; acceptance criteria cover source, history, privacy, builds, publication and description.
Discovery: Level 0; preserve existing Arduino/ESP32 and Apps Script patterns. No npm/pip/cargo packages or new libraries. Reuse installed PlatformIO toolchains; do not add package-manager installs.
Never read original config.h or .clasp.json. Source Code.gs contains a real spreadsheet ID: replace its value during archival and do not reproduce it in documentation, planning, tests or logs. Do not bulk-copy source directories.
</context>

<tasks>
<task type="auto">
  <name>Task 1: Archive all LED stages and build environment selection</name>
  <files>platformio.ini, examples/blink/main.cpp, examples/forward/main.cpp, examples/pingpong-200/main.cpp, examples/pingpong-100/main.cpp, examples/diagnostics/main.cpp</files>
  <action>
  Confirm target origin and clean/unborn main state before edits. Work only inside the target. Create six PlatformIO environments named blink, forward, pingpong200, pingpong100, diagnostics and dht12 using espressif32, esp32dev and Arduino. Use project-root src_dir with explicit per-environment build_src_filter selecting only the corresponding translation unit, excluding other sources; give sensor environment the existing C++17 flags. Do not retain the source machine's serial device path. Monitor speed is 115200.
  Reconstruct GPIO13 blink with 1000 ms HIGH and 1000 ms LOW; forward GPIO12,13,14 at 200 ms each with all others off. Copy surviving esp32-blink-led/src/running/main.cpp to pingpong-100 unchanged; derive pingpong-200 by changing the step interval and matching explanatory text only. Both must traverse 13,12,14,12 without duplicate endpoints. Copy src/diag/main.cpp unchanged into diagnostics. The historical blink, forward and 200 ms stages are reconstructions from Aman's requirements, not recovered snapshots; retain that distinction in provenance. Source platformio.ini has stale forward-stage comments whereas surviving running source is 100 ms ping-pong: treat source behavior as authoritative. This mechanical archive task touches six small files and requires no subsystem redesign.
  </action>
  <verify><automated>pio run -e blink -e forward -e pingpong200 -e pingpong100 -e diagnostics</automated></verify>
  <done>Five independent LED/diagnostic environments compile; all requested pin orders and intervals are represented without changing originals. No upload command runs.</done>
</task>

<task type="auto">
  <name>Task 2: Archive actual logger and sanitize configuration</name>
  <files>src/main.cpp, include/config.example.h, apps-script/Code.gs, apps-script/appsscript.json, .gitignore</files>
  <action>
  Copy esp32-dht12-sheets/src/main.cpp unchanged. Create config.example.h with the required WIFI_SSID, WIFI_PASS, WEBAPP_URL and DEVICE_NAME macro names and obvious non-secret example values; never obtain them by reading config.h. The example web-app URL must use a template deployment token rather than a real identifier. Provide local build setup copying this example to ignored include/config.h. Copy Apps Script source while replacing SHEET_ID with an explicit user-configured template; replace identifying tab labels with a documented generic tab where appropriate. Preserve application behavior otherwise, including batch/single payload compatibility, timestamp conversion, fallback sheet selection, public doGet, locking and error paths. Copy the manifest with Asia/Kuala_Lumpur, V8 and existing anonymous web-app settings. Do not create or copy .clasp.json.
  Ignore .pio, config.h at any depth, .clasp.json at any depth, .env files, firmware binaries, editor/OS artifacts and local logs; allow config.example.h. No credentials, actual sheet ID, private web-app URL, deployment mapping or local serial identifier may enter staged content. Keep source projects unchanged. Do not refactor setInsecure, acknowledgement detection, buffering or server authorization; limitations belong in documentation.
  </action>
  <verify><automated>cp include/config.example.h include/config.h &amp;&amp; pio run -e dht12 &amp;&amp; node --check &lt; apps-script/Code.gs &amp;&amp; node -e 'JSON.parse(require("fs").readFileSync("apps-script/appsscript.json","utf8"))'</automated></verify>
  <done>Actual sensor firmware builds using ignored example-derived configuration; server syntax and manifest validate; originals and private deployment files are untouched.</done>
</task>

<task type="auto">
  <name>Task 3: Document, test, review and publish DAF-29</name>
  <files>README.md, docs/wiring.md, docs/development-history.md, tests/apps-script.test.cjs, tests/archive-check.cjs</files>
  <action>
  Write README with purpose, component/source map, environment build commands, configuration template setup and Apps Script setup instructions (instructions only, no deployment). Link wiring and development history. Wiring: sensor S to GPIO27, VCC 3V3, GND common ground; GPIO34 is input-only and cannot drive the DHT start signal. LEDs use GPIO12/13/14 through individual 220–330 ohm resistors to ground; note polarity and GPIO12 strapping caution. Diagnostics actively drive multiple pins: warn to disconnect sensor/other peripherals before any later hardware use.
  Explain nominal 5-second sampling and six-reading batches, approximately 30-second uploads only under successful/unblocked operation. Blocking WiFi/HTTP can delay samples; oldest samples drop on full-buffer failure, RAM buffering is not durable. Document concurrent 100 ms LED heartbeat, server timestamp fallback and Malaysia formatting.
  Record sequence: blink, forward, 200 ms ping-pong, 100 ms ping-pong, GPIO14/wiring diagnostics, sensor pin investigation and GPIO27 success, batching/Sheets integration, unresolved network/upload problems. Do not invent dates or diagnostic outcomes. Mark reconstructed historical examples and identify surviving sources. Latest reported sensor readings are 25.5–25.9 C/42% RH; latest WiFi status was 0. Earlier HTTP403 cause unresolved, not demonstrated domain policy. Sensor photo resembles DHT11 and fractional decoder is DHT11/DHT12-compatible; neither proves model identity. Do not claim confirmed Sheets delivery or that current firmware was re-tested on hardware during archival.
  Disclose disabled TLS certificate verification, anonymous unauthenticated writes/readback, doGet sheet-ID/tail exposure, sensitive operational logging, weak substring success detection, and loss under failure. Explain this is an educational archive with unresolved issues, not production-secure deployment. Redact any sample logs; no real IDs/URLs or credentials.
  Add dependency-free Node tests using node:test and vm to load actual Code.gs with mocked Apps Script services. Cover batch/single normalization, range rejection, seconds/milliseconds/ISO/fallback dates, empty input error, successful setValues append and lock release on success/failure. Tests must not contact Google or call the real testAppend. Add archive-check.cjs validating required paths, exact LED order/intervals, all environment filters, template markers, README/history status and wiring, manifest JSON and absence of forbidden generated/private file paths in the proposed publish set. Inspect candidate text for credential assignments and non-template Google deployment/spreadsheet URLs/IDs without reading private files. These tests verify archived behavior, not firmware feature changes.
  Run all checks and review the exact staged diff, including planning artifacts, for secrets and unjustified success claims. Stage explicit allowlisted paths only; verify ignored local config stays excluded. Never git add an original source directory or use indiscriminate git add. Commit with a message containing DAF-29. Authorized publication: push main normally (no force) and set GitHub description to "ESP32 LED development stages and DHT-compatible temperature/humidity logger for Google Sheets — firmware, wiring, history and Apps Script." Verify remote main SHA equals the local commit and fetch the published README/source listing and description using GitHub API/gh. Stop on authentication or divergent-branch errors; do not bypass safeguards. Report commit URL, checks, build warnings and remaining WiFi/HTTP403/security limitations. Do not update Linear without separate authorization. Record quick SUMMARY.md with evidence and set local planning state to completed only after remote verification; do not imply that remote summary changes are published unless committed and pushed.
  </action>
  <verify><automated>node --test tests/*.test.cjs &amp;&amp; node tests/archive-check.cjs &amp;&amp; node --check &lt; apps-script/Code.gs &amp;&amp; pio run -e blink -e forward -e pingpong200 -e pingpong100 -e diagnostics -e dht12 &amp;&amp; git diff --check &amp;&amp; git diff --cached --check</automated></verify>
  <done>Local tests/builds pass; reviewed source/docs are published on main with a DAF-29 commit; remote files, SHA and description are read back. No secrets, MCU flashing, cloud deployment or original-source modification occurred.</done>
</task>
</tasks>

<threat_model>
## Trust boundaries and STRIDE
| Threat | Category | Boundary | Severity | Disposition | Mitigation |
|---|---|---|---|---|---|
| T-ARCH-01 | Information disclosure | Private local configuration to public Git | high | mitigate | Never read/copy config.h or .clasp.json; sanitize Code.gs ID, use templates, ignore local config, review exact staged content before push. |
| T-ARCH-02 | Tampering | Reconstruction to claimed history | medium | mitigate | Mark reconstructed stages, preserve surviving source and distinguish reported hardware results from local build evidence. |
| T-ARCH-03 | Spoofing / tampering | Device HTTPS to public Apps Script | high | accept | Archival scope preserves runtime; prominently disclose insecure TLS and anonymous access, perform only mocked tests and no live endpoint requests/deployment. |
| T-ARCH-04 | Information disclosure | Public server readback | high | mitigate | Remove real sheet identity from published source; document existing doGet exposure; no live server deployment. |
| T-ARCH-05 | Tampering | Working tree to GitHub main | medium | mitigate | Verify origin, explicit staging, DAF-29 commit, normal push, remote SHA/content/description readback; never force push. |
| T-ARCH-SC | Tampering | Local build tools | low | accept | No npm/pip/cargo installation or new dependencies; reuse existing PlatformIO stack; report toolchain failures rather than adding unreviewed packages. |
</threat_model>

<verification>
Run builds locally without upload targets. PlatformIO first-build runs may exceed 60 seconds; run compilation as a normal foreground/background build and await completion notification, never poll. Node archive/script tests are the fast feedback gates. Cross-check documentation against actual source behavior and supplied observations. Verify publication using gh api repos/fathur6/pia-esp32-dht, gh api repos/fathur6/pia-esp32-dht/contents and git ls-remote origin refs/heads/main.
</verification>

## Multi-source coverage audit
| Source | ID | Item | Task | Status |
|---|---|---|---|---|
| GOAL | Phase 1 | Reproducible honest secret-free published archive | 1–3 | COVERED |
| REQ | ARCH-01 | All LED stages, diagnostics, sensor, script, wiring/setup | 1–3 | COVERED |
| REQ | ARCH-02 | Chronology, provenance, sensor uncertainty, actual failures | 3 | COVERED |
| REQ | ARCH-03 | Templates, private-file exclusion and secret review | 2–3 | COVERED |
| REQ | ARCH-04 | Builds, script tests, commit/push/description verification | 1–3 | COVERED |
| RESEARCH | — | No RESEARCH.md; existing source inspected, no new dependency | 1–3 | COVERED |
| CONTEXT | — | No CONTEXT.md/D-XX IDs; explicit approved brief is binding | 1–3 | COVERED |
| CONTEXT | Brief | Preserve originals; no config.h read, no deployment/flash; unresolved WiFi/403 | 1–3 | COVERED |

<success_criteria>
All DAF-29 acceptance criteria satisfied with remote publication evidence; runtime limitations remain accurately described rather than claimed fixed.
</success_criteria>

<output>
Create `.planning/quick/20261118-daf-29-publish/SUMMARY.md` containing files, provenance, checks, privacy review, publication SHA/URL and remaining risks.
</output>

## Execution alignment

Actual published paths use `examples/pingpong200`, `examples/pingpong100`, `examples/diag` and environment `diag` (not the earlier hyphenated/diagnostics names). Documentation uses `docs/WIRING.md` and `docs/DEVELOPMENT.md`, plus PROGRAM, SETUP, SECURITY and VERIFICATION documents. Added a safe `.clasp.example.json`, never an actual mapping. Default example sheet tab is `Sensor Data`. Parent coordinated docs and final publication; executor handled source/tests/builds without commits or external deployment.
