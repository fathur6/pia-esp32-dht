# Development history

This is a retrospective from the development conversation and surviving local source files. Earlier sketches that were overwritten have been reconstructed from the recorded logic and are labelled as such. This is not a claim that each stage had a Git commit or that every historical measurement was independently revalidated.

## 1. USB connection and one LED

The first request was GPIO13 HIGH for one second, LOW for one second, repeatedly. A USB serial interface and a classic ESP32-D0WD-V3 with 4 MB flash were detected. PlatformIO with the Arduino framework was used because an ESP32 platform/toolchain was already installed, while Arduino CLI had no ESP32 core installed.

The build and upload succeeded and serial output indicated alternating ON/OFF states. Pin 13 controls an external LED in this exercise; it must not be confused with the board's own power or onboard LED.

Reconstructed source: `examples/blink/main.cpp`.

## 2. Three LEDs, forward only

The request added D12 and D14, with each LED ON for 200 ms. The initial forward implementation used:

```text
D12 → D13 → D14 → repeat
```

Only one LED was HIGH at a time. The full sequence duration was nominally 600 ms. This differed from the later user-specified physical order D13, D12, D14; the repository records both rather than rewriting history.

Reconstructed source: `examples/forward/main.cpp`.

## 3. GPIO14 troubleshooting

Only two LEDs were visible, so a diagnostic firmware was uploaded:

- GPIO14 toggled for one second HIGH/LOW, five times.
- A sequential scan drove several usable GPIOs for 1.2 seconds each.
- Serial logs showed GPIO14 readback HIGH=1 / LOW=0.

**Correction to the original interpretation:** this does not establish that the pad is “perfectly healthy”, rule out every short/load problem, or prove the third LED is correctly wired. It is only digital readback evidence. LED observation and external measurements are separate checks.

Preserved source: `examples/diag/main.cpp`. See the peripheral-disconnection warning in [WIRING.md](WIRING.md).

## 4. Forward/backward movement

The requested physical order became:

```text
D13 → D12 → D14 → D12 → D13 → …
```

An index moves through `{13,12,14}` and reverses at either end. Endpoints are not duplicated. At 200 ms per step, the return to the same endpoint takes four intervals (800 ms). Serial logs showed the expected sequence, although some earlier captures also contained noise/duplicate lines.

Reconstructed 200 ms source: `examples/pingpong200/main.cpp`.

## 5. Speed increased to 100 ms

The same ping-pong pattern was changed to 100 ms per step. The endpoint-to-same-endpoint interval is nominally 400 ms. Serial timing included steady 100 ms intervals after an initial buffered burst; do not treat the whole capture as a precise oscilloscope measurement.

Preserved source: `examples/pingpong100/main.cpp`.

## 6. Sensor logging requested

The next requirement was temperature/humidity logging to a Google spreadsheet at five-second intervals. The signal was initially attached to D34, an input-only pin on this ESP32. It was moved to **GPIO27**, which can send the sensor start pulse.

The three-pin photo resembles a DHT11-style breakout, although the sensor was called DHT12. A first library experiment failed because the selected DHTesp library had no `DHT12` model. Other libraries often targeted the I²C interface. A three-pin breakout alone is not proof of a specific model or lack of one-wire support.

The resulting sketch uses a custom pulse-timing decoder:

1. Drive data LOW for 20 ms.
2. Release it and wait for the response.
3. Measure the high pulse of each of 40 bits.
4. Assemble five bytes and check their checksum.
5. Interpret integer/fraction bytes as temperature and humidity.

It produced plausible readings. This is not calibration or definitive sensor-model verification. The decoder is not a general DHT22 decoder.

## 7. WiFi, timestamps and batching

The WiFi was configured as WPA2-PSK. Passwords are deliberately omitted from the published repository.

The user asked for five-second logging. The implementation chose six-reading batching: **nominal 5-second sampling, approximately 30-second uploads on a healthy connection**. This was a design tradeoff introduced during development, not a guarantee that rows appear every five seconds.

Reasons considered included reducing request overhead and avoiding unnecessary web-app executions. The earlier claim that 17,000 daily requests necessarily exceed an Apps Script daily-runtime quota was too broad: actual limits depend on account, service and execution type. No quota/load test was performed.

NTP is attempted after connection. Each sample uses an epoch timestamp if available; otherwise the timestamp is omitted and Apps Script uses receipt time. Unknown sample timestamps cannot be recovered from receipt time.

The LED pattern runs as a separate FreeRTOS task, so network waits do not intentionally block the LED task. The sensor and network remain in the main task and can delay each other.

## 8. Apps Script receiver

The supplied `AKfy…` value was a **deployment ID**, not the Apps Script project ID needed by clasp. After the project ID was supplied:

- `clasp pull` retrieved an empty `myFunction()` stub.
- Receiver code and manifest were pushed.
- A deployment was updated.
- The receiver evolved from individual readings to batch support.
- The final row layout matched three existing headers: Timestamp, Temperature, Humidity.

A screenshot showed the **spreadsheet title**, not an established sheet-tab name. The code tries the configured tab name, then gid 0, then the first tab. New users must inspect the actual tab name instead of assuming the document title is the tab.

The prototype includes `doGet()` status/recent rows, `doPost()` append, `testAppend()` synthetic data, and script locking. The source published here uses a placeholder spreadsheet ID. Local deployment IDs and clasp credential files are excluded.

## 9. Cloud-access investigation

Anonymous requests returned HTTP 403 (“You need access”), while a scope-free ContentService probe returned HTTP 200. The user later reported a successful JSON response in a signed-in browser. Other anonymous tests still failed.

Several hypotheses were proposed: deployment configuration, missing authorization, ownership and Workspace policy. **None was conclusively established as the root cause.** The Workspace-policy hypothesis was not proven. A Drive metadata 404 alone does not establish that another account owns an Apps Script project. A successful browser GET alone does not prove anonymous POST access. Scope differences alone do not prove a domain policy.

Personal Gmail deployment was proposed, but OAuth identity checks still showed the university account. No verified personal-account receiver URL or successful end-to-end sensor write was obtained in this development record.

Google Forms and service accounts were alternatives discussed, not implemented features. No service-account keys, OAuth tokens or WiFi secrets belong in this repository.

## 10. Final hardware upload

After the user confirmed the sensor was on GPIO27, the existing firmware was uploaded again. Flash hashes verified successfully.

The most recent serial capture showed:

```text
Sensor: DHT12 one-wire on GPIO27, 5000 ms sampling, batch 6
[WiFi] connecting to UniSZA-WiFi ...
[WiFi] failed (status=0), retrying later
[DHT] #1  25.7 C  42.0 %RH  (batch 1/6)
[DHT] #2  25.5 C  42.0 %RH  (batch 2/6)
[DHT] #3  25.6 C  42.0 %RH  (batch 3/6)
[DHT] #4  25.9 C  42.0 %RH  (batch 4/6)
```

Earlier sensor captures were around 24.x °C / 53% RH and earlier network sessions reached Google. These are different sessions, not contradictory guarantees of current connectivity.

## 11. Repository publication — DAF-29

This publication packages the real logger source, portable build configuration, reconstructed/preserved LED stages, Apps Script templates, local tests and this history. Private credentials and live destination identifiers are excluded. The template's default tab label is generalized to `Sensor Data`; set it to the actual tab name before deployment. Original local projects are left untouched.

It does not fix the existing network/sampling/decoder/security limitations, deploy a new web app, or flash the MCU again. Build/test results for the published snapshot belong in `docs/VERIFICATION.md`.
