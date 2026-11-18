# Publication verification — DAF-29

Date: 2026-11-18. This records local archival verification, not a new MCU or Google Sheets integration test.

## Results

| Check | Result |
|---|---|
| `pio run -e dht12 -e blink -e forward -e pingpong200 -e pingpong100 -e diag` | All six environments PASS |
| `node tests/apps-script.test.cjs` | 16 tests PASS, zero failures |
| `node tests/archive-check.cjs` | Required paths, template/privacy checks PASS |
| `node --check < apps-script/Code.gs` | PASS |
| JSON parsing of manifest and clasp template | PASS |
| Relative Markdown links / code fences | PASS |
| Logger source compared with surviving original | Byte-identical |
| Final 100 ms ping-pong compared with surviving original | Byte-identical |
| Receiver source compared with surviving original | Only Sheet ID placeholder and generic tab-name substitution |
| Manifest compared with original | Unchanged |
| `git check-ignore` for local config and firmware binary | Both ignored |
| Whitespace checks | PASS |

Build tools: PlatformIO Core **6.1.19**, Node.js **v22.23.1**. Platform: **espressif32 7.0.1**, Arduino framework package **3.20017.241212+sha.dcc1105b**, board **esp32dev**. No build warnings were observed. The logger build used a local ignored configuration containing placeholder values only.

## Provenance hashes

SHA-256:

```text
src/main.cpp
55bfd96755657913b304516b4131e96df204d7f8782d78049a10c03ef48d533b

examples/pingpong100/main.cpp
c41f7f028f06fe667bac570cfdbac800623c0e4bb6e6d63a8f742b8d14530b01
```

Blink, forward and 200 ms ping-pong are reconstructed historical examples. The diagnostic is preserved with an added warning to disconnect other peripherals before running the scan.

## What these checks do not prove

- No MCU was flashed or measured during this publication task.
- No Apps Script was pushed/deployed, and no live Sheet received test data.
- Mocked receiver tests use isolated in-memory services, not Google APIs.
- Sensor model, accuracy, uninterrupted five-second timing, reconnect reliability, real redirect handling and exactly-once delivery are not established.
- Last hardware evidence remains 25.5–25.9 °C / 42% RH, with a failed WiFi attempt; earlier HTTP403 remains unresolved.
- No credentials, actual destination identifiers or firmware binaries are intended for publication.

GitHub publication is verified separately against remote `main` and the repository contents/description; see the quick-task summary for the source commit reference.
