# Setup, build, upload and cloud deployment

## 1. Prepare hardware

Follow [WIRING.md](WIRING.md), confirm the exact sensor model, and use a USB data cable. For the normal logger, sensor signal is GPIO27; LEDs are GPIO13/12/14. Do not run the broad GPIO diagnostic with the sensor or other peripherals attached.

The build target is classic ESP32 (`esp32dev`), Arduino framework. ESP32-S2/S3/C3 boards require different board/toolchain settings and may not support the pinned dual-core LED task unchanged.

## 2. Install tools

- Git.
- PlatformIO Core CLI or the PlatformIO IDE extension.
- Node.js for receiver tests and optional clasp CLI.

Example macOS installation using an existing Homebrew:

```bash
brew install platformio node
npm install --global @google/clasp
```

Check tools before continuing:

```bash
pio --version
node --version
clasp --version
```

PlatformIO downloads framework/toolchain packages on the first build. Use `platformio.ini` as the source of build-environment names and version settings.

## 3. Configure the logger locally

```bash
cp include/config.example.h include/config.h
```

Edit the copied file:

- `WIFI_SSID`: a reachable 2.4 GHz WPA2-PSK network.
- `WIFI_PASS`: the matching password.
- `WEBAPP_URL`: your deployed Apps Script `/exec` URL.
- `DEVICE_NAME`: a short identifier.

The original project used `UniSZA-WiFi`. Its password is not supplied in the repository. Enterprise/802.1X, captive-portal login and 5-GHz-only networks are not supported by this sketch's PSK connection code.

Use simple configuration string values. `DEVICE_NAME` is inserted into JSON without escaping; do not include quotes or backslashes.

Verify `include/config.h` is ignored:

```bash
git check-ignore include/config.h
```

## 4. Create the spreadsheet

Create a spreadsheet you own (prefer a dedicated test sheet initially). Row 1:

```text
Timestamp | Temperature | Humidity
```

Copy the ID between `/d/` and `/edit` from its URL. Inspect the **bottom tab label**, not the document title. Configure these in `apps-script/Code.gs`:

```javascript
const SHEET_ID = 'YOUR_SPREADSHEET_ID';
const SHEET_NAME = 'Sensor Data'; // replace with actual tab name
const SHEET_GID = 0; // replace if using another tab ID
```

The code falls back from name to gid to first tab, so verify the selected destination. Set the spreadsheet timezone to **Asia/Kuala_Lumpur** in Sheets settings too: the Apps Script manifest timezone alone does not necessarily change spreadsheet date display.

The ESP32 does not need public edit access to the spreadsheet when the script executes as the owner. Keep spreadsheet access restricted unless public sharing is independently intended.

## 5. Create / connect Apps Script

### Browser route

1. Create a project at `https://script.google.com`.
2. Paste `apps-script/Code.gs`, replacing the template Sheet ID.
3. Set runtime/timezone and deployment settings using the supplied manifest.
4. Save.

### clasp route

Enable the Apps Script API for the intended account if required by clasp. Authenticate deliberately as the project owner:

```bash
clasp login
```

Within `apps-script/`, copy the mapping template and replace its placeholder:

```bash
cp .clasp.example.json .clasp.json
```

`scriptId` is the **project ID** visible in project settings/editor URL, not the web-app deployment ID beginning `AKfy…`.

Before pushing:

```bash
clasp status
clasp push
```

Verify `.clasp.json` targets the intended project. Do not use `--force` casually, do not overwrite another project's code, and do not commit credentials or local mapping.

`clasp pull` may save server script files as `.js`. Avoid leaving both `Code.gs` and `Code.js` defining the same globals/functions. Pull into a separate verification directory when comparing remote code.

## 6. Authorize and deploy

1. In the editor select `testAppend`.
2. Click Run and review the requested access.
3. Approve only if this is the project/code/account intended.
4. Inspect the dedicated test sheet for one synthetic row.

`testAppend()` writes sample data; it should not be mixed unknowingly with real observations.

Deploy a web app:

- **Execute as:** Me / project owner.
- **Who has access:** Anyone, if allowed by the account.
- Copy the **Web app URL** ending in `/exec`.

With clasp 3.x, use:

```bash
clasp create-deployment -d "ESP32 DHT prototype"
clasp list-deployments
```

To update a known deployment after changing source:

```bash
clasp push
clasp create-deployment -i YOUR_DEPLOYMENT_ID -d "Updated receiver"
```

A source push does not automatically change an existing versioned `/exec` deployment. Do not deploy new copies repeatedly as a substitute for diagnosing access errors.

## 7. Test anonymous access before flashing

Use a test spreadsheet and your own URL:

```bash
export WEBAPP_URL='https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
curl --location --max-time 30 "$WEBAPP_URL"
```

The GET response should be JSON, not a Google sign-in/access page. GET also initializes headers on an empty sheet.

Send explicitly synthetic test values:

```bash
curl --location --max-time 45 \
  --header 'Content-Type: application/json' \
  --data '{"readings":[{"t":25.7,"h":42.0},{"t":25.5,"h":42.0}]}' \
  "$WEBAPP_URL"
```

Do not add `-X POST` unnecessarily with `--location`: forcing the verb can incorrectly preserve POST on the ContentService redirect, where fetching the response uses GET.

Check all three:

1. Response JSON says `status: "ok"` and `written: 2`.
2. The intended sheet has exactly the expected two test rows.
3. The same access works anonymously, not only in the owner's signed-in browser.

If HTTP403 persists, inspect deployment access, execution identity, consent, exact deployment URL and relevant admin settings. The earlier university-policy diagnosis was not proven.

## 8. Build and upload

```bash
pio run -e dht12
pio device list
pio run -e dht12 -t upload --upload-port /dev/cu.YOUR_USB_PORT
pio device monitor --port /dev/cu.YOUR_USB_PORT --baud 115200
```

Close other serial monitors first. Builds do not flash hardware; `-t upload` does.

Watch for:

```text
[WiFi] connected ...
[NTP] synced ...
[DHT] #1 ... (batch 1/6)
...
[HTTP 200] 6 row(s) -> {"status":"ok",...}
```

These lines are expected examples, not a statement that the current prototype has achieved them all.

**Redirect caveat:** the preserved Arduino HTTP client uses `HTTPC_STRICT_FOLLOW_REDIRECTS`, which may not follow the POST redirect needed by Apps Script. Do not interpret an HTTP302 alone as no write: the POST may already have appended rows. Diagnose the redirect and acknowledgment path before retrying, or duplicates may result. Fixing this reliably requires a tested firmware change rather than an undocumented switch.

## 9. Standalone LED development stages

Build/upload one environment at a time:

| Environment | Behavior |
|---|---|
| `blink` | GPIO13: 1000 ms ON / 1000 ms OFF |
| `forward` | GPIO12 → 13 → 14, 200 ms each |
| `pingpong200` | GPIO13 → 12 → 14 → 12, 200 ms each |
| `pingpong100` | Same ping-pong, 100 ms each |
| `diag` | GPIO14 test and broad GPIO scan; disconnect peripherals |
| `dht12` | Sensor + WiFi + batching + LED task |

Example:

```bash
pio run -e pingpong100
pio run -e pingpong100 -t upload --upload-port /dev/cu.YOUR_USB_PORT
```

The first three LED stages are reconstructed examples. The final 100 ms sketch and diagnostic are preserved source snapshots. See [DEVELOPMENT.md](DEVELOPMENT.md).

## 10. Acceptance test for a working logger

- Confirm sensor model and verify readings against a reference instrument.
- Capture at least 12 actual samples with timestamps.
- Verify two batches in the intended sheet, no synthetic rows mistaken for sensor values.
- Measure real sample intervals, including during HTTPS operations.
- Test WiFi loss, recovery, sensor read failure and MCU restart.
- Check duplicate/lost rows and timestamp behavior.
- Verify public endpoint security and actual spreadsheet sharing.

These checks are **not yet all passed**. Build success and mocked unit tests are only part of verification.
