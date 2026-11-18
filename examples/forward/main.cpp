#include <Arduino.h>

// Reconstructed historical stage, not a recovered source snapshot.
// GPIO12 -> GPIO13 -> GPIO14, 200 ms per LED; all others remain off.
static const uint8_t LED_PINS[] = {12, 13, 14};
static const uint32_t STEP_MS = 200;

void setup() {
  for (uint8_t pin : LED_PINS) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }
}

void loop() {
  for (uint8_t pin : LED_PINS) {
    digitalWrite(pin, HIGH);
    delay(STEP_MS);
    digitalWrite(pin, LOW);
  }
}
