#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <time.h>

#include "config.h"

// ---------------------------------------------------------------------------
// Wiring
//   DHT12 module   S   -> D27 (GPIO27)  [D34 is input-only, cannot drive DHT]
//                  VCC -> 3V3
//                  GND -> GND
//   LEDs           D13, D12, D14 -> 220-330 R -> GND  (ping-pong heartbeat)
// ---------------------------------------------------------------------------

static const int DHT_PIN = 27;

// 5 s sensor readings, uploaded in batches of 6 (= one POST every ~30 s).
static const uint32_t SAMPLE_MS = 5000;
static const uint8_t BATCH_SIZE = 6;
static const uint32_t WIFI_RETRY_MS = 5000;

// LED heartbeat
static const uint8_t LED_PINS[] = {13, 12, 14};
static const uint8_t LED_COUNT = sizeof(LED_PINS) / sizeof(LED_PINS[0]);
static const uint32_t LED_STEP_MS = 100;

struct Reading {
  uint32_t ts;  // unix seconds, 0 = unknown (server stamps it)
  float t;
  float h;
};

static Reading batchBuf[BATCH_SIZE];
static uint8_t batchCount = 0;
static uint32_t samples = 0;
static uint32_t uploadOk = 0;
static uint32_t uploadFail = 0;
static uint32_t dhtFail = 0;
static uint32_t lastSample = 0;
static uint32_t lastWifiTry = 0;
static bool timeSynced = false;

// ---------------------------------------------------------------------------
// DHTxx one-wire read (DHT11/DHT22-style timing, DHT12 decoding)
//   byte0 = humidity int, byte1 = humidity frac
//   byte2 = temp int,     byte3 = temp frac (MSB = sign)
//   byte4 = checksum
// A plain DHT11 sends frac bytes as 0 and still decodes correctly here.
// ---------------------------------------------------------------------------
static inline bool waitLevel(uint8_t pin, int level, uint32_t timeoutUs) {
  uint32_t start = micros();
  while (digitalRead(pin) != level) {
    if ((uint32_t)(micros() - start) > timeoutUs) return false;
  }
  return true;
}

static bool dhtRead(uint8_t pin, float &tOut, float &hOut) {
  uint8_t d[5] = {0, 0, 0, 0, 0};

  pinMode(pin, INPUT_PULLUP);
  delayMicroseconds(50);
  digitalWrite(pin, LOW);
  pinMode(pin, OUTPUT);
  delay(20);  // start signal: >= 18 ms low
  pinMode(pin, INPUT_PULLUP);

  // Sensor answer: ~20-40 us high, 80 us low, 80 us high, then 40 bits.
  if (!waitLevel(pin, LOW, 120)) return false;
  if (!waitLevel(pin, HIGH, 120)) return false;

  for (uint8_t i = 0; i < 40; i++) {
    if (!waitLevel(pin, LOW, 120)) return false;   // 50 us bit separator
    if (!waitLevel(pin, HIGH, 120)) return false;  // rising edge of the bit
    uint32_t t0 = micros();
    if (!waitLevel(pin, LOW, 150)) return false;   // bit ended
    uint32_t dur = (uint32_t)(micros() - t0);

    d[i >> 3] <<= 1;
    if (dur > 50) d[i >> 3] |= 1;  // long high = 1
  }

  if ((uint8_t)(d[0] + d[1] + d[2] + d[3]) != d[4]) return false;

  float h = d[0] + d[1] * 0.1f;
  float t = d[2] + (d[3] & 0x7F) * 0.1f;
  if (d[3] & 0x80) t = -t;

  if (h < 0.0f || h > 100.0f || t < -40.0f || t > 85.0f) return false;

  hOut = h;
  tOut = t;
  return true;
}

// --- LED heartbeat on its own task so HTTPS blocking never freezes it ------
static void ledTask(void *param) {
  int8_t step = 0;
  int8_t dir = 1;
  for (;;) {
    digitalWrite(LED_PINS[step], HIGH);
    vTaskDelay(pdMS_TO_TICKS(LED_STEP_MS));
    digitalWrite(LED_PINS[step], LOW);

    if (step >= (int8_t)(LED_COUNT - 1)) dir = -1;
    else if (step <= 0)                  dir = 1;
    step += dir;
  }
}

static bool ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  if (millis() - lastWifiTry < WIFI_RETRY_MS) return false;
  lastWifiTry = millis();

  Serial.printf("[WiFi] connecting to %s ...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(250);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("[WiFi] failed (status=%d), retrying later\n", WiFi.status());
    return false;
  }

  Serial.printf("[WiFi] connected  IP=%s  RSSI=%d dBm\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());

  if (!timeSynced) {
    configTime(8 * 3600, 0, "pool.ntp.org", "time.google.com");
    time_t now = time(nullptr);
    uint32_t waitStart = millis();
    while (now < 1700000000 && millis() - waitStart < 8000) {
      delay(250);
      now = time(nullptr);
    }
    timeSynced = now >= 1700000000;
    Serial.printf("[NTP] %s (epoch=%ld)\n", timeSynced ? "synced" : "not synced",
                  (long)now);
  }
  return true;
}

// POSTs the buffered rows. Returns true when the web app replied status:"ok".
static bool uploadBatch() {
  WiFiClientSecure client;
  client.setInsecure();  // TLS without cert pinning
  client.setTimeout(15);

  HTTPClient http;
  http.setTimeout(20000);
  http.setConnectTimeout(20000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

  if (!http.begin(client, WEBAPP_URL)) {
    Serial.println("[HTTP] begin() failed");
    return false;
  }
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"device\":\"" DEVICE_NAME "\",\"readings\":[";
  for (uint8_t i = 0; i < batchCount; i++) {
    if (i) payload += ",";
    if (batchBuf[i].ts) {
      payload += "{\"ts\":" + String(batchBuf[i].ts) +
                 ",\"t\":" + String(batchBuf[i].t, 1) +
                 ",\"h\":" + String(batchBuf[i].h, 1) + "}";
    } else {
      payload += "{\"t\":" + String(batchBuf[i].t, 1) +
                 ",\"h\":" + String(batchBuf[i].h, 1) + "}";
    }
  }
  payload += "]}";

  int code = http.POST((uint8_t *)payload.c_str(), payload.length());
  String body = http.getString();
  http.end();

  bool ok = (code == 200) && body.indexOf("\"ok\"") >= 0;
  String snippet = body.length() > 120 ? body.substring(0, 120) + "..." : body;
  Serial.printf("[HTTP %d] %u row(s) -> %s\n", code, batchCount, snippet.c_str());
  return ok;
}

static void flushBatch() {
  if (batchCount == 0) return;
  if (!ensureWifi()) {
    // Keep the data, but never let the buffer overflow for days.
    if (batchCount == BATCH_SIZE) {
      memmove(&batchBuf[0], &batchBuf[1], sizeof(Reading) * (BATCH_SIZE - 1));
      batchCount--;
      Serial.println("[buffer] WiFi down, dropped oldest reading");
    }
    return;
  }

  if (uploadBatch()) {
    uploadOk += batchCount;
    batchCount = 0;
  } else {
    uploadFail++;
    // Drop the oldest so a permanent failure can't wedge the firmware.
    if (batchCount == BATCH_SIZE) {
      memmove(&batchBuf[0], &batchBuf[1], sizeof(Reading) * (BATCH_SIZE - 1));
      batchCount--;
      Serial.println("[buffer] upload failed, dropped oldest reading");
    }
  }
}

static void sampleOnce() {
  float t = 0, h = 0;
  if (!dhtRead(DHT_PIN, t, h)) {
    dhtFail++;
    Serial.printf("[DHT] read failed (total %lu)\n", (unsigned long)dhtFail);
    return;
  }

  samples++;
  time_t now = time(nullptr);
  Reading r;
  r.ts = (now > 1700000000) ? (uint32_t)now : 0;
  r.t = t;
  r.h = h;
  batchBuf[batchCount++] = r;

  Serial.printf("[DHT] #%lu  %.1f C  %.1f %%RH  (batch %u/%u)\n",
                (unsigned long)samples, t, h, batchCount, BATCH_SIZE);

  if (batchCount >= BATCH_SIZE) flushBatch();
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== ESP32 DHT12 -> Google Sheets ===");

  for (uint8_t i = 0; i < LED_COUNT; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }
  xTaskCreatePinnedToCore(ledTask, "led", 2048, NULL, 1, NULL, 0);

  pinMode(DHT_PIN, INPUT_PULLUP);
  Serial.printf("Sensor: DHT12 one-wire on GPIO%d, %lu ms sampling, batch %u\n",
                DHT_PIN, (unsigned long)SAMPLE_MS, BATCH_SIZE);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  lastWifiTry = millis() - WIFI_RETRY_MS;  // allow the first attempt right away
  ensureWifi();

  lastSample = millis() - SAMPLE_MS + 2000;  // first reading ~2 s after boot
}

void loop() {
  if (millis() - lastSample >= SAMPLE_MS) {
    lastSample = millis();
    sampleOnce();
  }
  delay(20);
}
