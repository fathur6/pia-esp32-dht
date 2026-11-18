'use strict';

// Offline behavioral archive tests: NO Google APIs, network, or real sheets.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8');
const NOW = Date.parse('2026-11-18T09:00:00Z');
const headers = ['Timestamp', 'Temperature', 'Humidity'];
const plain = value => JSON.parse(JSON.stringify(value));
const event = body => ({ postData: { contents: JSON.stringify(body) } });

function harness(options = {}) {
  const rows = options.rows ? options.rows.map(row => [...row]) : [];
  const calls = { writes: [], formats: [], frozen: [], waits: [], releases: 0, errors: [], reads: [] };
  const sheet = {
    getSheetId: () => 0,
    getLastRow: () => rows.length,
    setFrozenRows: count => calls.frozen.push(count),
    appendRow: row => rows.push([...row]),
    getRange(...args) {
      return {
        setValues(values) {
          assert.equal(args.length, 4);
          const [start, col, count, width] = args;
          assert.equal(col, 1);
          assert.equal(width, 3);
          assert.equal(values.length, count);
          for (const row of values) assert.equal(row.length, width);
          if (options.writeError) throw new Error('mock write failure');
          calls.writes.push({ args, values: plain(values) });
          values.forEach((row, index) => { rows[start - 1 + index] = [...row]; });
        },
        setNumberFormat(format) { calls.formats.push({ args, format }); },
        getDisplayValues() {
          calls.reads.push(args);
          const [start, , count] = args;
          return rows.slice(start - 1, start - 1 + count).map(row => row.map(String));
        }
      };
    }
  };
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [NOW])); }
    static now() { return NOW; }
  }
  const context = vm.createContext({
    Date: FixedDate,
    console: { error: message => calls.errors.push(message) },
    SpreadsheetApp: {
      openById(id) {
        assert.equal(id, 'YOUR_SPREADSHEET_ID');
        return {
          getSheetByName(name) {
            assert.equal(name, 'Sensor Data');
            return options.fallback ? null : sheet;
          },
          getSheets: () => options.sheets || [sheet]
        };
      }
    },
    LockService: {
      getScriptLock: () => ({
        waitLock(ms) {
          calls.waits.push(ms);
          if (options.lockError) throw new Error('mock lock timeout');
        },
        releaseLock() {
          calls.releases++;
          if (options.releaseError) throw new Error('mock release failure');
        }
      })
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: text => ({
        text,
        setMimeType(mime) { this.mime = mime; return this; }
      })
    },
    Utilities: {
      formatDate(date, timezone, format) {
        assert.equal(date.getTime(), NOW);
        assert.equal(timezone, 'Asia/Kuala_Lumpur');
        assert.equal(format, 'yyyy-MM-dd HH:mm:ss');
        return '2026-11-18 17:00:00';
      }
    }
  });
  vm.runInContext(source, context, { filename: 'Code.gs', timeout: 1000 });
  const json = output => {
    assert.equal(output.mime, 'application/json');
    return JSON.parse(output.text);
  };
  return { context, sheet, rows, calls, json };
}

test('batch normalizer accepts aliases, rounds tenths, and converts seconds/millis/ISO', () => {
  const { context } = harness();
  const input = [
    { ts: 1762000000, t: 27.44, h: 65.16 },
    { ts: 1762000005000, temperature: '27.5', humidity: '65.0' },
    { ts: '2026-11-18T08:12:34Z', t: -2.3, h: 0 },
    { ts: '1762000000', t: 0, h: 100 },
    { ts: '1762000005000', t: 125, h: 1 }
  ];
  const rows = context.readings_(event({ readings: input }));
  assert.equal(rows.length, 5);
  assert.deepEqual(Array.from(rows, row => row[0].getTime()),
    [1762000000000, 1762000005000, Date.parse(input[2].ts), 1762000000000, 1762000005000]);
  assert.deepEqual(Array.from(rows, row => Array.from(row.slice(1))),
    [[27.4, 65.2], [27.5, 65], [-2.3, 0], [0, 100], [125, 1]]);
});

test('single JSON, query string, and event parameters normalize consistently', () => {
  const { context } = harness();
  for (const e of [
    event({ temperature: 25.5, humidity: 42 }),
    { postData: { contents: 'temperature=25.5&humidity=42' } },
    { parameter: { temperature: '25.5', humidity: '42' } }
  ]) {
    const rows = context.readings_(e);
    assert.equal(rows.length, 1);
    assert.equal(rows[0][0].getTime(), NOW);
    assert.deepEqual(Array.from(rows[0].slice(1)), [25.5, 42]);
  }
});

test('undefined/null/empty/invalid timestamps fall back to server time; zero remains epoch', () => {
  const { context } = harness();
  for (const ts of [undefined, null, '', 'invalid-date']) {
    assert.equal(context.readings_(event({ readings: [{ ts, t: 1, h: 2 }] }))[0][0].getTime(), NOW);
  }
  assert.equal(context.readings_(event({ readings: [{ ts: 0, t: 1, h: 2 }] }))[0][0].getTime(), 0);
});

test('normalizer rejects missing, nonnumeric, infinite, and out-of-range values', () => {
  const { context } = harness();
  const invalid = [
    {}, null, { t: 1 }, { h: 1 }, { t: 'NaN', h: 1 }, { t: 'Infinity', h: 1 },
    { t: -40.1, h: 50 }, { t: 125.1, h: 50 }, { t: 25, h: -0.1 }, { t: 25, h: 100.1 }
  ];
  const rows = context.readings_(event({ readings: [...invalid, { t: -40, h: 0 }] }));
  assert.equal(rows.length, 1);
  assert.deepEqual(Array.from(rows[0].slice(1)), [-40, 0]);
});

test('archived limitation: Number coercion accepts null/empty/boolean as zero or one', () => {
  // This records the ORIGINAL behavior, not a recommended validation contract.
  const { context } = harness();
  const rows = context.readings_(event({
    readings: [{ t: null, h: null }, { t: '', h: false }, { t: true, h: true }]
  }));
  assert.deepEqual(Array.from(rows, row => Array.from(row.slice(1))), [[0, 0], [0, 0], [1, 1]]);
});

test('empty requests return JSON errors and release locks without sheet writes', () => {
  for (const e of [undefined, event({}), event({ readings: [] }), event({ readings: [{ t: 200, h: 1 }] })]) {
    const { context, calls, json } = harness();
    assert.deepEqual(json(context.doPost(e)),
      { status: 'error', message: 'no valid readings in payload' });
    assert.deepEqual(calls.waits, [15000]);
    assert.equal(calls.releases, 1);
    assert.equal(calls.writes.length, 0);
  }
});

test('doPost appends one three-column batch after existing header; no device column', () => {
  const { context, calls, rows, json } = harness({ rows: [headers, ['old', 20, 30]] });
  assert.deepEqual(json(context.doPost(event({
    device: 'offline-test',
    readings: [{ ts: 1762000000, t: 25.5, h: 42 }, { t: 25.6, h: 43 }]
  }))), { status: 'ok', written: 2, totalRows: 3, last: { t: 25.6, h: 43 } });
  assert.equal(rows.length, 4);
  assert.deepEqual(calls.writes[0].args, [3, 1, 2, 3]);
  assert.equal(calls.writes.length, 1);
  assert.equal(calls.releases, 1);
  assert.deepEqual(calls.waits, [15000]);
  assert.deepEqual(calls.frozen, []);
});

test('empty sheet initializes headers, freezes row and formats timestamp column once', () => {
  const { context, sheet, rows, calls, json } = harness();
  assert.equal(json(context.doPost(event({ temperature: 25, humidity: 42 }))).status, 'ok');
  assert.deepEqual(Array.from(rows[0]), headers);
  assert.deepEqual(calls.writes.map(write => write.args), [[1, 1, 1, 3], [2, 1, 1, 3]]);
  assert.deepEqual(calls.frozen, [1]);
  assert.deepEqual(calls.formats, [{ args: ['A:A'], format: 'yyyy-MM-dd HH:mm:ss' }]);
  context.ensureHeaders_(sheet);
  assert.equal(calls.writes.length, 2);
});

test('existing nonempty sheet is not relabelled or reformatted', () => {
  const { context, sheet, rows, calls } = harness({ rows: [['custom', 'head', 'row']] });
  context.ensureHeaders_(sheet);
  assert.deepEqual(rows[0], ['custom', 'head', 'row']);
  assert.equal(calls.writes.length, 0);
  assert.equal(calls.formats.length, 0);
});

test('write and lock failures become JSON errors; release attempted on both paths', () => {
  for (const options of [{ writeError: true }, { lockError: true }]) {
    const { context, calls, json } = harness({ rows: [headers], ...options });
    const reply = json(context.doPost(event({ temperature: 25, humidity: 42 })));
    assert.equal(reply.status, 'error');
    assert.match(reply.message, options.writeError ? /mock write failure/ : /mock lock timeout/);
    assert.equal(calls.releases, 1);
    assert.equal(calls.errors.length, 1);
  }
});

test('release exception is swallowed without replacing successful response', () => {
  const { context, calls, json } = harness({ rows: [headers], releaseError: true });
  assert.equal(json(context.doPost(event({ temperature: 25, humidity: 42 }))).status, 'ok');
  assert.equal(calls.releases, 1);
});

test('malformed JSON/query and JSON null are handled by doPost error response', () => {
  for (const contents of ['{', 'temperature=%ZZ&humidity=42', 'null']) {
    const { context, json, calls } = harness();
    assert.equal(json(context.doPost({ postData: { contents } })).status, 'error');
    assert.equal(calls.releases, 1);
  }
});

test('sheet resolution uses name first, then gid 0, then first tab', () => {
  const named = harness();
  assert.equal(named.context.getSheet_(), named.sheet);
  const gidZero = { getSheetId: () => 0 };
  const first = { getSheetId: () => 99 };
  const gid = harness({ fallback: true, sheets: [first, gidZero] });
  assert.equal(gid.context.getSheet_(), gidZero);
  const fallback = harness({ fallback: true, sheets: [first] });
  assert.equal(fallback.context.getSheet_(), first);
});

test('doGet returns last four rows only, local time and archived sheet-ID exposure', () => {
  const fixture = [headers, ...Array.from({ length: 6 }, (_, i) => [`time-${i}`, i, 40 + i])];
  const { context, json, calls } = harness({ rows: fixture });
  const result = json(context.doGet());
  assert.equal(result.status, 'ok');
  assert.equal(result.sheet, 'YOUR_SPREADSHEET_ID');
  assert.equal(result.time, '2026-11-18 17:00:00');
  assert.equal(result.dataRows, 6);
  assert.deepEqual(result.tail, fixture.slice(-4).map(row => row.map(String)));
  assert.deepEqual(calls.reads, [[4, 1, 4, 3]]);
});

test('doGet supports zero and fewer than four data rows', () => {
  for (const count of [0, 1, 3]) {
    const fixture = [headers, ...Array.from({ length: count }, (_, i) => [`time-${i}`, i, 42])];
    const { context, json } = harness({ rows: fixture });
    const result = json(context.doGet());
    assert.equal(result.dataRows, count);
    assert.equal(result.tail.length, count);
  }
  const empty = harness();
  assert.equal(empty.json(empty.context.doGet()).dataRows, 0);
  assert.deepEqual(Array.from(empty.rows[0]), headers);
});

test('testAppend is a synthetic fixture ONLY, invoked against isolated mocks', () => {
  const { context, rows } = harness();
  assert.equal(context.testAppend(), 'ok, lastRow=2');
  assert.equal(rows[1][0].getTime(), NOW);
  assert.deepEqual(Array.from(rows[1].slice(1)), [27.3, 64.8]);
  // These fake values are not hardware observations or evidence of Sheets delivery.
});
