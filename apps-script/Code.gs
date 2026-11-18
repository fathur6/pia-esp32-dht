/**
 * ESP32 + DHT12 → Google Sheets logger
 *
 * Accepts JSON POSTs from the ESP32 and appends rows to one sheet.
 *
 *   Batch (preferred, what the sketch sends):
 *   {
 *     "device": "esp32-dht12",
 *     "readings": [
 *       {"ts": 1762000000, "t": 27.4, "h": 65.1},
 *       {"ts": 1762000005, "t": 27.5, "h": 65.0}
 *     ]
 *   }
 *
 *   Single reading (still supported):
 *   {"temperature": 27.5, "humidity": 65.2}
 *
 * Runs as the deploying user, access "Anyone" (see appsscript.json), so the
 * ESP32 can POST without OAuth.
 */

const SHEET_ID = 'YOUR_SPREADSHEET_ID';
const SHEET_NAME = 'Sensor Data'; // tab name; falls back to gid 0
const SHEET_GID = 0; // gid 0 from the spreadsheet edit URL
// Matches the existing header row: Timestamp | Temperature | Humidity
const HEADERS = ['Timestamp', 'Temperature', 'Humidity'];
const TIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';
const TZ = 'Asia/Kuala_Lumpur';

/** Target sheet: by tab name, then by gid, then the first tab. */
function getSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const byName = ss.getSheetByName(SHEET_NAME);
  if (byName) return byName;
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === SHEET_GID) return sheets[i];
  }
  return sheets[0];
}

/** Writes the header row once. */
function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat(TIME_FORMAT);
  }
}

/** Extracts a normalised array of readings from the request payload. */
function readings_(e) {
  const body = parseBody_(e);

  let list = [];
  if (Array.isArray(body.readings)) {
    list = body.readings;
  } else if (body.temperature !== undefined || body.humidity !== undefined) {
    list = [{ ts: body.ts, t: body.temperature, h: body.humidity }];
  }

  const out = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i] || {};
    const t = Number(r.t !== undefined ? r.t : r.temperature);
    const h = Number(r.h !== undefined ? r.h : r.humidity);
    if (!isFinite(t) || !isFinite(h)) continue;
    if (t < -40 || t > 125 || h < 0 || h > 100) continue;

    // ts may be unix seconds, unix millis or an ISO string
    let when;
    const raw = r.ts;
    if (raw === undefined || raw === null || raw === '') {
      when = new Date();
    } else if (typeof raw === 'number' || /^\d+$/.test(String(raw))) {
      const n = Number(raw);
      when = new Date(n > 1e11 ? n : n * 1000);
    } else {
      when = new Date(raw);
    }
    if (isNaN(when.getTime())) when = new Date();

    out.push([when, Math.round(t * 10) / 10, Math.round(h * 10) / 10]);
  }
  return out;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const rows = readings_(e);
    if (rows.length === 0) {
      return json_({ status: 'error', message: 'no valid readings in payload' });
    }

    const sheet = getSheet_();
    ensureHeaders_(sheet);

    // One write call per POST instead of appendRow per reading.
    const start = Math.max(sheet.getLastRow() + 1, 2);
    sheet.getRange(start, 1, rows.length, HEADERS.length).setValues(rows);

    return json_({
      status: 'ok',
      written: rows.length,
      totalRows: start + rows.length - 2,
      last: { t: rows[rows.length - 1][1], h: rows[rows.length - 1][2] }
    });
  } catch (err) {
    console.error('doPost failed: ' + err);
    return json_({ status: 'error', message: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function doGet() {
  const sheet = getSheet_();
  ensureHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  const dataRows = Math.max(0, lastRow - 1);

  let tail = [];
  if (dataRows > 0) {
    const startRow = Math.max(2, lastRow - 3);
    const count = lastRow - startRow + 1;
    tail = sheet.getRange(startRow, 1, count, HEADERS.length).getDisplayValues();
  }

  return json_({
    status: 'ok',
    message: 'ESP32 DHT12 logger alive',
    sheet: SHEET_ID,
    time: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'),
    dataRows: dataRows,
    tail: tail
  });
}

/** Manual smoke test from the editor: writes one fake reading. */
function testAppend() {
  const sheet = getSheet_();
  ensureHeaders_(sheet);
  sheet.appendRow([new Date(), 27.3, 64.8]);
  return 'ok, lastRow=' + sheet.getLastRow();
}

function parseBody_(e) {
  if (e && e.postData && e.postData.contents) {
    const raw = e.postData.contents;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return parseQuery_(raw);
    }
  }
  return (e && e.parameter) || {};
}

function parseQuery_(text) {
  const out = {};
  String(text).split('&').forEach(function (pair) {
    const kv = pair.split('=');
    if (kv[0]) out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
  });
  return out;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
