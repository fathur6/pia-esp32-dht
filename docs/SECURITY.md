# Prototype security and reliability

## Do not publish credentials

Never commit:

- `include/config.h` with WiFi credentials or live destination URL.
- `.clasprc.json`, OAuth callback codes, access/refresh tokens or client secrets.
- Service-account private keys or passwords.
- Build binaries embedding credentials.
- Local `.clasp.json` project mappings.

Use the example templates. A `.gitignore` prevents accidental future additions; it does not remove secrets already committed. If a credential leaks, rotate/revoke it and assess history separately. Repository publication is not authorization to rotate credentials or rewrite existing history.

## TLS verification is disabled

`client.setInsecure()` encrypts the connection but does not authenticate the server's certificate. A malicious network/server could intercept or alter traffic. Use a validated trust-store/CA strategy before production. Do not “fix” TLS problems by weakening verification further.

## Public web-app endpoint

The sample manifest is `ANYONE_ANONYMOUS`, executing as the deploying user. There is no shared secret, signature, rate limit, replay defense or device authorization in the receiver.

- Anyone with the URL could submit plausible readings.
- `doGet()` exposes the spreadsheet ID and recent rows.
- An attacker could consume quotas or fill the spreadsheet.
- The URL alone is not a sufficient production authentication mechanism.

Use a disposable test spreadsheet and avoid sensitive data. Public edit access on the spreadsheet is unnecessary for an owner-executed web app.

## Validation limitations

The receiver uses JavaScript `Number()` coercion, so empty/null/boolean values are not strictly rejected as non-sensor input. Malformed rows can be skipped while other rows in a batch are accepted. There is no batch-size limit enforced by the application, no idempotency key and no duplicate check.

The MCU success check looks for a substring `"ok"` instead of strictly validating a schema and acknowledged row count. A failed acknowledgment can cause a resend after a successful append.

The custom sensor decoder accepts an all-zero checksum-valid frame, depends on microsecond software timing, and is not a general DHTxx driver. Plausible readings do not prove sensor calibration or exact model.

## Data loss and timing

- Only six readings are held in RAM.
- A full-buffer failure drops the oldest reading.
- Power loss clears the buffer and counters.
- Sensor read failures do not produce rows.
- Partial buffers wait for more successful sensor reads; no periodic partial flush exists.
- WiFi, NTP and HTTPS waits delay the main sampling loop.
- The firmware is neither a precise five-second scheduler nor a lossless logger.
- If no valid device clock exists, receipt-time stamping loses original sample spacing.
- NTP synchronization is not continuously maintained by the application logic after a failed first attempt on an otherwise connected WiFi session.

## Future improvements (not implemented)

1. Confirm the sensor model; use/test its supported driver and calibrated reference.
2. Separate sensor acquisition from network uploads with a bounded queue.
3. Add timestamped persistent buffering and an explicit retention policy.
4. Validate TLS and authenticate requests.
5. Enforce strict payload schemas, batch limits and idempotent writes.
6. Handle Apps Script response redirects and partial acknowledgments deliberately.
7. Add reconnect backoff, independent NTP retry and queue/connection status indicators.
8. Test end-to-end failure recovery before unattended use.
