# State

## Position
- Date: 2026-11-18 (Asia/Kuala_Lumpur)
- Milestone: DAF-29 archival publication only
- Phase: 1 — Publish existing development
- Status: Locally verified; reviewed publication commit/push pending
- Plan: `.planning/quick/20261118-daf-29-publish/PLAN.md`

## Locked scope
Preserve original local projects. Publish README, wiring, all requested LED stages, diagnostics, actual sensor firmware, Apps Script and honest development history. Use private configuration templates. Approved execution may commit with DAF-29, push main and update GitHub description. Do not flash hardware or deploy scripts.

## Risks
WiFi status 0 and earlier HTTP403 remain unresolved. Sensor identity uncertain. Firmware disables TLS certificate verification; Apps Script exposes anonymous read/write behavior and sheet details. Archive and disclose these limitations rather than changing runtime behavior or implying production readiness.

## Next action
All six firmware builds, 16 mocked tests, syntax/JSON, archive/privacy, provenance and Markdown checks passed. Commit/push the allowlisted files and read back GitHub evidence. No cloud deployment or MCU flash.
