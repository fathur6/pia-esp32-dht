// Offline publication checks. Never reads ignored local configuration.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const required = [
  'README.md', 'platformio.ini', '.gitignore',
  'include/config.example.h', 'src/main.cpp',
  'apps-script/Code.gs', 'apps-script/appsscript.json',
  'apps-script/.clasp.example.json',
  'examples/blink/main.cpp', 'examples/forward/main.cpp',
  'examples/pingpong200/main.cpp', 'examples/pingpong100/main.cpp',
  'examples/diag/main.cpp', 'tests/apps-script.test.cjs',
  'docs/WIRING.md', 'docs/SETUP.md', 'docs/DEVELOPMENT.md',
  'docs/PROGRAM.md', 'docs/SECURITY.md',
];
for (const file of required) assert.ok(fs.existsSync(path.join(root, file)), file);
const ini = read('platformio.ini');
for (const env of ['dht12', 'blink', 'forward', 'pingpong200', 'pingpong100', 'diag']) {
  assert.ok(ini.includes(`[env:${env}]`), `environment ${env}`);
}
assert.match(ini, /espressif32@7\.0\.1/);
assert.doesNotMatch(ini, /\/dev\/cu\./, 'must not hardcode original USB port');
assert.match(read('src/main.cpp'), /DHT_PIN\s*=\s*27/);
assert.match(read('src/main.cpp'), /SAMPLE_MS\s*=\s*5000/);
assert.match(read('src/main.cpp'), /BATCH_SIZE\s*=\s*6/);
assert.match(read('examples/forward/main.cpp'), /\{\s*12\s*,\s*13\s*,\s*14\s*\}/);
for (const [env, ms] of [['pingpong200', 200], ['pingpong100', 100]]) {
  const text = read(`examples/${env}/main.cpp`);
  assert.match(text, /\{\s*13\s*,\s*12\s*,\s*14\s*\}/);
  assert.match(text, new RegExp(`STEP_MS\\s*=\\s*${ms}\\b`));
}
assert.match(read('include/config.example.h'), /WIFI_SSID/);
assert.match(read('include/config.example.h'), /WIFI_PASS/);
assert.match(read('include/config.example.h'), /YOUR_DEPLOYMENT_ID/);
assert.match(read('apps-script/Code.gs'), /YOUR_SPREADSHEET_ID/);
assert.match(read('apps-script/.clasp.example.json'), /YOUR_SCRIPT_ID/);
assert.equal(JSON.parse(read('apps-script/appsscript.json')).timeZone, 'Asia/Kuala_Lumpur');
const ignore = read('.gitignore');
assert.match(ignore, /config\.h/);
assert.match(ignore, /\.clasp\.json/);
assert.match(ignore, /\.pio/);
const readme = read('README.md');
assert.match(readme, /not.*verified/i);
assert.match(readme, /GPIO27/);
assert.match(read('docs/DEVELOPMENT.md'), /reconstructed/i);
assert.match(read('docs/DEVELOPMENT.md'), /not.*proven/i);
// Include planning files as well; scan only text candidates, not secrets in ignored paths.
const candidates = [...required];
function walk(dir) {
  if (!fs.existsSync(path.join(root, dir))) return;
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(file);
    else candidates.push(file);
  }
}
walk('.planning');
const forbidden = [
  /AKfy[a-zA-Z0-9_-]{20,}/,
  /https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9_-]{20,}/,
  /ya29\.[a-zA-Z0-9_-]+/,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
  /4\/0A[a-zA-Z0-9_-]{20,}/,
];
for (const file of candidates) {
  const text = read(file);
  for (const pattern of forbidden) assert.doesNotMatch(text, pattern, `private identifier in ${file}`);
}
console.log(`Archive checks passed (${required.length} required paths, template/privacy checks).`);
