// SAFETY: Disconnect the GPIO27 sensor and all other peripherals before scan.
// This diagnostic actively drives many GPIOs, including GPIO27.
#include <Arduino.h>

// ---------------------------------------------------------------------------
// LED / wiring diagnostic
//
// 1) Focused test: GPIO14 ("D14") is driven HIGH/LOW for 1 s each, 5 cycles.
//    Read-back tells whether the pad is being pulled down externally (short).
// 2) Pin scan: every usable GPIO is driven HIGH for 1.2 s, one at a time.
//    Watch the board: note which header pin lights an LED for "GPIO14".
// ---------------------------------------------------------------------------

static const uint8_t SCAN_PINS[] = {12, 13, 14, 15, 16, 17, 18, 19, 21,
                                    22, 23, 25, 26, 27, 32, 33, 4, 5, 2};
static const uint8_t SCAN_COUNT = sizeof(SCAN_PINS) / sizeof(SCAN_PINS[0]);

static void driveAndReport(uint8_t pin, bool level) {
  digitalWrite(pin, level ? HIGH : LOW);
  delayMicroseconds(200);
  int rb = digitalRead(pin);
  Serial.printf("    GPIO%-2u -> %s   readback=%d\n", pin, level ? "HIGH" : "LOW ",
                rb);
}

void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println();
  Serial.println("==============================================");
  Serial.println(" LED / PIN DIAGNOSTIC");
  Serial.println(" Board: ESP32-D0WD-V3, 4MB flash");
  Serial.println("==============================================");
}

void loop() {
  // ---- 1) Dedicated GPIO14 test -------------------------------------------
  pinMode(14, OUTPUT);
  digitalWrite(14, LOW);
  Serial.println();
  Serial.println("--- SECTION 1: GPIO14 (D14) focused test ---");
  driveAndReport(14, false);

  for (uint8_t i = 1; i <= 5; i++) {
    Serial.printf("  [GPIO14 cycle %u/5]  ON for 1s  ", i);
    digitalWrite(14, HIGH);
    delayMicroseconds(200);
    Serial.printf("readback=%d\n", digitalRead(14));
    delay(1000);

    Serial.printf("  [GPIO14 cycle %u/5]  OFF for 1s ", i);
    digitalWrite(14, LOW);
    delayMicroseconds(200);
    Serial.printf("readback=%d\n", digitalRead(14));
    delay(1000);
  }
  pinMode(14, INPUT);

  // ---- 2) Full pin scan ---------------------------------------------------
  Serial.println();
  Serial.println("--- SECTION 2: pin scan (1.2 s per GPIO) ---");
  Serial.println("Watch which header pin lights up while each line is on screen.");

  for (uint8_t i = 0; i < SCAN_COUNT; i++) {
    uint8_t p = SCAN_PINS[i];
    pinMode(p, OUTPUT);
    digitalWrite(p, HIGH);
    delayMicroseconds(200);
    int rbHigh = digitalRead(p);

    digitalWrite(p, LOW);
    delayMicroseconds(200);
    int rbLow = digitalRead(p);

    Serial.printf("  [%2u/%2u] GPIO%-2u HIGH 1.2s  (readback high=%d low=%d)\n",
                  i + 1, SCAN_COUNT, p, rbHigh, rbLow);

    digitalWrite(p, HIGH);
    delay(1200);
    digitalWrite(p, LOW);
    pinMode(p, INPUT);
  }

  Serial.println("--- scan complete, repeating in 3 s ---");
  Serial.println("Report: when 'GPIO14' was HIGH, did the 3rd LED light?");
  Serial.println("If a DIFFERENT header pin lit instead, the silkscreen is offset.");
  delay(3000);
}
