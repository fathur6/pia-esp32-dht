# How the program works

## ESP32 firmware: `src/main.cpp`

### Settings

`DHT_PIN=27`, `SAMPLE_MS=5000`, `BATCH_SIZE=6`, and `LED_STEP_MS=100` define the main behavior. WiFi credentials and the web-app URL are compiled from the ignored local `include/config.h`.

`Reading` holds `ts` (Unix seconds), `t` (°C), and `h` (% relative humidity). `batchBuf` has room for six readings. Counters track sensor successes/failures and upload successes/failures in RAM; they are not persistent.

### `setup()`

1. Start Serial at 115200 baud.
2. Initialize GPIO13/12/14 LOW.
3. Start `ledTask()` pinned to core 0.
4. Configure the sensor input/pull-up.
5. Try WiFi immediately by backdating the retry timer.
6. Schedule the first sensor read about two seconds after setup finishes.

### `loop()` and `sampleOnce()`

`loop()` compares elapsed `millis()` with the nominal interval. At the boundary it calls `sampleOnce()`, which reads the sensor, records a timestamp if the clock is valid, adds the reading to the buffer, and calls `flushBatch()` when full.

Invalid reads increment `dhtFail` and do not enter the buffer. Uploading is tied to successful sensor reads; if the sensor stops responding, existing partial data is not flushed on a separate timer.

### `waitLevel()` and `dhtRead()`

These implement the single-data-wire pulse protocol directly using `digitalRead()` and `micros()`. A 20 ms LOW start signal is followed by sensor response pulses and 40 data bits. A long HIGH pulse (>50 µs) is treated as one. Per-edge timeouts prevent an endless wait.

The last byte must equal the low eight bits of the sum of the first four. Humidity and temperature are decoded with decimal-byte arithmetic, then range checked.

**Limitations:** task/interrupt activity can disturb timing; all-zero data passes the existing checksum/range checks; the negative-temperature layout and decimal precision depend on actual model. This snapshot is not a replacement for a validated model-specific driver.

### `ensureWifi()`

If disconnected and a retry is eligible, starts `WiFi.begin()` and waits up to 20 seconds. On a newly established connection it attempts NTP using `pool.ntp.org` / `time.google.com`, with up to eight seconds of waiting. Malaysia offset is UTC+8.

The five-second retry constant is a minimum eligibility interval, **not** a promise of reconnect attempts every five seconds: the function runs during setup and batch flushing. If NTP fails but WiFi stays connected, the early-return path does not retry NTP on its own.

### `uploadBatch()`

Serializes the current buffer into JSON and performs a blocking HTTPS POST. The current client disables certificate verification with `setInsecure()`. It enables strict redirect handling, but POST-to-GET redirects used by Apps Script need explicit testing; the setting is not proof that the final response will be followed correctly.

A result counts as success only when HTTP is 200 and the response body contains `"ok"`. It does not robustly parse the JSON `status` or confirm `written` equals the batch size. Log output is truncated to 120 response characters to avoid dumping a full error page.

### `flushBatch()`

- If WiFi fails and the buffer is full, discard its oldest reading.
- If upload succeeds, clear the buffer and update the success counter.
- If upload fails, retain recent readings but discard the oldest when full.

The buffer is volatile and bounded. No disk/flash queue, exactly-once delivery, duplicate detection, exponential backoff, or guaranteed delivery is implemented.

### `ledTask()`

An index traverses `{13,12,14}` and reverses at either end. It lights one LED, yields for 100 ms using `vTaskDelay()`, then switches it off and advances.

The repeating pattern is **13,12,14,12**. Return to GPIO13 takes four nominal intervals, or 400 ms. This is a heartbeat, not a WiFi/upload-success indicator.

## Receiver: `apps-script/Code.gs`

### `getSheet_()`

Opens `SHEET_ID`, tries `SHEET_NAME`, then `SHEET_GID`, then the first tab. Verify these settings before deployment: the fallback can otherwise write to the wrong tab.

### `ensureHeaders_()`

Writes the three headers, freezes row 1 and formats column A only when the target sheet is empty. It does not validate or reformat a pre-existing header row.

### `parseBody_()` / `parseQuery_()`

Reads JSON from `e.postData.contents`; if JSON parsing fails, attempts simple form/query parsing. Without post data, uses `e.parameter`.

The form fallback is intentionally basic and does not implement all URL-encoding semantics. Malformed input should be tested rather than assumed to behave like valid JSON.

### `readings_()`

Accepts either a `readings` array or a single `temperature`/`humidity` object. Supports Unix seconds, Unix milliseconds and ISO timestamps. Missing/invalid timestamps use server receipt time.

Numeric conversion and range checks filter rows. The existing `Number()` conversion accepts some values such as `null`/empty strings as zero; stricter schema validation is a known improvement, not an implemented guarantee. Temperature range here is −40 to 125 °C, broader than the firmware's −40 to 85 °C check.

### `doPost(e)`

Takes a script lock, normalizes the payload, appends valid rows with one `setValues()` call and returns JSON including `status`, `written`, `totalRows`, and `last`. If no valid rows exist or a service error occurs, returns JSON with `status: "error"`.

Application errors may still have HTTP 200 because ContentService returns text rather than custom HTTP error statuses. Clients must inspect JSON, not only HTTP status.

### `doGet()`

Returns status, spreadsheet ID, Malaysia-formatted time, data-row count and up to four recent rows. It calls `ensureHeaders_()`, so a first GET can initialize an empty sheet; it is not strictly read-only. With anonymous deployment, these values are publicly readable.

### `testAppend()`

Appends fixed synthetic values **27.3 °C / 64.8% RH**. It exists to authorize/test Sheets access from the editor; it is not an MCU reading.

## Payload contract

```json
{
  "device": "esp32-dht12",
  "readings": [
    {"ts": 1790000000, "t": 25.7, "h": 42.0},
    {"ts": 1790000005, "t": 25.5, "h": 42.0}
  ]
}
```

`device` is included in the firmware payload but is not written to the three-column sheet.

```json
{"status":"ok","written":2,"totalRows":2,"last":{"t":25.5,"h":42}}
```

These are illustrative payloads, not evidence of a successful production upload.
