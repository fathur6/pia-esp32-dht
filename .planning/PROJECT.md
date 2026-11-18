# PIA ESP32 DHT — archival publication

## Purpose
Publish the existing ESP32 LED and temperature/humidity logger development to https://github.com/fathur6/pia-esp32-dht under Linear DAF-29.

## Scope and approval
Aman approved source/documentation publication, a DAF-29 commit, push to main, and updating the repository description. Preserve both original local projects. No MCU flashing, Apps Script/cloud deployment, or unrelated feature development.

## Sources
- `/Users/aman/Documents/PlatformIO/Projects/esp32-dht12-sheets`: `src/main.cpp`, `platformio.ini`, `apps-script/Code.gs`, `apps-script/appsscript.json`.
- `/Users/aman/Documents/PlatformIO/Projects/esp32-blink-led`: `src/running/main.cpp`, `src/diag/main.cpp`, `platformio.ini`.
- Historical stages described by Aman: GPIO13 blink 1 second on/off; forward GPIO12,13,14 at 200 ms; ping-pong GPIO13,12,14 at 200 ms and 100 ms.

## Requirements
- ARCH-01: Publish runnable historical LED examples, diagnostics, actual sensor firmware and Apps Script, with wiring/setup instructions.
- ARCH-02: Document development chronology and evidence honestly, separating reconstructed stages from surviving source.
- ARCH-03: Publish no credentials, private endpoints/IDs, deployment mappings, generated binaries or local machine configuration.
- ARCH-04: Build every firmware example, check Apps Script locally, publish and verify remote files/description/commit.

## Evidence and limitations
Latest reported hardware observation: GPIO27 temperature 25.5–25.9 C and humidity 42%; latest WiFi attempt failed with status 0. Previous HTTP403 root cause remains unresolved; domain policy is not established. Sensor photo resembles DHT11; decoder uses DHT11/DHT12-compatible fractional format and does not establish hardware identity. End-to-end Sheets upload is not verified by these observations.

## Privacy boundary
Never read or copy `config.h` from either original project. Do not read/publish `.clasp.json`. Replace spreadsheet IDs and web-app URLs with clearly marked configuration templates. Keep original sources unchanged.

## Tracking
Linear: https://linear.app/dafcon-technologies/issue/DAF-29/document-and-publish-esp32-dht-development
Linear issue read during planning; no blocking dependencies and no project status updates were returned.
